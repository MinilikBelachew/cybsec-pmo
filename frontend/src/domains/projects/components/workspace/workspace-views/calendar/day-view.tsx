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

interface DayCalendarViewProps extends CalendarSharedViewProps {
  focusDate: Date;
  dayTasks: GanttTaskRow[];
}

export function DayCalendarView({
  focusDate,
  dayTasks,
  onTaskClick,
  onAddTask,
  onDeleteTask,
  onDuplicateTask,
  onMoveTask,
  toggleTask,
}: DayCalendarViewProps) {
  const completedCount = dayTasks.filter((t) => t.done).length;
  const progressPercent = dayTasks.length > 0 ? Math.round((completedCount / dayTasks.length) * 100) : 0;

  return (
    <div className="flex h-full overflow-hidden divide-x divide-border/30 animate-in fade-in duration-300">
      {/* Day Sidebar */}
      <div className="w-80 border-r border-border/50 p-6 flex flex-col gap-6 shrink-0 bg-muted/5 dark:bg-zinc-950/5">
        <div className="border-t border-border/50 pt-5 space-y-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Day Overview</span>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-border/60 bg-background/50 backdrop-blur-md">
              <span className="text-[10px] font-semibold text-muted-foreground block mb-1">Total Tasks</span>
              <span className="text-2xl font-semibold">{dayTasks.length}</span>
            </div>
            <div className="p-3.5 rounded-xl border border-border/60 bg-background/50 backdrop-blur-md">
              <span className="text-[10px] font-semibold text-muted-foreground block mb-1">Completed</span>
              <span className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                {completedCount}
              </span>
            </div>
          </div>

          {dayTasks.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Day Progress</span>
                <span className="text-primary">{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-200/80 dark:bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {onAddTask && (
          <button
            onClick={() => onAddTask(focusDate)}
            className="mt-auto flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="size-4" />
            Add Day Task
          </button>
        )}
      </div>

      {/* Day Tasks List */}
      <div className="flex-1 overflow-y-auto p-6 bg-transparent">
        <div className="max-w-3xl mx-auto space-y-4">
          {dayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border/60 rounded-2xl p-6 bg-muted/5">
              <div className="p-3 rounded-full bg-primary/5 text-primary mb-4">
                <Plus className="size-8" />
              </div>
              <h3 className="text-base font-semibold mb-1">No tasks for today</h3>
              <p className="text-xs text-muted-foreground max-w-sm mb-6">
                There are no tasks scheduled for this date. Go ahead and create one to keep things on track!
              </p>
              {onAddTask && (
                <button
                  onClick={() => onAddTask(focusDate)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors cursor-pointer"
                >
                  <Plus className="size-4" />
                  Add New Task
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {dayTasks.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-xl border transition-all duration-205 group bg-background/50 hover:bg-muted/10 border-border/60 hover:border-border",
                    t.done && "opacity-75"
                  )}
                >
                  {toggleTask && (
                    <button
                      onClick={() => toggleTask(t.id)}
                      className="mt-1 shrink-0 cursor-pointer"
                    >
                      {t.done ? (
                        <CheckCircle2 className="size-5 text-emerald-500 hover:opacity-85 transition-opacity" />
                      ) : (
                        <Circle className="size-5 text-muted-foreground hover:text-primary transition-colors" />
                      )}
                    </button>
                  )}

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        onClick={() => onTaskClick?.(t.id)}
                        className={cn(
                          "text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer truncate",
                          t.done && "line-through text-muted-foreground font-normal"
                        )}
                      >
                        {(t.depth ?? (t.parentTaskId ? 1 : 0)) > 0 && (
                          <span className="opacity-70 mr-1 text-xs font-normal">↳</span>
                        )}
                        {t.name}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border select-none shrink-0",
                          PRIORITY_PILL[t.priority] || PRIORITY_PILL["medium"]
                        )}
                      >
                        {t.priority}
                      </span>
                    </div>

                    {/* Task details metadata */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground select-none pt-0.5">
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                          STATUS_PILL[t.status] || STATUS_PILL["To_Do"]
                        )}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button className="p-1.5 rounded-lg hover:bg-muted border border-transparent hover:border-border/50 text-muted-foreground hover:text-foreground cursor-pointer transition-all">
                            <MoreHorizontal className="size-4" />
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
