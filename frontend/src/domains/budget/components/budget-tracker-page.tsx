"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Download, Loader2, Wallet } from "lucide-react";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import {
  downloadBudgetBlob,
  useGetPortfolioBudgetsQuery,
  useLazyExportBudgetFileQuery,
} from "@/domains/budget";
import { formatProjectBudget } from "@/domains/projects/utils/format-budget";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";

function money(amount: number | null | undefined, currency: string) {
  if (amount == null) return "—";
  return formatProjectBudget(amount, currency);
}

export function BudgetTrackerPage() {
  const { canViewFinancials } = useModulePermissions();
  const { data = [], isLoading, isError } = useGetPortfolioBudgetsQuery(
    undefined,
    { skip: !canViewFinancials },
  );
  const [exportBudgetFile] = useLazyExportBudgetFileQuery();
  const [exporting, setExporting] = useState<"xlsx" | "csv" | null>(null);

  const overrunCount = useMemo(
    () => data.filter((row) => row.overrun).length,
    [data],
  );

  if (!canViewFinancials) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        You do not have permission to view the budget tracker.
      </div>
    );
  }

  const onExport = async (format: "xlsx" | "csv") => {
    setExporting(format);
    try {
      const blob = await exportBudgetFile({ format }).unwrap();
      const date = new Date().toISOString().slice(0, 10);
      downloadBudgetBlob(`budget_tracker_${date}.${format}`, blob);
      toast.success(`Exported ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Wallet className="size-5" /> Budget Tracker
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Portfolio view of baselines, expected vs actual, margin, and overrun
            status. Open a project Financials tab to edit.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!!exporting}
            onClick={() => onExport("csv")}
          >
            {exporting === "csv" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!!exporting}
            onClick={() => onExport("xlsx")}
          >
            {exporting === "xlsx" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Excel
          </Button>
        </div>
      </div>

      <div className="flex gap-3 text-xs text-muted-foreground items-center">
        <span>{data.length} projects</span>
        {overrunCount > 0 && (
          <Badge
            variant="secondary"
            className="bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {overrunCount} overrun
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center text-muted-foreground gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading portfolio budgets…
        </div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">Unable to load budget tracker.</p>
      ) : data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-white/15 p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No projects in scope.</p>
          <Link
            href="/dashboard/projects"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Go to projects
          </Link>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200/70 dark:border-white/8">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Project</th>
                <th className="text-right font-semibold px-3 py-2">Current</th>
                <th className="text-right font-semibold px-3 py-2">Actual</th>
                <th className="text-right font-semibold px-3 py-2">Variance</th>
                <th className="text-right font-semibold px-3 py-2">Margin</th>
                <th className="text-right font-semibold px-3 py-2">Adherence</th>
                <th className="text-left font-semibold px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.projectId}
                  className="border-t border-slate-200/60 dark:border-white/6 hover:bg-muted/20"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/dashboard/projects/${row.projectId}?view=financials`}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.projectName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(row.currentBudgetAmount, row.currency)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(row.actualCost, row.currency)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(row.variance, row.currency)}
                    {row.variancePct != null ? ` (${row.variancePct}%)` : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(row.margin, row.currency)}
                    {row.marginPct != null ? ` (${row.marginPct}%)` : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.adherencePct != null ? `${row.adherencePct}%` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {row.overrun ? (
                      <Badge
                        variant="secondary"
                        className="bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        Overrun
                      </Badge>
                    ) : row.budgetId ? (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        On track
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">No baseline</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
