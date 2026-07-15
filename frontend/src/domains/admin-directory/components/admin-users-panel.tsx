"use client";

import { useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Mail } from "lucide-react";
import { DataTable } from "@/shared/components/data-table";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { useServerTableState } from "@/shared/hooks/use-server-table-state";
import { Badge } from "@/shared/ui/badge";
import { FilterSelect } from "@/shared/components/filter-select";
import { cn } from "@/shared/utils/cn";
import { useGetUsersQuery, type GetUsersParams, type User } from "@/domains/users";
import { getRoleBadgeColor, getRoleLabel } from "@/domains/settings/utils/role-display";
import { ROLE_CATALOG, ROLE_CODE_BY_ID, ROLE_ID_BY_CODE } from "@/config/roles.config";

const USER_SORTABLE = new Set(["displayName", "email", "role", "isActive"]);

function resolveRoleCode(user: User) {
  return user.roleCode || user.role?.code || ROLE_CODE_BY_ID[user.roleId] || "";
}

export function AdminUsersPanel() {
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
    defaultSorting: [{ id: "displayName", desc: false }],
    pageSize: 10,
  });

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  useEffect(() => {
    setPageIndex(0);
  }, [statusFilter, roleFilter, debouncedSearch, setPageIndex]);

  const queryParams = useMemo((): GetUsersParams => {
    const activeSort = sorting[0];
    const sortBy =
      activeSort && USER_SORTABLE.has(activeSort.id)
        ? (activeSort.id as GetUsersParams["sortBy"])
        : "displayName";

    const filters: GetUsersParams["filters"] = {};
    if (roleFilter) {
      const roleId = ROLE_ID_BY_CODE[roleFilter as keyof typeof ROLE_ID_BY_CODE];
      filters.roles = roleId
        ? [{ id: roleId, code: roleFilter }]
        : [{ code: roleFilter }];
    }
    if (statusFilter === "active") filters.isActive = true;
    if (statusFilter === "inactive") filters.isActive = false;

    return {
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch.trim() || undefined,
      sortBy,
      sortOrder: activeSort?.desc ? "desc" : "asc",
      ...(Object.keys(filters).length ? { filters } : {}),
    };
  }, [pageIndex, pageSize, debouncedSearch, sorting, roleFilter, statusFilter]);

  const { data, isLoading, isFetching, isError } = useGetUsersQuery(queryParams);

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "displayName",
        accessorKey: "displayName",
        meta: { label: "User" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="User" />
        ),
        cell: ({ row }) => (
          <div className="min-w-[200px]">
            <p className="font-semibold text-foreground">{row.original.displayName}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="size-3" />
              {row.original.email}
            </p>
          </div>
        ),
      },
      {
        id: "role",
        accessorFn: (row) => resolveRoleCode(row),
        meta: { label: "Role" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => {
          const code = resolveRoleCode(row.original);
          return (
            <Badge
              className={cn(
                "border px-2 py-0.5 text-xs font-semibold",
                getRoleBadgeColor(code),
              )}
            >
              {getRoleLabel(code)}
            </Badge>
          );
        },
      },
      {
        id: "isActive",
        accessorKey: "isActive",
        meta: { label: "Status" },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
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
      {
        id: "identity",
        enableSorting: false,
        meta: { label: "Identity" },
        header: "Identity",
        cell: ({ row }) => {
          const linked =
            Boolean(row.original.entraObjectId) &&
            row.original.entraObjectId !== "pending-first-login";
          return (
            <span className="text-xs text-muted-foreground">
              {linked ? "SSO linked" : "Pending first login"}
              {row.original.isExternal ? " · External" : ""}
            </span>
          );
        },
      },
    ],
    [],
  );

  const roleOptions = ROLE_CATALOG.map((role) => ({
    id: role.code,
    label: role.label,
  }));

  return (
    <DataTable
      columns={columns}
      data={data?.data ?? []}
      getRowId={(row) => row.id}
      manual
      searchPlaceholder="Search by name, email, or role…"
      pageCount={data?.meta.totalPages ?? 0}
      totalRows={data?.meta.total ?? 0}
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
          ? "Could not load users. Try refreshing."
          : "No users match your search or filters."
      }
      minTableWidth="min-w-[900px]"
      columnOrderStorageKey="admin-directory-users-columns"
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={statusFilter}
            onValueChange={setStatusFilter}
            noneLabel="All statuses"
            options={[
              { id: "active", label: "Active" },
              { id: "inactive", label: "Inactive" },
            ]}
          />
          <FilterSelect
            value={roleFilter}
            onValueChange={setRoleFilter}
            noneLabel="All roles"
            searchable
            options={roleOptions}
          />
        </div>
      }
    />
  );
}
