import type { Task } from "../types/tasks.types";

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
  owner?: Task["owner"];
}

const PRIORITY_MAP: Record<string, GanttPriority> = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Critical: "critical",
};

const ASSIGNEE_COLORS = [
  "bg-purple-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
];

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
  const colorIndex = task.owner?.id ? task.owner.id.charCodeAt(0) % ASSIGNEE_COLORS.length : 0;

  return {
    id: task.id,
    name: task.title,
    assigneeInitials: initials,
    assigneeColor: ASSIGNEE_COLORS[colorIndex],
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
