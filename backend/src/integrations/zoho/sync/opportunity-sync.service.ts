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
import { ClosedWonProvisioningService } from './closed-won-provisioning.service';

export type ZohoOpportunitySyncResult = {
  fetched: number;
  upserted: number;
  failed: number;
  provisioned: number;
  provisionSkipped: number;
  provisionFailed: number;
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
    const now = new Date();

    for (const deal of deals) {
      const mapped = mapZohoDealToOpportunity(deal);
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
        upserted += 1;
        await this.resolveFailedSync(mapped.zohoOpportunityId);

        const provision = await this.closedWonProvisioning.provisionIfNeeded(
          row.id,
          mapped,
        );
        if (provision.status === 'created') {
          provisioned += 1;
        } else if (provision.status === 'failed') {
          provisionFailed += 1;
        } else {
          provisionSkipped += 1;
        }
      } catch (err) {
        failed += 1;
        const message =
          err instanceof Error ? err.message : 'Unknown opportunity upsert error';
        this.logger.warn(
          `Failed to upsert Zoho deal ${mapped.zohoOpportunityId}: ${message}`,
        );
        await this.recordFailedSync(mapped.zohoOpportunityId, message, deal);
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

  private async recordFailedSync(
    entityId: string,
    errorMsg: string,
    payload: unknown,
  ): Promise<void> {
    const now = new Date();
    const existing = await this.prisma.failedSyncRecord.findFirst({
      where: {
        integration: ZOHO_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.OPPORTUNITY,
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
        integration: ZOHO_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.OPPORTUNITY,
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
        integration: ZOHO_INTEGRATION,
        entityType: ZOHO_ENTITY_TYPE.OPPORTUNITY,
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
