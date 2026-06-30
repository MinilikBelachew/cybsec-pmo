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
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import { GanttTaskRow, GanttTaskStatus } from "@/domains/projects/utils/map-task-to-gantt";
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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MonthCalendarViewProps extends CalendarSharedViewProps {
  cells: { day: number; month: "prev" | "cur" | "next"; date: Date }[];
  tasksByDateKey: Record<string, GanttTaskRow[]>;
  draggedOverDateKey: string | null;
  setDraggedOverDateKey: (key: string | null) => void;
  handleDrop: (taskId: string, date: Date) => void;
}

export function MonthCalendarView({
  cells,
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
}: MonthCalendarViewProps) {
  const today = new Date();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-border/50 shrink-0">
        {DAY_NAMES.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-medium text-muted-foreground border-r border-border/30 last:border-r-0 select-none">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7 h-full animate-in fade-in duration-300" style={{ gridTemplateRows: "repeat(6, minmax(100px, 1fr))" }}>
          {cells.map((cell, idx) => {
            const dateKey = formatDateKey(cell.date);
            const cellTasks = tasksByDateKey[dateKey] ?? [];
            const today_ = cell.month === "cur" && cell.date.getDate() === today.getDate() && cell.date.getMonth() === today.getMonth() && cell.date.getFullYear() === today.getFullYear();

            return (
              <div
                key={idx}
                onDragEnter={() => setDraggedOverDateKey(dateKey)}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => setDraggedOverDateKey(null)}
                onDrop={(e) => {
                  const taskId = e.dataTransfer.getData("text/plain");
                  if (taskId) handleDrop(taskId, cell.date);
                  setDraggedOverDateKey(null);
                }}
                className={cn(
                  "border-r border-b border-border/30 last:border-r-0 p-1.5 flex flex-col gap-1 min-h-[100px] group transition-colors relative",
                  cell.month !== "cur" && "bg-muted/10 dark:bg-zinc-950/20",
                  today_ && "bg-primary/5",
                  draggedOverDateKey === dateKey && "bg-primary/10 ring-2 ring-primary/40"
                )}
              >
                {/* Day header: Add button and Day number */}
                <div className="flex items-center justify-between h-6 px-1 shrink-0">
                  {onAddTask ? (
                    <button
                      onClick={() => onAddTask(cell.date)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary transition-all cursor-pointer"
                      title="Add task"
                    >
                      <Plus className="size-3" />
                    </button>
                  ) : (
                    <div />
                  )}
                  <span
                    className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full select-none",
                      today_ ? "bg-primary text-primary-foreground font-semibold" : cell.month !== "cur" ? "text-muted-foreground/40" : "text-foreground"
                    )}
                  >
                    {cell.day}
                  </span>
                </div>

                {/* Task pills (Up to 3) */}
                <div className="flex flex-col gap-1 flex-1 overflow-y-auto pr-0.5">
                  {cellTasks.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", t.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className={cn(
                        "flex items-center justify-between gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-normal border cursor-pointer hover:opacity-90 group/pill transition-all relative min-w-0 select-none",
                        STATUS_PILL[t.status] || STATUS_PILL["To_Do"]
                      )}
                    >
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        {toggleTask && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTask(t.id);
                            }}
                            className="shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                          >
                            {t.done ? (
                              <CheckCircle2 className="size-2.5 text-emerald-600 dark:text-emerald-405" />
                            ) : (
                              <Circle className="size-2.5 text-current opacity-60" />
                            )}
                          </button>
                        )}
                        <span
                          onClick={() => onTaskClick?.(t.id)}
                          className={cn(
                            "truncate flex-1 text-left",
                            t.done && "line-through opacity-70"
                          )}
                          title={t.name}
                        >
                          {t.name}
                        </span>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover/pill:opacity-100 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-current transition-opacity cursor-pointer"
                            >
                              <MoreHorizontal className="size-2.5" />
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
                  ))}

                  {/* Overflow Indicator (+X more) */}
                  {cellTasks.length > 3 && (
                    <Popover>
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-muted-foreground hover:text-primary hover:underline px-1 py-0.5 text-left font-normal w-full cursor-pointer"
                          />
                        }
                      >
                        +{cellTasks.length - 3} more
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-3 flex flex-col gap-2 bg-popover text-popover-foreground border border-border animate-in fade-in zoom-in-95 duration-100 shadow-none">
                        <div className="flex items-center justify-between border-b border-border/50 pb-1.5 mb-1">
                          <span className="text-xs font-semibold">
                            Tasks on {cell.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          {onAddTask && (
                            <button
                              onClick={() => onAddTask(cell.date)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                              title="Add task"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                          {cellTasks.map((t) => (
                            <div
                              key={t.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", t.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              className={cn(
                                "flex items-center justify-between gap-1.5 px-2 py-1 rounded-md text-[11px] font-normal border cursor-pointer hover:opacity-90 group transition-all min-w-0 select-none",
                                STATUS_PILL[t.status] || STATUS_PILL["To_Do"]
                              )}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                {toggleTask && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTask(t.id);
                                    }}
                                    className="shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
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
                                  className={cn("truncate flex-1 text-left", t.done && "line-through opacity-70")}
                                  title={t.name}
                                >
                                  {t.name}
                                </span>
                              </div>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <button
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-current transition-opacity cursor-pointer"
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
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
