"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { formatProjectBudget } from "@/domains/projects/utils/format-budget";
import type { ResourceCostRow } from "../types/budget.types";

function money(amount: number | null | undefined, currency: string) {
  if (amount == null) return "—";
  return formatProjectBudget(amount, currency);
}

export type ResourceCostGroupBy = "detail" | "employee" | "month";

export function createResourceCostColumns(options: {
  currency: string;
  groupBy: ResourceCostGroupBy;
  includeRates: boolean;
}): ColumnDef<ResourceCostRow>[] {
  const { currency, groupBy, includeRates } = options;
  const columns: ColumnDef<ResourceCostRow>[] = [];

  if (groupBy !== "month") {
    columns.push({
      id: "employee",
      accessorFn: (row) => row.employeeName ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Employee" />
      ),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.employeeName ?? "—"}
            {row.original.employeeNumber ? (
              <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                #{row.original.employeeNumber}
              </span>
            ) : null}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {[row.original.designation, row.original.departmentName]
              .filter(Boolean)
              .join(" · ") || "—"}
            {!row.original.hasSalaryRate ? (
              <span className="ml-1 text-amber-700 dark:text-amber-400">
                · no Keka salary rate
              </span>
            ) : null}
          </div>
        </div>
      ),
      meta: { label: "Employee" },
    });
  }

  if (groupBy !== "employee") {
    columns.push({
      id: "period",
      accessorFn: (row) =>
        row.periodYear != null && row.periodMonth != null
          ? `${row.periodYear}-${String(row.periodMonth).padStart(2, "0")}`
          : "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Period" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.periodYear != null && row.original.periodMonth != null
            ? `${row.original.periodYear}-${String(row.original.periodMonth).padStart(2, "0")}`
            : "—"}
        </span>
      ),
      meta: { label: "Period" },
    });
  }

  columns.push(
    {
      id: "regularHours",
      accessorKey: "regularHours",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Regular" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.regularHours}</span>
      ),
      meta: { label: "Regular" },
    },
    {
      id: "overtimeHours",
      accessorKey: "overtimeHours",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="OT" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.overtimeHours}</span>
      ),
      meta: { label: "OT" },
    },
  );

  if (includeRates && groupBy !== "month") {
    columns.push({
      id: "ratePerHour",
      accessorKey: "ratePerHour",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Rate" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.ratePerHour != null
            ? money(row.original.ratePerHour, currency)
            : "—"}
        </span>
      ),
      meta: { label: "Rate" },
    });
  }

  columns.push({
    id: "totalCost",
    accessorKey: "totalCost",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums font-medium">
        {money(row.original.totalCost, currency)}
      </span>
    ),
    meta: { label: "Cost" },
  });

  return columns;
}
