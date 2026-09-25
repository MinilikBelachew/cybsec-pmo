import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import {
  ZOHO_BOOKS_INTEGRATION,
  ZOHO_ENTITY_TYPE,
  ZOHO_FAILED_SYNC_MAX_RETRIES,
  ZOHO_INTEGRATION,
} from './zoho.constants';
import {
  prepareZohoFailedSyncForceRetry,
  zohoAutoRetryEligibleWhere,
} from './utils/failed-sync-record.util';
import { OpportunitySyncService } from './sync/opportunity-sync.service';
import { InvoiceSyncService } from './sync/invoice-sync.service';

export type ZohoRetrySummary = {
  attempted: number;
  succeeded: number;
};

export type ZohoRetryResult = {
  success: boolean;
  message: string;
};

@Injectable()
export class ZohoFailedSyncRetryService {
  private readonly logger = new Logger(ZohoFailedSyncRetryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opportunitySync: OpportunitySyncService,
    private readonly invoiceSync: InvoiceSyncService,
  ) {}

  async retryPendingFailures(): Promise<ZohoRetrySummary> {
    const records = await this.prisma.failedSyncRecord.findMany({
      where: {
        OR: [
          zohoAutoRetryEligibleWhere(ZOHO_INTEGRATION, {
            retryCount: { lt: ZOHO_FAILED_SYNC_MAX_RETRIES },
          }),
          zohoAutoRetryEligibleWhere(ZOHO_BOOKS_INTEGRATION, {
            retryCount: { lt: ZOHO_FAILED_SYNC_MAX_RETRIES },
          }),
        ],
      },
      orderBy: { lastAttempted: 'asc' },
      take: 50,
    });

    let attempted = 0;
    let succeeded = 0;

    for (const record of records) {
      if (!record.entityId) continue;
      attempted += 1;
      const result = await this.retryEntity(
        record.integration,
        record.entityType,
        record.entityId,
      );
      if (result.success) succeeded += 1;
    }

    return { attempted, succeeded };
  }

  async retryFailedSync(
    options: {
      failedSyncRecordId?: string;
      entityType?: string;
      entityId?: string;
      integration?: string;
    },
    actorId?: string,
  ): Promise<ZohoRetryResult> {
    let entityType = options.entityType;
    let entityId = options.entityId;
    let integration = options.integration;

    if (options.failedSyncRecordId) {
      const record = await this.prisma.failedSyncRecord.findUnique({
        where: { id: options.failedSyncRecordId },
      });

      if (!record) {
        throw new NotFoundException({
          status: HttpStatus.NOT_FOUND,
          errors: { failedSyncRecord: 'notFound' },
        });
      }

      if (
        record.integration !== ZOHO_INTEGRATION &&
        record.integration !== ZOHO_BOOKS_INTEGRATION
      ) {
        throw new BadRequestException({
          status: HttpStatus.BAD_REQUEST,
          errors: { integration: 'notZoho' },
        });
      }

      if (record.isResolved) {
        return { success: true, message: 'Already resolved.' };
      }

      await prepareZohoFailedSyncForceRetry(this.prisma, record.id);

      entityType = record.entityType;
      entityId = record.entityId ?? undefined;
      integration = record.integration;
    }

    if (!entityType || !entityId || !integration) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { retry: 'entityTypeEntityIdAndIntegrationRequired' },
      });
    }

    return this.retryEntity(integration, entityType, entityId, actorId);
  }

  private async retryEntity(
    integration: string,
    entityType: string,
    entityId: string,
    actorId?: string,
  ): Promise<ZohoRetryResult> {
    if (
      integration === ZOHO_INTEGRATION &&
      entityType === ZOHO_ENTITY_TYPE.OPPORTUNITY
    ) {
      return this.opportunitySync.syncOpportunityByZohoId(entityId, actorId);
    }

    if (
      integration === ZOHO_BOOKS_INTEGRATION &&
      entityType === ZOHO_ENTITY_TYPE.INVOICE
    ) {
      return this.invoiceSync.syncInvoiceByZohoId(entityId, actorId);
    }

    // Charter provision failures: re-sync the related opportunity if entityId is a deal id
    if (
      integration === ZOHO_INTEGRATION &&
      entityType === ZOHO_ENTITY_TYPE.CHARTER_PROVISION
    ) {
      return this.opportunitySync.syncOpportunityByZohoId(entityId, actorId);
    }

    this.logger.warn(
      `Zoho auto-retry skipped for unsupported ${integration}/${entityType}`,
    );
    return {
      success: false,
      message: `Retry not supported for ${integration}/${entityType}`,
    };
  }
}

@Injectable()
export class ZohoFailedSyncRetryScheduler {
  private readonly logger = new Logger(ZohoFailedSyncRetryScheduler.name);

  constructor(
    private readonly failedSyncRetry: ZohoFailedSyncRetryService,
  ) {}

  @Cron(process.env.ZOHO_FAILED_SYNC_RETRY_CRON ?? '20 * * * *')
  async handleFailedSyncRetry(): Promise<void> {
    try {
      const result = await this.failedSyncRetry.retryPendingFailures();
      if (result.attempted > 0) {
        this.logger.log(
          `Zoho failed-sync auto-retry: ${result.succeeded}/${result.attempted} progressed`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Zoho failed-sync auto-retry job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
