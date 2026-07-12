"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Loader2, X, LayoutTemplate } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useGetProjectTemplatesQuery } from "@/domains/projects/api/project-templates.api";
import type { ProjectTemplateSummary } from "@/domains/projects/types/project-templates.types";
import { cn } from "@/shared/utils/cn";

type TemplatePickerDialogProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (template: ProjectTemplateSummary) => void;
};

export function TemplatePickerDialog({
  open,
  onClose,
  onSelect,
}: TemplatePickerDialogProps) {
  const { data: templates = [], isLoading, isError } = useGetProjectTemplatesQuery(undefined, {
    skip: !open,
  });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <DialogPrimitive.Title className="text-sm font-bold text-foreground">
                Create from template
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
                Choose a saved template. Phases, milestones, and tasks will be copied into the new
                project.
              </DialogPrimitive.Description>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading templates…
              </div>
            )}
            {isError && (
              <p className="px-2 py-8 text-center text-sm text-rose-500">
                Failed to load templates.
              </p>
            )}
            {!isLoading && !isError && templates.length === 0 && (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                No templates yet. Open a project menu and choose{" "}
                <span className="font-medium text-foreground">Save as template</span>.
              </p>
            )}
            <div className="space-y-1.5">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onSelect(template)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-colors",
                    "hover:border-border hover:bg-muted/40",
                  )}
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <LayoutTemplate className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{template.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {template.category}
                      {" · "}
                      {template.phaseCount} phases · {template.milestoneCount} milestones ·{" "}
                      {template.taskCount} tasks
                    </p>
                    {template.description ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground/80">
                        {template.description}
                      </p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end border-t border-border px-5 py-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
