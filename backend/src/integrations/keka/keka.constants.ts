export const KEKA_SYNC_QUEUE = 'keka-sync';

export const KEKA_SYNC_EMPLOYEES_JOB = 'sync-employees';
export const KEKA_SYNC_LEAVE_JOB = 'sync-leave';
export const KEKA_SYNC_ATTENDANCE_JOB = 'sync-attendance';
export const KEKA_SYNC_HOLIDAYS_JOB = 'sync-holidays';
export const KEKA_SYNC_SALARY_JOB = 'sync-salary';
export const KEKA_SYNC_PROJECTS_JOB = 'sync-projects';
export const KEKA_SYNC_CLIENTS_JOB = 'sync-clients';
export const KEKA_SYNC_ALL_JOB = 'sync-all';

/** https://developers.keka.com/reference/rate-limit — 50 requests / 60s window */
export const KEKA_RATE_LIMIT_PER_MINUTE = 50;
export const KEKA_RATE_LIMIT_WINDOW_MS = 60_000;
export const KEKA_RATE_LIMIT_MAX_RETRIES = 3;

export const KEKA_SYNC_DIRECTION = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

export const KEKA_SYNC_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PENDING: 'pending',
} as const;

export const KEKA_ENTITY_TYPE = {
  DEPARTMENT: 'department',
  EMPLOYEE: 'employee',
  LEAVE: 'leave',
  ATTENDANCE: 'attendance',
  HOLIDAY: 'holiday',
  HOLIDAY_CALENDAR: 'holiday_calendar',
  SALARY: 'salary',
  PAY_CYCLE: 'pay_cycle',
  PROJECT: 'project',
  TASK: 'task',
  CLIENT: 'client',
  TIMESHEET: 'timesheet',
  ALLOCATION: 'allocation',
} as const;
