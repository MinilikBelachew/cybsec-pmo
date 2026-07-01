"use client";

import { useMemo, useState } from "react";
import { Check, Minus, Search } from "lucide-react";
import { toast } from "react-hot-toast";
import { canAccess } from "@/domains/auth/casl/define-ability";
import { useAppAbility } from "@/domains/auth/casl/ability-context";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";
import {
  useGetPermissionMatrixQuery,
  useGrantRolePermissionMutation,
  useRevokeRolePermissionMutation,
} from "../api/roles.api";
import type { PermissionMatrixCell, PermissionMatrixRole } from "../types/roles.types";
import {
  formatPermissionCode,
  formatRecordScopeLabel,
  humanizePermissionToken,
} from "../utils/format-permission";
import { defaultRecordScopeForRole } from "../utils/role-default-scope";

const MODULE_COL_WIDTH = 148;
const ACTION_COL_WIDTH = 128;

type RoleFilter = "all" | "internal" | "external";

export function PermissionsMatrix() {
  const ability = useAppAbility();
  const canManage = canAccess(ability, "manage", "Rbac");

  const { data, isLoading } = useGetPermissionMatrixQuery();
  const [grantPermission] = useGrantRolePermissionMutation();
  const [revokePermission] = useRevokeRolePermissionMutation();
  const [togglingCell, setTogglingCell] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [hiddenRoleIds, setHiddenRoleIds] = useState<Set<number>>(new Set());

  const modules = useMemo(() => {
    const unique = new Set((data?.rows ?? []).map((row) => row.module));
    return Array.from(unique).sort();
  }, [data?.rows]);

  const visibleRoles = useMemo(() => {
    let roles = data?.roles ?? [];

    if (roleFilter === "internal") {
      roles = roles.filter((role) => !role.isExternal);
    } else if (roleFilter === "external") {
      roles = roles.filter((role) => role.isExternal);
    }

    return roles.filter((role) => !hiddenRoleIds.has(role.id));
  }, [data?.roles, hiddenRoleIds, roleFilter]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (data?.rows ?? []).filter((row) => {
      if (moduleFilter !== "all" && row.module !== moduleFilter) return false;
      if (!query) return true;

      const haystack = [
        row.module,
        row.action,
        formatPermissionCode(row.module, row.action),
        humanizePermissionToken(row.module),
        humanizePermissionToken(row.action),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [data?.rows, moduleFilter, search]);

  const grantCount = useMemo(() => {
    const visibleRoleIds = new Set(visibleRoles.map((role) => role.id));
    return filteredRows.reduce((total, row) => {
      return (
        total +
        row.cells.filter((cell) => cell.granted && visibleRoleIds.has(cell.roleId)).length
      );
    }, 0);
  }, [filteredRows, visibleRoles]);

  const toggleRoleColumn = (roleId: number) => {
    setHiddenRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const handleToggleCell = async (
    role: PermissionMatrixRole,
    permissionId: string,
    cell: PermissionMatrixCell | undefined,
  ) => {
    if (!canManage) return;

    const cellKey = `${role.id}:${permissionId}`;
    if (togglingCell === cellKey) return;

    setTogglingCell(cellKey);

    try {
      if (cell?.granted && cell.grantId) {
        await revokePermission({ roleId: role.id, grantId: cell.grantId }).unwrap();
      } else {
        await grantPermission({
          roleId: role.id,
          body: {
            permissionId,
            recordScope: defaultRecordScopeForRole(role.code),
          },
        }).unwrap();
      }
    } catch {
      toast.error(
        cell?.granted
          ? "Could not revoke permission."
          : "Could not grant permission. It may already exist.",
      );
    } finally {
      setTogglingCell(null);
    }
  };

  const showInitialSkeleton = isLoading && !data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter modules or actions…"
              maxLength={200}
              className="h-10 border-border/60 bg-white ps-9 shadow-none dark:bg-card"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="matrix-module-filter" className="sr-only">
              Module
            </Label>
            <Select value={moduleFilter} onValueChange={(value) => setModuleFilter(value ?? "all")}>
              <SelectTrigger id="matrix-module-filter" className="h-10 w-[180px]">
                <SelectValue placeholder="All modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {modules.map((module) => (
                  <SelectItem key={module} value={module}>
                    {humanizePermissionToken(module)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="matrix-role-filter" className="sr-only">
              Role type
            </Label>
            <Select
              value={roleFilter}
              onValueChange={(value) => setRoleFilter((value ?? "all") as RoleFilter)}
            >
              <SelectTrigger id="matrix-role-filter" className="h-10 w-[160px]">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="internal">Internal only</SelectItem>
                <SelectItem value="external">External only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-normal">
            {filteredRows.length} permissions
          </Badge>
          <Badge variant="secondary" className="font-normal">
            {visibleRoles.length} roles
          </Badge>
          <Badge variant="outline" className="font-normal">
            {grantCount} grants shown
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(data?.roles ?? []).map((role) => {
          const hidden = hiddenRoleIds.has(role.id);
          const matchesTypeFilter =
            roleFilter === "all" ||
            (roleFilter === "internal" && !role.isExternal) ||
            (roleFilter === "external" && role.isExternal);

          if (!matchesTypeFilter) return null;

          return (
            <button
              key={role.id}
              type="button"
              onClick={() => toggleRoleColumn(role.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                hidden
                  ? "border-border bg-muted/30 text-muted-foreground line-through"
                  : "border-primary/25 bg-primary/5 text-primary",
              )}
            >
              {role.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/35">
                <th
                  className="sticky left-0 z-20 border-r border-border/50 bg-muted/95 px-3 py-3 text-left text-xs font-semibold text-muted-foreground backdrop-blur-sm"
                  style={{ minWidth: MODULE_COL_WIDTH, width: MODULE_COL_WIDTH }}
                >
                  Module
                </th>
                <th
                  className="sticky z-20 border-r border-border/50 bg-muted/95 px-3 py-3 text-left text-xs font-semibold text-muted-foreground backdrop-blur-sm"
                  style={{
                    left: MODULE_COL_WIDTH,
                    minWidth: ACTION_COL_WIDTH,
                    width: ACTION_COL_WIDTH,
                  }}
                >
                  Action
                </th>
                {visibleRoles.map((role) => (
                  <RoleColumnHeader key={role.id} role={role} />
                ))}
              </tr>
            </thead>
            <tbody>
              {showInitialSkeleton &&
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="border-b border-border/40">
                    <td colSpan={2 + visibleRoles.length} className="px-3 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-muted/60" />
                    </td>
                  </tr>
                ))}

              {!showInitialSkeleton && filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={2 + visibleRoles.length}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No permissions match your filters.
                  </td>
                </tr>
              )}

              {!showInitialSkeleton &&
                filteredRows.map((row, index) => {
                  const previousModule = filteredRows[index - 1]?.module;
                  const isFirstInModule = row.module !== previousModule;
                  const cellByRoleId = new Map(
                    row.cells.map((cell) => [cell.roleId, cell]),
                  );
                  const permissionLabel = formatPermissionCode(row.module, row.action);

                  return (
                    <tr
                      key={row.permissionId}
                      className={cn(
                        "border-b border-border/40 transition-colors hover:bg-muted/20",
                        isFirstInModule && index > 0 && "border-t-2 border-t-border/70",
                      )}
                    >
                      <td
                        className="sticky left-0 z-10 border-r border-border/40 bg-card/95 px-3 py-2 align-top backdrop-blur-sm"
                        style={{ minWidth: MODULE_COL_WIDTH, width: MODULE_COL_WIDTH }}
                      >
                        {isFirstInModule ? (
                          <span className="text-xs font-semibold text-foreground">
                            {humanizePermissionToken(row.module)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">│</span>
                        )}
                      </td>
                      <td
                        className="sticky z-10 border-r border-border/40 bg-card/95 px-3 py-2 align-top backdrop-blur-sm"
                        style={{
                          left: MODULE_COL_WIDTH,
                          minWidth: ACTION_COL_WIDTH,
                          width: ACTION_COL_WIDTH,
                        }}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">
                            {humanizePermissionToken(row.action)}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                            {permissionLabel}
                          </p>
                        </div>
                      </td>
                      {visibleRoles.map((role) => {
                        const cell = cellByRoleId.get(role.id);
                        const cellKey = `${role.id}:${row.permissionId}`;
                        return (
                          <MatrixCell
                            key={cellKey}
                            granted={cell?.granted ?? false}
                            recordScope={cell?.recordScope ?? null}
                            roleLabel={role.label}
                            permissionLabel={permissionLabel}
                            canManage={canManage}
                            isPending={togglingCell === cellKey}
                            onToggle={() =>
                              handleToggleCell(role, row.permissionId, cell)
                            }
                          />
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {canManage
          ? "Click a cell to grant or revoke permission. Hover a checkmark to see record scope."
          : "Hover a checkmark to see record scope. Toggle role chips above to show or hide columns."}
      </p>
    </div>
  );
}

function RoleColumnHeader({ role }: { role: PermissionMatrixRole }) {
  return (
    <th className="min-w-[92px] max-w-[110px] border-r border-border/30 px-2 py-3 text-center align-bottom last:border-r-0">
      <div className="mx-auto flex max-w-[88px] flex-col items-center gap-1">
        <span className="text-[10px] font-bold leading-tight text-foreground">
          {role.label}
        </span>
        <span className="text-[9px] text-muted-foreground leading-tight">
          {humanizePermissionToken(role.code)}
        </span>
        {role.isExternal && (
          <Badge variant="outline" className="h-4 px-1 text-[8px] font-normal">
            Ext
          </Badge>
        )}
      </div>
    </th>
  );
}

function MatrixCell({
  granted,
  recordScope,
  roleLabel,
  permissionLabel,
  canManage,
  isPending,
  onToggle,
}: {
  granted: boolean;
  recordScope: string | null;
  roleLabel: string;
  permissionLabel: string;
  canManage: boolean;
  isPending: boolean;
  onToggle: () => void;
}) {
  const marker = (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md transition-colors",
        granted
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground/30 hover:bg-muted/60 hover:text-muted-foreground",
        canManage && !isPending && "hover:ring-2 hover:ring-primary/20",
        isPending && "pointer-events-none",
      )}
    >
      {granted ? (
        <Check className="size-3.5 stroke-[2.5]" />
      ) : (
        <Minus className="size-3" />
      )}
    </span>
  );

  const button = (
    <button
      type="button"
      disabled={!canManage || isPending}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center justify-center",
        canManage ? "cursor-pointer" : "cursor-default",
      )}
      aria-label={
        granted
          ? `Revoke ${permissionLabel} from ${roleLabel}`
          : `Grant ${permissionLabel} to ${roleLabel}`
      }
    >
      {marker}
    </button>
  );

  if (!granted) {
    return (
      <td className="border-r border-border/20 px-2 py-2 text-center align-middle last:border-r-0">
        {button}
      </td>
    );
  }

  return (
    <td className="border-r border-border/20 px-2 py-2 text-center align-middle last:border-r-0">
      <Tooltip>
        <TooltipTrigger render={button} />
        <TooltipContent side="top" sideOffset={6} className="text-left">
          <p className="font-semibold text-foreground">{roleLabel}</p>
          <p className="text-muted-foreground">{permissionLabel}</p>
          <p className="mt-1 text-foreground">
            Scope:{" "}
            <span className="font-medium">{formatRecordScopeLabel(recordScope)}</span>
          </p>
          {canManage && (
            <p className="mt-1 text-muted-foreground">Click to revoke</p>
          )}
        </TooltipContent>
      </Tooltip>
    </td>
  );
}
