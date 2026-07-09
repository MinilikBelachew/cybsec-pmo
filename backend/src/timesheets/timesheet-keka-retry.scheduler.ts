import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TimesheetPushService } from '../keka/sync/timesheet-push.service';

@Injectable()
export class TimesheetKekaRetryScheduler {
  private readonly logger = new Logger(TimesheetKekaRetryScheduler.name);

  constructor(private readonly timesheetPushService: TimesheetPushService) {}

  @Cron(process.env.TIMESHEET_KEKA_RETRY_CRON ?? '0 * * * *')
  async handleRetries(): Promise<void> {
    try {
      const result = await this.timesheetPushService.retryPendingFailedSyncs();
      if (result.attempted > 0) {
        this.logger.log(
          `Timesheet Keka retry: ${result.succeeded}/${result.attempted} succeeded`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Timesheet Keka retry job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
