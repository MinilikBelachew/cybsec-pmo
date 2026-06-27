"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/shared/ui/button";

export type RevokePermissionTarget = {
  grantId: string;
  module: string;
  action: string;
  roleLabel: string;
};

export interface RevokePermissionDialogProps {
  open: boolean;
  target: RevokePermissionTarget | null;
  isRevoking?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RevokePermissionDialog({
  open,
  target,
  isRevoking = false,
  onClose,
  onConfirm,
}: RevokePermissionDialogProps) {
  const permissionLabel = target ? `${target.module}.${target.action}` : "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200/60 bg-white p-6 text-slate-900 shadow-xl transition duration-200 ease-in-out dark:border-white/[0.08] dark:bg-slate-950 dark:text-white data-ending-style:scale-95 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0",
          )}
        >
          <DialogPrimitive.Title className="text-base font-bold text-foreground">
            Revoke permission
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {target ? (
              <>
                Remove <code className="font-semibold">{permissionLabel}</code> from{" "}
                <span className="font-medium text-foreground">{target.roleLabel}</span>? Users with
                this role will lose access immediately. This action is audited.
              </>
            ) : (
              "Remove this permission from the role?"
            )}
          </DialogPrimitive.Description>
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isRevoking}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onConfirm}
              disabled={isRevoking || !target}
              className="bg-red-600 text-white hover:bg-red-750"
            >
              {isRevoking ? "Revoking…" : "Revoke"}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
