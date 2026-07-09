"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { EmployeeAvatar } from "@/shared/components/employee-avatar";
import { cn } from "@/shared/utils/cn";
import { formatAllocationDateRange } from "@/domains/projects/utils/allocation-date.utils";
import type { TeamDirectoryMember } from "../types/resources.types";
import { UTILIZATION_CONFIG } from "../utils/resource-ui.config";

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
            className="flex min-w-0 items-center gap-2.5 text-left"
          >
            <EmployeeAvatar
              name={member.name}
              employeeId={member.id}
              profileImageUrl={member.avatarUrl}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold hover:text-primary">{member.name}</p>
              <p className="truncate text-xs text-muted-foreground">{member.designation}</p>
            </div>
          </button>
        );
      },
      meta: { label: "Name" },
    },
    {
      id: "designation",
      accessorKey: "designation",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Designation" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.designation}</span>
      ),
      meta: { label: "Designation" },
    },
    {
      id: "department",
      accessorKey: "department",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.department}</span>
      ),
      meta: { label: "Department" },
    },
    {
      id: "utilization",
      accessorKey: "utilization",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Utilization" />,
      cell: ({ row }) => {
        const member = row.original;
        const util = UTILIZATION_CONFIG[member.utilStatus];
        return (
          <div className="min-w-[120px] space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{member.utilization}%</span>
              <span
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                  util.bg,
                  util.text,
                  util.border,
                )}
              >
                {util.label}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", util.bar)}
                style={{ width: `${Math.min(member.utilization, 100)}%` }}
              />
            </div>
          </div>
        );
      },
      meta: { label: "Utilization" },
    },
    {
      id: "allocatedHours",
      accessorKey: "allocatedHours",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Allocated" />,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.allocatedHours}h/wk</span>
      ),
      meta: { label: "Allocated" },
    },
    {
      id: "remainingHours",
      accessorKey: "remainingHours",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Remaining" />,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.remainingHours}h/wk</span>
      ),
      meta: { label: "Remaining" },
    },
    {
      id: "projects",
      accessorFn: (row) => row.projects.length,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Projects" />,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.projects.length}</span>
      ),
      meta: { label: "Projects" },
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
      meta: { label: "Allocations" },
    },
    {
      id: "kekaEmployeeId",
      accessorKey: "kekaEmployeeId",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Keka ID" />,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.kekaEmployeeId}
        </span>
      ),
      meta: { label: "Keka ID" },
    },
  ];
}
