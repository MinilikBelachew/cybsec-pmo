"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitBranch, Loader2, Search } from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import type {
  TaskDependency,
  TaskDependencyType,
} from "@/domains/projects/types/tasks.types";
import { useLazyGetTaskOptionsQuery } from "@/domains/projects/api/tasks.api";
import { useSyncPredecessors } from "@/domains/projects/hooks/use-sync-predecessors";
import type {
  DesiredPredecessorLink,
  DesiredSuccessorLink,
} from "@/domains/projects/utils/task-predecessors-grid";

const DEP_TYPES: { value: TaskDependencyType; label: string }[] = [
  { value: "FS", label: "FS" },
  { value: "SS", label: "SS" },
  { value: "FF", label: "FF" },
  { value: "SF", label: "SF" },
];

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export type DepTaskOption = {
  id: string;
  name: string;
};

/** @deprecated Use DepTaskOption */
export type PredTaskOption = DepTaskOption;

type LinkMode = "predecessors" | "successors";

type PredDraft = {
  otherId: string;
  depType: TaskDependencyType;
  lagDays: number;
};

type TaskDependenciesPickerProps = {
  taskId: string;
  projectId: string;
  dependencies: TaskDependency[];
  canEdit: boolean;
};

function predEqual(a: DesiredPredecessorLink[], b: DesiredPredecessorLink[]) {
  if (a.length !== b.length) return false;
  const key = (l: DesiredPredecessorLink) =>
    `${l.predecessorId}|${l.depType}|${l.lagDays}`;
  return (
    [...a].map(key).sort().join(";") === [...b].map(key).sort().join(";")
  );
}

function succEqual(a: DesiredSuccessorLink[], b: DesiredSuccessorLink[]) {
  if (a.length !== b.length) return false;
  const key = (l: DesiredSuccessorLink) =>
    `${l.successorId}|${l.depType}|${l.lagDays}`;
  return (
    [...a].map(key).sort().join(";") === [...b].map(key).sort().join(";")
  );
}

function formatLinkSummary(
  otherId: string,
  depType: TaskDependencyType,
  lagDays: number,
  nameById: Map<string, string>,
) {
  const name = nameById.get(otherId) ?? "Task";
  const type = depType || "FS";
  const lag = lagDays || 0;
  if (type === "FS" && lag === 0) return name;
  if (lag === 0) return `${name} (${type})`;
  const lagStr = lag > 0 ? `+${lag}d` : `${lag}d`;
  return `${name} (${type}${lagStr})`;
}

export function TaskDependenciesPicker({
  taskId,
  projectId,
  dependencies,
  canEdit,
}: TaskDependenciesPickerProps) {
  const { applyPredecessorLinks, applySuccessorLinks } = useSyncPredecessors();
  const [fetchOptions] = useLazyGetTaskOptionsQuery();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<LinkMode>("predecessors");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [predDraft, setPredDraft] = useState<PredDraft[]>([]);
  const [succDraft, setSuccDraft] = useState<PredDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const [options, setOptions] = useState<DepTaskOption[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nameById, setNameById] = useState<Map<string, string>>(() => new Map());
  const listRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  const existingPred = useMemo((): DesiredPredecessorLink[] => {
    return dependencies
      .filter((d) => d.successorId === taskId)
      .map((d) => ({
        predecessorId: d.predecessorId,
        depType: d.depType,
        lagDays: d.lagDays ?? 0,
      }));
  }, [dependencies, taskId]);

  const existingSucc = useMemo((): DesiredSuccessorLink[] => {
    return dependencies
      .filter((d) => d.predecessorId === taskId)
      .map((d) => ({
        successorId: d.successorId,
        depType: d.depType,
        lagDays: d.lagDays ?? 0,
      }));
  }, [dependencies, taskId]);

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (existingPred.length) {
      parts.push(
        `Pred: ${existingPred
          .map((l) =>
            formatLinkSummary(
              l.predecessorId,
              l.depType,
              l.lagDays,
              nameById,
            ),
          )
          .join(", ")}`,
      );
    }
    if (existingSucc.length) {
      parts.push(
        `Succ: ${existingSucc
          .map((l) =>
            formatLinkSummary(l.successorId, l.depType, l.lagDays, nameById),
          )
          .join(", ")}`,
      );
    }
    return parts.join(" · ");
  }, [existingPred, existingSucc, nameById]);

  const mergeNames = useCallback(
    (rows: Array<{ id: string; name?: string; title?: string }>) => {
      setNameById((prev) => {
        const next = new Map(prev);
        for (const row of rows) {
          const name = row.name ?? row.title;
          if (name) next.set(row.id, name);
        }
        return next;
      });
    },
    [],
  );

  const loadPage = useCallback(
    async (offset: number, search: string, append: boolean) => {
      const seq = ++requestSeq.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const page = await fetchOptions({
          projectId,
          excludeTaskId: taskId,
          search: search || undefined,
          offset,
          limit: PAGE_SIZE,
        }).unwrap();
        if (seq !== requestSeq.current) return;

        const mapped = page.rows.map((r) => ({ id: r.id, name: r.title }));
        mergeNames(mapped);
        setOptions((prev) => (append ? [...prev, ...mapped] : mapped));
        setHasMore(page.hasMore);
        setTotal(page.total);
      } catch {
        if (seq !== requestSeq.current) return;
        if (!append) {
          setOptions([]);
          setHasMore(false);
          setTotal(0);
        }
        toast.error("Failed to load tasks for dependencies");
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [fetchOptions, projectId, taskId, mergeNames],
  );

  const resolveSelectedNames = useCallback(
    async (ids: string[]) => {
      const unique = [...new Set(ids.filter(Boolean))];
      if (unique.length === 0) return;
      try {
        const page = await fetchOptions({
          projectId,
          ids: unique,
        }).unwrap();
        mergeNames(page.rows.map((r) => ({ id: r.id, name: r.title })));
      } catch {
        // keep fallback "Task" label
      }
    },
    [fetchOptions, projectId, mergeNames],
  );

  useEffect(() => {
    if (!open) return;
    setPredDraft(
      existingPred.map((l) => ({
        otherId: l.predecessorId,
        depType: l.depType,
        lagDays: l.lagDays,
      })),
    );
    setSuccDraft(
      existingSucc.map((l) => ({
        otherId: l.successorId,
        depType: l.depType,
        lagDays: l.lagDays,
      })),
    );
    setQuery("");
    setDebouncedQuery("");
    setMode("predecessors");
    setOptions([]);
    void loadPage(0, "", false);
    void resolveSelectedNames([
      ...existingPred.map((l) => l.predecessorId),
      ...existingSucc.map((l) => l.successorId),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when opening
  }, [open]);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedQuery(query),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    void loadPage(0, debouncedQuery, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const activeDraft = mode === "predecessors" ? predDraft : succDraft;
  const setActiveDraft =
    mode === "predecessors" ? setPredDraft : setSuccDraft;

  const candidates = useMemo(() => {
    const blocked =
      mode === "predecessors"
        ? new Set(succDraft.map((d) => d.otherId))
        : new Set(predDraft.map((d) => d.otherId));
    return options.filter((t) => {
      if (t.id === taskId) return false;
      if (blocked.has(t.id)) return false;
      return true;
    });
  }, [options, taskId, mode, predDraft, succDraft]);

  const selectedIds = useMemo(
    () => new Set(activeDraft.map((d) => d.otherId)),
    [activeDraft],
  );

  const toggleTask = (id: string, checked: boolean) => {
    setActiveDraft((prev) => {
      if (checked) {
        if (prev.some((d) => d.otherId === id)) return prev;
        return [...prev, { otherId: id, depType: "FS", lagDays: 0 }];
      }
      return prev.filter((d) => d.otherId !== id);
    });
  };

  const updateDraft = (
    otherId: string,
    patch: Partial<Pick<PredDraft, "depType" | "lagDays">>,
  ) => {
    setActiveDraft((prev) =>
      prev.map((d) => (d.otherId === otherId ? { ...d, ...patch } : d)),
    );
  };

  const desiredPred: DesiredPredecessorLink[] = predDraft.map((d) => ({
    predecessorId: d.otherId,
    depType: d.depType,
    lagDays: d.lagDays,
  }));
  const desiredSucc: DesiredSuccessorLink[] = succDraft.map((d) => ({
    successorId: d.otherId,
    depType: d.depType,
    lagDays: d.lagDays,
  }));

  const dirty =
    !predEqual(desiredPred, existingPred) ||
    !succEqual(desiredSucc, existingSucc);

  const handleSave = async () => {
    if (!canEdit || saving || !dirty) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const predOk = predEqual(desiredPred, existingPred)
        ? true
        : await applyPredecessorLinks(taskId, desiredPred, dependencies);
      if (!predOk) return;

      const succOk = succEqual(desiredSucc, existingSucc)
        ? true
        : await applySuccessorLinks(taskId, desiredSucc, dependencies);
      if (!succOk) return;

      const totalLinks = desiredPred.length + desiredSucc.length;
      toast.success(
        totalLinks
          ? `Saved ${totalLinks} dependenc${totalLinks === 1 ? "y" : "ies"}`
          : "Dependencies cleared",
      );
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el || loading || loadingMore || !hasMore) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
    if (!nearBottom) return;
    void loadPage(options.length, debouncedQuery, true);
  };

  const count = existingPred.length + existingSucc.length;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        setOpen(next);
      }}
    >
      <PopoverTrigger
        type="button"
        disabled={!canEdit && count === 0}
        className="text-left disabled:opacity-50"
        onClick={(e) => e.stopPropagation()}
        title={summary || "Set dependencies"}
        aria-label={count ? `Dependencies: ${summary}` : "Set dependencies"}
      >
        <span
          className={cn(
            "relative inline-flex items-center justify-center size-6 rounded-md transition-colors",
            count
              ? "text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/15"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <GitBranch className="size-3.5" />
          {count > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-full bg-violet-600 text-white text-[9px] font-semibold leading-none flex items-center justify-center">
              {count > 9 ? "9+" : count}
            </span>
          ) : null}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-80 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-border">
          <p className="text-xs font-medium text-foreground">Dependencies</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Choose predecessors or successors, then type and lag
          </p>
        </div>

        <div className="flex border-b border-border">
          {(
            [
              {
                id: "predecessors" as const,
                label: "Predecessors",
                n: predDraft.length,
              },
              {
                id: "successors" as const,
                label: "Successors",
                n: succDraft.length,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              disabled={saving}
              onClick={() => {
                setMode(tab.id);
                setQuery("");
                setDebouncedQuery("");
              }}
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                mode === tab.id
                  ? "text-foreground border-b-2 border-violet-600 -mb-px"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.n > 0 ? (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({tab.n})
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                mode === "predecessors"
                  ? "Search predecessors…"
                  : "Search successors…"
              }
              className="h-8 pl-8 text-xs"
              disabled={!canEdit || saving}
            />
          </div>
        </div>

        <div
          ref={listRef}
          onScroll={handleScroll}
          className="max-h-40 overflow-y-auto py-1"
        >
          {loading && options.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading tasks…
            </div>
          ) : candidates.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">
              No matching tasks
            </p>
          ) : (
            <>
              {candidates.map((t) => {
                const checked = selectedIds.has(t.id);
                return (
                  <label
                    key={t.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/60",
                      !canEdit && "cursor-default opacity-80",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!canEdit || saving}
                      onCheckedChange={(v) => toggleTask(t.id, v === true)}
                    />
                    <span className="text-xs truncate flex-1">{t.name}</span>
                  </label>
                );
              })}
              {loadingMore ? (
                <div className="flex items-center justify-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Loading more…
                </div>
              ) : hasMore ? (
                <p className="px-3 py-2 text-[10px] text-center text-muted-foreground">
                  Scroll for more · {options.length} of {total}
                </p>
              ) : total > 0 ? (
                <p className="px-3 py-2 text-[10px] text-center text-muted-foreground">
                  {total} task{total === 1 ? "" : "s"}
                </p>
              ) : null}
            </>
          )}
        </div>

        {activeDraft.length > 0 ? (
          <div className="border-t border-border px-3 py-2 space-y-2 max-h-36 overflow-y-auto">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Link settings
            </p>
            {activeDraft.map((d) => (
              <div key={d.otherId} className="flex items-center gap-2">
                <span
                  className="text-xs truncate flex-1 min-w-0"
                  title={nameById.get(d.otherId) ?? d.otherId}
                >
                  {nameById.get(d.otherId) ?? "Task"}
                </span>
                <Select
                  value={d.depType}
                  disabled={!canEdit || saving}
                  onValueChange={(v) =>
                    updateDraft(d.otherId, {
                      depType: v as TaskDependencyType,
                    })
                  }
                >
                  <SelectTrigger className="h-7 w-[4.25rem] text-xs shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {DEP_TYPES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  className="h-7 w-14 text-xs shrink-0"
                  value={d.lagDays}
                  disabled={!canEdit || saving}
                  title="Lag days"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    updateDraft(d.otherId, {
                      lagDays: Number.isFinite(n) ? Math.trunc(n) : 0,
                    });
                  }}
                />
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border bg-muted/30">
          <span className="text-[11px] text-muted-foreground">
            {activeDraft.length} selected
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={saving || !dirty}
                onClick={() => void handleSave()}
              >
                {saving ? <Loader2 className="size-3 animate-spin" /> : null}
                Save
              </Button>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** @deprecated Use TaskDependenciesPicker */
export const TaskPredecessorsPicker = TaskDependenciesPicker;
/** @deprecated Use TaskDependenciesPicker */
export const TaskPredecessorsCell = TaskDependenciesPicker;
