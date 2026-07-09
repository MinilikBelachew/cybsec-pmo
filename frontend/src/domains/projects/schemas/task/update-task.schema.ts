import { z } from "zod";
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
      z.number().int().positive().optional()
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
    startDate: new Date(task.startDate),
    endDate: new Date(task.endDate),
    effortHours: task.effortHours ?? undefined,
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
    startDate: task.startDate ? new Date(task.startDate) : defaults.startDate,
    endDate: task.endDate ? new Date(task.endDate) : defaults.endDate,
    effortHours: task.effortHours ?? undefined,
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
    startDate: values.startDate.toISOString().slice(0, 10),
    endDate: values.endDate.toISOString().slice(0, 10),
    effortHours: values.effortHours ?? null,
    status: values.status,
  };
}
