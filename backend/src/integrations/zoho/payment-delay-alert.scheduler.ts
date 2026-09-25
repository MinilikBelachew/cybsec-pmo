import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PaymentDelayAlertService } from './payment-delay-alert.service';

@Injectable()
export class PaymentDelayAlertScheduler {
  private readonly logger = new Logger(PaymentDelayAlertScheduler.name);

  constructor(
    private readonly paymentDelayAlerts: PaymentDelayAlertService,
  ) {}

  @Cron(process.env.INVOICE_PAYMENT_DELAY_CRON ?? '0 9 * * *')
  async handlePaymentDelayAlerts(): Promise<void> {
    try {
      const result =
        await this.paymentDelayAlerts.processPaymentDelayAlerts();
      if (result.notified > 0) {
        this.logger.log(
          `Payment-delay alerts: notified ${result.notified} invoice(s) (${result.scanned} scanned, ${result.skipped} skipped)`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Invoice payment-delay alert job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
