import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { KEKA_INTEGRATION } from '../../../timesheets/timesheets.constants';
import {
  KEKA_ENTITY_TYPE,
  KEKA_FAILED_SYNC_MAX_RETRIES,
  KEKA_SYNC_DIRECTION,
} from '../keka.constants';
import { AllocationPushService } from './allocation-push.service';
import { KekaSyncService } from './keka-sync.service';
import { TimesheetPushService } from './timesheet-push.service';

type RetrySummary = {
  attempted: number;
  succeeded: number;
  queuedInboundTypes: string[];
};

/**
 * Auto-retries unresolved Keka FailedSyncRecord rows:
 * - outbound timesheets / allocations (direct entity retry)
 * - inbound entity types (re-queue the matching sync job)
 */
@Injectable()
export class FailedSyncRetryService {
  private readonly logger = new Logger(FailedSyncRetryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly timesheetPushService: TimesheetPushService,
    private readonly allocationPushService: AllocationPushService,
    private readonly kekaSyncService: KekaSyncService,
  ) {}

  async retryPendingFailures(): Promise<RetrySummary> {
    const timesheetResult =
      await this.timesheetPushService.retryPendingFailedSyncs();

    const allocationResult = await this.retryPendingAllocations();
    const inboundResult = await this.retryPendingInbound();

    return {
      attempted:
        timesheetResult.attempted +
        allocationResult.attempted +
        inboundResult.attempted,
      succeeded:
        timesheetResult.succeeded +
        allocationResult.succeeded +
        inboundResult.succeeded,
      queuedInboundTypes: inboundResult.queuedInboundTypes,
    };
  }

  private async retryPendingAllocations(): Promise<{
    attempted: number;
    succeeded: number;
  }> {
    const failures = await this.prisma.failedSyncRecord.findMany({
      where: {
        integration: KEKA_INTEGRATION,
        entityType: KEKA_ENTITY_TYPE.ALLOCATION,
        isResolved: false,
        retryCount: { lt: KEKA_FAILED_SYNC_MAX_RETRIES },
      },
      orderBy: { lastAttempted: 'asc' },
      take: 25,
    });

    let succeeded = 0;

    for (const failure of failures) {
      if (!failure.entityId) continue;
      const ref = await this.allocationPushService.pushAllocation(
        failure.entityId,
      );
      if (ref) {
        succeeded += 1;
      }
    }

    return { attempted: failures.length, succeeded };
  }

  private async retryPendingInbound(): Promise<{
    attempted: number;
    succeeded: number;
    queuedInboundTypes: string[];
  }> {
    const failures = await this.prisma.failedSyncRecord.findMany({
      where: {
        integration: KEKA_INTEGRATION,
        isResolved: false,
        direction: KEKA_SYNC_DIRECTION.INBOUND,
        retryCount: { lt: KEKA_FAILED_SYNC_MAX_RETRIES },
        entityType: {
          notIn: [KEKA_ENTITY_TYPE.TIMESHEET, KEKA_ENTITY_TYPE.ALLOCATION],
        },
      },
      orderBy: { lastAttempted: 'asc' },
      take: 100,
      select: {
        id: true,
        entityType: true,
      },
    });

    if (failures.length === 0) {
      return { attempted: 0, succeeded: 0, queuedInboundTypes: [] };
    }

    const byType = new Map<string, string[]>();
    for (const failure of failures) {
      const ids = byType.get(failure.entityType) ?? [];
      ids.push(failure.id);
      byType.set(failure.entityType, ids);
    }

    const queuedInboundTypes: string[] = [];
    let succeeded = 0;
    const now = new Date();

    for (const [entityType, ids] of byType) {
      const queued = await this.enqueueInboundRetry(entityType);
      if (!queued) continue;

      queuedInboundTypes.push(entityType);
      await this.prisma.failedSyncRecord.updateMany({
        where: { id: { in: ids } },
        data: {
          lastAttempted: now,
          retryCount: { increment: 1 },
        },
      });
      // Queued job is the retry attempt; success is recorded when sync resolves the row.
      succeeded += ids.length;
    }

    return {
      attempted: failures.length,
      succeeded,
      queuedInboundTypes,
    };
  }

  private async enqueueInboundRetry(entityType: string): Promise<boolean> {
    switch (entityType) {
      case KEKA_ENTITY_TYPE.EMPLOYEE:
      case KEKA_ENTITY_TYPE.DEPARTMENT:
        await this.kekaSyncService.enqueueEmployeesSync();
        return true;
      case KEKA_ENTITY_TYPE.LEAVE:
        await this.kekaSyncService.enqueueLeaveSync();
        return true;
      case KEKA_ENTITY_TYPE.ATTENDANCE:
        await this.kekaSyncService.enqueueAttendanceSync();
        return true;
      case KEKA_ENTITY_TYPE.HOLIDAY:
      case KEKA_ENTITY_TYPE.HOLIDAY_CALENDAR:
        await this.kekaSyncService.enqueueHolidaysSync();
        return true;
      case KEKA_ENTITY_TYPE.SALARY:
      case KEKA_ENTITY_TYPE.PAY_CYCLE:
        await this.kekaSyncService.enqueueSalarySync();
        return true;
      case KEKA_ENTITY_TYPE.CLIENT:
        await this.kekaSyncService.enqueueClientsSync();
        return true;
      case KEKA_ENTITY_TYPE.PROJECT:
      case KEKA_ENTITY_TYPE.TASK:
        await this.kekaSyncService.enqueueProjectsSync();
        return true;
      default:
        this.logger.warn(
          `Inbound auto-retry skipped for unsupported entityType=${entityType}`,
        );
        return false;
    }
  }
}

@Injectable()
export class FailedSyncRetryScheduler {
  private readonly logger = new Logger(FailedSyncRetryScheduler.name);

  constructor(private readonly failedSyncRetryService: FailedSyncRetryService) {}

  @Cron(process.env.KEKA_FAILED_SYNC_RETRY_CRON ?? '15 * * * *')
  async handleRetries(): Promise<void> {
    try {
      const result = await this.failedSyncRetryService.retryPendingFailures();
      if (result.attempted > 0) {
        this.logger.log(
          `Keka failed-sync auto-retry: ${result.succeeded}/${result.attempted} progressed` +
            (result.queuedInboundTypes.length
              ? ` · inbound queued: ${result.queuedInboundTypes.join(', ')}`
              : ''),
        );
      }
    } catch (error) {
      this.logger.error(
        'Keka failed-sync auto-retry job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
