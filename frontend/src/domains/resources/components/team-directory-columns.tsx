"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { EmployeeAvatar } from "@/shared/components/employee-avatar";
import { cn } from "@/shared/utils/cn";
import { formatAllocationDateRange } from "@/domains/projects/utils/allocation-date.utils";
import type { TeamDirectoryMember } from "../types/resources.types";
import { UTILIZATION_CONFIG } from "../utils/resource-ui.config";
import { formatUpcomingLeaveSummary } from "../utils/team-directory.mapper";

type CreateTeamDirectoryColumnsOptions = {
  onSelect: (member: TeamDirectoryMember) => void;
};

export function createTeamDirectoryColumns({
  onSelect,
}: CreateTeamDirectoryColumnsOptions): ColumnDef<TeamDirectoryMember>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => {
        const member = row.original;
        return (
          <button
            type="button"
            onClick={() => onSelect(member)}
            className="flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden text-left"
          >
            <EmployeeAvatar
              name={member.name}
              employeeId={member.id}
              profileImageUrl={member.avatarUrl}
              size="sm"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-sm font-semibold hover:text-primary" title={member.name}>
                {member.name}
              </p>
              <p
                className="truncate text-xs text-muted-foreground"
                title={member.designation}
              >
                {member.designation}
              </p>
            </div>
          </button>
        );
      },
      meta: { className: "min-w-[190px] max-w-[280px]", label: "Name" },
    },
    {
      id: "department",
      accessorKey: "department",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
      cell: ({ row }) => (
        <span
          className="block truncate text-sm text-muted-foreground"
          title={row.original.department}
        >
          {row.original.department}
        </span>
      ),
      meta: { className: "min-w-[120px] max-w-[200px]", label: "Department" },
    },
    {
      id: "designation",
      accessorKey: "designation",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Designation" />,
      cell: ({ row }) => (
        <span
          className="block truncate text-sm text-muted-foreground"
          title={row.original.designation}
        >
          {row.original.designation}
        </span>
      ),
      meta: { className: "min-w-[140px] max-w-[220px]", label: "Designation" },
    },
    {
      id: "manager",
      accessorKey: "manager",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Reports To" />,
      cell: ({ row }) => (
        <span
          className="block truncate text-sm text-muted-foreground"
          title={row.original.manager || "—"}
        >
          {row.original.manager || "—"}
        </span>
      ),
      meta: { className: "min-w-[140px] max-w-[220px]", label: "Reports To" },
    },
    {
      id: "utilization",
      accessorKey: "utilization",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Utilization" />,
      cell: ({ row }) => {
        const member = row.original;
        const util = UTILIZATION_CONFIG[member.utilStatus];
        return (
          <div className="min-w-[100px] space-y-1">
            <span className="text-sm font-semibold">{member.utilization}%</span>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", util.bar)}
                style={{ width: `${Math.min(member.utilization, 100)}%` }}
              />
            </div>
            <span
              className={cn(
                "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                util.bg,
                util.text,
                util.border,
              )}
            >
              {util.label}
            </span>
          </div>
        );
      },
      meta: { className: "min-w-[120px]", label: "Utilization" },
    },
    {
      id: "allocatedHours",
      accessorKey: "allocatedHours",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Allocated" />,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.allocatedHours}h/wk</span>
      ),
      meta: { className: "min-w-[95px]", label: "Allocated" },
    },
    {
      id: "remainingHours",
      accessorKey: "remainingHours",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Remaining" />,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.remainingHours}h/wk</span>
      ),
      meta: { className: "min-w-[95px]", label: "Remaining" },
    },
    {
      id: "upcomingLeave",
      accessorFn: (row) => row.upcomingLeave.length,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Leave" />,
      enableSorting: false,
      cell: ({ row }) => {
        const label = formatUpcomingLeaveSummary(row.original.upcomingLeave);
        if (!label) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        return (
          <span
            className="line-clamp-2 text-xs font-medium text-amber-700 dark:text-amber-400"
            title={label}
          >
            {label.replace(/^On leave:\s*/, "")}
          </span>
        );
      },
      meta: { className: "min-w-[110px]", label: "Leave" },
    },
    {
      id: "projects",
      accessorFn: (row) => row.projects.length,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Projects" />,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.projects.length}</span>
      ),
      meta: { className: "min-w-[80px]", label: "Projects" },
    },
    {
      id: "assignments",
      accessorFn: (row) => row.assignments.length,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Allocations" />,
      enableSorting: false,
      cell: ({ row }) => {
        const { assignments } = row.original;
        if (assignments.length === 0) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }

        return (
          <div className="max-w-[320px] space-y-1">
            {assignments.map((assignment) => (
              <p
                key={`${assignment.project}-${assignment.startDate}-${assignment.role}`}
                className="truncate text-xs text-muted-foreground"
                title={`${assignment.project} · ${formatAllocationDateRange(assignment.startDate, assignment.endDate)}`}
              >
                <span className="font-medium text-foreground">{assignment.project}</span>
                {" · "}
                {formatAllocationDateRange(assignment.startDate, assignment.endDate)}
              </p>
            ))}
          </div>
        );
      },
      meta: { className: "min-w-[220px]", label: "Allocations" },
    },
  ];
}
