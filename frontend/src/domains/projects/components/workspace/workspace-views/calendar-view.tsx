"use client";

import { useState } from "react";
import { cn } from "@/shared/utils/cn";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Status = "To_Do" | "In_Progress" | "Submitted_for_Review" | "Approved" | "Rework" | "Done";
type Priority = "high" | "medium" | "low" | "critical";

interface Task {
  id: string;
  name: string;
  assigneeColor: string;
  dueDate: string;
  priority: Priority;
  status: Status;
  done: boolean;
}

// Parse "Nov 3" / "Oct 28" style dates into { month (0-indexed), day }
function parseDueDate(raw: string): { month: number; day: number } | null {
  const MONTHS: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const parts = raw.trim().split(" ");
  if (parts.length !== 2) return null;
  const month = MONTHS[parts[0]];
  const day = parseInt(parts[1], 10);
  if (month === undefined || isNaN(day)) return null;
  return { month, day };
}

const STATUS_PILL: Record<Status, string> = {
  "To_Do": "bg-muted text-muted-foreground",
  "In_Progress": "bg-blue-100 text-blue-705 dark:bg-blue-900/45 dark:text-blue-300",
  "Submitted_for_Review": "bg-amber-100 text-amber-705 dark:bg-amber-900/45 dark:text-amber-300",
  "Approved": "bg-teal-100 text-teal-705 dark:bg-teal-900/45 dark:text-teal-300",
  "Rework": "bg-rose-100 text-rose-705 dark:bg-rose-900/45 dark:text-rose-300",
  "Done": "bg-emerald-100 text-emerald-705 dark:bg-emerald-900/45 dark:text-emerald-300",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface CalendarViewProps {
  tasks: Task[];
}

export function CalendarView({ tasks }: CalendarViewProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  }
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

  // 6 rows × 7 cols = 42 cells
  const cells: { day: number; month: "prev" | "cur" | "next" }[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: daysInPrev - firstDay + 1 + i, month: "prev" });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month: "cur" });
  }
  while (cells.length < 42) {
    cells.push({ day: cells.length - daysInMonth - firstDay + 1, month: "next" });
  }

  // Map tasks to day numbers in current month
  const tasksByDay: Record<number, Task[]> = {};
  tasks.forEach((t) => {
    const parsed = parseDueDate(t.dueDate);
    if (parsed && parsed.month === viewMonth) {
      if (!tasksByDay[parsed.day]) tasksByDay[parsed.day] = [];
      tasksByDay[parsed.day].push(t);
    }
  });

  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent text-foreground">
      {/* Calendar toolbar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border/50 shrink-0 bg-transparent">
        <button
          onClick={goToday}
          className="px-3 py-1 rounded-lg border border-border/60 text-xs font-semibold hover:bg-muted/50 transition-colors"
        >
          Today
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={nextMonth}
            className="p-1 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <span className="text-sm font-semibold">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <div className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/60 text-xs font-semibold">
          Month <ChevronRight className="size-3 rotate-90 ml-1" />
        </div>
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-border/50 shrink-0">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-muted-foreground border-r border-border/30 last:border-r-0">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 h-full" style={{ gridTemplateRows: "repeat(6, minmax(80px, 1fr))" }}>
          {cells.map((cell, idx) => {
            const dayTasks = cell.month === "cur" ? tasksByDay[cell.day] ?? [] : [];
            const today_ = cell.month === "cur" && isToday(cell.day);

            return (
              <div
                key={idx}
                className={cn(
                  "border-r border-b border-border/30 last:border-r-0 p-1.5 flex flex-col gap-1 min-h-[80px]",
                  cell.month !== "cur" && "bg-muted/10 dark:bg-zinc-950/20",
                  today_ && "bg-primary/5"
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-end">
                  <span
                    className={cn(
                      "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full",
                      today_ ? "bg-primary text-primary-foreground" : cell.month !== "cur" ? "text-muted-foreground/40" : "text-foreground"
                    )}
                  >
                    {cell.day}
                  </span>
                </div>

                {/* Task pills */}
                {dayTasks.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity border border-transparent",
                      STATUS_PILL[t.status] || STATUS_PILL["To_Do"]
                    )}
                    title={t.name}
                  >
                    {t.name}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">+{dayTasks.length - 3} more</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
