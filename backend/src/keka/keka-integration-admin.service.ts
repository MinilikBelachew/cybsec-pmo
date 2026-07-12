import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AllocationPushService } from './sync/allocation-push.service';
import { KekaSyncService } from './sync/keka-sync.service';
import { TimesheetPushService } from './sync/timesheet-push.service';
import {
  FailedSyncRecordListResponseDto,
  FailedSyncRecordRowDto,
  KekaSyncLogListResponseDto,
  KekaSyncLogRowDto,
  QueryFailedSyncRecordsDto,
  QueryKekaSyncLogsDto,
  RetryKekaSyncResultDto,
} from './dto/keka-integration.dto';
import { KEKA_ENTITY_TYPE } from './keka.constants';

@Injectable()
export class KekaIntegrationAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timesheetPushService: TimesheetPushService,
    private readonly allocationPushService: AllocationPushService,
    private readonly kekaSyncService: KekaSyncService,
  ) {}

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
      default:
        throw new BadRequestException({
          status: HttpStatus.BAD_REQUEST,
          errors: { entityType: 'retryNotSupported' },
        });
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
