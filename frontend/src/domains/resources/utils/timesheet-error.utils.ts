export function getTodayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseHoursInput(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function sanitizeHoursInput(value: string): string {
  if (value === "" || value === ".") return value;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  if (parsed < 0) return "0";
  return value;
}

export type EntryHoursFieldErrors = {
  regular?: string;
  overtime?: string;
};

export function validateEntryHours(
  regularHours: string,
  overtimeHours: string,
): EntryHoursFieldErrors {
  const errors: EntryHoursFieldErrors = {};
  const regular = parseHoursInput(regularHours);
  const overtime = parseHoursInput(overtimeHours);

  if (regular === null && regularHours.trim() !== "") {
    errors.regular = "Regular hours must be a valid number.";
  }
  if (overtime === null && overtimeHours.trim() !== "") {
    errors.overtime = "Overtime hours must be a valid number.";
  }

  const regularValue = regular ?? 0;
  const overtimeValue = overtime ?? 0;

  if (regularValue < 0) {
    errors.regular = "Hours cannot be negative.";
  }
  if (overtimeValue < 0) {
    errors.overtime = "Hours cannot be negative.";
  }

  const total = regularValue + overtimeValue;
  if (regularHours.trim() === "" && overtimeHours.trim() === "") {
    errors.regular = "Enter regular or overtime hours.";
  } else if (total <= 0) {
    errors.regular = "Total hours must be greater than zero.";
  } else if (total > 24) {
    errors.regular = "Total hours cannot exceed 24 per entry.";
  }

  return errors;
}

export function hasEntryHoursErrors(errors: EntryHoursFieldErrors): boolean {
  return Boolean(errors.regular || errors.overtime);
}
