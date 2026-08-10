"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

export type ImportQueueModalState =
  | { open: false }
  | {
      open: true;
      mode: "queued";
      position: number;
      maxPerUser: number;
    }
  | {
      open: true;
      mode: "full";
      maxPerUser: number;
    };

export const IMPORT_QUEUE_MODAL_CLOSED: ImportQueueModalState = { open: false };

type ImportQueueModalProps = {
  state: ImportQueueModalState;
  onClose: () => void;
};

export function ImportQueueModal({ state, onClose }: ImportQueueModalProps) {
  const open = state.open;
  const title =
    open && state.mode === "full" ? "Import queue is full" : "Import queued";
  const description = !open
    ? ""
    : state.mode === "full"
      ? `Import queue is full (${state.maxPerUser}). Wait for one to finish, then try again.`
      : `Another import is running. Yours is queued at position ${state.position} (max ${state.maxPerUser}). It will start automatically when earlier imports finish.`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-[60] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-6 shadow-xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95",
          )}
        >
          <DialogPrimitive.Title className="text-base font-bold text-foreground">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </DialogPrimitive.Description>
          <div className="mt-6 flex justify-end">
            <Button type="button" size="sm" onClick={onClose}>
              OK
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
