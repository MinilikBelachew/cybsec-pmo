"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { cn } from "@/shared/utils/cn";
import type { TeamLeaveRow } from "../types/resources.types";

const LEAVE_STATUS_STYLES: Record<TeamLeaveRow["status"], string> = {
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  rejected: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800",
};

export function createTeamLeaveColumns(): ColumnDef<TeamLeaveRow>[] {
  return [
    {
      id: "employeeName",
      accessorKey: "employeeName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => {
        const leave = row.original;
        return (
          <div className="min-w-0">
            <p className="text-sm font-semibold">{leave.employeeName}</p>
            <p className="text-xs text-muted-foreground">{leave.designation}</p>
          </div>
        );
      },
      meta: { label: "Employee" },
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
      id: "type",
      accessorKey: "type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => <span className="text-sm">{row.original.type}</span>,
      meta: { label: "Type" },
    },
    {
      id: "from",
      accessorKey: "from",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Dates" />,
      cell: ({ row }) => {
        const leave = row.original;
        return (
          <span className="text-sm text-muted-foreground">
            {leave.from}
            {leave.to !== leave.from ? ` – ${leave.to}` : ""}
          </span>
        );
      },
      meta: { label: "Dates" },
    },
    {
      id: "days",
      accessorKey: "days",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Days" />,
      cell: ({ row }) => <span className="text-sm">{row.original.days}d</span>,
      meta: { label: "Days" },
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <span
            className={cn(
              "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize",
              LEAVE_STATUS_STYLES[status],
            )}
          >
            {status}
          </span>
        );
      },
      meta: { label: "Status" },
    },
  ];
}
