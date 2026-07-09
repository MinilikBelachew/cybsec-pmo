export const KEKA_SYNC_QUEUE = 'keka-sync';

export const KEKA_SYNC_EMPLOYEES_JOB = 'sync-employees';
export const KEKA_SYNC_LEAVE_JOB = 'sync-leave';
export const KEKA_SYNC_ALL_JOB = 'sync-all';

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
  TIMESHEET: 'timesheet',
  ALLOCATION: 'allocation',
} as const;
