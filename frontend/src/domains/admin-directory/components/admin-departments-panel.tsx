"use client";

import { useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/components/data-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { FilterSelect } from "@/shared/components/filter-select";
import { useServerTableState } from "@/shared/hooks/use-server-table-state";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import { useGetAdminDepartmentsQuery } from "@/domains/resources/api/resources.api";
import type {
  AdminDepartmentRow,
  QueryAdminDepartmentsParams,
} from "../types/admin-directory.types";

const SORTABLE = new Set(["name", "code", "employeeCount", "createdAt"]);

export function AdminDepartmentsPanel() {
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
    defaultSorting: [{ id: "name", desc: false }],
    pageSize: 10,
  });

  const [statusFilter, setStatusFilter] = useState<string | null>("active");

  useEffect(() => {
    setPageIndex(0);
  }, [statusFilter, debouncedSearch, setPageIndex]);

  const queryParams = useMemo((): QueryAdminDepartmentsParams => {
    const activeSort = sorting[0];
    const sortBy =
      activeSort && SORTABLE.has(activeSort.id)
        ? (activeSort.id as QueryAdminDepartmentsParams["sortBy"])
        : "name";

    return {
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch.trim() || undefined,
      sortBy,
      sortOrder: activeSort?.desc ? "desc" : "asc",
      ...(statusFilter === "active"
        ? { isActive: true }
        : statusFilter === "inactive"
          ? { isActive: false }
          : {}),
    };
  }, [pageIndex, pageSize, debouncedSearch, sorting, statusFilter]);

  const { data, isLoading, isFetching, isError } =
    useGetAdminDepartmentsQuery(queryParams);

  const columns = useMemo<ColumnDef<AdminDepartmentRow>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        meta: { label: "Department" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Department" />
        ),
        cell: ({ row }) => (
          <div>
            <p className="font-semibold">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.code}</p>
          </div>
        ),
      },
      {
        id: "code",
        accessorKey: "code",
        meta: { label: "Code" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Code" />
        ),
      },
      {
        id: "employeeCount",
        accessorKey: "employeeCount",
        meta: { label: "Employees" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Employees" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.employeeCount}</span>
        ),
      },
      {
        id: "projects",
        accessorKey: "projectCount",
        enableSorting: false,
        meta: { label: "Projects" },
        header: "Projects",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.projectCount}</span>
        ),
      },
      {
        id: "keka",
        enableSorting: false,
        meta: { label: "Keka link" },
        header: "Keka link",
        cell: ({ row }) =>
          row.original.kekaDepartmentId ? (
            <span className="font-mono text-xs text-muted-foreground">
              {row.original.kekaDepartmentId.slice(0, 8)}…
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Not linked</span>
          ),
      },
      {
        id: "status",
        accessorKey: "isActive",
        enableSorting: false,
        meta: { label: "Status" },
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              row.original.isActive
                ? "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                : "border-border text-muted-foreground",
            )}
          >
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data?.data ?? []}
      getRowId={(row) => row.id}
      manual
      searchPlaceholder="Search by name, code, or Keka id…"
      pageCount={data?.totalPages ?? 0}
      totalRows={data?.total ?? 0}
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageChange={setPageIndex}
      onPageSizeChange={setPageSize}
      sorting={sorting}
      onSortingChange={setSorting}
      searchValue={search}
      onSearchChange={setSearch}
      isLoading={isLoading || isFetching}
      emptyMessage={
        isError
          ? "Could not load departments. Try refreshing."
          : "No departments match your search or filters."
      }
      minTableWidth="min-w-[900px]"
      columnOrderStorageKey="admin-directory-departments-columns"
      filters={
        <FilterSelect
          value={statusFilter}
          onValueChange={setStatusFilter}
          noneLabel="All statuses"
          options={[
            { id: "active", label: "Active" },
            { id: "inactive", label: "Inactive" },
          ]}
        />
      }
    />
  );
}
