import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DiscrepancyAlertService } from './discrepancy-alert.service';

@Injectable()
export class DiscrepancyAlertScheduler {
  private readonly logger = new Logger(DiscrepancyAlertScheduler.name);

  constructor(
    private readonly discrepancyAlerts: DiscrepancyAlertService,
  ) {}

  @Cron(process.env.INVOICE_DISCREPANCY_CRON ?? '15 9 * * *')
  async handleDiscrepancyAlerts(): Promise<void> {
    try {
      const result =
        await this.discrepancyAlerts.processDiscrepancyAlerts();
      if (result.notified > 0 || result.mismatched > 0 || result.cleared > 0) {
        this.logger.log(
          `Discrepancy alerts: mismatched ${result.mismatched}, notified ${result.notified}, cleared ${result.cleared} (${result.scanned} scanned, ${result.skipped} skipped)`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Invoice discrepancy alert job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
