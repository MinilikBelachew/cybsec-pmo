import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  LEAVE_BACKUP_QUEUE,
  LEAVE_CONFLICT_CHECK_JOB,
  LeaveConflictCheckJobPayload,
} from './leave-backup.constants';
import { LeaveBackupService } from './leave-backup.service';

@Processor(LEAVE_BACKUP_QUEUE)
export class LeaveBackupProcessor {
  private readonly logger = new Logger(LeaveBackupProcessor.name);

  constructor(private readonly leaveBackupService: LeaveBackupService) {}

  @Process(LEAVE_CONFLICT_CHECK_JOB)
  async handleConflictCheck(job: Job<LeaveConflictCheckJobPayload>): Promise<void> {
    const employeeIds = job.data.employeeIds?.filter(Boolean);
    const notified = await this.leaveBackupService.evaluateConflictsAndNotify(
      job.data.actorId,
      employeeIds?.length ? employeeIds : undefined,
    );
    this.logger.log(
      `Leave conflict check job ${job.id} finished: ${notified} notification(s)`,
    );
  }
}
