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
  impact: z
    .number({ message: "Impact is required" })
    .int("Impact must be a whole number")
    .min(1, "Impact must be between 1 and 4")
    .max(4, "Impact must be between 1 and 4"),
  likelihood: z
    .number({ message: "Likelihood is required" })
    .int("Likelihood must be a whole number")
    .min(1, "Likelihood must be between 1 and 4")
    .max(4, "Likelihood must be between 1 and 4"),
  ownerId: z.string().uuid("Owner is required"),
  mitigationPlan: z.string().optional(),
  targetDate: z.date().optional().nullable(),
  residualImpact: z
    .number()
    .int("Residual impact must be a whole number")
    .min(1, "Residual impact must be between 1 and 4")
    .max(4, "Residual impact must be between 1 and 4")
    .optional()
    .nullable(),
  residualLikelihood: z
    .number()
    .int("Residual likelihood must be a whole number")
    .min(1, "Residual likelihood must be between 1 and 4")
    .max(4, "Residual likelihood must be between 1 and 4")
    .optional()
    .nullable(),
  status: z.enum(RISK_STATUS_OPTIONS),
});

export type RiskFormValues = z.infer<typeof createRiskSchema>;
