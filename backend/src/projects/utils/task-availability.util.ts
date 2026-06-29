export function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isDateRangeOverlapping(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return stripTime(aStart) <= stripTime(bEnd) && stripTime(bStart) <= stripTime(aEnd);
}

export function weeksInDateRange(start: Date, end: Date): number {
  const startDay = stripTime(start);
  const endDay = stripTime(end);
  const diffMs = endDay.getTime() - startDay.getTime();
  const days = Math.floor(diffMs / 86400000) + 1;
  return Math.max(1, days / 7);
}

export function taskWeeklyHoursFromEffort(
  effortHours: number,
  startDate: Date,
  endDate: Date,
): number {
  return effortHours / weeksInDateRange(startDate, endDate);
}

export function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}
