"use client";
import { Spinner } from "@/shared/components/spinner";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Circle, CircleCheck, Flag, ListChecks, MessageSquare, Plus, MoreHorizontal, User, Calendar, GitBranch } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { TaskPriority } from "@/domains/projects/types/tasks.types";
import {
  usePaginatedStatusTasks,
  type StatusColumnFilters,
} from "@/domains/projects/hooks/use-paginated-status-tasks";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import { TaskDependenciesPicker } from "./task-predecessors-cell";
import { nestedDepthLabel } from "@/domains/projects/utils/map-task-to-gantt";

type Priority = "high" | "medium" | "low" | "critical";
type Status = "To_Do" | "In_Progress" | "Submitted_for_Review" | "Approved" | "Rework" | "Done";

interface Task {
  id: string;
  name: string;
  assigneeInitials: string;
  assigneeColor: string;
  dueDate: string;
  priority: Priority;
  status: Status;
  comments: number;
  hasSubtasks?: boolean;
  done: boolean;
  phaseId?: string | null;
  phaseName?: string;
  phaseColor?: string;
  owner?: { id: string; displayName: string; email: string };
  rawStartDate?: string | null;
  rawEndDate?: string | null;
  parentTaskId?: string | null;
  depth?: number;
  children?: Task[];
  /** DEF-P1-047 — nested under predecessor in the tree */
  treeKind?: "subtask" | "dependency";
  depType?: string;
  /** Plan-order sort key (MPP Order / ID column). */
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
}

function formatDueDate(dateStr?: string | null) {
  if (!dateStr || dateStr === "No due date") return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return null;
  }
}

import { type ProjectPhase, type ProjectTaskAssignee } from "../../../types/projects.types";
import type { TaskDependency } from "../../../types/tasks.types";
import { EmployeeTooltip } from "../../shared/employee-tooltip";
import {
  TaskAssigneePicker,
  TaskStatusPicker,
  TaskDatePicker,
  TaskCommentPicker,
  TaskPriorityPicker,
  assigneeAvatarInitials,
  assigneeAvatarColor,
  STATUS_PILL,
  type ApiPriority,
  getPriorityColors,
  API_PRIORITY_OPTIONS,
} from "./task-cell-pickers";

interface ListViewProps {
  tasks: Task[];
  /** When set with filters, status groups use option-B per-status pagination. */
  projectId?: string;
  search?: string;
  priorityFilter?: TaskPriority;
  statusCounts?: Partial<Record<Status, number>>;
  openGroups: Set<Status>;
  toggleGroup: (status: Status) => void;
  toggleTask: (taskId: string) => void;
  onAddTask?: (status: Status, phaseId?: string | null) => void;
  onTaskClick?: (taskId: string, initialTab?: "comments" | "subtasks") => void;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
  onMoveTask?: (taskId: string, toStatus: Status) => void;
  phases?: ProjectPhase[];
  assignees?: ProjectTaskAssignee[];
  onAssignTask?: (taskId: string, ownerId: string | null) => Promise<void>;
  onUpdateTaskDates?: (taskId: string, dates: { startDate: string; endDate: string }) => Promise<void>;
  canAssignTask?: boolean;
  canEditDates?: boolean;
  currentUserId?: string;
  canApproveTask?: boolean;
  onUpdateTaskPriority?: (taskId: string, priority: ApiPriority) => Promise<void>;
  /** Project dependency links — used to nest dependents under predecessors (DEF-P1-047). */
  dependencies?: TaskDependency[];
  /** DEF-P1-036 — bulk assign / status / priority / delete */
  canBulkEdit?: boolean;
  onBulkAssign?: (taskIds: string[], ownerId: string | null) => Promise<void>;
  onBulkStatus?: (taskIds: string[], status: Status) => Promise<void>;
  onBulkPriority?: (taskIds: string[], priority: ApiPriority) => Promise<void>;
  onBulkDelete?: (taskIds: string[]) => void;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_DOT: Record<Status, string> = {
  "To_Do": "border-2 border-muted-foreground bg-transparent",
  "In_Progress": "bg-blue-500",
  "Submitted_for_Review": "bg-amber-500",
  "Approved": "bg-teal-500",
  "Rework": "bg-rose-500",
  "Done": "bg-emerald-500",
};

const GROUP_ACCENT: Record<Status, string> = {
  "To_Do": "text-muted-foreground",
  "In_Progress": "text-blue-600 dark:text-blue-400",
  "Submitted_for_Review": "text-amber-600 dark:text-amber-400",
  "Approved": "text-teal-655 dark:text-teal-405",
  "Rework": "text-rose-600 dark:text-rose-400",
  "Done": "text-emerald-600 dark:text-emerald-400",
};

const STATUS_LABEL: Record<Status, string> = {
  "To_Do": "To Do",
  "In_Progress": "In Progress",
  "Submitted_for_Review": "Submitted for Review",
  "Approved": "Approved",
  "Rework": "Rework",
  "Done": "Done",
};

export function ListView({
  tasks,
  projectId,
  search,
  priorityFilter,
  statusCounts,
  openGroups,
  toggleGroup,
  toggleTask,
  onAddTask,
  onTaskClick,
  onDeleteTask,
  onDuplicateTask,
  onMoveTask,
  phases = [],
  assignees = [],
  onAssignTask,
  onUpdateTaskDates,
  canAssignTask = false,
  canEditDates = false,
  currentUserId,
  canApproveTask = false,
  onUpdateTaskPriority,
  dependencies = [],
  canBulkEdit = false,
  onBulkAssign,
  onBulkStatus,
  onBulkPriority,
  onBulkDelete,
}: ListViewProps) {
  const [groupByPhase, setGroupByPhase] = React.useState(false);
  const [openPhases, setOpenPhases] = React.useState<Record<string, boolean>>({});
  const [expandedParents, setExpandedParents] = useState<Set<string>>(() => new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const { canEditDependencies } = useModulePermissions();

  const taskById = React.useMemo(() => {
    const map = new Map<string, Task>();
    const walk = (t: Task) => {
      map.set(t.id, t);
      for (const c of t.children ?? []) walk(c);
    };
    for (const t of tasks) walk(t);
    return map;
  }, [tasks]);

  /** DEF-P1-047 — successors that depend on this task (this task is the predecessor). */
  const dependentsByPredecessor = React.useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const dep of dependencies) {
      const related = taskById.get(dep.successorId);
      const row: Task = related
        ? {
            ...related,
            depth: 1,
            children: undefined,
            hasSubtasks: false,
            treeKind: "dependency",
            depType: dep.depType,
            parentTaskId: related.parentTaskId ?? null,
          }
        : {
            id: dep.successor.id,
            name: dep.successor.title,
            assigneeInitials: dep.successor.owner?.displayName
              ? dep.successor.owner.displayName
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
              : "UA",
            assigneeColor: "bg-slate-500",
            dueDate: dep.successor.endDate
              ? new Date(dep.successor.endDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "No due date",
            priority: "medium",
            status: "To_Do",
            comments: 0,
            done: false,
            rawStartDate: dep.successor.startDate,
            rawEndDate: dep.successor.endDate,
            owner: dep.successor.owner
              ? {
                  id: dep.successor.owner.id,
                  displayName: dep.successor.owner.displayName,
                  email: dep.successor.owner.email,
                }
              : undefined,
            depth: 1,
            treeKind: "dependency",
            depType: dep.depType,
          };
      const list = map.get(dep.predecessorId) ?? [];
      if (!list.some((t) => t.id === row.id)) list.push(row);
      map.set(dep.predecessorId, list);
    }
    return map;
  }, [dependencies, taskById]);

  function nestedRowsFor(task: Task, childDepth: number): Task[] {
    const subs = (task.children ?? []).map((c) => ({
      ...c,
      treeKind: "subtask" as const,
      depth: childDepth,
    }));
    // Dependency links only under top-level rows (avoid noise under deep nests).
    if (childDepth > 1) {
      return subs;
    }
    const deps = dependentsByPredecessor.get(task.id) ?? [];
    const subIds = new Set(subs.map((s) => s.id));
    return [...subs, ...deps.filter((d) => !subIds.has(d.id))];
  }

  const togglePhaseGroup = (name: string) => {
    setOpenPhases((prev) => ({
      ...prev,
      [name]: prev[name] === false ? true : false,
    }));
  };

  const toggleParentExpand = (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const allSelectableIds = React.useMemo(() => {
    const ids: string[] = [];
    const walk = (t: Task) => {
      ids.push(t.id);
      for (const c of t.children ?? []) walk(c);
    };
    for (const t of tasks) walk(t);
    return ids;
  }, [tasks]);
  // Checkboxes only while Select mode is on (not always visible).
  const showBulkSelect = Boolean(canBulkEdit && bulkMode);
  const allSelected =
    showBulkSelect &&
    allSelectableIds.length > 0 &&
    allSelectableIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
  };

  const toggleBulkMode = () => {
    if (bulkMode) {
      exitBulkMode();
      return;
    }
    setBulkMode(true);
  };

  const toggleSelect = (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(allSelectableIds));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const runBulkAssign = async (ownerId: string | null) => {
    if (!onBulkAssign || selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      await onBulkAssign([...selectedIds], ownerId);
      clearSelection();
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkStatus = async (status: Status) => {
    if (!onBulkStatus || selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      await onBulkStatus([...selectedIds], status);
      clearSelection();
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkPriority = async (priority: ApiPriority) => {
    if (!onBulkPriority || selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      await onBulkPriority([...selectedIds], priority);
      clearSelection();
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkDelete = () => {
    if (!onBulkDelete || selectedIds.size === 0) return;
    onBulkDelete([...selectedIds]);
    clearSelection();
  };

  // Expand parents that have sub-tasks or dependents so the tree is visible by default.
  React.useEffect(() => {
    const idsToExpand: string[] = [];
    const walk = (t: Task) => {
      const hasNest =
        (t.children?.length ?? 0) > 0 ||
        Boolean(t.hasSubtasks) ||
        (dependentsByPredecessor.get(t.id)?.length ?? 0) > 0;
      if (hasNest) idsToExpand.push(t.id);
      for (const c of t.children ?? []) walk(c);
    };
    for (const t of tasks) walk(t);
    if (idsToExpand.length === 0) return;
    setExpandedParents((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of idsToExpand) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tasks, dependentsByPredecessor]);

  const phaseGroups = React.useMemo(() => {
    const map: Record<string, { id: string | null; name: string; color: string; tasks: typeof tasks }> = {};

    tasks.forEach((t) => {
      const name = t.phaseName || "Unassigned";
      if (!map[name]) {
        map[name] = {
          id: t.phaseId || null,
          name,
          color: t.phaseColor || "#64748b",
          tasks: [],
        };
      }
      map[name].tasks.push(t);
    });

    return Object.values(map).sort((a, b) => {
      if (a.name === "Unassigned") return 1;
      if (b.name === "Unassigned") return -1;
      
      const phaseA = phases.find((p) => p.id === a.id);
      const phaseB = phases.find((p) => p.id === b.id);
      
      if (!phaseA?.startDate && !phaseB?.startDate) return a.name.localeCompare(b.name);
      if (!phaseA?.startDate) return 1;
      if (!phaseB?.startDate) return -1;
      
      const diff = new Date(phaseA.startDate).getTime() - new Date(phaseB.startDate).getTime();
      if (diff !== 0) return diff;
      
      if (!phaseA?.endDate && !phaseB?.endDate) return a.name.localeCompare(b.name);
      if (!phaseA?.endDate) return 1;
      if (!phaseB?.endDate) return -1;
      
      return new Date(phaseA.endDate).getTime() - new Date(phaseB.endDate).getTime();
    });
  }, [tasks, phases]);

  function getStatusBadge(status: Status, isHeader = false) {
    const label = STATUS_LABEL[status] || status;
    
    if (status === "To_Do") {
      return (
        <span className={cn(
          "inline-flex items-center rounded border border-dashed border-slate-350 bg-slate-50/50 text-slate-500 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-700",
          isHeader && "shadow-xs"
        )}>
          <Circle className="size-2.5 mr-1.5 text-slate-400 shrink-0" />
          {label}
        </span>
      );
    }

    const bgStyles: Record<Status, string> = {
      "To_Do": "",
      "In_Progress": "bg-blue-500 text-white",
      "Submitted_for_Review": "bg-amber-500 text-white",
      "Approved": "bg-teal-500 text-white",
      "Rework": "bg-rose-500 text-white",
      "Done": "bg-emerald-500 text-white",
    };

    return (
      <span className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs",
        bgStyles[status]
      )}>
        <CircleCheck className="size-2.5 mr-1.5 shrink-0" />
        {label}
      </span>
    );
  }

  const renderColumnHeaders = () => (
    <div className="flex min-w-[110rem] items-center gap-4 px-3 py-1.5 border-b border-border/30 bg-slate-50/30 dark:bg-slate-900/10 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
      {showBulkSelect ? <div className="w-4 shrink-0" /> : null}
      <div className="w-4 shrink-0" />
      <div className="w-4 shrink-0" />
      <div className="flex-1 min-w-[12rem] max-w-[22rem] text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider text-left">
        Name
      </div>
      <div className="shrink-0 w-8 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Deps
      </div>
      <div className="shrink-0 w-28 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Assignee
      </div>
      <div className="shrink-0 w-28 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Due Date
      </div>
      <div className="shrink-0 w-28 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Priority
      </div>
      <div className="shrink-0 w-16 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Planned
      </div>
      <div className="shrink-0 w-16 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Logged
      </div>
      <div className="shrink-0 w-20 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Variance
      </div>
      <div className="shrink-0 w-16 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Plan start
      </div>
      <div className="shrink-0 w-16 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        BL start
      </div>
      <div className="shrink-0 w-16 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        BL end
      </div>
      <div className="shrink-0 w-14 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        BL d
      </div>
      <div className="shrink-0 w-16 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Act start
      </div>
      <div className="shrink-0 w-16 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Act end
      </div>
      <div className="shrink-0 w-14 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Act d
      </div>
      <div className="shrink-0 w-16 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Sched
      </div>
      <div className="shrink-0 w-32 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Status
      </div>
      <div className="shrink-0 w-18 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Comments
      </div>
      <div className="shrink-0 w-12 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Action
      </div>
    </div>
  );

  const renderTaskRow = (task: Task, depth = 0) => {
    const fullAssignee = task.owner?.id
      ? assignees.find((a) => a.userId === task.owner?.id)
      : null;
    const employeeData = fullAssignee
      ? {
          displayName: fullAssignee.displayName,
          email: fullAssignee.email,
          designation: fullAssignee.designation,
          role: fullAssignee.role,
          department: fullAssignee.department,
          employeeId: fullAssignee.employeeId,
        }
      : task.owner
      ? {
          displayName: task.owner.displayName,
          email: task.owner.email,
          role: "Assignee",
        }
      : null;

    const nested = nestedRowsFor(task, depth + 1);
    const hasChildren = nested.length > 0 || Boolean(task.children?.length || task.hasSubtasks);
    const isExpanded = expandedParents.has(task.id);
    const indentPx = Math.min(depth, 10) * 16;
    const isDependencyRow = task.treeKind === "dependency";

    return (
      <React.Fragment key={`${task.treeKind ?? "task"}-${task.id}-${depth}`}>
      <div
        className={cn(
          "flex min-w-[110rem] items-center gap-4 px-3 py-2 border-b border-border/30 hover:bg-muted/30 transition-colors group cursor-pointer",
          task.done && "opacity-60",
          depth > 0 && "bg-muted/10",
          isDependencyRow && "bg-violet-50/40 dark:bg-violet-950/20",
          selectedIds.has(task.id) && "bg-primary/5"
        )}
      >
        {showBulkSelect ? (
          isDependencyRow ? (
            <div className="w-4 shrink-0" />
          ) : (
            <div className="w-4 shrink-0 flex items-center justify-center">
              <input
                type="checkbox"
                checked={selectedIds.has(task.id)}
                onChange={() => toggleSelect(task.id)}
                onClick={(e) => e.stopPropagation()}
                className="rounded border-slate-300 dark:border-white/10 accent-primary size-3.5"
                aria-label={`Select ${task.name}`}
              />
            </div>
          )
        ) : null}
        <div
          className="w-4 shrink-0 flex items-center justify-center"
          style={{ marginLeft: indentPx }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleParentExpand(task.id, e)}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label={isExpanded ? "Collapse nested tasks" : "Expand nested tasks"}
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </button>
          ) : depth > 0 ? (
            isDependencyRow ? (
              <GitBranch className="size-3 text-violet-500" />
            ) : (
              <span className="size-1.5 rounded-full bg-muted-foreground/40" />
            )
          ) : null}
        </div>
        <button
          onClick={() => toggleTask(task.id)}
          className="shrink-0"
          aria-label={task.done ? "Mark incomplete" : "Mark complete"}
        >
          {task.done ? (
            <CircleCheck className="size-4 text-emerald-500 shrink-0" />
          ) : task.status === "In_Progress" ? (
            <CircleCheck className="size-4 text-blue-500 shrink-0" />
          ) : (
            <Circle className="size-4 text-muted-foreground shrink-0" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onTaskClick?.(task.id, depth > 0 ? "comments" : undefined)}
          className={cn(
            "flex-1 min-w-[12rem] max-w-[22rem] text-sm truncate text-left hover:text-primary transition-colors",
            task.done ? "line-through text-muted-foreground" : "text-foreground",
            depth > 0 && "font-normal"
          )}
          title={task.name}
        >
          {depth > 0 && (
            <span
              className={cn(
                "mr-1.5 text-[10px] font-semibold uppercase tracking-wide",
                isDependencyRow ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground",
              )}
            >
              {isDependencyRow
                ? `Dep${task.depType ? ` ${task.depType}` : ""}`
                : nestedDepthLabel(depth)}
            </span>
          )}
          {task.name}
        </button>
        <div
          className="shrink-0 w-8 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {isDependencyRow ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <TaskDependenciesPicker
              taskId={task.id}
              projectId={projectId!}
              dependencies={dependencies}
              canEdit={canEditDependencies}
            />
          )}
        </div>
        <div className="shrink-0 w-28 flex items-center justify-center">
          {canAssignTask && onAssignTask ? (
            <TaskAssigneePicker
              assignees={assignees}
              currentUserId={currentUserId}
              selectedUserId={task.owner?.id}
              onAssign={(ownerId) => onAssignTask(task.id, ownerId)}
            >
              {employeeData ? (
                <EmployeeTooltip employee={employeeData}>
                  <span
                    className={cn(
                      "inline-flex items-center justify-center size-6 rounded-full font-semibold text-white text-[10px] shrink-0 cursor-pointer hover:opacity-85",
                      task.assigneeColor
                    )}
                  >
                    {task.assigneeInitials}
                  </span>
                </EmployeeTooltip>
              ) : (
                <span className="inline-flex items-center justify-center size-6 rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 shrink-0 cursor-pointer hover:border-primary/50 transition-colors">
                  <User className="size-3.5" />
                </span>
              )}
            </TaskAssigneePicker>
          ) : employeeData ? (
            <EmployeeTooltip employee={employeeData}>
              <span
                className={cn(
                  "inline-flex items-center justify-center size-6 rounded-full font-semibold text-white text-[10px] shrink-0 cursor-default",
                  task.assigneeColor
                )}
              >
                {task.assigneeInitials}
              </span>
            </EmployeeTooltip>
          ) : (
            <span className="inline-flex items-center justify-center size-6 rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 shrink-0 cursor-default">
              <User className="size-3.5" />
            </span>
          )}
        </div>
        <div className="shrink-0 w-28 text-xs text-muted-foreground text-center flex items-center justify-center">
          {canEditDates && onUpdateTaskDates ? (
            <TaskDatePicker
              startDate={task.rawStartDate}
              endDate={task.rawEndDate}
              onSave={(dates) => onUpdateTaskDates(task.id, dates)}
            >
              {task.rawEndDate || (task.dueDate && task.dueDate !== "No due date") ? (
                <span className="cursor-pointer hover:text-primary transition-colors">
                  {formatDueDate(task.rawEndDate || task.dueDate)}
                </span>
              ) : (
                <span className="text-slate-350 hover:text-primary transition-colors cursor-pointer dark:text-slate-650 inline-flex items-center justify-center size-6 rounded hover:bg-muted/50">
                  <Calendar className="size-4" />
                </span>
              )}
            </TaskDatePicker>
          ) : task.rawEndDate || (task.dueDate && task.dueDate !== "No due date") ? (
            <span>{formatDueDate(task.rawEndDate || task.dueDate)}</span>
          ) : (
            <span className="text-slate-350 dark:text-slate-650">
              <Calendar className="size-4" />
            </span>
          )}
        </div>
        <div className="shrink-0 w-28 flex items-center justify-center gap-1">
          {onUpdateTaskPriority ? (
            <TaskPriorityPicker
              priority={task.priority}
              onPriorityChange={(priority) => onUpdateTaskPriority(task.id, priority)}
            >
              <span className={cn("inline-flex items-center gap-1 cursor-pointer hover:opacity-85 text-xs font-medium", task.priority ? getPriorityColors(task.priority).text : "text-slate-350 dark:text-slate-650")}>
                <Flag className="size-3.5" />
                {task.priority ? PRIORITY_LABEL[task.priority] : "None"}
              </span>
            </TaskPriorityPicker>
          ) : task.priority ? (
            <>
              <Flag className={cn("size-3.5", getPriorityColors(task.priority).text)} />
              <span className={cn("text-xs font-medium", getPriorityColors(task.priority).text)}>
                {PRIORITY_LABEL[task.priority]}
              </span>
            </>
          ) : (
            <Flag className="size-3.5 text-slate-350 dark:text-slate-650" />
          )}
        </div>
        <div className="shrink-0 w-16 flex items-center justify-center text-xs tabular-nums text-muted-foreground">
          {task.effortHours != null && task.effortHours > 0 ? `${task.effortHours}h` : "—"}
        </div>
        <div
          className={cn(
            "shrink-0 w-16 flex items-center justify-center text-xs tabular-nums",
            task.isOverEffort
              ? "font-semibold text-amber-700 dark:text-amber-300"
              : "text-muted-foreground",
          )}
        >
          {(task.actualHoursLogged ?? 0) > 0 || (task.effortHours ?? 0) > 0
            ? `${task.actualHoursLogged ?? 0}h`
            : "—"}
        </div>
        <div
          className={cn(
            "shrink-0 w-20 flex items-center justify-center text-xs font-medium tabular-nums",
            task.isOverEffort
              ? "text-amber-700 dark:text-amber-300"
              : "text-muted-foreground",
          )}
          title={
            task.isOverEffort
              ? "Logged hours exceed planned effort"
              : (task.actualHoursLogged ?? 0) === 0
                ? "No variance until hours are logged"
                : "Hours remaining (planned − logged)"
          }
        >
          {task.effortVarianceHours == null || task.effortHours == null
            ? "—"
            : `${task.effortVarianceHours}h${task.isOverEffort ? " ⚠" : ""}`}
        </div>
        <div
          className="shrink-0 w-16 flex items-center justify-center text-xs tabular-nums text-muted-foreground"
          title="Planned start"
        >
          {task.rawStartDate
            ? formatDueDate(task.rawStartDate) ?? "—"
            : "—"}
        </div>
        <div
          className="shrink-0 w-16 flex items-center justify-center text-xs tabular-nums text-muted-foreground"
          title="Baseline start"
        >
          {task.baselineStartLabel || "—"}
        </div>
        <div
          className="shrink-0 w-16 flex items-center justify-center text-xs tabular-nums text-muted-foreground"
          title="Baseline end"
        >
          {task.baselineEndLabel || "—"}
        </div>
        <div
          className="shrink-0 w-14 flex items-center justify-center text-xs tabular-nums text-muted-foreground"
          title="Baseline duration (days)"
        >
          {task.baselineDurationDays == null ? "—" : `${task.baselineDurationDays}d`}
        </div>
        <div
          className="shrink-0 w-16 flex items-center justify-center text-xs tabular-nums text-muted-foreground"
          title="Actual start"
        >
          {task.actualStartLabel || "—"}
        </div>
        <div
          className="shrink-0 w-16 flex items-center justify-center text-xs tabular-nums text-muted-foreground"
          title="Actual end"
        >
          {task.actualEndLabel || "—"}
        </div>
        <div
          className="shrink-0 w-14 flex items-center justify-center text-xs tabular-nums text-muted-foreground"
          title="Actual duration (days)"
        >
          {task.actualDurationDays == null ? "—" : `${task.actualDurationDays}d`}
        </div>
        <div
          className={cn(
            "shrink-0 w-16 flex items-center justify-center text-xs font-medium tabular-nums",
            (task.scheduleVarianceDays ?? 0) > 0
              ? "text-amber-700 dark:text-amber-300"
              : (task.scheduleVarianceDays ?? 0) < 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground",
          )}
          title="Schedule variance vs baseline end (days)"
        >
          {task.scheduleVarianceDays == null
            ? "—"
            : `${task.scheduleVarianceDays > 0 ? "+" : ""}${task.scheduleVarianceDays}d`}
        </div>
        <div className="shrink-0 w-32 flex items-center justify-center">
          {onMoveTask ? (
            <TaskStatusPicker
              task={{
                id: task.id,
                status: task.status,
                assigneeId: task.owner?.id,
              }}
              currentUserId={currentUserId}
              canApproveTask={canApproveTask}
              onStatusChange={onMoveTask}
            >
              {getStatusBadge(task.status)}
            </TaskStatusPicker>
          ) : (
            getStatusBadge(task.status)
          )}
        </div>
        <div className="shrink-0 w-18 flex items-center justify-center">
          <TaskCommentPicker taskId={task.id} commentCount={task.comments}>
            <span className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer">
              <MessageSquare className="size-3.5" />
            </span>
          </TaskCommentPicker>
        </div>
        <div className="shrink-0 w-12 flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskClick?.(task.id, depth > 0 ? "comments" : undefined);
                }}
              >
                Edit task
              </DropdownMenuItem>
              {depth > 0 && task.parentTaskId && (
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskClick?.(task.parentTaskId!, "subtasks");
                }}
              >
                Open parent task
              </DropdownMenuItem>
              )}
              {depth === 0 && (
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateTask?.(task.id);
                }}
              >
                Duplicate
              </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTask?.(task.id);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {hasChildren && isExpanded &&
        nested.map((child) => renderTaskRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* List View Toolbar */}
      <div className="flex items-center justify-between px-5 py-2 bg-slate-50/50 dark:bg-slate-950/20 border-b border-border/50 shrink-0 gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {canBulkEdit && bulkMode && someSelected ? (
            <>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
              {canAssignTask && onBulkAssign ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={bulkBusy}
                    className="h-7 px-2.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted disabled:opacity-50 cursor-pointer"
                  >
                    Assign
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                    <DropdownMenuItem
                      className="cursor-pointer text-xs"
                      onClick={() => void runBulkAssign(null)}
                    >
                      Unassigned
                    </DropdownMenuItem>
                    {assignees.map((a) => (
                      <DropdownMenuItem
                        key={a.userId}
                        className="cursor-pointer text-xs"
                        onClick={() => void runBulkAssign(a.userId)}
                      >
                        {a.displayName}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {onBulkStatus ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={bulkBusy}
                    className="h-7 px-2.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted disabled:opacity-50 cursor-pointer"
                  >
                    Status
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {(Object.keys(STATUS_LABEL) as Status[]).map((status) => (
                      <DropdownMenuItem
                        key={status}
                        className="cursor-pointer text-xs"
                        onClick={() => void runBulkStatus(status)}
                      >
                        {STATUS_LABEL[status]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {onBulkPriority ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={bulkBusy}
                    className="h-7 px-2.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted disabled:opacity-50 cursor-pointer"
                  >
                    Priority
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {API_PRIORITY_OPTIONS.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        className="cursor-pointer text-xs"
                        onClick={() => void runBulkPriority(option.value)}
                      >
                        <Flag className={cn("size-3.5 mr-1.5", option.colorClass)} />
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {onBulkDelete ? (
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={runBulkDelete}
                  className="h-7 px-2.5 rounded-md border border-rose-200 text-rose-600 text-xs font-medium hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                >
                  Delete
                </button>
              ) : null}
              <button
                type="button"
                onClick={clearSelection}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </>
          ) : canBulkEdit && bulkMode ? (
            <>
              <span className="text-xs font-semibold text-slate-500">
                Select tasks
              </span>
              {allSelectableIds.length > 0 ? (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Select all
                </button>
              ) : null}
            </>
          ) : (
            <span className="text-xs font-semibold text-slate-500">Tasks</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {canBulkEdit ? (
            <Button
              type="button"
              variant={bulkMode ? "secondary" : "outline"}
              size="sm"
              className="h-8 gap-1.5 border-border/60 bg-white shadow-none dark:bg-card"
              onClick={toggleBulkMode}
            >
              <ListChecks className="size-4" />
              {bulkMode ? "Cancel" : "Select"}
            </Button>
          ) : null}
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none text-slate-650 dark:text-slate-450 hover:text-slate-905 dark:hover:text-white">
            <input
              type="checkbox"
              checked={groupByPhase}
              onChange={(e) => setGroupByPhase(e.target.checked)}
              className="rounded border-slate-300 dark:border-white/10 accent-primary focus:ring-primary"
            />
            Group by Phase
          </label>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">

        {groupByPhase ? (
          phaseGroups.map((group) => {
            const isOpen = openPhases[group.name] !== false;
            return (
              <div key={group.name} className="mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-background border-b border-border/30 sticky top-0 z-10">
                  <button
                    type="button"
                    onClick={() => togglePhaseGroup(group.name)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="inline-flex items-center rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                      <span
                        className="size-2 rounded-full shrink-0 mr-1.5"
                        style={{ backgroundColor: group.color }}
                      />
                      {group.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold ml-1">{group.tasks.length}</span>
                  </button>
                </div>

                {isOpen && (
                  <>
                    {group.tasks.length > 0 ? renderColumnHeaders() : null}
                    {group.tasks.map((task) => renderTaskRow(task))}
                    {onAddTask && group.id && (
                      <div
                        onClick={() => onAddTask("To_Do", group.id)}
                        className="flex min-w-[110rem] items-center gap-2 px-3 py-2 border-b border-border/30 hover:bg-muted/10 transition-colors cursor-pointer group"
                      >
                        {showBulkSelect ? <div className="w-4 shrink-0" /> : null}
                        <div className="w-4 shrink-0" />
                        <div className="w-4 shrink-0" />
                        <div className="w-8 shrink-0" />
                        <Plus className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                          Add Task to Phase
                        </span>
                        <div className="w-36 shrink-0" />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        ) : projectId ? (
          (["To_Do", "In_Progress", "Submitted_for_Review", "Approved", "Rework", "Done"] as Status[]).map(
            (status) => (
              <ListStatusSection
                key={status}
                status={status}
                filters={{
                  projectId,
                  search,
                  priority: priorityFilter,
                }}
                statusCount={statusCounts?.[status]}
                isOpen={openGroups.has(status)}
                onToggle={() => toggleGroup(status)}
                getStatusBadge={getStatusBadge}
                renderColumnHeaders={renderColumnHeaders}
                renderTaskRow={renderTaskRow}
                onAddTask={onAddTask}
                showBulkSelect={showBulkSelect}
              />
            ),
          )
        ) : (
          (["To_Do", "In_Progress", "Submitted_for_Review", "Approved", "Rework", "Done"] as Status[]).map((status) => {
            const groupTasks = tasks.filter((t) => t.status === status);
            const isOpen = openGroups.has(status);

            return (
              <div key={status} className="mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-background border-b border-border/30 sticky top-0 z-10">
                  <button
                    type="button"
                    onClick={() => toggleGroup(status)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    )}
                    {getStatusBadge(status, true)}
                    <span className="text-xs text-muted-foreground font-semibold ml-1">{groupTasks.length}</span>
                  </button>
                </div>

                {isOpen && (
                  <>
                    {groupTasks.length > 0 ? renderColumnHeaders() : null}
                    {groupTasks.map((task) => renderTaskRow(task))}
                    {onAddTask && (
                      <div
                        onClick={() => onAddTask(status)}
                        className="flex min-w-[110rem] items-center gap-2 px-3 py-2 border-b border-border/30 hover:bg-muted/10 transition-colors cursor-pointer group"
                      >
                        {showBulkSelect ? <div className="w-4 shrink-0" /> : null}
                        <div className="w-4 shrink-0" />
                        <div className="w-4 shrink-0" />
                        <Plus className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                          Add Task
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ListStatusSection({
  status,
  filters,
  statusCount,
  isOpen,
  onToggle,
  getStatusBadge,
  renderColumnHeaders,
  renderTaskRow,
  onAddTask,
  showBulkSelect,
}: {
  status: Status;
  filters: StatusColumnFilters;
  statusCount?: number;
  isOpen: boolean;
  onToggle: () => void;
  getStatusBadge: (status: Status, isHeader?: boolean) => React.ReactNode;
  renderColumnHeaders: () => React.ReactNode;
  renderTaskRow: (task: Task, depth?: number) => React.ReactNode;
  onAddTask?: (status: Status, phaseId?: string | null) => void;
  showBulkSelect: boolean;
}) {
  const { tasks, total, hasNextPage, isLoading, isFetching, loadMore } =
    usePaginatedStatusTasks(status, filters, {
      pageSize: 20,
      skip: !isOpen,
    });

  const displayCount =
    typeof statusCount === "number" ? statusCount : isOpen ? total : 0;
  const groupTasks = tasks as unknown as Task[];

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-background border-b border-border/30 sticky top-0 z-10">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {isOpen ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
          {getStatusBadge(status, true)}
          <span className="text-xs text-muted-foreground font-semibold ml-1">
            {displayCount}
          </span>
        </button>
      </div>

      {isOpen && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Spinner size="sm" />
            </div>
          ) : (
            <>
              {groupTasks.length > 0 ? renderColumnHeaders() : null}
              {groupTasks.map((task) => renderTaskRow(task))}
              {hasNextPage && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isFetching}
                  className="flex w-full items-center justify-center gap-1.5 px-3 py-2.5 border-b border-border/30 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-colors disabled:opacity-50"
                >
                  {isFetching ? (
                    <Spinner size="xs" />
                  ) : null}
                  Load more
                  {typeof statusCount === "number" && statusCount > groupTasks.length
                    ? ` (${statusCount - groupTasks.length} left)`
                    : ""}
                </button>
              )}
            </>
          )}
          {onAddTask && (
            <div
              onClick={() => onAddTask(status)}
              className="flex min-w-[110rem] items-center gap-2 px-3 py-2 border-b border-border/30 hover:bg-muted/10 transition-colors cursor-pointer group"
            >
              {showBulkSelect ? <div className="w-4 shrink-0" /> : null}
              <div className="w-4 shrink-0" />
              <div className="w-4 shrink-0" />
              <Plus className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                Add Task
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
