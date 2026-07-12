"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  AlertCircle,
  CheckCircle2,
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
} from "lucide-react";
import { toast } from "react-hot-toast";
import { DataTable } from "@/shared/components/data-table";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { useAppSelector } from "@/store/hooks";
import { hasModulePermission } from "@/domains/auth/utils/module-permissions";
import {
  useGetFailedSyncRecordsQuery,
  useGetKekaSyncLogsQuery,
  useRetryKekaSyncMutation,
  useTriggerKekaEmployeeSyncMutation,
  useTriggerKekaLeaveSyncMutation,
  useTriggerKekaAttendanceSyncMutation,
  useTriggerKekaHolidaysSyncMutation,
  useTriggerKekaSalarySyncMutation,
  useTriggerKekaProjectsSyncMutation,
  useTriggerKekaFullSyncMutation,
} from "../api/audit.api";
import type {
  FailedSyncRecordEntry,
  KekaSyncLogEntry,
} from "../types/audit.types";
import { AUDIT_POLLING_INTERVAL_MS } from "../constants/audit-polling";

type IntegrationSubTab = "logs" | "failures";

const ENTITY_TYPES = [
  "department",
  "employee",
  "leave",
  "attendance",
  "holiday",
  "holiday_calendar",
  "salary",
  "pay_cycle",
  "project",
  "task",
  "timesheet",
  "allocation",
] as const;
const LOG_STATUSES = ["success", "failed", "pending"] as const;

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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

export function AuditKekaIntegrationPanel() {
  const permissions = useAppSelector((state) => state.auth.permissions);
  const canConfigureIntegrations = hasModulePermission(
    permissions,
    "integrations",
    "configure",
  );

  const [subTab, setSubTab] = useState<IntegrationSubTab>("failures");
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
      pollingInterval: AUDIT_POLLING_INTERVAL_MS,
    },
  );

  const failuresQuery = useGetFailedSyncRecordsQuery(
    {
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      entityType: entityTypeFilter === "all" ? undefined : entityTypeFilter,
      isResolved:
        resolvedFilter === "all"
          ? undefined
          : resolvedFilter === "resolved",
    },
    {
      skip: subTab !== "failures",
      pollingInterval: AUDIT_POLLING_INTERVAL_MS,
    },
  );

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
  const [syncProjects, { isLoading: syncingProjects }] =
    useTriggerKekaProjectsSyncMutation();
  const [syncAll, { isLoading: syncingAll }] = useTriggerKekaFullSyncMutation();

  const syncBusy =
    syncingEmployees ||
    syncingLeave ||
    syncingAttendance ||
    syncingHolidays ||
    syncingSalary ||
    syncingProjects ||
    syncingAll;

  const activeQuery = subTab === "logs" ? logsQuery : failuresQuery;
  const isFetching = activeQuery.isFetching;

  const filterControls = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={entityTypeFilter}
        onChange={(e) => setEntityTypeFilter(e.target.value)}
        className="h-9 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm outline-none focus:ring-1 focus:ring-primary/30"
      >
        <option value="all">All entities</option>
        {ENTITY_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      {subTab === "logs" ? (
        <>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="all">All statuses</option>
            {LOG_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="h-9 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="all">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </>
      ) : (
        <select
          value={resolvedFilter}
          onChange={(e) =>
            setResolvedFilter(e.target.value as "unresolved" | "resolved" | "all")
          }
          className="h-9 rounded-xl border border-border/50 bg-muted/50 px-3 text-sm outline-none focus:ring-1 focus:ring-primary/30"
        >
          <option value="unresolved">Unresolved only</option>
          <option value="resolved">Resolved only</option>
          <option value="all">All</option>
        </select>
      )}

      {!canConfigureIntegrations && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isFetching}
          onClick={() => void activeQuery.refetch()}
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
      {subTab === "failures" && unresolvedCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-400">
            <span className="font-bold">{unresolvedCount} unresolved</span> Keka sync
            failure{unresolvedCount === 1 ? "" : "s"} need attention.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl border border-border/50 bg-muted/30 p-1">
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
              onClick={() => void activeQuery.refetch()}
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
        resolvedFilter === "unresolved" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          No unresolved Keka sync failures.
        </div>
      )}
    </div>
  );
}
