"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/shared/components/page-header";
import { DataTable } from "@/shared/components/data-table";
import { useServerTableState } from "@/shared/hooks/use-server-table-state";
import { Button } from "@/shared/ui/button";
import { useGetRolesQuery } from "../api/roles.api";
import type { RoleListItem, RolesQuery } from "../types/roles.types";
import { roleColumns } from "./role-columns";
import { RolePermissionsSheet } from "./role-permissions-sheet";

const ROLE_SORTABLE = new Set(["code", "label", "isExternal", "permissionCount", "createdAt"]);

export function RolesPage() {
  const [sheetRole, setSheetRole] = useState<RoleListItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const rolesTable = useServerTableState({
    defaultSorting: [{ id: "code", desc: false }],
    pageSize: 10,
  });

  const rolesQuery = useMemo((): RolesQuery => {
    const activeSort = rolesTable.sorting[0];
    const sortBy =
      activeSort && ROLE_SORTABLE.has(activeSort.id)
        ? (activeSort.id as RolesQuery["sortBy"])
        : "code";

    return {
      page: rolesTable.pageIndex + 1,
      limit: rolesTable.pageSize,
      search: rolesTable.debouncedSearch.trim() || undefined,
      sortBy,
      sortOrder: activeSort?.desc ? "desc" : "asc",
    };
  }, [
    rolesTable.pageIndex,
    rolesTable.pageSize,
    rolesTable.debouncedSearch,
    rolesTable.sorting,
  ]);

  const { data: rolesData, isLoading, isFetching } = useGetRolesQuery(rolesQuery);

  const openRoleSheet = (role: RoleListItem) => {
    setSheetRole(role);
    setSheetOpen(true);
  };

  const roleTableColumns = useMemo((): ColumnDef<RoleListItem>[] => {
    return [
      ...roleColumns,
      {
        id: "actions",
        header: () => (
          <span className="block text-right text-sm font-medium text-muted-foreground">
            Permissions
          </span>
        ),
        meta: { className: "w-[120px] text-right" },
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openRoleSheet(row.original)}
            >
              View
            </Button>
          </div>
        ),
        enableSorting: false,
      },
    ];
  }, []);

  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        title="Roles"
        description="Browse system roles and open a role to inspect its permission set."
      />

      <DataTable
        className="min-w-0"
        minTableWidth="min-w-0"
        columns={roleTableColumns}
        data={rolesData?.data ?? []}
        getRowId={(row) => String(row.id)}
        manual
        searchPlaceholder="Search role code or label…"
        pageCount={rolesData?.meta.totalPages ?? 0}
        totalRows={rolesData?.meta.total ?? 0}
        pageIndex={rolesTable.pageIndex}
        pageSize={rolesTable.pageSize}
        onPageSizeChange={rolesTable.setPageSize}
        onPageChange={rolesTable.setPageIndex}
        sorting={rolesTable.sorting}
        onSortingChange={rolesTable.setSorting}
        searchValue={rolesTable.search}
        onSearchChange={rolesTable.setSearch}
        isLoading={isLoading || isFetching}
        emptyMessage="No roles found."
      />

      <RolePermissionsSheet
        role={sheetRole}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
