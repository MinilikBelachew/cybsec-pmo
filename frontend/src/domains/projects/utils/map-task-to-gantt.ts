import type { Task } from "../types/tasks.types";
import { assigneeAvatarColor } from "../components/workspace/workspace-views/task-cell-pickers";

export type GanttPriority = "high" | "medium" | "low" | "critical";

export type GanttTaskStatus =
  | "To_Do"
  | "In_Progress"
  | "Submitted_for_Review"
  | "Approved"
  | "Rework"
  | "Done";

export interface GanttTaskRow {
  id: string;
  name: string;
  assigneeInitials: string;
  assigneeName: string | null;
  assigneeId: string | null;
  assigneeColor: string;
  dueDate: string;
  priority: GanttPriority;
  status: GanttTaskStatus;
  comments: number;
  hasSubtasks?: boolean;
  done: boolean;
  phaseId?: string | null;
  phaseName?: string;
  phaseColor?: string;
  rawStartDate?: string | null;
  rawEndDate?: string | null;
  isOnCriticalPath?: boolean;
  scheduleImpact?: Task["scheduleImpact"];
  owner?: Task["owner"];
}

const PRIORITY_MAP: Record<string, GanttPriority> = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Critical: "critical",
};

type MapTaskToGanttOptions = {
  /** When set, overrides phaseId (used for portfolio group-by-project). */
  groupId?: string;
  groupName?: string;
  groupColor?: string;
};

export function mapTaskToGanttRow(
  task: Task,
  options?: MapTaskToGanttOptions,
): GanttTaskRow {
  const initials = task.owner?.displayName
    ? task.owner.displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "UA";

  return {
    id: task.id,
    name: task.title,
    assigneeInitials: initials,
    assigneeName: task.owner?.displayName ?? null,
    assigneeId: task.ownerId ?? null,
    assigneeColor: task.owner?.id ? assigneeAvatarColor(task.owner.id) : "bg-slate-500",
    dueDate: task.endDate
      ? new Date(task.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "No due date",
    priority: PRIORITY_MAP[task.priority] ?? "medium",
    status: task.status,
    comments: task.comments?.length ?? 0,
    hasSubtasks: Boolean(task.subTasks?.length),
    done: task.status === "Done" || task.status === "Approved",
    phaseId: options?.groupId ?? task.phaseId,
    phaseName: options?.groupName ?? task.phase?.name ?? "Unassigned",
    phaseColor: options?.groupColor ?? "#64748b",
    rawStartDate: task.startDate,
    rawEndDate: task.endDate,
    isOnCriticalPath: Boolean(task.isOnCriticalPath),
    scheduleImpact: task.scheduleImpact ?? null,
    owner: task.owner,
  };
}

export function mapTasksToGanttRows(
  tasks: Task[],
  options?: { groupByProject?: boolean },
): GanttTaskRow[] {
  return tasks.map((task) => {
    if (options?.groupByProject) {
      return mapTaskToGanttRow(task, {
        groupId: task.projectId,
        groupName: task.project?.name ?? "Unknown project",
        groupColor: "#8b5cf6",
      });
    }
    return mapTaskToGanttRow(task);
  });
}
