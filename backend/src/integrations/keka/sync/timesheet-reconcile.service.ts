import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { NOTIFICATION_EVENT_TYPE } from '../../../notifications/notifications.constants';
import { TIMESHEET_STATUS } from '../../../timesheets/timesheets.constants';
import { KekaHttpClient } from '../client/keka-http.client';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import { KekaPsaTimesheetEntry } from '../keka.types';

const KEKA_TIMEENTRIES_MAX_DAYS = 90;
const RECONCILE_TOLERANCE_HOURS = 0.01;

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export type TimesheetReconcileEmployeeRow = {
  employeeId: string;
  name: string;
  departmentName: string;
  kekaEmployeeId: string | null;
  localApprovedHours: number;
  kekaRemoteHours: number;
  kekaSyncedHours: number;
  deltaHours: number;
  status: 'matched' | 'pending' | 'mismatch' | 'unavailable';
};

export type TimesheetReconcileResult = {
  startDate: string;
  endDate: string;
  source: 'keka-live' | 'local-push-ack';
  pulledEntryCount: number;
  matchedCount: number;
  pendingCount: number;
  mismatchCount: number;
  unavailableCount: number;
  rows: TimesheetReconcileEmployeeRow[];
  mismatches: TimesheetReconcileEmployeeRow[];
  notifiedAdminCount: number;
};

@Injectable()
export class TimesheetReconcileService {
  private readonly logger = new Logger(TimesheetReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kekaClient: KekaHttpClient,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Pull PSA time entries from Keka for [start, end] and compare to local
   * approved timesheet hours. Optionally notify integration admins on mismatch.
   */
  async reconcilePeriod(options: {
    start: Date;
    end: Date;
    employeeIds?: string[];
    projectId?: string;
    notifyAdmins?: boolean;
  }): Promise<TimesheetReconcileResult> {
    const start = stripToUtcDay(options.start);
    const end = stripToUtcDay(options.end);
    const startDate = formatDateOnly(start);
    const endDate = formatDateOnly(end);

    const employees = await this.prisma.employee.findMany({
      where: {
        isActive: true,
        ...(options.employeeIds?.length
          ? { id: { in: options.employeeIds } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        kekaEmployeeId: true,
        department: { select: { name: true } },
        timesheets: {
          where: {
            workDate: { gte: start, lte: end },
            status: TIMESHEET_STATUS.APPROVED,
            ...(options.projectId ? { projectId: options.projectId } : {}),
          },
          select: {
            regularHours: true,
            overtimeHours: true,
            approvals: {
              orderBy: { decidedAt: 'desc' },
              take: 1,
              select: { kekaSyncedAt: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    let remoteByKekaEmployeeId = new Map<string, number>();
    let source: 'keka-live' | 'local-push-ack' = 'local-push-ack';
    let pulledEntryCount = 0;

    try {
      const pull = await this.pullKekaHours({
        start,
        end,
        kekaEmployeeIds: employees
          .map((row) => row.kekaEmployeeId)
          .filter((id): id is string => Boolean(id)),
        projectId: options.projectId,
      });
      remoteByKekaEmployeeId = pull.hoursByKekaEmployeeId;
      pulledEntryCount = pull.entryCount;
      source = 'keka-live';
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Keka timeentries pull failed';
      this.logger.warn(`Bi-directional timesheet reconcile fell back: ${message}`);
      await this.logPullFailure(startDate, endDate, message);
    }

    const rows: TimesheetReconcileEmployeeRow[] = employees.map((employee) => {
      let localApprovedHours = 0;
      let kekaSyncedHours = 0;

      for (const entry of employee.timesheets) {
        const hours =
          Number(entry.regularHours) + Number(entry.overtimeHours);
        localApprovedHours += hours;
        if (entry.approvals[0]?.kekaSyncedAt) {
          kekaSyncedHours += hours;
        }
      }

      localApprovedHours = roundHours(localApprovedHours);
      kekaSyncedHours = roundHours(kekaSyncedHours);

      const kekaRemoteHours = employee.kekaEmployeeId
        ? roundHours(remoteByKekaEmployeeId.get(employee.kekaEmployeeId) ?? 0)
        : 0;

      const status = resolveBiDirectionalStatus({
        source,
        hasKekaLink: Boolean(employee.kekaEmployeeId),
        localApprovedHours,
        kekaRemoteHours,
        kekaSyncedHours,
      });

      const deltaHours =
        source === 'keka-live'
          ? roundHours(localApprovedHours - kekaRemoteHours)
          : roundHours(localApprovedHours - kekaSyncedHours);

      return {
        employeeId: employee.id,
        name: employee.name,
        departmentName: employee.department.name,
        kekaEmployeeId: employee.kekaEmployeeId,
        localApprovedHours,
        kekaRemoteHours,
        kekaSyncedHours,
        deltaHours,
        status,
      };
    });

    const mismatches = rows.filter((row) => row.status === 'mismatch');
    const result: TimesheetReconcileResult = {
      startDate,
      endDate,
      source,
      pulledEntryCount,
      matchedCount: rows.filter((row) => row.status === 'matched').length,
      pendingCount: rows.filter((row) => row.status === 'pending').length,
      mismatchCount: mismatches.length,
      unavailableCount: rows.filter((row) => row.status === 'unavailable')
        .length,
      rows,
      mismatches,
      notifiedAdminCount: 0,
    };

    if (source === 'keka-live') {
      await this.logPullSuccess(result);
    }

    if (options.notifyAdmins && mismatches.length > 0) {
      result.notifiedAdminCount = await this.notifyAdmins(result);
    }

    return result;
  }

  /**
   * Hours map keyed by local employee id for utilisation report enrichment.
   */
  async getRemoteHoursByEmployeeId(options: {
    start: Date;
    end: Date;
    employeeIds: string[];
    projectId?: string;
  }): Promise<{
    source: 'keka-live' | 'local-push-ack';
    hoursByEmployeeId: Map<string, number>;
  }> {
    if (options.employeeIds.length === 0) {
      return { source: 'local-push-ack', hoursByEmployeeId: new Map() };
    }

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: options.employeeIds } },
      select: { id: true, kekaEmployeeId: true },
    });

    try {
      const pull = await this.pullKekaHours({
        start: stripToUtcDay(options.start),
        end: stripToUtcDay(options.end),
        kekaEmployeeIds: employees
          .map((row) => row.kekaEmployeeId)
          .filter((id): id is string => Boolean(id)),
        projectId: options.projectId,
      });

      const hoursByEmployeeId = new Map<string, number>();
      for (const employee of employees) {
        if (!employee.kekaEmployeeId) continue;
        hoursByEmployeeId.set(
          employee.id,
          roundHours(pull.hoursByKekaEmployeeId.get(employee.kekaEmployeeId) ?? 0),
        );
      }

      return { source: 'keka-live', hoursByEmployeeId };
    } catch (error) {
      this.logger.warn(
        `Utilisation Keka pull skipped: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return { source: 'local-push-ack', hoursByEmployeeId: new Map() };
    }
  }

  private async pullKekaHours(options: {
    start: Date;
    end: Date;
    kekaEmployeeIds: string[];
    projectId?: string;
  }): Promise<{
    hoursByKekaEmployeeId: Map<string, number>;
    entryCount: number;
  }> {
    const hoursByKekaEmployeeId = new Map<string, number>();
    let entryCount = 0;

    const kekaProjectId = options.projectId
      ? (
          await this.prisma.project.findUnique({
            where: { id: options.projectId },
            select: { kekaProjectId: true },
          })
        )?.kekaProjectId ?? undefined
      : undefined;

    const windows = splitIntoWindows(options.start, options.end, KEKA_TIMEENTRIES_MAX_DAYS);

    for (const window of windows) {
      const params: Record<string, string | number | undefined> = {
        from: window.from.toISOString(),
        to: window.to.toISOString(),
      };

      if (options.kekaEmployeeIds.length > 0 && options.kekaEmployeeIds.length <= 40) {
        params.employeeIds = options.kekaEmployeeIds.join(',');
      }
      if (kekaProjectId) {
        params.projectIds = kekaProjectId;
      }

      const entries = await this.kekaClient.getAllPages<KekaPsaTimesheetEntry>(
        '/psa/timeentries',
        params,
        100,
      );

      for (const entry of entries) {
        const kekaEmployeeId = entry.employeeId?.trim();
        if (!kekaEmployeeId) continue;

        const minutes = Number(entry.totalMinutes ?? 0);
        if (!Number.isFinite(minutes) || minutes <= 0) continue;

        entryCount += 1;
        const hours = minutes / 60;
        hoursByKekaEmployeeId.set(
          kekaEmployeeId,
          (hoursByKekaEmployeeId.get(kekaEmployeeId) ?? 0) + hours,
        );
      }
    }

    for (const [key, value] of hoursByKekaEmployeeId) {
      hoursByKekaEmployeeId.set(key, roundHours(value));
    }

    return { hoursByKekaEmployeeId, entryCount };
  }

  private async notifyAdmins(
    result: TimesheetReconcileResult,
  ): Promise<number> {
    const admins = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: {
          rolePermissions: {
            some: {
              permission: {
                module: 'integrations',
                action: 'configure',
              },
            },
          },
        },
      },
      select: { id: true },
    });

    if (admins.length === 0) {
      return 0;
    }

    const sample = result.mismatches
      .slice(0, 5)
      .map(
        (row) =>
          `${row.name}: local ${row.localApprovedHours}h vs Keka ${row.kekaRemoteHours}h (Δ ${row.deltaHours}h)`,
      )
      .join('; ');

    await this.notificationsService.notify({
      eventType: NOTIFICATION_EVENT_TYPE.KEKA_TIMESHEET_MISMATCH,
      recipientUserIds: admins.map((admin) => admin.id),
      title: 'Keka timesheet hours differ from Cybsec',
      body: `${result.mismatchCount} employee(s) have hour differences for ${result.startDate} – ${result.endDate}. ${sample}`,
      payload: {
        startDate: result.startDate,
        endDate: result.endDate,
        mismatchCount: result.mismatchCount,
        source: result.source,
      },
      sourceObjectType: 'keka_timesheet_reconcile',
      sourceObjectId: `${result.startDate}_${result.endDate}`,
      inAppOnly: false,
    });

    return admins.length;
  }

  private async logPullSuccess(result: TimesheetReconcileResult): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.TIMESHEET,
        entityId: `reconcile:${result.startDate}:${result.endDate}`,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.SUCCESS,
        payload: {
          startDate: result.startDate,
          endDate: result.endDate,
          pulledEntryCount: result.pulledEntryCount,
          matchedCount: result.matchedCount,
          pendingCount: result.pendingCount,
          mismatchCount: result.mismatchCount,
          mismatches: result.mismatches.slice(0, 50),
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async logPullFailure(
    startDate: string,
    endDate: string,
    message: string,
  ): Promise<void> {
    await this.prisma.kekaSyncLog.create({
      data: {
        entityType: KEKA_ENTITY_TYPE.TIMESHEET,
        entityId: `reconcile:${startDate}:${endDate}`,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        status: KEKA_SYNC_STATUS.FAILED,
        errorMsg: message,
        payload: { startDate, endDate } as Prisma.InputJsonValue,
      },
    });
  }
}

function resolveBiDirectionalStatus(input: {
  source: 'keka-live' | 'local-push-ack';
  hasKekaLink: boolean;
  localApprovedHours: number;
  kekaRemoteHours: number;
  kekaSyncedHours: number;
}): 'matched' | 'pending' | 'mismatch' | 'unavailable' {
  if (!input.hasKekaLink) {
    return input.localApprovedHours > 0 ? 'unavailable' : 'matched';
  }

  if (input.source === 'keka-live') {
    const delta = Math.abs(input.localApprovedHours - input.kekaRemoteHours);
    if (delta <= RECONCILE_TOLERANCE_HOURS) {
      return 'matched';
    }
    if (
      input.kekaRemoteHours === 0 &&
      input.localApprovedHours > 0 &&
      input.kekaSyncedHours === 0
    ) {
      return 'pending';
    }
    return 'mismatch';
  }

  if (input.localApprovedHours === 0 && input.kekaSyncedHours === 0) {
    return 'matched';
  }
  if (input.kekaSyncedHours === 0 && input.localApprovedHours > 0) {
    return 'pending';
  }
  if (
    Math.abs(input.localApprovedHours - input.kekaSyncedHours) >
    RECONCILE_TOLERANCE_HOURS
  ) {
    return 'mismatch';
  }
  return 'matched';
}

function stripToUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function splitIntoWindows(
  start: Date,
  end: Date,
  maxDays: number,
): Array<{ from: Date; to: Date }> {
  const windows: Array<{ from: Date; to: Date }> = [];
  let cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    const windowEnd = new Date(cursor);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + (maxDays - 1));
    const to = windowEnd.getTime() > end.getTime() ? new Date(end) : windowEnd;
    windows.push({ from: new Date(cursor), to });
    cursor = new Date(to);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return windows;
}
