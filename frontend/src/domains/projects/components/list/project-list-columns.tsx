"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { cn } from "@/shared/utils/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { PriorityLevel, Project } from "../../types/projects.types";
import { EmployeeTooltip } from "../shared/employee-tooltip";

const STATUS_CONFIG: Record<string, {
  label: string; dot: string; text: string; bg: string; border: string
}> = {
  Active: {
    label: "Active",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  OnHold: {
    label: "On Hold",
    dot: "bg-amber-400",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
  },
  PendingClosure: {
    label: "At Risk",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
  },
  Closed: {
    label: "Completed",
    dot: "bg-primary",
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
  },
  Draft: {
    label: "Draft",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
  },
};

const PRIORITY_CONFIG: Record<PriorityLevel, { label: string; bg: string; text: string }> = {
  Critical: { label: "Critical", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400" },
  High: { label: "High", bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400" },
  Medium: { label: "Medium", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400" },
  Low: { label: "Low", bg: "bg-slate-50 dark:bg-slate-900/20", text: "text-slate-600 dark:text-slate-400" },
};

export type ProjectListRow = Project & {
  description: string;
  progress: number;
  tasksTotal: number;
  tasksDone: number;
  milestonesTotal: number;
  milestonesDone: number;
  team: Array<{ initials: string; color: string; user?: any; roleName?: string }>;
};

type CreateProjectListColumnsOptions = {
  onNavigate: (projectId: string) => void;
  onEdit?: (project: Project) => void;
  onDelete?: (project: ProjectListRow) => void;
};

export function createProjectListColumns({
  onNavigate,
  onEdit,
  onDelete,
}: CreateProjectListColumnsOptions): ColumnDef<ProjectListRow>[] {
  const columns: ColumnDef<ProjectListRow>[] = [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Project" />,
      cell: ({ row }) => {
        const project = row.original;
        const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.Draft;
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate(project.id)}
                className="truncate text-left text-sm font-semibold hover:text-primary transition-colors"
              >
                {project.name}
              </button>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold",
                  status.bg,
                  status.text,
                  status.border,
                )}
              >
                <span className={cn("size-1.5 rounded-full", status.dot)} />
                {status.label}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{project.description}</p>
          </div>
        );
      },
      meta: { className: "min-w-[220px]" },
    },
    {
      id: "primaryPm",
      accessorFn: (row) => row.primaryPm?.displayName ?? "",
      header: ({ column }) => <DataTableColumnHeader column={column} title="PM" />,
      cell: ({ row }) => {
        const project = row.original;
        return (
          <div className="flex min-w-0 items-center gap-2">
            <EmployeeTooltip
              employee={{
                displayName: project.primaryPm?.displayName,
                email: project.primaryPm?.email,
                role: "Primary Project Manager",
                designation: "Project Manager",
              }}
            >
              <span
                className={cn(
                  "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-primary-foreground cursor-default",
                  project.team[0]?.color || "bg-primary",
                )}
              >
                {project.team[0]?.initials || "PM"}
              </span>
            </EmployeeTooltip>
            <span className="truncate text-xs text-muted-foreground">
              {project.primaryPm?.displayName || "Unassigned"}
            </span>
          </div>
        );
      },
      meta: { className: "min-w-[140px]" },
    },
    {
      id: "priority",
      accessorKey: "priority",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Priority" />,
      cell: ({ row }) => {
        const priority =
          PRIORITY_CONFIG[row.original.priority as PriorityLevel] ?? PRIORITY_CONFIG.Medium;
        return (
          <span className={cn("w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold", priority.bg, priority.text)}>
            {priority.label}
          </span>
        );
      },
      meta: { className: "w-[110px]" },
    },
    {
      id: "progress",
      accessorFn: (row) => row.progress,
      enableSorting: false,
      header: () => <span className="text-sm font-medium text-muted-foreground">Progress</span>,
      cell: ({ row }) => {
        const progress = row.original.progress;
        return (
          <div className="flex min-w-[120px] items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  progress >= 80
                    ? "bg-emerald-500"
                    : progress >= 50
                      ? "bg-primary"
                      : progress >= 30
                        ? "bg-amber-400"
                        : "bg-rose-400",
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-end text-[11px] font-bold text-foreground">
              {progress}%
            </span>
          </div>
        );
      },
    },
    {
      id: "startDate",
      accessorKey: "startDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Timeline" />,
      cell: ({ row }) => {
        const project = row.original;
        return (
          <div className="text-[10px] text-muted-foreground">
            <div>{project.startDate ? project.startDate.slice(0, 10) : "—"}</div>
            <div className="text-muted-foreground/60">
              → {project.endDate ? project.endDate.slice(0, 10) : "—"}
            </div>
          </div>
        );
      },
      meta: { className: "w-[120px]" },
    },
    {
      id: "tasks",
      accessorFn: (row) => row.tasksDone,
      enableSorting: false,
      header: () => <span className="text-sm font-medium text-muted-foreground">Tasks</span>,
      cell: ({ row }) => (
        <div className="text-xs font-semibold text-foreground">
          {row.original.tasksDone}
          <span className="font-normal text-muted-foreground">/{row.original.tasksTotal}</span>
        </div>
      ),
      meta: { className: "w-[80px]" },
    },
    {
      id: "milestones",
      accessorFn: (row) => row.milestonesDone,
      enableSorting: false,
      header: () => <span className="text-sm font-medium text-muted-foreground">Milestones</span>,
      cell: ({ row }) => (
        <div className="text-xs font-semibold text-foreground">
          {row.original.milestonesDone}
          <span className="font-normal text-muted-foreground">/{row.original.milestonesTotal}</span>
        </div>
      ),
      meta: { className: "w-[100px]" },
    },
  ];

  if (onEdit || onDelete) {
    columns.push({
      id: "actions",
      header: () => null,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const project = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="rounded-lg p-1 text-muted-foreground opacity-60 transition-all hover:bg-muted/65 hover:text-foreground hover:opacity-100 data-popup-open:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onEdit && (
                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onEdit(project)}>
                  <Pencil className="size-3.5" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                  onClick={() => onDelete(project)}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      meta: { className: "w-[48px] text-right", sticky: "right" },
    });
  }

  return columns;
}
