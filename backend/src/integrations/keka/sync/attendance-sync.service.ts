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
import { KekaAttendanceSummary } from '../keka.types';
import { buildKekaDateWindow } from '../utils/keka-date-window';

export type AttendanceSyncResult = {
  synced: number;
  failed: number;
};

@Injectable()
export class AttendanceSyncService {
  private readonly logger = new Logger(AttendanceSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kekaClient: KekaHttpClient,
  ) {}

  async syncAttendance(): Promise<AttendanceSyncResult> {
    const { from, to } = buildKekaDateWindow({ pastDays: 30, totalDays: 60 });

    let records: KekaAttendanceSummary[];
    try {
      records = await this.kekaClient.getAllPages<KekaAttendanceSummary>(
        '/time/attendance',
        { from, to },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Attendance API request failed';
      this.logger.error(`Attendance fetch failed: ${message}`);
      await this.logFailure('batch', { from, to }, message);
      return { synced: 0, failed: 1 };
    }

    if (records.length === 0) {
      this.logger.log(
        `Attendance sync: Keka returned 0 records for window ${from} → ${to}`,
      );
      await this.logSuccess('batch-empty', { from, to, totalRecords: 0 });
      return { synced: 0, failed: 0 };
    }

    const syncedAt = new Date();
    let synced = 0;
    let failed = 0;

    for (const record of records) {
      const entityId =
        record.id?.trim() ||
        `${record.employeeIdentifier ?? 'unknown'}:${record.attendanceDate}`;

      try {
        const kekaEmployeeId = record.employeeIdentifier?.trim();
        if (!kekaEmployeeId) {
          throw new Error('Attendance record is missing employeeIdentifier');
        }

        const employee = await this.prisma.employee.findUnique({
          where: { kekaEmployeeId },
          select: { id: true },
        });
        if (!employee) {
          throw new Error(`No local employee for Keka id ${kekaEmployeeId}`);
        }

        const attendanceDate = this.toDateOnly(record.attendanceDate);
        const data = {
          kekaAttendanceId: record.id?.trim() || null,
          kekaEmployeeId,
          employeeNumber: record.employeeNumber?.trim() || null,
          dayType: record.dayType ?? null,
          shiftStartTime: this.toDateTime(record.shiftStartTime),
          shiftEndTime: this.toDateTime(record.shiftEndTime),
          shiftDuration: this.toDecimal(record.shiftDuration),
          shiftBreakDuration: this.toDecimal(record.shiftBreakDuration),
          shiftEffectiveDuration: this.toDecimal(record.shiftEffectiveDuration),
          totalGrossHours: this.toDecimal(record.totalGrossHours),
          totalEffectiveHours: this.toDecimal(record.totalEffectiveHours),
          totalBreakDuration: this.toDecimal(record.totalBreakDuration),
          totalEffectiveOvertimeDuration: this.toDecimal(
            record.totalEffectiveOvertimeDuration,
          ),
          totalGrossOvertimeDuration: this.toDecimal(
            record.totalGrossOvertimeDuration,
          ),
          firstInAt: this.toDateTime(record.firstInOfTheDay?.timestamp),
          lastOutAt: this.toDateTime(record.lastOutOfTheDay?.timestamp),
          firstInPayload:
            record.firstInOfTheDay == null
              ? Prisma.JsonNull
              : (record.firstInOfTheDay as Prisma.InputJsonValue),
          lastOutPayload:
            record.lastOutOfTheDay == null
              ? Prisma.JsonNull
              : (record.lastOutOfTheDay as Prisma.InputJsonValue),
          syncedAt,
        };

        await this.prisma.attendanceRecord.upsert({
          where: {
            employeeId_attendanceDate: {
              employeeId: employee.id,
              attendanceDate,
            },
          },
          update: data,
          create: {
            employeeId: employee.id,
            attendanceDate,
            ...data,
          },
        });

        await this.logSuccess(entityId, record);
        synced += 1;
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error ? error.message : 'Unknown attendance sync error';
        this.logger.warn(`Attendance sync failed for ${entityId}: ${message}`);
        await this.logFailure(entityId, record, message);
      }
    }

    return { synced, failed };
  }

  private toDateOnly(value: string): Date {
    const date = new Date(value);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private toDateTime(value?: string | null): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toDecimal(value?: number | null): Prisma.Decimal | null {
    if (value == null || Number.isNaN(value)) {
      return null;
    }
    return new Prisma.Decimal(value);
  }

  private async logSuccess(entityId: string, payload: unknown): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.ATTENDANCE,
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
        entityType: KEKA_ENTITY_TYPE.ATTENDANCE,
        entityId,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.FAILED,
        payload: payload as Prisma.InputJsonValue,
        errorMsg,
        retryCount: 0,
      },
    });

    await upsertFailedSyncRecord(this.prisma, {
      entityType: KEKA_ENTITY_TYPE.ATTENDANCE,
      entityId: entityId,
      direction: KEKA_SYNC_DIRECTION.INBOUND,
      errorMsg,
      payload: payload as Prisma.InputJsonValue,
    });

  }
}
