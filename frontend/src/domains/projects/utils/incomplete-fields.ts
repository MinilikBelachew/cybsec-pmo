/** Incomplete-field keys stored on ProjectCharter.incompleteFields */

export const PROJECT_SETUP_INCOMPLETE_KEYS = [
  "department",
  "primaryPm",
  "engagementType",
  "billingModel",
  "customer",
] as const;

export type ProjectSetupIncompleteKey =
  (typeof PROJECT_SETUP_INCOMPLETE_KEYS)[number];

const INCOMPLETE_FIELD_LABELS: Record<string, string> = {
  department: "Department",
  primaryPm: "Primary PM",
  engagementType: "Engagement type",
  billingModel: "Billing model",
  customer: "Customer",
  purpose: "Purpose",
  scope: "Scope",
  successCriteria: "Success criteria",
  scopeExclusions: "Scope exclusions",
  keyDeliverables: "Key deliverables",
  highLevelRisks: "High-level risks",
  milestoneSchedule: "Milestone schedule",
  resourceEstimates: "Resource estimates",
  pmAuthority: "PM authority",
  stakeholders: "Stakeholders",
  startDate: "Start date",
  endDate: "End date",
  value: "Value",
};

export function incompleteFieldLabel(key: string): string {
  return INCOMPLETE_FIELD_LABELS[key] ?? key;
}

export function isProjectSetupIncompleteKey(key: string): boolean {
  return (PROJECT_SETUP_INCOMPLETE_KEYS as readonly string[]).includes(key);
}
