export function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('invalidDate');
  }
  return date;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Monday-based week start (UTC). */
export function getWeekStart(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  const day = normalized.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setUTCDate(normalized.getUTCDate() + diff);
  return normalized;
}

export function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);
  return end;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function formatWeekLabel(weekStart: Date, weekEnd: Date): string {
  const startMonth = weekStart.toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
  const endMonth = weekEnd.toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
  const startDay = weekStart.getUTCDate();
  const endDay = weekEnd.getUTCDate();
  const year = weekEnd.getUTCFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} – ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

export function formatDayTabLabel(date: Date): string {
  const weekday = date.toLocaleString('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  });
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = date.getUTCDate();
  return `${weekday} ${month} ${day}`;
}
