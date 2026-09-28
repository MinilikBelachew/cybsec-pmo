import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LargeUnpaidBalanceAlertService } from './large-unpaid-balance-alert.service';

@Injectable()
export class LargeUnpaidBalanceAlertScheduler {
  private readonly logger = new Logger(LargeUnpaidBalanceAlertScheduler.name);

  constructor(
    private readonly largeUnpaidAlerts: LargeUnpaidBalanceAlertService,
  ) {}

  @Cron(process.env.INVOICE_LARGE_UNPAID_CRON ?? '30 9 * * *')
  async handleLargeUnpaidBalanceAlerts(): Promise<void> {
    try {
      const result =
        await this.largeUnpaidAlerts.processLargeUnpaidBalanceAlerts();
      if (result.disabled) {
        return;
      }
      if (result.notified > 0) {
        this.logger.log(
          `Large unpaid balance alerts: notified ${result.notified} invoice(s) (threshold ${result.threshold}, scanned ${result.scanned}, skipped ${result.skipped})`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Invoice large unpaid balance alert job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
