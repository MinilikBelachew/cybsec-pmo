import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import { upsertFailedSyncRecord } from '../utils/failed-sync-record.util';
import {
  isKekaLeaveApproved,
  resolveKekaLeaveEmployeeId,
  resolveKekaLeaveType,
} from '../keka.mapper';
import { KekaLeaveRequest } from '../keka.types';
import { buildKekaDateWindow } from '../utils/keka-date-window';

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
  ) {}

  async syncLeaveRequests(): Promise<LeaveSyncResult> {
    const { from, to } = buildKekaDateWindow({ pastDays: 30, totalDays: 90 });
    const leaveRequests = await this.kekaClient.getAllPages<KekaLeaveRequest>(
      '/time/leaverequests',
      { from, to },
    );

    const syncedAt = new Date();
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
          select: { id: true },
        });

        if (!employee) {
          throw new Error(`No local employee for Keka id ${kekaEmployeeId}`);
        }

        const fromDate = this.toDateOnly(leave.fromDate);
        const toDate = this.toDateOnly(leave.toDate);
        if (!fromDate || !toDate) {
          throw new Error('Leave request has invalid fromDate/toDate');
        }

        await this.prisma.leaveRecord.upsert({
          where: { kekaRef: leaveId },
          update: {
            employeeId: employee.id,
            fromDate,
            toDate,
            fromSession: leave.fromSession ?? null,
            toSession: leave.toSession ?? null,
            leaveType: resolveKekaLeaveType(leave),
            isApproved: isKekaLeaveApproved(leave),
            kekaStatus: leave.status ?? null,
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
            leaveType: resolveKekaLeaveType(leave),
            isApproved: isKekaLeaveApproved(leave),
            kekaStatus: leave.status ?? null,
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
        });

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
