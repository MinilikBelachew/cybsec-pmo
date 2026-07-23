import { getApiErrorMessage } from "@/core/errors/api-error";
import { mapFileUploadErrorCode } from "./attachment-limits";
import type { TaskStatus } from "@/domains/projects/types/tasks.types";

const STATUS_LABELS: Record<TaskStatus, string> = {
  To_Do: "To Do",
  In_Progress: "In Progress",
  Submitted_for_Review: "Submitted for Review",
  Approved: "Approved",
  Rework: "Rework",
  Done: "Done",
};

function formatStatusLabel(status: string): string {
  const key = status.trim() as TaskStatus;
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  return status.replace(/_/g, " ").trim();
}

const PM_ALLOWED: Partial<Record<TaskStatus, TaskStatus[]>> = {
  To_Do: ["In_Progress"],
  In_Progress: ["To_Do", "Submitted_for_Review"],
  Submitted_for_Review: ["Approved", "Rework"],
  Approved: ["Done"],
  Rework: ["In_Progress", "Submitted_for_Review"],
  Done: [],
};

const ENGINEER_ALLOWED: Partial<Record<TaskStatus, TaskStatus[]>> = {
  To_Do: ["In_Progress"],
  In_Progress: ["To_Do"],
  Rework: ["In_Progress"],
};

const STATUS_ERROR_CODES: Record<string, string> = {
  statusChangeNotPermitted: "You can only change the status of tasks assigned to you.",
  statusChangeNotPermittedForRole:
    "That status change isn't allowed for your role. As a task engineer you can start work (In Progress), move back to To Do, resume rework, or submit progress for review.",
};

export function filterStatusOptionsForRole(
  currentStatus: TaskStatus,
  options: { value: TaskStatus; label: string }[],
  isOwner: boolean,
  canApprove: boolean,
): { value: TaskStatus; label: string }[] {
  if (canApprove) {
    const allowed = new Set([currentStatus, ...(PM_ALLOWED[currentStatus] ?? [])]);
    return options.filter((opt) => allowed.has(opt.value));
  }

  if (!isOwner) {
    return options.filter((opt) => opt.value === currentStatus);
  }

  const allowed = new Set([currentStatus, ...(ENGINEER_ALLOWED[currentStatus] ?? [])]);
  return options.filter((opt) => allowed.has(opt.value));
}

export function canMoveTaskToStatus(
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  isOwner: boolean,
  canApprove: boolean,
): boolean {
  if (fromStatus === toStatus) return true;
  return filterStatusOptionsForRole(
    fromStatus,
    [{ value: toStatus, label: STATUS_LABELS[toStatus] }],
    isOwner,
    canApprove,
  ).some((opt) => opt.value === toStatus);
}

export function getTaskStatusMoveDeniedMessage(
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  isOwner: boolean,
  canApprove: boolean,
): string {
  if (!isOwner && !canApprove) {
    return STATUS_ERROR_CODES.statusChangeNotPermitted;
  }

  const fromLabel = STATUS_LABELS[fromStatus];
  const toLabel = STATUS_LABELS[toStatus];

  if (canApprove) {
    const allowed = PM_ALLOWED[fromStatus] ?? [];
    if (allowed.length === 0) {
      return `This task is ${fromLabel} and can't be moved to another status from here.`;
    }
    const allowedLabels = allowed.map((s) => STATUS_LABELS[s]).join(", ");
    return `Tasks in ${fromLabel} can't move directly to ${toLabel}. Allowed next statuses: ${allowedLabels}.`;
  }

  const allowed = ENGINEER_ALLOWED[fromStatus] ?? [];
  if (allowed.length === 0) {
    return `You can't change the status while this task is ${fromLabel}. Wait for your project lead to review or approve it, or submit progress from the task details panel.`;
  }

  const allowedLabels = allowed.map((s) => STATUS_LABELS[s]).join(" or ");
  return `You can't move this task to ${toLabel}. From ${fromLabel}, you can only move it to ${allowedLabels}. To request review, open the task and submit progress.`;
}

export function formatTaskApiError(
  error: unknown,
  fallback = "Failed to update task",
): string {
  const payload =
    error && typeof error === "object" && "data" in error
      ? (error as { data?: { errors?: Record<string, string>; message?: string } }).data
      : undefined;
  const fileMapped =
    mapFileUploadErrorCode(payload?.errors?.file) ??
    mapFileUploadErrorCode(payload?.errors?.attachment) ??
    mapFileUploadErrorCode(payload?.errors ? Object.values(payload.errors)[0] : undefined) ??
    mapFileUploadErrorCode(payload?.message);
  if (fileMapped) return fileMapped;

  const msg = getApiErrorMessage(error, "");
  if (!msg) return fallback;

  if (STATUS_ERROR_CODES[msg]) return STATUS_ERROR_CODES[msg];

  const DATE_ERROR_CODES: Record<string, string> = {
    taskStartDateOutsideParent:
      "Sub-task start date must stay within the parent task date range",
    taskEndDateOutsideParent:
      "Sub-task end date must stay within the parent task date range",
    taskStartDateOutsidePhase: "Task start date must stay within the phase date range",
    taskEndDateOutsidePhase: "Task end date must stay within the phase date range",
  };
  if (DATE_ERROR_CODES[msg]) return DATE_ERROR_CODES[msg];

  if (msg === "progressAlreadyAt100CannotSubmitMore") {
    return "Progress is already at 100%. No further submissions are allowed.";
  }
  if (msg === "progressIncrementMustBeBetween1And100") {
    return "Enter how much progress to add this time (1–100%).";
  }
  const exceedRemaining = msg.match(/^progressIncrementExceedsRemaining \((\d+)%\)$/);
  if (exceedRemaining) {
    return `You can add at most ${exceedRemaining[1]}% more (total cannot exceed 100%).`;
  }
  // Legacy cumulative validation message (older servers)
  const mustExceed = msg.match(/^progressMustExceedCurrentTotal \((\d+)%\)$/);
  if (mustExceed) {
    return `Enter total progress above ${mustExceed[1]}%. Max is 100%.`;
  }
  const illegalMatch = msg.match(/^Illegal status transition from (.+) to (.+)$/);
  if (illegalMatch) {
    const fromLabel = formatStatusLabel(illegalMatch[1]);
    const toLabel = formatStatusLabel(illegalMatch[2]);
    return `Tasks can't move directly from ${fromLabel} to ${toLabel}. Follow the workflow steps for this task.`;
  }

  return msg;
}
