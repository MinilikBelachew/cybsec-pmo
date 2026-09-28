import { Prisma } from '@prisma/client';

/** Keys stored in ProjectCharter.incompleteFields that live on the Project, not the charter form. */
export const PROJECT_SETUP_INCOMPLETE_KEYS = [
  'department',
  'primaryPm',
  'engagementType',
  'billingModel',
  'customer',
] as const;

export type ProjectSetupIncompleteKey =
  (typeof PROJECT_SETUP_INCOMPLETE_KEYS)[number];

export type LatestCharterSlice = {
  id: string;
  status: string;
  sourceOrderId: string | null;
  incompleteFields?: Prisma.JsonValue | null;
};

export type CharterMeta = {
  charterStatus: string | null;
  hasPendingCharter: boolean;
  fromZohoBooks: boolean;
  incompleteFields: string[];
  hasIncompleteCharterData: boolean;
};

export function parseIncompleteFields(
  value: Prisma.JsonValue | null | undefined,
): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function charterMetaFromLatest(
  latest?: LatestCharterSlice | null,
): CharterMeta {
  const incompleteFields = parseIncompleteFields(latest?.incompleteFields);
  return {
    charterStatus: latest?.status ?? null,
    hasPendingCharter: latest?.status === 'Draft',
    fromZohoBooks: Boolean(latest?.sourceOrderId?.startsWith('zoho-so:')),
    incompleteFields,
    hasIncompleteCharterData: incompleteFields.length > 0,
  };
}

export function removeIncompleteKeys(
  current: string[],
  keysToRemove: readonly string[],
): string[] {
  const remove = new Set(keysToRemove);
  return current.filter((key) => !remove.has(key));
}

type CharterContentSnapshot = {
  purpose: string | null;
  successCriteria: string | null;
  scopeSummary: string | null;
  scopeExclusions: string | null;
  keyDeliverables: string | null;
  highLevelRisks: string | null;
  milestoneSchedule: string | null;
  valueSnapshot: Prisma.Decimal | number | null;
  resourceEstimates: string | null;
  stakeholders: string | null;
  pmAuthority: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  customerId: string | null;
};

function isBlank(value: string | null | undefined): boolean {
  return !value?.trim();
}

/** Recompute charter-content gaps; keep any project-setup flags still open. */
export function recomputeIncompleteFields(
  previous: string[],
  snapshot: CharterContentSnapshot,
): string[] {
  const projectSetup = previous.filter((key) =>
    (PROJECT_SETUP_INCOMPLETE_KEYS as readonly string[]).includes(key),
  );

  const content: string[] = [];
  if (isBlank(snapshot.purpose)) content.push('purpose');
  if (isBlank(snapshot.scopeSummary)) content.push('scope');
  if (isBlank(snapshot.successCriteria)) content.push('successCriteria');
  if (isBlank(snapshot.scopeExclusions)) content.push('scopeExclusions');
  if (isBlank(snapshot.keyDeliverables)) content.push('keyDeliverables');
  if (isBlank(snapshot.highLevelRisks)) content.push('highLevelRisks');
  if (isBlank(snapshot.milestoneSchedule)) content.push('milestoneSchedule');
  if (isBlank(snapshot.resourceEstimates)) content.push('resourceEstimates');
  if (isBlank(snapshot.pmAuthority)) content.push('pmAuthority');
  if (isBlank(snapshot.stakeholders)) content.push('stakeholders');
  if (!snapshot.startDate) content.push('startDate');
  if (!snapshot.endDate) content.push('endDate');
  if (snapshot.valueSnapshot == null) content.push('value');
  if (!snapshot.customerId) content.push('customer');

  return Array.from(new Set([...projectSetup, ...content]));
}
