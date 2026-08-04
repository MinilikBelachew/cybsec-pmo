import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { KEKA_INTEGRATION } from '../../../timesheets/timesheets.constants';
import {
  KEKA_FAILED_SYNC_MAX_RETRIES,
  KEKA_FAILURE_CLASS,
  KEKA_SYNC_DIRECTION,
  KEKA_SYNC_STATUS,
} from '../keka.constants';
import { classifyKekaSyncError } from './classify-keka-sync-error.util';

type UpsertFailedSyncInput = {
  entityType: string;
  entityId: string;
  direction?: string;
  errorMsg: string;
  retryCount?: number;
  payload?: Prisma.InputJsonValue;
  /** Override auto-retry ceiling used for exhaustion dead-lettering. */
  maxRetries?: number;
  statusHint?: number;
};

/**
 * Upserts an unresolved FailedSyncRecord for admin "Failed records" recovery.
 * Classifies permanent vs transient and dead-letters permanent / exhausted rows.
 */
export async function upsertFailedSyncRecord(
  prisma: PrismaService,
  input: UpsertFailedSyncInput,
): Promise<void> {
  const now = new Date();
  const failureClass = classifyKekaSyncError(input.errorMsg, input.statusHint);
  const maxRetries = input.maxRetries ?? KEKA_FAILED_SYNC_MAX_RETRIES;

  const existing = await prisma.failedSyncRecord.findFirst({
    where: {
      integration: KEKA_INTEGRATION,
      entityType: input.entityType,
      entityId: input.entityId,
      isResolved: false,
    },
  });

  if (existing) {
    const retryCount = input.retryCount ?? existing.retryCount + 1;
    const deadLetteredAt =
      failureClass === KEKA_FAILURE_CLASS.PERMANENT || retryCount >= maxRetries
        ? now
        : null;

    await prisma.failedSyncRecord.update({
      where: { id: existing.id },
      data: {
        errorMsg: input.errorMsg,
        retryCount,
        failureClass,
        deadLetteredAt,
        lastAttempted: now,
        ...(input.payload !== undefined ? { payload: input.payload } : {}),
      },
    });
    return;
  }

  const retryCount = input.retryCount ?? 1;
  const deadLetteredAt =
    failureClass === KEKA_FAILURE_CLASS.PERMANENT || retryCount >= maxRetries
      ? now
      : null;

  await prisma.failedSyncRecord.create({
    data: {
      integration: KEKA_INTEGRATION,
      entityType: input.entityType,
      entityId: input.entityId,
      direction: input.direction ?? KEKA_SYNC_DIRECTION.INBOUND,
      errorMsg: input.errorMsg,
      retryCount,
      failureClass,
      deadLetteredAt,
      lastAttempted: now,
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
    },
  });
}

/**
 * Clear dead-letter state and reset retry window before an admin force retry.
 */
export async function prepareFailedSyncForceRetry(
  prisma: PrismaService,
  failedSyncRecordId: string,
): Promise<void> {
  await prisma.failedSyncRecord.update({
    where: { id: failedSyncRecordId },
    data: {
      deadLetteredAt: null,
      failureClass: KEKA_FAILURE_CLASS.TRANSIENT,
      retryCount: 0,
      lastAttempted: new Date(),
    },
  });
}

/**
 * Mark unresolved FailedSyncRecord rows resolved after a successful sync of
 * the same entity type + entity id (inbound or outbound).
 */
export async function resolveFailedSyncRecord(
  prisma: PrismaService,
  input: {
    entityType: string;
    entityId: string;
    resolvedBy?: string | null;
  },
): Promise<void> {
  await prisma.failedSyncRecord.updateMany({
    where: {
      integration: KEKA_INTEGRATION,
      entityType: input.entityType,
      entityId: input.entityId,
      isResolved: false,
    },
    data: {
      isResolved: true,
      resolvedAt: new Date(),
      ...(input.resolvedBy ? { resolvedBy: input.resolvedBy } : {}),
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

    const errorMsg = log.errorMsg ?? 'Keka sync failed';
    const failureClass = classifyKekaSyncError(errorMsg);
    const retryCount = log.retryCount;
    const deadLetteredAt =
      failureClass === KEKA_FAILURE_CLASS.PERMANENT ||
      retryCount >= KEKA_FAILED_SYNC_MAX_RETRIES
        ? log.createdAt
        : null;

    await prisma.failedSyncRecord.create({
      data: {
        integration: KEKA_INTEGRATION,
        entityType: log.entityType,
        entityId: log.entityId,
        direction: log.direction,
        errorMsg,
        retryCount,
        failureClass,
        deadLetteredAt,
        lastAttempted: log.createdAt,
        ...(log.payload !== null
          ? { payload: log.payload as Prisma.InputJsonValue }
          : {}),
      },
    });
  }
}

/** Shared Prisma filter for auto-retry-eligible unresolved rows. */
export function autoRetryEligibleWhere(
  extra: Prisma.FailedSyncRecordWhereInput = {},
): Prisma.FailedSyncRecordWhereInput {
  return {
    integration: KEKA_INTEGRATION,
    isResolved: false,
    deadLetteredAt: null,
    failureClass: KEKA_FAILURE_CLASS.TRANSIENT,
    ...extra,
  };
}
