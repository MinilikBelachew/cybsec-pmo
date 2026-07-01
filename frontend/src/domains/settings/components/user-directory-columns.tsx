"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { Mail } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header";
import { cn } from "@/shared/utils/cn";
import type { User } from "@/domains/users";
import { getRoleBadgeColor, getRoleLabel } from "@/domains/settings/utils/role-display";
import { ROLE_CODE_BY_ID } from "@/config/roles.config";

export function resolveUserRoleCode(user: User) {
  return user.roleCode || user.role?.code || ROLE_CODE_BY_ID[user.roleId] || "";
}

export function isUserSsoLinked(user: User) {
  return Boolean(user.entraObjectId && user.entraObjectId !== "pending-first-login");
}

type UserDirectoryColumnHandlers = {
  onToggleActive: (user: User) => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
};

export function createUserDirectoryColumns({
  onToggleActive,
  onEdit,
  onDelete,
}: UserDirectoryColumnHandlers): ColumnDef<User>[] {
  return [
    {
      id: "displayName",
      accessorKey: "displayName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="User Details" />
      ),
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="min-w-[200px]">
            <div className="font-semibold text-foreground">{user.displayName}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="size-3 text-muted-foreground/60" />
              {user.email}
            </div>
          </div>
        );
      },
      meta: { className: "min-w-[220px]", label: "User Details" },
    },
    {
      id: "role",
      accessorFn: (row) => resolveUserRoleCode(row),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Security Role" />
      ),
      cell: ({ row }) => {
        const roleCode = resolveUserRoleCode(row.original);
        return (
          <Badge
            className={cn(
              "border px-2 py-0.5 text-xs font-semibold",
              getRoleBadgeColor(roleCode),
            )}
          >
            {getRoleLabel(roleCode)}
          </Badge>
        );
      },
      meta: { className: "w-[160px]", label: "Security Role" },
    },
    {
      id: "isActive",
      accessorKey: "isActive",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" className="justify-center" />
      ),
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="text-center">
            <button
              type="button"
              onClick={() => onToggleActive(user)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold transition-colors",
                user.isActive
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                  : "border-red-500/20 bg-red-500/10 text-red-600 hover:bg-red-500/20",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  user.isActive ? "bg-emerald-500" : "bg-red-500",
                )}
              />
              {user.isActive ? "Active" : "Inactive"}
            </button>
          </div>
        );
      },
      meta: { className: "w-[120px] text-center", label: "Status" },
    },
    {
      id: "identity",
      accessorFn: (row) => (isUserSsoLinked(row) ? "linked" : "pending"),
      enableSorting: false,
      header: () => (
        <span className="text-sm font-medium text-muted-foreground">Identity Link</span>
      ),
      cell: ({ row }) => {
        const linked = isUserSsoLinked(row.original);
        return (
          <div className="text-center">
            <Badge
              variant="outline"
              className={cn(
                "px-2 py-0.5 text-xs font-medium",
                linked
                  ? "border-blue-500/20 bg-blue-500/5 text-blue-500"
                  : "border-amber-500/20 bg-amber-500/5 text-amber-500",
              )}
            >
              {linked ? "SSO Linked" : "SSO Pending"}
            </Badge>
          </div>
        );
      },
      meta: { className: "w-[130px] text-center", label: "Identity Link" },
    },
  ];
}
