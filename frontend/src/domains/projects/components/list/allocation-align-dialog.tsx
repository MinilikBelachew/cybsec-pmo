"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import type { AlignAllocationPreviewRow } from "@/domains/projects/types/projects.types";
import { formatAllocationDateRange } from "@/domains/projects/utils/allocation-date.utils";

interface AllocationAlignDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onSaveWithoutAlign: () => void;
  onConfirmAlign: () => void;
  isAligning?: boolean;
  projectLabel: string;
  preview: AlignAllocationPreviewRow[];
  issueMessages: string[];
}

export function AllocationAlignDialog({
  isOpen,
  onCancel,
  onSaveWithoutAlign,
  onConfirmAlign,
  isAligning = false,
  projectLabel,
  preview,
  issueMessages,
}: AllocationAlignDialogProps) {
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-[80] bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-[80] max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200/60 bg-white p-6 text-slate-900 shadow-xl transition duration-200 ease-in-out dark:border-white/[0.08] dark:bg-slate-950 dark:text-white data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          )}
        >
          <DialogPrimitive.Title className="text-base font-bold text-foreground">
            Align team allocations?
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Project dates for <span className="font-medium text-foreground">{projectLabel}</span>{" "}
            no longer match some team allocation windows. You can align active allocations into the
            project window before saving.
          </DialogPrimitive.Description>

          {issueMessages.length > 0 && (
            <ul className="mt-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              {issueMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}

          {preview.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Member</th>
                    <th className="px-3 py-2">Current</th>
                    <th className="px-3 py-2">Aligned</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.allocationId} className="border-t border-border/50">
                      <td className="px-3 py-2 font-medium">{row.employeeName}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatAllocationDateRange(row.currentStartDate, row.currentEndDate)}
                      </td>
                      <td className="px-3 py-2 text-emerald-700 dark:text-emerald-400">
                        {formatAllocationDateRange(row.proposedStartDate, row.proposedEndDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isAligning}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSaveWithoutAlign}
              disabled={isAligning}
            >
              Save without aligning
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onConfirmAlign}
              disabled={isAligning || preview.length === 0}
            >
              {isAligning ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Align and continue
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
