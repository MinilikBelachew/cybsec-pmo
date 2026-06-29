import { z } from "zod";

export const milestoneSchema = z.object({
  title: z.string().min(1, "Milestone title is required").max(255, "Title is too long"),
  targetDate: z.string().min(1, "Target date is required"),
  weight: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
    z.number().int().min(0).max(100).nullable().optional()
  ),
  status: z.string().min(1, "Status is required"),
  phaseId: z.string().min(1, "Phase association is required"),
});

export type MilestoneFormValues = z.infer<typeof milestoneSchema>;
