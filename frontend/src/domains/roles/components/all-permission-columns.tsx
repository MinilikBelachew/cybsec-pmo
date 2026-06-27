"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { Badge } from "@/shared/ui/badge";
import type { PermissionWithRole } from "../types/roles.types";

export const allPermissionColumns: ColumnDef<PermissionWithRole>[] = [
  {
    accessorKey: "roleCode",
    id: "roleCode",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
    meta: { className: "w-[18%] max-w-[200px]" },
    cell: ({ row }) => (
      <div
        className="min-w-0 truncate"
        title={`${row.original.roleLabel} (${row.original.roleCode})`}
      >
        <span className="text-sm font-medium">{row.original.roleLabel}</span>
      </div>
    ),
  },
  {
    accessorKey: "module",
    id: "module",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Module" />,
    meta: { className: "w-[26%] max-w-[280px]" },
    cell: ({ row }) => (
      <code className="block truncate rounded-md bg-muted/70 px-2 py-1 text-xs font-medium">
        {row.original.module}
      </code>
    ),
  },
  {
    accessorKey: "action",
    id: "action",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
    meta: { className: "w-[18%] max-w-[160px]" },
    cell: ({ row }) => (
      <span className="block truncate text-sm font-medium">{row.original.action}</span>
    ),
  },
  {
    accessorKey: "recordScope",
    id: "recordScope",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Record scope" />,
    meta: { className: "w-[18%] max-w-[160px]" },
    cell: ({ row }) => (
      <Badge variant="outline" className="max-w-full truncate font-normal">
        {row.original.recordScope ?? "—"}
      </Badge>
    ),
  },
  {
    id: "fieldScope",
    accessorFn: (row) => (row.fieldScope ? JSON.stringify(row.fieldScope) : ""),
    enableSorting: false,
    header: () => (
      <span className="text-sm font-medium text-muted-foreground">Field scope</span>
    ),
    meta: { className: "w-[20%]" },
    cell: ({ row }) => (
      <span className="block truncate font-mono text-xs text-muted-foreground">
        {row.original.fieldScope ? JSON.stringify(row.original.fieldScope) : "—"}
      </span>
    ),
  },
];
