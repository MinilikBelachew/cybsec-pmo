"use client";

import React, { useRef, useState, useMemo } from "react";
import { cn } from "@/shared/utils/cn";
import { ChevronDown, ChevronRight, Circle, CircleCheck, ZoomIn, ZoomOut } from "lucide-react";
import { type ProjectPhase, type ProjectMilestone } from "../../../types/projects.types";
import { type TaskDependency } from "../../../types/tasks.types";
import {
  type GanttTaskRow,
  type GanttTaskStatus,
  nestedDepthLabel,
} from "../../../utils/map-task-to-gantt";
import { comparePlanOrderAsc } from "../../../utils/task-export-fields";

type Status = GanttTaskStatus;

/** Min bar width (px) to fit the task name inside the bar. */
const LABEL_INSIDE_MIN_PX = 72;

interface GanttViewProps {
  tasks: GanttTaskRow[];
  dependencies?: TaskDependency[];
  toggleTask: (taskId: string) => void;
  ganttZoom?: number;
  setGanttZoom?: React.Dispatch<React.SetStateAction<number>>;
  phases?: ProjectPhase[];
  milestones?: ProjectMilestone[];
  onTaskClick?: (taskId: string) => void;
}

function toLocalMidnight(dateInput: Date | string | null | undefined): Date | null {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function compareGanttPlanOrder(a: GanttTaskRow, b: GanttTaskRow): number {
  return comparePlanOrderAsc(
    { createdAt: a.createdAt, startDate: a.rawStartDate, title: a.name },
    { createdAt: b.createdAt, startDate: b.rawStartDate, title: b.name },
  );
}

function spanFromRows(rows: GanttTaskRow[]): { startDate: string; endDate: string } | null {
  const starts: Date[] = [];
  const ends: Date[] = [];
  const walk = (row: GanttTaskRow) => {
    const start = toLocalMidnight(row.rawStartDate);
    const end = toLocalMidnight(row.rawEndDate);
    if (start) starts.push(start);
    if (end) ends.push(end);
    row.children?.forEach(walk);
  };
  rows.forEach(walk);
  if (starts.length === 0 && ends.length === 0) return null;
  const minMs = Math.min(...(starts.length ? starts : ends).map((d) => d.getTime()));
  const maxMs = Math.max(...(ends.length ? ends : starts).map((d) => d.getTime()));
  return {
    startDate: new Date(minMs).toISOString(),
    endDate: new Date(maxMs).toISOString(),
  };
}

function isGanttTaskOverdue(task: GanttTaskRow): boolean {
  if (task.done || task.status === "Done" || task.status === "Approved") return false;
  const end = toLocalMidnight(task.rawEndDate);
  if (!end) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today;
}

const STATUS_CONFIG: Record<Status, { bgClass: string; textClass: string; label: string }> = {
  "To_Do": {
    bgClass: "bg-muted/50 border-border/50 text-foreground",
    textClass: "text-foreground",
    label: "To Do",
  },
  "In_Progress": {
    bgClass: "bg-blue-50/80 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300",
    textClass: "text-blue-700 dark:text-blue-300",
    label: "In Progress",
  },
  "Submitted_for_Review": {
    bgClass: "bg-amber-50/80 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/60 text-amber-750 dark:text-amber-300",
    textClass: "text-amber-750 dark:text-amber-300",
    label: "Submitted for Review",
  },
  "Approved": {
    bgClass: "bg-teal-50/80 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800/60 text-teal-700 dark:text-teal-300",
    textClass: "text-teal-700 dark:text-teal-300",
    label: "Approved",
  },
  "Rework": {
    bgClass: "bg-rose-50/80 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300",
    textClass: "text-rose-700 dark:text-rose-300",
    label: "Rework",
  },
  "Done": {
    bgClass: "bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300",
    textClass: "text-emerald-700 dark:text-emerald-300",
    label: "Done",
  },
};

type GanttScale = "day" | "month" | "quarter";

const SCALE_PX_PER_DAY: Record<GanttScale, number> = {
  day: 44,
  month: 8,
  quarter: 3,
};

const SCALE_OPTIONS: { id: GanttScale; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
];

type HeaderBand = { key: string; label: string; days: number; offset: number };

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfQuarter(date: Date): Date {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function endOfQuarter(date: Date): Date {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3 + 3, 0);
}

function dayDelta(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

export function GanttView({
  tasks,
  dependencies = [],
  toggleTask,
  ganttZoom,
  setGanttZoom,
  phases = [],
  milestones = [],
  onTaskClick,
}: GanttViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [localZoom, setLocalZoom] = useState(1);
  const [scale, setScale] = useState<GanttScale>("day");
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});
  const [expandedParents, setExpandedParents] = useState<Set<string>>(() => new Set());

  const zoom = ganttZoom ?? localZoom;
  const setZoom = setGanttZoom ?? setLocalZoom;
  const minZoom = scale === "day" ? 0.5 : 0.25;
  const maxZoom = scale === "day" ? 2 : 4;

  const colW = Math.max(1, SCALE_PX_PER_DAY[scale] * zoom);

  const togglePhase = (phaseId: string) => {
    setOpenPhases((prev) => ({
      ...prev,
      [phaseId]: prev[phaseId] === false ? true : false,
    }));
  };

  const toggleParentExpand = (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Expand parents that have children by default (ClickUp-style tree).
  React.useEffect(() => {
    const ids: string[] = [];
    const walk = (t: GanttTaskRow) => {
      if ((t.children?.length ?? 0) > 0) ids.push(t.id);
      for (const c of t.children ?? []) walk(c);
    };
    for (const t of tasks) walk(t);
    if (ids.length === 0) return;
    setExpandedParents((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tasks]);

  function visibleTaskRows(phaseTasks: GanttTaskRow[]): GanttTaskRow[] {
    const rows: GanttTaskRow[] = [];
    const walk = (task: GanttTaskRow, depth: number) => {
      rows.push({ ...task, depth });
      if (expandedParents.has(task.id) && task.children?.length) {
        for (const child of task.children) walk(child, depth + 1);
      }
    };
    for (const task of phaseTasks) walk(task, 0);
    return rows;
  }

  // Group data by phase (plan order: phase.orderIndex, then import plan order within phase)
  const groupedData = useMemo(() => {
    const sortedPhases = [...phases].sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      if (!a.startDate && !b.startDate) return a.name.localeCompare(b.name);
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;

      const diff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      if (diff !== 0) return diff;

      if (!a.endDate && !b.endDate) return a.name.localeCompare(b.name);
      if (!a.endDate) return 1;
      if (!b.endDate) return -1;

      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    });

    const mapped: Array<{
      id: string;
      name: string;
      color: string;
      startDate: string | null;
      endDate: string | null;
      tasks: GanttTaskRow[];
      milestones: typeof milestones;
    }> = sortedPhases.map((phase) => {
      const phaseTasks = tasks
        .filter((t) => t.phaseId === phase.id)
        .sort(compareGanttPlanOrder);
      const phaseMilestones = milestones.filter((m) => m.phaseId === phase.id);
      return {
        id: phase.id,
        name: phase.name,
        color: "#8b5cf6",
        startDate: phase.startDate,
        endDate: phase.endDate,
        tasks: phaseTasks,
        milestones: phaseMilestones,
      };
    });

    const unassignedTasks = tasks
      .filter((t) => !t.phaseId)
      .sort(compareGanttPlanOrder);
    const unassignedMilestones = milestones.filter((m) => !m.phaseId);

    if (unassignedTasks.length > 0 || unassignedMilestones.length > 0) {
      const bounds = spanFromRows(unassignedTasks);
      mapped.push({
        id: "unassigned",
        name: "Unassigned Tasks & Milestones",
        color: "#64748b",
        startDate: bounds?.startDate ?? null,
        endDate: bounds?.endDate ?? null,
        tasks: unassignedTasks,
        milestones: unassignedMilestones,
      });
    }

    return mapped;
  }, [phases, tasks, milestones]);

  // Compute dynamic timeline date range based on actual project tasks, phases, and milestones
  const dateRange = useMemo(() => {
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    const parseAndCompare = (dateStr: string | null | undefined) => {
      if (!dateStr) return;
      const date = toLocalMidnight(dateStr);
      if (!date) return;
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    };

    // Tasks dates (include nested sub / sub-sub)
    const walkDates = (row: GanttTaskRow) => {
      parseAndCompare(row.rawStartDate);
      parseAndCompare(row.rawEndDate);
      row.children?.forEach(walkDates);
    };
    tasks.forEach(walkDates);

    // Phases dates
    phases.forEach((p) => {
      parseAndCompare(p.startDate);
      parseAndCompare(p.endDate);
    });

    // Milestones dates
    milestones.forEach((m) => {
      parseAndCompare(m.targetDate);
    });

    // Fallbacks if no dates exist
    if (!minDate) {
      minDate = new Date();
      minDate.setHours(0, 0, 0, 0);
    }
    if (!maxDate) {
      maxDate = new Date(minDate.getTime() + 28 * 24 * 60 * 60 * 1000);
      maxDate.setHours(0, 0, 0, 0);
    }

    // Align range to the selected scale
    let alignedStart = new Date(minDate);
    let alignedEnd = new Date(maxDate);
    if (scale === "month") {
      alignedStart = startOfMonth(alignedStart);
      alignedEnd = endOfMonth(alignedEnd);
    } else if (scale === "quarter") {
      alignedStart = startOfQuarter(alignedStart);
      alignedEnd = endOfQuarter(alignedEnd);
    } else {
      const day = alignedStart.getDay();
      const diff = alignedStart.getDate() - day + (day === 0 ? -6 : 1);
      alignedStart.setDate(diff);
      alignedStart.setHours(0, 0, 0, 0);

      const endDay = alignedEnd.getDay();
      const endDiff = alignedEnd.getDate() + (endDay === 0 ? 0 : 7 - endDay);
      alignedEnd.setDate(endDiff);
      alignedEnd.setHours(0, 0, 0, 0);
    }

    const minSpan = scale === "day" ? 28 : scale === "month" ? 60 : 90;
    const totalDays = Math.max(
      minSpan,
      Math.round((alignedEnd.getTime() - alignedStart.getTime()) / 86400000) + 1,
    );

    return {
      projectStart: alignedStart,
      totalDays,
    };
  }, [tasks, phases, milestones, scale]);

  const headerBands = useMemo(() => {
    const top: HeaderBand[] = [];
    const bottom: HeaderBand[] = [];
    const ticks: number[] = [];
    const rangeEnd = addDays(dateRange.projectStart, dateRange.totalDays);

    if (scale === "day") {
      const totalWeeks = Math.ceil(dateRange.totalDays / 7);
      const DAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
      for (let w = 0; w < totalWeeks; w++) {
        const weekStart = addDays(dateRange.projectStart, w * 7);
        const weekNum = getWeekNumber(weekStart);
        const daysInWeek = Math.min(7, dateRange.totalDays - w * 7);
        top.push({
          key: `w-${w}`,
          label: `W${weekNum} ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          days: daysInWeek,
          offset: w * 7,
        });
        for (let d = 0; d < daysInWeek; d++) {
          const date = addDays(weekStart, d);
          const offset = w * 7 + d;
          bottom.push({
            key: `d-${offset}`,
            label: `${DAY_ABBR[date.getDay()]} ${date.getDate()}`,
            days: 1,
            offset,
          });
          ticks.push(offset + 1);
        }
      }
      return { top, bottom, ticks };
    }

    if (scale === "month") {
      let cursor = new Date(dateRange.projectStart);
      while (cursor < rangeEnd) {
        const monthStart = cursor;
        const next = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
        const segmentEnd = next < rangeEnd ? next : rangeEnd;
        const days = Math.max(1, dayDelta(monthStart, segmentEnd));
        const offset = dayDelta(dateRange.projectStart, monthStart);
        bottom.push({
          key: `m-${monthStart.getFullYear()}-${monthStart.getMonth()}`,
          label: monthStart.toLocaleDateString("en-US", { month: "short" }),
          days,
          offset,
        });
        ticks.push(offset + days);
        cursor = next;
      }
      let yearCursor = 0;
      while (yearCursor < bottom.length) {
        const bandYear = addDays(dateRange.projectStart, bottom[yearCursor].offset).getFullYear();
        let days = 0;
        let count = 0;
        while (
          yearCursor + count < bottom.length &&
          addDays(dateRange.projectStart, bottom[yearCursor + count].offset).getFullYear() ===
            bandYear
        ) {
          days += bottom[yearCursor + count].days;
          count += 1;
        }
        top.push({
          key: `y-${bandYear}-${yearCursor}`,
          label: String(bandYear),
          days,
          offset: bottom[yearCursor].offset,
        });
        yearCursor += count;
      }
      return { top, bottom, ticks };
    }

    let cursor = new Date(dateRange.projectStart);
    while (cursor < rangeEnd) {
      const qStart = cursor;
      const next = new Date(qStart.getFullYear(), Math.floor(qStart.getMonth() / 3) * 3 + 3, 1);
      const segmentEnd = next < rangeEnd ? next : rangeEnd;
      const days = Math.max(1, dayDelta(qStart, segmentEnd));
      const offset = dayDelta(dateRange.projectStart, qStart);
      const q = Math.floor(qStart.getMonth() / 3) + 1;
      bottom.push({
        key: `q-${qStart.getFullYear()}-${q}`,
        label: `Q${q}`,
        days,
        offset,
      });
      ticks.push(offset + days);
      cursor = next;
    }
    let yearCursor = 0;
    while (yearCursor < bottom.length) {
      const bandYear = addDays(dateRange.projectStart, bottom[yearCursor].offset).getFullYear();
      let days = 0;
      let count = 0;
      while (
        yearCursor + count < bottom.length &&
        addDays(dateRange.projectStart, bottom[yearCursor + count].offset).getFullYear() ===
          bandYear
      ) {
        days += bottom[yearCursor + count].days;
        count += 1;
      }
      top.push({
        key: `y-${bandYear}-${yearCursor}`,
        label: String(bandYear),
        days,
        offset: bottom[yearCursor].offset,
      });
      yearCursor += count;
    }
    return { top, bottom, ticks };
  }, [dateRange, scale]);

  // Compute Today offset
  const todayOffset = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const projectStart = new Date(dateRange.projectStart);
    projectStart.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - projectStart.getTime();
    const diffDays = Math.round(diffTime / 86400000);
    if (diffDays >= 0 && diffDays < dateRange.totalDays) {
      return diffDays;
    }
    return -1;
  }, [dateRange]);

  const getMilestoneOffset = (targetDateStr: string) => {
    const date = toLocalMidnight(targetDateStr);
    if (!date) return 0;
    const diffTime = date.getTime() - dateRange.projectStart.getTime();
    const diffDays = Math.round(diffTime / 86400000);
    return Math.max(0, Math.min(dateRange.totalDays - 1, diffDays));
  };

  const getGanttDates = (task: GanttTaskRow, index: number) => {
    let start = toLocalMidnight(task.rawStartDate);
    let end = toLocalMidnight(task.rawEndDate);

    if (task.children?.length) {
      const rolled = spanFromRows([task]);
      if (rolled) {
        start = toLocalMidnight(rolled.startDate) ?? start;
        end = toLocalMidnight(rolled.endDate) ?? end;
      }
    }

    // Fallback if one date is missing but the other is present
    if (!start && end) {
      start = end;
    } else if (start && !end) {
      end = start;
    } else if (!start && !end && task.dueDate) {
      const due = toLocalMidnight(task.dueDate);
      if (due) {
        start = due;
        end = due;
      }
    }

    if (start && end) {
      const projectStart = dateRange.projectStart;
      
      const diffStart = start.getTime() - projectStart.getTime();
      const diffEnd = end.getTime() - projectStart.getTime();
      
      const startDay = Math.max(0, Math.round(diffStart / 86400000));
      const durationDays = Math.max(1, Math.round((diffEnd - diffStart) / 86400000) + 1);
      return { startDay, durationDays, hasDates: true };
    }

    // Fallback mock schedule
    const startDay = (index * 2) % 15;
    const durationDays = Math.max(1, 3 + (index % 5));
    return { startDay, durationDays, hasDates: false };
  };

  const spanFromDates = (startStr?: string | null, endStr?: string | null) => {
    let start = toLocalMidnight(startStr);
    let end = toLocalMidnight(endStr);
    if (!start && end) start = end;
    else if (start && !end) end = start;
    if (!start || !end) return null;
    const startDay = Math.max(
      0,
      Math.round((start.getTime() - dateRange.projectStart.getTime()) / 86400000),
    );
    const durationDays = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
    );
    return { startDay, durationDays };
  };

  const { taskLayout, totalTimelineRows } = useMemo(() => {
    const layout = new Map<
      string,
      { row: number; startDay: number; durationDays: number; isCritical: boolean; hasDates: boolean }
    >();
    let row = 0;

    for (const group of groupedData) {
      row += 1;
      const isExpanded = openPhases[group.id] !== false;
      if (!isExpanded) continue;

      visibleTaskRows(group.tasks).forEach((task, idx) => {
        const dates = getGanttDates(task, idx);
        layout.set(task.id, {
          row,
          startDay: dates.startDay,
          durationDays: dates.durationDays,
          isCritical: Boolean(task.isOnCriticalPath),
          hasDates: dates.hasDates,
        });
        row += 1;
      });
    }

    return { taskLayout: layout, totalTimelineRows: row };
  }, [groupedData, openPhases, expandedParents, dateRange]);

  const dependencyArrows = useMemo(() => {
    return dependencies
      .map((dep) => {
        const pred = taskLayout.get(dep.predecessorId);
        const succ = taskLayout.get(dep.successorId);
        if (!pred || !succ || !pred.hasDates || !succ.hasDates) {
          return null;
        }

        const x1 = (pred.startDay + pred.durationDays) * colW - 2;
        const x2 = succ.startDay * colW + 2;
        const y1 = pred.row * 36 + 18;
        const y2 = succ.row * 36 + 18;
        const isCritical = pred.isCritical && succ.isCritical;
        const midX = (x1 + x2) / 2;

        return {
          id: dep.id,
          path: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
          isCritical,
          depType: dep.depType,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      path: string;
      isCritical: boolean;
      depType: string;
    }>;
  }, [dependencies, taskLayout, colW]);

  const scrollToToday = () => {
    if (scrollRef.current) {
      const targetOffset = todayOffset >= 0 ? todayOffset : Math.floor(dateRange.totalDays / 2);
      const todayPosition = targetOffset * colW + colW / 2;
      const containerWidth = scrollRef.current.clientWidth;
      const timelineVisibleWidth = containerWidth - 256;
      scrollRef.current.scrollLeft = Math.max(0, todayPosition - timelineVisibleWidth / 2);
    }
  };

  const handleAutoFit = () => {
    if (scrollRef.current) {
      const containerWidth = scrollRef.current.clientWidth;
      const timelineVisibleWidth = containerWidth - 256;
      const base = SCALE_PX_PER_DAY[scale];
      const fitZoom = Math.max(
        minZoom,
        Math.min(maxZoom, timelineVisibleWidth / (dateRange.totalDays * base)),
      );
      setZoom(fitZoom);
    }
  };

  const handleScaleChange = (next: GanttScale) => {
    setScale(next);
    setZoom(1);
  };

  const scrollTimeline = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = colW * (scale === "day" ? 7 : scale === "month" ? 30 : 90);
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Scroll to today on initial mount
  React.useEffect(() => {
    const timer = setTimeout(() => {
      scrollToToday();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      {/* Gantt toolbar */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-border/50 shrink-0 bg-transparent">
        <button
          onClick={() => scrollTimeline("left")}
          className="p-1.5 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          title="Scroll Left"
        >
          <ChevronRight className="size-3.5 rotate-180" />
        </button>
        <button
          onClick={() => scrollTimeline("right")}
          className="p-1.5 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer mr-1"
          title="Scroll Right"
        >
          <ChevronRight className="size-3.5" />
        </button>
        <button
          onClick={scrollToToday}
          className="px-3 py-1 rounded-lg border border-border/60 text-xs font-semibold hover:bg-muted/50 transition-colors cursor-pointer"
        >
          Today
        </button>
        <div className="flex overflow-hidden rounded-lg border border-border/60">
          {SCALE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleScaleChange(option.id)}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer",
                scale === option.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleAutoFit}
          className="px-3 py-1 rounded-lg border border-border/60 text-xs font-semibold hover:bg-muted/50 transition-colors cursor-pointer"
        >
          Auto fit
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(minZoom, z - 0.25))}
            className="p-1.5 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(maxZoom, z + 0.25))}
            className="p-1.5 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ZoomIn className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Main gantt area */}
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <div className="flex min-h-full" style={{ width: 256 + dateRange.totalDays * colW + "px" }}>
          {/* Left: task list */}
          <div className="w-64 shrink-0 border-r border-border/50 flex flex-col bg-white dark:bg-slate-900 sticky left-0 z-30">
            {/* Header */}
            <div className="flex items-center justify-between px-3 border-b border-border/50 bg-white dark:bg-slate-900 sticky top-0 z-40 h-[56px] shrink-0">
              <span className="text-xs font-semibold text-muted-foreground">Name</span>
            </div>

            {/* Task rows */}
            <div className="flex-1">
              {groupedData.map((group) => {
                const isExpanded = openPhases[group.id] !== false;
                return (
                  <React.Fragment key={group.id}>
                    {/* Phase row */}
                    <div
                      className="flex items-center gap-2 px-3 border-b border-border/30 hover:bg-muted/30 cursor-pointer select-none shrink-0"
                      onClick={() => togglePhase(group.id)}
                      style={{ height: 36 }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="text-xs font-bold truncate flex-1 uppercase tracking-wide text-slate-700 dark:text-slate-200">
                        {group.name}
                      </span>
                    </div>

                    {isExpanded &&
                      visibleTaskRows(group.tasks).map((task) => {
                        const depth = task.depth ?? (task.parentTaskId ? 1 : 0);
                        const hasChildren = Boolean(task.children?.length);
                        const isParentExpanded = expandedParents.has(task.id);
                        return (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 px-3 border-b border-border/20 hover:bg-muted/20 cursor-pointer group shrink-0"
                          onClick={() => onTaskClick?.(task.id)}
                          style={{ height: 36 }}
                        >
                          <div
                            className="w-3.5 shrink-0 flex items-center justify-center"
                            style={{ marginLeft: Math.min(depth, 10) * 12 }}
                          >
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={(e) => toggleParentExpand(task.id, e)}
                                className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                              >
                                {isParentExpanded ? (
                                  <ChevronDown className="size-3" />
                                ) : (
                                  <ChevronRight className="size-3" />
                                )}
                              </button>
                            ) : depth > 0 ? (
                              <span className="size-1 rounded-full bg-muted-foreground/40" />
                            ) : null}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTask(task.id);
                            }}
                          >
                            {task.done ? (
                              <CircleCheck className="size-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="size-3.5 text-muted-foreground shrink-0" />
                            )}
                          </button>
                          <span
                            className={cn(
                              "text-xs truncate flex-1",
                              hasChildren && "font-semibold",
                              task.done && "line-through text-muted-foreground",
                            )}
                          >
                            {hasChildren && depth === 0 && (
                              <span className="mr-1 text-[9px] font-semibold uppercase text-muted-foreground">
                                Sum
                              </span>
                            )}
                            {depth > 0 && nestedDepthLabel(depth) && (
                              <span className="mr-1 text-[9px] font-semibold uppercase text-muted-foreground">
                                {nestedDepthLabel(depth)}
                              </span>
                            )}
                            {task.name}
                          </span>
                          {isGanttTaskOverdue(task) && (
                            <span
                              className="size-2 shrink-0 rounded-full bg-amber-500"
                              title="Overdue"
                            />
                          )}
                          {task.isOnCriticalPath && (
                            <span
                              className="size-2 shrink-0 rounded-full bg-rose-500"
                              title="Critical path"
                            />
                          )}
                          {task.scheduleImpact?.hasLeaveConflict && (
                            <span
                              className="size-2 shrink-0 rounded-full bg-amber-500"
                              title={
                                task.scheduleImpact.isCritical
                                  ? `Leave conflict · ${task.scheduleImpact.overlapDays}d overlap · ~${task.scheduleImpact.estimatedDelayDays}d projected slip${task.scheduleImpact.hasBackup ? " · backup set" : " · no backup"}`
                                  : `Leave overlap · ${task.scheduleImpact.overlapDays}d · ~${task.scheduleImpact.estimatedDelayDays}d slip`
                              }
                            />
                          )}
                        </div>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Right: timeline */}
          <div className="flex-1 relative">
            {/* Scale headers */}
            <div className="flex border-b border-border/50 bg-white dark:bg-slate-900 sticky top-0 z-20" style={{ height: 28 }}>
              {headerBands.top.map((band) => (
                <div
                  key={band.key}
                  className="border-r border-border/30 flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0"
                  style={{ width: band.days * colW }}
                >
                  {band.label}
                </div>
              ))}
            </div>

            <div className="flex border-b border-border/50 bg-white dark:bg-slate-900 sticky top-7 z-20" style={{ height: 28 }}>
              {headerBands.bottom.map((band) => {
                const coversToday =
                  todayOffset >= band.offset && todayOffset < band.offset + band.days;
                return (
                  <div
                    key={band.key}
                    className={cn(
                      "border-r border-border/20 flex items-center justify-center text-[10px] font-medium shrink-0",
                      coversToday
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-muted-foreground",
                    )}
                    style={{ width: band.days * colW }}
                  >
                    {band.label}
                  </div>
                );
              })}
            </div>

            {/* Timeline phase and task bars */}
            {groupedData.map((group) => {
              const isExpanded = openPhases[group.id] !== false;
              return (
                <React.Fragment key={group.id}>
                  {/* Phase timeline row (renders milestones) */}
                  <div className="border-b border-border/30 relative bg-muted/10 dark:bg-white/5" style={{ height: 36 }}>
                    <GridLines ticks={headerBands.ticks} colW={colW} todayOffset={todayOffset} />
                    {(() => {
                      const taskSpan = spanFromRows(group.tasks);
                      const span =
                        spanFromDates(group.startDate, group.endDate) ??
                        (taskSpan
                          ? spanFromDates(taskSpan.startDate, taskSpan.endDate)
                          : null);
                      if (!span) return null;
                      return (
                        <GroupingBar
                          startDay={span.startDay}
                          durationDays={span.durationDays}
                          colW={colW}
                          color={group.color}
                          variant="phase"
                          label={group.name}
                        />
                      );
                    })()}

                    {/* Milestones inside Phase Header Row */}
                    {group.milestones.map((m) => {
                      const dayOffset = getMilestoneOffset(m.targetDate);
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "absolute top-1/2 -translate-y-1/2 size-3.5 rotate-45 border-2 flex items-center justify-center cursor-help shrink-0 shadow-xs hover:scale-125 transition-transform z-20",
                            m.status === "Done"
                              ? "bg-emerald-500 border-white dark:border-slate-900"
                              : "bg-primary border-white dark:border-slate-900"
                          )}
                          style={{ left: dayOffset * colW + colW / 2 - 7 }}
                          title={`Milestone: ${m.title} (${new Date(m.targetDate).toLocaleDateString()})`}
                        />
                      );
                    })}
                  </div>

                  {/* Task rows timeline */}
                  {isExpanded &&
                    visibleTaskRows(group.tasks).map((task, idx) => {
                      const layout = taskLayout.get(task.id);
                      const { startDay, durationDays } =
                        layout ?? getGanttDates(task, idx);
                      const isCritical = layout?.isCritical ?? Boolean(task.isOnCriticalPath);
                      const overdue = isGanttTaskOverdue(task);
                      const depth = task.depth ?? (task.parentTaskId ? 1 : 0);
                      const isSummary = Boolean(task.children?.length);
                      return (
                        <div
                          key={task.id}
                          className="border-b border-border/20 relative hover:bg-muted/10 transition-colors"
                          style={{ height: 36 }}
                        >
                          <GridLines ticks={headerBands.ticks} colW={colW} todayOffset={todayOffset} />

                          {isSummary ? (
                            <div
                              className="absolute top-1/2 z-10 -translate-y-1/2 cursor-pointer"
                              onClick={() => onTaskClick?.(task.id)}
                              style={{ left: startDay * colW + 2 }}
                            >
                              <GroupingBar
                                startDay={0}
                                durationDays={durationDays}
                                colW={colW}
                                color="#475569"
                                variant="summary"
                                label={task.name}
                                relative
                              />
                            </div>
                          ) : (
                            <TaskBar
                              task={task}
                              startDay={startDay}
                              durationDays={durationDays}
                              colW={colW}
                              isCritical={isCritical}
                              overdue={overdue}
                              depth={depth}
                              onClick={() => onTaskClick?.(task.id)}
                            />
                          )}
                        </div>
                      );
                    })}
                </React.Fragment>
              );
            })}
            {dependencyArrows.length > 0 && (
              <svg
                className="pointer-events-none absolute left-0 z-[15]"
                style={{
                  top: 56,
                  width: dateRange.totalDays * colW,
                  height: Math.max(totalTimelineRows * 36, 36),
                }}
              >
                <defs>
                  <marker
                    id="gantt-dep-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 Z" className="fill-slate-400" />
                  </marker>
                  <marker
                    id="gantt-dep-arrow-critical"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 Z" className="fill-rose-500" />
                  </marker>
                </defs>
                {dependencyArrows.map((arrow) => (
                  <path
                    key={arrow.id}
                    d={arrow.path}
                    fill="none"
                    strokeWidth={1.5}
                    markerEnd={
                      arrow.isCritical
                        ? "url(#gantt-dep-arrow-critical)"
                        : "url(#gantt-dep-arrow)"
                    }
                    className={arrow.isCritical ? "stroke-rose-500" : "stroke-slate-400"}
                    opacity={0.85}
                  />
                ))}
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-4 px-5 py-3 border-t border-border/50 bg-slate-50/50 dark:bg-slate-950/20 text-xs font-semibold text-muted-foreground shrink-0 rounded-b-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-md border border-border/50 bg-muted/50" />
          <span>To Do</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-md bg-blue-500 border border-blue-600" />
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-md bg-amber-500 border border-amber-600" />
          <span>Submitted for Review</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-md bg-teal-500 border border-teal-600" />
          <span>Approved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-md bg-rose-500 border border-rose-600" />
          <span>Rework</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-md bg-emerald-500 border border-emerald-600" />
          <span>Done</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-sm bg-violet-500/80" />
          <span>Phase</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative h-2 w-6 rounded-t-sm bg-slate-600">
            <span className="absolute left-0 top-1.5 h-0 w-0 border-x-[3px] border-t-[4px] border-x-transparent border-t-slate-600" />
            <span className="absolute right-0 top-1.5 h-0 w-0 border-x-[3px] border-t-[4px] border-x-transparent border-t-slate-600" />
          </span>
          <span>Summary task</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rotate-45 bg-primary border border-white dark:border-slate-900" />
          <span>Milestone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded border-2 border-rose-500 bg-transparent" />
          <span>Critical path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded border-2 border-amber-500 bg-amber-100" />
          <span>Overdue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-slate-400" />
          <span>Dependency link</span>
        </div>
        {todayOffset >= 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-0.5 h-3.5 bg-rose-400" />
            <span>Today</span>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupingBar({
  startDay,
  durationDays,
  colW,
  color,
  variant,
  label,
  relative = false,
}: {
  startDay: number;
  durationDays: number;
  colW: number;
  color: string;
  variant: "phase" | "summary";
  label: string;
  relative?: boolean;
}) {
  const width = Math.max(durationDays * colW - (relative ? 0 : 4), 12);
  const showLabelOnBar = width > LABEL_INSIDE_MIN_PX;
  const bar = variant === "phase" ? (
    <div
      className="h-2.5 rounded-sm opacity-80"
      style={{ width, backgroundColor: color }}
    />
  ) : (
    <div className="relative" style={{ width }}>
      {showLabelOnBar && (
        <span className="absolute inset-x-1 -top-3.5 truncate text-[9px] font-bold leading-none text-slate-700 dark:text-slate-200 select-none">
          {label}
        </span>
      )}
      <div className="h-2 w-full rounded-t-sm bg-slate-600 dark:bg-slate-400" />
      <div className="absolute left-0 top-1.5 h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-slate-600 dark:border-t-slate-400" />
      <div className="absolute right-0 top-1.5 h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-slate-600 dark:border-t-slate-400" />
    </div>
  );

  const labelBeside = variant === "summary" && !showLabelOnBar && (
    <span
      className="max-w-[160px] truncate text-[9px] font-bold text-slate-700 dark:text-slate-200 select-none"
      title={label}
    >
      {label}
    </span>
  );

  if (relative) {
    return (
      <div className="flex items-center gap-1.5" title={label}>
        {bar}
        {labelBeside}
      </div>
    );
  }

  return (
    <div
      className="absolute top-1/2 z-[8] flex -translate-y-1/2 items-center gap-1.5"
      style={{ left: startDay * colW + 2 }}
      title={label}
    >
      {bar}
      {labelBeside}
    </div>
  );
}

function TaskBar({
  task,
  startDay,
  durationDays,
  colW,
  isCritical,
  overdue,
  depth,
  onClick,
}: {
  task: GanttTaskRow;
  startDay: number;
  durationDays: number;
  colW: number;
  isCritical: boolean;
  overdue: boolean;
  depth: number;
  onClick: () => void;
}) {
  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.To_Do;
  const barWidth = Math.max(durationDays * colW - 4, colW - 4);
  const showLabelInside = barWidth > LABEL_INSIDE_MIN_PX;
  return (
    <div
      className="absolute top-1/2 z-10 flex -translate-y-1/2 cursor-pointer items-center gap-1.5"
      onClick={onClick}
      style={{ left: startDay * colW + 2 }}
    >
      <div
        className={cn(
          "relative flex h-5 items-center overflow-hidden rounded-md border shadow-xs transition-all hover:brightness-95",
          config.bgClass,
          isCritical && "ring-2 ring-rose-500 border-rose-500",
          overdue &&
            !isCritical &&
            "ring-2 ring-amber-500 border-amber-500 bg-amber-100/90 dark:bg-amber-900/35",
          overdue && isCritical && "outline outline-2 outline-offset-1 outline-amber-500",
          depth > 0 && "h-4 opacity-90",
        )}
        style={{ width: barWidth }}
        title={`${task.name} (${config.label})${overdue ? " — Overdue" : ""}${isCritical ? " — Critical path" : ""}${depth > 0 ? " — Sub-task" : ""}`}
      >
        {showLabelInside && (
          <span
            className={cn(
              "absolute left-2.5 z-10 max-w-[85%] truncate text-[9px] font-bold select-none",
              overdue && !isCritical ? "text-amber-900 dark:text-amber-100" : config.textClass,
            )}
          >
            {task.name}
          </span>
        )}
      </div>
      {!showLabelInside && (
        <span
          className={cn(
            "max-w-[160px] truncate whitespace-nowrap text-[9px] font-bold select-none",
            overdue ? "text-amber-700 dark:text-amber-300" : "text-foreground",
          )}
          title={task.name}
        >
          {task.name}
        </span>
      )}
    </div>
  );
}

function GridLines({
  ticks,
  colW,
  todayOffset,
}: {
  ticks: number[];
  colW: number;
  todayOffset: number;
}) {
  return (
    <>
      {ticks.map((offset) => (
        <div
          key={offset}
          className="absolute top-0 bottom-0 border-r border-border/20"
          style={{ left: offset * colW }}
        />
      ))}
      {todayOffset >= 0 && (
        <div
          className="absolute top-0 bottom-0 z-10 w-px bg-rose-400"
          style={{ left: todayOffset * colW + colW / 2 }}
        />
      )}
    </>
  );
}
