import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import {
  KEKA_SYNC_ALL_JOB,
  KEKA_SYNC_EMPLOYEES_JOB,
  KEKA_SYNC_LEAVE_JOB,
  KEKA_SYNC_QUEUE,
} from '../keka.constants';
import { KekaSyncService } from './keka-sync.service';
import {
  LEAVE_BACKUP_QUEUE,
  LEAVE_CONFLICT_CHECK_JOB,
} from '../../resources/leave-backup.constants';

@Processor(KEKA_SYNC_QUEUE)
export class KekaSyncProcessor {
  private readonly logger = new Logger(KekaSyncProcessor.name);

  constructor(
    private readonly kekaSyncService: KekaSyncService,
    @InjectQueue(LEAVE_BACKUP_QUEUE)
    private readonly leaveBackupQueue: Queue,
  ) {}

  @Process(KEKA_SYNC_EMPLOYEES_JOB)
  async handleEmployeeSync(job: Job): Promise<void> {
    const result = await this.kekaSyncService.syncEmployeesNow();
    this.logger.log(
      `Employee sync job ${job.id} finished: synced=${result.synced}, failed=${result.failed}`,
    );
  }

  @Process(KEKA_SYNC_LEAVE_JOB)
  async handleLeaveSync(job: Job): Promise<void> {
    const result = await this.kekaSyncService.syncLeaveNow();
    this.logger.log(
      `Leave sync job ${job.id} finished: synced=${result.synced}, failed=${result.failed}`,
    );
    await this.leaveBackupQueue.add(
      LEAVE_CONFLICT_CHECK_JOB,
      { employeeIds: result.employeeIds },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      },
    );
  }

  @Process(KEKA_SYNC_ALL_JOB)
  async handleFullSync(job: Job): Promise<void> {
    const result = await this.kekaSyncService.syncAllNow();
    this.logger.log(`Full Keka sync job ${job.id} finished at ${result.completedAt}`);
    const leaveResult = result.results.find((entry) => entry.entityType === 'leave');
    if (leaveResult && 'employeeIds' in leaveResult) {
      await this.leaveBackupQueue.add(
        LEAVE_CONFLICT_CHECK_JOB,
        { employeeIds: leaveResult.employeeIds },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
        },
      );
    }
  }
}
