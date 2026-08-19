import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TaskDeadlineReminderService } from './task-deadline-reminder.service';

@Injectable()
export class TaskDeadlineReminderScheduler {
  private readonly logger = new Logger(TaskDeadlineReminderScheduler.name);

  constructor(private readonly reminderService: TaskDeadlineReminderService) {}

  /** Every 5 hours: tasks due today or tomorrow (not instant on save). */
  @Cron(process.env.TASK_DEADLINE_REMINDER_CRON ?? '0 */5 * * *')
  async handleReminders(): Promise<void> {
    try {
      await this.reminderService.sendDueSoonReminders();
    } catch (error) {
      this.logger.error(
        'Task deadline reminder job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
