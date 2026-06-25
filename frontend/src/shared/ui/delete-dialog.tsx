"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/shared/ui/button";

export interface DeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isDeleting?: boolean;
}

export function DeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  isDeleting = false,
}: DeleteDialogProps) {
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-popover p-6 shadow-xl border border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95"
          )}
        >
          <DialogPrimitive.Title className="text-base font-bold text-foreground">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {description}
          </DialogPrimitive.Description>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-750 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
