import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LeaveBackupService } from './leave-backup.service';

@Injectable()
export class LeaveBackupScheduler {
  private readonly logger = new Logger(LeaveBackupScheduler.name);

  constructor(private readonly leaveBackupService: LeaveBackupService) {}

  @Cron(process.env.LEAVE_BACKUP_ALERT_CRON ?? '0 8 * * *')
  async handleDailyConflictScan(): Promise<void> {
    try {
      await this.leaveBackupService.evaluateConflictsAndNotify();
    } catch (error) {
      this.logger.error(
        'Leave backup conflict scan failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
