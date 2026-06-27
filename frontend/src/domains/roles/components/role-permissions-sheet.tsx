"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { canAccess } from "@/domains/auth/casl/define-ability";
import { useAppAbility } from "@/domains/auth/casl/ability-context";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
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
  RevokePermissionDialog,
  type RevokePermissionTarget,
} from "./revoke-permission-dialog";

const ROLE_PERMISSIONS_SHEET_CLASS =
  "flex h-full w-full !max-w-[600px] flex-col gap-0 overflow-hidden p-0 rounded-l-[10px]";

type RolePermissionsSheetProps = {
  role: RoleListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RolePermissionsSheet({
  role,
  open,
  onOpenChange,
}: RolePermissionsSheetProps) {
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
  }, [debouncedSearch, role?.id]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setPage(1);
      setAddPermissionId("");
      setAddScope("all");
      setStatusMessage(null);
      setRevokeTarget(null);
    }
  }, [open]);

  const { data, isLoading, isFetching } = useGetRolePermissionsQuery(
    {
      roleId: role?.id ?? 0,
      page,
      limit,
      search: debouncedSearch.trim() || undefined,
      sortBy: "module",
      sortOrder: "asc",
    },
    { skip: !open || !role },
  );

  const { data: catalogData } = useGetPermissionCatalogQuery(undefined, {
    skip: !open || !canManage,
  });
  const { data: scopesData } = useGetRecordScopesQuery(undefined, {
    skip: !open || !canManage,
  });
  const { data: allGrantsData } = useGetRolePermissionsQuery(
    {
      roleId: role?.id ?? 0,
      page: 1,
      limit: 100,
      sortBy: "module",
      sortOrder: "asc",
    },
    { skip: !open || !role || !canManage },
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
    return (catalogData?.data ?? []).filter(
      (item) => !grantedPermissionIds.has(item.id),
    );
  }, [catalogData?.data, grantedPermissionIds]);

  const handleGrant = async () => {
    if (!role || !addPermissionId) return;

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
    if (!role) return;

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
    if (!role) return;
    setRevokeTarget({
      grantId,
      module,
      action,
      roleLabel: role.label,
    });
  };

  const handleConfirmRevoke = async () => {
    if (!role || !revokeTarget) return;

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={ROLE_PERMISSIONS_SHEET_CLASS} showCloseButton>
        {role && (
          <div className="flex h-full flex-col">
            <SheetHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
              <SheetTitle className="flex items-center gap-2 text-lg font-bold">
                <ShieldCheck className="size-5 text-primary" />
                {role.label}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-muted/70 px-2 py-0.5 text-xs">{role.code}</code>
                <Badge variant={role.isExternal ? "outline" : "secondary"}>
                  {role.isExternal ? "External" : "Internal"}
                </Badge>
                <span>{meta?.total ?? role.permissionCount} permissions</span>
              </SheetDescription>
            </SheetHeader>

            {canManage && (
              <div className="shrink-0 space-y-3 border-b border-border/50 bg-muted/10 px-6 py-4">
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
                                return item ? `${item.module}.${item.action}` : "Select permission";
                              })()
                            : "Select permission"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {availableCatalog.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.module}.{item.action}
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

            <div className="border-b border-border/50 px-6 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search permissions…"
                  className="h-9 pl-9"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoading || isFetching ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading permissions…</p>
              ) : permissions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No permissions found.</p>
              ) : (
                <ul className="space-y-2">
                  {permissions.map((permission) => (
                    <li
                      key={permission.id}
                      className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <code className="truncate text-xs font-semibold">{permission.module}</code>
                            <span className="shrink-0 text-xs font-medium text-muted-foreground">
                              {permission.action}
                            </span>
                          </div>
                          {canManage ? (
                            <div className="mt-2 space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Record scope</Label>
                              <Select
                                value={permission.recordScope ?? "all"}
                                onValueChange={(value) => value && handleScopeChange(permission.id, value)}
                                disabled={isMutating}
                              >
                                <SelectTrigger className="h-8 w-full text-xs">
                                  <SelectValue>
                                    {scopeOptions.find(
                                      (scope) => scope.code === (permission.recordScope ?? "all"),
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
                              Scope: {permission.recordScope ?? "—"}
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
                              openRevokeDialog(permission.id, permission.module, permission.action)
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="shrink-0 border-t border-border/50 px-6 py-3">
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
        )}
      </SheetContent>

      <RevokePermissionDialog
        open={revokeTarget !== null}
        target={revokeTarget}
        isRevoking={isRevoking}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleConfirmRevoke}
      />
    </Sheet>
  );
}
