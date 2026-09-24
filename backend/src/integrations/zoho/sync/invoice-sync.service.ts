import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { ZohoHttpClient } from '../client/zoho-http.client';
import {
  ZOHO_BOOKS_INTEGRATION,
  ZOHO_ENTITY_TYPE,
  ZOHO_SYNC_DIRECTION,
} from '../zoho.constants';

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class InvoiceSyncService {
  private readonly logger = new Logger(InvoiceSyncService.name);

  constructor(
    private readonly zohoHttp: ZohoHttpClient,
    private readonly prisma: PrismaService,
  ) {}

  async syncInvoices(): Promise<ZohoInvoiceSyncResult> {
    const invoices =
      await this.zohoHttp.booksGetAllInvoices<ZohoBooksInvoiceRecord>();

    let upserted = 0;
    let unmatched = 0;
    let failed = 0;
    const now = new Date();

    for (const inv of invoices) {
      const zohoInvoiceId = String(inv.invoice_id ?? '').trim();
      if (!zohoInvoiceId) {
        failed += 1;
        continue;
      }

      try {
        const projectId = await this.resolveProjectId(inv);
        if (!projectId) {
          unmatched += 1;
          await this.recordFailedSync(
            zohoInvoiceId,
            `Unmatched invoice ${inv.invoice_number ?? zohoInvoiceId}: no project from reference_number or unique customer`,
            inv,
          );
          continue;
        }

        const amount = this.parseAmount(inv.total ?? inv.balance) ?? 0;
        const dueDate = this.parseDate(inv.due_date) ?? this.parseDate(inv.date) ?? now;
        const collectionDate = this.parseDate(inv.last_payment_date);
        const status = this.normalizeStatus(inv.status);
        const invoiceNumber = (inv.invoice_number?.trim() || zohoInvoiceId).slice(
          0,
          100,
        );
        const currency = (inv.currency_code?.trim() || 'USD').slice(0, 10);

        await this.prisma.invoice.upsert({
          where: { zohoInvoiceId },
          create: {
            zohoInvoiceId,
            projectId,
            invoiceNumber,
            amount: new Prisma.Decimal(amount),
            currency,
            dueDate,
            collectionDate,
            status,
            syncedAt: now,
          },
          update: {
            projectId,
            invoiceNumber,
            amount: new Prisma.Decimal(amount),
            currency,
            dueDate,
            collectionDate,
            status,
            syncedAt: now,
          },
        });

        upserted += 1;
        await this.resolveFailedSync(zohoInvoiceId);
      } catch (err) {
        failed += 1;
        const message =
          err instanceof Error ? err.message : 'Unknown invoice upsert error';
        this.logger.warn(
          `Failed to upsert Zoho Books invoice ${zohoInvoiceId}: ${message}`,
        );
        await this.recordFailedSync(zohoInvoiceId, message, inv);
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
   * 1) reference_number = UUID or pmo:{uuid}
   * 2) customer_name → Customer with exactly one project
   */
  private async resolveProjectId(
    inv: ZohoBooksInvoiceRecord,
  ): Promise<string | null> {
    const fromRef = this.projectIdFromReference(inv.reference_number);
    if (fromRef) {
      const exists = await this.prisma.project.findUnique({
        where: { id: fromRef },
        select: { id: true },
      });
      if (exists) {
        return exists.id;
      }
    }

    const customerName = inv.customer_name?.trim();
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

  private projectIdFromReference(
    reference: string | null | undefined,
  ): string | null {
    const raw = reference?.trim();
    if (!raw) {
      return null;
    }
    const withoutPrefix = raw.toLowerCase().startsWith('pmo:')
      ? raw.slice(4).trim()
      : raw;
    return UUID_RE.test(withoutPrefix) ? withoutPrefix : null;
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
    const now = new Date();
    const existing = await this.prisma.failedSyncRecord.findFirst({
      where: {
        integration: ZOHO_BOOKS_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.INVOICE,
        entityId,
        isResolved: false,
      },
    });

    if (existing) {
      await this.prisma.failedSyncRecord.update({
        where: { id: existing.id },
        data: {
          errorMsg,
          retryCount: existing.retryCount + 1,
          lastAttempted: now,
          payload: payload as Prisma.InputJsonValue,
        },
      });
      return;
    }

    await this.prisma.failedSyncRecord.create({
      data: {
        integration: ZOHO_BOOKS_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.INVOICE,
        entityId,
        direction: ZOHO_SYNC_DIRECTION.INBOUND,
        errorMsg,
        retryCount: 1,
        lastAttempted: now,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  private async resolveFailedSync(entityId: string): Promise<void> {
    await this.prisma.failedSyncRecord.updateMany({
      where: {
        integration: ZOHO_BOOKS_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.INVOICE,
        entityId,
        isResolved: false,
      },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    });
  }
}
