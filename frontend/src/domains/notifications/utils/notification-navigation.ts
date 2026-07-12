import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Plus,
  type LucideIcon,
} from "lucide-react";
import type { NotificationRecord } from "../api/notifications.api";

export function notificationIcon(eventType: string) {
  switch (eventType) {
    case "TASK_ASSIGNED":
      return Plus;
    case "TASK_UPDATED":
    case "TASK_DEADLINE_REMINDER":
      return Clock;
    case "PROGRESS_SUBMITTED":
      return Clock;
    case "PROGRESS_APPROVED":
      return CheckCircle2;
    case "PROGRESS_REJECTED":
    case "PROGRESS_REWORK":
      return AlertTriangle;
    case "TIMESHEET_SUBMITTED":
    case "TIMESHEET_RESUBMITTED":
      return Clock;
    case "TIMESHEET_APPROVED":
      return CheckCircle2;
    case "TIMESHEET_REJECTED":
      return AlertTriangle;
    case "TIMESHEET_ESCALATED":
      return Bell;
    case "LEAVE_CRITICAL_CONFLICT":
      return AlertTriangle;
    default:
      return Bell;
  }
}

export function notificationIconClass(eventType: string): string {
  switch (eventType) {
    case "TASK_ASSIGNED":
      return "text-blue-500";
    case "TASK_UPDATED":
      return "text-amber-500";
    case "TASK_DEADLINE_REMINDER":
      return "text-amber-600";
    case "PROGRESS_SUBMITTED":
      return "text-violet-500";
    case "PROGRESS_APPROVED":
      return "text-emerald-500";
    case "PROGRESS_REJECTED":
    case "PROGRESS_REWORK":
      return "text-rose-500";
    case "TIMESHEET_SUBMITTED":
    case "TIMESHEET_RESUBMITTED":
      return "text-violet-500";
    case "TIMESHEET_APPROVED":
      return "text-emerald-500";
    case "TIMESHEET_REJECTED":
      return "text-rose-500";
    case "TIMESHEET_ESCALATED":
      return "text-amber-600";
    case "LEAVE_CRITICAL_CONFLICT":
      return "text-rose-500";
    default:
      return "text-primary";
  }
}

export function resolveNotificationHref(notification: NotificationRecord): string | null {
  const payload = notification.payload;
  const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
  const taskId = typeof payload.taskId === "string" ? payload.taskId : null;
  const progressUpdateId =
    typeof payload.progressUpdateId === "string" ? payload.progressUpdateId : null;

  let taskIdToOpen = taskId;
  if (!taskIdToOpen && Array.isArray(payload.impactedTaskIds)) {
    const firstImpacted = payload.impactedTaskIds.find((id) => typeof id === "string");
    if (typeof firstImpacted === "string") {
      taskIdToOpen = firstImpacted;
    }
  }

  if (projectId && taskIdToOpen) {
    const params = new URLSearchParams({ taskId: taskIdToOpen });

    if (
      notification.eventType === "PROGRESS_SUBMITTED" &&
      typeof progressUpdateId === "string"
    ) {
      params.set("reviewProgress", "1");
      params.set("progressUpdateId", progressUpdateId);
    } else if (
      notification.eventType === "PROGRESS_APPROVED" ||
      notification.eventType === "PROGRESS_REJECTED" ||
      notification.eventType === "PROGRESS_REWORK"
    ) {
      params.set("progress", "1");
    }

    return `/dashboard/projects/${projectId}?${params.toString()}`;
  }

  const link = payload.link;
  if (typeof link === "string" && link.length > 0) {
    if (projectId && taskIdToOpen && !link.includes("taskId=")) {
      const params = new URLSearchParams({ taskId: taskIdToOpen });
      return `/dashboard/projects/${projectId}?${params.toString()}`;
    }
    return link;
  }

  if (projectId) {
    return `/dashboard/projects/${projectId}`;
  }

  return null;
}

export type NotificationIconComponent = LucideIcon;
