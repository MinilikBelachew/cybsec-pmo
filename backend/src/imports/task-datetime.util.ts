/**
 * Shared helpers for task start/end import cells (date or datetime).
 * Mirrors frontend `normalizeImportTaskDateTime` / export wall-clock format.
 */

/** Normalize import cell → ISO-8601. Date-only gets default local time. */
export function normalizeImportTaskDateTime(
  value?: string | Date | null,
  defaultHours = 9,
  defaultMinutes = 0,
): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toISOString();
  }

  const str = String(value).trim();
  if (!str) return '';

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (dateOnly) {
    const date = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
      defaultHours,
      defaultMinutes,
      0,
      0,
    );
    return date.toISOString();
  }

  const localDateTime =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(str);
  if (localDateTime) {
    const date = new Date(
      Number(localDateTime[1]),
      Number(localDateTime[2]) - 1,
      Number(localDateTime[3]),
      Number(localDateTime[4]),
      Number(localDateTime[5]),
      localDateTime[6] ? Number(localDateTime[6]) : 0,
      0,
    );
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

export function parseImportTaskDateTime(
  value?: string | Date | null,
  defaultHours = 9,
  defaultMinutes = 0,
): Date | null {
  const iso = normalizeImportTaskDateTime(value, defaultHours, defaultMinutes);
  if (!iso) return null;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
