import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import {
  KEKA_SYNC_ALL_JOB,
  KEKA_SYNC_ATTENDANCE_JOB,
  KEKA_SYNC_EMPLOYEES_JOB,
  KEKA_SYNC_HOLIDAYS_JOB,
  KEKA_SYNC_LEAVE_JOB,
  KEKA_SYNC_CLIENTS_JOB,
  KEKA_SYNC_PROJECTS_JOB,
  KEKA_SYNC_QUEUE,
  KEKA_SYNC_SALARY_JOB,
} from '../keka.constants';
import { KekaSyncJobResult, KekaSyncRunResult } from '../keka.types';
import { KekaSyncService } from './keka-sync.service';
import {
  LEAVE_BACKUP_QUEUE,
  LEAVE_CONFLICT_CHECK_JOB,
} from '../../../resources/leave-backup.constants';

type SyncJobReturn = {
  synced: number;
  failed: number;
  entityType?: string;
  startedAt?: string;
  completedAt?: string;
  results?: KekaSyncJobResult[];
};

async function reportProgress(
  job: Job,
  percent: number,
  step?: string,
): Promise<void> {
  await job.progress({
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    step: step ?? null,
  });
}

@Processor(KEKA_SYNC_QUEUE)
export class KekaSyncProcessor {
  private readonly logger = new Logger(KekaSyncProcessor.name);

  constructor(
    private readonly kekaSyncService: KekaSyncService,
    @InjectQueue(LEAVE_BACKUP_QUEUE)
    private readonly leaveBackupQueue: Queue,
  ) {}

  @Process(KEKA_SYNC_EMPLOYEES_JOB)
  async handleEmployeeSync(job: Job): Promise<SyncJobReturn> {
    await reportProgress(job, 10, 'employees');
    const result = await this.kekaSyncService.syncEmployeesNow();
    await reportProgress(job, 100, 'employees');
    this.logger.log(
      `Employee sync job ${job.id} finished: synced=${result.synced}, failed=${result.failed}`,
    );
    return {
      entityType: 'employee',
      synced: result.synced,
      failed: result.failed,
    };
  }

  @Process(KEKA_SYNC_LEAVE_JOB)
  async handleLeaveSync(job: Job): Promise<SyncJobReturn> {
    await reportProgress(job, 10, 'leave');
    const result = await this.kekaSyncService.syncLeaveNow();
    await reportProgress(job, 90, 'leave');
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
    await reportProgress(job, 100, 'leave');
    return {
      entityType: 'leave',
      synced: result.synced,
      failed: result.failed,
    };
  }

  @Process(KEKA_SYNC_ATTENDANCE_JOB)
  async handleAttendanceSync(job: Job): Promise<SyncJobReturn> {
    await reportProgress(job, 10, 'attendance');
    const result = await this.kekaSyncService.syncAttendanceNow();
    await reportProgress(job, 100, 'attendance');
    this.logger.log(
      `Attendance sync job ${job.id} finished: synced=${result.synced}, failed=${result.failed}`,
    );
    return {
      entityType: 'attendance',
      synced: result.synced,
      failed: result.failed,
    };
  }

  @Process(KEKA_SYNC_HOLIDAYS_JOB)
  async handleHolidaysSync(job: Job): Promise<SyncJobReturn> {
    await reportProgress(job, 10, 'holidays');
    const result = await this.kekaSyncService.syncHolidaysNow();
    await reportProgress(job, 100, 'holidays');
    this.logger.log(
      `Holiday sync job ${job.id} finished: synced=${result.synced}, failed=${result.failed}`,
    );
    return {
      entityType: 'holiday',
      synced: result.synced,
      failed: result.failed,
    };
  }

  @Process(KEKA_SYNC_SALARY_JOB)
  async handleSalarySync(job: Job): Promise<SyncJobReturn> {
    await reportProgress(job, 10, 'salary');
    const result = await this.kekaSyncService.syncSalaryNow();
    await reportProgress(job, 100, 'salary');
    this.logger.log(
      `Salary sync job ${job.id} finished: synced=${result.synced}, failed=${result.failed}`,
    );
    return {
      entityType: 'salary',
      synced: result.synced,
      failed: result.failed,
    };
  }

  @Process(KEKA_SYNC_CLIENTS_JOB)
  async handleClientsSync(job: Job): Promise<SyncJobReturn> {
    await reportProgress(job, 10, 'clients');
    const result = await this.kekaSyncService.syncClientsNow();
    await reportProgress(job, 100, 'clients');
    this.logger.log(
      `Client sync job ${job.id} finished: synced=${result.synced}, failed=${result.failed}`,
    );
    return {
      entityType: 'client',
      synced: result.synced,
      failed: result.failed,
    };
  }

  @Process(KEKA_SYNC_PROJECTS_JOB)
  async handleProjectsSync(job: Job): Promise<SyncJobReturn> {
    await reportProgress(job, 10, 'projects');
    const result = await this.kekaSyncService.syncProjectsNow();
    await reportProgress(job, 100, 'projects');
    this.logger.log(
      `Project link job ${job.id} finished: synced=${result.synced}, failed=${result.failed}`,
    );
    return {
      entityType: 'project',
      synced: result.synced,
      failed: result.failed,
    };
  }

  @Process(KEKA_SYNC_ALL_JOB)
  async handleFullSync(job: Job): Promise<SyncJobReturn> {
    try {
      await reportProgress(job, 0, 'starting');
      const result: KekaSyncRunResult = await this.kekaSyncService.syncAllNow(
        async (percent, step) => {
          await reportProgress(job, percent, step);
        },
      );
      const summary = result.results
        .map((entry) => `${entry.entityType}=${entry.synced}/${entry.failed}`)
        .join(', ');
      this.logger.log(
        `Full Keka sync job ${job.id} finished at ${result.completedAt}: ${summary}`,
      );
      const leaveResult = result.results.find(
        (entry) => entry.entityType === 'leave',
      );
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
      await reportProgress(job, 100, 'done');
      const synced = result.results.reduce((sum, entry) => sum + entry.synced, 0);
      const failed = result.results.reduce((sum, entry) => sum + entry.failed, 0);
      return {
        synced,
        failed,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        results: result.results,
      };
    } catch (error) {
      this.logger.error(
        `Full Keka sync job ${job.id} failed`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
