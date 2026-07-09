import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  KEKA_SYNC_ALL_JOB,
  KEKA_SYNC_EMPLOYEES_JOB,
  KEKA_SYNC_LEAVE_JOB,
  KEKA_SYNC_QUEUE,
} from '../keka.constants';
import { KekaSyncRunResult } from '../keka.types';
import { DepartmentSyncService } from './department-sync.service';
import { EmployeeSyncService } from './employee-sync.service';
import { LeaveSyncService } from './leave-sync.service';

@Injectable()
export class KekaSyncService {
  private readonly logger = new Logger(KekaSyncService.name);

  constructor(
    private readonly departmentSyncService: DepartmentSyncService,
    private readonly employeeSyncService: EmployeeSyncService,
    private readonly leaveSyncService: LeaveSyncService,
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

  async syncAllNow(): Promise<KekaSyncRunResult> {
    const startedAt = new Date().toISOString();
    const departmentResult = await this.syncDepartmentsNow();
    const employeeResult = await this.employeeSyncService.syncEmployees();
    const leaveResult = await this.syncLeaveNow();

    return {
      startedAt,
      completedAt: new Date().toISOString(),
      results: [
        { entityType: 'department', ...departmentResult },
        { entityType: 'employee', ...employeeResult },
        { entityType: 'leave', ...leaveResult },
      ],
    };
  }

  async enqueueEmployeesSync(): Promise<{ jobId: string | number }> {
    const job = await this.syncQueue.add(KEKA_SYNC_EMPLOYEES_JOB, {});
    return { jobId: job.id ?? 'unknown' };
  }

  async enqueueLeaveSync(): Promise<{ jobId: string | number }> {
    const job = await this.syncQueue.add(KEKA_SYNC_LEAVE_JOB, {});
    return { jobId: job.id ?? 'unknown' };
  }

  async enqueueFullSync(): Promise<{ jobId: string | number }> {
    const job = await this.syncQueue.add(KEKA_SYNC_ALL_JOB, {});
    return { jobId: job.id ?? 'unknown' };
  }

  async runScheduledSync(): Promise<void> {
    try {
      const result = await this.syncAllNow();
      this.logger.log(
        `Scheduled Keka sync completed: departments=${result.results[0]?.synced ?? 0}/${result.results[0]?.failed ?? 0} failed, employees=${result.results[1]?.synced ?? 0}/${result.results[1]?.failed ?? 0} failed, leave=${result.results[2]?.synced ?? 0}/${result.results[2]?.failed ?? 0} failed`,
      );
    } catch (error) {
      this.logger.error('Scheduled Keka sync failed', error);
    }
  }
}
