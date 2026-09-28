import { Prisma } from '@prisma/client';

export type SowSnapshot = {
  customerName?: string | null;
  scope?: string | null;
  deliverables?: string | null;
  exclusions?: string | null;
  assumptions?: string | null;
  value?: string | null;
  currency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  billingModel?: string | null;
  engagementType?: string | null;
  approverSignatureName?: string | null;
};

export const SOW_SNAPSHOT_KEYS = [
  'customerName',
  'scope',
  'deliverables',
  'exclusions',
  'assumptions',
  'value',
  'currency',
  'startDate',
  'endDate',
  'billingModel',
  'engagementType',
  'approverSignatureName',
] as const satisfies readonly (keyof SowSnapshot)[];

const EMPTY_SNAPSHOT: SowSnapshot = {
  customerName: null,
  scope: null,
  deliverables: null,
  exclusions: null,
  assumptions: null,
  value: null,
  currency: null,
  startDate: null,
  endDate: null,
  billingModel: null,
  engagementType: null,
  approverSignatureName: null,
};

export function parseSowSnapshot(
  value: Prisma.JsonValue | null | undefined,
): SowSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_SNAPSHOT };
  }

  const record = value as Record<string, unknown>;
  const snapshot: SowSnapshot = { ...EMPTY_SNAPSHOT };
  for (const key of SOW_SNAPSHOT_KEYS) {
    const raw = record[key];
    snapshot[key] = typeof raw === 'string' ? raw : null;
  }
  return snapshot;
}

export function mergeSowSnapshot(
  current: SowSnapshot,
  patch: Partial<SowSnapshot>,
): SowSnapshot {
  const next: SowSnapshot = { ...current };
  for (const key of SOW_SNAPSHOT_KEYS) {
    if (patch[key] !== undefined) {
      next[key] = patch[key] ?? null;
    }
  }
  return next;
}

export function toSowSnapshotJson(
  snapshot: SowSnapshot,
): Prisma.InputJsonValue {
  const json: Record<string, string | null> = {};
  for (const key of SOW_SNAPSHOT_KEYS) {
    json[key] = snapshot[key] ?? null;
  }
  return json as Prisma.InputJsonValue;
}
