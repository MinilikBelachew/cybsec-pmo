"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import type { PermissionListItem } from "../types/roles.types";

export const permissionColumns: ColumnDef<PermissionListItem>[] = [
  {
    accessorKey: "module",
    id: "module",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Module" />,
    cell: ({ row }) => (
      <code className="rounded-md bg-muted/70 px-2 py-1 text-xs font-medium">
        {row.original.module}
      </code>
    ),
  },
  {
    accessorKey: "action",
    id: "action",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
    cell: ({ row }) => (
      <span className="text-sm font-medium">{row.original.action}</span>
    ),
  },
  {
    accessorKey: "recordScope",
    id: "recordScope",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Record scope" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.recordScope ?? "—"}
      </span>
    ),
  },
  {
    id: "fieldScope",
    accessorFn: (row) => (row.fieldScope ? JSON.stringify(row.fieldScope) : ""),
    enableSorting: false,
    header: () => <span className="text-sm font-medium text-muted-foreground">Field scope</span>,
    cell: ({ row }) => (
      <span className="line-clamp-2 max-w-[240px] text-xs text-muted-foreground font-mono">
        {row.original.fieldScope ? JSON.stringify(row.original.fieldScope) : "—"}
      </span>
    ),
  },
];
