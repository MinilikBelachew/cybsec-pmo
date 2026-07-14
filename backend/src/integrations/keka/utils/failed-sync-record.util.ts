import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { KEKA_INTEGRATION } from '../../../timesheets/timesheets.constants';
import {
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';

type UpsertFailedSyncInput = {
  entityType: string;
  entityId: string;
  direction?: string;
  errorMsg: string;
  retryCount?: number;
  payload?: Prisma.InputJsonValue;
};

/**
 * Upserts an unresolved FailedSyncRecord for admin "Failed records" recovery.
 * Call whenever a Keka sync attempt fails (inbound or outbound).
 */
export async function upsertFailedSyncRecord(
  prisma: PrismaService,
  input: UpsertFailedSyncInput,
): Promise<void> {
  const now = new Date();
  const existing = await prisma.failedSyncRecord.findFirst({
    where: {
      integration: KEKA_INTEGRATION,
      entityType: input.entityType,
      entityId: input.entityId,
      isResolved: false,
    },
  });

  if (existing) {
    await prisma.failedSyncRecord.update({
      where: { id: existing.id },
      data: {
        errorMsg: input.errorMsg,
        retryCount: input.retryCount ?? existing.retryCount + 1,
        lastAttempted: now,
        ...(input.payload !== undefined ? { payload: input.payload } : {}),
      },
    });
    return;
  }

  await prisma.failedSyncRecord.create({
    data: {
      integration: KEKA_INTEGRATION,
      entityType: input.entityType,
      entityId: input.entityId,
      direction: input.direction ?? KEKA_SYNC_DIRECTION.INBOUND,
      errorMsg: input.errorMsg,
      retryCount: input.retryCount ?? 1,
      lastAttempted: now,
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
    },
  });
}

/**
 * Backfill FailedSyncRecord rows from failed KekaSyncLog entries so the
 * Failed records tab shows inbound sync failures that only wrote to the log.
 */
export async function backfillFailedRecordsFromSyncLogs(
  prisma: PrismaService,
): Promise<void> {
  const failedLogs = await prisma.kekaSyncLog.findMany({
    where: { status: KEKA_SYNC_STATUS.FAILED },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      entityType: true,
      entityId: true,
      direction: true,
      errorMsg: true,
      retryCount: true,
      payload: true,
      createdAt: true,
    },
  });

  const seen = new Set<string>();

  for (const log of failedLogs) {
    const key = `${log.entityType}:${log.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const existing = await prisma.failedSyncRecord.findFirst({
      where: {
        integration: KEKA_INTEGRATION,
        entityType: log.entityType,
        entityId: log.entityId,
        isResolved: false,
      },
      select: { id: true },
    });

    if (existing) continue;

    await prisma.failedSyncRecord.create({
      data: {
        integration: KEKA_INTEGRATION,
        entityType: log.entityType,
        entityId: log.entityId,
        direction: log.direction,
        errorMsg: log.errorMsg ?? 'Keka sync failed',
        retryCount: log.retryCount,
        lastAttempted: log.createdAt,
        ...(log.payload !== null
          ? { payload: log.payload as Prisma.InputJsonValue }
          : {}),
      },
    });
  }
}
