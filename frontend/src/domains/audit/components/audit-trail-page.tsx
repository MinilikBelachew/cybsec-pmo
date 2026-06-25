"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ColumnDef, type SortingState } from "@tanstack/react-table";
import { Copy, Download } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { DataTable } from "@/shared/components/data-table";
import { createSelectColumn } from "@/shared/components/data-table-select-column";
import { useServerTableState } from "@/shared/hooks/use-server-table-state";
import { Button } from "@/shared/ui/button";
import { useGetAuditEventsQuery, type AuditLogEntry, type AuditLogsQuery } from "../api/audit.api";
import { auditDataColumns } from "./audit-columns";
import { AuditDetailSheet } from "./audit-detail-sheet";
import { AuditFilters } from "./audit-filters";
import { AuditRowActions } from "./audit-row-actions";

const SORTABLE_COLUMNS = new Set(["createdAt", "action", "objectType"]);

export function AuditTrailPage() {
  const [breakGlassOnly, setBreakGlassOnly] = useState(false);
  const [actionFilter, setActionFilter] = useState("");
  const [objectTypeFilter, setObjectTypeFilter] = useState("");
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
  }, [breakGlassOnly, actionFilter, objectTypeFilter, setPageIndex]);

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
    actionFilter,
    objectTypeFilter,
    debouncedSearch,
    sorting,
  ]);

  const { data, isLoading, isFetching } = useGetAuditEventsQuery(queryParams);

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

  const bulkExport = (rows: AuditLogEntry[]) => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-export-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Read-only activity log with server-side search, filters, and sorting."
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
            breakGlassOnly={breakGlassOnly}
            onActionChange={setActionFilter}
            onObjectTypeChange={setObjectTypeFilter}
            onBreakGlassOnlyChange={setBreakGlassOnly}
          />
        }
        bulkSelect={{
          active: bulkActive,
          onActiveChange: setBulkActive,
          actions:
            selectedRows.length > 0 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="size-9 border-border/60 bg-white shadow-none dark:bg-card"
                  title="Export selected"
                  onClick={() => bulkExport(selectedRows)}
                >
                  <Download className="size-4" />
                </Button>
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
