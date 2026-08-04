export const TIMESHEET_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
} as const;

export type TimesheetStatus =
  (typeof TIMESHEET_STATUS)[keyof typeof TIMESHEET_STATUS];

/** Daily hours above this flag the week for manual approval (M2.4). */
export const TIMESHEET_DAILY_THRESHOLD_HOURS = 10;

/** Hard cap per day across all entries. */
export const TIMESHEET_DAILY_MAX_HOURS = 24;

/** Fallback default when settings cannot be read (M2.5). Live value comes from AppSetting. */
export const TIMESHEET_ESCALATION_DAYS = 3;

/** Max automatic Keka push retries per timesheet entry. */
export const TIMESHEET_KEKA_MAX_RETRIES = 3;

export const KEKA_INTEGRATION = 'keka';

/**
 * Projects that accept timesheet logging / submission.
 * Closed, Cancelled, On Hold, Pending Closure, Draft are blocked.
 */
export const TIMESHEET_LOGGABLE_PROJECT_STATUSES = [
  'Active',
  'At_Risk',
] as const;

/** Tasks in Done are treated as closed for logging. */
export const TIMESHEET_BLOCKED_TASK_STATUSES = ['Done'] as const;
