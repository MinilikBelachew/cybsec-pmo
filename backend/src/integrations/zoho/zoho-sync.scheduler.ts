import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { AllConfigType } from '../../config/config.type';
import { ZohoHttpClient } from './client/zoho-http.client';
import { OpportunitySyncService } from './sync/opportunity-sync.service';
import { InvoiceSyncService } from './sync/invoice-sync.service';

@Injectable()
export class ZohoSyncScheduler {
  private readonly logger = new Logger(ZohoSyncScheduler.name);

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly zohoHttp: ZohoHttpClient,
    private readonly opportunitySync: OpportunitySyncService,
    private readonly invoiceSync: InvoiceSyncService,
  ) {}

  @Cron(process.env.ZOHO_CRM_SYNC_CRON ?? '0 3 * * *')
  async handleCrmSync(): Promise<void> {
    const cfg = this.configService.get('zoho', { infer: true });
    if (!cfg?.crmSyncEnabled) {
      return;
    }
    if (!this.zohoHttp.isConfigured()) {
      this.logger.debug('Scheduled Zoho CRM sync skipped: not configured');
      return;
    }

    try {
      this.logger.debug('Starting scheduled Zoho CRM opportunity sync');
      const result = await this.opportunitySync.syncOpportunities();
      this.logger.log(
        `Zoho CRM sync: upserted ${result.upserted}/${result.fetched} (failed ${result.failed})`,
      );
    } catch (error) {
      this.logger.error(
        'Scheduled Zoho CRM sync failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @Cron(process.env.ZOHO_BOOKS_SYNC_CRON ?? '30 3 * * *')
  async handleBooksSync(): Promise<void> {
    const cfg = this.configService.get('zoho', { infer: true });
    if (!cfg?.booksSyncEnabled) {
      return;
    }
    if (!this.zohoHttp.isBooksConfigured()) {
      this.logger.debug('Scheduled Zoho Books sync skipped: not configured');
      return;
    }

    try {
      this.logger.debug('Starting scheduled Zoho Books invoice sync');
      const result = await this.invoiceSync.syncInvoices();
      this.logger.log(
        `Zoho Books sync: upserted ${result.upserted}/${result.fetched} (failed ${result.failed}, unmatched ${result.unmatched})`,
      );
    } catch (error) {
      this.logger.error(
        'Scheduled Zoho Books sync failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
