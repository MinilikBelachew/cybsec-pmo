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
}

const STATUS_BAR: Record<Status, string> = {
  "To_Do": "bg-muted-foreground/30 text-muted-foreground",
  "In_Progress": "bg-blue-400",
  "Submitted_for_Review": "bg-amber-400 text-black",
  "Approved": "bg-teal-400 text-white",
  "Rework": "bg-rose-450",
  "Done": "bg-emerald-400",
};

// Build week columns: 4 weeks starting from May 5 (Mon)
const PROJECT_START = new Date(2026, 4, 5); // May 5 2026 (Mon)
const TODAY_OFFSET = Math.floor((new Date(2026, 4, 14).getTime() - PROJECT_START.getTime()) / 86400000); // May 14

const WEEKS: { label: string; days: { label: string; offset: number }[] }[] = [];
for (let w = 0; w < 4; w++) {
  const weekStart = new Date(PROJECT_START);
  weekStart.setDate(weekStart.getDate() + w * 7);
  const weekLabel = `W${19 + w} May ${weekStart.getDate()} · ${weekStart.getDate() + 6}`;
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
  WEEKS.push({ label: weekLabel, days });
}

const TOTAL_DAYS = WEEKS.length * 7;
const COL_W = 44; // px per day column

export function GanttView({ tasks, toggleTask, phases = [], milestones = [] }: GanttViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});

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

  const getMilestoneOffset = (targetDateStr: string) => {
    const date = new Date(targetDateStr);
    const diffTime = date.getTime() - PROJECT_START.getTime();
    const diffDays = Math.floor(diffTime / 86400000);
    return Math.max(0, Math.min(TOTAL_DAYS - 1, diffDays));
  };

  const getGanttDates = (task: Task, index: number) => {
    if (task.rawStartDate && task.rawEndDate) {
      const start = new Date(task.rawStartDate);
      const end = new Date(task.rawEndDate);
      const diffStart = start.getTime() - PROJECT_START.getTime();
      const diffEnd = end.getTime() - PROJECT_START.getTime();
      
      const startDay = Math.max(0, Math.floor(diffStart / 86400000));
      const durationDays = Math.max(1, Math.ceil((diffEnd - diffStart) / 86400000) + 1);
      return { startDay, durationDays };
    }
    // Fallback mock schedule
    const startDay = (index * 2) % 15;
    const durationDays = Math.max(1, 3 + (index % 5));
    return { startDay, durationDays };
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      {/* Gantt toolbar */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-border/50 shrink-0 bg-transparent">
        <button className="p-1.5 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          <ChevronRight className="size-3.5 rotate-180" />
        </button>
        <button className="px-3 py-1 rounded-lg border border-border/60 text-xs font-semibold hover:bg-muted/50 transition-colors">
          Today
        </button>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/60 text-xs font-semibold">
          Week <ChevronDown className="size-3 ml-1" />
        </div>
        <button className="px-3 py-1 rounded-lg border border-border/60 text-xs font-semibold hover:bg-muted/50 transition-colors">
          Auto fit
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-border/60 text-xs font-semibold hover:bg-muted/50 transition-colors">
          Export
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
      <div className="flex flex-1 overflow-hidden">
        {/* Left: task list */}
        <div className="w-64 shrink-0 border-r border-border/50 flex flex-col overflow-hidden bg-transparent">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-transparent h-[56px]">
            <span className="text-xs font-semibold text-muted-foreground">Name</span>
          </div>

          {/* Task rows */}
          <div className="flex-1 overflow-y-auto">
            {groupedData.map((group) => {
              const isExpanded = openPhases[group.id] !== false;
              return (
                <React.Fragment key={group.id}>
                  {/* Phase row */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 border-b border-border/30 hover:bg-muted/30 cursor-pointer select-none"
                    onClick={() => togglePhase(group.id)}
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
                        className="flex items-center gap-2 px-3 py-2 border-b border-border/20 hover:bg-muted/20 cursor-pointer group"
                      >
                        <div className="w-3.5 shrink-0" />
                        {task.hasSubtasks ? (
                          <ChevronRight className="size-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        ) : (
                          <div className="size-3 shrink-0" />
                        )}
                        <button onClick={() => toggleTask(task.id)}>
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
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <div style={{ width: TOTAL_DAYS * colW + "px", minWidth: "100%" }}>
            {/* Week headers */}
            <div className="flex border-b border-border/50 bg-transparent sticky top-0 z-20" style={{ height: 28 }}>
              {WEEKS.map((week) => (
                <div
                  key={week.label}
                  className="border-r border-border/30 flex items-center justify-center text-[10px] font-semibold text-muted-foreground"
                  style={{ width: week.days.length * colW }}
                >
                  {week.label}
                </div>
              ))}
            </div>

            {/* Day headers */}
            <div className="flex border-b border-border/50 bg-transparent sticky top-7 z-20" style={{ height: 28 }}>
              {WEEKS.flatMap((week) =>
                week.days.map((day) => (
                  <div
                    key={day.offset}
                    className={cn(
                      "border-r border-border/20 flex items-center justify-center text-[10px] font-medium",
                      day.offset === TODAY_OFFSET ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"
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
                    <GridLines totalDays={TOTAL_DAYS} colW={colW} todayOffset={TODAY_OFFSET} />

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
                          <GridLines totalDays={TOTAL_DAYS} colW={colW} todayOffset={TODAY_OFFSET} />

                          {/* Bar */}
                          <div
                            className={cn(
                              "absolute top-1/2 -translate-y-1/2 rounded-full h-5 flex items-center px-2 text-[10px] font-semibold text-white/90 overflow-hidden whitespace-nowrap",
                              STATUS_BAR[task.status] || STATUS_BAR["To_Do"]
                            )}
                            style={{
                              left: startDay * colW + 2,
                              width: Math.max(durationDays * colW - 4, colW - 4),
                            }}
                            title={task.name}
                          >
                            {durationDays * colW > 60 ? task.name : ""}
                          </div>
                        </div>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
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
          className={cn("absolute top-0 bottom-0 border-r", i === todayOffset ? "border-rose-400 z-10" : "border-border/20")}
          style={{ left: (i + 1) * colW }}
        />
      ))}
      {/* Today vertical line */}
      <div className="absolute top-0 bottom-0 w-px bg-rose-400 z-10" style={{ left: todayOffset * colW + colW / 2 }} />
    </>
  );
}
