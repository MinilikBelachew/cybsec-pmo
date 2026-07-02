"use client";

import { useCallback, useMemo, useState } from "react";
import { type ColumnDef, type SortingState } from "@tanstack/react-table";
import { DataTable } from "@/shared/components/data-table";
import { useServerTableState } from "@/shared/hooks/use-server-table-state";
import { useGetProjectAuditEventsQuery } from "../../../api/projects.api";
import { auditDataColumns } from "@/domains/audit/components/audit-columns";
import { AuditDetailSheet } from "@/domains/audit/components/audit-detail-sheet";
import { AuditRowActions } from "@/domains/audit/components/audit-row-actions";
import { AUDIT_POLLING_INTERVAL_MS } from "@/domains/audit/constants/audit-polling";
import type { AuditLogEntry, AuditLogsQuery } from "@/domains/audit/api/audit.api";

const SORTABLE_COLUMNS = new Set(["createdAt", "action", "objectType"]);

type ProjectAuditViewProps = {
  projectId: string;
};

export function ProjectAuditView({ projectId }: ProjectAuditViewProps) {
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

  const queryParams = useMemo((): AuditLogsQuery => {
    const activeSort = sorting[0];
    const sortBy =
      activeSort && SORTABLE_COLUMNS.has(activeSort.id)
        ? (activeSort.id as AuditLogsQuery["sortBy"])
        : "createdAt";

    return {
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch.trim() || undefined,
      sortBy,
      sortOrder: activeSort?.desc ? "desc" : "asc",
    };
  }, [pageIndex, pageSize, debouncedSearch, sorting]);

  const { data, isLoading, isFetching } = useGetProjectAuditEventsQuery(
    { projectId, ...queryParams },
    { pollingInterval: AUDIT_POLLING_INTERVAL_MS },
  );

  const tableData = useMemo(() => data?.data ?? [], [data?.data]);

  const handleView = useCallback((entry: AuditLogEntry) => {
    setDetailEntry(entry);
    setDetailOpen(true);
  }, []);

  const columns = useMemo((): ColumnDef<AuditLogEntry>[] => {
    return [
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

  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-foreground">Project audit log</h2>
        <p className="text-xs text-muted-foreground">
          All activity for this project — updates, tasks, phases, milestones, team, and imports.
          {isFetching && !isLoading ? (
            <span className="ml-1 text-primary">Refreshing…</span>
          ) : null}
        </p>
      </div>

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
        emptyMessage="No audit events recorded for this project yet."
      />

      <AuditDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        entry={detailEntry}
      />
    </div>
  );
}
