import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
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
import { KekaSyncRunResult } from '../keka.types';
import { AttendanceSyncService } from './attendance-sync.service';
import { DepartmentSyncService } from './department-sync.service';
import { EmployeeSyncService } from './employee-sync.service';
import { HolidaySyncService } from './holiday-sync.service';
import { LeaveSyncService } from './leave-sync.service';
import { ProjectLinkService } from './project-link.service';
import { ClientSyncService } from './client-sync.service';
import { SalarySyncService } from './salary-sync.service';

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

  async syncAllNow(): Promise<KekaSyncRunResult> {
    const startedAt = new Date().toISOString();

    const departmentResult = await this.runStep('department', () =>
      this.syncDepartmentsNow(),
    );
    const employeeResult = await this.runStep('employee', () =>
      this.employeeSyncService.syncEmployees(),
    );
    const leaveResult = await this.runStep('leave', () => this.syncLeaveNow());
    const attendanceResult = await this.runStep('attendance', () =>
      this.syncAttendanceNow(),
    );
    const holidayResult = await this.runStep('holiday', () =>
      this.syncHolidaysNow(),
    );
    const payCycleResult = await this.runStep('pay_cycle', () =>
      this.salarySyncService.syncPayCycles(),
    );
    const salaryResult = await this.runStep('salary', () =>
      this.salarySyncService.syncSalaries(),
    );
    const clientResult = await this.runStep('client', () =>
      this.syncClientsNow(),
    );
    const projectResult = await this.runStep('project', () =>
      this.syncProjectsNow(),
    );

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

  async enqueueEmployeesSync(): Promise<{ jobId: string | number }> {
    const job = await this.syncQueue.add(KEKA_SYNC_EMPLOYEES_JOB, {});
    return { jobId: job.id ?? 'unknown' };
  }

  async enqueueLeaveSync(): Promise<{ jobId: string | number }> {
    const job = await this.syncQueue.add(KEKA_SYNC_LEAVE_JOB, {});
    return { jobId: job.id ?? 'unknown' };
  }

  async enqueueAttendanceSync(): Promise<{ jobId: string | number }> {
    const job = await this.syncQueue.add(KEKA_SYNC_ATTENDANCE_JOB, {});
    return { jobId: job.id ?? 'unknown' };
  }

  async enqueueHolidaysSync(): Promise<{ jobId: string | number }> {
    const job = await this.syncQueue.add(KEKA_SYNC_HOLIDAYS_JOB, {});
    return { jobId: job.id ?? 'unknown' };
  }

  async enqueueSalarySync(): Promise<{ jobId: string | number }> {
    const job = await this.syncQueue.add(KEKA_SYNC_SALARY_JOB, {});
    return { jobId: job.id ?? 'unknown' };
  }

  async enqueueClientsSync(): Promise<{ jobId: string | number }> {
    const job = await this.syncQueue.add(KEKA_SYNC_CLIENTS_JOB, {});
    return { jobId: job.id ?? 'unknown' };
  }

  async enqueueProjectsSync(): Promise<{ jobId: string | number }> {
    const job = await this.syncQueue.add(KEKA_SYNC_PROJECTS_JOB, {});
    return { jobId: job.id ?? 'unknown' };
  }

  async enqueueFullSync(): Promise<{ jobId: string | number }> {
    const job = await this.syncQueue.add(KEKA_SYNC_ALL_JOB, {});
    return { jobId: job.id ?? 'unknown' };
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
