import { z } from "zod";
import { toDateString } from "@/shared/utils/date";
import type { Task } from "../../types/tasks.types";
import {
  requiredTaskDate,
  taskEndDateAfterStartDate,
  defaultTaskDateRange,
} from "./task-date-fields";

const emptyToNull = (val: unknown) =>
  val === "" || val === "none" || val === null || val === undefined ? null : val;

export const updateTaskSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(255),
    description: z.string().optional(),
    priority: z.enum(["Low", "Medium", "High", "Critical"]),
    ownerId: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
    backupOwnerId: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
    phaseId: z.string().uuid("Please select a phase"),
    startDate: requiredTaskDate,
    endDate: requiredTaskDate,
    effortHours: z.preprocess(
      (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
      z
        .number({ message: "Effort hours is required" })
        .int("Effort must be a whole number")
        .positive("Effort must be greater than 0")
    ),
    status: z.enum([
      "To_Do",
      "In_Progress",
      "Submitted_for_Review",
      "Approved",
      "Rework",
      "Done",
    ]),
  })
  .refine(taskEndDateAfterStartDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export type UpdateTaskFormValues = z.infer<typeof updateTaskSchema>;


/** Parse API date-only / ISO as local calendar day (avoid UTC shift). */
function parseTaskDateLocal(value: string | Date): Date {
  const key =
    value instanceof Date
      ? `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`
      : String(value).slice(0, 10);
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function taskToFormValues(task: Task): UpdateTaskFormValues {
  if (!task.startDate || !task.endDate) {
    throw new Error("Task is missing required dates");
  }

  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    ownerId: task.ownerId,
    backupOwnerId: task.backupOwnerId ?? null,
    phaseId: task.phaseId ?? "",
    startDate: parseTaskDateLocal(task.startDate),
    endDate: parseTaskDateLocal(task.endDate),
    effortHours: task.effortHours ?? 1,
    status: task.status,
  };
}

export function taskToFormValuesOrDefaults(task: Task): UpdateTaskFormValues {
  const defaults = defaultTaskDateRange();

  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    ownerId: task.ownerId,
    backupOwnerId: task.backupOwnerId ?? null,
    phaseId: task.phaseId ?? "",
    startDate: task.startDate ? parseTaskDateLocal(task.startDate) : defaults.startDate,
    endDate: task.endDate ? parseTaskDateLocal(task.endDate) : defaults.endDate,
    effortHours: task.effortHours ?? 1,
    status: task.status,
  };
}

export function toUpdateTaskPayload(values: UpdateTaskFormValues) {
  return {
    title: values.title,
    description: values.description || null,
    priority: values.priority,
    ownerId: values.ownerId || null,
    backupOwnerId: values.backupOwnerId || null,
    phaseId: values.phaseId,
    startDate: toDateString(values.startDate),
    endDate: toDateString(values.endDate),
    effortHours: values.effortHours,
    status: values.status,
  };
}
