import { z } from "zod";

export const ISSUE_STATUS_OPTIONS = [
  "Open",
  "In Progress",
  "Resolved",
  "Closed",
  "Cancelled",
] as const;

export const ISSUE_PRIORITY_OPTIONS = [
  "Low",
  "Medium",
  "High",
  "Critical",
] as const;

export const createIssueSchema = z.object({
  projectId: z.string().uuid("Project is required"),
  title: z.string().trim().min(1, "Title is required").max(255),
  priority: z.enum(ISSUE_PRIORITY_OPTIONS),
  ownerId: z.string().uuid("Owner is required"),
  dueDate: z.date({ message: "Due date is required" }),
  expectedResolutionDate: z.date().optional().nullable(),
  status: z.enum(ISSUE_STATUS_OPTIONS),
  resolutionNote: z.string().optional().nullable(),
});

export type IssueFormValues = z.infer<typeof createIssueSchema>;
