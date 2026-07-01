"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { Badge } from "@/shared/ui/badge";
import { type AuditLogEntry } from "../api/audit.api";
import { parseAuditClientDisplay } from "../utils/format-audit-client";

function AuditClientCell({ ipAddress }: { ipAddress: string | null }) {
  const { ipLabel, ip, client } = parseAuditClientDisplay(ipAddress);

  if (ipLabel === "—") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="min-w-[140px]">
      <p className="font-mono text-xs text-foreground whitespace-nowrap" title={ip}>
        {ipLabel}
        {ipLabel === "Localhost" && ip !== ipLabel ? (
          <span className="ml-1 text-muted-foreground">({ip})</span>
        ) : null}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground whitespace-nowrap">{client}</p>
    </div>
  );
}

export const auditDataColumns: ColumnDef<AuditLogEntry>[] = [
  {
    accessorKey: "createdAt",
    id: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
    cell: ({ row }) => (
      <time
        dateTime={row.original.createdAt}
        className="text-sm text-muted-foreground tabular-nums whitespace-nowrap"
      >
        {new Date(row.original.createdAt).toLocaleString()}
      </time>
    ),
  },
  {
    id: "actor",
    accessorFn: (row) => row.user?.displayName ?? "System",
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Actor" />,
    cell: ({ row }) => (
      <div className="flex min-w-[160px] items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {(row.original.user?.displayName ?? "S").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium leading-tight">
              {row.original.user?.displayName ?? "System"}
            </p>
            {row.original.isExternal && (
              <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">
                External
              </Badge>
            )}
          </div>
          {row.original.user?.email && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground max-w-[180px]">
              {row.original.user.email}
            </p>
          )}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "action",
    id: "action",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
    cell: ({ row }) => (
      <code className="inline-block rounded-md bg-muted/70 px-2 py-1 text-[11px] font-medium whitespace-nowrap">
        {row.original.action}
      </code>
    ),
  },
  {
    accessorKey: "objectType",
    id: "objectType",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Object" />,
    cell: ({ row }) => (
      <div className="min-w-[120px]">
        <p className="text-sm">{row.original.objectType}</p>
        {row.original.objectId && (
          <p className="mt-0.5 max-w-[200px] truncate font-mono text-[11px] text-muted-foreground">
            {row.original.objectId}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "ipAddress",
    id: "ipAddress",
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="IP / Client" />,
    cell: ({ row }) => <AuditClientCell ipAddress={row.original.ipAddress} />,
  },
];
