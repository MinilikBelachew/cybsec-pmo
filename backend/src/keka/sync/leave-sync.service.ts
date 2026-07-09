import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import {
  isKekaLeaveApproved,
  resolveKekaLeaveEmployeeId,
  resolveKekaLeaveType,
} from '../keka.mapper';
import { KekaLeaveRequest } from '../keka.types';

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
    const { from, to } = this.buildDateWindow();
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

        const leaveType = resolveKekaLeaveType(leave);
        const isApproved = isKekaLeaveApproved(leave);
        const dates = this.expandLeaveDates(leave);
        const kekaStatus = leave.status ?? null;
        const fromSession = leave.fromSession ?? null;
        const toSession = leave.toSession ?? null;

        for (const leaveDate of dates) {
          await this.prisma.leaveRecord.upsert({
            where: {
              employeeId_leaveDate: {
                employeeId: employee.id,
                leaveDate,
              },
            },
            update: {
              leaveType,
              isApproved,
              kekaStatus,
              fromSession,
              toSession,
              kekaRef: leaveId,
              syncedAt,
            },
            create: {
              employeeId: employee.id,
              leaveDate,
              leaveType,
              isApproved,
              kekaStatus,
              fromSession,
              toSession,
              kekaRef: leaveId,
              syncedAt,
            },
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

  private buildDateWindow(): { from: string; to: string } {
    const today = new Date();
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 30);
    const to = new Date(today);
    to.setUTCDate(to.getUTCDate() + 90);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }

  private expandLeaveDates(leave: KekaLeaveRequest): Date[] {
    const start = new Date(leave.fromDate);
    const end = new Date(leave.toDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);

    const dates: Date[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      dates.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return dates.length > 0 ? dates : [start];
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
  }
}
