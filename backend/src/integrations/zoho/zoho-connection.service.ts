import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../config/config.type';
import { PrismaService } from '../../database/prisma.service';
import { ZohoHttpClient } from './client/zoho-http.client';
import { OpportunitySyncService } from './sync/opportunity-sync.service';
import {
  ZOHO_BOOKS_INTEGRATION,
} from './zoho.constants';
import { InvoiceSyncService } from './sync/invoice-sync.service';

@Injectable()
export class ZohoConnectionService {
  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly zohoHttp: ZohoHttpClient,
    private readonly opportunitySync: OpportunitySyncService,
    private readonly invoiceSync: InvoiceSyncService,
    private readonly prisma: PrismaService,
  ) {}

  isConfigured(): boolean {
    return this.zohoHttp.isConfigured();
  }

  async getStatus() {
    const cfg = this.configService.get('zoho', { infer: true });
    const opportunityCount = await this.prisma.crmOpportunity.count();
    const latest = await this.prisma.crmOpportunity.findFirst({
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true },
    });
    const openFailures = await this.prisma.failedSyncRecord.count({
      where: {
        integration: 'zoho_crm',
        isResolved: false,
      },
    });
    const provisionedProjectCount = await this.prisma.project.count({
      where: { crmOpportunityId: { not: null } },
    });
    const openProvisionFailures = await this.prisma.failedSyncRecord.count({
      where: {
        integration: 'zoho_crm',
        entityType: 'charter_provision',
        isResolved: false,
      },
    });
    const recentProvisionErrors = await this.prisma.failedSyncRecord.findMany({
      where: {
        integration: 'zoho_crm',
        entityType: 'charter_provision',
        isResolved: false,
      },
      orderBy: { lastAttempted: 'desc' },
      take: 5,
      select: {
        entityId: true,
        errorMsg: true,
        lastAttempted: true,
        retryCount: true,
      },
    });

    return {
      configured: this.isConfigured(),
      dc: cfg?.dc ?? 'com',
      accountsBaseUrl: cfg?.accountsBaseUrl ?? null,
      apiBaseUrl: cfg?.apiBaseUrl ?? null,
      opportunityCount,
      lastSyncedAt: latest?.syncedAt?.toISOString() ?? null,
      openFailureCount: openFailures,
      provisionedProjectCount,
      openProvisionFailureCount: openProvisionFailures,
      recentProvisionErrors: recentProvisionErrors.map((row) => ({
        entityId: row.entityId ?? '',
        errorMsg: row.errorMsg,
        lastAttempted: row.lastAttempted.toISOString(),
        retryCount: row.retryCount,
      })),
    };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Zoho CRM is not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN.',
      );
    }

    await this.zohoHttp.getAccessToken();
    // Lightweight call — list 1 deal (or empty) proves CRM scope works.
    await this.zohoHttp.crmGet('/crm/v2/Deals', {
      per_page: 1,
      fields: 'id,Deal_Name',
    });

    return {
      ok: true,
      message: 'Zoho CRM connection OK',
    };
  }

  syncOpportunities() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Zoho CRM is not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN.',
      );
    }
    return this.opportunitySync.syncOpportunities();
  }

  async listOpportunities(limit = 50) {
    const take = Math.min(Math.max(limit, 1), 200);
    const rows = await this.prisma.crmOpportunity.findMany({
      orderBy: { syncedAt: 'desc' },
      take,
    });
    return rows.map((row) => ({
      id: row.id,
      zohoOpportunityId: row.zohoOpportunityId,
      name: row.name,
      accountName: row.accountName,
      expectedRevenue: row.expectedRevenue?.toString() ?? null,
      stage: row.stage,
      syncedAt: row.syncedAt.toISOString(),
    }));
  }

  isBooksConfigured(): boolean {
    return this.zohoHttp.isBooksConfigured();
  }

  async getBooksStatus() {
    const cfg = this.configService.get('zoho', { infer: true });
    const invoiceCount = await this.prisma.invoice.count();
    const latest = await this.prisma.invoice.findFirst({
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true },
    });
    const openFailures = await this.prisma.failedSyncRecord.count({
      where: {
        integration: ZOHO_BOOKS_INTEGRATION,
        isResolved: false,
      },
    });
    const unmatchedOpenCount = await this.prisma.invoice.count({
      where: { projectId: null },
    });
    const recentErrors = await this.prisma.failedSyncRecord.findMany({
      where: {
        integration: ZOHO_BOOKS_INTEGRATION,
        isResolved: false,
      },
      orderBy: { lastAttempted: 'desc' },
      take: 5,
      select: {
        entityId: true,
        errorMsg: true,
        lastAttempted: true,
        retryCount: true,
      },
    });

    return {
      configured: this.isConfigured(),
      booksConfigured: this.isBooksConfigured(),
      organizationId: cfg?.booksOrganizationId || null,
      invoiceCount,
      lastSyncedAt: latest?.syncedAt?.toISOString() ?? null,
      openFailureCount: openFailures,
      unmatchedOpenCount,
      recentErrors: recentErrors.map((row) => ({
        entityId: row.entityId ?? '',
        errorMsg: row.errorMsg,
        lastAttempted: row.lastAttempted.toISOString(),
        retryCount: row.retryCount,
      })),
    };
  }

  async testBooksConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.isBooksConfigured()) {
      throw new ServiceUnavailableException(
        'Zoho Books is not configured. Set ZOHO_* OAuth with Books scopes and ZOHO_BOOKS_ORGANIZATION_ID.',
      );
    }

    await this.zohoHttp.getAccessToken();
    await this.zohoHttp.booksGet('/books/v3/invoices', {
      page: 1,
      per_page: 1,
    });

    return {
      ok: true,
      message: 'Zoho Books connection OK',
    };
  }

  syncInvoices() {
    if (!this.isBooksConfigured()) {
      throw new ServiceUnavailableException(
        'Zoho Books is not configured. Set ZOHO_* OAuth with Books scopes and ZOHO_BOOKS_ORGANIZATION_ID.',
      );
    }
    return this.invoiceSync.syncInvoices();
  }

  async listInvoices(limit = 50) {
    const take = Math.min(Math.max(limit, 1), 200);
    const rows = await this.prisma.invoice.findMany({
      orderBy: { syncedAt: 'desc' },
      take,
      include: {
        project: { select: { id: true, name: true } },
        milestone: { select: { id: true, title: true } },
      },
    });
    return rows.map((row) => this.toInvoiceDto(row));
  }

  async linkInvoice(invoiceId: string, projectId: string | null) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true },
    });
    if (!invoice) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { invoice: 'invoiceNotFound' },
      });
    }

    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!project) {
        throw new NotFoundException({
          status: HttpStatus.NOT_FOUND,
          errors: { project: 'projectNotFound' },
        });
      }
    }

    const row = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        projectId,
        ...(projectId ? {} : { matchedMilestoneId: null }),
      },
      include: {
        project: { select: { id: true, name: true } },
        milestone: { select: { id: true, title: true } },
      },
    });

    return this.toInvoiceDto(row);
  }

  async linkInvoiceMilestone(
    invoiceId: string,
    milestoneId: string | null,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, projectId: true },
    });
    if (!invoice) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        errors: { invoice: 'invoiceNotFound' },
      });
    }
    if (!invoice.projectId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { project: 'invoiceMustBeLinkedToProject' },
      });
    }

    if (milestoneId) {
      const milestone = await this.prisma.projectMilestone.findUnique({
        where: { id: milestoneId },
        select: { id: true, projectId: true },
      });
      if (!milestone) {
        throw new NotFoundException({
          status: HttpStatus.NOT_FOUND,
          errors: { milestone: 'milestoneNotFound' },
        });
      }
      if (milestone.projectId !== invoice.projectId) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { milestone: 'milestoneNotOnInvoiceProject' },
        });
      }
    }

    const row = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { matchedMilestoneId: milestoneId },
      include: {
        project: { select: { id: true, name: true } },
        milestone: { select: { id: true, title: true } },
      },
    });

    return this.toInvoiceDto(row);
  }

  private toInvoiceDto(row: {
    id: string;
    zohoInvoiceId: string;
    invoiceNumber: string;
    customerName: string | null;
    referenceNumber: string | null;
    projectId: string | null;
    matchedMilestoneId?: string | null;
    amount: { toString(): string };
    balance: { toString(): string } | null;
    paymentMade: { toString(): string } | null;
    currency: string;
    invoiceDate: Date | null;
    dueDate: Date;
    collectionDate: Date | null;
    status: string;
    syncedAt: Date;
    project: { id: string; name: string } | null;
    milestone?: { id: string; title: string } | null;
  }) {
    return {
      id: row.id,
      zohoInvoiceId: row.zohoInvoiceId,
      invoiceNumber: row.invoiceNumber,
      customerName: row.customerName,
      referenceNumber: row.referenceNumber,
      projectId: row.projectId,
      projectName: row.project?.name ?? null,
      matchedMilestoneId:
        row.matchedMilestoneId ?? row.milestone?.id ?? null,
      milestoneTitle: row.milestone?.title ?? null,
      amount: row.amount.toString(),
      balance: row.balance?.toString() ?? null,
      paymentMade: row.paymentMade?.toString() ?? null,
      currency: row.currency,
      invoiceDate: row.invoiceDate
        ? row.invoiceDate.toISOString().slice(0, 10)
        : null,
      dueDate: row.dueDate.toISOString().slice(0, 10),
      collectionDate: row.collectionDate
        ? row.collectionDate.toISOString().slice(0, 10)
        : null,
      status: row.status,
      syncedAt: row.syncedAt.toISOString(),
    };
  }
}
