import { z } from "zod";

export const createAlertRuleSchema = z.object({
  eventType: z.string().trim().min(1, "Event type is required").max(100),
  scoreThreshold: z.coerce
    .number({ message: "Threshold is required" })
    .int()
    .min(1, "Threshold must be at least 1"),
  channels: z
    .string()
    .trim()
    .min(1, "At least one channel is required")
    .refine(
      (value) =>
        value
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean).length > 0,
      "At least one channel is required",
    ),
  escalationRole: z
    .string()
    .trim()
    .min(1, "Escalation role is required")
    .max(50),
  reminderCadenceHrs: z.coerce
    .number({ message: "Reminder cadence is required" })
    .int()
    .min(1, "Must be at least 1 hour"),
  escalationDelayHrs: z.coerce
    .number({ message: "Escalation delay is required" })
    .int()
    .min(1, "Must be at least 1 hour"),
  recipientRoleIds: z.array(z.number().int()).default([]),
});

export type AlertRuleFormValues = z.infer<typeof createAlertRuleSchema>;
