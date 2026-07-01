"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Calendar, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { cn } from "@/shared/utils/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { Project } from "../../types/projects.types";
import {
  DEFAULT_PROJECT_DEPT_COLOR,
  formatProjectTimeline,
  PROJECT_DEPT_COLOR,
} from "../../utils/project-display.utils";
import { formatProjectBudgetCompact } from "../../utils/format-budget";
import { EmployeeTooltip } from "../shared/employee-tooltip";

import { PROJECT_STATUS_CONFIG } from "../../utils/project-status";

const STATUS_CONFIG = PROJECT_STATUS_CONFIG;

export type ProjectListRow = Project & {
  description: string;
  progress: number;
  tasksTotal: number;
  tasksDone: number;
  milestonesTotal: number;
  milestonesDone: number;
  risks: number;
  budget: number;
  budgetUsed: number;
  budgetRemaining: number;
  team: Array<{ initials: string; color: string; user?: any; roleName?: string }>;
};

type CreateProjectListColumnsOptions = {
  onNavigate: (projectId: string) => void;
  onEdit?: (project: Project) => void;
  onDelete?: (project: ProjectListRow) => void;
  projectSheetActionLabel?: string;
  showBudget?: boolean;
};

export function createProjectListColumns({
  onNavigate,
  onEdit,
  onDelete,
  projectSheetActionLabel = "Edit",
  showBudget = true,
}: CreateProjectListColumnsOptions): ColumnDef<ProjectListRow>[] {
  const columns: ColumnDef<ProjectListRow>[] = [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Project" />,
      cell: ({ row }) => {
        const project = row.original;
        return (
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onNavigate(project.id)}
              className="truncate text-left text-sm font-semibold hover:text-primary transition-colors"
            >
              {project.name}
            </button>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {project.description}
            </p>
          </div>
        );
      },
      meta: { className: "min-w-[200px]", label: "Project" },
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const project = row.original;
        const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.Draft;
        return (
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
              status.bg,
              status.text,
              status.border,
            )}
          >
            <span className={cn("size-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
        );
      },
      meta: { className: "w-[110px]", label: "Status" },
    },
    {
      id: "department",
      accessorFn: (row) => row.department?.name ?? "",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
      cell: ({ row }) => {
        const deptName = row.original.department?.name ?? "";
        return (
          <span
            className={cn(
              "inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold",
              PROJECT_DEPT_COLOR[deptName] || DEFAULT_PROJECT_DEPT_COLOR,
            )}
          >
            {deptName || "Direct"}
          </span>
        );
      },
      meta: { className: "min-w-[140px]", label: "Department" },
    },
    {
      id: "team",
      accessorFn: (row) => row.team.length,
      enableSorting: false,
      header: () => <span className="text-sm font-medium text-muted-foreground">Team</span>,
      cell: ({ row }) => {
        const project = row.original;
        if (project.team.length === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex items-center -space-x-1.5">
            {project.team.slice(0, 4).map((member, index) => (
              <EmployeeTooltip
                key={index}
                employee={{
                  displayName: member.user?.displayName,
                  email: member.user?.email,
                  role: member.roleName,
                  designation: "Project Manager",
                }}
              >
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full border-2 border-background text-[9px] font-bold text-primary-foreground cursor-default",
                    member.color,
                  )}
                >
                  {member.initials}
                </span>
              </EmployeeTooltip>
            ))}
          </div>
        );
      },
      meta: { className: "w-[88px]", label: "Team" },
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
                className="h-full rounded-full bg-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-end text-[11px] font-bold text-foreground">
              {progress}%
            </span>
          </div>
        );
      },
      meta: { label: "Progress" },
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
      meta: { className: "w-[80px]", label: "Tasks" },
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
      meta: { className: "w-[100px]", label: "Milestones" },
    },
    {
      id: "risks",
      accessorFn: (row) => row.risks,
      enableSorting: false,
      header: () => <span className="text-sm font-medium text-muted-foreground">Risks</span>,
      cell: ({ row }) => (
        <div className="text-xs font-semibold text-foreground">{row.original.risks}</div>
      ),
      meta: { className: "w-[64px]", label: "Risks" },
    },
    ...(showBudget
      ? [
          {
            id: "budget",
            accessorFn: (row: ProjectListRow) => row.budgetUsed,
            enableSorting: false,
            header: () => <span className="text-sm font-medium text-muted-foreground">Budget</span>,
            cell: ({ row }: { row: { original: ProjectListRow } }) => {
              const project = row.original;
              if (project.budget <= 0) {
                return <span className="text-xs text-muted-foreground">—</span>;
              }
              const overBudget = project.budgetUsed > project.budget;
              return (
                <div className="min-w-[100px]">
                  <span className={cn("text-xs font-semibold", overBudget ? "text-rose-500" : "text-foreground")}>
                    {formatProjectBudgetCompact(project.budgetUsed, project.currency)}
                    <span className="font-normal text-muted-foreground">
                      {" "}/ {formatProjectBudgetCompact(project.budget, project.currency)}
                    </span>
                  </span>
                </div>
              );
            },
            meta: { className: "w-[120px]", label: "Budget" },
          } as ColumnDef<ProjectListRow>,
        ]
      : []),
    {
      id: "startDate",
      accessorKey: "startDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Timeline" />,
      cell: ({ row }) => {
        const project = row.original;
        return (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="size-3 shrink-0" />
            <span>{formatProjectTimeline(project.startDate, project.endDate)}</span>
          </div>
        );
      },
      meta: { className: "min-w-[150px]", label: "Timeline" },
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
            <DropdownMenuContent align="end" className="w-40" onClick={(event) => event.stopPropagation()}>
              {onEdit && (
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(project);
                  }}
                >
                  <Pencil className="size-3.5" />
                  {projectSheetActionLabel}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(project);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      meta: { className: "w-[48px] text-right", sticky: "right", enableColumnReorder: false, label: "Actions" },
    });
  }

  return columns;
}
