export const toDateString = (date?: Date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** ISO-8601 datetime for API payloads (preserves absolute instant). */
export const toDateTimeString = (date?: Date) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toISOString();
};

/** Excel/CSV-friendly local wall-clock: `YYYY-MM-DD HH:mm`. */
export const toExportDateTime = (value?: string | Date | null): string => {
  if (!value) return "";
  const date = value instanceof Date ? value : parseTaskDateTime(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
};

/**
 * Normalize an import cell to ISO-8601 for task start/end.
 * Accepts `YYYY-MM-DD`, `YYYY-MM-DD HH:mm`, `YYYY-MM-DDTHH:mm`, or full ISO.
 * Date-only values get `defaultHours:defaultMinutes` in local time.
 */
export const normalizeImportTaskDateTime = (
  value?: string | Date | null,
  defaultHours = 9,
  defaultMinutes = 0,
): string => {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString();
  }

  const str = String(value).trim();
  if (!str) return "";

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
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
};

/** `HH:mm` for `<input type="time" />` from a local Date. */
export const toTimeInputValue = (date?: Date | null) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

/** Apply `HH:mm` (or `HH:mm:ss`) onto a date, preserving the calendar day. */
export const applyTimeToDate = (
  date: Date,
  timeValue: string,
  fallbackHours = 0,
  fallbackMinutes = 0,
) => {
  const next = new Date(date);
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeValue.trim());
  if (!match) {
    next.setHours(fallbackHours, fallbackMinutes, 0, 0);
    return next;
  }
  next.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return next;
};

/** Keep time-of-day when the calendar day changes. */
export const mergeDateKeepingTime = (
  nextDay: Date,
  previous?: Date | null,
  fallbackHours = 9,
  fallbackMinutes = 0,
) => {
  const next = new Date(nextDay);
  if (previous && !Number.isNaN(previous.getTime())) {
    next.setHours(previous.getHours(), previous.getMinutes(), 0, 0);
  } else {
    next.setHours(fallbackHours, fallbackMinutes, 0, 0);
  }
  return next;
};

/**
 * Parse API date-only or datetime into a local Date.
 * Legacy date-only / UTC-midnight values become local midnight of that calendar day.
 */
export const parseTaskDateTime = (value: string | Date): Date => {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  const str = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 0, 0, 0, 0);
  }
  const localDateTime =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(str);
  if (localDateTime && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(str)) {
    return new Date(
      Number(localDateTime[1]),
      Number(localDateTime[2]) - 1,
      Number(localDateTime[3]),
      Number(localDateTime[4]),
      Number(localDateTime[5]),
      localDateTime[6] ? Number(localDateTime[6]) : 0,
      0,
    );
  }
  const midnightUtc = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(\.0+)?Z$/.exec(str);
  if (midnightUtc) {
    return new Date(
      Number(midnightUtc[1]),
      Number(midnightUtc[2]) - 1,
      Number(midnightUtc[3]),
      0,
      0,
      0,
      0,
    );
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
};

export const formatDateLabel = (dateStr?: string) => {
  if (!dateStr) return "Select date";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Select date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const formatDateTimeLabel = (
  value?: string | Date | null,
  options?: { fallback?: string; includeWeekday?: boolean },
) => {
  const fallback = options?.fallback ?? "Pick date & time";
  if (!value) return fallback;
  try {
    const date = value instanceof Date ? value : parseTaskDateTime(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleString("en-US", {
      ...(options?.includeWeekday ? { weekday: "long" as const } : {}),
      month: options?.includeWeekday ? "long" : "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return fallback;
  }
};

/** Compact list/board label: `MMM D, h:mm AM`. */
export const formatShortDateTime = (value?: string | Date | null) => {
  if (!value) return null;
  try {
    const date = value instanceof Date ? value : parseTaskDateTime(value);
    if (Number.isNaN(date.getTime())) return null;
    const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${day}, ${time}`;
  } catch {
    return null;
  }
};
