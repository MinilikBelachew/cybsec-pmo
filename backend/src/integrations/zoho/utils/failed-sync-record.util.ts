import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  ZOHO_FAILED_SYNC_MAX_RETRIES,
  ZOHO_FAILURE_CLASS,
  ZOHO_SYNC_DIRECTION,
} from '../zoho.constants';

type UpsertFailedSyncInput = {
  integration: string;
  entityType: string;
  entityId: string;
  direction?: string;
  errorMsg: string;
  retryCount?: number;
  payload?: Prisma.InputJsonValue;
  maxRetries?: number;
};

/**
 * Upserts an unresolved Zoho FailedSyncRecord and dead-letters when exhausted.
 */
export async function upsertZohoFailedSyncRecord(
  prisma: PrismaService,
  input: UpsertFailedSyncInput,
): Promise<void> {
  const now = new Date();
  const maxRetries = input.maxRetries ?? ZOHO_FAILED_SYNC_MAX_RETRIES;
  const failureClass = ZOHO_FAILURE_CLASS.TRANSIENT;

  const existing = await prisma.failedSyncRecord.findFirst({
    where: {
      integration: input.integration,
      entityType: input.entityType,
      entityId: input.entityId,
      isResolved: false,
    },
  });

  if (existing) {
    const retryCount = input.retryCount ?? existing.retryCount + 1;
    const deadLetteredAt = retryCount >= maxRetries ? now : null;

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
  const deadLetteredAt = retryCount >= maxRetries ? now : null;

  await prisma.failedSyncRecord.create({
    data: {
      integration: input.integration,
      entityType: input.entityType,
      entityId: input.entityId,
      direction: input.direction ?? ZOHO_SYNC_DIRECTION.INBOUND,
      errorMsg: input.errorMsg,
      retryCount,
      failureClass,
      deadLetteredAt,
      lastAttempted: now,
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
    },
  });
}

export async function prepareZohoFailedSyncForceRetry(
  prisma: PrismaService,
  failedSyncRecordId: string,
): Promise<void> {
  await prisma.failedSyncRecord.update({
    where: { id: failedSyncRecordId },
    data: {
      deadLetteredAt: null,
      failureClass: ZOHO_FAILURE_CLASS.TRANSIENT,
      retryCount: 0,
      lastAttempted: new Date(),
    },
  });
}

export async function resolveZohoFailedSyncRecord(
  prisma: PrismaService,
  input: {
    integration: string;
    entityType: string;
    entityId: string;
    resolvedBy?: string | null;
  },
): Promise<void> {
  await prisma.failedSyncRecord.updateMany({
    where: {
      integration: input.integration,
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

export function zohoAutoRetryEligibleWhere(
  integration: string,
  extra: Prisma.FailedSyncRecordWhereInput = {},
): Prisma.FailedSyncRecordWhereInput {
  return {
    integration,
    isResolved: false,
    deadLetteredAt: null,
    failureClass: ZOHO_FAILURE_CLASS.TRANSIENT,
    ...extra,
  };
}
