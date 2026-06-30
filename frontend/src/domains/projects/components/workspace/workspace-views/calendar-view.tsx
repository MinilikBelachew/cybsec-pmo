"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { GanttTaskRow, GanttTaskStatus } from "@/domains/projects/utils/map-task-to-gantt";
import { formatDateKey } from "@/domains/projects/utils/calendar.utils";
import { MonthCalendarView } from "./calendar/month-view";
import { WeekCalendarView } from "./calendar/week-view";
import { DayCalendarView } from "./calendar/day-view";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
export interface CalendarSharedViewProps {
  onTaskClick?: (taskId: string) => void;
  onAddTask?: (date: Date) => void;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
  onMoveTask?: (taskId: string, toStatus: GanttTaskStatus) => void;
  onSetDueDate?: (taskId: string, date: string | null) => void;
  toggleTask?: (taskId: string) => void;
}

interface CalendarViewProps extends CalendarSharedViewProps {
  tasks: GanttTaskRow[];
}

export function CalendarView({
  tasks,
  onTaskClick,
  onAddTask,
  onDeleteTask,
  onDuplicateTask,
  onMoveTask,
  onSetDueDate,
  toggleTask,
}: CalendarViewProps) {
  const [subView, setSubView] = useState<"month" | "week" | "day">("month");
  const [focusDate, setFocusDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [draggedOverDateKey, setDraggedOverDateKey] = useState<string | null>(null);

  const viewYear = focusDate.getFullYear();
  const viewMonth = focusDate.getMonth();

  function prev() {
    if (subView === "month") {
      setFocusDate(new Date(viewYear, viewMonth - 1, 1));
    } else if (subView === "week") {
      const prevWeek = new Date(focusDate);
      prevWeek.setDate(focusDate.getDate() - 7);
      setFocusDate(prevWeek);
    } else {
      const prevDay = new Date(focusDate);
      prevDay.setDate(focusDate.getDate() - 1);
      setFocusDate(prevDay);
    }
  }

  function next() {
    if (subView === "month") {
      setFocusDate(new Date(viewYear, viewMonth + 1, 1));
    } else if (subView === "week") {
      const nextWeek = new Date(focusDate);
      nextWeek.setDate(focusDate.getDate() + 7);
      setFocusDate(nextWeek);
    } else {
      const nextDay = new Date(focusDate);
      nextDay.setDate(focusDate.getDate() + 1);
      setFocusDate(nextDay);
    }
  }

  function goToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setFocusDate(d);
  }

  // Map tasks by local date strings YYYY-MM-DD
  const tasksByDateKey = useMemo(() => {
    const map: Record<string, GanttTaskRow[]> = {};
    tasks.forEach((t) => {
      if (t.rawEndDate) {
        try {
          const d = new Date(t.rawEndDate);
          if (!isNaN(d.getTime())) {
            const key = formatDateKey(d);
            if (!map[key]) map[key] = [];
            map[key].push(t);
          }
        } catch (e) {
          console.error("Failed to parse task date:", t.rawEndDate, e);
        }
      }
    });
    return map;
  }, [tasks]);

  // Build month cells (6 rows × 7 columns = 42 cells)
  const monthCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

    const result: { day: number; month: "prev" | "cur" | "next"; date: Date }[] = [];
    
    for (let i = 0; i < firstDay; i++) {
      const day = daysInPrev - firstDay + 1 + i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      result.push({ day, month: "prev", date: new Date(y, m, day) });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, month: "cur", date: new Date(viewYear, viewMonth, d) });
    }
    while (result.length < 42) {
      const day = result.length - daysInMonth - firstDay + 1;
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      result.push({ day, month: "next", date: new Date(y, m, day) });
    }
    return result;
  }, [viewYear, viewMonth]);

  // Build 7 days of active week
  const weekDays = useMemo(() => {
    const start = new Date(focusDate);
    const dayOfWeek = start.getDay();
    start.setDate(start.getDate() - dayOfWeek); // Go back to Sunday
    
    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      result.push(d);
    }
    return result;
  }, [focusDate]);

  const handleDrop = (taskId: string, targetDate: Date) => {
    if (!onSetDueDate) return;
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, "0");
    const d = String(targetDate.getDate()).padStart(2, "0");
    const localDateStr = `${y}-${m}-${d}`;
    onSetDueDate(taskId, localDateStr);
  };

  const getHeaderTitle = () => {
    if (subView === "month") {
      return `${MONTH_NAMES[viewMonth]} ${viewYear}`;
    }
    if (subView === "week") {
      const start = weekDays[0];
      const end = weekDays[6];
      const formatShort = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const formatYear = (d: Date) => d.getFullYear();
      
      if (start.getFullYear() !== end.getFullYear()) {
        return `${formatShort(start)}, ${formatYear(start)} - ${formatShort(end)}, ${formatYear(end)}`;
      }
      return `${formatShort(start)} - ${formatShort(end)}, ${formatYear(start)}`;
    }
    return focusDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  const dayDateKey = formatDateKey(focusDate);
  const dayTasks = tasksByDateKey[dayDateKey] ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent text-foreground">
      {/* Calendar toolbar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border/50 shrink-0 bg-transparent select-none">
        <button
          onClick={goToday}
          className="px-3 py-2 rounded-lg border border-border/60 text-xs font-medium hover:bg-muted/50 transition-colors cursor-pointer"
        >
          Today
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="p-1 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={next}
            className="p-1 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <span className="text-sm font-semibold">
          {getHeaderTitle()}
        </span>

        {/* View Switcher Dropdown */}
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-border/60 text-xs font-medium select-none hover:bg-muted/50 cursor-pointer transition-colors" />
              }
            >
              <span className="capitalize">{subView}</span> <ChevronRight className="size-3 rotate-90 ml-1" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32 shadow-none">
              <DropdownMenuItem className="cursor-pointer" onClick={() => setSubView("month")}>
                Month View
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => setSubView("week")}>
                Week View
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => setSubView("day")}>
                Day View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Display Area */}
      <div className="flex-1 overflow-hidden">
        {subView === "month" && (
          <MonthCalendarView
            cells={monthCells}
            tasksByDateKey={tasksByDateKey}
            draggedOverDateKey={draggedOverDateKey}
            setDraggedOverDateKey={setDraggedOverDateKey}
            handleDrop={handleDrop}
            onTaskClick={onTaskClick}
            onAddTask={onAddTask}
            onDeleteTask={onDeleteTask}
            onDuplicateTask={onDuplicateTask}
            onMoveTask={onMoveTask}
            toggleTask={toggleTask}
          />
        )}

        {subView === "week" && (
          <WeekCalendarView
            weekDays={weekDays}
            tasksByDateKey={tasksByDateKey}
            draggedOverDateKey={draggedOverDateKey}
            setDraggedOverDateKey={setDraggedOverDateKey}
            handleDrop={handleDrop}
            onTaskClick={onTaskClick}
            onAddTask={onAddTask}
            onDeleteTask={onDeleteTask}
            onDuplicateTask={onDuplicateTask}
            onMoveTask={onMoveTask}
            toggleTask={toggleTask}
          />
        )}

        {subView === "day" && (
          <DayCalendarView
            focusDate={focusDate}
            dayTasks={dayTasks}
            onTaskClick={onTaskClick}
            onAddTask={onAddTask}
            onDeleteTask={onDeleteTask}
            onDuplicateTask={onDuplicateTask}
            onMoveTask={onMoveTask}
            toggleTask={toggleTask}
          />
        )}
      </div>
    </div>
  );
}
