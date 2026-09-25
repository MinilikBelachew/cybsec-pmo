"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { Badge } from "@/shared/ui/badge";
import { formatProjectBudget } from "@/domains/projects/utils/format-budget";
import type { PortfolioBudgetRow } from "../types/budget.types";

function money(amount: number | null | undefined, currency: string) {
  if (amount == null) return "—";
  return formatProjectBudget(amount, currency);
}

export function createBudgetTrackerColumns(): ColumnDef<PortfolioBudgetRow>[] {
  return [
    {
      id: "projectName",
      accessorKey: "projectName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Project" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/projects/${row.original.projectId}?view=financials`}
          className="block max-w-[220px] truncate font-medium text-foreground hover:underline"
          title={row.original.projectName}
        >
          {row.original.projectName}
        </Link>
      ),
      meta: { label: "Project" },
    },
    {
      id: "currentBudgetAmount",
      accessorKey: "currentBudgetAmount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Current" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {money(row.original.currentBudgetAmount, row.original.currency)}
        </span>
      ),
      meta: { label: "Current" },
    },
    {
      id: "actualCost",
      accessorKey: "actualCost",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Actual" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {money(row.original.actualCost, row.original.currency)}
        </span>
      ),
      meta: { label: "Actual" },
    },
    {
      id: "variance",
      accessorKey: "variance",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Variance" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {money(row.original.variance, row.original.currency)}
          {row.original.variancePct != null
            ? ` (${row.original.variancePct}%)`
            : ""}
        </span>
      ),
      meta: { label: "Variance" },
    },
    {
      id: "margin",
      accessorKey: "margin",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Margin" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {money(row.original.margin, row.original.currency)}
          {row.original.marginPct != null
            ? ` (${row.original.marginPct}%)`
            : ""}
        </span>
      ),
      meta: { label: "Margin" },
    },
    {
      id: "adherencePct",
      accessorKey: "adherencePct",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Adherence" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.adherencePct != null
            ? `${row.original.adherencePct}%`
            : "—"}
        </span>
      ),
      meta: { label: "Adherence" },
    },
    {
      id: "status",
      accessorFn: (row) =>
        row.overrun ? "overrun" : row.budgetId ? "on_track" : "no_baseline",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        if (row.original.overrun) {
          return (
            <Badge
              variant="secondary"
              className="bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
            >
              Overrun
            </Badge>
          );
        }
        if (row.original.budgetId) {
          return (
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              On track
            </Badge>
          );
        }
        return <span className="text-muted-foreground">No baseline</span>;
      },
      meta: { label: "Status" },
    },
  ];
}
