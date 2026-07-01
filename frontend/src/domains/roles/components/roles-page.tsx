"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Eye, Search } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { DataTable } from "@/shared/components/data-table";
import { useServerTableState } from "@/shared/hooks/use-server-table-state";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
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
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted/60"
              aria-label={`View permissions for ${row.original.label}`}
              onClick={() => openRoleSheet(row.original)}
            >
              <Eye className="size-4" />
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

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={rolesTable.search}
          onChange={(event) => rolesTable.setSearch(event.target.value)}
          placeholder="Search roles by name or code…"
          maxLength={200}
          className="h-10 border-border/60 bg-white ps-9 shadow-none dark:bg-card"
        />
      </div>

      <DataTable
        className="min-w-0"
        minTableWidth="min-w-0"
        hideSearch
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
