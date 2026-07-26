import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AllocationPushService } from './sync/allocation-push.service';
import { ClientSyncService } from './sync/client-sync.service';
import { KekaSyncService } from './sync/keka-sync.service';
import { ProjectLinkService } from './sync/project-link.service';
import { TimesheetPushService } from './sync/timesheet-push.service';
import { TimesheetReconcileService } from './sync/timesheet-reconcile.service';
import {
  FailedSyncRecordListResponseDto,
  FailedSyncRecordRowDto,
  KekaEntitySyncStatusDto,
  KekaSyncLogListResponseDto,
  KekaSyncLogRowDto,
  KekaSyncStatusResponseDto,
  QueryFailedSyncRecordsDto,
  QueryKekaSyncLogsDto,
  QueryTimesheetReconcileDto,
  RetryKekaSyncResultDto,
  TimesheetReconcileResponseDto,
} from './dto/keka-integration.dto';
import {
  KEKA_ENTITY_TYPE,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from './keka.constants';
import { KEKA_INTEGRATION } from '../../timesheets/timesheets.constants';
import { backfillFailedRecordsFromSyncLogs, upsertFailedSyncRecord, resolveFailedSyncRecord } from './utils/failed-sync-record.util';

/** Logs within this window of the latest log are treated as one "last run". */
const LAST_RUN_WINDOW_MS = 30 * 60 * 1000;

const SYNC_STATUS_ENTITIES: Array<{
  key: string;
  label: string;
  entityTypes: string[];
}> = [
  {
    key: 'employee',
    label: 'Employees',
    entityTypes: [KEKA_ENTITY_TYPE.EMPLOYEE, KEKA_ENTITY_TYPE.DEPARTMENT],
  },
  {
    key: 'leave',
    label: 'Leave',
    entityTypes: [KEKA_ENTITY_TYPE.LEAVE],
  },
  {
    key: 'attendance',
    label: 'Attendance',
    entityTypes: [KEKA_ENTITY_TYPE.ATTENDANCE],
  },
  {
    key: 'holidays',
    label: 'Holidays',
    entityTypes: [KEKA_ENTITY_TYPE.HOLIDAY, KEKA_ENTITY_TYPE.HOLIDAY_CALENDAR],
  },
  {
    key: 'client',
    label: 'Clients',
    entityTypes: [KEKA_ENTITY_TYPE.CLIENT],
  },
  {
    key: 'project',
    label: 'Projects',
    entityTypes: [KEKA_ENTITY_TYPE.PROJECT],
  },
  {
    key: 'timesheet',
    label: 'Timesheets',
    entityTypes: [KEKA_ENTITY_TYPE.TIMESHEET],
  },
];

@Injectable()
export class KekaIntegrationAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timesheetPushService: TimesheetPushService,
    private readonly allocationPushService: AllocationPushService,
    private readonly clientSyncService: ClientSyncService,
    private readonly projectLinkService: ProjectLinkService,
    private readonly kekaSyncService: KekaSyncService,
    private readonly timesheetReconcileService: TimesheetReconcileService,
  ) {}

  async getSyncStatus(): Promise<KekaSyncStatusResponseDto> {
    const [lastSuccessful, lastFailed, unresolvedFailures, entities] =
      await Promise.all([
        this.prisma.kekaSyncLog.findFirst({
          where: { status: KEKA_SYNC_STATUS.SUCCESS },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        this.prisma.kekaSyncLog.findFirst({
          where: { status: KEKA_SYNC_STATUS.FAILED },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        this.prisma.failedSyncRecord.count({
          where: {
            integration: KEKA_INTEGRATION,
            isResolved: false,
          },
        }),
        Promise.all(
          SYNC_STATUS_ENTITIES.map((entity) =>
            this.buildEntitySyncStatus(entity),
          ),
        ),
      ]);

    return {
      lastSuccessfulAt: lastSuccessful?.createdAt ?? null,
      lastFailedAt: lastFailed?.createdAt ?? null,
      unresolvedFailures,
      entities,
    };
  }

  async reconcileTimesheets(
    query: QueryTimesheetReconcileDto,
  ): Promise<TimesheetReconcileResponseDto> {
    const end = query.endDate
      ? parseDateOnly(query.endDate)
      : stripToday();
    const start = query.startDate
      ? parseDateOnly(query.startDate)
      : daysAgo(end, 29);

    if (start.getTime() > end.getTime()) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { startDate: 'mustBeOnOrBeforeEndDate' },
      });
    }

    const result = await this.timesheetReconcileService.reconcilePeriod({
      start,
      end,
      projectId: query.projectId,
      notifyAdmins: query.notifyAdmins ?? true,
    });

    return {
      startDate: result.startDate,
      endDate: result.endDate,
      source: result.source,
      pulledEntryCount: result.pulledEntryCount,
      matchedCount: result.matchedCount,
      pendingCount: result.pendingCount,
      mismatchCount: result.mismatchCount,
      unavailableCount: result.unavailableCount,
      notifiedAdminCount: result.notifiedAdminCount,
      mismatches: result.mismatches,
    };
  }

  async listSyncLogs(
    query: QueryKekaSyncLogsDto,
  ): Promise<KekaSyncLogListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildSyncLogWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.kekaSyncLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          direction: true,
          status: true,
          errorMsg: true,
          retryCount: true,
          createdAt: true,
        },
      }),
      this.prisma.kekaSyncLog.count({ where }),
    ]);

    return {
      data: rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async listFailedSyncRecords(
    query: QueryFailedSyncRecordsDto,
  ): Promise<FailedSyncRecordListResponseDto> {
    await backfillFailedRecordsFromSyncLogs(this.prisma);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildFailedSyncWhere(query);

    const [rows, total, unresolvedCount] = await Promise.all([
      this.prisma.failedSyncRecord.findMany({
        where,
        orderBy: [{ isResolved: 'asc' }, { lastAttempted: 'desc' }],
        skip,
        take: limit,
        include: {
          resolver: { select: { displayName: true } },
        },
      }),
      this.prisma.failedSyncRecord.count({ where }),
      this.prisma.failedSyncRecord.count({
        where: { ...where, isResolved: false },
      }),
    ]);

    return {
      data: rows.map((row) => this.mapFailedSyncRow(row)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
      unresolvedCount,
    };
  }

  async retryFailedSync(
    options: {
      failedSyncRecordId?: string;
      entityType?: string;
      entityId?: string;
    },
    actorId: string,
  ): Promise<RetryKekaSyncResultDto> {
    let entityType = options.entityType;
    let entityId = options.entityId;
    let direction: string | null = null;

    if (options.failedSyncRecordId) {
      const record = await this.prisma.failedSyncRecord.findUnique({
        where: { id: options.failedSyncRecordId },
      });

      if (!record) {
        throw new NotFoundException({
          status: HttpStatus.NOT_FOUND,
          errors: { failedSyncRecord: 'notFound' },
        });
      }

      if (record.isResolved) {
        return {
          success: true,
          message: 'Already resolved.',
          ref: null,
        };
      }

      entityType = record.entityType;
      entityId = record.entityId ?? undefined;
      direction = record.direction;
    }

    if (!entityType || !entityId) {
      throw new BadRequestException({
        status: HttpStatus.BAD_REQUEST,
        errors: { retry: 'entityTypeAndEntityIdRequired' },
      });
    }

    switch (entityType) {
      case KEKA_ENTITY_TYPE.TIMESHEET: {
        const result = await this.timesheetPushService.retryTimesheetSync(
          entityId,
          actorId,
        );
        return {
          success: result.success,
          message: result.success
            ? 'Timesheet synced to Keka.'
            : 'Timesheet sync failed again.',
          ref: result.ref,
        };
      }
      case KEKA_ENTITY_TYPE.ALLOCATION: {
        const ref = await this.allocationPushService.pushAllocation(entityId);
        return {
          success: Boolean(ref),
          message: ref
            ? 'Allocation synced to Keka.'
            : 'Allocation sync failed again.',
          ref,
        };
      }
      case KEKA_ENTITY_TYPE.CLIENT: {
        const customer = await this.prisma.customer.findUnique({
          where: { id: entityId },
          select: { kekaClientId: true },
        });

        const shouldRetryOutbound =
          direction === KEKA_SYNC_DIRECTION.OUTBOUND ||
          (direction == null && !customer?.kekaClientId?.trim());

        if (shouldRetryOutbound) {
          const result = await this.clientSyncService.retryOutboundClientCreate(
            entityId,
            { resolvedBy: actorId },
          );
          return {
            success: result.success,
            message: result.success
              ? 'Client created in Keka.'
              : result.error ?? 'Client sync to Keka failed again.',
            ref: result.kekaClientId,
          };
        }

        await this.kekaSyncService.enqueueClientsSync();
        return {
          success: true,
          message: 'Client sync job queued.',
          ref: null,
        };
      }
      case KEKA_ENTITY_TYPE.EMPLOYEE: {
        await this.kekaSyncService.enqueueEmployeesSync();
        return {
          success: true,
          message: 'Employee sync job queued.',
          ref: null,
        };
      }
      case KEKA_ENTITY_TYPE.LEAVE: {
        await this.kekaSyncService.enqueueLeaveSync();
        return {
          success: true,
          message: 'Leave sync job queued.',
          ref: null,
        };
      }
      case KEKA_ENTITY_TYPE.ATTENDANCE: {
        await this.kekaSyncService.enqueueAttendanceSync();
        return {
          success: true,
          message: 'Attendance sync job queued.',
          ref: null,
        };
      }
      case KEKA_ENTITY_TYPE.HOLIDAY:
      case KEKA_ENTITY_TYPE.HOLIDAY_CALENDAR: {
        await this.kekaSyncService.enqueueHolidaysSync();
        return {
          success: true,
          message: 'Holiday sync job queued.',
          ref: null,
        };
      }
      case KEKA_ENTITY_TYPE.SALARY:
      case KEKA_ENTITY_TYPE.PAY_CYCLE: {
        await this.kekaSyncService.enqueueSalarySync();
        return {
          success: true,
          message: 'Salary sync job queued.',
          ref: null,
        };
      }
      case KEKA_ENTITY_TYPE.DEPARTMENT: {
        await this.kekaSyncService.enqueueEmployeesSync();
        return {
          success: true,
          message: 'Department/employee sync job queued.',
          ref: null,
        };
      }
      case KEKA_ENTITY_TYPE.PROJECT: {
        if (direction !== KEKA_SYNC_DIRECTION.INBOUND) {
          try {
            const kekaProjectId =
              await this.projectLinkService.ensureProjectLinked(entityId);
            await resolveFailedSyncRecord(this.prisma, {
              entityType: KEKA_ENTITY_TYPE.PROJECT,
              entityId,
              resolvedBy: actorId,
            });
            return {
              success: true,
              message: 'Project linked/created in Keka.',
              ref: kekaProjectId,
            };
          } catch (error) {
            const errorMsg =
              error instanceof Error
                ? error.message
                : 'Project sync to Keka failed again.';
            await upsertFailedSyncRecord(this.prisma, {
              entityType: KEKA_ENTITY_TYPE.PROJECT,
              entityId,
              direction: KEKA_SYNC_DIRECTION.OUTBOUND,
              errorMsg,
            });
            return {
              success: false,
              message: errorMsg,
              ref: null,
            };
          }
        }
        await this.kekaSyncService.enqueueProjectsSync();
        return {
          success: true,
          message: 'Project sync job queued.',
          ref: null,
        };
      }
      case KEKA_ENTITY_TYPE.TASK: {
        await this.kekaSyncService.enqueueProjectsSync();
        return {
          success: true,
          message: 'Project sync job queued.',
          ref: null,
        };
      }
      default:
        throw new BadRequestException({
          status: HttpStatus.BAD_REQUEST,
          errors: { entityType: 'retryNotSupported' },
        });
    }
  }

  private async buildEntitySyncStatus(entity: {
    key: string;
    label: string;
    entityTypes: string[];
  }): Promise<KekaEntitySyncStatusDto> {
    const entityTypeFilter = { entityType: { in: entity.entityTypes } };

    const [lastSuccessful, lastFailed, lastAny, unresolvedFailures, linkedRecordCount] =
      await Promise.all([
        this.prisma.kekaSyncLog.findFirst({
          where: {
            ...entityTypeFilter,
            status: KEKA_SYNC_STATUS.SUCCESS,
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        this.prisma.kekaSyncLog.findFirst({
          where: {
            ...entityTypeFilter,
            status: KEKA_SYNC_STATUS.FAILED,
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        this.prisma.kekaSyncLog.findFirst({
          where: entityTypeFilter,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        this.prisma.failedSyncRecord.count({
          where: {
            integration: KEKA_INTEGRATION,
            entityType: { in: entity.entityTypes },
            isResolved: false,
          },
        }),
        this.countLinkedRecords(entity.key),
      ]);

    let lastRunSucceeded = 0;
    let lastRunFailed = 0;

    if (lastAny) {
      const windowStart = new Date(
        lastAny.createdAt.getTime() - LAST_RUN_WINDOW_MS,
      );
      const groups = await this.prisma.kekaSyncLog.groupBy({
        by: ['status'],
        where: {
          ...entityTypeFilter,
          createdAt: {
            gte: windowStart,
            lte: lastAny.createdAt,
          },
        },
        _count: { _all: true },
      });

      for (const group of groups) {
        if (group.status === KEKA_SYNC_STATUS.SUCCESS) {
          lastRunSucceeded = group._count._all;
        } else if (group.status === KEKA_SYNC_STATUS.FAILED) {
          lastRunFailed = group._count._all;
        }
      }
    }

    return {
      key: entity.key,
      label: entity.label,
      entityTypes: entity.entityTypes,
      lastSuccessfulAt: lastSuccessful?.createdAt ?? null,
      lastFailedAt: lastFailed?.createdAt ?? null,
      lastRunAt: lastAny?.createdAt ?? null,
      lastRunSucceeded,
      lastRunFailed,
      unresolvedFailures,
      linkedRecordCount,
    };
  }

  private async countLinkedRecords(key: string): Promise<number> {
    switch (key) {
      case 'employee':
        return this.prisma.employee.count();
      case 'leave':
        return this.prisma.leaveRecord.count();
      case 'attendance':
        return this.prisma.attendanceRecord.count();
      case 'holidays':
        return this.prisma.holiday.count();
      case 'client':
        return this.prisma.customer.count({
          where: { kekaClientId: { not: null } },
        });
      case 'project':
        return this.prisma.project.count({
          where: { kekaProjectId: { not: null } },
        });
      case 'timesheet':
        return this.prisma.timesheetApproval.count({
          where: { kekaSyncedAt: { not: null } },
        });
      default:
        return 0;
    }
  }

  private buildSyncLogWhere(
    query: QueryKekaSyncLogsDto,
  ): Prisma.KekaSyncLogWhereInput {
    const search = query.search?.trim();

    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(search
        ? {
            OR: [
              { entityId: { contains: search, mode: 'insensitive' } },
              { errorMsg: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private buildFailedSyncWhere(
    query: QueryFailedSyncRecordsDto,
  ): Prisma.FailedSyncRecordWhereInput {
    const search = query.search?.trim();

    return {
      ...(query.integration ? { integration: query.integration } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.isResolved !== undefined ? { isResolved: query.isResolved } : {}),
      ...(search
        ? {
            OR: [
              { entityId: { contains: search, mode: 'insensitive' } },
              { errorMsg: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private mapFailedSyncRow(
    row: Prisma.FailedSyncRecordGetPayload<{
      include: { resolver: { select: { displayName: true } } };
    }>,
  ): FailedSyncRecordRowDto {
    return {
      id: row.id,
      integration: row.integration,
      entityType: row.entityType,
      entityId: row.entityId,
      direction: row.direction,
      errorMsg: row.errorMsg,
      retryCount: row.retryCount,
      isResolved: row.isResolved,
      resolvedByName: row.resolver?.displayName ?? null,
      resolvedAt: row.resolvedAt,
      lastAttempted: row.lastAttempted,
      createdAt: row.createdAt,
    };
  }
}

function parseDateOnly(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException({
      status: HttpStatus.BAD_REQUEST,
      errors: { date: 'invalidDate' },
    });
  }
  return parsed;
}

function stripToday(): Date {
  const today = new Date();
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
}

function daysAgo(end: Date, days: number): Date {
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}
