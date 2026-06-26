"use client";

import React, { useRef, useState, useMemo } from "react";
import { cn } from "@/shared/utils/cn";
import { ChevronDown, ChevronRight, Plus, Circle, CircleCheck, ZoomIn, ZoomOut } from "lucide-react";

type Status = "To_Do" | "In_Progress" | "Submitted_for_Review" | "Approved" | "Rework" | "Done";
type Priority = "high" | "medium" | "low" | "critical";

import { type ProjectPhase, type ProjectMilestone } from "../../types/projects.types";

interface Task {
  id: string;
  name: string;
  assigneeColor: string;
  dueDate: string;
  priority: Priority;
  status: Status;
  hasSubtasks?: boolean;
  done: boolean;
  phaseId?: string | null;
  phaseName?: string;
  phaseColor?: string;
  rawStartDate?: string | null;
  rawEndDate?: string | null;
}

interface GanttViewProps {
  tasks: Task[];
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

const COL_W = 44; // px per day column

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
  toggleTask,
  ganttZoom,
  setGanttZoom,
  phases = [],
  milestones = [],
  onTaskClick,
}: GanttViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [localZoom, setLocalZoom] = useState(1);
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});

  const zoom = ganttZoom ?? localZoom;
  const setZoom = setGanttZoom ?? setLocalZoom;

  const colW = Math.round(COL_W * zoom);

  const togglePhase = (phaseId: string) => {
    setOpenPhases((prev) => ({
      ...prev,
      [phaseId]: prev[phaseId] === false ? true : false,
    }));
  };

  // Group data by phase
  const groupedData = useMemo(() => {
    const sortedPhases = [...phases].sort((a, b) => {
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

    const mapped = sortedPhases.map((phase) => {
      const phaseTasks = tasks.filter((t) => t.phaseId === phase.id);
      const phaseMilestones = milestones.filter((m) => m.phaseId === phase.id);
      return {
        id: phase.id,
        name: phase.name,
        color: "#8b5cf6",
        tasks: phaseTasks,
        milestones: phaseMilestones,
      };
    });

    const unassignedTasks = tasks.filter((t) => !t.phaseId);
    const unassignedMilestones = milestones.filter((m) => !m.phaseId);

    if (unassignedTasks.length > 0 || unassignedMilestones.length > 0) {
      mapped.push({
        id: "unassigned",
        name: "Unassigned Tasks & Milestones",
        color: "#64748b",
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

    // Tasks dates
    tasks.forEach((t) => {
      parseAndCompare(t.rawStartDate);
      parseAndCompare(t.rawEndDate);
    });

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

    // Align minDate to the start of the week (Monday)
    const alignedStart = new Date(minDate);
    const day = alignedStart.getDay();
    const diff = alignedStart.getDate() - day + (day === 0 ? -6 : 1);
    alignedStart.setDate(diff);
    alignedStart.setHours(0, 0, 0, 0);

    // Align maxDate to the end of the week (Sunday)
    const alignedEnd = new Date(maxDate);
    const endDay = alignedEnd.getDay();
    const endDiff = alignedEnd.getDate() + (endDay === 0 ? 0 : 7 - endDay);
    alignedEnd.setDate(endDiff);
    alignedEnd.setHours(0, 0, 0, 0);

    // Calculate total days (ensure at least 28 days/4 weeks for presentation)
    const totalDays = Math.max(28, Math.round((alignedEnd.getTime() - alignedStart.getTime()) / 86400000) + 1);

    return {
      projectStart: alignedStart,
      totalDays,
    };
  }, [tasks, phases, milestones]);

  // Build dynamic week columns
  const weeks = useMemo(() => {
    const list: { label: string; days: { label: string; offset: number }[] }[] = [];
    const totalWeeks = Math.ceil(dateRange.totalDays / 7);

    for (let w = 0; w < totalWeeks; w++) {
      const weekStart = new Date(dateRange.projectStart);
      weekStart.setDate(weekStart.getDate() + w * 7);
      
      const weekNum = getWeekNumber(weekStart);
      const weekLabel = `W${weekNum} ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      
      const days = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + d);
        const DAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
        days.push({
          label: `${DAY_ABBR[date.getDay()]} ${date.getDate()}`,
          offset: w * 7 + d,
        });
      }
      list.push({ label: weekLabel, days });
    }
    return list;
  }, [dateRange]);

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

  const getGanttDates = (task: Task, index: number) => {
    let start = toLocalMidnight(task.rawStartDate);
    let end = toLocalMidnight(task.rawEndDate);

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
      return { startDay, durationDays };
    }

    // Fallback mock schedule
    const startDay = (index * 2) % 15;
    const durationDays = Math.max(1, 3 + (index % 5));
    return { startDay, durationDays };
  };

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
      const fitZoom = Math.max(0.5, Math.min(2, timelineVisibleWidth / (dateRange.totalDays * COL_W)));
      setZoom(fitZoom);
    }
  };

  const scrollTimeline = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = colW * 7;
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
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/60 text-xs font-semibold cursor-default">
          Day
        </div>
        <button
          onClick={handleAutoFit}
          className="px-3 py-1 rounded-lg border border-border/60 text-xs font-semibold hover:bg-muted/50 transition-colors cursor-pointer"
        >
          Auto fit
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="p-1.5 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
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
                      group.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 px-3 border-b border-border/20 hover:bg-muted/20 cursor-pointer group shrink-0"
                          onClick={() => onTaskClick?.(task.id)}
                          style={{ height: 36 }}
                        >
                          <div className="w-3.5 shrink-0" />
                          {task.hasSubtasks ? (
                            <ChevronRight className="size-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <div className="size-3 shrink-0" />
                          )}
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
                          <span className={cn("text-xs truncate flex-1", task.done && "line-through text-muted-foreground")}>
                            {task.name}
                          </span>
                        </div>
                      ))}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Right: timeline */}
          <div className="flex-1 relative">
            {/* Week headers */}
            <div className="flex border-b border-border/50 bg-white dark:bg-slate-900 sticky top-0 z-20" style={{ height: 28 }}>
              {weeks.map((week) => (
                <div
                  key={week.label}
                  className="border-r border-border/30 flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0"
                  style={{ width: week.days.length * colW }}
                >
                  {week.label}
                </div>
              ))}
            </div>

            {/* Day headers */}
            <div className="flex border-b border-border/50 bg-white dark:bg-slate-900 sticky top-7 z-20" style={{ height: 28 }}>
              {weeks.flatMap((week) =>
                week.days.map((day) => (
                  <div
                    key={day.offset}
                    className={cn(
                      "border-r border-border/20 flex items-center justify-center text-[10px] font-medium shrink-0",
                      day.offset === todayOffset ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"
                    )}
                    style={{ width: colW }}
                  >
                    {day.label}
                  </div>
                ))
              )}
            </div>

            {/* Timeline phase and task bars */}
            {groupedData.map((group) => {
              const isExpanded = openPhases[group.id] !== false;
              return (
                <React.Fragment key={group.id}>
                  {/* Phase timeline row (renders milestones) */}
                  <div className="border-b border-border/30 relative bg-muted/10 dark:bg-white/5" style={{ height: 36 }}>
                    <GridLines totalDays={dateRange.totalDays} colW={colW} todayOffset={todayOffset} />

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
                              : "bg-purple-600 border-white dark:border-slate-900"
                          )}
                          style={{ left: dayOffset * colW + colW / 2 - 7 }}
                          title={`Milestone: ${m.title} (${new Date(m.targetDate).toLocaleDateString()})`}
                        />
                      );
                    })}
                  </div>

                  {/* Task rows timeline */}
                  {isExpanded &&
                    group.tasks.map((task, idx) => {
                      const { startDay, durationDays } = getGanttDates(task, idx);
                      return (
                        <div
                          key={task.id}
                          className="border-b border-border/20 relative hover:bg-muted/10 transition-colors"
                          style={{ height: 36 }}
                        >
                          <GridLines totalDays={dateRange.totalDays} colW={colW} todayOffset={todayOffset} />

                          {/* Bar Container */}
                          {(() => {
                            const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.To_Do;
                            const barWidth = Math.max(durationDays * colW - 4, colW - 4);
                            return (
                              <div
                                className="absolute top-1/2 -translate-y-1/2 flex items-center gap-2 cursor-pointer group/bar"
                                onClick={() => onTaskClick?.(task.id)}
                                style={{
                                  left: startDay * colW + 2,
                                }}
                              >
                                {/* The Gantt Bar */}
                                <div
                                  className={cn(
                                    "relative rounded-md h-5 overflow-hidden flex items-center hover:brightness-95 transition-all shadow-xs border",
                                    config.bgClass
                                  )}
                                  style={{
                                    width: barWidth,
                                  }}
                                  title={`${task.name} (${config.label})`}
                                >
                                  {/* Task Name inside the bar if it fits */}
                                  {barWidth > 85 && (
                                    <span
                                      className={cn(
                                        "absolute left-2.5 text-[9px] font-bold truncate z-10 select-none max-w-[85%]",
                                        config.textClass
                                      )}
                                    >
                                      {task.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                </React.Fragment>
              );
            })}
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
          <span className="size-3 rotate-45 bg-purple-600 border border-white dark:border-slate-900" />
          <span>Milestone</span>
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

function GridLines({ totalDays, colW, todayOffset }: { totalDays: number; colW: number; todayOffset: number }) {
  return (
    <>
      {Array.from({ length: totalDays }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 border-r border-border/20"
          style={{ left: (i + 1) * colW }}
        />
      ))}
      {/* Today vertical line */}
      {todayOffset >= 0 && (
        <div className="absolute top-0 bottom-0 w-px bg-rose-400 z-10" style={{ left: todayOffset * colW + colW / 2 }} />
      )}
    </>
  );
}
