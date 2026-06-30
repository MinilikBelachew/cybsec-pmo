"use client";

import { cn } from "@/shared/utils/cn";
import { Plus, MoreHorizontal, Check, Circle, CheckCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/shared/ui/dropdown-menu";
import { GanttTaskRow, GanttTaskStatus, GanttPriority } from "@/domains/projects/utils/map-task-to-gantt";
import { CalendarSharedViewProps } from "@/domains/projects/types/calendar.types";
import { formatDateKey } from "@/domains/projects/utils/calendar.utils";

const STATUS_LABEL: Record<GanttTaskStatus, string> = {
  "To_Do": "To Do",
  "In_Progress": "In Progress",
  "Submitted_for_Review": "Submitted for Review",
  "Approved": "Approved",
  "Rework": "Rework",
  "Done": "Done",
};

const STATUS_PILL: Record<GanttTaskStatus, string> = {
  "To_Do": "bg-muted text-muted-foreground border-border/60",
  "In_Progress": "bg-blue-55/65 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  "Submitted_for_Review": "bg-amber-55/65 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  "Approved": "bg-teal-55/65 text-teal-600 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800",
  "Rework": "bg-rose-55/65 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800",
  "Done": "bg-emerald-55/65 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
};

const PRIORITY_PILL: Record<GanttPriority, string> = {
  critical: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30",
  high: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30",
  medium: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
  low: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-950/20 dark:text-slate-400 dark:border-slate-800"
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface WeekCalendarViewProps extends CalendarSharedViewProps {
  weekDays: Date[];
  tasksByDateKey: Record<string, GanttTaskRow[]>;
  draggedOverDateKey: string | null;
  setDraggedOverDateKey: (key: string | null) => void;
  handleDrop: (taskId: string, date: Date) => void;
}

export function WeekCalendarView({
  weekDays,
  tasksByDateKey,
  draggedOverDateKey,
  setDraggedOverDateKey,
  handleDrop,
  onTaskClick,
  onAddTask,
  onDeleteTask,
  onDuplicateTask,
  onMoveTask,
  toggleTask,
}: WeekCalendarViewProps) {
  const today = new Date();

  return (
    <div className="grid grid-cols-7 h-full border-b border-border/30 overflow-hidden divide-x divide-border/30 animate-in fade-in duration-300">
      {weekDays.map((d, index) => {
        const dateKey = formatDateKey(d);
        const cellTasks = tasksByDateKey[dateKey] ?? [];
        const isToday_ = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        
        return (
          <div
            key={index}
            onDragEnter={() => setDraggedOverDateKey(dateKey)}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDraggedOverDateKey(null)}
            onDrop={(e) => {
              const taskId = e.dataTransfer.getData("text/plain");
              if (taskId) handleDrop(taskId, d);
              setDraggedOverDateKey(null);
            }}
            className={cn(
              "flex flex-col h-full overflow-hidden group min-w-0 transition-colors bg-transparent",
              isToday_ && "bg-primary/5",
              draggedOverDateKey === dateKey && "bg-primary/10 ring-1 ring-primary/30"
            )}
          >
            {/* Week Day Header */}
            <div className={cn(
              "p-3 flex items-center justify-between border-b border-border/30 shrink-0",
              isToday_ && "border-b-primary/30"
            )}>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">
                  {DAY_NAMES[d.getDay()]}
                </span>
                <span className={cn(
                  "text-base font-semibold mt-1 w-6 h-6 flex items-center justify-center rounded-full select-none",
                  isToday_ ? "bg-primary text-primary-foreground" : "text-foreground"
                )}>
                  {d.getDate()}
                </span>
              </div>
              
              {onAddTask && (
                <button
                  onClick={() => onAddTask(d)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-all cursor-pointer"
                  title="Add task"
                >
                  <Plus className="size-3.5" />
                </button>
              )}
            </div>
            
            {/* Week Day Content */}
            <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2 min-h-0">
              {cellTasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-0 group-hover:opacity-60 transition-opacity py-10 select-none">
                  <Plus className="size-6 text-muted-foreground/50 mb-1" />
                  <span className="text-[9px] font-semibold text-muted-foreground">Empty</span>
                </div>
              ) : (
                cellTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", t.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className={cn(
                      "flex flex-col gap-1.5 px-2.5 py-2.5 rounded-xl border cursor-pointer group/pill transition-all relative select-none",
                      STATUS_PILL[t.status] || STATUS_PILL["To_Do"]
                    )}
                  >
                    <div className="flex items-start gap-1.5 min-w-0">
                      {toggleTask && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTask(t.id);
                          }}
                          className="mt-0.5 shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                        >
                          {t.done ? (
                            <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Circle className="size-3 text-current opacity-60" />
                          )}
                        </button>
                      )}
                      <span
                        onClick={() => onTaskClick?.(t.id)}
                        className={cn(
                          "truncate flex-1 text-left text-[11px] font-normal leading-tight",
                          t.done && "line-through opacity-70"
                        )}
                        title={t.name}
                      >
                        {t.name}
                      </span>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover/pill:opacity-100 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-current transition-opacity cursor-pointer shrink-0"
                            >
                              <MoreHorizontal className="size-3" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-44 shadow-none">
                          <DropdownMenuItem
                            className="cursor-pointer gap-2"
                            onClick={() => onTaskClick?.(t.id)}
                          >
                            Edit details
                          </DropdownMenuItem>

                          {toggleTask && (
                            <DropdownMenuItem
                              className="cursor-pointer gap-2"
                              onClick={() => toggleTask(t.id)}
                            >
                              {t.done ? "Mark incomplete" : "Mark complete"}
                            </DropdownMenuItem>
                          )}

                          {onDuplicateTask && (
                            <DropdownMenuItem
                              className="cursor-pointer gap-2"
                              onClick={() => onDuplicateTask(t.id)}
                            >
                              Duplicate task
                            </DropdownMenuItem>
                          )}

                          {onMoveTask && (
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="cursor-pointer gap-2">
                                Move Status
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-48 shadow-none">
                                {(["To_Do", "In_Progress", "Submitted_for_Review", "Approved", "Rework", "Done"] as GanttTaskStatus[]).map((status) => (
                                  <DropdownMenuItem
                                    key={status}
                                    className="cursor-pointer flex items-center justify-between text-xs"
                                    onClick={() => onMoveTask(t.id, status)}
                                  >
                                    <span>{STATUS_LABEL[status]}</span>
                                    {t.status === status && <Check className="size-3" />}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          )}

                          {onDeleteTask && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600 dark:text-rose-400"
                                onClick={() => onDeleteTask(t.id)}
                              >
                                Delete task
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="flex items-center justify-between select-none">
                      <span className={cn(
                        "text-[8px] font-semibold px-1 py-0.2 rounded border uppercase",
                        PRIORITY_PILL[t.priority] || PRIORITY_PILL["medium"]
                      )}>
                        {t.priority}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
