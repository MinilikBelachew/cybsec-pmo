import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ActionPointsService } from './action-points.service';

@Injectable()
export class ActionPointsScheduler {
  private readonly logger = new Logger(ActionPointsScheduler.name);

  constructor(private readonly actionPointsService: ActionPointsService) {}

  @Cron(process.env.ACTION_POINT_REMINDER_CRON ?? '0 8 * * *')
  async handleReminders(): Promise<void> {
    try {
      const result = await this.actionPointsService.processScheduledReminders();
      if (result.sent > 0) {
        this.logger.log(`Sent ${result.sent} action point reminder(s)`);
      }
    } catch (error) {
      this.logger.error(
        'Action point reminder job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @Cron(process.env.ACTION_POINT_OVERDUE_CRON ?? '0 9 * * *')
  async handleOverdue(): Promise<void> {
    try {
      const result = await this.actionPointsService.processOverdueNotifications();
      if (result.sent > 0) {
        this.logger.log(`Sent ${result.sent} action point overdue notice(s)`);
      }
    } catch (error) {
      this.logger.error(
        'Action point overdue job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
