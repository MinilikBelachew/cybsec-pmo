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
import { createSelectColumn } from "@/shared/components/data-table-select-column";
import { DataTable } from "@/shared/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { type ProjectTaskAssignee } from "../../../types/projects.types";
import {
  API_PRIORITY_OPTIONS,
  getPriorityColors,
  type ApiPriority,
} from "./task-cell-pickers";

type Status = "To_Do" | "In_Progress" | "Submitted_for_Review" | "Approved" | "Rework" | "Done";
type Priority = "high" | "medium" | "low" | "critical";

interface Task {
  id: string;
  name: string;
  assigneeInitials: string;
  assigneeColor: string;
  dueDate: string;
  priority: Priority;
  status: Status;
  hasSubtasks?: boolean;
  done: boolean;
  owner?: { id: string; displayName: string; email: string };
  parentTaskId?: string | null;
  depth?: number;
  children?: Task[];
  effortHours?: number | null;
  actualHoursLogged?: number;
  effortVarianceHours?: number | null;
  isOverEffort?: boolean;
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

interface TableViewProps {
  tasks: Task[];
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
}

export function TableView({
  tasks,
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
}: TableViewProps) {
  const [expandedParents, setExpandedParents] = useState<Set<string>>(() => new Set());
  const [bulkActive, setBulkActive] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Task[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    const withSubs = tasks.filter(
      (t) => (t.children?.length ?? 0) > 0 || Boolean(t.hasSubtasks),
    );
    if (withSubs.length === 0) return;
    setExpandedParents((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const t of withSubs) {
        if (!next.has(t.id)) {
          next.add(t.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tasks]);

  const flatRows = useMemo(() => {
    const rows: Task[] = [];
    for (const task of tasks) {
      rows.push({ ...task, depth: 0 });
      const children = task.children ?? [];
      if (children.length > 0 && expandedParents.has(task.id)) {
        for (const child of children) {
          rows.push({
            ...child,
            depth: 1,
            parentTaskId: child.parentTaskId ?? task.id,
          });
        }
      }
    }
    return rows;
  }, [tasks, expandedParents]);

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
    () => selectedRows.map((t) => t.id),
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
      cols.push(createSelectColumn<Task>());
    }
    cols.push(
      {
        id: "title",
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const task = row.original;
          const depth = task.depth ?? 0;
          const children = task.children ?? [];
          const hasChildren = children.length > 0 || Boolean(task.hasSubtasks);
          const isExpanded = expandedParents.has(task.id);

          return (
            <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
              {depth === 0 && hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => toggleParentExpand(task.id, e)}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                </button>
              ) : depth > 0 ? (
                <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0 ml-1" />
              ) : (
                <span className="w-4 shrink-0" />
              )}
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
              <button
                type="button"
                onClick={() => onTaskClick?.(task.id)}
                className={cn(
                  "text-sm font-medium truncate text-left hover:text-primary transition-colors",
                  task.done && "line-through text-muted-foreground",
                  depth > 0 && "font-normal",
                )}
              >
                {depth > 0 && (
                  <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Sub
                  </span>
                )}
                {task.name}
              </button>
            </div>
          );
        },
      },
      {
        id: "assignee",
        accessorKey: "assigneeInitials",
        header: "Assignee",
        cell: ({ row }) => {
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
        cell: ({ row }) => (
          <span
            className={cn(
              "text-xs font-medium",
              getPriorityColors(row.original.priority).text,
            )}
          >
            {PRIORITY_LABEL[row.original.priority]}
          </span>
        ),
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
          const sign = variance > 0 ? "+" : "";
          return (
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                row.original.isOverEffort
                  ? "text-amber-700 dark:text-amber-300"
                  : variance < 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground",
              )}
              title={
                row.original.isOverEffort
                  ? "Logged hours exceed planned effort"
                  : undefined
              }
            >
              {sign}
              {variance}h
              {row.original.isOverEffort ? " ⚠" : ""}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const task = row.original;
          const depth = task.depth ?? 0;
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
                {depth === 0 ? (
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
