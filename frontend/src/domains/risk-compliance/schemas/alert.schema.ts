import { z } from "zod";

export const ALERT_EVENT_TYPES = [
  "RISK_SCORE_BREACHED",
  "ISSUE_ESCALATED",
  "ALERT_FIRED",
  "ALERT_ESCALATED",
] as const;

export const ALERT_CHANNELS = ["in_app", "email"] as const;

export const createAlertRuleSchema = z.object({
  eventType: z.enum(ALERT_EVENT_TYPES, {
    message: "Event type is required",
  }),
  scoreThreshold: z.coerce
    .number({ message: "Threshold is required" })
    .int()
    .min(1, "Threshold must be at least 1"),
  channels: z
    .array(z.enum(ALERT_CHANNELS))
    .min(1, "Select at least one channel"),
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
