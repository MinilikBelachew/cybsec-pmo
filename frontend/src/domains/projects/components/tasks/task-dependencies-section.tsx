"use client";

import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { GitBranch, Loader2, Trash2 } from "lucide-react";
import {
  useCreateTaskDependencyMutation,
  useDeleteTaskDependencyMutation,
  useGetTaskDependenciesQuery,
  useGetTasksQuery,
  type Task,
  type TaskDependency,
  type TaskDependencyType,
} from "@/domains/projects";
import { useAppAbility } from "@/domains/auth";
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

const DEP_TYPES: { value: TaskDependencyType; label: string }[] = [
  { value: "FS", label: "FS — Finish to Start" },
  { value: "SS", label: "SS — Start to Start" },
  { value: "FF", label: "FF — Finish to Finish" },
  { value: "SF", label: "SF — Start to Finish" },
];

export interface DraftDependencyAdd {
  clientId: string;
  predecessorId: string;
  successorId: string;
  depType: TaskDependencyType;
  lagDays: number;
}

interface TaskDependenciesSectionProps {
  task: Task;
  onUpdated?: () => void;
  mode?: "immediate" | "draft";
  draftAdds?: DraftDependencyAdd[];
  onDraftAddsChange?: (adds: DraftDependencyAdd[]) => void;
  pendingRemoves?: string[];
  onPendingRemovesChange?: (ids: string[]) => void;
}

function draftDependencyId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function TaskDependenciesSection({
  task,
  onUpdated,
  mode = "immediate",
  draftAdds = [],
  onDraftAddsChange,
  pendingRemoves = [],
  onPendingRemovesChange,
}: TaskDependenciesSectionProps) {
  const ability = useAppAbility();
  const canEdit = ability?.can("update", "Project") ?? false;

  const [predecessorPick, setPredecessorPick] = useState("");
  const [successorPick, setSuccessorPick] = useState("");
  const [depType, setDepType] = useState<TaskDependencyType>("FS");
  const [lagDays, setLagDays] = useState("0");

  const { data: dependencies = [], isLoading } = useGetTaskDependenciesQuery(
    { taskId: task.id },
    { skip: !task.id },
  );

  const { data: tasksPage } = useGetTasksQuery(
    { projectId: task.projectId, limit: 100, page: 1 },
    { skip: !task.projectId },
  );

  const [createDependency, { isLoading: isCreating }] = useCreateTaskDependencyMutation();
  const [deleteDependency, { isLoading: isDeleting }] = useDeleteTaskDependencyMutation();

  const projectTasks = useMemo(
    () => (tasksPage?.data ?? []).filter((row) => row.id !== task.id),
    [tasksPage?.data, task.id],
  );

  const predecessors = useMemo(
    () => dependencies.filter((dep) => dep.successorId === task.id),
    [dependencies, task.id],
  );

  const successors = useMemo(
    () => dependencies.filter((dep) => dep.predecessorId === task.id),
    [dependencies, task.id],
  );

  const linkedPredecessorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const dep of predecessors) {
      if (!pendingRemoves.includes(dep.id)) {
        ids.add(dep.predecessorId);
      }
    }
    for (const dep of draftAdds) {
      if (dep.successorId === task.id) {
        ids.add(dep.predecessorId);
      }
    }
    return ids;
  }, [predecessors, pendingRemoves, draftAdds, task.id]);

  const linkedSuccessorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const dep of successors) {
      if (!pendingRemoves.includes(dep.id)) {
        ids.add(dep.successorId);
      }
    }
    for (const dep of draftAdds) {
      if (dep.predecessorId === task.id) {
        ids.add(dep.successorId);
      }
    }
    return ids;
  }, [successors, pendingRemoves, draftAdds, task.id]);

  const availablePredecessors = useMemo(
    () => projectTasks.filter((row) => !linkedPredecessorIds.has(row.id)),
    [projectTasks, linkedPredecessorIds],
  );

  const availableSuccessors = useMemo(
    () => projectTasks.filter((row) => !linkedSuccessorIds.has(row.id)),
    [projectTasks, linkedSuccessorIds],
  );

  const taskTitleById = useMemo(() => {
    const map = new Map(projectTasks.map((row) => [row.id, row.title]));
    for (const dep of dependencies) {
      map.set(dep.predecessor.id, dep.predecessor.title);
      map.set(dep.successor.id, dep.successor.title);
    }
    map.set(task.id, task.title);
    return map;
  }, [projectTasks, dependencies, task.id, task.title]);

  function taskPickLabel(taskId: string) {
    return taskTitleById.get(taskId) ?? "Select task…";
  }

  const predecessorItems = useMemo(() => {
    const existing = predecessors
      .filter((dep) => !pendingRemoves.includes(dep.id))
      .map((dep) => ({
        id: dep.id,
        label: dep.predecessor.title,
        meta: `${dep.depType}${dep.lagDays ? ` +${dep.lagDays}d` : ""}`,
      }));
    const draft = draftAdds
      .filter((dep) => dep.successorId === task.id)
      .map((dep) => ({
        id: dep.clientId,
        label: taskTitleById.get(dep.predecessorId) ?? "Task",
        meta: `${dep.depType}${dep.lagDays ? ` +${dep.lagDays}d` : ""} · draft`,
        isDraft: true,
      }));
    return [...existing, ...draft];
  }, [predecessors, pendingRemoves, draftAdds, task.id, taskTitleById]);

  const successorItems = useMemo(() => {
    const existing = successors
      .filter((dep) => !pendingRemoves.includes(dep.id))
      .map((dep) => ({
        id: dep.id,
        label: dep.successor.title,
        meta: `${dep.depType}${dep.lagDays ? ` +${dep.lagDays}d` : ""}`,
      }));
    const draft = draftAdds
      .filter((dep) => dep.predecessorId === task.id)
      .map((dep) => ({
        id: dep.clientId,
        label: taskTitleById.get(dep.successorId) ?? "Task",
        meta: `${dep.depType}${dep.lagDays ? ` +${dep.lagDays}d` : ""} · draft`,
        isDraft: true,
      }));
    return [...existing, ...draft];
  }, [successors, pendingRemoves, draftAdds, task.id, taskTitleById]);

  async function handleAddPredecessor() {
    if (!predecessorPick) return;

    if (linkedPredecessorIds.has(predecessorPick)) {
      toast.error("That predecessor is already linked.");
      return;
    }

    if (mode === "draft") {
      onDraftAddsChange?.([
        ...draftAdds,
        {
          clientId: draftDependencyId(),
          predecessorId: predecessorPick,
          successorId: task.id,
          depType,
          lagDays: Number(lagDays) || 0,
        },
      ]);
      setPredecessorPick("");
      return;
    }

    try {
      await createDependency({
        predecessorId: predecessorPick,
        successorId: task.id,
        depType,
        lagDays: Number(lagDays) || 0,
      }).unwrap();
      toast.success("Predecessor linked — schedule recalculated if dates exist.");
      setPredecessorPick("");
      onUpdated?.();
    } catch (err: unknown) {
      const apiErr = err as { data?: { errors?: Record<string, string>; message?: string } };
      const code = apiErr?.data?.errors?.dependency;
      toast.error(
        code === "cyclicDependency"
          ? "That link would create a circular dependency."
          : apiErr?.data?.message ?? "Failed to add dependency.",
      );
    }
  }

  async function handleAddSuccessor() {
    if (!successorPick) return;

    if (linkedSuccessorIds.has(successorPick)) {
      toast.error("That successor is already linked.");
      return;
    }

    if (mode === "draft") {
      onDraftAddsChange?.([
        ...draftAdds,
        {
          clientId: draftDependencyId(),
          predecessorId: task.id,
          successorId: successorPick,
          depType,
          lagDays: Number(lagDays) || 0,
        },
      ]);
      setSuccessorPick("");
      return;
    }

    try {
      await createDependency({
        predecessorId: task.id,
        successorId: successorPick,
        depType,
        lagDays: Number(lagDays) || 0,
      }).unwrap();
      toast.success("Successor linked — schedule recalculated if dates exist.");
      setSuccessorPick("");
      onUpdated?.();
    } catch (err: unknown) {
      const apiErr = err as { data?: { errors?: Record<string, string>; message?: string } };
      const code = apiErr?.data?.errors?.dependency;
      toast.error(
        code === "cyclicDependency"
          ? "That link would create a circular dependency."
          : apiErr?.data?.message ?? "Failed to add dependency.",
      );
    }
  }

  function handleRemove(dependencyId: string, isDraft?: boolean) {
    if (mode === "draft") {
      if (isDraft) {
        onDraftAddsChange?.(draftAdds.filter((dep) => dep.clientId !== dependencyId));
        return;
      }
      onPendingRemovesChange?.([...pendingRemoves, dependencyId]);
      return;
    }

    const dep = [...predecessors, ...successors].find((row) => row.id === dependencyId);
    if (dep) void handleRemoveImmediate(dep);
  }

  async function handleRemoveImmediate(dependency: TaskDependency) {
    try {
      await deleteDependency(dependency.id).unwrap();
      toast.success("Dependency removed.");
      onUpdated?.();
    } catch {
      toast.error("Failed to remove dependency.");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="flex items-center gap-2">
        <GitBranch className="size-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Dependencies</h3>
          <p className="text-[11px] text-muted-foreground">
            Link tasks with FS/SS/FF/SF types. Circular links are blocked; dates cascade to successors.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading dependencies…
        </div>
      ) : (
        <>
          <DependencyList
            title="Predecessors (must happen before this task)"
            emptyLabel="No predecessors"
            items={predecessorItems}
            canEdit={canEdit}
            isDeleting={isDeleting}
            onRemove={(id, isDraft) => handleRemove(id, isDraft)}
          />

          <DependencyList
            title="Successors (blocked by this task)"
            emptyLabel="No successors"
            items={successorItems}
            canEdit={canEdit}
            isDeleting={isDeleting}
            onRemove={(id, isDraft) => handleRemove(id, isDraft)}
          />
        </>
      )}

      {canEdit && (
        <div className="space-y-3 border-t border-border/60 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Type</Label>
              <Select value={depType} onValueChange={(v) => setDepType(v as TaskDependencyType)}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {DEP_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Lag (days)</Label>
              <Input
                type="number"
                min={-365}
                max={365}
                value={lagDays}
                onChange={(e) => setLagDays(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Add predecessor</Label>
              <Select
                value={predecessorPick || "none"}
                onValueChange={(v) => setPredecessorPick(v === "none" ? "" : (v ?? ""))}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select task…">
                    {predecessorPick ? taskPickLabel(predecessorPick) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="none">Select task…</SelectItem>
                  {availablePredecessors.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full lg:w-auto"
                disabled={!predecessorPick || (mode === "immediate" && isCreating)}
                onClick={() => void handleAddPredecessor()}
              >
                {mode === "immediate" && isCreating && (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                )}
                {mode === "draft" ? "Add to list" : "Link predecessor"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Add successor</Label>
              <Select
                value={successorPick || "none"}
                onValueChange={(v) => setSuccessorPick(v === "none" ? "" : (v ?? ""))}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select task…">
                    {successorPick ? taskPickLabel(successorPick) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="none">Select task…</SelectItem>
                  {availableSuccessors.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full lg:w-auto"
                disabled={!successorPick || (mode === "immediate" && isCreating)}
                onClick={() => void handleAddSuccessor()}
              >
                {mode === "immediate" && isCreating && (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                )}
                {mode === "draft" ? "Add to list" : "Link successor"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DependencyList({
  title,
  emptyLabel,
  items,
  canEdit,
  isDeleting,
  onRemove,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{ id: string; label: string; meta: string; isDraft?: boolean }>;
  canEdit: boolean;
  isDeleting: boolean;
  onRemove: (id: string, isDraft?: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-[11px] text-muted-foreground">{item.meta}</p>
            </div>
            {canEdit && (
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => onRemove(item.id, item.isDraft)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove dependency"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
