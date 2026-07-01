"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Copy, Download, FileJson, Table2 } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { DataTable } from "@/shared/components/data-table";
import { createSelectColumn } from "@/shared/components/data-table-select-column";
import { useServerTableState } from "@/shared/hooks/use-server-table-state";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
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

const SORTABLE_COLUMNS = new Set(["createdAt", "action", "objectType"]);

export function AuditTrailPage() {
  const [breakGlassOnly, setBreakGlassOnly] = useState(false);
  const [externalOnly, setExternalOnly] = useState(false);
  const [actionFilter, setActionFilter] = useState("");
  const [objectTypeFilter, setObjectTypeFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [bulkActive, setBulkActive] = useState(false);
  const [selectedRows, setSelectedRows] = useState<AuditLogEntry[]>([]);
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

  const { data, isLoading, isFetching } = useGetAuditEventsQuery(queryParams);
  const [exportAuditFile, { isFetching: isExporting }] = useLazyExportAuditFileQuery();

  const tableData = useMemo(() => data?.data ?? [], [data?.data]);

  const handleView = useCallback((entry: AuditLogEntry) => {
    setDetailEntry(entry);
    setDetailOpen(true);
  }, []);

  const columns = useMemo((): ColumnDef<AuditLogEntry>[] => {
    const cols: ColumnDef<AuditLogEntry>[] = [];

    if (bulkActive) {
      cols.push(createSelectColumn<AuditLogEntry>());
    }

    cols.push(...auditDataColumns);

    cols.push({
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
    });

    return cols;
  }, [bulkActive, handleView]);

  const bulkExport = (rows: AuditLogEntry[], format: "json" | "csv" = "json") => {
    if (format === "csv") {
      downloadAuditCsv(`audit-export-selected-${Date.now()}.csv`, rows);
    } else {
      downloadAuditJson(`audit-export-selected-${Date.now()}.json`, rows);
    }
  };

  /**
   * Export filtered rows.
   * - csv  → built entirely on the frontend from the full export JSON
   * - json → fetched from backend, then pretty-printed before saving
   * - xlsx / pdf → streamed directly from the backend as-is
   */
  const exportFiltered = async (format: AuditExportFormat) => {
    try {
      if (format === "csv") {
        // Fetch full JSON export, then convert to CSV on the frontend
        const blob = await exportAuditFile({ params: queryParams, format: "json" }).unwrap();
        const text = await blob.text();
        const entries: AuditLogEntry[] = JSON.parse(text);
        downloadAuditCsv(`audit-export-${Date.now()}.csv`, entries);
      } else if (format === "json") {
        // Fetch JSON blob from backend and re-save as pretty-printed JSON
        const blob = await exportAuditFile({ params: queryParams, format: "json" }).unwrap();
        await downloadAuditBlobAsJson(`audit-export-${Date.now()}.json`, blob);
      } else {
        // xlsx / pdf — download the backend blob directly
        const blob = await exportAuditFile({ params: queryParams, format }).unwrap();
        downloadAuditBlob(`audit-export-${Date.now()}.${format}`, blob);
      }
    } catch {
      // RTK surfaces errors via hook state
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Read-only activity log with server-side search, filters, and sorting."
        actions={
          <AuditExportMenu
            disabled={isExporting}
            onExport={(format) => void exportFiltered(format)}
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
        isLoading={isLoading || isFetching}
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
          onActiveChange: setBulkActive,
          actions:
            selectedRows.length > 0 ? (
              <>
                {/* Bulk export dropdown for selected rows */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 border-border/60 bg-white shadow-none dark:bg-card text-xs"
                        title={`Export ${selectedRows.length} selected row${selectedRows.length === 1 ? "" : "s"}`}
                      />
                    }
                  >
                    <Download className="size-3.5" />
                    Export ({selectedRows.length})
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 p-2 shadow-none">
                    <div className="space-y-1">
                      <DropdownMenuItem
                        onClick={() => bulkExport(selectedRows, "json")}
                        className="flex items-start gap-3 rounded-xl border border-transparent px-2.5 py-1.5 cursor-pointer hover:border-border/60 hover:bg-muted/50"
                      >
                        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                          <FileJson className="size-3.5 text-amber-500" />
                        </div>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold">JSON</span>
                          <span className="block text-[10px] text-muted-foreground">Pretty-printed, structured</span>
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => bulkExport(selectedRows, "csv")}
                        className="flex items-start gap-3 rounded-xl border border-transparent px-2.5 py-1.5 cursor-pointer hover:border-border/60 hover:bg-muted/50"
                      >
                        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                          <Table2 className="size-3.5 text-emerald-500" />
                        </div>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold">CSV</span>
                          <span className="block text-[10px] text-muted-foreground">Spreadsheet rows</span>
                        </span>
                      </DropdownMenuItem>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="size-9 border-border/60 bg-white shadow-none dark:bg-card"
                  title="Copy selected IDs"
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      selectedRows.map((r) => r.id).join("\n"),
                    )
                  }
                >
                  <Copy className="size-4" />
                </Button>
              </>
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
