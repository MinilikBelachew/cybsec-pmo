/**
 * MSPDI timestamps are local wall-clock without an offset (`yyyy-MM-ddTHH:mm:ss`).
 * Date-only / UTC-midnight values keep the working-calendar defaults 08:00 / 17:00.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const UTC_MIDNIGHT = /^\d{4}-\d{2}-\d{2}T00:00:00(\.\d+)?(Z|[+-]00:00)?$/i;
const DEFAULT_ZONE = 'Africa/Nairobi';

export function resolveMspExportTimeZone(timeZone?: string | null): string {
  const candidate = String(timeZone || process.env.TZ || DEFAULT_ZONE).trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_ZONE;
  }
}

export function isDateOnlyMspValue(value?: Date | string | null): boolean {
  if (value == null || value === '') return false;
  if (value instanceof Date) {
    return (
      !Number.isNaN(value.getTime()) &&
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0
    );
  }
  const str = String(value).trim();
  return DATE_ONLY.test(str) || UTC_MIDNIGHT.test(str);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function calendarDayUtc(value: Date | string): string {
  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
    if (match) return match[1];
  }
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function formatInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

/** Microsoft Project XML timestamp. Date-only → 08:00 start / 17:00 finish. */
export function toMspdiDateTime(
  value?: Date | string | null,
  endOfDay = false,
  timeZone?: string | null,
): string {
  if (!value) return '';
  if (isDateOnlyMspValue(value)) {
    return `${calendarDayUtc(value)}T${endOfDay ? '17:00:00' : '08:00:00'}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatInTimeZone(date, resolveMspExportTimeZone(timeZone));
}

const WALL_CLOCK =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;

/**
 * Parse an MSPDI / MPP wall-clock stamp into a UTC Date.
 * Date-only values stay UTC midnight (legacy date-only). Timed values are
 * interpreted in `timeZone` (browser TZ, else Africa/Nairobi).
 */
export function fromMspdiDateTime(
  value?: string | null,
  timeZone?: string | null,
): Date | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();

  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const instant = new Date(trimmed);
    return Number.isNaN(instant.getTime()) ? undefined : instant;
  }

  const match = WALL_CLOCK.exec(trimmed);
  if (!match) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? undefined : fallback;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (match[4] == null) {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] != null ? Number(match[6]) : 0;
  return zonedWallClockToUtc(
    year,
    month,
    day,
    hour,
    minute,
    second,
    resolveMspExportTimeZone(timeZone),
  );
}

function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const wanted = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
  let utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 2; i += 1) {
    const shown = formatInTimeZone(new Date(utcGuess), timeZone);
    utcGuess += Date.parse(`${wanted}Z`) - Date.parse(`${shown}Z`);
  }
  return new Date(utcGuess);
}
