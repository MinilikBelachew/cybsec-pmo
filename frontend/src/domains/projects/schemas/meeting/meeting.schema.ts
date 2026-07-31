import { z } from "zod";
import type { DefaultValues } from "react-hook-form";

const listItemSchema = z.object({
  content: z.string(),
});

const actionItemSchema = z.object({
  content: z.string(),
  ownerId: z.string(),
});

export const meetingFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(255, "Title is too long"),
    meetingType: z
      .string()
      .trim()
      .min(1, "Meeting type is required"),
    scheduledDate: z.preprocess(
      (val) => (val === "" || val === null || val === undefined ? undefined : val),
      z.coerce.date({ message: "Scheduled date is required" }),
    ),
    scheduledTime: z
      .string()
      .min(1, "Scheduled time is required")
      .regex(/^\d{2}:\d{2}$/, "Scheduled time is required"),
    attendeeIds: z.array(z.string()),
    agenda: z.array(listItemSchema).min(1),
    decisions: z.array(listItemSchema).min(1),
    actions: z.array(actionItemSchema).min(1),
  })
  .superRefine((data, ctx) => {
    data.actions.forEach((action, index) => {
      if (action.content.trim() && !action.ownerId.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["actions", index, "ownerId"],
          message: "Owner is required when an action point is provided",
        });
      }
    });
  });

export type MeetingFormValues = z.infer<typeof meetingFormSchema>;

export function combineScheduledAt(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
}

export function splitScheduledAt(value: string | Date): {
  scheduledDate: Date;
  scheduledTime: string;
} {
  const date = value instanceof Date ? value : new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return {
    scheduledDate: date,
    scheduledTime: `${hours}:${minutes}`,
  };
}

export const emptyMeetingFormValues = (): DefaultValues<MeetingFormValues> => ({
  title: "",
  meetingType: "",
  scheduledTime: "",
  attendeeIds: [] as string[],
  agenda: [{ content: "" }],
  decisions: [{ content: "" }],
  actions: [{ content: "", ownerId: "" }],
});
