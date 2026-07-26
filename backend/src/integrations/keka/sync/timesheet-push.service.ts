import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import {
  KEKA_INTEGRATION,
  TIMESHEET_KEKA_MAX_RETRIES,
} from '../../../timesheets/timesheets.constants';
import { formatDateOnly } from '../../../timesheets/utils/week.util';
import { AllocationPushService } from './allocation-push.service';
import { ProjectLinkService } from './project-link.service';

type KekaTimeEntryDto = {
  projectId: string;
  taskId?: string;
  numberOfMinutes: number;
  date: string;
  comment?: string | null;
};

type KekaTimeEntryPushResponse = {
  succeeded?: boolean;
  data?: string | { id?: string } | null;
  message?: string | null;
};

export type TimesheetSyncFailureRow = {
  timesheetId: string;
  employeeName: string;
  projectName: string;
  taskName: string;
  workDate: string;
  hours: number;
  errorMsg: string | null;
  retryCount: number;
  approvalId: string;
};

@Injectable()
export class TimesheetPushService {
  private readonly logger = new Logger(TimesheetPushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kekaClient: KekaHttpClient,
    private readonly projectLinkService: ProjectLinkService,
    private readonly allocationPushService: AllocationPushService,
  ) {}

  async pushTimesheetEntry(
    timesheetId: string,
    approvalId: string,
  ): Promise<string | null> {
    const timesheet = await this.prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: {
        employee: { select: { id: true, kekaEmployeeId: true, name: true } },
        project: {
          select: {
            id: true,
            name: true,
            kekaProjectId: true,
            startDate: true,
            endDate: true,
          },
        },
        task: {
          select: { id: true, title: true, kekaTaskId: true },
        },
        approvals: {
          where: { id: approvalId },
          select: { kekaSyncRef: true },
        },
      },
    });

    if (!timesheet || timesheet.status !== 'Approved') {
      return null;
    }

    const existingRef = timesheet.approvals[0]?.kekaSyncRef;
    if (existingRef) {
      return existingRef;
    }

    const kekaEmployeeId = timesheet.employee.kekaEmployeeId?.trim();
    if (!kekaEmployeeId) {
      await this.logFailure(
        timesheetId,
        { timesheetId },
        `Employee ${timesheet.employee.name} has no Keka ID`,
      );
      return null;
    }

    let payload: KekaTimeEntryDto[] | { timesheetId: string } = { timesheetId };

    try {
      const kekaProjectId =
        timesheet.project.kekaProjectId?.trim() ||
        (await this.projectLinkService.ensureProjectLinked(timesheet.project.id));

      if (!kekaProjectId) {
        throw new Error(
          `Project "${timesheet.project.name}" has no Keka project id`,
        );
      }

      const kekaTaskId =
        timesheet.task.kekaTaskId?.trim() ||
        (await this.projectLinkService.ensureTaskLinked(timesheet.task.id));

      if (!kekaTaskId) {
        throw new Error(
          `Task "${timesheet.task.title}" could not be linked or created in Keka (TaskId required)`,
        );
      }

      // Keka rejects time entries when the employee is not allocated on the
      // project — often with a misleading "ProjectId/TaskId can't be null" error.
      await this.ensureKekaAllocationForTimesheet({
        employeeId: timesheet.employee.id,
        employeeName: timesheet.employee.name,
        projectId: timesheet.project.id,
        projectName: timesheet.project.name,
        kekaProjectId,
        workDate: timesheet.workDate,
      });

      await this.ensureEmployeeAssignedToKekaTask({
        kekaProjectId,
        kekaTaskId,
        kekaEmployeeId,
        taskTitle: timesheet.task.title,
      });

      const hours =
        Number(timesheet.regularHours) + Number(timesheet.overtimeHours);
      payload = [
        {
          projectId: kekaProjectId,
          taskId: kekaTaskId,
          numberOfMinutes: Math.max(1, Math.round(hours * 60)),
          // OpenAPI: date-time. GET samples are date-only; both work when the
          // employee is allocated — use noon UTC to avoid TZ edge cases.
          date: `${formatDateOnly(timesheet.workDate)}T00:00:00Z`,
          comment: timesheet.notes,
        },
      ];

      const response = await this.kekaClient.post<KekaTimeEntryPushResponse>(
        `/psa/employees/${encodeURIComponent(kekaEmployeeId)}/timeentries`,
        payload,
      );

      const ref =
        (typeof response.data === 'string'
          ? response.data
          : response.data?.id) ?? `keka-ts-${timesheetId.slice(0, 8)}`;
      const syncedAt = new Date();

      await this.prisma.timesheetApproval.update({
        where: { id: approvalId },
        data: {
          kekaSyncRef: ref,
          kekaSyncedAt: syncedAt,
        },
      });

      await this.prisma.kekaSyncLog.create({
        data: {
          entityType: KEKA_ENTITY_TYPE.TIMESHEET,
          entityId: timesheetId,
          direction: KEKA_SYNC_DIRECTION.OUTBOUND,
          status: KEKA_SYNC_STATUS.SUCCESS,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });

      await this.resolveFailedSyncRecord(timesheetId);

      return ref;
    } catch (error) {
      const message = this.clarifyKekaTimesheetError(
        error instanceof Error ? error.message : 'Keka timesheet push failed',
      );
      this.logger.error(`Timesheet push failed for ${timesheetId}: ${message}`);
      await this.logFailure(timesheetId, payload, message);
      return null;
    }
  }

  /**
   * Push (or verify) an Active local allocation covering the work date so Keka
   * will accept the time entry.
   */
  private async ensureKekaAllocationForTimesheet(args: {
    employeeId: string;
    employeeName: string;
    projectId: string;
    projectName: string;
    kekaProjectId: string;
    workDate: Date;
  }): Promise<void> {
    const workDay = formatDateOnly(args.workDate);

    const alreadyOnKeka = await this.isEmployeeAllocatedOnKekaProject(
      args.kekaProjectId,
      args.employeeId,
      workDay,
    );
    if (alreadyOnKeka) {
      return;
    }

    const allocation = await this.prisma.allocation.findFirst({
      where: {
        employeeId: args.employeeId,
        projectId: args.projectId,
        status: 'Active',
        startDate: { lte: args.workDate },
        OR: [{ endDate: null }, { endDate: { gte: args.workDate } }],
      },
      orderBy: { startDate: 'desc' },
      select: { id: true, kekaSyncRef: true },
    });

    if (!allocation) {
      throw new Error(
        `Employee "${args.employeeName}" has no Active PMO allocation on project ` +
          `"${args.projectName}" covering ${workDay}. Create/approve an allocation ` +
          `before Keka timesheet sync.`,
      );
    }

    const ref = await this.allocationPushService.pushAllocation(allocation.id);
    if (!ref) {
      throw new Error(
        `Could not push allocation for "${args.employeeName}" on "${args.projectName}" ` +
          `to Keka. Common causes: employee is a non-billable resource on a billable ` +
          `project, billing role mismatch, or allocation dates outside the Keka project window. ` +
          `Check Failed sync records (entity=allocation).`,
      );
    }

    const confirmed = await this.isEmployeeAllocatedOnKekaProject(
      args.kekaProjectId,
      args.employeeId,
      workDay,
    );
    if (!confirmed) {
      throw new Error(
        `Allocation sync for "${args.employeeName}" on "${args.projectName}" did not ` +
          `result in a covering Keka resource allocation for ${workDay}. ` +
          `If Keka says the employee is non-billable on a billable project, fix that in Keka ` +
          `(mark employee billable, or enable non-billable resource allocation).`,
      );
    }
  }

  private async isEmployeeAllocatedOnKekaProject(
    kekaProjectId: string,
    localEmployeeId: string,
    workDay: string,
  ): Promise<boolean> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: localEmployeeId },
      select: { kekaEmployeeId: true },
    });
    const kekaEmployeeId = employee?.kekaEmployeeId?.trim();
    if (!kekaEmployeeId) {
      return false;
    }

    type KekaAllocationRow = {
      employee?: { id?: string | null } | null;
      startDate?: string | null;
      endDate?: string | null;
    };

    try {
      const rows = await this.kekaClient.getAllPages<KekaAllocationRow>(
        `/psa/projects/${encodeURIComponent(kekaProjectId)}/allocations`,
      );
      return rows.some((row) => {
        if (row.employee?.id?.trim() !== kekaEmployeeId) {
          return false;
        }
        const start = row.startDate?.slice(0, 10);
        const end = row.endDate?.slice(0, 10);
        if (start && workDay < start) return false;
        if (end && workDay > end) return false;
        return true;
      });
    } catch (error) {
      this.logger.warn(
        `Could not list Keka allocations for project ${kekaProjectId}: ` +
          (error instanceof Error ? error.message : 'unknown'),
      );
      return false;
    }
  }

  private async ensureEmployeeAssignedToKekaTask(args: {
    kekaProjectId: string;
    kekaTaskId: string;
    kekaEmployeeId: string;
    taskTitle: string;
  }): Promise<void> {
    try {
      type KekaTaskRow = {
        name?: string | null;
        assignedTo?: string[] | null;
        startDate?: string | null;
        endDate?: string | null;
        estimatedHours?: number | null;
        taskBillingType?: number | null;
      };

      const task = await this.kekaClient.get<{
        data?: KekaTaskRow | null;
        succeeded?: boolean;
      }>(
        `/psa/projects/${encodeURIComponent(args.kekaProjectId)}/tasks/${encodeURIComponent(args.kekaTaskId)}`,
      );

      const current = task.data;
      const assigned = new Set(
        (current?.assignedTo ?? [])
          .map((id) => id?.trim())
          .filter((id): id is string => Boolean(id)),
      );
      if (assigned.has(args.kekaEmployeeId)) {
        return;
      }
      assigned.add(args.kekaEmployeeId);

      await this.kekaClient.put(
        `/psa/projects/${encodeURIComponent(args.kekaProjectId)}/tasks/${encodeURIComponent(args.kekaTaskId)}`,
        {
          name: current?.name?.trim() || args.taskTitle,
          taskBillingType: current?.taskBillingType ?? 1,
          assignedTo: [...assigned],
          startDate: current?.startDate ?? undefined,
          endDate: current?.endDate ?? undefined,
          estimatedHours: current?.estimatedHours ?? null,
        },
      );
    } catch (error) {
      // Soft-fail: allocation is the hard requirement; assignment helps some tenants.
      this.logger.warn(
        `Could not assign employee on Keka task ${args.kekaTaskId}: ` +
          (error instanceof Error ? error.message : 'unknown'),
      );
    }
  }

  private clarifyKekaTimesheetError(message: string): string {
    if (/both projectid'?s? and taskid'?s? can'?t be null or empty/i.test(message)) {
      return (
        `${message} — Keka often returns this when the employee is not allocated ` +
        `on the PSA project (or is non-billable on a billable project), even when ` +
        `projectId/taskId are present in the request. Ensure an Active allocation ` +
        `is pushed to Keka first.`
      );
    }
    return message;
  }

  async retryTimesheetSync(
    timesheetId: string,
    resolvedBy?: string,
  ): Promise<{ success: boolean; ref: string | null }> {
    const timesheet = await this.prisma.timesheet.findFirst({
      where: { id: timesheetId, status: 'Approved' },
      include: {
        approvals: {
          where: { decision: 'Approved' },
          orderBy: { decidedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!timesheet?.approvals[0]) {
      return { success: false, ref: null };
    }

    const approval = timesheet.approvals[0];
    if (approval.kekaSyncRef) {
      return { success: true, ref: approval.kekaSyncRef };
    }

    const latestFailed = await this.prisma.kekaSyncLog.findFirst({
      where: {
        entityType: KEKA_ENTITY_TYPE.TIMESHEET,
        entityId: timesheetId,
        status: KEKA_SYNC_STATUS.FAILED,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (
      latestFailed &&
      latestFailed.retryCount >= TIMESHEET_KEKA_MAX_RETRIES
    ) {
      return { success: false, ref: null };
    }

    if (latestFailed) {
      await this.prisma.kekaSyncLog.update({
        where: { id: latestFailed.id },
        data: { retryCount: latestFailed.retryCount + 1 },
      });
    }

    const ref = await this.pushTimesheetEntry(timesheetId, approval.id);
    if (ref && resolvedBy) {
      await this.resolveFailedSyncRecord(timesheetId, resolvedBy);
    }

    return { success: Boolean(ref), ref };
  }

  async retryPendingFailedSyncs(): Promise<{
    attempted: number;
    succeeded: number;
  }> {
    const failures = await this.prisma.failedSyncRecord.findMany({
      where: {
        integration: KEKA_INTEGRATION,
        entityType: KEKA_ENTITY_TYPE.TIMESHEET,
        isResolved: false,
        retryCount: { lt: TIMESHEET_KEKA_MAX_RETRIES },
      },
      orderBy: { lastAttempted: 'asc' },
      take: 25,
    });

    let succeeded = 0;

    for (const failure of failures) {
      if (!failure.entityId) {
        continue;
      }

      const result = await this.retryTimesheetSync(failure.entityId);
      if (result.success) {
        succeeded += 1;
      }
    }

    return { attempted: failures.length, succeeded };
  }

  async listSyncFailures(): Promise<TimesheetSyncFailureRow[]> {
    const approvals = await this.prisma.timesheetApproval.findMany({
      where: {
        decision: 'Approved',
        kekaSyncRef: null,
        timesheet: { status: 'Approved' },
      },
      include: {
        timesheet: {
          include: {
            employee: { select: { name: true } },
            project: { select: { name: true } },
            task: { select: { title: true } },
          },
        },
      },
      orderBy: { decidedAt: 'desc' },
      take: 100,
    });

    const rows: TimesheetSyncFailureRow[] = [];

    for (const approval of approvals) {
      const failedRecord = await this.prisma.failedSyncRecord.findFirst({
        where: {
          integration: KEKA_INTEGRATION,
          entityType: KEKA_ENTITY_TYPE.TIMESHEET,
          entityId: approval.timesheetId,
          isResolved: false,
        },
      });

      const latestLog = await this.prisma.kekaSyncLog.findFirst({
        where: {
          entityType: KEKA_ENTITY_TYPE.TIMESHEET,
          entityId: approval.timesheetId,
          status: KEKA_SYNC_STATUS.FAILED,
        },
        orderBy: { createdAt: 'desc' },
      });

      rows.push({
        timesheetId: approval.timesheetId,
        approvalId: approval.id,
        employeeName: approval.timesheet.employee.name,
        projectName: approval.timesheet.project.name,
        taskName: approval.timesheet.task.title,
        workDate: approval.timesheet.workDate.toISOString().slice(0, 10),
        hours:
          Number(approval.timesheet.regularHours) +
          Number(approval.timesheet.overtimeHours),
        errorMsg: failedRecord?.errorMsg ?? latestLog?.errorMsg ?? null,
        retryCount: failedRecord?.retryCount ?? latestLog?.retryCount ?? 0,
      });
    }

    return rows;
  }

  private async logFailure(
    entityId: string,
    payload: unknown,
    errorMsg: string,
  ): Promise<void> {
    const latestFailed = await this.prisma.kekaSyncLog.findFirst({
      where: {
        entityType: KEKA_ENTITY_TYPE.TIMESHEET,
        entityId,
        status: KEKA_SYNC_STATUS.FAILED,
      },
      orderBy: { createdAt: 'desc' },
    });

    const nextRetryCount = (latestFailed?.retryCount ?? 0) + 1;

    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.TIMESHEET,
        entityId,
        direction: KEKA_SYNC_DIRECTION.OUTBOUND,
        status: KEKA_SYNC_STATUS.FAILED,
        payload: payload as Prisma.InputJsonValue,
        errorMsg,
        retryCount: nextRetryCount,
      },
    });

    const existing = await this.prisma.failedSyncRecord.findFirst({
      where: {
        integration: KEKA_INTEGRATION,
        entityType: KEKA_ENTITY_TYPE.TIMESHEET,
        entityId,
        isResolved: false,
      },
    });

    const now = new Date();

    if (existing) {
      await this.prisma.failedSyncRecord.update({
        where: { id: existing.id },
        data: {
          errorMsg,
          retryCount: nextRetryCount,
          lastAttempted: now,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    } else {
      await this.prisma.failedSyncRecord.create({
        data: {
          integration: KEKA_INTEGRATION,
          entityType: KEKA_ENTITY_TYPE.TIMESHEET,
          entityId,
          direction: KEKA_SYNC_DIRECTION.OUTBOUND,
          payload: payload as Prisma.InputJsonValue,
          errorMsg,
          retryCount: nextRetryCount,
          lastAttempted: now,
        },
      });
    }
  }

  private async resolveFailedSyncRecord(
    entityId: string,
    resolvedBy?: string,
  ): Promise<void> {
    await this.prisma.failedSyncRecord.updateMany({
      where: {
        integration: KEKA_INTEGRATION,
        entityType: KEKA_ENTITY_TYPE.TIMESHEET,
        entityId,
        isResolved: false,
      },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        ...(resolvedBy ? { resolvedBy } : {}),
      },
    });
  }
}
