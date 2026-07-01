"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { canAccess } from "@/domains/auth/casl/define-ability";
import { useAppAbility } from "@/domains/auth/casl/ability-context";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useDebounce } from "@/shared/hooks/use-debounce";
import {
  useGetPermissionCatalogQuery,
  useGetRecordScopesQuery,
  useGetRolePermissionsQuery,
  useGrantRolePermissionMutation,
  useRevokeRolePermissionMutation,
  useUpdateRolePermissionMutation,
} from "../api/roles.api";
import type { RoleListItem } from "../types/roles.types";
import {
  formatPermissionCode,
  formatPermissionLabel,
  formatRecordScopeLabel,
  humanizePermissionToken,
} from "../utils/format-permission";
import {
  RevokePermissionDialog,
  type RevokePermissionTarget,
} from "./revoke-permission-dialog";

type RolePermissionsPanelProps = {
  role: RoleListItem;
  compact?: boolean;
};

export function RolePermissionsPanel({ role, compact = false }: RolePermissionsPanelProps) {
  const ability = useAppAbility();
  const canManage = canAccess(ability, "manage", "Rbac");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [addPermissionId, setAddPermissionId] = useState("");
  const [addScope, setAddScope] = useState("all");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<RevokePermissionTarget | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const limit = 50;

  useEffect(() => {
    setPage(1);
    setSearch("");
    setAddPermissionId("");
    setAddScope("all");
    setStatusMessage(null);
    setRevokeTarget(null);
  }, [role.id]);

  const { data, isLoading, isFetching } = useGetRolePermissionsQuery({
    roleId: role.id,
    page,
    limit,
    search: debouncedSearch.trim() || undefined,
    sortBy: "module",
    sortOrder: "asc",
  });

  const { data: catalogData } = useGetPermissionCatalogQuery(undefined, {
    skip: !canManage,
  });
  const { data: scopesData } = useGetRecordScopesQuery(undefined, {
    skip: !canManage,
  });
  const { data: allGrantsData } = useGetRolePermissionsQuery(
    {
      roleId: role.id,
      page: 1,
      limit: 100,
      sortBy: "module",
      sortOrder: "asc",
    },
    { skip: !canManage },
  );

  const [grantPermission, { isLoading: isGranting }] = useGrantRolePermissionMutation();
  const [updatePermission, { isLoading: isUpdating }] = useUpdateRolePermissionMutation();
  const [revokePermission, { isLoading: isRevoking }] = useRevokeRolePermissionMutation();

  const permissions = data?.data ?? [];
  const meta = data?.meta;
  const scopeOptions = scopesData?.data ?? [];
  const grantedPermissionIds = useMemo(
    () => new Set((allGrantsData?.data ?? []).map((permission) => permission.permissionId)),
    [allGrantsData?.data],
  );

  const availableCatalog = useMemo(() => {
    return (catalogData?.data ?? []).filter((item) => !grantedPermissionIds.has(item.id));
  }, [catalogData?.data, grantedPermissionIds]);

  const permissionsByModule = useMemo(() => {
    const groups = new Map<string, typeof permissions>();
    for (const permission of permissions) {
      const list = groups.get(permission.module) ?? [];
      list.push(permission);
      groups.set(permission.module, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const handleGrant = async () => {
    if (!addPermissionId) return;

    setStatusMessage(null);
    try {
      await grantPermission({
        roleId: role.id,
        body: {
          permissionId: addPermissionId,
          recordScope: addScope,
        },
      }).unwrap();
      setAddPermissionId("");
      setStatusMessage("Permission granted.");
    } catch {
      setStatusMessage("Could not grant permission. It may already exist.");
    }
  };

  const handleScopeChange = async (grantId: string, recordScope: string) => {
    setStatusMessage(null);
    try {
      await updatePermission({
        roleId: role.id,
        grantId,
        body: { recordScope },
      }).unwrap();
      setStatusMessage("Scope updated.");
    } catch {
      setStatusMessage("Could not update scope.");
    }
  };

  const openRevokeDialog = (grantId: string, module: string, action: string) => {
    setRevokeTarget({
      grantId,
      module,
      action,
      roleLabel: role.label,
    });
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;

    setStatusMessage(null);
    try {
      await revokePermission({ roleId: role.id, grantId: revokeTarget.grantId }).unwrap();
      setStatusMessage("Permission revoked.");
      setRevokeTarget(null);
    } catch {
      setStatusMessage("Could not revoke permission.");
    }
  };

  const isMutating = isGranting || isUpdating || isRevoking;
  const padding = compact ? "px-4" : "px-6";

  return (
    <>
      <div className="border-t border-border/50 bg-muted/10">
        <div className={`${padding} py-3`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search permissions in this role…"
              className="h-9 border-border/60 bg-white pl-9 shadow-none dark:bg-card"
            />
          </div>
        </div>

        {canManage && (
          <div className={`space-y-3 border-t border-border/40 bg-muted/15 ${padding} py-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Grant permission
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1.5">
                <Label className="text-xs">Permission</Label>
                <Select
                  value={addPermissionId}
                  onValueChange={(value) => value && setAddPermissionId(value)}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select permission">
                      {addPermissionId
                        ? (() => {
                            const item = catalogData?.data.find((p) => p.id === addPermissionId);
                            return item
                              ? formatPermissionLabel(item.module, item.action)
                              : "Select permission";
                          })()
                        : "Select permission"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableCatalog.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        <span className="flex min-w-0 flex-col items-start gap-0.5">
                          <span className="text-sm font-medium">
                            {formatPermissionLabel(item.module, item.action)}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {formatPermissionCode(item.module, item.action)}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Record scope</Label>
                <Select value={addScope} onValueChange={(value) => value && setAddScope(value)}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Scope">
                      {scopeOptions.find((scope) => scope.code === addScope)?.label ?? addScope}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map((scope) => (
                      <SelectItem key={scope.code} value={scope.code}>
                        {scope.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={!addPermissionId || isMutating}
                  onClick={handleGrant}
                >
                  <Plus className="size-4" />
                  Grant
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className={`${padding} py-4`}>
          {isLoading || isFetching ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading permissions…</p>
          ) : permissions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No permissions found.</p>
          ) : (
            <div className="space-y-4">
              {permissionsByModule.map(([module, modulePermissions]) => (
                <div key={module} className="overflow-hidden rounded-xl border border-border/60 bg-card">
                  <div className="border-b border-border/50 bg-muted/25 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {humanizePermissionToken(module)}
                    </p>
                  </div>
                  <ul className="divide-y divide-border/40">
                    {modulePermissions.map((permission) => (
                      <li key={permission.id} className="px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p
                                className="truncate text-sm font-medium"
                                title={formatPermissionCode(permission.module, permission.action)}
                              >
                                {formatPermissionLabel(permission.module, permission.action)}
                              </p>
                              <Badge variant="outline" className="h-5 font-mono text-[10px] font-normal">
                                {permission.action}
                              </Badge>
                            </div>
                            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                              {formatPermissionCode(permission.module, permission.action)}
                            </p>
                            {canManage ? (
                              <div className="mt-2 max-w-sm space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Record scope</Label>
                                <Select
                                  value={permission.recordScope ?? "all"}
                                  onValueChange={(value) =>
                                    value && handleScopeChange(permission.id, value)
                                  }
                                  disabled={isMutating}
                                >
                                  <SelectTrigger className="h-8 w-full text-xs">
                                    <SelectValue>
                                      {scopeOptions.find(
                                        (scope) =>
                                          scope.code === (permission.recordScope ?? "all"),
                                      )?.label ?? permission.recordScope}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {scopeOptions.map((scope) => (
                                      <SelectItem key={scope.code} value={scope.code}>
                                        {scope.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Scope: {formatRecordScopeLabel(permission.recordScope)}
                              </p>
                            )}
                            {permission.fieldScope && (
                              <p className="mt-1 line-clamp-2 font-mono text-[10px] text-muted-foreground/80">
                                {JSON.stringify(permission.fieldScope)}
                              </p>
                            )}
                          </div>
                          {canManage && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 shrink-0 text-destructive hover:text-destructive"
                              disabled={isMutating}
                              onClick={() =>
                                openRevokeDialog(
                                  permission.id,
                                  permission.module,
                                  permission.action,
                                )
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`border-t border-border/50 ${padding} py-3`}>
          {statusMessage && (
            <p className="mb-2 text-xs text-muted-foreground">{statusMessage}</p>
          )}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Page {meta.page} of {meta.totalPages} · {meta.total} total
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!meta.hasPrevPage}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!meta.hasNextPage}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <RevokePermissionDialog
        open={revokeTarget !== null}
        target={revokeTarget}
        isRevoking={isRevoking}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleConfirmRevoke}
      />
    </>
  );
}
