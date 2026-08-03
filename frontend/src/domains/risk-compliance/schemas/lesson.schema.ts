import { z } from "zod";

export const LESSON_CATEGORIES = [
  "DEPLOYMENT",
  "SECURITY",
  "PROCESS",
  "COMMUNICATION",
  "TECHNICAL",
  "OTHER",
] as const;

export const createLessonSchema = z.object({
  category: z.enum(LESSON_CATEGORIES),
  description: z
    .string()
    .trim()
    .min(1, "Context / description is required")
    .max(4000),
  recommendation: z
    .string()
    .trim()
    .min(1, "Recommendation is required")
    .max(4000),
  tags: z.string().optional(),
  projectId: z.string().optional(),
});

export type LessonFormValues = z.infer<typeof createLessonSchema>;
