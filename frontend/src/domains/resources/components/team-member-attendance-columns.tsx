"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { cn } from "@/shared/utils/cn";
import type { EmployeeAttendanceRow } from "../types/resources.types";

const DAY_TYPE_STYLES: Record<number, string> = {
  0: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
  1: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-400",
  2: "border-border bg-muted text-muted-foreground",
  3: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
  4: "border-border bg-muted/60 text-muted-foreground",
};

export function dayTypeLabel(dayType: number | null): string {
  switch (dayType) {
    case 0:
      return "Working day";
    case 1:
      return "Holiday";
    case 2:
      return "Weekly off";
    case 3:
      return "Leave";
    case 4:
      return "Unknown";
    default:
      return "—";
  }
}

function formatHours(value: number | null): string {
  return value != null ? `${value}h` : "—";
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function createEmployeeAttendanceColumns(): ColumnDef<EmployeeAttendanceRow>[] {
  return [
    {
      id: "attendanceDate",
      accessorKey: "attendanceDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.attendanceDate}</span>
      ),
      meta: { label: "Date" },
    },
    {
      id: "dayType",
      accessorKey: "dayType",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Day type" />,
      cell: ({ row }) => (
        <span
          className={cn(
            "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold",
            DAY_TYPE_STYLES[row.original.dayType ?? 4] ?? DAY_TYPE_STYLES[4],
          )}
        >
          {dayTypeLabel(row.original.dayType)}
        </span>
      ),
      meta: { label: "Day type" },
    },
    {
      id: "shiftStartTime",
      accessorKey: "shiftStartTime",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Shift start" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.shiftStartTime)}
        </span>
      ),
      meta: { label: "Shift start" },
    },
    {
      id: "shiftEndTime",
      accessorKey: "shiftEndTime",
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Shift end" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.shiftEndTime)}
        </span>
      ),
      meta: { label: "Shift end" },
    },
    {
      id: "shiftDuration",
      accessorKey: "shiftDuration",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Shift duration" />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{formatHours(row.original.shiftDuration)}</span>
      ),
      meta: { label: "Shift duration" },
    },
    {
      id: "shiftEffectiveDuration",
      accessorKey: "shiftEffectiveDuration",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Shift effective" />
      ),
      cell: ({ row }) => (
        <span className="text-sm">
          {formatHours(row.original.shiftEffectiveDuration)}
        </span>
      ),
      meta: { label: "Shift effective" },
    },
    {
      id: "totalEffectiveHours",
      accessorKey: "totalEffectiveHours",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Effective hours" />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {formatHours(row.original.totalEffectiveHours)}
        </span>
      ),
      meta: { label: "Effective hours" },
    },
    {
      id: "firstInAt",
      accessorKey: "firstInAt",
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="First in" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.firstInAt)}
        </span>
      ),
      meta: { label: "First in" },
    },
    {
      id: "lastOutAt",
      accessorKey: "lastOutAt",
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last out" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDateTime(row.original.lastOutAt)}
        </span>
      ),
      meta: { label: "Last out" },
    },
  ];
}
