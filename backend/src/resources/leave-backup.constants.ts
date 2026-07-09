export const LEAVE_BACKUP_QUEUE = 'leave-backup';

export const LEAVE_CONFLICT_CHECK_JOB = 'check-leave-conflicts';

export type LeaveConflictCheckJobPayload = {
  employeeIds?: string[];
  actorId?: string;
};
