"use client";

import { useMemo } from "react";
import { cn } from "@/shared/utils/cn";
import { Circle, CircleCheck, Plus, MoreHorizontal } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { createSelectColumn } from "@/shared/components/data-table-select-column";
import { DataTable } from "@/shared/components/data-table";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

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
}

const STATUS_PILL: Record<Status, string> = {
  "To_Do": "bg-muted text-muted-foreground border border-border/60",
  "In_Progress": "bg-blue-50 text-blue-605 border border-blue-205 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  "Submitted_for_Review": "bg-amber-50 text-amber-605 border border-amber-205 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  "Approved": "bg-teal-50 text-teal-605 border border-teal-205 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800",
  "Rework": "bg-rose-50 text-rose-605 border border-rose-205 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800",
  "Done": "bg-emerald-50 text-emerald-605 border border-emerald-205 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  critical: "text-red-600 dark:text-red-400 font-bold",
  high: "text-rose-500",
  medium: "text-amber-500",
  low: "text-muted-foreground/50",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
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
}

export function TableView({
  tasks,
  toggleTask,
  onTaskClick,
  onAddTask,
  onDeleteTask,
  onDuplicateTask,
  onMoveTask,
  onSetDueDate,
}: TableViewProps) {
  const columns = useMemo((): ColumnDef<Task>[] => [
    createSelectColumn<Task>(),
    {
      id: "title",
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const task = row.original;
        return (
          <div className="flex items-center gap-2">
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
                task.done && "line-through text-muted-foreground"
              )}
            >
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
        return (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center justify-center size-6 rounded-full text-[10px] font-bold text-white shrink-0",
                task.assigneeColor
              )}
            >
              {task.assigneeInitials}
            </span>
            <span className="text-xs text-muted-foreground">{task.assigneeInitials}</span>
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
            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-md", STATUS_PILL[task.status] || STATUS_PILL["To_Do"])}>
              {task.status === "To_Do"
                ? "To Do"
                : task.status === "In_Progress"
                ? "In Progress"
                : task.status === "Submitted_for_Review"
                ? "Submitted for Review"
                : task.status === "Approved"
                ? "Approved"
                : task.status === "Rework"
                ? "Rework"
                : "Done"}
            </span>
          </div>
        );
      },
    },
    {
      id: "dueDate",
      accessorKey: "dueDate",
      header: "Due date",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.dueDate}</span>,
    },
    {
      id: "priority",
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <span className={cn("text-xs font-medium", PRIORITY_STYLES[row.original.priority])}>
          {PRIORITY_LABEL[row.original.priority]}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const task = row.original;
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
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onClick={() => onDuplicateTask?.(task.id)}
              >
                Duplicate
              </DropdownMenuItem>
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
  ], [toggleTask, onTaskClick, onDuplicateTask, onDeleteTask]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      {/* Table */}
      <div className="flex-1 overflow-auto p-5">
        <DataTable
          columns={columns}
          data={tasks}
          hideSearch={true}
          emptyMessage="No tasks found"
        />
      </div>
    </div>
  );
}
