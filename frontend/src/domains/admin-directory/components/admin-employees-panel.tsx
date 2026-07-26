"use client";

import { useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/components/data-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { EmployeeAvatar } from "@/shared/components/employee-avatar";
import { FilterSelect } from "@/shared/components/filter-select";
import { useServerTableState } from "@/shared/hooks/use-server-table-state";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import {
  useGetAdminDepartmentsQuery,
  useGetAdminEmployeesQuery,
  type QueryTeamDirectoryParams,
} from "@/domains/resources/api/resources.api";
import type {
  ApiTeamDirectoryMember,
  TeamDirectorySortField,
  UtilizationStatus,
} from "@/domains/resources/types/resources.types";

const SORTABLE = new Set<TeamDirectorySortField>([
  "name",
  "designation",
  "department",
  "utilization",
  "allocatedHours",
  "remainingHours",
]);

export function AdminEmployeesPanel() {
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

  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [utilFilter, setUtilFilter] = useState<UtilizationStatus | null>(null);

  useEffect(() => {
    setPageIndex(0);
  }, [departmentId, utilFilter, debouncedSearch, setPageIndex]);

  const { data: departmentsData } = useGetAdminDepartmentsQuery({
    page: 1,
    limit: 100,
    sortBy: "name",
    sortOrder: "asc",
    isActive: true,
  });

  const queryParams = useMemo((): QueryTeamDirectoryParams => {
    const activeSort = sorting[0];
    const sortBy =
      activeSort && SORTABLE.has(activeSort.id as TeamDirectorySortField)
        ? (activeSort.id as TeamDirectorySortField)
        : "name";

    return {
      search: debouncedSearch.trim() || undefined,
      departmentId: departmentId ?? undefined,
      utilizationStatus: utilFilter ?? ("all" as const),
      sortBy,
      sortOrder: activeSort?.desc ? "desc" : "asc",
      page: pageIndex + 1,
      limit: pageSize,
    };
  }, [debouncedSearch, departmentId, utilFilter, sorting, pageIndex, pageSize]);

  const { data, isLoading, isFetching, isError } =
    useGetAdminEmployeesQuery(queryParams);

  const columns = useMemo<ColumnDef<ApiTeamDirectoryMember>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        meta: { label: "Employee" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Employee" />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-[200px] items-center gap-2.5">
            <EmployeeAvatar
              name={row.original.name}
              employeeId={row.original.id}
              profileImageUrl={row.original.profileImageUrl}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold">{row.original.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.original.email}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "designation",
        accessorKey: "designation",
        meta: { label: "Designation" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Designation" />
        ),
      },
      {
        id: "department",
        accessorFn: (row) => row.department.name,
        meta: { label: "Department" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Department" />
        ),
        cell: ({ row }) => (
          <div>
            <p className="text-sm">{row.original.department.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.department.code}
            </p>
          </div>
        ),
      },
      {
        id: "utilization",
        accessorKey: "utilizationPercent",
        meta: { label: "Utilisation" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Utilisation" />
        ),
        cell: ({ row }) => (
          <div className="tabular-nums text-sm">
            <p
              className={cn(
                "font-semibold",
                row.original.isOverAllocated && "text-rose-600",
              )}
            >
              {row.original.utilizationPercent}%
            </p>
            <p className="text-[11px] text-muted-foreground">
              {row.original.allocatedHoursTotal}h /{" "}
              {row.original.weeklyCapacityHours}h
            </p>
          </div>
        ),
      },
      {
        id: "keka",
        enableSorting: false,
        meta: { label: "Keka / link" },
        header: "Keka / link",
        cell: ({ row }) => {
          const kekaId = row.original.kekaEmployeeId?.trim();
          return (
            <div className="text-xs text-muted-foreground">
              <p className="font-mono">
                {kekaId ? `${kekaId.slice(0, 8)}…` : "Not linked"}
              </p>
              <p>{row.original.projects?.length ?? 0} project(s)</p>
            </div>
          );
        },
      },
    ],
    [],
  );

  const pageCount = Math.ceil((data?.total ?? 0) / pageSize) || 0;

  return (
    <div className="space-y-4">
      {data?.stats ? (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{data.stats.total} employees</Badge>
          <Badge variant="outline" className="text-rose-600">
            {data.stats.over} over
          </Badge>
          <Badge variant="outline">{data.stats.available} available</Badge>
          <Badge variant="outline">Avg util {data.stats.avgUtil}%</Badge>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={data?.members ?? []}
        getRowId={(row) => row.id}
        manual
        searchPlaceholder="Search employees by name, email, designation…"
        pageCount={pageCount}
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
            ? "Could not load employees. Try refreshing."
            : "No employees match your search or filters."
        }
        minTableWidth="min-w-[960px]"
        columnOrderStorageKey="admin-directory-employees-columns"
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              value={departmentId}
              onValueChange={setDepartmentId}
              noneLabel="All departments"
              searchable
              options={(departmentsData?.data ?? []).map((d) => ({
                id: d.id,
                label: d.name,
                subtitle: d.code,
              }))}
            />
            <FilterSelect
              value={utilFilter}
              onValueChange={(value) =>
                setUtilFilter(value as UtilizationStatus | null)
              }
              noneLabel="All utilisation"
              options={[
                { id: "over", label: "Over-allocated" },
                { id: "optimal", label: "Optimal" },
                { id: "under", label: "Under" },
                { id: "available", label: "Available" },
              ]}
            />
          </div>
        }
      />
    </div>
  );
}
