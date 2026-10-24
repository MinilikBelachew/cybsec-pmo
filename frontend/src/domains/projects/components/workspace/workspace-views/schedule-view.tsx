"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "@/shared/utils/cn";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import type {
  Task,
  TaskDependency,
  TaskDependencyType,
} from "@/domains/projects/types/tasks.types";
import type {
  ProjectPhase,
  ProjectMilestone,
} from "@/domains/projects/types/projects.types";
import {
  buildPlanIdMaps,
  formatPredecessorsGrid,
  formatSuccessorsGrid,
  parsePredecessorsGrid,
  resolveParsedPredecessors,
  type DesiredPredecessorLink,
  type DesiredSuccessorLink,
} from "@/domains/projects/utils/task-predecessors-grid";
import { useUpdateTaskMutation } from "@/domains/projects/api/tasks.api";
import { useSyncPredecessors } from "@/domains/projects/hooks/use-sync-predecessors";

export type MspCustomFieldDef = {
  fieldName: string;
  index?: number;
  type?: string;
  alias?: string;
  fieldId?: string;
};

type ScheduleViewProps = {
  tasks: Task[];
  dependencies: TaskDependency[];
  projectId?: string;
  phases?: ProjectPhase[];
  milestones?: ProjectMilestone[];
  customFieldDefs?: MspCustomFieldDef[] | null;
  canEdit?: boolean;
  onTaskClick?: (taskId: string) => void;
};

type EditField =
  | "startDate"
  | "endDate"
  | "durationDays"
  | "progressApproved"
  | "description"
  | "predecessors"
  | "successors"
  | `custom:${string}`;

type EditCell = { taskId: string; field: EditField } | null;

type FixedColKey =
  | "id"
  | "name"
  | "baselineStart"
  | "baselineFinish"
  | "baselineDuration"
  | "start"
  | "finish"
  | "duration"
  | "predecessors"
  | "percent"
  | "successors"
  | "resources"
  | "taskMode"
  | "constraintType"
  | "constraintDate"
  | "notes"
  | "variance";

type ColKey = FixedColKey | `cf:${string}`;

const DEFAULT_FIXED_WIDTHS: Record<FixedColKey, number> = {
  id: 56,
  name: 300,
  baselineStart: 120,
  baselineFinish: 120,
  baselineDuration: 110,
  start: 120,
  finish: 120,
  duration: 96,
  predecessors: 120,
  percent: 88,
  successors: 120,
  resources: 160,
  taskMode: 88,
  constraintType: 140,
  constraintDate: 120,
  notes: 200,
  variance: 120,
};

/** All built-in columns (catalog for Insert Column). */
const FIXED_COL_LABELS: { key: FixedColKey; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Task Name" },
  { key: "baselineStart", label: "Baseline Start" },
  { key: "baselineFinish", label: "Baseline Finish" },
  { key: "baselineDuration", label: "Baseline Duration" },
  { key: "start", label: "Start" },
  { key: "finish", label: "Finish" },
  { key: "duration", label: "Duration" },
  { key: "predecessors", label: "Predecessors" },
  { key: "percent", label: "% Complete" },
  { key: "successors", label: "Successors" },
  { key: "resources", label: "Resource Names" },
  { key: "taskMode", label: "Task Mode" },
  { key: "constraintType", label: "Constraint Type" },
  { key: "constraintDate", label: "Constraint Date" },
  { key: "notes", label: "Notes" },
  { key: "variance", label: "Duration Variance" },
];

const FIXED_LABEL_BY_KEY = Object.fromEntries(
  FIXED_COL_LABELS.map((c) => [c.key, c.label]),
) as Record<FixedColKey, string>;

/** Always leftmost; not hideable / not reorderable away from the left. */
const PINNED_COLS: FixedColKey[] = ["id", "name"];

/** Default visible set (MSP-style entry table — customs stay hidden until Insert). */
const DEFAULT_VISIBLE_COLS: ColKey[] = [
  "id",
  "name",
  "baselineStart",
  "baselineFinish",
  "baselineDuration",
  "start",
  "finish",
  "duration",
  "predecessors",
  "percent",
];

const INSERT_COL_WIDTH = 44;
const LAYOUT_STORAGE_VERSION = 1;

function scheduleLayoutKey(projectId?: string): string {
  return `cybsec.schedule.cols.v${LAYOUT_STORAGE_VERSION}.${projectId || "default"}`;
}

function loadVisibleCols(projectId?: string): ColKey[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(scheduleLayoutKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { order?: string[] };
    if (!Array.isArray(parsed?.order) || parsed.order.length === 0) return null;
    return parsed.order.filter((k): k is ColKey => typeof k === "string");
  } catch {
    return null;
  }
}

function saveVisibleCols(projectId: string | undefined, order: ColKey[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      scheduleLayoutKey(projectId),
      JSON.stringify({ order }),
    );
  } catch {
    /* ignore quota */
  }
}

function normalizeVisibleOrder(
  order: ColKey[],
  available: Set<string>,
): ColKey[] {
  const seen = new Set<string>();
  const rest: ColKey[] = [];
  for (const key of order) {
    if (key === "id" || key === "name") continue;
    if (!available.has(key) || seen.has(key)) continue;
    seen.add(key);
    rest.push(key);
  }
  return [...PINNED_COLS, ...rest];
}

/** Move dragId (+ descendants) to sit before targetId in plan order. */
function reorderPlanBlock(
  orderedIds: string[],
  childrenOf: Map<string, string[]>,
  dragId: string,
  targetId: string,
): string[] | null {
  if (dragId === targetId) return null;

  const blockSet = new Set<string>();
  const collect = (id: string) => {
    blockSet.add(id);
    for (const childId of childrenOf.get(id) ?? []) collect(childId);
  };
  collect(dragId);

  if (blockSet.has(targetId)) return null;

  const block = orderedIds.filter((id) => blockSet.has(id));
  const rest = orderedIds.filter((id) => !blockSet.has(id));
  const targetIdx = rest.indexOf(targetId);
  if (targetIdx < 0) return null;

  return [...rest.slice(0, targetIdx), ...block, ...rest.slice(targetIdx)];
}

const CONSTRAINT_LABELS: Record<string, string> = {
  ASAP: "As Soon As Possible",
  ALAP: "As Late As Possible",
  SNET: "Start No Earlier Than",
  FNET: "Finish No Earlier Than",
  SNLT: "Start No Later Than",
  FNLT: "Finish No Later Than",
  MSO: "Must Start On",
  MFO: "Must Finish On",
};

function customColKey(fieldName: string): ColKey {
  return `cf:${fieldName}`;
}

function customFieldFromColKey(key: ColKey): string | null {
  return key.startsWith("cf:") ? key.slice(3) : null;
}

function formatDay(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

function toDateInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function durationLabel(task: Task): string {
  if (task.isScheduleMilestone) return "0 days";
  const days = task.durationDays;
  if (days == null || !Number.isFinite(Number(days))) return "";
  const n = Number(days);
  return `${n} day${n === 1 ? "" : "s"}`;
}

function baselineDurationLabel(task: Task): string {
  if (task.isScheduleMilestone && task.baselineDurationDays == null) {
    return "0 days";
  }
  const days = task.baselineDurationDays;
  if (days == null || !Number.isFinite(Number(days))) return "";
  const n = Number(days);
  return `${n} day${n === 1 ? "" : "s"}`;
}

function durationVarianceLabel(task: Task): string {
  const cur = task.durationDays;
  const base = task.baselineDurationDays;
  if (
    cur == null ||
    base == null ||
    !Number.isFinite(Number(cur)) ||
    !Number.isFinite(Number(base))
  ) {
    return "";
  }
  const delta = Math.round((Number(cur) - Number(base)) * 10) / 10;
  if (delta === 0) return "0 days";
  return `${delta} day${Math.abs(delta) === 1 ? "" : "s"}`;
}

function taskTitle(task: Task & { name?: string }): string {
  return (task.title || task.name || "").trim();
}

/**
 * Microsoft Project–style schedule sheet with expand/collapse, horizontal scroll,
 * essential columns, and inline edit (dates, %, notes, predecessors/successors).
 */
export function ScheduleView({
  tasks,
  dependencies,
  projectId,
  customFieldDefs,
  canEdit = true,
  onTaskClick,
}: ScheduleViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [edit, setEdit] = useState<EditCell>(null);
  const [draft, setDraft] = useState("");
  const [rowHeight, setRowHeight] = useState(28);
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [draggingCol, setDraggingCol] = useState<ColKey | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColKey | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertFilter, setInsertFilter] = useState("");
  const resizeRef = useRef<{ key: ColKey; startX: number; startW: number } | null>(
    null,
  );
  const [updateTask] = useUpdateTaskMutation();
  const { applyPredecessorLinks, applySuccessorLinks } = useSyncPredecessors();

  const customDefs = useMemo(() => {
    if (!Array.isArray(customFieldDefs)) return [] as MspCustomFieldDef[];
    return customFieldDefs.filter((d) => d?.fieldName?.trim());
  }, [customFieldDefs]);

  const customAliasByField = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of customDefs) {
      const name = d.fieldName.trim();
      const alias = d.alias?.trim();
      if (alias) map.set(name, alias);
    }
    return map;
  }, [customDefs]);

  /** Catalog of every insertable column (built-ins + imported customs, including zero slots). */
  const availableColumns = useMemo(() => {
    const list: { key: ColKey; label: string; group: "core" | "custom" }[] = [];
    const seen = new Set<string>();

    for (const col of FIXED_COL_LABELS) {
      seen.add(col.key);
      list.push({ key: col.key, label: col.label, group: "core" });
    }

    const addCustom = (fieldName: string) => {
      const name = fieldName.trim();
      if (!name) return;
      const key = customColKey(name);
      if (seen.has(key)) return;
      seen.add(key);
      list.push({
        key,
        label: customAliasByField.get(name) || name,
        group: "custom",
      });
    };

    for (const d of customDefs) addCustom(d.fieldName);

    for (const t of tasks) {
      const map = t.mspCustomFields;
      if (!map || typeof map !== "object") continue;
      for (const fieldName of Object.keys(map)) addCustom(fieldName);
      for (const child of [
        ...((t.subTasks as Task[] | undefined) ?? []),
      ]) {
        const cm = child.mspCustomFields;
        if (!cm || typeof cm !== "object") continue;
        for (const fieldName of Object.keys(cm)) addCustom(fieldName);
      }
    }

    return list;
  }, [customDefs, customAliasByField, tasks]);

  const availableKeySet = useMemo(
    () => new Set(availableColumns.map((c) => c.key as string)),
    [availableColumns],
  );

  const [visibleOrder, setVisibleOrder] = useState<ColKey[]>(() => {
    const saved = loadVisibleCols(projectId);
    if (saved) return normalizeVisibleOrder(saved, new Set(saved));
    return [...DEFAULT_VISIBLE_COLS];
  });

  // Reload when switching projects; keep unknown customs until catalog loads.
  React.useEffect(() => {
    const saved = loadVisibleCols(projectId);
    if (saved) {
      setVisibleOrder(normalizeVisibleOrder(saved, new Set([...saved, ...availableKeySet])));
    } else {
      setVisibleOrder([...DEFAULT_VISIBLE_COLS]);
    }
    // Only re-init on project change, not every catalog tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  React.useEffect(() => {
    setVisibleOrder((prev) => {
      const next = normalizeVisibleOrder(prev, availableKeySet);
      // Keep custom cols the user already chose even if defs briefly empty.
      const keptCustoms = prev.filter(
        (k) => k.startsWith("cf:") && !next.includes(k),
      );
      const merged = keptCustoms.length ? [...next, ...keptCustoms] : next;
      if (
        merged.length === prev.length &&
        merged.every((k, i) => k === prev[i])
      ) {
        return prev;
      }
      return merged;
    });
  }, [availableKeySet]);

  React.useEffect(() => {
    saveVisibleCols(projectId, visibleOrder);
  }, [projectId, visibleOrder]);

  const colLabels = useMemo(() => {
    return visibleOrder.map((key) => {
      const cf = customFieldFromColKey(key);
      if (cf) {
        return {
          key,
          label: customAliasByField.get(cf) || cf,
          fieldName: cf,
        };
      }
      return {
        key,
        label: FIXED_LABEL_BY_KEY[key as FixedColKey] ?? key,
        fieldName: undefined as string | undefined,
      };
    });
  }, [visibleOrder, customAliasByField]);

  const hiddenColumns = useMemo(() => {
    const visible = new Set(visibleOrder);
    return availableColumns.filter((c) => !visible.has(c.key));
  }, [availableColumns, visibleOrder]);

  const filteredInsertCols = useMemo(() => {
    const q = insertFilter.trim().toLowerCase();
    if (!q) return hiddenColumns;
    return hiddenColumns.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.key.toLowerCase().includes(q),
    );
  }, [hiddenColumns, insertFilter]);

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => ({
    ...DEFAULT_FIXED_WIDTHS,
  }));

  React.useEffect(() => {
    setColWidths((prev) => {
      const next = { ...prev };
      for (const key of visibleOrder) {
        if (next[key] == null) next[key] = key.startsWith("cf:") ? 140 : 120;
      }
      return next;
    });
  }, [visibleOrder]);

  const tableWidth = useMemo(
    () =>
      colLabels.reduce((sum, col) => sum + (colWidths[col.key] ?? 120), 0) +
      INSERT_COL_WIDTH,
    [colLabels, colWidths],
  );

  const insertColumn = (key: ColKey) => {
    setVisibleOrder((prev) => {
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });
    setInsertOpen(false);
    setInsertFilter("");
  };

  const hideColumn = (key: ColKey) => {
    if (key === "id" || key === "name") return;
    setVisibleOrder((prev) => prev.filter((k) => k !== key));
  };

  const moveColumnBefore = (dragKey: ColKey, targetKey: ColKey) => {
    if (dragKey === targetKey) return;
    if (dragKey === "id" || dragKey === "name") return;
    if (targetKey === "id" || targetKey === "name") return;
    setVisibleOrder((prev) => {
      if (!prev.includes(dragKey) || !prev.includes(targetKey)) return prev;
      const without = prev.filter((k) => k !== dragKey);
      const idx = without.indexOf(targetKey);
      if (idx < 0) return prev;
      const next = [
        ...without.slice(0, idx),
        dragKey,
        ...without.slice(idx),
      ];
      return normalizeVisibleOrder(next, new Set(next));
    });
  };

  const resetColumns = () => {
    setVisibleOrder([...DEFAULT_VISIBLE_COLS]);
  };

  const onResizeStart = (key: ColKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      key,
      startX: e.clientX,
      startW: colWidths[key] ?? 120,
    };
    const onMove = (ev: MouseEvent) => {
      const cur = resizeRef.current;
      if (!cur) return;
      const next = Math.max(48, cur.startW + (ev.clientX - cur.startX));
      setColWidths((prev) => ({ ...prev, [cur.key]: next }));
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const flatUnique = useMemo(() => {
    const seen = new Set<string>();
    const list: Task[] = [];
    const walk = (t: Task & { children?: Task[] }) => {
      if (seen.has(t.id)) return;
      seen.add(t.id);
      list.push(t);
      for (const child of [
        ...((t.subTasks as Task[] | undefined) ?? []),
        ...((t.children as Task[] | undefined) ?? []),
      ]) {
        walk(child);
      }
    };
    for (const t of tasks) walk(t);
    return list;
  }, [tasks]);

  const basePlanMaps = useMemo(
    () => buildPlanIdMaps(flatUnique),
    [flatUnique],
  );

  const orderedIds = useMemo(() => {
    if (!orderOverride?.length) return basePlanMaps.orderedIds;
    const known = new Set(basePlanMaps.orderedIds);
    const next = orderOverride.filter((id) => known.has(id));
    for (const id of basePlanMaps.orderedIds) {
      if (!next.includes(id)) next.push(id);
    }
    return next;
  }, [orderOverride, basePlanMaps.orderedIds]);

  const idToPlanId = useMemo(() => {
    const map = new Map<string, number>();
    orderedIds.forEach((id, i) => map.set(id, i + 1));
    return map;
  }, [orderedIds]);

  const planIdToId = useMemo(() => {
    const map = new Map<number, string>();
    for (const [id, planId] of idToPlanId) map.set(planId, id);
    return map;
  }, [idToPlanId]);

  const childrenOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of flatUnique) {
      if (!t.parentTaskId) continue;
      const list = map.get(t.parentTaskId) ?? [];
      list.push(t.id);
      map.set(t.parentTaskId, list);
    }
    // Keep sibling lists in current plan order.
    for (const [parentId, kids] of map) {
      map.set(
        parentId,
        [...kids].sort(
          (a, b) =>
            (idToPlanId.get(a) ?? 0) - (idToPlanId.get(b) ?? 0),
        ),
      );
    }
    return map;
  }, [flatUnique, idToPlanId]);

  // Drop stale local order when the server plan order catches up.
  React.useEffect(() => {
    if (!orderOverride) return;
    const server = basePlanMaps.orderedIds;
    if (
      server.length === orderOverride.length &&
      server.every((id, i) => id === orderOverride[i])
    ) {
      setOrderOverride(null);
    }
  }, [basePlanMaps.orderedIds, orderOverride]);

  const depthOf = useCallback(
    (taskId: string): number => {
      let depth = 0;
      let parentId = byId.get(taskId)?.parentTaskId ?? null;
      const seen = new Set<string>();
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        depth += 1;
        parentId = byId.get(parentId)?.parentTaskId ?? null;
      }
      return Math.min(depth, 8);
    },
    [byId],
  );

  const visibleRows = useMemo(() => {
    const hidden = new Set<string>();
    const markHidden = (parentId: string) => {
      for (const childId of childrenOf.get(parentId) ?? []) {
        hidden.add(childId);
        markHidden(childId);
      }
    };
    for (const id of collapsed) {
      markHidden(id);
    }
    return orderedIds
      .map((id) => byId.get(id) ?? flatUnique.find((t) => t.id === id))
      .filter((t): t is Task => Boolean(t) && !hidden.has(t!.id));
  }, [orderedIds, byId, flatUnique, collapsed, childrenOf]);

  const toggleCollapse = (taskId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const persistPlanOrder = async (nextOrder: string[]) => {
    setOrderOverride(nextOrder);
    setReordering(true);
    try {
      const updates = nextOrder
        .map((id, i) => ({ id, planRowId: i + 1 }))
        .filter(({ id, planRowId }) => {
          const task = byId.get(id);
          return task && Number(task.planRowId) !== planRowId;
        });
      await Promise.all(
        updates.map(({ id, planRowId }) =>
          updateTask({ id, body: { planRowId } }).unwrap(),
        ),
      );
    } catch {
      setOrderOverride(null);
      toast.error("Could not save row order");
    } finally {
      setReordering(false);
    }
  };

  const onRowDrop = async (targetId: string) => {
    if (!canEdit || !draggingId || reordering) return;
    const next = reorderPlanBlock(
      orderedIds,
      childrenOf,
      draggingId,
      targetId,
    );
    setDraggingId(null);
    setDragOverId(null);
    if (!next) return;
    const same =
      next.length === orderedIds.length &&
      next.every((id, i) => id === orderedIds[i]);
    if (same) return;
    await persistPlanOrder(next);
  };

  const beginEdit = (taskId: string, field: EditField, initial: string) => {
    if (!canEdit) return;
    setEdit({ taskId, field });
    setDraft(initial);
  };

  const customValue = (task: Task, fieldName: string): string => {
    const map = task.mspCustomFields;
    if (!map || typeof map !== "object") return "";
    const raw = (map as Record<string, unknown>)[fieldName];
    return raw == null ? "" : String(raw);
  };

  const cancelEdit = () => {
    setEdit(null);
    setDraft("");
  };

  const saveField = async () => {
    if (!edit) return;
    const task = byId.get(edit.taskId);
    if (!task) {
      cancelEdit();
      return;
    }

    try {
      if (edit.field === "predecessors") {
        const parsed = parsePredecessorsGrid(draft);
        const { links, errors } = resolveParsedPredecessors(
          parsed,
          edit.taskId,
          planIdToId,
          new Map(
            flatUnique.map((t) => [
              taskTitle(t).toLowerCase(),
              t.id,
            ]),
          ),
        );
        if (errors.length) {
          toast.error(errors[0]);
          return;
        }
        const ok = await applyPredecessorLinks(
          edit.taskId,
          links,
          dependencies,
        );
        if (ok) cancelEdit();
        return;
      }

      if (edit.field === "successors") {
        const parsed = parsePredecessorsGrid(draft);
        const links: DesiredSuccessorLink[] = [];
        const errors: string[] = [];
        for (const p of parsed) {
          const successorId =
            p.planId != null
              ? planIdToId.get(p.planId)
              : p.title
                ? flatUnique.find(
                  (t) =>
                    taskTitle(t).toLowerCase() === p.title!.toLowerCase(),
                )?.id
                : undefined;
          if (!successorId) {
            errors.push(
              p.planId != null
                ? `Unknown task ID ${p.planId}`
                : `Unknown task "${p.title}"`,
            );
            continue;
          }
          links.push({
            successorId,
            depType: p.depType,
            lagDays: p.lagDays,
          });
        }
        if (errors.length) {
          toast.error(errors[0]);
          return;
        }
        const ok = await applySuccessorLinks(
          edit.taskId,
          links,
          dependencies,
        );
        if (ok) cancelEdit();
        return;
      }

      const body: Record<string, unknown> = {};
      if (edit.field === "startDate" || edit.field === "endDate") {
        body[edit.field] = draft ? new Date(draft).toISOString() : null;
      } else if (edit.field === "durationDays") {
        const n = Number.parseFloat(draft);
        body.durationDays = Number.isFinite(n) ? n : null;
      } else if (edit.field === "progressApproved") {
        const n = Math.max(0, Math.min(100, Number.parseInt(draft, 10) || 0));
        body.progressApproved = n;
      } else if (edit.field === "description") {
        body.description = draft.trim() || null;
      } else if (edit.field.startsWith("custom:")) {
        const fieldName = edit.field.slice("custom:".length);
        const nextMap: Record<string, string> = {
          ...(task.mspCustomFields && typeof task.mspCustomFields === "object"
            ? { ...task.mspCustomFields }
            : {}),
        };
        const trimmed = draft.trim();
        if (trimmed) nextMap[fieldName] = trimmed;
        else delete nextMap[fieldName];
        body.mspCustomFields = nextMap;
      }

      await updateTask({ id: edit.taskId, body }).unwrap();
      cancelEdit();
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string }; message?: string })?.data
          ?.message ||
        (err as { message?: string })?.message ||
        "Failed to save";
      toast.error(String(msg));
    }
  };

  const applyLinkPicker = async (
    taskId: string,
    mode: "predecessors" | "successors",
    selectedIds: string[],
  ) => {
    if (mode === "predecessors") {
      const links: DesiredPredecessorLink[] = selectedIds.map((id) => ({
        predecessorId: id,
        depType: "FS" as TaskDependencyType,
        lagDays: 0,
      }));
      await applyPredecessorLinks(taskId, links, dependencies);
    } else {
      const links: DesiredSuccessorLink[] = selectedIds.map((id) => ({
        successorId: id,
        depType: "FS" as TaskDependencyType,
        lagDays: 0,
      }));
      await applySuccessorLinks(taskId, links, dependencies);
    }
  };

  if (visibleRows.length === 0 && flatUnique.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No schedule rows yet. Import an MPP or add phases and tasks.
      </div>
    );
  }

  const cellPadY = Math.max(2, Math.floor((rowHeight - 18) / 2));

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden border border-border/60 bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-muted/40 px-2 py-1">
        <span className="text-[11px] text-muted-foreground">Row height</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => setRowHeight((h) => Math.max(22, h - 4))}
          title="Shorter rows"
        >
          <Minus className="size-3.5" />
        </Button>
        <span className="w-8 text-center text-[11px] tabular-nums">{rowHeight}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => setRowHeight((h) => Math.min(56, h + 4))}
          title="Taller rows"
        >
          <Plus className="size-3.5" />
        </Button>
        <span className="ml-2 text-[11px] text-muted-foreground">
          Drag row grip to reorder · drag headers to rearrange columns · +
          inserts a field · scroll right for more
          {reordering ? " · saving order…" : ""}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-6 px-2 text-[11px]"
          onClick={resetColumns}
          title="Reset to default columns"
        >
          Reset columns
        </Button>
      </div>

      <div
        className={cn(
          "schedule-scroll min-h-0 min-w-0 w-full max-w-full flex-1",
          "overflow-x-scroll overflow-y-auto",
          "[scrollbar-width:auto]",
          "[&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar]:w-3",
          "[&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-muted-foreground/40",
          "[&::-webkit-scrollbar-track]:bg-muted/40",
        )}
      >
        <table
          className="border-collapse text-left text-xs"
          style={{
            tableLayout: "fixed",
            width: tableWidth,
            minWidth: tableWidth,
          }}
        >
          <colgroup>
            {colLabels.map(({ key }) => (
              <col key={key} style={{ width: colWidths[key] ?? 120 }} />
            ))}
            <col style={{ width: INSERT_COL_WIDTH }} />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur">
            <tr className="border-b border-border" style={{ height: rowHeight + 8 }}>
              {colLabels.map(({ key, label }) => {
                const pinned = key === "id" || key === "name";
                const sticky =
                  key === "id"
                    ? "sticky left-0 z-30 bg-emerald-100/95 dark:bg-emerald-950/90"
                    : key === "name"
                      ? "sticky z-30 bg-muted/95"
                      : "";
                const left =
                  key === "name" ? colWidths.id : key === "id" ? 0 : undefined;
                const isColDragOver =
                  dragOverCol === key &&
                  draggingCol != null &&
                  draggingCol !== key;
                return (
                  <th
                    key={key}
                    draggable={!pinned}
                    className={cn(
                      "group relative border-r border-border px-2 py-1 font-semibold select-none",
                      sticky,
                      key === "id" &&
                      "text-center text-emerald-900 dark:text-emerald-100",
                      !pinned && "cursor-grab active:cursor-grabbing",
                      draggingCol === key && "opacity-50",
                      isColDragOver && "border-l-2 border-l-primary",
                    )}
                    style={{
                      width: colWidths[key] ?? 120,
                      minWidth: colWidths[key] ?? 120,
                      left,
                    }}
                    title={
                      customFieldFromColKey(key) ??
                      (pinned ? label : `${label} — drag to rearrange`)
                    }
                    onDragStart={(e) => {
                      if (pinned) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", key);
                      setDraggingCol(key);
                    }}
                    onDragEnd={() => {
                      setDraggingCol(null);
                      setDragOverCol(null);
                    }}
                    onDragOver={(e) => {
                      if (!draggingCol || pinned) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverCol !== key) setDragOverCol(key);
                    }}
                    onDragLeave={() => {
                      if (dragOverCol === key) setDragOverCol(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from =
                        (e.dataTransfer.getData("text/plain") as ColKey) ||
                        draggingCol;
                      if (from) moveColumnBefore(from, key);
                      setDraggingCol(null);
                      setDragOverCol(null);
                    }}
                  >
                    <span className="pr-4">{label}</span>
                    {!pinned ? (
                      <button
                        type="button"
                        className="absolute top-0.5 right-2 z-30 hidden rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground group-hover:inline-flex"
                        title={`Hide ${label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          hideColumn(key);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      className="absolute top-0 right-0 z-40 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
                      onMouseDown={(e) => onResizeStart(key, e)}
                      draggable={false}
                    />
                  </th>
                );
              })}
              <th
                className="sticky right-0 z-30 border-l border-border bg-muted/95 px-0"
                style={{
                  width: INSERT_COL_WIDTH,
                  minWidth: INSERT_COL_WIDTH,
                }}
              >
                <Popover
                  open={insertOpen}
                  onOpenChange={(open) => {
                    setInsertOpen(open);
                    if (!open) setInsertFilter("");
                  }}
                >
                  <PopoverTrigger
                    className="flex h-full w-full items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Insert column"
                  >
                    <Plus className="size-3.5" />
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0" align="end">
                    <div className="border-b px-3 py-2">
                      <div className="text-xs font-semibold">Insert column</div>
                      <Input
                        className="mt-2 h-7 text-xs"
                        placeholder="Search fields…"
                        value={insertFilter}
                        onChange={(e) => setInsertFilter(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="max-h-72 overflow-auto py-1">
                      {filteredInsertCols.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                          No more fields to add
                        </p>
                      ) : (
                        <>
                          {filteredInsertCols.some((c) => c.group === "core") ? (
                            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Standard
                            </div>
                          ) : null}
                          {filteredInsertCols
                            .filter((c) => c.group === "core")
                            .map((c) => (
                              <button
                                key={c.key}
                                type="button"
                                className="flex w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                                onClick={() => insertColumn(c.key)}
                              >
                                {c.label}
                              </button>
                            ))}
                          {filteredInsertCols.some(
                            (c) => c.group === "custom",
                          ) ? (
                            <div className="mt-1 border-t px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Custom fields
                            </div>
                          ) : null}
                          {filteredInsertCols
                            .filter((c) => c.group === "custom")
                            .map((c) => (
                              <button
                                key={c.key}
                                type="button"
                                className="flex w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                                onClick={() => insertColumn(c.key)}
                              >
                                <span className="truncate">{c.label}</span>
                                {c.label !== customFieldFromColKey(c.key) ? (
                                  <span className="ml-auto pl-2 shrink-0 text-[10px] text-muted-foreground">
                                    {customFieldFromColKey(c.key)}
                                  </span>
                                ) : null}
                              </button>
                            ))}
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((task) => {
              const planId = idToPlanId.get(task.id) ?? task.planRowId ?? "";
              const depth = depthOf(task.id);
              const kids = childrenOf.get(task.id) ?? [];
              const hasKids = kids.length > 0;
              const isCollapsed = collapsed.has(task.id);
              const isSummary =
                Boolean(task.isPhaseScheduleTask) || hasKids;
              const preds = formatPredecessorsGrid(
                task.id,
                dependencies,
                idToPlanId,
              );
              const succs = formatSuccessorsGrid(
                task.id,
                dependencies,
                idToPlanId,
              );
              const pct = Math.max(
                0,
                Math.min(100, task.progressApproved ?? 0),
              );
              const editing =
                edit?.taskId === task.id ? edit.field : null;
              const isDragging = draggingId === task.id;
              const isDropTarget =
                dragOverId === task.id && draggingId !== task.id;
              const rowStyle = {
                height: rowHeight,
              } as React.CSSProperties;
              const cellStyle = {
                paddingTop: cellPadY,
                paddingBottom: cellPadY,
              } as React.CSSProperties;

              const renderCol = (key: ColKey): React.ReactNode => {
                switch (key) {
                  case "id":
                    return (
                      <td
                        key={key}
                        className="sticky left-0 z-10 border-r border-border bg-emerald-50/95 px-1 text-center tabular-nums text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
                        style={{
                          ...cellStyle,
                          width: colWidths.id,
                          minWidth: colWidths.id,
                          left: 0,
                        }}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          {canEdit ? (
                            <span
                              draggable
                              title="Drag to reorder"
                              className="inline-flex cursor-grab text-emerald-800/70 active:cursor-grabbing dark:text-emerald-200/70"
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", task.id);
                                setDraggingId(task.id);
                              }}
                              onDragEnd={() => {
                                setDraggingId(null);
                                setDragOverId(null);
                              }}
                            >
                              <GripVertical className="size-3.5" />
                            </span>
                          ) : null}
                          <span>{planId}</span>
                        </div>
                      </td>
                    );
                  case "name":
                    return (
                      <td
                        key={key}
                        className="sticky z-10 border-r border-border bg-background px-1"
                        style={{
                          ...cellStyle,
                          width: colWidths.name,
                          minWidth: colWidths.name,
                          left: colWidths.id,
                        }}
                      >
                        <div
                          className="flex h-full items-center gap-0.5 overflow-hidden"
                          style={{ paddingLeft: `${depth * 14}px` }}
                        >
                          {hasKids ? (
                            <button
                              type="button"
                              className="shrink-0 rounded p-0.5 hover:bg-muted"
                              onClick={() => toggleCollapse(task.id)}
                              aria-label={isCollapsed ? "Expand" : "Collapse"}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="size-3.5" />
                              ) : (
                                <ChevronDown className="size-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="inline-block size-3.5 shrink-0" />
                          )}
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate text-left hover:underline"
                            onClick={() => onTaskClick?.(task.id)}
                          >
                            {taskTitle(task) || "—"}
                          </button>
                          {task.isPhaseScheduleTask ? (
                            <span className="ml-1 shrink-0 text-[10px] font-normal uppercase text-muted-foreground">
                              phase
                            </span>
                          ) : null}
                          {task.isScheduleMilestone ? (
                            <span className="ml-1 shrink-0 text-[10px] font-normal uppercase text-muted-foreground">
                              ms
                            </span>
                          ) : null}
                        </div>
                      </td>
                    );
                  case "baselineStart":
                    return (
                      <td
                        key={key}
                        className="overflow-hidden border-r border-border px-2 whitespace-nowrap text-muted-foreground"
                        style={cellStyle}
                      >
                        {formatDay(task.baselineStart)}
                      </td>
                    );
                  case "baselineFinish":
                    return (
                      <td
                        key={key}
                        className="overflow-hidden border-r border-border px-2 whitespace-nowrap text-muted-foreground"
                        style={cellStyle}
                      >
                        {formatDay(task.baselineEnd)}
                      </td>
                    );
                  case "baselineDuration":
                    return (
                      <td
                        key={key}
                        className="overflow-hidden border-r border-border px-2 whitespace-nowrap text-muted-foreground tabular-nums"
                        style={cellStyle}
                      >
                        {baselineDurationLabel(task)}
                      </td>
                    );
                  case "start":
                    return (
                      <EditableCell
                        key={key}
                        active={editing === "startDate"}
                        display={formatDay(task.startDate)}
                        style={cellStyle}
                        rowHeight={rowHeight}
                        onStart={() =>
                          beginEdit(
                            task.id,
                            "startDate",
                            toDateInput(task.startDate),
                          )
                        }
                      >
                        <Input
                          autoFocus
                          type="date"
                          className="h-7 text-xs"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => void saveField()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveField();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      </EditableCell>
                    );
                  case "finish":
                    return (
                      <EditableCell
                        key={key}
                        active={editing === "endDate"}
                        display={formatDay(task.endDate)}
                        style={cellStyle}
                        rowHeight={rowHeight}
                        onStart={() =>
                          beginEdit(
                            task.id,
                            "endDate",
                            toDateInput(task.endDate),
                          )
                        }
                      >
                        <Input
                          autoFocus
                          type="date"
                          className="h-7 text-xs"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => void saveField()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveField();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      </EditableCell>
                    );
                  case "duration":
                    return (
                      <EditableCell
                        key={key}
                        active={editing === "durationDays"}
                        display={durationLabel(task)}
                        style={cellStyle}
                        rowHeight={rowHeight}
                        onStart={() =>
                          beginEdit(
                            task.id,
                            "durationDays",
                            String(task.durationDays ?? ""),
                          )
                        }
                      >
                        <Input
                          autoFocus
                          className="h-7 text-xs"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => void saveField()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveField();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      </EditableCell>
                    );
                  case "predecessors":
                    return (
                      <td
                        key={key}
                        className="overflow-hidden border-r border-border px-1"
                        style={cellStyle}
                      >
                        <LinkCell
                          display={preds}
                          active={editing === "predecessors"}
                          canEdit={canEdit}
                          draft={draft}
                          setDraft={setDraft}
                          rowHeight={rowHeight}
                          onStart={() =>
                            beginEdit(task.id, "predecessors", preds)
                          }
                          onSave={() => void saveField()}
                          onCancel={cancelEdit}
                          picker={
                            <DepTreePicker
                              currentTaskId={task.id}
                              mode="predecessors"
                              rows={flatUnique}
                              idToPlanId={idToPlanId}
                              selectedIds={dependencies
                                .filter((d) => d.successorId === task.id)
                                .map((d) => d.predecessorId)}
                              onApply={(ids) =>
                                void applyLinkPicker(
                                  task.id,
                                  "predecessors",
                                  ids,
                                )
                              }
                            />
                          }
                        />
                      </td>
                    );
                  case "percent":
                    return (
                      <EditableCell
                        key={key}
                        active={editing === "progressApproved"}
                        display={`${pct}%`}
                        style={cellStyle}
                        rowHeight={rowHeight}
                        onStart={() =>
                          beginEdit(
                            task.id,
                            "progressApproved",
                            String(pct),
                          )
                        }
                      >
                        <Input
                          autoFocus
                          type="number"
                          min={0}
                          max={100}
                          className="h-7 text-xs"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => void saveField()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveField();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      </EditableCell>
                    );
                  case "successors":
                    return (
                      <td
                        key={key}
                        className="overflow-hidden border-r border-border px-1"
                        style={cellStyle}
                      >
                        <LinkCell
                          display={succs}
                          active={editing === "successors"}
                          canEdit={canEdit}
                          draft={draft}
                          setDraft={setDraft}
                          rowHeight={rowHeight}
                          onStart={() =>
                            beginEdit(task.id, "successors", succs)
                          }
                          onSave={() => void saveField()}
                          onCancel={cancelEdit}
                          picker={
                            <DepTreePicker
                              currentTaskId={task.id}
                              mode="successors"
                              rows={flatUnique}
                              idToPlanId={idToPlanId}
                              selectedIds={dependencies
                                .filter((d) => d.predecessorId === task.id)
                                .map((d) => d.successorId)}
                              onApply={(ids) =>
                                void applyLinkPicker(
                                  task.id,
                                  "successors",
                                  ids,
                                )
                              }
                            />
                          }
                        />
                      </td>
                    );
                  case "resources":
                    return (
                      <td
                        key={key}
                        className="overflow-hidden border-r border-border px-2 truncate"
                        style={cellStyle}
                        title={
                          task.resourceNames || task.owner?.displayName || ""
                        }
                      >
                        {task.resourceNames || task.owner?.displayName || ""}
                      </td>
                    );
                  case "taskMode":
                    return (
                      <td
                        key={key}
                        className="overflow-hidden border-r border-border px-2 text-muted-foreground"
                        style={cellStyle}
                        title="Preserved for MSP export (not editable in PMO)"
                      >
                        {task.mspTaskMode === "Auto" ? "Auto" : "Manual"}
                      </td>
                    );
                  case "constraintType":
                    return (
                      <td
                        key={key}
                        className="overflow-hidden border-r border-border px-2"
                        style={cellStyle}
                        title={task.mspConstraintType ?? "ASAP"}
                      >
                        {CONSTRAINT_LABELS[
                          (task.mspConstraintType || "ASAP").toUpperCase()
                        ] ??
                          task.mspConstraintType ??
                          "As Soon As Possible"}
                      </td>
                    );
                  case "constraintDate": {
                    const code = (
                      task.mspConstraintType || "ASAP"
                    ).toUpperCase();
                    const label =
                      code === "ASAP" || code === "ALAP"
                        ? "NA"
                        : task.mspConstraintDate
                          ? formatDay(task.mspConstraintDate)
                          : "NA";
                    return (
                      <td
                        key={key}
                        className="overflow-hidden border-r border-border px-2 whitespace-nowrap text-muted-foreground"
                        style={cellStyle}
                      >
                        {label}
                      </td>
                    );
                  }
                  case "notes":
                    return (
                      <EditableCell
                        key={key}
                        active={editing === "description"}
                        display={task.description?.trim() || ""}
                        style={cellStyle}
                        rowHeight={rowHeight}
                        onStart={() =>
                          beginEdit(
                            task.id,
                            "description",
                            task.description ?? "",
                          )
                        }
                      >
                        <Input
                          autoFocus
                          className="h-7 text-xs"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => void saveField()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveField();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      </EditableCell>
                    );
                  case "variance":
                    return (
                      <td
                        key={key}
                        className="overflow-hidden px-2 tabular-nums"
                        style={cellStyle}
                      >
                        {durationVarianceLabel(task)}
                      </td>
                    );
                  default: {
                    const fieldName = customFieldFromColKey(key);
                    if (!fieldName) return null;
                    const value = customValue(task, fieldName);
                    const editKey = `custom:${fieldName}` as EditField;
                    return (
                      <EditableCell
                        key={key}
                        active={editing === editKey}
                        display={value}
                        style={cellStyle}
                        rowHeight={rowHeight}
                        onStart={() => beginEdit(task.id, editKey, value)}
                      >
                        <Input
                          autoFocus
                          className="h-7 text-xs"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => void saveField()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveField();
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      </EditableCell>
                    );
                  }
                }
              };

              return (
                <tr
                  key={task.id}
                  style={rowStyle}
                  className={cn(
                    "border-b border-border/70 hover:bg-muted/40",
                    isSummary && "font-semibold bg-sky-50/40 dark:bg-sky-950/20",
                    isDragging && "opacity-50",
                    isDropTarget && "border-t-2 border-t-primary",
                  )}
                  onDragOver={(e) => {
                    if (!canEdit || !draggingId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverId !== task.id) setDragOverId(task.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverId === task.id) setDragOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void onRowDrop(task.id);
                  }}
                >
                  {colLabels.map(({ key }) => renderCol(key))}
                  <td
                    className="sticky right-0 z-10 border-l border-border bg-background"
                    style={{
                      ...cellStyle,
                      width: INSERT_COL_WIDTH,
                      minWidth: INSERT_COL_WIDTH,
                    }}
                  />
                </tr>
              );
            })}

          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditableCell({
  active,
  display,
  onStart,
  children,
  className,
  style,
  rowHeight = 28,
}: {
  active: boolean;
  display: string;
  onStart: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  rowHeight?: number;
}) {
  return (
    <td
      className={cn(
        "overflow-hidden border-r border-border px-1 whitespace-nowrap",
        className,
      )}
      style={style}
      onDoubleClick={onStart}
    >
      {active ? (
        children
      ) : (
        <button
          type="button"
          className="block w-full truncate rounded px-1 text-left hover:bg-muted/60"
          style={{ height: Math.max(18, rowHeight - 8) }}
          onClick={onStart}
        >
          {display || (
            <span className="text-muted-foreground/40">&nbsp;</span>
          )}
        </button>
      )}
    </td>
  );
}

function LinkCell({
  display,
  active,
  canEdit,
  draft,
  setDraft,
  onStart,
  onSave,
  onCancel,
  picker,
  rowHeight = 28,
}: {
  display: string;
  active: boolean;
  canEdit: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onStart: () => void;
  onSave: () => void;
  onCancel: () => void;
  picker: React.ReactNode;
  rowHeight?: number;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {active ? (
        <Input
          autoFocus
          className="h-7 flex-1 font-mono text-[11px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={onSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="3,5FS+2d"
        />
      ) : (
        <button
          type="button"
          className="min-w-0 flex-1 truncate rounded px-1 text-left font-mono text-[11px] hover:bg-muted/60"
          style={{ height: Math.max(18, rowHeight - 8) }}
          onClick={canEdit ? onStart : undefined}
        >
          {display || (
            <span className="text-muted-foreground/40">&nbsp;</span>
          )}
        </button>
      )}
      {canEdit ? picker : null}
    </div>
  );
}

/** MS Project–style checklist of plan IDs for predecessors / successors. */
function DepTreePicker({
  currentTaskId,
  mode,
  rows,
  idToPlanId,
  selectedIds,
  onApply,
}: {
  currentTaskId: string;
  mode: "predecessors" | "successors";
  rows: Task[];
  idToPlanId: Map<string, number>;
  selectedIds: string[];
  onApply: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(selectedIds));

  const sorted = useMemo(() => {
    return [...rows]
      .filter((t) => t.id !== currentTaskId)
      .sort(
        (a, b) =>
          (idToPlanId.get(a.id) ?? 0) - (idToPlanId.get(b.id) ?? 0),
      );
  }, [rows, currentTaskId, idToPlanId]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setPicked(new Set(selectedIds));
      }}
    >
      <PopoverTrigger
        className="inline-flex size-6 shrink-0 items-center justify-center rounded hover:bg-muted"
        title={
          mode === "predecessors" ? "Pick predecessors" : "Pick successors"
        }
      >
        ▾
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b px-3 py-2 text-xs font-semibold">
          {mode === "predecessors" ? "Predecessors" : "Successors"}
        </div>
        <div className="max-h-64 overflow-auto p-2">
          {sorted.map((t) => {
            const planId = idToPlanId.get(t.id);
            const checked = picked.has(t.id);
            const depth = (() => {
              let d = 0;
              let p = t.parentTaskId;
              const seen = new Set<string>();
              while (p && !seen.has(p)) {
                seen.add(p);
                d += 1;
                p = rows.find((r) => r.id === p)?.parentTaskId ?? null;
              }
              return d;
            })();
            return (
              <label
                key={t.id}
                className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-muted/50"
                style={{ paddingLeft: `${4 + depth * 12}px` }}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(t.id);
                      else next.delete(t.id);
                      return next;
                    });
                  }}
                />
                <span className="min-w-0 text-xs">
                  <span className="mr-1.5 tabular-nums text-muted-foreground">
                    {planId}
                  </span>
                  {taskTitle(t)}
                </span>
              </label>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 border-t px-2 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onApply([...picked]);
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
