import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { ZohoHttpClient } from '../client/zoho-http.client';
import {
  ZOHO_ENTITY_TYPE,
  ZOHO_INTEGRATION,
  ZOHO_SYNC_DIRECTION,
} from '../zoho.constants';
import {
  mapZohoDealToOpportunity,
  ZohoDealRecord,
} from '../zoho.mapper';
import {
  resolveZohoFailedSyncRecord,
  upsertZohoFailedSyncRecord,
} from '../utils/failed-sync-record.util';
import { ClosedWonProvisioningService } from './closed-won-provisioning.service';

export type ZohoOpportunitySyncResult = {
  fetched: number;
  upserted: number;
  failed: number;
  provisioned: number;
  provisionSkipped: number;
  provisionFailed: number;
};

export type ZohoOpportunityByIdResult = {
  success: boolean;
  message: string;
};

const DEAL_FIELDS =
  'id,Deal_Name,Stage,Amount,Account_Name,Description,Closing_Date';

@Injectable()
export class OpportunitySyncService {
  private readonly logger = new Logger(OpportunitySyncService.name);

  constructor(
    private readonly zohoHttp: ZohoHttpClient,
    private readonly prisma: PrismaService,
    private readonly closedWonProvisioning: ClosedWonProvisioningService,
  ) {}

  async syncOpportunities(): Promise<ZohoOpportunitySyncResult> {
    const deals = await this.zohoHttp.crmGetAllPages<ZohoDealRecord>(
      '/crm/v2/Deals',
      DEAL_FIELDS,
    );

    let upserted = 0;
    let failed = 0;
    let provisioned = 0;
    let provisionSkipped = 0;
    let provisionFailed = 0;

    for (const deal of deals) {
      const result = await this.upsertDeal(deal);
      if (result.ok) {
        upserted += 1;
        if (result.provisionStatus === 'created') provisioned += 1;
        else if (result.provisionStatus === 'failed') provisionFailed += 1;
        else provisionSkipped += 1;
      } else {
        failed += 1;
      }
    }

    return {
      fetched: deals.length,
      upserted,
      failed,
      provisioned,
      provisionSkipped,
      provisionFailed,
    };
  }

  async syncOpportunityByZohoId(
    zohoOpportunityId: string,
    resolvedBy?: string | null,
  ): Promise<ZohoOpportunityByIdResult> {
    const id = zohoOpportunityId.trim();
    if (!id) {
      return { success: false, message: 'Missing Zoho opportunity id' };
    }

    try {
      const deal = await this.zohoHttp.crmGetDealById<ZohoDealRecord>(
        id,
        DEAL_FIELDS,
      );
      if (!deal) {
        await this.recordFailedSync(id, 'Deal not found in Zoho CRM', {
          zohoOpportunityId: id,
        });
        return { success: false, message: 'Deal not found in Zoho CRM' };
      }

      const result = await this.upsertDeal(deal, resolvedBy);
      if (!result.ok) {
        return {
          success: false,
          message: result.errorMsg ?? 'Opportunity sync failed',
        };
      }
      return { success: true, message: 'Opportunity synced from Zoho CRM' };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown opportunity sync error';
      this.logger.warn(`Failed to sync Zoho deal ${id}: ${message}`);
      await this.recordFailedSync(id, message, { zohoOpportunityId: id });
      return { success: false, message };
    }
  }

  private async upsertDeal(
    deal: ZohoDealRecord,
    resolvedBy?: string | null,
  ): Promise<{
    ok: boolean;
    errorMsg?: string;
    provisionStatus?: 'created' | 'failed' | 'skipped';
  }> {
    const mapped = mapZohoDealToOpportunity(deal);
    const now = new Date();
    try {
      const row = await this.prisma.crmOpportunity.upsert({
        where: { zohoOpportunityId: mapped.zohoOpportunityId },
        create: {
          zohoOpportunityId: mapped.zohoOpportunityId,
          name: mapped.name,
          accountName: mapped.accountName,
          expectedRevenue:
            mapped.expectedRevenue === null
              ? null
              : new Prisma.Decimal(mapped.expectedRevenue),
          stage: mapped.stage,
          syncedAt: now,
        },
        update: {
          name: mapped.name,
          accountName: mapped.accountName,
          expectedRevenue:
            mapped.expectedRevenue === null
              ? null
              : new Prisma.Decimal(mapped.expectedRevenue),
          stage: mapped.stage,
          syncedAt: now,
        },
      });

      await resolveZohoFailedSyncRecord(this.prisma, {
        integration: ZOHO_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.OPPORTUNITY,
        entityId: mapped.zohoOpportunityId,
        resolvedBy,
      });

      const provision = await this.closedWonProvisioning.provisionIfNeeded(
        row.id,
        mapped,
      );
      return {
        ok: true,
        provisionStatus:
          provision.status === 'created'
            ? 'created'
            : provision.status === 'failed'
              ? 'failed'
              : 'skipped',
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown opportunity upsert error';
      this.logger.warn(
        `Failed to upsert Zoho deal ${mapped.zohoOpportunityId}: ${message}`,
      );
      await this.recordFailedSync(mapped.zohoOpportunityId, message, deal);
      return { ok: false, errorMsg: message };
    }
  }

  private async recordFailedSync(
    entityId: string,
    errorMsg: string,
    payload: unknown,
  ): Promise<void> {
    await upsertZohoFailedSyncRecord(this.prisma, {
      integration: ZOHO_INTEGRATION,
      entityType: ZOHO_ENTITY_TYPE.OPPORTUNITY,
      entityId,
      direction: ZOHO_SYNC_DIRECTION.INBOUND,
      errorMsg,
      payload: payload as Prisma.InputJsonValue,
    });
  }
}
