"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { Badge } from "@/shared/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { type AuditLogEntry } from "../api/audit.api";
import { parseAuditClientDisplay } from "../utils/format-audit-client";

function AuditClientCell({ ipAddress }: { ipAddress: string | null }) {
  const { ipLabel, ip, client } = parseAuditClientDisplay(ipAddress);

  if (ipLabel === "—") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <p className="truncate font-mono text-xs text-foreground" title={ip}>
        {ipLabel}
        {ipLabel === "Localhost" && ip !== ipLabel ? (
          <span className="ml-1 text-muted-foreground">({ip})</span>
        ) : null}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{client}</p>
    </div>
  );
}

function AuditDescriptionCell({ description }: { description?: string | null }) {
  const text = description?.trim();
  if (!text) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <p className="min-w-0 max-w-full cursor-default truncate text-sm leading-snug text-foreground" />
        }
      >
        {text}
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-sm whitespace-pre-wrap break-words">
        {text}
      </TooltipContent>
    </Tooltip>
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
        className="block truncate text-sm text-muted-foreground tabular-nums"
        title={new Date(row.original.createdAt).toLocaleString()}
      >
        {new Date(row.original.createdAt).toLocaleString()}
      </time>
    ),
    meta: { className: "w-[200px] min-w-[200px] max-w-[200px] overflow-hidden" },
  },
  {
    id: "actor",
    accessorFn: (row) => row.user?.displayName ?? "System",
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Actor" />,
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3 overflow-hidden">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {(row.original.user?.displayName ?? "S").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 overflow-hidden">
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
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.user.email}
            </p>
          )}
        </div>
      </div>
    ),
    meta: { className: "w-[18%] max-w-0 overflow-hidden" },
  },
  {
    accessorKey: "action",
    id: "action",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
    cell: ({ row }) => (
      <Tooltip>
        <TooltipTrigger
          render={
            <code className="block max-w-full truncate rounded-md bg-muted/70 px-2 py-1 text-[11px] font-medium" />
          }
        >
          {row.original.action}
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-xs break-all">
          {row.original.action}
        </TooltipContent>
      </Tooltip>
    ),
    meta: { className: "w-[160px] max-w-[160px] overflow-hidden" },
  },
  {
    id: "description",
    accessorKey: "description",
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
    cell: ({ row }) => (
      <AuditDescriptionCell description={row.original.description} />
    ),
    meta: { className: "w-[28%] max-w-0 overflow-hidden" },
  },
  {
    accessorKey: "objectType",
    id: "objectType",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Object" />,
    cell: ({ row }) => (
      <div className="min-w-0 overflow-hidden">
        <p className="truncate text-sm">{row.original.objectType}</p>
        {row.original.objectId && (
          <p
            className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground"
            title={row.original.objectId}
          >
            {row.original.objectId}
          </p>
        )}
      </div>
    ),
    meta: { className: "w-[140px] max-w-[140px] overflow-hidden" },
  },
  {
    accessorKey: "ipAddress",
    id: "ipAddress",
    enableSorting: false,
    header: ({ column }) => <DataTableColumnHeader column={column} title="IP / Client" />,
    cell: ({ row }) => <AuditClientCell ipAddress={row.original.ipAddress} />,
    meta: { className: "w-[140px] max-w-[140px] overflow-hidden" },
  },
];
