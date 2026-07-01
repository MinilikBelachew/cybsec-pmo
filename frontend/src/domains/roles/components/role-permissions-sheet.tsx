"use client";

import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { Badge } from "@/shared/ui/badge";
import type { RoleListItem } from "../types/roles.types";
import { formatRoleCodeLabel } from "../utils/format-permission";
import { RolePermissionsPanel } from "./role-permissions-panel";

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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={ROLE_PERMISSIONS_SHEET_CLASS} showCloseButton>
        {role && (
          <div className="flex h-full flex-col overflow-hidden">
            <SheetHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
              <SheetTitle className="flex items-center gap-2 text-lg font-bold">
                <ShieldCheck className="size-5 text-primary" />
                {role.label}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground" title={role.code}>
                  {formatRoleCodeLabel(role.code)}
                </span>
                <Badge variant={role.isExternal ? "outline" : "secondary"}>
                  {role.isExternal ? "External" : "Internal"}
                </Badge>
                <span>{role.permissionCount} permissions</span>
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              <RolePermissionsPanel role={role} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
