"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type SortingState } from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { KpiStatCard, KPI_CARD_THEMES } from "@/shared/components/kpi-stat-card";
import { DataTable } from "@/shared/components/data-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { useGetDepartmentsQuery, useGetProjectsQuery } from "@/domains/projects";
import { useGetTeamDirectoryQuery } from "@/domains/resources";
import {
  useGetUtilisationReportQuery,
  useLazyGetUtilisationReportQuery,
  type QueryUtilisationParams,
} from "../api/reports.api";
import type { UtilisationEmployeeRow } from "../types/reports.types";
import {
  formatPeriodLabel,
  initials,
  RECONCILE_STATUS_CONFIG,
  UTILISATION_STATUS_CONFIG,
} from "../utils/utilization-ui.config";
import { downloadUtilisationCsv } from "../utils/utilization-export.utils";
import type { ColumnDef } from "@tanstack/react-table";
import {
  UtilizationByDepartmentChart,
  UtilizationByEmployeeChart,
  UtilizationStatusPieChart,
  UtilizationSummaryChart,
} from "./utilization-charts";

type PeriodPreset = "this-month" | "last-30" | "last-90";

function resolvePeriod(preset: PeriodPreset) {
  const end = new Date();
  const start = new Date();

  if (preset === "this-month") {
    start.setDate(1);
  } else if (preset === "last-30") {
    start.setDate(end.getDate() - 29);
  } else {
    start.setDate(end.getDate() - 89);
  }

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function formatHours(value: number) {
  return `${value.toFixed(1)}h`;
}

export function UtilizationReportPage() {
  const [preset, setPreset] = useState<PeriodPreset>("this-month");
  const [search, setSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "billableUtilisation", desc: true },
  ]);
  const debouncedSearch = useDebounce(search, 300);
  const period = useMemo(() => resolvePeriod(preset), [preset]);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch, employeeId, departmentId, projectId, preset, pageSize, sorting]);

  const activeSort = sorting[0];
  const sortBy =
    activeSort?.id === "billableUtilisation" ||
    activeSort?.id === "approvedHours" ||
    activeSort?.id === "name"
      ? activeSort.id
      : "billableUtilisation";

  const baseFilters = useMemo<QueryUtilisationParams>(
    () => ({
      ...period,
      search: debouncedSearch.trim() || undefined,
      employeeId: employeeId || undefined,
      departmentId: departmentId || undefined,
      projectId: projectId || undefined,
    }),
    [period, debouncedSearch, employeeId, departmentId, projectId],
  );

  const { data: departmentOptions = [] } = useGetDepartmentsQuery();
  const { data: projectsData } = useGetProjectsQuery({ page: 1, limit: 100 });
  const { data: teamDirectoryData } = useGetTeamDirectoryQuery({
    page: 1,
    limit: 100,
    sortBy: "name",
    sortOrder: "asc",
  });

  const { data, isLoading, isFetching, refetch } = useGetUtilisationReportQuery({
    ...baseFilters,
    page: pageIndex + 1,
    limit: pageSize,
    sortBy,
    sortOrder: activeSort?.desc ? "desc" : "asc",
  });

  const { data: chartData } = useGetUtilisationReportQuery({
    ...baseFilters,
    page: 1,
    limit: 100,
    sortBy: "billableUtilisation",
    sortOrder: "desc",
  });

  const [fetchUtilisationPage, { isFetching: isExporting }] =
    useLazyGetUtilisationReportQuery();

  const handleExportCsv = useCallback(async () => {
    try {
      const firstPage = await fetchUtilisationPage({
        ...baseFilters,
        page: 1,
        limit: 100,
        sortBy,
        sortOrder: activeSort?.desc ? "desc" : "asc",
      }).unwrap();

      const allRows = [...firstPage.rows];
      const totalPages = Math.ceil(firstPage.total / 100);

      for (let page = 2; page <= totalPages; page += 1) {
        const nextPage = await fetchUtilisationPage({
          ...baseFilters,
          page,
          limit: 100,
          sortBy,
          sortOrder: activeSort?.desc ? "desc" : "asc",
        }).unwrap();
        allRows.push(...nextPage.rows);
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      downloadUtilisationCsv(`utilisation-${firstPage.startDate}-${firstPage.endDate}-${timestamp}.csv`, allRows);
      toast.success(`Exported ${allRows.length} employee row(s)`);
    } catch {
      toast.error("Failed to export utilisation report");
    }
  }, [activeSort?.desc, baseFilters, fetchUtilisationPage, sortBy]);

  const summary = data?.summary;
  const rows = data?.rows ?? [];
  const chartRows = chartData?.rows ?? rows;
  const departments = data?.departments ?? chartData?.departments ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / pageSize) || 0;
  const periodLabel = data
    ? formatPeriodLabel(data.startDate, data.endDate)
    : formatPeriodLabel(period.startDate, period.endDate);

  const flaggedRows = rows.filter((row) => row.status !== "optimal");
  const reconcileIssues = rows.filter((row) => row.reconcile.status !== "matched");

  const columns = useMemo<ColumnDef<UtilisationEmployeeRow>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        meta: { className: "w-[200px] min-w-[200px]" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Employee" />
        ),
        cell: ({ row }) => {
          const member = row.original;
          return (
            <div className="flex items-center gap-2.5 min-w-[180px]">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[10px] font-bold text-primary">
                {initials(member.name)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{member.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {member.designation}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        id: "departmentName",
        accessorKey: "departmentName",
        meta: { className: "w-[130px] min-w-[130px]" },
        header: "Department",
        cell: ({ row }) => (
          <span className="block truncate text-xs text-muted-foreground">
            {row.original.departmentName}
          </span>
        ),
      },
      {
        id: "plannedHours",
        accessorKey: "plannedHours",
        meta: { className: "w-[88px] min-w-[88px] text-end" },
        header: "Planned",
        cell: ({ row }) => (
          <span className="text-sm font-medium tabular-nums">
            {formatHours(row.original.plannedHours)}
          </span>
        ),
      },
      {
        id: "submittedHours",
        accessorKey: "submittedHours",
        meta: { className: "w-[88px] min-w-[88px] text-end" },
        header: "Submitted",
        cell: ({ row }) => (
          <span className="text-sm font-medium tabular-nums">
            {formatHours(row.original.submittedHours)}
          </span>
        ),
      },
      {
        id: "approvedHours",
        accessorKey: "approvedHours",
        meta: { className: "w-[88px] min-w-[88px] text-end" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Approved" />
        ),
        cell: ({ row }) => (
          <span className="text-sm font-semibold tabular-nums">
            {formatHours(row.original.approvedHours)}
          </span>
        ),
      },
      {
        id: "billableHours",
        accessorKey: "billableHours",
        meta: { className: "w-[88px] min-w-[88px] text-end" },
        header: "Billable",
        cell: ({ row }) => (
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatHours(row.original.billableHours)}
          </span>
        ),
      },
      {
        id: "nonBillableHours",
        accessorKey: "nonBillableHours",
        meta: { className: "w-[88px] min-w-[88px] text-end" },
        header: "Non-bill.",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatHours(row.original.nonBillableHours)}
          </span>
        ),
      },
      {
        id: "availableHours",
        accessorKey: "availableHours",
        meta: { className: "w-[88px] min-w-[88px] text-end" },
        header: "Available",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatHours(row.original.availableHours)}
          </span>
        ),
      },
      {
        id: "billableUtilisation",
        accessorKey: "billableUtilisationPercent",
        meta: { className: "w-[148px] min-w-[148px]" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Billable util." />
        ),
        cell: ({ row }) => {
          const status = UTILISATION_STATUS_CONFIG[row.original.status];
          return (
            <div className="flex items-center gap-2 min-w-[110px]">
              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full", status.bar)}
                  style={{
                    width: `${Math.min(row.original.billableUtilisationPercent, 100)}%`,
                  }}
                />
              </div>
              <span className={cn("text-xs font-bold w-9 text-end tabular-nums", status.text)}>
                {row.original.billableUtilisationPercent}%
              </span>
            </div>
          );
        },
      },
      {
        id: "reconcile",
        meta: { className: "w-[72px] min-w-[72px]" },
        header: "Keka",
        cell: ({ row }) => {
          const reconcile = RECONCILE_STATUS_CONFIG[row.original.reconcile.status];
          return (
            <span className={cn("text-[11px] font-semibold", reconcile.text)}>
              {reconcile.label}
            </span>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/reports"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2")}
        >
          <ArrowLeft className="size-4" />
          Reports
        </Link>
      </div>

      <PageHeader
        title="Resource Utilization"
        description={`${periodLabel} · Billable utilisation = approved billable ÷ available hours`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Refresh
          </Button>
        }
      />

      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-2">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <TrendingUp className="size-4 shrink-0 text-primary" />
          How each column is calculated ({data?.formulaVersion ?? "cybsec-2026-v1"})
        </p>
        <ul className="grid gap-1.5 sm:grid-cols-2 text-xs leading-relaxed">
          <li>
            <span className="font-semibold text-foreground">Available</span> — weekdays in the
            period × (weekly hours ÷ 5), minus approved leave weekdays.
          </li>
          <li>
            <span className="font-semibold text-foreground">Planned</span> — sum of active
            allocation hours on each weekday (from % or fixed hours per allocation).
          </li>
          <li>
            <span className="font-semibold text-foreground">Submitted</span> — timesheet entries
            with status <em>Submitted</em> (regular + overtime).
          </li>
          <li>
            <span className="font-semibold text-foreground">Approved</span> — timesheet entries
            with status <em>Approved</em>.
          </li>
          <li>
            <span className="font-semibold text-foreground">Billable / Non-billable</span> —
            approved hours split by the entry&apos;s billable flag.
          </li>
          <li>
            <span className="font-semibold text-foreground">Billable util. %</span> — billable ÷
            available × 100.
          </li>
        </ul>
        {projectId ? (
          <p className="text-xs">
            Project filter: planned hours and timesheets are scoped to the selected project only.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiStatCard
          title="Avg billable util."
          subtitle="team average"
          value={summary ? `${summary.avgBillableUtilisation}%` : "—"}
          numericValue={summary?.avgBillableUtilisation ?? 0}
          chartMax={100}
          icon={TrendingUp}
          theme={KPI_CARD_THEMES.primary}
        />
        <KpiStatCard
          title="Total billable"
          subtitle={
            summary && summary.totalAvailableHours > 0
              ? `${Math.round((summary.totalBillableHours / summary.totalAvailableHours) * 100)}% of capacity`
              : "approved billable hours"
          }
          value={summary ? formatHours(summary.totalBillableHours) : "—"}
          numericValue={summary?.totalBillableHours ?? 0}
          chartMax={Math.max(summary?.totalAvailableHours ?? 1, 1)}
          icon={CheckCircle2}
          theme={KPI_CARD_THEMES.emerald}
        />
        <KpiStatCard
          title="Non-billable"
          subtitle="internal / overhead"
          value={summary ? formatHours(summary.totalNonBillableHours) : "—"}
          numericValue={summary?.totalNonBillableHours ?? 0}
          chartMax={Math.max(summary?.totalApprovedHours ?? 1, 1)}
          icon={AlertTriangle}
          theme={KPI_CARD_THEMES.slate}
        />
        <KpiStatCard
          title="Overloaded"
          subtitle="≥ 90% billable util."
          value={summary ? String(summary.overCount) : "—"}
          numericValue={summary?.overCount ?? 0}
          chartMax={Math.max(summary?.employeeCount ?? 1, 1)}
          icon={AlertTriangle}
          theme={KPI_CARD_THEMES.rose}
        />
        <KpiStatCard
          title="Underutilized"
          subtitle="< 50% billable util."
          value={summary ? String(summary.underCount) : "—"}
          numericValue={summary?.underCount ?? 0}
          chartMax={Math.max(summary?.employeeCount ?? 1, 1)}
          icon={TrendingUp}
          theme={KPI_CARD_THEMES.sky}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <UtilizationSummaryChart summary={summary} />
        <UtilizationByDepartmentChart departments={departments} />
        <UtilizationByEmployeeChart rows={chartRows} />
        <UtilizationStatusPieChart rows={chartRows} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
          {(
            [
              ["this-month", "This month"],
              ["last-30", "Last 30 days"],
              ["last-90", "Last 90 days"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreset(value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                preset === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, role..."
            className="pl-9"
          />
        </div>

        <Select
          value={employeeId || "all"}
          onValueChange={(value) => setEmployeeId(!value || value === "all" ? "" : value)}
        >
          <SelectTrigger size="sm" className="min-w-[160px]">
            <SelectValue placeholder="All employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {(teamDirectoryData?.members ?? []).map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={departmentId || "all"}
          onValueChange={(value) => setDepartmentId(!value || value === "all" ? "" : value)}
        >
          <SelectTrigger size="sm" className="min-w-[150px]">
            <SelectValue placeholder="All teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {departmentOptions.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={projectId || "all"}
          onValueChange={(value) => setProjectId(!value || value === "all" ? "" : value)}
        >
          <SelectTrigger size="sm" className="min-w-[160px]">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {(projectsData?.data ?? []).map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="ms-auto"
          disabled={isExporting || isLoading}
          onClick={() => void handleExportCsv()}
        >
          {isExporting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          Export CSV
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.employeeId}
          manual
          hideSearch
          pageCount={pageCount}
          totalRows={total}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={setPageIndex}
          onPageSizeChange={setPageSize}
          sorting={sorting}
          onSortingChange={setSorting}
          isLoading={isLoading}
          emptyMessage="No utilization data for this period."
          minTableWidth="min-w-[1280px]"
          tableClassName="table-auto"
        />

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
            <p className="text-sm font-bold">Capacity flags</p>
            {flaggedRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">All employees are in optimal range.</p>
            ) : (
              flaggedRows.slice(0, 6).map((row) => {
                const status = UTILISATION_STATUS_CONFIG[row.status];
                return (
                  <div key={row.employeeId} className="flex items-center gap-2.5">
                    <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 text-[9px] font-bold text-primary">
                      {initials(row.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{row.name}</p>
                      <p className={cn("text-[10px]", status.text)}>
                        {status.label} · {row.billableUtilisationPercent}%
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
            <p className="text-sm font-bold">Keka reconciliation</p>
            <p className="text-xs text-muted-foreground">
              Approved hours vs successfully synced Keka time entries on this page.
            </p>
            {reconcileIssues.length === 0 ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                All visible rows match Keka sync status.
              </p>
            ) : (
              reconcileIssues.slice(0, 5).map((row) => {
                const reconcile = RECONCILE_STATUS_CONFIG[row.reconcile.status];
                return (
                  <div
                    key={row.employeeId}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="font-medium truncate">{row.name}</span>
                    <span className={cn("font-semibold shrink-0", reconcile.text)}>
                      Δ {formatHours(Math.abs(row.reconcile.deltaHours))}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
