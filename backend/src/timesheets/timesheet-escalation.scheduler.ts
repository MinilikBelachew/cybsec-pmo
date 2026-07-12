import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TimesheetEscalationService } from './timesheet-escalation.service';

@Injectable()
export class TimesheetEscalationScheduler {
  private readonly logger = new Logger(TimesheetEscalationScheduler.name);

  constructor(
    private readonly escalationService: TimesheetEscalationService,
  ) {}

  @Cron(process.env.TIMESHEET_ESCALATION_CRON ?? '0 9 * * *')
  async handleEscalations(): Promise<void> {
    try {
      await this.escalationService.notifyEscalatedSubmissions();
    } catch (error) {
      this.logger.error(
        'Timesheet escalation job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
