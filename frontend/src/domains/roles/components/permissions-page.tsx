"use client";

import { useMemo } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { DataTable } from "@/shared/components/data-table";
import { Input } from "@/shared/ui/input";
import { useServerTableState } from "@/shared/hooks/use-server-table-state";
import { useGetAllPermissionsQuery } from "../api/roles.api";
import type { AllPermissionsQuery } from "../types/roles.types";
import { allPermissionColumns } from "./all-permission-columns";

const PERMISSION_SORTABLE = new Set(["module", "action", "recordScope", "roleCode", "roleLabel"]);

export function PermissionsPage() {
  const permissionsTable = useServerTableState({
    defaultSorting: [{ id: "roleCode", desc: false }],
    pageSize: 20,
  });

  const permissionsQuery = useMemo((): AllPermissionsQuery => {
    const activeSort = permissionsTable.sorting[0];
    const sortBy =
      activeSort && PERMISSION_SORTABLE.has(activeSort.id)
        ? (activeSort.id as AllPermissionsQuery["sortBy"])
        : "roleCode";

    return {
      page: permissionsTable.pageIndex + 1,
      limit: permissionsTable.pageSize,
      search: permissionsTable.debouncedSearch.trim() || undefined,
      sortBy,
      sortOrder: activeSort?.desc ? "desc" : "asc",
    };
  }, [
    permissionsTable.pageIndex,
    permissionsTable.pageSize,
    permissionsTable.debouncedSearch,
    permissionsTable.sorting,
  ]);

  const { data, isLoading, isFetching } = useGetAllPermissionsQuery(permissionsQuery);

  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        title="Permissions"
        description="Full RBAC permission matrix across all roles with server-side search, sorting, and pagination."
      />

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={permissionsTable.search}
          onChange={(event) => permissionsTable.setSearch(event.target.value)}
          placeholder="Search permissions, modules, actions, or roles…"
          maxLength={200}
          className="h-10 border-border/60 bg-white ps-9 shadow-none dark:bg-card"
        />
      </div>

      <DataTable
        className="min-w-0"
        minTableWidth="min-w-0"
        hideSearch
        columns={allPermissionColumns}
        data={data?.data ?? []}
        getRowId={(row) => row.id}
        manual
        pageCount={data?.meta.totalPages ?? 0}
        totalRows={data?.meta.total ?? 0}
        pageIndex={permissionsTable.pageIndex}
        pageSize={permissionsTable.pageSize}
        onPageSizeChange={permissionsTable.setPageSize}
        onPageChange={permissionsTable.setPageIndex}
        sorting={permissionsTable.sorting}
        onSortingChange={permissionsTable.setSorting}
        searchValue={permissionsTable.search}
        onSearchChange={permissionsTable.setSearch}
        isLoading={isLoading || isFetching}
        emptyMessage="No permissions found."
      />
    </div>
  );
}
