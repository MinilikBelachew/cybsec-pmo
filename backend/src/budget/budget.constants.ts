export const BUDGET_REVISION_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
} as const;

export type BudgetRevisionStatus =
  (typeof BUDGET_REVISION_STATUS)[keyof typeof BUDGET_REVISION_STATUS];

export const BUDGET_ADJUSTMENT_STATUS = BUDGET_REVISION_STATUS;

export const BUDGET_ADJUSTMENT_TARGET = {
  LINE_ACTUAL: 'LineActual',
  LINE_PLANNED: 'LinePlanned',
  BASELINE: 'Baseline',
} as const;

export type BudgetAdjustmentTarget =
  (typeof BUDGET_ADJUSTMENT_TARGET)[keyof typeof BUDGET_ADJUSTMENT_TARGET];

export const BUDGET_ADJUSTMENT_TARGETS = Object.values(BUDGET_ADJUSTMENT_TARGET);

export const BUDGET_LINE_CATEGORY = {
  RESOURCE: 'Resource',
  TRAVEL: 'Travel',
  SOFTWARE: 'Software',
  SUBCONTRACT: 'Subcontract',
  OTHER: 'Other',
} as const;

export type BudgetLineCategory =
  (typeof BUDGET_LINE_CATEGORY)[keyof typeof BUDGET_LINE_CATEGORY];

export const BUDGET_LINE_CATEGORIES = Object.values(BUDGET_LINE_CATEGORY);

/** Default overrun adherence % (actual / expected * 100). */
export const DEFAULT_BUDGET_OVERRUN_THRESHOLD_PCT = 100;
export const DEFAULT_BUDGET_WARNING_THRESHOLD_PCT = 80;
