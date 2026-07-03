"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { type ColumnDef, type SortingState } from "@tanstack/react-table";
import { PageHeader } from "@/shared/components/page-header";
import { DataTable } from "@/shared/components/data-table";
import { createSelectColumn } from "@/shared/components/data-table-select-column";
import { useServerTableState } from "@/shared/hooks/use-server-table-state";
import {
  downloadAuditBlob,
  downloadAuditBlobAsJson,
  downloadAuditCsv,
  downloadAuditJson,
  useLazyExportAuditFileQuery,
  useGetAuditEventsQuery,
  type AuditExportFormat,
  type AuditLogEntry,
  type AuditLogsQuery,
} from "../api/audit.api";
import { AuditExportMenu } from "./audit-export-menu";
import { auditDataColumns } from "./audit-columns";
import { AuditDetailSheet } from "./audit-detail-sheet";
import { AuditFilters } from "./audit-filters";
import { AuditRowActions } from "./audit-row-actions";
import { AUDIT_POLLING_INTERVAL_MS } from "../constants/audit-polling";
import { useAuditPollToasts } from "../hooks/use-audit-poll-toasts";

const SORTABLE_COLUMNS = new Set(["createdAt", "action", "objectType"]);

export function AuditTrailPage() {
  const [breakGlassOnly, setBreakGlassOnly] = useState(false);
  const [externalOnly, setExternalOnly] = useState(false);
  const [actionFilter, setActionFilter] = useState("");
  const [objectTypeFilter, setObjectTypeFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [selectedRows, setSelectedRows] = useState<AuditLogEntry[]>([]);
  const [bulkActive, setBulkActive] = useState(false);
  const [detailEntry, setDetailEntry] = useState<AuditLogEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const {
    pageIndex,
    setPageIndex,
    pageSize,
    setPageSize,
    search,
    setSearch,
    debouncedSearch,
    sorting,
    setSorting,
  } = useServerTableState({
    defaultSorting: [{ id: "createdAt", desc: true }] as SortingState,
    pageSize: 20,
  });

  useEffect(() => {
    setPageIndex(0);
  }, [
    breakGlassOnly,
    externalOnly,
    actionFilter,
    objectTypeFilter,
    actorFilter,
    dateFromFilter,
    dateToFilter,
    setPageIndex,
  ]);

  const clearAllFilters = useCallback(() => {
    setActionFilter("");
    setObjectTypeFilter("");
    setActorFilter("");
    setDateFromFilter("");
    setDateToFilter("");
    setBreakGlassOnly(false);
    setExternalOnly(false);
  }, []);

  const queryParams = useMemo((): AuditLogsQuery => {
    const activeSort = sorting[0];
    const sortBy =
      activeSort && SORTABLE_COLUMNS.has(activeSort.id)
        ? (activeSort.id as AuditLogsQuery["sortBy"])
        : "createdAt";

    return {
      page: pageIndex + 1,
      limit: pageSize,
      breakGlassOnly,
      externalOnly,
      actorId: actorFilter || undefined,
      dateFrom: dateFromFilter || undefined,
      dateTo: dateToFilter || undefined,
      action: actionFilter || undefined,
      objectType: objectTypeFilter || undefined,
      search: debouncedSearch.trim() || undefined,
      sortBy,
      sortOrder: activeSort?.desc ? "desc" : "asc",
    };
  }, [
    pageIndex,
    pageSize,
    breakGlassOnly,
    externalOnly,
    actionFilter,
    objectTypeFilter,
    actorFilter,
    dateFromFilter,
    dateToFilter,
    debouncedSearch,
    sorting,
  ]);

  const { data, isLoading, isFetching } = useGetAuditEventsQuery(queryParams, {
    pollingInterval: AUDIT_POLLING_INTERVAL_MS,
  });
  const [exportAuditFile, { isFetching: isExporting }] = useLazyExportAuditFileQuery();

  const tableData = useMemo(() => data?.data ?? [], [data?.data]);
  const hasSelection = selectedRows.length > 0;

  const pollResetKey = useMemo(
    () =>
      JSON.stringify({
        breakGlassOnly,
        externalOnly,
        actionFilter,
        objectTypeFilter,
        actorFilter,
        dateFromFilter,
        dateToFilter,
        debouncedSearch,
        sorting,
      }),
    [
      breakGlassOnly,
      externalOnly,
      actionFilter,
      objectTypeFilter,
      actorFilter,
      dateFromFilter,
      dateToFilter,
      debouncedSearch,
      sorting,
    ],
  );

  useAuditPollToasts({
    entries: tableData,
    isLoading,
    isFetching,
    enabled: pageIndex === 0,
    resetKey: pollResetKey,
  });

  const handleView = useCallback((entry: AuditLogEntry) => {
    setDetailEntry(entry);
    setDetailOpen(true);
  }, []);

  const columns = useMemo((): ColumnDef<AuditLogEntry>[] => {
    return [
      createSelectColumn<AuditLogEntry>(),
      ...auditDataColumns,
      {
        id: "actions",
        header: () => (
          <span className="block text-right text-sm font-medium text-muted-foreground">
            Actions
          </span>
        ),
        cell: ({ row }) => (
          <AuditRowActions entry={row.original} onView={handleView} />
        ),
        enableSorting: false,
        enableHiding: false,
        meta: { sticky: "right" },
      },
    ];
  }, [handleView]);

  const exportRows = useCallback(
    async (format: AuditExportFormat) => {
      const prefix = hasSelection ? "audit-export-selected" : "audit-export";
      const timestamp = Date.now();
      const formatLabel = format.toUpperCase();

      try {
        if (hasSelection) {
          const rows = selectedRows;

          if (format === "json") {
            downloadAuditJson(`${prefix}-${timestamp}.json`, rows);
            toast.success(`Exported ${rows.length} event(s) as ${formatLabel}`);
            return;
          }

          if (format === "csv") {
            downloadAuditCsv(`${prefix}-${timestamp}.csv`, rows);
            toast.success(`Exported ${rows.length} event(s) as ${formatLabel}`);
            return;
          }

          const blob = await exportAuditFile({
            params: { eventIds: rows.map((row) => row.id) },
            format,
          }).unwrap();
          downloadAuditBlob(`${prefix}-${timestamp}.${format}`, blob);
          toast.success(`Exported ${rows.length} event(s) as ${formatLabel}`);
          return;
        }

        if (format === "csv") {
          const blob = await exportAuditFile({ params: queryParams, format: "json" }).unwrap();
          const text = await blob.text();
          const entries: AuditLogEntry[] = JSON.parse(text);
          downloadAuditCsv(`${prefix}-${timestamp}.csv`, entries);
          toast.success(`Exported ${entries.length} event(s) as CSV`);
        } else if (format === "json") {
          const blob = await exportAuditFile({ params: queryParams, format: "json" }).unwrap();
          await downloadAuditBlobAsJson(`${prefix}-${timestamp}.json`, blob);
          toast.success(`Exported filtered audit log as ${formatLabel}`);
        } else {
          const blob = await exportAuditFile({ params: queryParams, format }).unwrap();
          downloadAuditBlob(`${prefix}-${timestamp}.${format}`, blob);
          toast.success(`Exported filtered audit log as ${formatLabel}`);
        }
      } catch {
        toast.error("Audit export failed. Please try again.");
      }
    },
    [exportAuditFile, hasSelection, queryParams, selectedRows],
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Audit Trail"
        description={
          isFetching && !isLoading
            ? "Read-only activity log with server-side search, filters, and sorting. Refreshing…"
            : "Read-only activity log with server-side search, filters, and sorting."
        }
        actions={
          <AuditExportMenu
            disabled={isExporting}
            label={
              hasSelection
                ? `Export selected (${selectedRows.length})`
                : "Export filtered"
            }
            onExport={(format) => void exportRows(format)}
          />
        }
      />

      <DataTable
        columns={columns}
        data={tableData}
        getRowId={(row) => row.id}
        manual
        searchPlaceholder="Search action, actor, object, IP…"
        pageCount={data?.meta.totalPages ?? 0}
        totalRows={data?.meta.total ?? 0}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        onPageChange={setPageIndex}
        sorting={sorting}
        onSortingChange={setSorting}
        searchValue={search}
        onSearchChange={setSearch}
        isLoading={isLoading}
        emptyMessage="No audit events match your filters."
        onSelectionChange={bulkActive ? setSelectedRows : undefined}
        filters={
          <AuditFilters
            action={actionFilter}
            objectType={objectTypeFilter}
            actorId={actorFilter}
            dateFrom={dateFromFilter}
            dateTo={dateToFilter}
            breakGlassOnly={breakGlassOnly}
            externalOnly={externalOnly}
            onActionChange={setActionFilter}
            onObjectTypeChange={setObjectTypeFilter}
            onActorIdChange={setActorFilter}
            onDateFromChange={setDateFromFilter}
            onDateToChange={setDateToFilter}
            onBreakGlassOnlyChange={setBreakGlassOnly}
            onExternalOnlyChange={setExternalOnly}
            onClearAll={clearAllFilters}
          />
        }
        bulkSelect={{
          active: bulkActive,
          onActiveChange: (active) => {
            setBulkActive(active);
            if (!active) setSelectedRows([]);
          },
          actions: hasSelection ? (
            <AuditExportMenu
              disabled={isExporting}
              label={`Export (${selectedRows.length})`}
              onExport={(format) => void exportRows(format)}
            />
          ) : null,
        }}
      />

      <AuditDetailSheet
        entry={detailEntry}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
