import { z } from "zod";

export const phaseSchema = z.object({
  name: z.string().min(1, "Phase name is required").max(255, "Name is too long"),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  status: z.enum(["Planned", "Active", "Completed", "On_Hold"]),
}).refine(
  (data) => {
    return new Date(data.endDate) >= new Date(data.startDate);
  },
  {
    message: "End date must be on or after start date",
    path: ["endDate"],
  }
);

export type PhaseFormValues = z.infer<typeof phaseSchema>;
