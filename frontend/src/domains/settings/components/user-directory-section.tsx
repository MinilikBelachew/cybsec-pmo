"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Edit2, Trash2, UserPlus, XCircle } from "lucide-react";
import { DataTable } from "@/shared/components/data-table";
import { useServerTableState } from "@/shared/hooks/use-server-table-state";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  type User,
  type GetUsersParams,
} from "@/domains/users";
import { getApiErrorMessage } from "@/core/errors/api-error";
import { ROLE_CATALOG, ROLE_CODE_BY_ID, ROLE_ID_BY_CODE } from "@/config/roles.config";
import { createUserDirectoryColumns } from "./user-directory-columns";

const USER_SORTABLE_COLUMNS = new Set(["displayName", "email", "role", "isActive"]);

interface UserDirectorySectionProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export function UserDirectorySection({ onSuccess, onError }: UserDirectorySectionProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [addForm, setAddForm] = useState({
    displayName: "",
    email: "",
    roleId: ROLE_ID_BY_CODE.engineer,
  });
  const [editForm, setEditForm] = useState({
    roleId: ROLE_ID_BY_CODE.engineer,
    isActive: true,
  });

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

  const queryParams = useMemo((): GetUsersParams => {
    const activeSort = sorting[0];
    const sortBy =
      activeSort && USER_SORTABLE_COLUMNS.has(activeSort.id)
        ? (activeSort.id as GetUsersParams["sortBy"])
        : "displayName";

    return {
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch.trim() || undefined,
      sortBy,
      sortOrder: activeSort?.desc ? "desc" : "asc",
    };
  }, [pageIndex, pageSize, debouncedSearch, sorting]);

  const { data, isLoading, isFetching, isError, error, refetch } = useGetUsersQuery(queryParams);
  const loadErrorNotified = useRef(false);

  useEffect(() => {
    if (!isError || loadErrorNotified.current) return;
    loadErrorNotified.current = true;
    onError?.(
      getApiErrorMessage(error, "Failed to load user directory. Please try again."),
    );
  }, [isError, error, onError]);

  useEffect(() => {
    if (data) loadErrorNotified.current = false;
  }, [data]);

  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addForm.displayName || !addForm.email) {
      onError?.("Display Name and Email are required.");
      return;
    }

    try {
      await createUser({
        displayName: addForm.displayName,
        email: addForm.email.toLowerCase().trim(),
        role: { id: addForm.roleId },
        entraObjectId: "pending-first-login",
        isActive: true,
        isExternal:
          ROLE_CODE_BY_ID[addForm.roleId] === "client" ||
          ROLE_CODE_BY_ID[addForm.roleId] === "vendor",
      }).unwrap();

      onSuccess?.(`User ${addForm.displayName} registered successfully.`);
      setAddForm({ displayName: "", email: "", roleId: ROLE_ID_BY_CODE.engineer });
      setIsAddModalOpen(false);
    } catch (err: unknown) {
      onError?.(getApiErrorMessage(err, "Failed to create user. Email may already be in use."));
    }
  };

  const handleEditUser = useCallback((user: User) => {
    setSelectedUser(user);
    setEditForm({
      roleId: user.roleId || user.role?.id || ROLE_ID_BY_CODE.engineer,
      isActive: user.isActive,
    });
    setIsEditModalOpen(true);
  }, []);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      await updateUser({
        id: selectedUser.id,
        body: {
          role: { id: editForm.roleId },
          isActive: editForm.isActive,
          isExternal:
            ROLE_CODE_BY_ID[editForm.roleId] === "client" ||
            ROLE_CODE_BY_ID[editForm.roleId] === "vendor",
        },
      }).unwrap();

      onSuccess?.("User updated successfully.");
      setIsEditModalOpen(false);
      setSelectedUser(null);
    } catch (err: unknown) {
      onError?.(getApiErrorMessage(err, "Failed to update user."));
    }
  };

  const handleDeleteUser = useCallback(
    async (user: User) => {
      if (!confirm(`Are you sure you want to delete ${user.displayName}?`)) return;

      try {
        await deleteUser(user.id).unwrap();
        onSuccess?.("User deleted successfully.");
      } catch (err: unknown) {
        onError?.(getApiErrorMessage(err, "Failed to delete user."));
      }
    },
    [deleteUser, onError, onSuccess],
  );

  const toggleUserActiveStatus = useCallback(
    async (user: User) => {
      try {
        await updateUser({
          id: user.id,
          body: { isActive: !user.isActive },
        }).unwrap();
        onSuccess?.(`Status for ${user.displayName} updated.`);
      } catch (err: unknown) {
        onError?.(getApiErrorMessage(err, "Failed to toggle status."));
      }
    },
    [onError, onSuccess, updateUser],
  );

  const columns = useMemo((): ColumnDef<User>[] => {
    return [
      ...createUserDirectoryColumns({
        onToggleActive: toggleUserActiveStatus,
        onEdit: handleEditUser,
        onDelete: handleDeleteUser,
      }),
      {
        id: "actions",
        header: () => (
          <span className="block text-right text-sm font-medium text-muted-foreground">
            Actions
          </span>
        ),
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                onClick={() => handleEditUser(user)}
              >
                <Edit2 className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => void handleDeleteUser(user)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        },
        meta: { className: "w-[100px]", sticky: "right" },
      },
    ];
  }, [handleDeleteUser, handleEditUser, toggleUserActiveStatus]);

  const tableData = useMemo(() => data?.data ?? [], [data?.data]);

  return (
    <>
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">User Directory</h2>
          <p className="text-sm text-muted-foreground">
            Manage pre-registered users, assign security roles, and track Microsoft link statuses.
          </p>
        </div>

        <DataTable
          columns={columns}
          data={tableData}
          getRowId={(row) => row.id}
          manual
          hideSearch={false}
          searchPlaceholder="Search users by name, email, or role…"
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
              ? "Could not load users. Try refreshing the page."
              : "No users match your search."
          }
          minTableWidth="min-w-[900px]"
          filters={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xl border-border/60 bg-muted/45 shadow-none"
                onClick={() => void refetch()}
              >
                Refresh
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 gap-1.5 rounded-xl shadow-none"
                onClick={() => setIsAddModalOpen(true)}
              >
                <UserPlus className="size-3.5" />
                Add User
              </Button>
            </div>
          }
        />
      </section>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/10 p-5">
              <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <UserPlus className="size-5 text-primary" />
                Register New User
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <XCircle className="size-5" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-4 p-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Display Name
                </label>
                <Input
                  required
                  placeholder="e.g. Roba Belachew"
                  value={addForm.displayName}
                  onChange={(e) => setAddForm({ ...addForm, displayName: e.target.value })}
                  className="rounded-xl shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Microsoft Email (UPN)
                </label>
                <Input
                  type="email"
                  required
                  placeholder="e.g. roba@company.onmicrosoft.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="rounded-xl shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  System Role
                </label>
                <select
                  value={addForm.roleId}
                  onChange={(e) =>
                    setAddForm({ ...addForm, roleId: Number(e.target.value) })
                  }
                  className="flex h-10 w-full rounded-xl border border-input bg-card px-3 py-1 text-sm shadow-none"
                >
                  {ROLE_CATALOG.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                      {role.code === "client" || role.code === "vendor" ? " (External)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-6 flex gap-2.5 border-t border-border/60 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 rounded-xl shadow-none"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating} className="flex-1 rounded-xl shadow-none">
                  {isCreating ? "Registering..." : "Register User"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/10 p-5">
              <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <Edit2 className="size-4.5 text-primary" />
                Edit User: {selectedUser.displayName}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <XCircle className="size-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="space-y-4 p-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  Email (Read Only)
                </label>
                <Input
                  disabled
                  value={selectedUser.email}
                  className="cursor-not-allowed rounded-xl bg-muted/40 opacity-80 shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">
                  System Role
                </label>
                <select
                  value={editForm.roleId}
                  onChange={(e) =>
                    setEditForm({ ...editForm, roleId: Number(e.target.value) })
                  }
                  className="flex h-10 w-full rounded-xl border border-input bg-card px-3 py-1 text-sm shadow-none"
                >
                  {ROLE_CATALOG.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.label}
                      {role.code === "client" || role.code === "vendor" ? " (External)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="edit-is-active"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="size-4 rounded border-input text-primary focus:ring-primary"
                />
                <label htmlFor="edit-is-active" className="cursor-pointer select-none text-sm font-semibold">
                  Account is Active
                </label>
              </div>
              <div className="mt-6 flex gap-2.5 border-t border-border/60 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 rounded-xl shadow-none"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating} className="flex-1 rounded-xl shadow-none">
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
