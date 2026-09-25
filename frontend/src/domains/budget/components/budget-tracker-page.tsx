"use client";

import Link from "next/link";
import { useMemo } from "react";
import { toast } from "react-hot-toast";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2, Wallet } from "lucide-react";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import {
  downloadBudgetBlob,
  useExportBudgetFileMutation,
  useGetPortfolioBudgetsQuery,
} from "@/domains/budget";
import { createBudgetTrackerColumns } from "@/domains/budget/components/budget-tracker-columns";
import { DataTable } from "@/shared/components/data-table";
import { PageHeader } from "@/shared/components/page-header";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";

export function BudgetTrackerPage() {
  const { canViewFinancials } = useModulePermissions();
  const { data = [], isLoading, isError } = useGetPortfolioBudgetsQuery(
    undefined,
    { skip: !canViewFinancials },
  );
  const [exportBudgetFile, { isLoading: isExporting }] =
    useExportBudgetFileMutation();
  const columns = useMemo(() => createBudgetTrackerColumns(), []);

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
    try {
      const blob = await exportBudgetFile({ format }).unwrap();
      const date = new Date().toISOString().slice(0, 10);
      downloadBudgetBlob(`budget_tracker_${date}.${format}`, blob);
      toast.success(`Exported ${format.toUpperCase()} (${data.length} projects)`);
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Budget Tracker"
        description="Portfolio view of baselines, expected vs actual, margin, and overrun status. Open a project Financials tab to edit."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={isExporting || isLoading || data.length === 0}
                />
              }
            >
              {isExporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {isExporting ? "Exporting…" : "Export"}
              <ChevronDown className="size-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 shadow-none">
              <DropdownMenuItem
                className="cursor-pointer gap-3 rounded-xl px-2.5 py-2"
                onClick={() => void onExport("csv")}
                disabled={isExporting}
              >
                <FileText className="size-4 text-muted-foreground" />
                <span>
                  <span className="block text-xs font-semibold">CSV</span>
                  <span className="block text-[10px] text-muted-foreground">
                    All portfolio rows
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-3 rounded-xl px-2.5 py-2"
                onClick={() => void onExport("xlsx")}
                disabled={isExporting}
              >
                <FileSpreadsheet className="size-4 text-emerald-600" />
                <span>
                  <span className="block text-xs font-semibold">Excel</span>
                  <span className="block text-[10px] text-muted-foreground">
                    All portfolio rows (.xlsx)
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {/* <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <Wallet className="size-3.5" />
          {data.length} projects
        </span> */}
        {overrunCount > 0 && (
          <Badge
            variant="secondary"
            className="bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {overrunCount} overrun
          </Badge>
        )}
      </div>

      {isError ? (
        <p className="text-sm text-muted-foreground">Unable to load budget tracker.</p>
      ) : !isLoading && data.length === 0 ? (
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
        <DataTable
          columns={columns}
          data={data}
          getRowId={(row) => row.projectId}
          searchKey="projectName"
          searchPlaceholder="Search projects…"
          isLoading={isLoading}
          emptyMessage="No projects in scope."
          minTableWidth="min-w-[900px]"
          enableColumnReorder
          columnOrderStorageKey="cybsec-budget-tracker-column-order"
          pageSize={10}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      )}
    </div>
  );
}
