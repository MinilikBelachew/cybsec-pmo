"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  RotateCcw,
  Users,
  Calendar,
  Clock3,
  PartyPopper,
  Wallet,
  FolderKanban,
  Layers,
  Scale,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { DataTable } from "@/shared/components/data-table";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { useAppSelector } from "@/store/hooks";
import { hasModulePermission } from "@/domains/auth/utils/module-permissions";
import {
  useGetFailedSyncRecordsQuery,
  useGetKekaSyncLogsQuery,
  useGetKekaSyncStatusQuery,
  useGetKekaTimesheetReconcileQuery,
  useRetryKekaSyncMutation,
  useTriggerKekaEmployeeSyncMutation,
  useTriggerKekaLeaveSyncMutation,
  useTriggerKekaAttendanceSyncMutation,
  useTriggerKekaHolidaysSyncMutation,
  useTriggerKekaSalarySyncMutation,
  useTriggerKekaClientsSyncMutation,
  useTriggerKekaProjectsSyncMutation,
  useTriggerKekaFullSyncMutation,
  useReconcileKekaTimesheetsMutation,
} from "../../api/integrations.api";
import type {
  FailedSyncRecordEntry,
  KekaEntitySyncStatus,
  KekaSyncLogEntry,
} from "../../types/integrations.types";
import { INTEGRATION_POLLING_INTERVAL_MS } from "../../constants/integration-polling";
import { RECONCILE_STATUS_CONFIG } from "@/domains/reports/utils/utilization-ui.config";

type IntegrationSubTab = "logs" | "failures";

type FilterOption = {
  value: string;
  label: string;
};

const ENTITY_OPTIONS: FilterOption[] = [
  { value: "all", label: "All entities" },
  { value: "department", label: "Department" },
  { value: "employee", label: "Employee" },
  { value: "leave", label: "Leave" },
  { value: "attendance", label: "Attendance" },
  { value: "holiday", label: "Holiday" },
  { value: "holiday_calendar", label: "Holiday calendar" },
  { value: "salary", label: "Salary" },
  { value: "pay_cycle", label: "Pay cycle" },
  { value: "client", label: "Client" },
  { value: "project", label: "Project" },
  { value: "task", label: "Task" },
  { value: "timesheet", label: "Timesheet" },
  { value: "allocation", label: "Allocation" },
];

const LOG_STATUS_OPTIONS: FilterOption[] = [
  { value: "all", label: "All statuses" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending" },
];

const DIRECTION_OPTIONS: FilterOption[] = [
  { value: "all", label: "All directions" },
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
];

const RESOLVED_OPTIONS: FilterOption[] = [
  { value: "unresolved", label: "Unresolved only" },
  { value: "resolved", label: "Resolved only" },
  { value: "all", label: "All records" },
];

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatSyncTimestamp(value: string | null | undefined) {
  if (!value) return "Never";
  return formatDateTime(value);
}

function entityStatusTone(entity: KekaEntitySyncStatus) {
  if (entity.unresolvedFailures > 0 || entity.lastRunFailed > 0) {
    return "warn";
  }
  if (entity.lastSuccessfulAt) {
    return "ok";
  }
  return "idle";
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized === "success") {
    return (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
        Success
      </Badge>
    );
  }
  if (normalized === "failed") {
    return (
      <Badge className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50">
        Failed
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
  menuClassName,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  menuClassName?: string;
}) {
  const active = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 gap-2 rounded-xl border-border/60 bg-muted/45 px-3 font-normal shadow-none dark:bg-card",
              value !== "all" && "border-primary/40 bg-primary/5",
            )}
          />
        }
      >
        <span className="text-muted-foreground">{label}</span>
        <span className="max-w-[160px] truncate font-medium">
          {active?.label ?? label}
        </span>
        <ChevronDown className="size-3.5 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn("max-h-72 overflow-y-auto p-2", menuClassName ?? "w-56")}
      >
        <div className="space-y-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "flex w-full flex-col rounded-xl border px-3 py-2 text-left transition-colors",
                value === option.value
                  ? "border-primary/30 bg-primary/5"
                  : "border-transparent hover:border-border/60 hover:bg-muted/50",
              )}
            >
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function KekaIntegrationPanel() {
  const permissions = useAppSelector((state) => state.auth.permissions);
  const canConfigureIntegrations = hasModulePermission(
    permissions,
    "integrations",
    "configure",
  );

  const [subTab, setSubTab] = useState<IntegrationSubTab>("logs");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [resolvedFilter, setResolvedFilter] = useState<"unresolved" | "resolved" | "all">(
    "unresolved",
  );
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setPageIndex(0);
  }, [subTab, debouncedSearch, statusFilter, entityTypeFilter, directionFilter, resolvedFilter, pageSize]);

  const logsQuery = useGetKekaSyncLogsQuery(
    {
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      entityType: entityTypeFilter === "all" ? undefined : entityTypeFilter,
      direction:
        directionFilter === "all"
          ? undefined
          : (directionFilter as "inbound" | "outbound"),
    },
    {
      skip: subTab !== "logs",
      pollingInterval: INTEGRATION_POLLING_INTERVAL_MS,
    },
  );

  const failuresQuery = useGetFailedSyncRecordsQuery(
    {
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      integration: "keka",
      entityType: entityTypeFilter === "all" ? undefined : entityTypeFilter,
      // Always send an explicit boolean so unresolved (false) is not dropped.
      isResolved:
        resolvedFilter === "all" ? undefined : resolvedFilter === "resolved",
    },
    {
      skip: subTab !== "failures",
      pollingInterval: INTEGRATION_POLLING_INTERVAL_MS,
    },
  );

  const syncStatusQuery = useGetKekaSyncStatusQuery(undefined, {
    pollingInterval: INTEGRATION_POLLING_INTERVAL_MS,
  });
  const reconcileQuery = useGetKekaTimesheetReconcileQuery();
  const reconcileResult = reconcileQuery.data ?? null;

  const [retrySync] = useRetryKekaSyncMutation();
  const [syncEmployees, { isLoading: syncingEmployees }] =
    useTriggerKekaEmployeeSyncMutation();
  const [syncLeave, { isLoading: syncingLeave }] = useTriggerKekaLeaveSyncMutation();
  const [syncAttendance, { isLoading: syncingAttendance }] =
    useTriggerKekaAttendanceSyncMutation();
  const [syncHolidays, { isLoading: syncingHolidays }] =
    useTriggerKekaHolidaysSyncMutation();
  const [syncSalary, { isLoading: syncingSalary }] =
    useTriggerKekaSalarySyncMutation();
  const [syncClients, { isLoading: syncingClients }] =
    useTriggerKekaClientsSyncMutation();
  const [syncProjects, { isLoading: syncingProjects }] =
    useTriggerKekaProjectsSyncMutation();
  const [syncAll, { isLoading: syncingAll }] = useTriggerKekaFullSyncMutation();
  const [reconcileTimesheets, { isLoading: reconcilingTimesheets }] =
    useReconcileKekaTimesheetsMutation();

  const syncBusy =
    syncingEmployees ||
    syncingLeave ||
    syncingAttendance ||
    syncingHolidays ||
    syncingSalary ||
    syncingClients ||
    syncingProjects ||
    syncingAll ||
    reconcilingTimesheets;

  const activeQuery = subTab === "logs" ? logsQuery : failuresQuery;
  const isFetching =
    activeQuery.isFetching ||
    syncStatusQuery.isFetching ||
    reconcileQuery.isFetching;
  const hasFailuresError = subTab === "failures" && Boolean(failuresQuery.error);
  const syncStatus = syncStatusQuery.data;

  const refetchAll = useCallback(() => {
    void syncStatusQuery.refetch();
    void reconcileQuery.refetch();
    void activeQuery.refetch();
  }, [activeQuery, reconcileQuery, syncStatusQuery]);

  const filterControls = (
    <div className="flex flex-wrap items-center gap-2">
      <FilterDropdown
        label="Entity"
        value={entityTypeFilter}
        options={ENTITY_OPTIONS}
        onChange={setEntityTypeFilter}
        menuClassName="w-60"
      />

      {subTab === "logs" ? (
        <>
          <FilterDropdown
            label="Status"
            value={statusFilter}
            options={LOG_STATUS_OPTIONS}
            onChange={setStatusFilter}
          />
          <FilterDropdown
            label="Direction"
            value={directionFilter}
            options={DIRECTION_OPTIONS}
            onChange={setDirectionFilter}
          />
        </>
      ) : (
        <FilterDropdown
          label="Resolution"
          value={resolvedFilter}
          options={RESOLVED_OPTIONS}
          onChange={(value) =>
            setResolvedFilter(value as "unresolved" | "resolved" | "all")
          }
        />
      )}

      {!canConfigureIntegrations && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isFetching}
          onClick={() => refetchAll()}
        >
          {isFetching ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Refresh
        </Button>
      )}
    </div>
  );

  const tableProps = {
    manual: true as const,
    searchPlaceholder: "Search entity ID or error message…",
    pageIndex,
    pageSize,
    onPageSizeChange: setPageSize,
    onPageChange: setPageIndex,
    searchValue: search,
    onSearchChange: setSearch,
    filters: filterControls,
  };

  const unresolvedCount =
    subTab === "failures" ? (failuresQuery.data?.unresolvedCount ?? 0) : 0;

  const handleRetryRecord = useCallback(
    async (record: FailedSyncRecordEntry) => {
      setRetryingId(record.id);
      try {
        const result = await retrySync({ failedSyncRecordId: record.id }).unwrap();
        if (result.success) {
          toast.success(result.message ?? "Retry succeeded.");
        } else {
          toast.error(result.message ?? "Retry failed.");
        }
      } catch {
        toast.error("Could not retry sync.");
      } finally {
        setRetryingId(null);
      }
    },
    [retrySync],
  );

  const handleRetryLog = useCallback(
    async (log: KekaSyncLogEntry) => {
      const key = `${log.entityType}:${log.entityId}`;
      setRetryingId(key);
      try {
        const result = await retrySync({
          entityType: log.entityType,
          entityId: log.entityId,
        }).unwrap();
        if (result.success) {
          toast.success(result.message ?? "Retry succeeded.");
        } else {
          toast.error(result.message ?? "Retry failed.");
        }
      } catch {
        toast.error("Could not retry sync.");
      } finally {
        setRetryingId(null);
      }
    },
    [retrySync],
  );

  const logColumns = useMemo((): ColumnDef<KekaSyncLogEntry>[] => {
    const cols: ColumnDef<KekaSyncLogEntry>[] = [
      {
        accessorKey: "createdAt",
        header: "Time",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "entityType",
        header: "Entity",
        cell: ({ row }) => (
          <span className="text-sm font-medium capitalize">{row.original.entityType}</span>
        ),
      },
      {
        accessorKey: "entityId",
        header: "Entity ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.entityId.slice(0, 8)}…
          </span>
        ),
      },
      {
        accessorKey: "direction",
        header: "Direction",
        cell: ({ row }) => (
          <span className="text-xs capitalize text-muted-foreground">
            {row.original.direction}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "retryCount",
        header: "Retries",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original.retryCount}</span>
        ),
      },
      {
        accessorKey: "errorMsg",
        header: "Error",
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-xs text-xs text-muted-foreground">
            {row.original.errorMsg ?? "—"}
          </span>
        ),
      },
    ];

    if (canConfigureIntegrations) {
      cols.push({
        id: "actions",
        header: () => <span className="block text-right">Actions</span>,
        cell: ({ row }) => {
          if (row.original.status !== "failed") {
            return <span className="block text-right text-xs text-muted-foreground">—</span>;
          }
          const key = `${row.original.entityType}:${row.original.entityId}`;
          return (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={retryingId === key}
                onClick={() => void handleRetryLog(row.original)}
              >
                {retryingId === key ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RotateCcw className="size-3" />
                )}
                Retry
              </Button>
            </div>
          );
        },
      });
    }

    return cols;
  }, [canConfigureIntegrations, handleRetryLog, retryingId]);

  const failureColumns = useMemo((): ColumnDef<FailedSyncRecordEntry>[] => {
    const cols: ColumnDef<FailedSyncRecordEntry>[] = [
      {
        accessorKey: "lastAttempted",
        header: "Last attempt",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatDateTime(row.original.lastAttempted)}
          </span>
        ),
      },
      {
        accessorKey: "integration",
        header: "Integration",
        cell: ({ row }) => (
          <span className="text-sm font-medium uppercase">{row.original.integration}</span>
        ),
      },
      {
        accessorKey: "entityType",
        header: "Entity",
        cell: ({ row }) => (
          <span className="text-sm capitalize">{row.original.entityType}</span>
        ),
      },
      {
        accessorKey: "entityId",
        header: "Entity ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.entityId ? `${row.original.entityId.slice(0, 8)}…` : "—"}
          </span>
        ),
      },
      {
        accessorKey: "retryCount",
        header: "Retries",
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original.retryCount}</span>
        ),
      },
      {
        accessorKey: "isResolved",
        header: "Status",
        cell: ({ row }) =>
          row.original.isResolved ? (
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
              Resolved
            </Badge>
          ) : (
            <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
              Unresolved
            </Badge>
          ),
      },
      {
        accessorKey: "errorMsg",
        header: "Error",
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-xs text-xs text-muted-foreground">
            {row.original.errorMsg}
          </span>
        ),
      },
    ];

    if (canConfigureIntegrations) {
      cols.push({
        id: "actions",
        header: () => <span className="block text-right">Actions</span>,
        cell: ({ row }) => {
          if (row.original.isResolved) {
            return (
              <span className="block text-right text-xs text-muted-foreground">
                {row.original.resolvedByName ?? "Resolved"}
              </span>
            );
          }
          return (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={retryingId === row.original.id}
                onClick={() => void handleRetryRecord(row.original)}
              >
                {retryingId === row.original.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RotateCcw className="size-3" />
                )}
                Retry
              </Button>
            </div>
          );
        },
      });
    }

    return cols;
  }, [canConfigureIntegrations, handleRetryRecord, retryingId]);

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-xl border p-4 space-y-3",
          reconcileResult &&
            reconcileResult.mismatchCount + reconcileResult.pendingCount > 0
            ? "border-amber-200/80 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20"
            : "border-border/50 bg-card",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Timesheet reconcile
            </p>
            {reconcileResult ? (
              <>
                <p className="mt-1 text-sm">
                  {reconcileResult.startDate} – {reconcileResult.endDate} ·{" "}
                  <span className="font-semibold">
                    {reconcileResult.source === "keka-live"
                      ? "Pulled from Keka"
                      : "Local push ack only"}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {reconcileResult.source === "keka-live"
                    ? "Cybsec approved hours vs hours pulled from Keka PSA (last 30 days)."
                    : "Push acknowledgement only — approved vs locally synced hours."}
                </p>
              </>
            ) : reconcileQuery.isLoading ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Comparing approved hours with Keka…
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Could not load reconcile snapshot. Try Refresh or Reconcile timesheets.
              </p>
            )}
          </div>
          {(reconcileQuery.isLoading || reconcileQuery.isFetching) && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {reconcileResult ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {(
                [
                  {
                    label: "Matched",
                    value: reconcileResult.matchedCount,
                    className: RECONCILE_STATUS_CONFIG.matched.text,
                  },
                  {
                    label: "Pending sync",
                    value: reconcileResult.pendingCount,
                    className: RECONCILE_STATUS_CONFIG.pending.text,
                  },
                  {
                    label: "Mismatch",
                    value: reconcileResult.mismatchCount,
                    className: RECONCILE_STATUS_CONFIG.mismatch.text,
                  },
                  {
                    label: "No Keka link",
                    value: reconcileResult.unavailableCount,
                    className: RECONCILE_STATUS_CONFIG.unavailable.text,
                  },
                ] as const
              ).map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                >
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                  <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", stat.className)}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {reconcileResult.pulledEntryCount} Keka entries
              {reconcileResult.notifiedAdminCount > 0
                ? ` · ${reconcileResult.notifiedAdminCount} admin notified`
                : null}
            </p>

            {reconcileResult.mismatches.length > 0 ? (
              <div className="space-y-2">
                {reconcileResult.mismatches.slice(0, 8).map((row) => {
                  const status = RECONCILE_STATUS_CONFIG[row.status];
                  return (
                    <div
                      key={row.employeeId}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="min-w-0 truncate font-medium">{row.name}</span>
                      <span
                        className={cn("shrink-0 tabular-nums font-semibold", status.text)}
                      >
                        {status.label} · local {row.localApprovedHours.toFixed(1)}h · Keka{" "}
                        {row.kekaRemoteHours.toFixed(1)}h · Δ {row.deltaHours.toFixed(1)}h
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                All employees match Keka for this window.
              </p>
            )}
          </>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sync health
            </p>
            <p className="mt-1 text-sm text-foreground">
              Last successful sync:{" "}
              <span className="font-semibold">
                {formatSyncTimestamp(syncStatus?.lastSuccessfulAt)}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Last failure: {formatSyncTimestamp(syncStatus?.lastFailedAt)}
              {typeof syncStatus?.unresolvedFailures === "number"
                ? ` · ${syncStatus.unresolvedFailures} unresolved`
                : null}
            </p>
          </div>
          {syncStatusQuery.isLoading && !syncStatus ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(syncStatus?.entities ?? []).map((entity) => {
            const tone = entityStatusTone(entity);
            return (
              <div
                key={entity.key}
                className={cn(
                  "rounded-lg border px-3 py-2.5",
                  tone === "ok" &&
                    "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30",
                  tone === "warn" &&
                    "border-amber-200/80 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30",
                  tone === "idle" && "border-border/60 bg-background/60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{entity.label}</p>
                  {tone === "ok" ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                  ) : tone === "warn" ? (
                    <AlertCircle className="size-3.5 shrink-0 text-amber-600" />
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last success: {formatSyncTimestamp(entity.lastSuccessfulAt)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Last run:{" "}
                  {entity.lastRunAt
                    ? `${entity.lastRunSucceeded} ok / ${entity.lastRunFailed} failed`
                    : "No runs yet"}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {entity.linkedRecordCount.toLocaleString()} linked
                  {entity.unresolvedFailures > 0
                    ? ` · ${entity.unresolvedFailures} unresolved`
                    : null}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {subTab === "failures" && unresolvedCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-400">
            <span className="font-bold">{unresolvedCount} unresolved</span> Keka sync
            failure{unresolvedCount === 1 ? "" : "s"} need attention.
          </p>
        </div>
      )}

      {hasFailuresError && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-800 dark:bg-rose-900/20">
          <AlertCircle className="size-4 shrink-0 text-rose-600" />
          <p className="text-sm text-rose-800 dark:text-rose-400">
            Could not load failed sync records. Try Refresh, or check Sync log for recent
            failures.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl border border-border/50 bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setSubTab("logs")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              subTab === "logs"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Sync log
          </button>
          <button
            type="button"
            onClick={() => setSubTab("failures")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              subTab === "failures"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Failed records
          </button>
        </div>

        {canConfigureIntegrations && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={syncBusy}
              onClick={async () => {
                try {
                  await syncAll().unwrap();
                  toast.success("Full Keka sync job queued.");
                } catch {
                  toast.error("Could not queue full sync.");
                }
              }}
            >
              {syncingAll ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Layers className="size-3.5" />
              )}
              Sync all
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={syncBusy}
              onClick={async () => {
                try {
                  const result = await reconcileTimesheets().unwrap();
                  if (result.mismatchCount > 0) {
                    toast.error(
                      `${result.mismatchCount} timesheet mismatch(es) vs Keka` +
                        (result.notifiedAdminCount
                          ? ` · notified ${result.notifiedAdminCount} admin(s)`
                          : ""),
                    );
                  } else {
                    toast.success(
                      result.source === "keka-live"
                        ? "Timesheets match Keka hours."
                        : "Reconcile finished (local push ack only — Keka pull unavailable).",
                    );
                  }
                } catch {
                  toast.error("Could not reconcile timesheets with Keka.");
                }
              }}
            >
              {reconcilingTimesheets ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Scale className="size-3.5" />
              )}
              Reconcile timesheets
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={syncBusy}
              onClick={async () => {
                try {
                  await syncEmployees().unwrap();
                  toast.success("Employee sync job queued.");
                } catch {
                  toast.error("Could not queue employee sync.");
                }
              }}
            >
              {syncingEmployees ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Users className="size-3.5" />
              )}
              Sync employees
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={syncBusy}
              onClick={async () => {
                try {
                  await syncLeave().unwrap();
                  toast.success("Leave sync job queued.");
                } catch {
                  toast.error("Could not queue leave sync.");
                }
              }}
            >
              {syncingLeave ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Calendar className="size-3.5" />
              )}
              Sync leave
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={syncBusy}
              onClick={async () => {
                try {
                  await syncAttendance().unwrap();
                  toast.success("Attendance sync job queued.");
                } catch {
                  toast.error("Could not queue attendance sync.");
                }
              }}
            >
              {syncingAttendance ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Clock3 className="size-3.5" />
              )}
              Sync attendance
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={syncBusy}
              onClick={async () => {
                try {
                  await syncHolidays().unwrap();
                  toast.success("Holiday sync job queued.");
                } catch {
                  toast.error("Could not queue holiday sync.");
                }
              }}
            >
              {syncingHolidays ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <PartyPopper className="size-3.5" />
              )}
              Sync holidays
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={syncBusy}
              onClick={async () => {
                try {
                  await syncSalary().unwrap();
                  toast.success("Salary sync job queued.");
                } catch {
                  toast.error("Could not queue salary sync.");
                }
              }}
            >
              {syncingSalary ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Wallet className="size-3.5" />
              )}
              Sync salary
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={syncBusy}
              onClick={async () => {
                try {
                  await syncClients().unwrap();
                  toast.success("Client sync job queued.");
                } catch {
                  toast.error("Could not queue client sync.");
                }
              }}
            >
              {syncingClients ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Users className="size-3.5" />
              )}
              Sync clients
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={syncBusy}
              onClick={async () => {
                try {
                  await syncProjects().unwrap();
                  toast.success("Project link job queued.");
                } catch {
                  toast.error("Could not queue project sync.");
                }
              }}
            >
              {syncingProjects ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FolderKanban className="size-3.5" />
              )}
              Sync projects
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isFetching}
              onClick={() => refetchAll()}
            >
              {isFetching ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Refresh
            </Button>
          </div>
        )}
      </div>

      {subTab === "logs" ? (
        <DataTable
          {...tableProps}
          columns={logColumns}
          data={logsQuery.data?.data ?? []}
          getRowId={(row) => row.id}
          pageCount={logsQuery.data?.totalPages ?? 0}
          totalRows={logsQuery.data?.total ?? 0}
          isLoading={logsQuery.isLoading}
          emptyMessage="No Keka sync log entries match your filters."
        />
      ) : (
        <DataTable
          {...tableProps}
          columns={failureColumns}
          data={failuresQuery.data?.data ?? []}
          getRowId={(row) => row.id}
          pageCount={failuresQuery.data?.totalPages ?? 0}
          totalRows={failuresQuery.data?.total ?? 0}
          isLoading={failuresQuery.isLoading}
          emptyMessage="No failed sync records match your filters."
        />
      )}

      {subTab === "failures" &&
        failuresQuery.data?.unresolvedCount === 0 &&
        !failuresQuery.isLoading &&
        !hasFailuresError &&
        resolvedFilter === "unresolved" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          No unresolved Keka sync failures.
        </div>
      )}
    </div>
  );
}
