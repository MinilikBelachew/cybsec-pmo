import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../../../notifications/notifications.constants';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import { upsertFailedSyncRecord, resolveFailedSyncRecord } from '../utils/failed-sync-record.util';
import {
  isKekaLeaveApproved,
  resolveKekaLeaveEmployeeId,
  resolveKekaLeaveType,
} from '../keka.mapper';
import { KekaLeaveRequest, KekaLeaveRequestStatus } from '../keka.types';
import { buildKekaDateWindow } from '../utils/keka-date-window';

const ACTIVE_LEAVE_ALERT_PROJECT_STATUSES = [
  'Draft',
  'Active',
  'On_Hold',
  'At_Risk',
  'Pending_Closure',
] as const;

export type LeaveSyncResult = {
  synced: number;
  failed: number;
  employeeIds: string[];
};

@Injectable()
export class LeaveSyncService {
  private readonly logger = new Logger(LeaveSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kekaClient: KekaHttpClient,
    private readonly notificationsService: NotificationsService,
  ) {}

  async syncLeaveRequests(): Promise<LeaveSyncResult> {
    const { from, to } = buildKekaDateWindow({ pastDays: 30, totalDays: 90 });
    const leaveRequests = await this.kekaClient.getAllPages<KekaLeaveRequest>(
      '/time/leaverequests',
      { from, to },
    );

    const syncedAt = new Date();
    const todayUtc = new Date(
      Date.UTC(
        syncedAt.getUTCFullYear(),
        syncedAt.getUTCMonth(),
        syncedAt.getUTCDate(),
      ),
    );
    const sdmUserIds =
      await this.notificationsService.resolveActiveUserIdsByRoleCodes(['sdm']);

    let synced = 0;
    let failed = 0;
    const employeeIds = new Set<string>();

    for (const leave of leaveRequests) {
      const leaveId = leave.id?.trim() ?? 'unknown';

      try {
        if (!leave.id?.trim()) {
          throw new Error('Leave request is missing id');
        }

        const kekaEmployeeId = resolveKekaLeaveEmployeeId(leave);
        if (!kekaEmployeeId) {
          throw new Error('Leave request is missing employeeIdentifier');
        }

        const employee = await this.prisma.employee.findUnique({
          where: { kekaEmployeeId },
          select: { id: true, name: true, userId: true },
        });

        if (!employee) {
          throw new Error(`No local employee for Keka id ${kekaEmployeeId}`);
        }

        const fromDate = this.toDateOnly(leave.fromDate);
        const toDate = this.toDateOnly(leave.toDate);
        if (!fromDate || !toDate) {
          throw new Error('Leave request has invalid fromDate/toDate');
        }

        const leaveType = resolveKekaLeaveType(leave);
        const isApproved = isKekaLeaveApproved(leave);
        const kekaStatus = leave.status ?? null;

        const existing = await this.prisma.leaveRecord.findUnique({
          where: { kekaRef: leaveId },
          select: {
            id: true,
            fromDate: true,
            toDate: true,
            isApproved: true,
            kekaStatus: true,
          },
        });

        const savedRecord = await this.prisma.leaveRecord.upsert({
          where: { kekaRef: leaveId },
          update: {
            employeeId: employee.id,
            fromDate,
            toDate,
            fromSession: leave.fromSession ?? null,
            toSession: leave.toSession ?? null,
            leaveType,
            isApproved,
            kekaStatus,
            note: leave.note?.trim() || null,
            requestedOn: this.toDateTime(leave.requestedOn),
            cancelRejectReason: leave.cancelRejectReason?.trim() || null,
            lastActionTakenOn: this.toDateTime(leave.lastActionTakenOn),
            selection:
              leave.selection == null
                ? Prisma.JsonNull
                : (leave.selection as Prisma.InputJsonValue),
            syncedAt,
          },
          create: {
            employeeId: employee.id,
            kekaRef: leaveId,
            fromDate,
            toDate,
            fromSession: leave.fromSession ?? null,
            toSession: leave.toSession ?? null,
            leaveType,
            isApproved,
            kekaStatus,
            note: leave.note?.trim() || null,
            requestedOn: this.toDateTime(leave.requestedOn),
            cancelRejectReason: leave.cancelRejectReason?.trim() || null,
            lastActionTakenOn: this.toDateTime(leave.lastActionTakenOn),
            selection:
              leave.selection == null
                ? Prisma.JsonNull
                : (leave.selection as Prisma.InputJsonValue),
            syncedAt,
          },
          select: { id: true },
        });

        const isUpcomingOrCurrent = toDate.getTime() >= todayUtc.getTime();
        const hasChanged =
          !existing ||
          existing.kekaStatus !== kekaStatus ||
          existing.isApproved !== isApproved ||
          existing.fromDate.getTime() !== fromDate.getTime() ||
          existing.toDate.getTime() !== toDate.getTime();

        if (isUpcomingOrCurrent && hasChanged) {
          await this.notifyLeaveChange({
            leaveRecordId: savedRecord.id,
            employeeId: employee.id,
            employeeName: employee.name,
            leaveType,
            fromDate,
            toDate,
            isApproved,
            kekaStatus,
            sdmUserIds,
          });
        }

        employeeIds.add(employee.id);
        await this.logSuccess(leaveId, leave);
        synced += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'Unknown leave sync error';
        this.logger.warn(`Leave sync failed for ${leaveId}: ${message}`);
        await this.logFailure(leaveId, leave, message);
      }
    }

    return { synced, failed, employeeIds: [...employeeIds] };
  }

  private async notifyLeaveChange(options: {
    leaveRecordId: string;
    employeeId: string;
    employeeName: string;
    leaveType: string;
    fromDate: Date;
    toDate: Date;
    isApproved: boolean;
    kekaStatus: number | null;
    sdmUserIds: string[];
  }): Promise<void> {
    try {
      const allocations = await this.prisma.allocation.findMany({
        where: {
          employeeId: options.employeeId,
          status: 'Active',
          project: {
            status: { in: [...ACTIVE_LEAVE_ALERT_PROJECT_STATUSES] },
          },
        },
        select: {
          project: {
            select: {
              id: true,
              name: true,
              primaryPmId: true,
              secondaryPmId: true,
            },
          },
        },
      });

      const projectsById = new Map<string, { id: string; name: string }>();
      const pmUserIds = new Set<string>();

      for (const allocation of allocations) {
        projectsById.set(allocation.project.id, {
          id: allocation.project.id,
          name: allocation.project.name,
        });
        if (allocation.project.primaryPmId) {
          pmUserIds.add(allocation.project.primaryPmId);
        }
        if (allocation.project.secondaryPmId) {
          pmUserIds.add(allocation.project.secondaryPmId);
        }
      }

      const recipientUserIds = [
        ...new Set([...options.sdmUserIds, ...pmUserIds]),
      ];

      if (recipientUserIds.length === 0) {
        return;
      }

      const projects = [...projectsById.values()];
      const fromStr = options.fromDate.toISOString().slice(0, 10);
      const toStr = options.toDate.toISOString().slice(0, 10);
      const dateRange = fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`;
      const projectSuffix =
        projects.length > 0
          ? ` Active project(s): ${projects.map((p) => p.name).join(', ')}.`
          : '';
      const link =
        projects.length === 1
          ? `/dashboard/projects/${projects[0].id}?view=team`
          : '/dashboard/team';

      let eventType:
        | typeof NOTIFICATION_EVENT_TYPE.LEAVE_APPROVED
        | typeof NOTIFICATION_EVENT_TYPE.LEAVE_REQUESTED
        | typeof NOTIFICATION_EVENT_TYPE.LEAVE_STATUS_CHANGED;
      let title: string;
      let body: string;
      let statusLabel: string;

      if (options.isApproved) {
        eventType = NOTIFICATION_EVENT_TYPE.LEAVE_APPROVED;
        statusLabel = 'approved';
        title = 'Employee leave approved';
        body = `${options.employeeName}'s ${options.leaveType} (${dateRange}) has been approved.${projectSuffix}`;
      } else if (options.kekaStatus === KekaLeaveRequestStatus.Rejected) {
        eventType = NOTIFICATION_EVENT_TYPE.LEAVE_STATUS_CHANGED;
        statusLabel = 'rejected';
        title = 'Employee leave rejected';
        body = `${options.employeeName}'s ${options.leaveType} (${dateRange}) was rejected.${projectSuffix}`;
      } else if (options.kekaStatus === KekaLeaveRequestStatus.Cancelled) {
        eventType = NOTIFICATION_EVENT_TYPE.LEAVE_STATUS_CHANGED;
        statusLabel = 'cancelled';
        title = 'Employee leave cancelled';
        body = `${options.employeeName}'s ${options.leaveType} (${dateRange}) was cancelled.${projectSuffix}`;
      } else {
        eventType = NOTIFICATION_EVENT_TYPE.LEAVE_REQUESTED;
        statusLabel = 'pending';
        title = 'Employee leave requested';
        body = `${options.employeeName} requested ${options.leaveType} (${dateRange}, pending approval).${projectSuffix}`;
      }

      await this.notificationsService.notify({
        eventType,
        recipientUserIds,
        title,
        body,
        payload: {
          link,
          employeeId: options.employeeId,
          employeeName: options.employeeName,
          leaveRecordId: options.leaveRecordId,
          leaveType: options.leaveType,
          leaveFrom: fromStr,
          leaveTo: toStr,
          leaveStatus: statusLabel,
          ...(projects.length === 1
            ? { projectId: projects[0].id, projectName: projects[0].name }
            : {}),
          projectIds: projects.map((p) => p.id),
          projectNames: projects.map((p) => p.name),
        },
        sourceObjectType: 'LeaveRecord',
        sourceObjectId: options.leaveRecordId,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send leave notification for record ${options.leaveRecordId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private toDateOnly(value?: string | null): Date | null {
    if (!value?.trim()) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private toDateTime(value?: string | null): Date | null {
    if (!value?.trim()) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private async logSuccess(entityId: string, payload: unknown): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.LEAVE,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.SUCCESS,
        payload: payload as Prisma.InputJsonValue,
      },
    });
    await resolveFailedSyncRecord(this.prisma, {
      entityType: KEKA_ENTITY_TYPE.LEAVE,
      entityId,
    });
  }

  private async logFailure(
    entityId: string,
    payload: unknown,
    errorMsg: string,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.LEAVE,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.FAILED,
        payload: payload as Prisma.InputJsonValue,
        errorMsg,
        retryCount: 0,
      },
    });

    await upsertFailedSyncRecord(this.prisma, {
      entityType: KEKA_ENTITY_TYPE.LEAVE,
      entityId: entityId,
      direction: KEKA_SYNC_DIRECTION.INBOUND,
      errorMsg,
      payload: payload as Prisma.InputJsonValue,
    });
  }
}
