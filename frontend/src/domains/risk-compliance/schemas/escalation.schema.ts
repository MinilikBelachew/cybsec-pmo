import { z } from "zod";

export const createEscalationSchema = z.object({
  customerId: z.string().uuid("Customer is required"),
  severity: z.enum(["Low", "Medium", "High", "Critical"]),
  slaTargetHrs: z.coerce
    .number({ message: "SLA hours is required" })
    .int()
    .min(1, "SLA must be at least 1 hour"),
  ownerId: z.string().uuid("Owner is required"),
  initialCommunication: z.string().optional(),
  initialChannel: z.enum(["Call", "Email", "Meeting", "Chat", "Other"]),
});

export type EscalationFormValues = z.infer<typeof createEscalationSchema>;

export const closeEscalationSchema = z.object({
  resolutionSummary: z
    .string()
    .trim()
    .min(1, "Resolution summary is required")
    .max(2000),
});

export type CloseEscalationFormValues = z.infer<typeof closeEscalationSchema>;

export const escalationCommunicationSchema = z.object({
  channel: z.enum(["Call", "Email", "Meeting", "Chat", "Other"]),
  content: z.string().trim().min(1, "Communication content is required").max(5000),
});

export type EscalationCommunicationFormValues = z.infer<
  typeof escalationCommunicationSchema
>;
