"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { Badge } from "@/shared/ui/badge";
import type { PermissionWithRole } from "../types/roles.types";
import {
  formatPermissionCode,
  formatPermissionLabel,
  formatRecordScopeLabel,
} from "../utils/format-permission";

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
    id: "permission",
    accessorFn: (row) => formatPermissionLabel(row.module, row.action),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Permission" />,
    meta: { className: "w-[32%] max-w-[360px]" },
    cell: ({ row }) => (
      <div className="min-w-0" title={formatPermissionCode(row.original.module, row.original.action)}>
        <p className="truncate text-sm font-medium">
          {formatPermissionLabel(row.original.module, row.original.action)}
        </p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
          {formatPermissionCode(row.original.module, row.original.action)}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "recordScope",
    id: "recordScope",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Record scope" />,
    meta: { className: "w-[22%] max-w-[240px]" },
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className="max-w-full truncate font-normal"
        title={row.original.recordScope ?? undefined}
      >
        {formatRecordScopeLabel(row.original.recordScope)}
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
    meta: { className: "w-[28%]" },
    cell: ({ row }) => (
      <span className="block truncate font-mono text-xs text-muted-foreground">
        {row.original.fieldScope ? JSON.stringify(row.original.fieldScope) : "—"}
      </span>
    ),
  },
];
