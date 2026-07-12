"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "react-hot-toast";
import { Loader2, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useSaveProjectAsTemplateMutation } from "@/domains/projects/api/project-templates.api";
import type { Project } from "@/domains/projects/types/projects.types";

type SaveAsTemplateDialogProps = {
  open: boolean;
  project: Project | null;
  onClose: () => void;
};

export function SaveAsTemplateDialog({
  open,
  project,
  onClose,
}: SaveAsTemplateDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [saveTemplate, { isLoading }] = useSaveProjectAsTemplateMutation();

  useEffect(() => {
    if (open && project) {
      setName(`${project.name} Template`);
      setCategory("General");
      setDescription("");
    }
  }, [open, project]);

  const handleSave = async () => {
    if (!project) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Template name is required");
      return;
    }
    try {
      await saveTemplate({
        projectId: project.id,
        name: trimmed,
        category: category.trim() || "General",
        description: description.trim() || undefined,
      }).unwrap();
      toast.success("Project saved as template");
      onClose();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String((err as { data?: { message?: string } }).data?.message ?? "")
          : "";
      toast.error(message || "Failed to save template");
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-5 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <DialogPrimitive.Title className="text-sm font-bold text-foreground">
                Save as template
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
                Capture phases, milestones, and tasks from{" "}
                <span className="font-medium text-foreground">{project?.name}</span> into a
                reusable template.
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

          <div className="space-y-3 py-1">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Template name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g. SOC Delivery Blueprint"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Category</span>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="General"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">
                Description (optional)
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="What this template is for"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={isLoading || !project}
              className="gap-1.5"
            >
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
              Save template
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
