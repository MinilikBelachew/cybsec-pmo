import type { Task, TaskSubTask } from "../types/tasks.types";
import { assigneeAvatarColor } from "../components/workspace/workspace-views/task-cell-pickers";
import {
  comparePlanOrderAsc,
  inclusiveDurationDays,
  resolveTaskDurationDays,
  signedDayDelta,
} from "./task-export-fields";

function shortDay(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Finish variance days: actual end (else plan end) − baseline end. */
export function resolveScheduleVarianceDays(task: {
  baselineEnd?: string | null;
  actualEnd?: string | null;
  endDate?: string | null;
}): number | null {
  const delta = signedDayDelta(task.actualEnd || task.endDate, task.baselineEnd);
  return delta === "" ? null : delta;
}

/** Indent label in List / Table / Gantt. Depth 0 is a top-level task in its phase. */
export function nestedDepthLabel(depth: number): string | null {
  if (depth <= 0) return null;
  if (depth === 1) return "Sub";
  const marks = ["", "", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
  return `Sub${marks[depth] ?? depth}`;
}

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
  parentTaskId?: string | null;
  depth?: number;
  children?: GanttTaskRow[];
  /** Used for plan-order sorting (import creates reverse-plan timestamps). */
  createdAt?: string;
  effortHours?: number | null;
  actualHoursLogged?: number;
  effortVarianceHours?: number | null;
  isOverEffort?: boolean;
  baselineStartLabel?: string | null;
  baselineEndLabel?: string | null;
  actualStartLabel?: string | null;
  actualEndLabel?: string | null;
  plannedDurationDays?: number | null;
  baselineDurationDays?: number | null;
  actualDurationDays?: number | null;
  scheduleVarianceDays?: number | null;
  isScheduleMilestone?: boolean;
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

function durationNumber(value: number | "" | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function scheduleFields(task: {
  startDate?: string | null;
  endDate?: string | null;
  baselineStart?: string | null;
  baselineEnd?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  durationDays?: number | null;
  baselineDurationDays?: number | null;
}) {
  const plannedDuration = resolveTaskDurationDays(task);
  const baselineDuration =
    task.baselineDurationDays != null && Number(task.baselineDurationDays) > 0
      ? Math.round(Number(task.baselineDurationDays) * 10) / 10
      : inclusiveDurationDays(task.baselineStart, task.baselineEnd);
  const actualDuration = inclusiveDurationDays(
    task.actualStart,
    task.actualEnd,
  );
  return {
    baselineStartLabel: shortDay(task.baselineStart ?? null),
    baselineEndLabel: shortDay(task.baselineEnd ?? null),
    actualStartLabel: shortDay(task.actualStart ?? null),
    actualEndLabel: shortDay(task.actualEnd ?? null),
    plannedDurationDays: durationNumber(plannedDuration),
    baselineDurationDays: durationNumber(baselineDuration),
    actualDurationDays: durationNumber(actualDuration),
    scheduleVarianceDays: resolveScheduleVarianceDays(task),
  };
}

function mapSubTaskToGanttRow(
  sub: TaskSubTask,
  parentId: string,
  depth: number,
  phase: {
    phaseId?: string | null;
    phaseName?: string;
    phaseColor?: string;
  },
): GanttTaskRow {
  const subInitials = sub.owner?.displayName
    ? sub.owner.displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "UA";

  const nested =
    sub.subTasks?.length
      ? [...sub.subTasks]
          .sort(comparePlanOrderAsc)
          .map((child) => mapSubTaskToGanttRow(child, sub.id, depth + 1, phase))
      : undefined;

  return {
    id: sub.id,
    name: sub.title,
    assigneeInitials: subInitials,
    assigneeName: sub.owner?.displayName ?? null,
    assigneeId: sub.owner?.id ?? null,
    assigneeColor: sub.owner?.id
      ? assigneeAvatarColor(sub.owner.id)
      : "bg-slate-500",
    dueDate: sub.endDate
      ? new Date(sub.endDate).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
      : "No due date",
    priority: PRIORITY_MAP[sub.priority ?? ""] ?? "medium",
    status: (sub.status as GanttTaskStatus) ?? "To_Do",
    comments: 0,
    hasSubtasks: Boolean(nested?.length),
    done: sub.status === "Done" || sub.status === "Approved",
    phaseId: phase.phaseId,
    phaseName: phase.phaseName,
    phaseColor: phase.phaseColor,
    rawStartDate: sub.startDate ?? null,
    rawEndDate: sub.endDate ?? null,
    owner: sub.owner,
    parentTaskId: parentId,
    depth,
    children: nested,
    createdAt: sub.createdAt,
    effortHours: sub.effortHours ?? null,
    actualHoursLogged: 0,
    effortVarianceHours: null,
    isOverEffort: false,
    isScheduleMilestone: Boolean(sub.isScheduleMilestone),
    ...scheduleFields(sub),
  };
}

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

  const phase = {
    phaseId: options?.groupId ?? task.phaseId,
    phaseName: options?.groupName ?? task.phase?.name ?? "Unassigned",
    phaseColor: options?.groupColor ?? "#64748b",
  };

  const children: GanttTaskRow[] | undefined = task.subTasks?.length
    ? [...task.subTasks]
        .sort(comparePlanOrderAsc)
        .map((sub) => mapSubTaskToGanttRow(sub, task.id, 1, phase))
    : undefined;

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
    phaseId: phase.phaseId,
    phaseName: phase.phaseName,
    phaseColor: phase.phaseColor,
    rawStartDate: task.startDate,
    rawEndDate: task.endDate,
    isOnCriticalPath: Boolean(task.isOnCriticalPath),
    scheduleImpact: task.scheduleImpact ?? null,
    owner: task.owner,
    parentTaskId: task.parentTaskId,
    depth: 0,
    children,
    createdAt: task.createdAt,
    effortHours: task.effortHours ?? null,
    actualHoursLogged: task.actualHoursLogged ?? 0,
    effortVarianceHours: task.effortVarianceHours ?? null,
    isOverEffort: Boolean(task.isOverEffort),
    isScheduleMilestone: Boolean(task.isScheduleMilestone),
    ...scheduleFields(task),
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

/** Drop MPP schedule-milestone rows from work lists (List / Table / Board). */
export function scheduleTaskKey(
  title: string,
  phaseId?: string | null,
): string {
  return `${phaseId ?? ""}|${title.trim().toLowerCase()}`;
}

export function isHiddenScheduleTask(
  task: {
    id?: string;
    name?: string;
    title?: string;
    phaseId?: string | null;
    isScheduleMilestone?: boolean;
  },
  milestones?: Array<{
    taskId?: string | null;
    title: string;
    phaseId?: string | null;
  }>,
): boolean {
  if (task.isScheduleMilestone) return true;
  if (!milestones?.length) return false;
  const title = (task.name ?? task.title ?? "").trim().toLowerCase();
  if (!title) return false;
  if (task.id && milestones.some((m) => m.taskId === task.id)) return true;
  const titleKey = title;
  const key = scheduleTaskKey(title, task.phaseId);
  return milestones.some((m) => {
    if (scheduleTaskKey(m.title, m.phaseId) === key) return true;
    if (task.phaseId == null && m.title.trim().toLowerCase() === titleKey) {
      return true;
    }
    return false;
  });
}

export function filterWorkTasks<
  T extends {
    isScheduleMilestone?: boolean;
    children?: T[];
    id?: string;
    name?: string;
    title?: string;
    phaseId?: string | null;
  },
>(
  tasks: T[],
  milestones?: Array<{
    taskId?: string | null;
    title: string;
    phaseId?: string | null;
  }>,
): T[] {
  return tasks
    .filter((task) => !isHiddenScheduleTask(task, milestones))
    .map((task) =>
      task.children?.length
        ? { ...task, children: filterWorkTasks(task.children, milestones) }
        : task,
    );
}
