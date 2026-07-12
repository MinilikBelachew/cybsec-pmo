import { createHash } from 'crypto';
import { LeaveRangeSummary } from '../../projects/utils/leave-summary.util';

export type DateRange = {
  from: string;
  to: string;
};

export function leaveImpactDedupeKey(
  taskId: string,
  leaveFrom: string,
  leaveTo: string,
): string {
  return `${taskId}:${leaveFrom}:${leaveTo}`;
}

/** Stable UUID for notification source_object_id (column is UUID-typed). */
export function leaveImpactSourceObjectId(
  taskId: string,
  leaveFrom: string,
  leaveTo: string,
): string {
  const hash = createHash('sha256')
    .update(leaveImpactDedupeKey(taskId, leaveFrom, leaveTo))
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x40;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDaysToKey(value: string, days: number): string {
  const date = parseDateKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export function rangesOverlap(
  left: DateRange,
  right: DateRange,
): boolean {
  return left.from <= right.to && left.to >= right.from;
}

export function countOverlapDays(
  left: DateRange,
  right: DateRange,
): number {
  if (!rangesOverlap(left, right)) {
    return 0;
  }

  const start =
    left.from > right.from ? left.from : right.from;
  const end = left.to < right.to ? left.to : right.to;

  let days = 0;
  let cursor = start;

  while (cursor <= end) {
    days += 1;
    cursor = addDaysToKey(cursor, 1);
  }

  return days;
}

export function isTaskCritical(
  priority: string,
  isOnCriticalPath: boolean,
): boolean {
  return priority === 'Critical' || isOnCriticalPath;
}

export function resolveTaskScheduleWindow(
  startDate: Date | null,
  endDate: Date | null,
): DateRange {
  const today = toDateKey(new Date());

  if (startDate && endDate) {
    return {
      from: toDateKey(startDate),
      to: toDateKey(endDate),
    };
  }

  if (startDate) {
    return {
      from: toDateKey(startDate),
      to: addDaysToKey(toDateKey(startDate), 14),
    };
  }

  if (endDate) {
    return {
      from: today,
      to: toDateKey(endDate),
    };
  }

  return {
    from: today,
    to: addDaysToKey(today, 30),
  };
}

export function findOverlappingApprovedLeave(
  leaveRanges: LeaveRangeSummary[],
  window: DateRange,
): LeaveRangeSummary[] {
  return leaveRanges.filter(
    (range) =>
      range.status === 'approved' && rangesOverlap(range, window),
  );
}

export function estimateScheduleDelayDays(
  overlapDays: number,
  taskWindow: DateRange,
  leaveRange: DateRange,
): number {
  if (overlapDays <= 0) {
    return 0;
  }

  const overlapEnd =
    taskWindow.to < leaveRange.to ? taskWindow.to : leaveRange.to;
  const daysToTaskEnd = countOverlapDays(
    { from: leaveRange.from, to: overlapEnd },
    taskWindow,
  );

  return Math.max(overlapDays, daysToTaskEnd > 0 ? overlapDays : 0);
}
