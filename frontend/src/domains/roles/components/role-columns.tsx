"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/shared/ui/badge";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import type { RoleListItem } from "../types/roles.types";
import { formatRoleCodeLabel } from "../utils/format-permission";

export const roleColumns: ColumnDef<RoleListItem>[] = [
  {
    accessorKey: "code",
    id: "code",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
    meta: { className: "w-[18%]" },
    cell: ({ row }) => (
      <span className="text-sm font-medium text-foreground" title={row.original.code}>
        {formatRoleCodeLabel(row.original.code)}
      </span>
    ),
  },
  {
    accessorKey: "label",
    id: "label",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
    cell: ({ row }) => (
      <span className="text-sm font-medium">{row.original.label}</span>
    ),
  },
  {
    accessorKey: "isExternal",
    id: "isExternal",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => (
      <Badge variant={row.original.isExternal ? "outline" : "secondary"}>
        {row.original.isExternal ? "External" : "Internal"}
      </Badge>
    ),
  },
  {
    accessorKey: "permissionCount",
    id: "permissionCount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Permissions" />,
    cell: ({ row }) => (
      <span className="text-sm font-semibold tabular-nums">
        {row.original.permissionCount}
      </span>
    ),
  },
  {
    accessorKey: "createdAt",
    id: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
    cell: ({ row }) => (
      <time
        dateTime={row.original.createdAt}
        className="text-sm text-muted-foreground whitespace-nowrap"
      >
        {new Date(row.original.createdAt).toLocaleDateString()}
      </time>
    ),
  },
];
