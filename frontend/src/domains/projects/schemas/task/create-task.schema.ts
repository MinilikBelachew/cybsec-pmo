import { z } from "zod";
import {
  requiredTaskDate,
  taskEndDateAfterStartDate,
} from "./task-date-fields";

const emptyToNull = (val: unknown) =>
  val === "" || val === "none" || val === null || val === undefined ? null : val;

export const createTaskSchema = z
  .object({
    projectId: z.string().uuid("Invalid project selected"),
    parentTaskId: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
    phaseId: z.string().uuid("Please select a phase"),
    title: z.string().min(1, "Title is required").max(255),
    description: z.string().optional(),
    priority: z.enum(["Low", "Medium", "High", "Critical"]),
    ownerId: z.preprocess(emptyToNull, z.string().uuid().nullable().optional()),
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

export type CreateTaskFormValues = z.infer<typeof createTaskSchema>;

export function toCreateTaskPayload(values: CreateTaskFormValues) {
  return {
    projectId: values.projectId,
    parentTaskId: values.parentTaskId || null,
    phaseId: values.phaseId,
    title: values.title,
    description: values.description || null,
    priority: values.priority,
    ownerId: values.ownerId || null,
    startDate: values.startDate.toISOString().slice(0, 10),
    endDate: values.endDate.toISOString().slice(0, 10),
    effortHours: values.effortHours ?? null,
    status: values.status,
  };
}
