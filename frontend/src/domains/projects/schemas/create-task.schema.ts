import { z } from "zod";

export const createTaskSchema = z
  .object({
    projectId: z.string().uuid("Invalid project selected"),
    parentTaskId: z.string().uuid().nullable().optional(),
    title: z.string().min(1, "Title is required").max(255),
    description: z.string().optional(),
    priority: z.enum(["Low", "Medium", "High", "Critical"]),
    ownerId: z.string().uuid().nullable().optional(),
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
    effortHours: z.coerce.number().int().positive().optional().nullable(),
    status: z.enum([
      "To_Do",
      "In_Progress",
      "Submitted_for_Review",
      "Approved",
      "Rework",
      "Done",
    ]),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: "End date must be on or after start date",
      path: ["endDate"],
    }
  );

export type CreateTaskFormValues = z.infer<typeof createTaskSchema>;

export function toCreateTaskPayload(values: CreateTaskFormValues) {
  return {
    projectId: values.projectId,
    parentTaskId: values.parentTaskId || null,
    title: values.title,
    description: values.description || null,
    priority: values.priority,
    ownerId: values.ownerId || null,
    startDate: values.startDate ? values.startDate.toISOString().slice(0, 10) : null,
    endDate: values.endDate ? values.endDate.toISOString().slice(0, 10) : null,
    effortHours: values.effortHours || null,
    status: values.status,
  };
}
