import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AlertEngineService } from './alert-engine.service';

@Injectable()
export class AlertScheduler {
  private readonly logger = new Logger(AlertScheduler.name);

  constructor(private readonly alertEngine: AlertEngineService) {}

  /** Reminder cadence for unacknowledged alerts — every 15 minutes. */
  @Cron(process.env.ALERT_REMINDER_CRON ?? '*/15 * * * *')
  async handleReminders(): Promise<void> {
    try {
      const n = await this.alertEngine.processReminders();
      if (n > 0) {
        this.logger.log(`Sent ${n} alert reminder(s)`);
      }
    } catch (error) {
      this.logger.error(
        'Alert reminder job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** Failed-delivery retry with backoff — every 10 minutes. */
  @Cron(process.env.ALERT_RETRY_CRON ?? '*/10 * * * *')
  async handleRetries(): Promise<void> {
    try {
      await this.alertEngine.processRetries();
    } catch (error) {
      this.logger.error(
        'Alert retry job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
