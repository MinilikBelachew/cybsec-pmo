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
  ) {}

  async pushTimesheetEntry(
    timesheetId: string,
    approvalId: string,
  ): Promise<string | null> {
    const timesheet = await this.prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: {
        employee: { select: { kekaEmployeeId: true, name: true } },
        project: {
          select: { id: true, name: true, kekaProjectId: true },
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

      const kekaTaskId =
        timesheet.task.kekaTaskId?.trim() ||
        (await this.projectLinkService.ensureTaskLinked(timesheet.task.id));

      const hours =
        Number(timesheet.regularHours) + Number(timesheet.overtimeHours);
      payload = [
        {
          projectId: kekaProjectId,
          ...(kekaTaskId ? { taskId: kekaTaskId } : {}),
          numberOfMinutes: Math.max(1, Math.round(hours * 60)),
          date: timesheet.workDate.toISOString(),
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
      const message =
        error instanceof Error ? error.message : 'Keka timesheet push failed';
      this.logger.error(`Timesheet push failed for ${timesheetId}: ${message}`);
      await this.logFailure(timesheetId, payload, message);
      return null;
    }
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
