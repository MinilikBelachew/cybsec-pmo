import { z } from "zod";

export const RISK_STATUS_OPTIONS = [
  "Open",
  "Mitigating",
  "Accepted",
  "Closed",
  "Cancelled",
] as const;

export const RISK_CATEGORY_OPTIONS = [
  "TECHNICAL",
  "SCHEDULE",
  "RESOURCE",
  "FINANCIAL",
  "COMPLIANCE",
  "EXTERNAL",
  "OTHER",
] as const;

export const createRiskSchema = z.object({
  projectId: z.string().uuid("Project is required"),
  title: z.string().trim().min(1, "Title is required").max(255),
  category: z.string().trim().min(1, "Category is required").max(100),
  impact: z.number().int().min(1).max(4),
  likelihood: z.number().int().min(1).max(4),
  ownerId: z.string().uuid("Owner is required"),
  mitigationPlan: z.string().optional(),
  targetDate: z.date().optional().nullable(),
  residualImpact: z.number().int().min(1).max(4).optional().nullable(),
  residualLikelihood: z.number().int().min(1).max(4).optional().nullable(),
  status: z.enum(RISK_STATUS_OPTIONS),
});

export type RiskFormValues = z.infer<typeof createRiskSchema>;
