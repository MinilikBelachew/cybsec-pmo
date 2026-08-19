"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/utils/cn";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  Flag,
  MoreHorizontal,
  User,
} from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import type { TaskDependency } from "@/domains/projects/types/tasks.types";
import { type ProjectMilestone, type ProjectPhase, type ProjectTaskAssignee } from "../../../types/projects.types";
import {
  API_PRIORITY_OPTIONS,
  getPriorityColors,
  type ApiPriority,
} from "./task-cell-pickers";
import { TaskDependenciesPicker } from "./task-predecessors-cell";
import { nestedDepthLabel } from "@/domains/projects/utils/map-task-to-gantt";

type Status = "To_Do" | "In_Progress" | "Submitted_for_Review" | "Approved" | "Rework" | "Done";
type Priority = "high" | "medium" | "low" | "critical";

interface Task {
  id: string;
  name: string;
  assigneeInitials: string;
  assigneeColor: string;
  dueDate: string;
  rawStartDate?: string | null;
  priority: Priority;
  status: Status;
  hasSubtasks?: boolean;
  done: boolean;
  owner?: { id: string; displayName: string; email: string };
  parentTaskId?: string | null;
  depth?: number;
  children?: Task[];
  phaseId?: string | null;
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
  rowKind?: "phase" | "milestone" | "task";
  phaseColor?: string;
  /** Task nest level for Sub/Sub² labels — independent of phase indent. */
  nestLabelDepth?: number;
}

const STATUS_PILL: Record<Status, string> = {
  To_Do: "bg-muted text-muted-foreground border border-border/60",
  In_Progress:
    "bg-blue-50 text-blue-605 border border-blue-205 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  Submitted_for_Review:
    "bg-amber-50 text-amber-605 border border-amber-205 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  Approved:
    "bg-teal-50 text-teal-605 border border-teal-205 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800",
  Rework:
    "bg-rose-50 text-rose-605 border border-rose-205 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800",
  Done: "bg-emerald-50 text-emerald-605 border border-emerald-205 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_LABEL: Record<Status, string> = {
  To_Do: "To Do",
  In_Progress: "In Progress",
  Submitted_for_Review: "Submitted for Review",
  Approved: "Approved",
  Rework: "Rework",
  Done: "Done",
};

function formatShortDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function phaseRowId(phaseId: string) {
  return `phase:${phaseId}`;
}

function groupingRow(
  partial: Pick<Task, "id" | "name" | "rowKind" | "depth" | "dueDate"> & {
    phaseColor?: string;
    rawStartDate?: string | null;
    hasSubtasks?: boolean;
  },
): Task {
  return {
    assigneeInitials: "",
    assigneeColor: "",
    priority: "medium",
    status: "To_Do",
    done: false,
    ...partial,
  };
}

function isTaskRow(row: Task) {
  return (row.rowKind ?? "task") === "task";
}

function groupingDash(row: Task) {
  if (isTaskRow(row)) return null;
  return <span className="text-xs text-muted-foreground">—</span>;
}

interface TableViewProps {
  tasks: Task[];
  projectId?: string;
  phases?: ProjectPhase[];
  milestones?: ProjectMilestone[];
  toggleTask: (id: string) => void;
  onTaskClick?: (taskId: string) => void;
  onAddTask?: (status: Status) => void;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
  onMoveTask?: (taskId: string, toStatus: Status) => void;
  onSetDueDate?: (taskId: string, date: string | null) => void;
  assignees?: ProjectTaskAssignee[];
  canAssignTask?: boolean;
  canBulkEdit?: boolean;
  onBulkAssign?: (taskIds: string[], ownerId: string | null) => Promise<void>;
  onBulkStatus?: (taskIds: string[], status: Status) => Promise<void>;
  onBulkPriority?: (taskIds: string[], priority: ApiPriority) => Promise<void>;
  onBulkDelete?: (taskIds: string[]) => void;
  dependencies?: TaskDependency[];
  /** Waterfall: Phase → Milestone → Task tree. Agile/Hybrid: flat task grid. */
  wbsTree?: boolean;
}

export function TableView({
  tasks,
  projectId,
  phases = [],
  milestones = [],
  toggleTask,
  onTaskClick,
  onDeleteTask,
  onDuplicateTask,
  assignees = [],
  canAssignTask = false,
  canBulkEdit = false,
  onBulkAssign,
  onBulkStatus,
  onBulkPriority,
  onBulkDelete,
  dependencies = [],
  wbsTree = false,
}: TableViewProps) {
  const [expandedParents, setExpandedParents] = useState<Set<string>>(() => new Set());
  const [bulkActive, setBulkActive] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Task[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const { canEditDependencies } = useModulePermissions();

  useEffect(() => {
    const ids: string[] = [];
    if (wbsTree) {
      for (const phase of phases) ids.push(phaseRowId(phase.id));
      if (tasks.some((t) => !t.phaseId) || milestones.some((m) => !m.phaseId)) {
        ids.push(phaseRowId("unassigned"));
      }
    }
    const walk = (t: Task) => {
      if ((t.children?.length ?? 0) > 0 || Boolean(t.hasSubtasks)) ids.push(t.id);
      for (const c of t.children ?? []) walk(c);
    };
    for (const t of tasks) walk(t);
    if (ids.length === 0) return;
    setExpandedParents((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tasks, phases, milestones, wbsTree]);

  const planGroups = useMemo(() => {
    const sortedPhases = [...phases].sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      return a.name.localeCompare(b.name);
    });
    const byTarget = (a: ProjectMilestone, b: ProjectMilestone) =>
      new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();

    const groups = sortedPhases.map((phase) => ({
      id: phase.id,
      name: phase.name,
      color: "#8b5cf6",
      startDate: phase.startDate,
      endDate: phase.endDate,
      tasks: tasks.filter((t) => t.phaseId === phase.id),
      milestones: milestones.filter((m) => m.phaseId === phase.id).sort(byTarget),
    }));

    const unassignedTasks = tasks.filter((t) => !t.phaseId);
    const unassignedMilestones = milestones.filter((m) => !m.phaseId).sort(byTarget);
    if (unassignedTasks.length > 0 || unassignedMilestones.length > 0) {
      groups.push({
        id: "unassigned",
        name: "Unassigned",
        color: "#64748b",
        startDate: "",
        endDate: "",
        tasks: unassignedTasks,
        milestones: unassignedMilestones,
      });
    }
    return groups;
  }, [phases, milestones, tasks]);

  const flatRows = useMemo(() => {
    const rows: Task[] = [];
    const walkTask = (task: Task, depth: number, nestLevel: number) => {
      rows.push({ ...task, rowKind: "task", depth, nestLabelDepth: nestLevel });
      if ((task.children?.length ?? 0) > 0 && expandedParents.has(task.id)) {
        for (const child of task.children ?? []) {
          walkTask(
            { ...child, parentTaskId: child.parentTaskId ?? task.id },
            depth + 1,
            nestLevel + 1,
          );
        }
      }
    };

    if (!wbsTree) {
      for (const task of tasks) walkTask(task, 0, 0);
      return rows;
    }

    for (const group of planGroups) {
      const pid = phaseRowId(group.id);
      rows.push(
        groupingRow({
          id: pid,
          name: group.name,
          rowKind: "phase",
          depth: 0,
          dueDate: formatShortDate(group.endDate),
          rawStartDate: group.startDate || null,
          phaseColor: group.color,
          hasSubtasks: true,
        }),
      );
      if (!expandedParents.has(pid)) continue;
      for (const milestone of group.milestones) {
        rows.push(
          groupingRow({
            id: `ms:${milestone.id}`,
            name: milestone.title,
            rowKind: "milestone",
            depth: 1,
            dueDate: formatShortDate(milestone.targetDate),
            rawStartDate: milestone.targetDate,
            hasSubtasks: false,
          }),
        );
      }
      for (const task of group.tasks) walkTask(task, 1, 0);
    }
    return rows;
  }, [planGroups, expandedParents, tasks, wbsTree]);

  const toggleParentExpand = (taskId: string, e?: { stopPropagation: () => void }) => {
    e?.stopPropagation();
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectedIds = useMemo(
    () => selectedRows.filter(isTaskRow).map((t) => t.id),
    [selectedRows],
  );

  const runBulkAssign = async (ownerId: string | null) => {
    if (!onBulkAssign || selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await onBulkAssign(selectedIds, ownerId);
      setBulkActive(false);
      setSelectedRows([]);
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkStatus = async (status: Status) => {
    if (!onBulkStatus || selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await onBulkStatus(selectedIds, status);
      setBulkActive(false);
      setSelectedRows([]);
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkPriority = async (priority: ApiPriority) => {
    if (!onBulkPriority || selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await onBulkPriority(selectedIds, priority);
      setBulkActive(false);
      setSelectedRows([]);
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkDelete = () => {
    if (!onBulkDelete || selectedIds.length === 0) return;
    onBulkDelete(selectedIds);
    setBulkActive(false);
    setSelectedRows([]);
  };

  const bulkActions =
    selectedIds.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {selectedIds.length} selected
        </span>
        {canAssignTask && onBulkAssign ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={bulkBusy}
              className="h-8 px-2.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted disabled:opacity-50 cursor-pointer"
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
              className="h-8 px-2.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted disabled:opacity-50 cursor-pointer"
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
              className="h-8 px-2.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted disabled:opacity-50 cursor-pointer"
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
            className="h-8 px-2.5 rounded-md border border-rose-200 text-rose-600 text-xs font-medium hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
          >
            Delete
          </button>
        ) : null}
      </div>
    ) : null;

  const columns = useMemo((): ColumnDef<Task>[] => {
    const cols: ColumnDef<Task>[] = [];
    if (canBulkEdit) {
      cols.push({
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={table.getIsAllPageRowsSelected()}
              onChange={(event) => table.toggleAllPageRowsSelected(event.target.checked)}
              aria-label="Select all rows"
              className="rounded border-slate-300 accent-primary size-3.5"
            />
          </div>
        ),
        cell: ({ row }) =>
          isTaskRow(row.original) ? (
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={row.getIsSelected()}
                onChange={(event) => row.toggleSelected(event.target.checked)}
                aria-label="Select row"
                className="rounded border-slate-300 accent-primary size-3.5"
              />
            </div>
          ) : null,
        enableSorting: false,
        enableHiding: false,
        meta: { sticky: "left", className: "w-12 px-0" },
      });
    }
    cols.push(
      {
        id: "title",
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const task = row.original;
          const kind = task.rowKind ?? "task";
          const depth = task.depth ?? 0;
          const children = task.children ?? [];
          const hasChildren =
            kind === "phase" || children.length > 0 || Boolean(task.hasSubtasks);
          const isExpanded = expandedParents.has(task.id);
          const nestLabel = kind === "task" ? nestedDepthLabel(task.nestLabelDepth ?? 0) : null;

          return (
            <div
              className="flex w-full max-w-[18rem] items-center gap-2 overflow-hidden"
              style={{ paddingLeft: Math.min(depth, 10) * 16 }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => toggleParentExpand(task.id, e)}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </button>
              ) : kind === "milestone" ? (
                <Flag className="size-3.5 shrink-0 text-primary" />
              ) : depth > 0 ? (
                <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0 ml-1" />
              ) : (
                <span className="w-4 shrink-0" />
              )}
              {kind === "task" ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTask(task.id);
                  }}
                  className="shrink-0 mt-0.5"
                  aria-label="Toggle status"
                >
                  {task.done ? (
                    <CircleCheck className="size-4 text-emerald-500" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>
              ) : kind === "phase" ? (
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: task.phaseColor ?? "#8b5cf6" }}
                />
              ) : null}
              <TooltipProvider delay={300}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => {
                          if (kind === "task") onTaskClick?.(task.id);
                        }}
                        className={cn(
                          "min-w-0 flex-1 truncate text-left text-sm font-medium",
                          kind === "task" && "hover:text-primary transition-colors",
                          kind === "phase" && "uppercase tracking-wide font-semibold",
                          kind === "milestone" && "font-medium",
                          task.done && kind === "task" && "line-through text-muted-foreground",
                          kind === "task" && depth > 0 && "font-normal",
                        )}
                      />
                    }
                  >
                    {kind === "milestone" && (
                      <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Milestone
                      </span>
                    )}
                    {nestLabel && (
                      <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {nestLabel}
                      </span>
                    )}
                    {task.name}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-sm break-words">
                    {task.name}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
        size: 280,
        meta: { className: "w-[18rem] max-w-[18rem]" },
      },
      {
        id: "dependencies",
        header: "Deps",
        cell: ({ row }) => {
          const dash = groupingDash(row.original);
          if (dash) return dash;
          return (
          <div onClick={(e) => e.stopPropagation()}>
            <TaskDependenciesPicker
              taskId={row.original.id}
              projectId={projectId!}
              dependencies={dependencies}
              canEdit={canEditDependencies}
            />
          </div>
          );
        },
        meta: { className: "w-[4.5rem]" },
      },
      {
        id: "assignee",
        accessorKey: "assigneeInitials",
        header: "Assignee",
        cell: ({ row }) => {
          const dash = groupingDash(row.original);
          if (dash) return dash;
          const task = row.original;
          const isUnassigned = !task.owner?.id;
          if (isUnassigned) {
            return (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center size-6 rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 shrink-0">
                  <User className="size-3.5" />
                </span>
                <span className="text-xs text-muted-foreground">Unassigned</span>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center justify-center size-6 rounded-full text-[10px] font-bold text-white shrink-0",
                  task.assigneeColor,
                )}
              >
                {task.assigneeInitials}
              </span>
              <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                {task.owner?.displayName ?? task.assigneeInitials}
              </span>
            </div>
          );
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const dash = groupingDash(row.original);
          if (dash) return dash;
          const task = row.original;
          return (
            <div className="flex items-center gap-1.5">
              {task.status === "Done" || task.status === "Approved" ? (
                <CircleCheck className="size-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="size-3.5 text-muted-foreground shrink-0" />
              )}
              <span
                className={cn(
                  "text-[11px] font-semibold px-2 py-0.5 rounded-md",
                  STATUS_PILL[task.status] || STATUS_PILL.To_Do,
                )}
              >
                {STATUS_LABEL[task.status] || task.status}
              </span>
            </div>
          );
        },
      },
      {
        id: "dueDate",
        accessorKey: "dueDate",
        header: "Due date",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.dueDate}</span>
        ),
      },
      {
        id: "priority",
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => {
          const dash = groupingDash(row.original);
          if (dash) return dash;
          return (
          <span
            className={cn(
              "text-xs font-medium",
              getPriorityColors(row.original.priority).text,
            )}
          >
            {PRIORITY_LABEL[row.original.priority]}
          </span>
          );
        },
      },
      {
        id: "plannedHours",
        header: "Planned",
        cell: ({ row }) => {
          const planned = row.original.effortHours;
          return (
            <span className="text-xs text-muted-foreground tabular-nums">
              {planned != null && planned > 0 ? `${planned}h` : "—"}
            </span>
          );
        },
      },
      {
        id: "loggedHours",
        header: "Logged",
        cell: ({ row }) => {
          const logged = row.original.actualHoursLogged ?? 0;
          return (
            <span
              className={cn(
                "text-xs tabular-nums",
                row.original.isOverEffort
                  ? "font-semibold text-amber-700 dark:text-amber-300"
                  : "text-muted-foreground",
              )}
            >
              {logged > 0 || (row.original.effortHours ?? 0) > 0
                ? `${logged}h`
                : "—"}
            </span>
          );
        },
      },
      {
        id: "effortVariance",
        header: "Variance",
        cell: ({ row }) => {
          const variance = row.original.effortVarianceHours;
          if (variance == null || row.original.effortHours == null) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                row.original.isOverEffort
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-muted-foreground",
              )}
              title={
                row.original.isOverEffort
                  ? "Logged hours exceed planned effort"
                  : (row.original.actualHoursLogged ?? 0) === 0
                    ? "No variance until hours are logged"
                    : "Hours remaining (planned − logged)"
              }
            >
              {variance}h
              {row.original.isOverEffort ? " ⚠" : ""}
            </span>
          );
        },
      },
      {
        id: "planStart",
        header: "Plan start",
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground" title="Planned start">
            {row.original.rawStartDate
              ? new Date(row.original.rawStartDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "—"}
          </span>
        ),
      },
      {
        id: "baselineStart",
        header: "BL start",
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground" title="Baseline start">
            {row.original.baselineStartLabel || "—"}
          </span>
        ),
      },
      {
        id: "baselineEnd",
        header: "BL end",
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground" title="Baseline end">
            {row.original.baselineEndLabel || "—"}
          </span>
        ),
      },
      {
        id: "baselineDuration",
        header: "BL d",
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground" title="Baseline duration">
            {row.original.baselineDurationDays == null
              ? "—"
              : `${row.original.baselineDurationDays}d`}
          </span>
        ),
      },
      {
        id: "actualStart",
        header: "Act start",
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground" title="Actual start">
            {row.original.actualStartLabel || "—"}
          </span>
        ),
      },
      {
        id: "actualEnd",
        header: "Act end",
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground" title="Actual end">
            {row.original.actualEndLabel || "—"}
          </span>
        ),
      },
      {
        id: "actualDuration",
        header: "Act d",
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground" title="Actual duration">
            {row.original.actualDurationDays == null
              ? "—"
              : `${row.original.actualDurationDays}d`}
          </span>
        ),
      },
      {
        id: "scheduleVariance",
        header: "Sched",
        cell: ({ row }) => {
          const variance = row.original.scheduleVarianceDays;
          if (variance == null) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          const sign = variance > 0 ? "+" : "";
          return (
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                variance > 0
                  ? "text-amber-700 dark:text-amber-300"
                  : variance < 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground",
              )}
              title="Schedule variance vs baseline end (days)"
            >
              {sign}
              {variance}d
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          if (!isTaskRow(row.original)) return null;
          const task = row.original;
          const nestLevel = task.nestLabelDepth ?? 0;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  />
                }
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onClick={() => onTaskClick?.(task.id)}
                >
                  Edit task
                </DropdownMenuItem>
                {nestLevel === 0 ? (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() => onDuplicateTask?.(task.id)}
                  >
                    Duplicate
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                  onClick={() => onDeleteTask?.(task.id)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        meta: { sticky: "right" },
      },
    );
    return cols;
  }, [
    canBulkEdit,
    expandedParents,
    toggleTask,
    onTaskClick,
    onDuplicateTask,
    onDeleteTask,
    projectId,
    dependencies,
    canEditDependencies,
  ]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      <div className="flex-1 overflow-auto p-5">
        <DataTable
          columns={columns}
          data={flatRows}
          getRowId={(row) => row.id}
          searchKey="title"
          hideSearch
          emptyMessage="No tasks found"
          mobileLayout="scroll"
          minTableWidth="min-w-[1400px]"
          tableClassName="table-auto"
          pageSize={wbsTree ? 50 : 20}
          pageSizeOptions={wbsTree ? [25, 50, 100, 200] : [5, 10, 20]}
          onSelectionChange={bulkActive ? setSelectedRows : undefined}
          bulkSelect={
            canBulkEdit
              ? {
                  active: bulkActive,
                  onActiveChange: (active) => {
                    setBulkActive(active);
                    if (!active) setSelectedRows([]);
                  },
                  actions: bulkActions,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
