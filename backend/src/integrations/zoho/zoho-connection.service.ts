import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../../config/config.type';
import { PrismaService } from '../../database/prisma.service';
import { ZohoHttpClient } from './client/zoho-http.client';
import { OpportunitySyncService } from './sync/opportunity-sync.service';

@Injectable()
export class ZohoConnectionService {
  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly zohoHttp: ZohoHttpClient,
    private readonly opportunitySync: OpportunitySyncService,
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

    return {
      configured: this.isConfigured(),
      dc: cfg?.dc ?? 'com',
      accountsBaseUrl: cfg?.accountsBaseUrl ?? null,
      apiBaseUrl: cfg?.apiBaseUrl ?? null,
      opportunityCount,
      lastSyncedAt: latest?.syncedAt?.toISOString() ?? null,
      openFailureCount: openFailures,
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
}
