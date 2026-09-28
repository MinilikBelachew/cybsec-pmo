import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { ZohoHttpClient } from '../client/zoho-http.client';
import {
  ZOHO_BOOKS_INTEGRATION,
  ZOHO_ENTITY_TYPE,
  ZOHO_SYNC_DIRECTION,
} from '../zoho.constants';
import {
  resolveZohoFailedSyncRecord,
  upsertZohoFailedSyncRecord,
} from '../utils/failed-sync-record.util';
import { ZohoFailedSyncFinanceAlertService } from '../zoho-failed-sync-finance-alert.service';

export type ZohoBooksInvoiceRecord = {
  invoice_id: string | number;
  invoice_number?: string;
  customer_name?: string | null;
  reference_number?: string | null;
  status?: string | null;
  total?: number | string | null;
  balance?: number | string | null;
  currency_code?: string | null;
  date?: string | null;
  due_date?: string | null;
  last_payment_date?: string | null;
  payment_made?: number | string | null;
};

export type ZohoInvoiceSyncResult = {
  fetched: number;
  upserted: number;
  unmatched: number;
  failed: number;
};

export type ZohoInvoiceByIdResult = {
  success: boolean;
  message: string;
};

export type ZohoInvoiceReconcileIssue = {
  kind:
    | 'missing_in_pmo'
    | 'missing_in_books'
    | 'field_mismatch'
    | 'unlinked';
  zohoInvoiceId: string;
  invoiceNumber: string | null;
  projectId: string | null;
  projectName: string | null;
  details: string;
  books?: {
    amount: string | null;
    status: string | null;
    dueDate: string | null;
    collectionDate: string | null;
  };
  pmo?: {
    amount: string | null;
    status: string | null;
    dueDate: string | null;
    collectionDate: string | null;
  };
};

export type ZohoInvoiceReconcileResult = {
  booksCount: number;
  pmoCount: number;
  matched: number;
  missingInPmo: number;
  missingInBooks: number;
  fieldMismatch: number;
  unlinked: number;
  issues: ZohoInvoiceReconcileIssue[];
};

@Injectable()
export class InvoiceSyncService {
  private readonly logger = new Logger(InvoiceSyncService.name);

  constructor(
    private readonly zohoHttp: ZohoHttpClient,
    private readonly prisma: PrismaService,
    private readonly failedSyncFinanceAlerts: ZohoFailedSyncFinanceAlertService,
  ) {}

  async syncInvoices(): Promise<ZohoInvoiceSyncResult> {
    const invoices =
      await this.zohoHttp.booksGetAllInvoices<ZohoBooksInvoiceRecord>();

    let upserted = 0;
    let unmatched = 0;
    let failed = 0;

    for (const inv of invoices) {
      const result = await this.upsertInvoice(inv);
      if (result.ok) {
        upserted += 1;
        if (result.unmatched) unmatched += 1;
      } else {
        failed += 1;
      }
    }

    return {
      fetched: invoices.length,
      upserted,
      unmatched,
      failed,
    };
  }

  /**
   * Compare live Zoho Books invoices to PMO rows (M5.4-04 reconciliation).
   * Does not write — reports missing / field drift / unlinked only.
   */
  async reconcileInvoices(): Promise<ZohoInvoiceReconcileResult> {
    const books =
      await this.zohoHttp.booksGetAllInvoices<ZohoBooksInvoiceRecord>();
    const pmoRows = await this.prisma.invoice.findMany({
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    const pmoByZohoId = new Map(
      pmoRows.map((row) => [row.zohoInvoiceId, row] as const),
    );
    const booksIds = new Set<string>();
    const issues: ZohoInvoiceReconcileIssue[] = [];
    let matched = 0;

    for (const inv of books) {
      const zohoInvoiceId = String(inv.invoice_id ?? '').trim();
      if (!zohoInvoiceId) continue;
      booksIds.add(zohoInvoiceId);

      const booksAmount =
        this.parseAmount(inv.total) ?? this.parseAmount(inv.balance);
      const booksStatus = this.normalizeStatus(inv.status);
      const booksDue =
        this.parseDate(inv.due_date) ?? this.parseDate(inv.date);
      const booksCollection = this.parseDate(inv.last_payment_date);
      const invoiceNumber =
        (inv.invoice_number?.trim() || zohoInvoiceId).slice(0, 100) || null;

      const pmo = pmoByZohoId.get(zohoInvoiceId);
      if (!pmo) {
        issues.push({
          kind: 'missing_in_pmo',
          zohoInvoiceId,
          invoiceNumber,
          projectId: null,
          projectName: null,
          details: 'Present in Zoho Books but not in PMO — run Sync invoices',
          books: {
            amount: booksAmount != null ? String(booksAmount) : null,
            status: booksStatus,
            dueDate: booksDue ? booksDue.toISOString().slice(0, 10) : null,
            collectionDate: booksCollection
              ? booksCollection.toISOString().slice(0, 10)
              : null,
          },
        });
        continue;
      }

      const diffs: string[] = [];
      const pmoAmount = Number(pmo.amount.toString());
      if (
        booksAmount != null &&
        Number.isFinite(pmoAmount) &&
        Math.abs(pmoAmount - booksAmount) > 0.01
      ) {
        diffs.push(
          `amount Books=${booksAmount} PMO=${pmo.amount.toString()}`,
        );
      }
      if (booksStatus !== pmo.status) {
        diffs.push(`status Books=${booksStatus} PMO=${pmo.status}`);
      }
      const pmoDue = pmo.dueDate.toISOString().slice(0, 10);
      const booksDueIso = booksDue
        ? booksDue.toISOString().slice(0, 10)
        : null;
      if (booksDueIso && booksDueIso !== pmoDue) {
        diffs.push(`dueDate Books=${booksDueIso} PMO=${pmoDue}`);
      }
      const pmoCollection = pmo.collectionDate
        ? pmo.collectionDate.toISOString().slice(0, 10)
        : null;
      const booksCollectionIso = booksCollection
        ? booksCollection.toISOString().slice(0, 10)
        : null;
      if (booksCollectionIso !== pmoCollection) {
        diffs.push(
          `collectionDate Books=${booksCollectionIso ?? '—'} PMO=${pmoCollection ?? '—'}`,
        );
      }

      if (diffs.length > 0) {
        issues.push({
          kind: 'field_mismatch',
          zohoInvoiceId,
          invoiceNumber: pmo.invoiceNumber,
          projectId: pmo.projectId,
          projectName: pmo.project?.name ?? null,
          details: diffs.join('; '),
          books: {
            amount: booksAmount != null ? String(booksAmount) : null,
            status: booksStatus,
            dueDate: booksDueIso,
            collectionDate: booksCollectionIso,
          },
          pmo: {
            amount: pmo.amount.toString(),
            status: pmo.status,
            dueDate: pmoDue,
            collectionDate: pmoCollection,
          },
        });
      } else {
        matched += 1;
      }

      if (!pmo.projectId) {
        issues.push({
          kind: 'unlinked',
          zohoInvoiceId,
          invoiceNumber: pmo.invoiceNumber,
          projectId: null,
          projectName: null,
          details: 'In PMO but not linked to a project',
          pmo: {
            amount: pmo.amount.toString(),
            status: pmo.status,
            dueDate: pmoDue,
            collectionDate: pmoCollection,
          },
        });
      }
    }

    for (const pmo of pmoRows) {
      if (booksIds.has(pmo.zohoInvoiceId)) continue;
      issues.push({
        kind: 'missing_in_books',
        zohoInvoiceId: pmo.zohoInvoiceId,
        invoiceNumber: pmo.invoiceNumber,
        projectId: pmo.projectId,
        projectName: pmo.project?.name ?? null,
        details:
          'Present in PMO but not returned by Zoho Books list (deleted/voided or out of sync)',
        pmo: {
          amount: pmo.amount.toString(),
          status: pmo.status,
          dueDate: pmo.dueDate.toISOString().slice(0, 10),
          collectionDate: pmo.collectionDate
            ? pmo.collectionDate.toISOString().slice(0, 10)
            : null,
        },
      });
    }

    return {
      booksCount: booksIds.size,
      pmoCount: pmoRows.length,
      matched,
      missingInPmo: issues.filter((i) => i.kind === 'missing_in_pmo').length,
      missingInBooks: issues.filter((i) => i.kind === 'missing_in_books')
        .length,
      fieldMismatch: issues.filter((i) => i.kind === 'field_mismatch').length,
      unlinked: issues.filter((i) => i.kind === 'unlinked').length,
      issues: issues.slice(0, 500),
    };
  }

  async syncInvoiceByZohoId(
    zohoInvoiceId: string,
    resolvedBy?: string | null,
  ): Promise<ZohoInvoiceByIdResult> {
    const id = zohoInvoiceId.trim();
    if (!id) {
      return { success: false, message: 'Missing Zoho invoice id' };
    }

    try {
      const inv =
        await this.zohoHttp.booksGetInvoiceById<ZohoBooksInvoiceRecord>(id);
      if (!inv) {
        await this.recordFailedSync(id, 'Invoice not found in Zoho Books', {
          zohoInvoiceId: id,
        });
        return { success: false, message: 'Invoice not found in Zoho Books' };
      }

      const result = await this.upsertInvoice(inv, resolvedBy);
      if (!result.ok) {
        return {
          success: false,
          message: result.errorMsg ?? 'Invoice sync failed',
        };
      }
      return { success: true, message: 'Invoice synced from Zoho Books' };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown invoice sync error';
      this.logger.warn(`Failed to sync Zoho Books invoice ${id}: ${message}`);
      await this.recordFailedSync(id, message, { zohoInvoiceId: id });
      return { success: false, message };
    }
  }

  private async upsertInvoice(
    inv: ZohoBooksInvoiceRecord,
    resolvedBy?: string | null,
  ): Promise<{ ok: boolean; unmatched?: boolean; errorMsg?: string }> {
    const zohoInvoiceId = String(inv.invoice_id ?? '').trim();
    if (!zohoInvoiceId) {
      return { ok: false, errorMsg: 'Missing invoice_id' };
    }

    const now = new Date();
    try {
      const amount =
        this.parseAmount(inv.total) ?? this.parseAmount(inv.balance) ?? 0;
      const balance = this.parseAmount(inv.balance);
      const paymentMade = this.parseAmount(inv.payment_made);
      const dueDate =
        this.parseDate(inv.due_date) ?? this.parseDate(inv.date) ?? now;
      const invoiceDate = this.parseDate(inv.date);
      const collectionDate = this.parseDate(inv.last_payment_date);
      const status = this.normalizeStatus(inv.status);
      const invoiceNumber = (inv.invoice_number?.trim() || zohoInvoiceId).slice(
        0,
        100,
      );
      const currency = (inv.currency_code?.trim() || 'USD').slice(0, 10);
      const customerName = inv.customer_name?.trim()?.slice(0, 255) || null;
      const referenceNumber =
        inv.reference_number?.trim()?.slice(0, 255) || null;

      const existing = await this.prisma.invoice.findUnique({
        where: { zohoInvoiceId },
        select: { projectId: true },
      });

      let projectId: string | null = existing?.projectId ?? null;
      if (!projectId) {
        projectId = await this.resolveProjectIdByUniqueCustomer(customerName);
      }

      await this.prisma.invoice.upsert({
        where: { zohoInvoiceId },
        create: {
          zohoInvoiceId,
          projectId,
          invoiceNumber,
          customerName,
          referenceNumber,
          amount: new Prisma.Decimal(amount),
          balance: balance === null ? null : new Prisma.Decimal(balance),
          paymentMade:
            paymentMade === null ? null : new Prisma.Decimal(paymentMade),
          currency,
          invoiceDate,
          dueDate,
          collectionDate,
          status,
          syncedAt: now,
        },
        update: {
          ...(existing?.projectId ? {} : { projectId }),
          invoiceNumber,
          customerName,
          referenceNumber,
          amount: new Prisma.Decimal(amount),
          balance: balance === null ? null : new Prisma.Decimal(balance),
          paymentMade:
            paymentMade === null ? null : new Prisma.Decimal(paymentMade),
          currency,
          invoiceDate,
          dueDate,
          collectionDate,
          status,
          syncedAt: now,
        },
      });

      await resolveZohoFailedSyncRecord(this.prisma, {
        integration: ZOHO_BOOKS_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.INVOICE,
        entityId: zohoInvoiceId,
        resolvedBy,
      });

      return { ok: true, unmatched: !projectId };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown invoice upsert error';
      this.logger.warn(
        `Failed to upsert Zoho Books invoice ${zohoInvoiceId}: ${message}`,
      );
      await this.recordFailedSync(zohoInvoiceId, message, inv);
      return { ok: false, errorMsg: message };
    }
  }

  /** Customer display name → Active customer with exactly one project. */
  private async resolveProjectIdByUniqueCustomer(
    customerName: string | null,
  ): Promise<string | null> {
    if (!customerName) {
      return null;
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        displayName: { equals: customerName, mode: 'insensitive' },
        status: 'Active',
      },
      select: { id: true },
    });
    if (!customer) {
      return null;
    }

    const projects = await this.prisma.project.findMany({
      where: { customerId: customer.id },
      select: { id: true },
      take: 2,
    });
    if (projects.length === 1) {
      return projects[0].id;
    }
    return null;
  }

  private normalizeStatus(status: string | null | undefined): string {
    const s = (status ?? 'unpaid').trim().toLowerCase();
    if (!s) return 'unpaid';
    return s.slice(0, 20);
  }

  private parseAmount(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (!value?.trim()) {
      return null;
    }
    const parsed = new Date(`${value.trim()}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private async recordFailedSync(
    entityId: string,
    errorMsg: string,
    payload: unknown,
  ): Promise<void> {
    const outcome = await upsertZohoFailedSyncRecord(this.prisma, {
      integration: ZOHO_BOOKS_INTEGRATION,
      entityType: ZOHO_ENTITY_TYPE.INVOICE,
      entityId,
      direction: ZOHO_SYNC_DIRECTION.INBOUND,
      errorMsg,
      payload: payload as Prisma.InputJsonValue,
    });
    await this.failedSyncFinanceAlerts.maybeNotify(outcome);
  }
}
