import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { JobOptions, Queue } from 'bull';
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
import { KekaSyncJobStatusDto } from '../dto/keka-sync.dto';
import { KekaSyncRunResult } from '../keka.types';
import { AttendanceSyncService } from './attendance-sync.service';
import { DepartmentSyncService } from './department-sync.service';
import { EmployeeSyncService } from './employee-sync.service';
import { HolidaySyncService } from './holiday-sync.service';
import { LeaveSyncService } from './leave-sync.service';
import { ProjectLinkService } from './project-link.service';
import { ClientSyncService } from './client-sync.service';
import { SalarySyncService } from './salary-sync.service';

/** Keep finished jobs briefly so the UI can poll status after completion. */
const KEKA_SYNC_JOB_OPTIONS: JobOptions = {
  removeOnComplete: 100,
  removeOnFail: 100,
};

const FULL_SYNC_STEPS = [
  'department',
  'employee',
  'leave',
  'attendance',
  'holiday',
  'pay_cycle',
  'salary',
  'client',
  'project',
] as const;

type SyncProgressCallback = (
  percent: number,
  step: string,
) => void | Promise<void>;

@Injectable()
export class KekaSyncService {
  private readonly logger = new Logger(KekaSyncService.name);

  constructor(
    private readonly departmentSyncService: DepartmentSyncService,
    private readonly employeeSyncService: EmployeeSyncService,
    private readonly leaveSyncService: LeaveSyncService,
    private readonly attendanceSyncService: AttendanceSyncService,
    private readonly holidaySyncService: HolidaySyncService,
    private readonly salarySyncService: SalarySyncService,
    private readonly clientSyncService: ClientSyncService,
    private readonly projectLinkService: ProjectLinkService,
    @InjectQueue(KEKA_SYNC_QUEUE) private readonly syncQueue: Queue,
  ) {}

  async syncDepartmentsNow() {
    return this.departmentSyncService.syncDepartments();
  }

  async syncEmployeesNow() {
    await this.syncDepartmentsNow();
    return this.employeeSyncService.syncEmployees();
  }

  async syncLeaveNow() {
    return this.leaveSyncService.syncLeaveRequests();
  }

  async syncAttendanceNow() {
    return this.attendanceSyncService.syncAttendance();
  }

  async syncHolidaysNow() {
    return this.holidaySyncService.syncHolidays();
  }

  async syncSalaryNow() {
    return this.salarySyncService.syncSalariesAndPayCycles();
  }

  async syncClientsNow() {
    return this.clientSyncService.syncClients();
  }

  async syncProjectsNow() {
    return this.projectLinkService.linkProjectsAndTasks();
  }

  async syncAllNow(onProgress?: SyncProgressCallback): Promise<KekaSyncRunResult> {
    const startedAt = new Date().toISOString();
    const totalSteps = FULL_SYNC_STEPS.length;
    let stepIndex = 0;

    const report = async (step: string) => {
      if (!onProgress) return;
      const percent = Math.round((stepIndex / totalSteps) * 100);
      await onProgress(percent, step);
    };

    await report('department');
    const departmentResult = await this.runStep('department', () =>
      this.syncDepartmentsNow(),
    );
    stepIndex += 1;

    await report('employee');
    const employeeResult = await this.runStep('employee', () =>
      this.employeeSyncService.syncEmployees(),
    );
    stepIndex += 1;

    await report('leave');
    const leaveResult = await this.runStep('leave', () => this.syncLeaveNow());
    stepIndex += 1;

    await report('attendance');
    const attendanceResult = await this.runStep('attendance', () =>
      this.syncAttendanceNow(),
    );
    stepIndex += 1;

    await report('holiday');
    const holidayResult = await this.runStep('holiday', () =>
      this.syncHolidaysNow(),
    );
    stepIndex += 1;

    await report('pay_cycle');
    const payCycleResult = await this.runStep('pay_cycle', () =>
      this.salarySyncService.syncPayCycles(),
    );
    stepIndex += 1;

    await report('salary');
    const salaryResult = await this.runStep('salary', () =>
      this.salarySyncService.syncSalaries(),
    );
    stepIndex += 1;

    await report('client');
    const clientResult = await this.runStep('client', () =>
      this.syncClientsNow(),
    );
    stepIndex += 1;

    await report('project');
    const projectResult = await this.runStep('project', () =>
      this.syncProjectsNow(),
    );
    stepIndex += 1;

    if (onProgress) {
      await onProgress(100, 'done');
    }

    return {
      startedAt,
      completedAt: new Date().toISOString(),
      results: [
        { entityType: 'department', ...departmentResult },
        { entityType: 'employee', ...employeeResult },
        { entityType: 'leave', ...leaveResult },
        { entityType: 'attendance', ...attendanceResult },
        { entityType: 'holiday', ...holidayResult },
        { entityType: 'pay_cycle', ...payCycleResult },
        { entityType: 'salary', ...salaryResult },
        { entityType: 'client', ...clientResult },
        { entityType: 'project', ...projectResult },
      ],
    };
  }

  private async runStep<T extends { synced: number; failed: number }>(
    entityType: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Keka sync step "${entityType}" aborted: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { synced: 0, failed: 1 } as T;
    }
  }

  private async enqueue(
    name: string,
  ): Promise<{ jobId: string | number }> {
    const job = await this.syncQueue.add(name, {}, KEKA_SYNC_JOB_OPTIONS);
    return { jobId: job.id ?? 'unknown' };
  }

  async enqueueEmployeesSync(): Promise<{ jobId: string | number }> {
    return this.enqueue(KEKA_SYNC_EMPLOYEES_JOB);
  }

  async enqueueLeaveSync(): Promise<{ jobId: string | number }> {
    return this.enqueue(KEKA_SYNC_LEAVE_JOB);
  }

  async enqueueAttendanceSync(): Promise<{ jobId: string | number }> {
    return this.enqueue(KEKA_SYNC_ATTENDANCE_JOB);
  }

  async enqueueHolidaysSync(): Promise<{ jobId: string | number }> {
    return this.enqueue(KEKA_SYNC_HOLIDAYS_JOB);
  }

  async enqueueSalarySync(): Promise<{ jobId: string | number }> {
    return this.enqueue(KEKA_SYNC_SALARY_JOB);
  }

  async enqueueClientsSync(): Promise<{ jobId: string | number }> {
    return this.enqueue(KEKA_SYNC_CLIENTS_JOB);
  }

  async enqueueProjectsSync(): Promise<{ jobId: string | number }> {
    return this.enqueue(KEKA_SYNC_PROJECTS_JOB);
  }

  async enqueueFullSync(): Promise<{ jobId: string | number }> {
    return this.enqueue(KEKA_SYNC_ALL_JOB);
  }

  async getSyncJobStatus(jobId: string): Promise<KekaSyncJobStatusDto> {
    const job = await this.syncQueue.getJob(jobId);
    if (!job) {
      return {
        jobId,
        status: 'unknown',
        progress: 0,
        step: null,
        result: null,
        failedReason: null,
      };
    }

    const state = await job.getState();
    const status = this.mapJobState(state);
    const { progress, step } = this.parseJobProgress(job.progress());

    let result: KekaSyncJobStatusDto['result'] = null;
    if (status === 'completed' && job.returnvalue) {
      const value = job.returnvalue as {
        synced?: number;
        failed?: number;
        results?: Array<{ synced: number; failed: number }>;
      };
      if (
        typeof value.synced === 'number' &&
        typeof value.failed === 'number'
      ) {
        result = { synced: value.synced, failed: value.failed };
      } else if (Array.isArray(value.results)) {
        result = {
          synced: value.results.reduce((sum, entry) => sum + entry.synced, 0),
          failed: value.results.reduce((sum, entry) => sum + entry.failed, 0),
        };
      }
    }

    return {
      jobId: String(job.id),
      status,
      progress: status === 'completed' ? 100 : progress,
      step,
      result,
      failedReason:
        status === 'failed' ? (job.failedReason ?? 'Keka sync failed.') : null,
    };
  }

  private mapJobState(
    state: string,
  ): KekaSyncJobStatusDto['status'] {
    switch (state) {
      case 'waiting':
      case 'active':
      case 'completed':
      case 'failed':
      case 'delayed':
      case 'paused':
        return state;
      default:
        return 'unknown';
    }
  }

  private parseJobProgress(raw: unknown): {
    progress: number;
    step: string | null;
  } {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return { progress: Math.max(0, Math.min(100, Math.round(raw))), step: null };
    }
    if (raw && typeof raw === 'object') {
      const obj = raw as { percent?: unknown; step?: unknown };
      const percent =
        typeof obj.percent === 'number' && Number.isFinite(obj.percent)
          ? Math.max(0, Math.min(100, Math.round(obj.percent)))
          : 0;
      const step = typeof obj.step === 'string' ? obj.step : null;
      return { progress: percent, step };
    }
    return { progress: 0, step: null };
  }

  async runScheduledSync(): Promise<void> {
    try {
      const result = await this.syncAllNow();
      const summary = result.results
        .map(
          (entry) =>
            `${entry.entityType}=${entry.synced}/${entry.failed} failed`,
        )
        .join(', ');
      this.logger.log(`Scheduled Keka sync completed: ${summary}`);
    } catch (error) {
      this.logger.error('Scheduled Keka sync failed', error);
    }
  }
}
