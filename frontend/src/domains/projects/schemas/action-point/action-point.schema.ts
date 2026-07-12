import { z } from "zod";

function parseDateOnly(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim());
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateLabel(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : parseDateOnly(value);
  if (!date || Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDayKey(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const requiredDueDate = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  z.coerce.date({ message: "Due date is required" }),
);

export function createActionPointSchema(options?: {
  projectStartDate?: string | Date | null;
  projectEndDate?: string | Date | null;
}) {
  const projectStart = options?.projectStartDate
    ? parseDateOnly(
        options.projectStartDate instanceof Date
          ? options.projectStartDate
          : String(options.projectStartDate).slice(0, 10),
      )
    : null;
  const projectEnd = options?.projectEndDate
    ? parseDateOnly(
        options.projectEndDate instanceof Date
          ? options.projectEndDate
          : String(options.projectEndDate).slice(0, 10),
      )
    : null;

  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, "Name is required")
        .max(255, "Name is too long"),
      ownerId: z
        .string()
        .min(1, "Owner is required")
        .uuid("Owner is required"),
      dueDate: requiredDueDate,
      priority: z.enum(["Low", "Medium", "High", "Critical"]),
    })
    .superRefine((data, ctx) => {
      if (!(data.dueDate instanceof Date) || Number.isNaN(data.dueDate.getTime())) {
        return;
      }
      const dueKey = toDayKey(data.dueDate);
      if (projectStart) {
        const startKey = toDayKey(projectStart);
        if (dueKey < startKey) {
          ctx.addIssue({
            code: "custom",
            path: ["dueDate"],
            message: `Due date cannot be before the project start date (${formatDateLabel(projectStart)})`,
          });
        }
      }
      if (projectEnd) {
        const endKey = toDayKey(projectEnd);
        if (dueKey > endKey) {
          ctx.addIssue({
            code: "custom",
            path: ["dueDate"],
            message: `Due date cannot be after the project end date (${formatDateLabel(projectEnd)})`,
          });
        }
      }
    });
}

export type ActionPointFormValues = z.infer<ReturnType<typeof createActionPointSchema>>;
