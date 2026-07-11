import { z } from "zod";
import { toDateString } from "@/shared/utils/date";

/** Coerces form values to Date; rejects empty/missing values. */
export const requiredTaskDate = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  z.coerce.date({ message: "Date is required" }),
);

export function taskEndDateAfterStartDate(data: {
  startDate?: Date;
  endDate?: Date;
}): boolean {
  if (data.startDate && data.endDate) {
    return data.endDate >= data.startDate;
  }
  return true;
}

export function defaultTaskDateRange() {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);
  return { startDate, endDate };
}

export function toTaskDayKey(value?: string | Date | null): string {
  if (!value) return "";
  if (value instanceof Date) return toDateString(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : toDateString(parsed);
}

export function formatTaskDayLabel(ymd: string): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function taskDatesOutsidePhaseErrors(options: {
  start?: Date | null;
  end?: Date | null;
  phaseStart?: string | Date | null;
  phaseEnd?: string | Date | null;
}): { startDate?: string; endDate?: string } {
  const phaseStartYmd = toTaskDayKey(options.phaseStart);
  const phaseEndYmd = toTaskDayKey(options.phaseEnd);
  const next: { startDate?: string; endDate?: string } = {};
  if (!phaseStartYmd && !phaseEndYmd) return next;

  if (options.start) {
    const startKey = toTaskDayKey(options.start);
    if (phaseStartYmd && startKey < phaseStartYmd) {
      next.startDate = `Start date must be on or after phase start (${formatTaskDayLabel(phaseStartYmd)})`;
    } else if (phaseEndYmd && startKey > phaseEndYmd) {
      next.startDate = `Start date must be on or before phase end (${formatTaskDayLabel(phaseEndYmd)})`;
    }
  }

  if (options.end) {
    const endKey = toTaskDayKey(options.end);
    if (phaseEndYmd && endKey > phaseEndYmd) {
      next.endDate = `End date must be on or before phase end (${formatTaskDayLabel(phaseEndYmd)})`;
    } else if (phaseStartYmd && endKey < phaseStartYmd) {
      next.endDate = `End date must be on or after phase start (${formatTaskDayLabel(phaseStartYmd)})`;
    }
  }

  return next;
}

/** DEF-P1-013 — sub-task dates must stay within the parent task range. */
export function taskDatesOutsideParentErrors(options: {
  start?: Date | null;
  end?: Date | null;
  parentStart?: string | Date | null;
  parentEnd?: string | Date | null;
}): { startDate?: string; endDate?: string } {
  const parentStartYmd = toTaskDayKey(options.parentStart);
  const parentEndYmd = toTaskDayKey(options.parentEnd);
  const next: { startDate?: string; endDate?: string } = {};
  if (!parentStartYmd && !parentEndYmd) return next;

  if (options.start) {
    const startKey = toTaskDayKey(options.start);
    if (parentStartYmd && startKey < parentStartYmd) {
      next.startDate = `Start date must be on or after parent start (${formatTaskDayLabel(parentStartYmd)})`;
    } else if (parentEndYmd && startKey > parentEndYmd) {
      next.startDate = `Start date must be on or before parent end (${formatTaskDayLabel(parentEndYmd)})`;
    }
  }

  if (options.end) {
    const endKey = toTaskDayKey(options.end);
    if (parentEndYmd && endKey > parentEndYmd) {
      next.endDate = `End date must be on or before parent end (${formatTaskDayLabel(parentEndYmd)})`;
    } else if (parentStartYmd && endKey < parentStartYmd) {
      next.endDate = `End date must be on or after parent start (${formatTaskDayLabel(parentStartYmd)})`;
    }
  }

  return next;
}
