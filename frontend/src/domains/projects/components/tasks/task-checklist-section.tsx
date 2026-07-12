"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  useGetTaskChecklistQuery,
  useAddTaskChecklistItemMutation,
  useUpdateTaskChecklistItemMutation,
  useDeleteTaskChecklistItemMutation,
} from "@/domains/projects";
import { useAppAbility } from "@/domains/auth";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";
import { DeleteDialog } from "@/shared/ui/delete-dialog";

type TaskChecklistSectionProps = {
  taskId: string;
  className?: string;
};

export function TaskChecklistSection({ taskId, className }: TaskChecklistSectionProps) {
  const ability = useAppAbility();
  const canManage = ability?.can("update", "Task") ?? false;

  const { data, isLoading } = useGetTaskChecklistQuery(taskId, { skip: !taskId });
  const [addItem, { isLoading: isAdding }] = useAddTaskChecklistItemMutation();
  const [updateItem, { isLoading: isUpdating }] = useUpdateTaskChecklistItemMutation();
  const [deleteItem, { isLoading: isDeleting }] = useDeleteTaskChecklistItemMutation();

  const [newTitle, setNewTitle] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const done = data?.done ?? 0;
  const percent = data?.percent ?? 0;

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) {
      toast.error("Checklist item title is required");
      return;
    }
    try {
      await addItem({ taskId, title }).unwrap();
      setNewTitle("");
      toast.success("Checklist item added");
    } catch {
      toast.error("Failed to add checklist item");
    }
  };

  const handleToggle = async (itemId: string, isDone: boolean) => {
    setTogglingId(itemId);
    try {
      await updateItem({ taskId, itemId, isDone: !isDone }).unwrap();
    } catch {
      toast.error("Failed to update checklist item");
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteItem({ taskId, itemId: deleteId }).unwrap();
      toast.success("Checklist item deleted");
    } catch {
      toast.error("Failed to delete checklist item");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Checklist</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {total === 0
              ? "No items yet"
              : `${done} of ${total} completed (${percent}%)`}
          </p>
        </div>
      </div>

      {total > 0 && (
        <div className="space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                percent === 100 ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
          <Loader2 className="size-3.5 animate-spin" />
          Loading checklist…
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.length === 0 && (
            <li className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
              Add checklist items to track task progress.
            </li>
          )}
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-2"
            >
              <button
                type="button"
                disabled={!canManage || togglingId === item.id || isUpdating}
                onClick={() => void handleToggle(item.id, item.isDone)}
                className={cn(
                  "size-4 shrink-0 rounded border flex items-center justify-center transition-colors",
                  item.isDone
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-slate-300 dark:border-slate-600 hover:border-primary",
                  !canManage && "opacity-60 cursor-default",
                )}
                aria-label={item.isDone ? "Mark incomplete" : "Mark complete"}
              >
                {item.isDone ? (
                  <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                ) : null}
              </button>
              <span
                className={cn(
                  "flex-1 text-sm min-w-0 break-words",
                  item.isDone && "line-through text-muted-foreground",
                )}
              >
                {item.title}
              </span>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setDeleteId(item.id)}
                  className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  aria-label="Delete checklist item"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="flex items-center gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add checklist item…"
            className="h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAdd();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 gap-1"
            disabled={isAdding || !newTitle.trim()}
            onClick={() => void handleAdd()}
          >
            {isAdding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Add
          </Button>
        </div>
      ) : null}

      <DeleteDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete checklist item"
        description="Are you sure you want to delete this checklist item?"
        isDeleting={isDeleting}
      />
    </section>
  );
}
