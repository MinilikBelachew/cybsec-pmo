"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import { formatProjectBudget } from "@/domains/projects/utils/format-budget";
import type {
  BudgetAdjustment,
  BudgetLineItem,
  BudgetRevision,
} from "../types/budget.types";

function money(amount: number | null | undefined, currency: string) {
  if (amount == null) return "—";
  return formatProjectBudget(amount, currency);
}

function statusTone(status: string) {
  if (status === "Approved")
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (status === "Rejected")
    return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
}

export function createRevisionColumns(options: {
  currency: string;
  canEdit: boolean;
  busy: boolean;
  onApprove: (revisionId: string) => void;
  onReject: (revisionId: string) => void;
}): ColumnDef<BudgetRevision>[] {
  const { currency, canEdit, busy, onApprove, onReject } = options;

  return [
    {
      id: "revisedAmount",
      accessorKey: "revisedAmount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {money(row.original.revisedAmount, currency)}
        </span>
      ),
      meta: { label: "Amount" },
    },
    {
      id: "reason",
      accessorKey: "reason",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reason" />
      ),
      cell: ({ row }) => (
        <span className="block max-w-60 truncate" title={row.original.reason}>
          {row.original.reason}
        </span>
      ),
      meta: { label: "Reason" },
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <Badge
          variant="secondary"
          className={cn("font-medium", statusTone(row.original.status))}
        >
          {row.original.status}
        </Badge>
      ),
      meta: { label: "Status" },
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
      meta: { label: "Date" },
    },
    {
      id: "actions",
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const rev = row.original;
        if (!(canEdit && rev.status === "Pending")) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="inline-flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onApprove(rev.id);
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onReject(rev.id);
              }}
            >
              Reject
            </Button>
          </div>
        );
      },
      meta: {
        className: "w-[140px] text-right",
        sticky: "right",
        enableColumnReorder: false,
        label: "Actions",
      },
    },
  ];
}

export function createCostLineColumns(options: {
  currency: string;
  canEdit: boolean;
  busy: boolean;
  onDelete: (line: { id: string; itemName: string }) => void;
}): ColumnDef<BudgetLineItem>[] {
  const { currency, canEdit, busy, onDelete } = options;

  return [
    {
      id: "category",
      accessorKey: "category",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
      cell: ({ row }) => row.original.category,
      meta: { label: "Category" },
    },
    {
      id: "itemName",
      accessorKey: "itemName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Item" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.itemName}</span>
      ),
      meta: { label: "Item" },
    },
    {
      id: "planned",
      accessorKey: "planned",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Planned" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {money(row.original.planned, currency)}
        </span>
      ),
      meta: { label: "Planned", className: "text-right" },
    },
    {
      id: "actual",
      accessorKey: "actual",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Actual" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {money(row.original.actual, currency)}
        </span>
      ),
      meta: { label: "Actual", className: "text-right" },
    },
    {
      id: "actions",
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        if (!canEdit) return null;
        return (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-rose-600"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onDelete({
                id: row.original.id,
                itemName: row.original.itemName,
              });
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        );
      },
      meta: {
        className: "w-[48px] text-right",
        sticky: "right",
        enableColumnReorder: false,
        label: "Actions",
      },
    },
  ];
}

export function createAdjustmentColumns(options: {
  currency: string;
  canEdit: boolean;
  busy: boolean;
  onApprove: (adjustmentId: string) => void;
  onReject: (adjustmentId: string) => void;
}): ColumnDef<BudgetAdjustment>[] {
  const { currency, canEdit, busy, onApprove, onReject } = options;

  return [
    {
      id: "targetField",
      accessorKey: "targetField",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Target" />
      ),
      cell: ({ row }) => row.original.targetField,
      meta: { label: "Target" },
    },
    {
      id: "oldAmount",
      accessorKey: "oldAmount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Old" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {money(row.original.oldAmount, currency)}
        </span>
      ),
      meta: { label: "Old", className: "text-right" },
    },
    {
      id: "newAmount",
      accessorKey: "newAmount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="New" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {money(row.original.newAmount, currency)}
        </span>
      ),
      meta: { label: "New", className: "text-right" },
    },
    {
      id: "reason",
      accessorKey: "reason",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Reason" />
      ),
      cell: ({ row }) => (
        <span className="block max-w-60 truncate" title={row.original.reason}>
          {row.original.reason}
        </span>
      ),
      meta: { label: "Reason" },
    },
    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <Badge
          variant="secondary"
          className={cn("font-medium", statusTone(row.original.status))}
        >
          {row.original.status}
        </Badge>
      ),
      meta: { label: "Status" },
    },
    {
      id: "actions",
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const adj = row.original;
        if (!(canEdit && adj.status === "Pending")) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="inline-flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onApprove(adj.id);
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onReject(adj.id);
              }}
            >
              Reject
            </Button>
          </div>
        );
      },
      meta: {
        className: "w-[140px] text-right",
        sticky: "right",
        enableColumnReorder: false,
        label: "Actions",
      },
    },
  ];
}
