import { z } from "zod";

export const ALERT_EVENT_TYPES = [
  "RISK_SCORE_BREACHED",
  "ISSUE_ESCALATED",
] as const;

export const ALERT_CHANNELS = ["in_app", "email"] as const;

/** Roles allowed as escalation targets and for alert instances / acknowledge. */
export const ALERT_ESCALATION_ROLE_CODES = [
  "pm",
  "pmo_lead",
  "team_lead",
  "super_admin",
  "it_admin",
] as const;

export const ALERT_INSTANCE_ROLE_CODES = ALERT_ESCALATION_ROLE_CODES;

export const createAlertRuleSchema = z
  .object({
    eventType: z.enum(ALERT_EVENT_TYPES, {
      message: "Event type is required",
    }),
    scoreThreshold: z.coerce.number().int().min(1).optional(),
    channels: z
      .array(z.enum(ALERT_CHANNELS))
      .min(1, "Select at least one channel"),
    escalationRole: z
      .string()
      .trim()
      .min(1, "Escalation role is required")
      .max(50)
      .refine(
        (v) =>
          (ALERT_ESCALATION_ROLE_CODES as readonly string[]).includes(v),
        "Select a valid escalation role",
      ),
    reminderCadenceHrs: z.coerce
      .number({ message: "Reminder cadence is required" })
      .int()
      .min(1, "Must be at least 1 hour"),
    escalationDelayHrs: z.coerce
      .number({ message: "Escalation delay is required" })
      .int()
      .min(1, "Must be at least 1 hour"),
    recipientRoleIds: z
      .array(z.number().int())
      .min(1, "Select at least one recipient role"),
  })
  .superRefine((data, ctx) => {
    if (data.eventType === "RISK_SCORE_BREACHED") {
      if (data.scoreThreshold == null || Number.isNaN(data.scoreThreshold)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scoreThreshold"],
          message: "Threshold is required",
        });
      } else if (data.scoreThreshold < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scoreThreshold"],
          message: "Threshold must be at least 1",
        });
      }
    }
  });

export type AlertRuleFormValues = z.infer<typeof createAlertRuleSchema>;
