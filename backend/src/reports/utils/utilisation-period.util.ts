/** Calendar-date helpers that stay UTC-stable for DATE columns. */

export function stripDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function parseDateOnly(value: string): Date {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('invalidDate');
  }
  return date;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

export function eachDayInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = stripDate(start);
  const last = stripDate(end);
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function countWorkingDays(start: Date, end: Date): number {
  return eachDayInRange(start, end).filter(isWeekday).length;
}

export function countApprovedLeaveDays(
  leaveDates: Date[],
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const start = stripDate(rangeStart).getTime();
  const end = stripDate(rangeEnd).getTime();
  const seen = new Set<string>();

  for (const leaveDate of leaveDates) {
    const day = stripDate(leaveDate);
    const dayTime = day.getTime();
    if (dayTime >= start && dayTime <= end && isWeekday(day)) {
      seen.add(formatDateOnly(day));
    }
  }

  return seen.size;
}

export function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumTimesheetHours(
  regularHours: number,
  overtimeHours: number,
): number {
  return roundHours(regularHours + overtimeHours);
}

export type UtilisationStatus = 'over' | 'optimal' | 'under';

export function resolveUtilisationStatus(
  billableUtilisationPercent: number,
): UtilisationStatus {
  if (billableUtilisationPercent >= 90) {
    return 'over';
  }
  if (billableUtilisationPercent >= 50) {
    return 'optimal';
  }
  return 'under';
}
