import { z } from "zod";
import type { DefaultValues } from "react-hook-form";
import type { ReportType } from "../types/reports.types";

export const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
] as const;

export const reportScheduleFormSchema = z
  .object({
    reportType: z.enum(["WSR", "MSR"], {
      message: "Report type is required",
    }),
    projectId: z.string().trim().min(1, "Project is required"),
    roleIds: z
      .array(z.number().int().positive())
      .min(1, "Select at least one recipient role"),
    weekday: z.coerce.number().int().min(0).max(6).optional(),
    dayOfMonth: z.coerce.number().int().min(1).max(28).optional(),
    time: z
      .string({ message: "Time is required" })
      .trim()
      .min(1, "Time is required")
      .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Enter a valid time"),
  })
  .superRefine((data, ctx) => {
    if (data.reportType === "WSR" && (data.weekday === undefined || data.weekday === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["weekday"],
        message: "Day of week is required",
      });
    }
    if (
      data.reportType === "MSR" &&
      (data.dayOfMonth === undefined || data.dayOfMonth === null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["dayOfMonth"],
        message: "Day of month is required",
      });
    }
  });

export type ReportScheduleFormValues = z.infer<typeof reportScheduleFormSchema>;

export function emptyReportScheduleFormValues(): DefaultValues<ReportScheduleFormValues> {
  return {
    reportType: "WSR",
    projectId: "",
    roleIds: [],
    weekday: 1,
    dayOfMonth: 1,
    time: "09:00",
  };
}

export function buildCronExpression(values: ReportScheduleFormValues): string {
  const [hours, minutes] = values.time.split(":").map(Number);
  const minute = Number.isFinite(minutes) ? minutes : 0;
  const hour = Number.isFinite(hours) ? hours : 9;

  if (values.reportType === "WSR") {
    return `${minute} ${hour} * * ${values.weekday ?? 1}`;
  }

  return `${minute} ${hour} ${values.dayOfMonth ?? 1} * *`;
}

export function describeCronExpression(
  cronExpression: string,
  reportType?: ReportType | string,
): string {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5) return cronExpression;

  const [minuteRaw, hourRaw, dayOfMonth, , weekday] = parts;
  const minute = minuteRaw.padStart(2, "0");
  const hour = hourRaw.padStart(2, "0");
  const time = `${hour}:${minute}`;

  if (reportType === "WSR" || (dayOfMonth === "*" && weekday !== "*")) {
    const day =
      WEEKDAYS.find((entry) => String(entry.value) === weekday)?.label ??
      `day ${weekday}`;
    return `Every ${day} at ${time}`;
  }

  if (reportType === "MSR" || (dayOfMonth !== "*" && weekday === "*")) {
    const day = Number(dayOfMonth);
    const suffix =
      day === 1 || day === 21
        ? "st"
        : day === 2 || day === 22
          ? "nd"
          : day === 3 || day === 23
            ? "rd"
            : "th";
    return `Monthly on the ${day}${suffix} at ${time}`;
  }

  return cronExpression;
}
