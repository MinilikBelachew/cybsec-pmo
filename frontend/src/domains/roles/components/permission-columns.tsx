"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import type { PermissionListItem } from "../types/roles.types";
import {
  formatPermissionCode,
  formatPermissionLabel,
  formatRecordScopeLabel,
  humanizePermissionToken,
} from "../utils/format-permission";

export const permissionColumns: ColumnDef<PermissionListItem>[] = [
  {
    id: "permission",
    accessorFn: (row) => formatPermissionLabel(row.module, row.action),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Permission" />,
    cell: ({ row }) => (
      <div title={formatPermissionCode(row.original.module, row.original.action)}>
        <p className="text-sm font-medium">
          {formatPermissionLabel(row.original.module, row.original.action)}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
          {formatPermissionCode(row.original.module, row.original.action)}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "module",
    id: "module",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Module" />,
    cell: ({ row }) => (
      <span className="text-sm font-medium">{humanizePermissionToken(row.original.module)}</span>
    ),
  },
  {
    accessorKey: "action",
    id: "action",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
    cell: ({ row }) => (
      <span className="text-sm font-medium">{humanizePermissionToken(row.original.action)}</span>
    ),
  },
  {
    accessorKey: "recordScope",
    id: "recordScope",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Record scope" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatRecordScopeLabel(row.original.recordScope)}
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
