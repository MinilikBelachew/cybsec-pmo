"use client";

import React from "react";
import { ChevronDown, ChevronRight, Circle, CircleCheck, Flag, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/shared/utils/cn";

type Priority = "high" | "medium" | "low" | "critical";
type Status = "TO DO" | "IN PROGRESS" | "DONE";

interface Task {
  id: string;
  name: string;
  assigneeInitials: string;
  assigneeColor: string;
  dueDate: string;
  priority: Priority;
  status: Status;
  comments: number;
  hasSubtasks?: boolean;
  done: boolean;
}

interface ListViewProps {
  tasks: Task[];
  openGroups: Set<Status>;
  toggleGroup: (status: Status) => void;
  toggleTask: (taskId: string) => void;
  onAddTask?: (status: Status) => void;
}

const PRIORITY_STYLES: Record<Priority, string> = {
  critical: "text-red-600 dark:text-red-400 font-bold",
  high: "text-rose-500",
  medium: "text-amber-500",
  low: "text-muted-foreground",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_DOT: Record<Status, string> = {
  "TO DO": "border-2 border-muted-foreground bg-transparent",
  "IN PROGRESS": "bg-blue-500",
  "DONE": "bg-emerald-500",
};

const GROUP_ACCENT: Record<Status, string> = {
  "TO DO": "text-muted-foreground",
  "IN PROGRESS": "text-blue-600 dark:text-blue-400",
  "DONE": "text-emerald-600 dark:text-emerald-400",
};

export function ListView({
  tasks,
  openGroups,
  toggleGroup,
  toggleTask,
  onAddTask,
}: ListViewProps) {
  return (
    <div className="h-full overflow-y-auto bg-transparent">
      {/* Column Headers */}
      <div className="flex items-center gap-2 px-5 py-1.5 border-b border-border/50 bg-transparent backdrop-blur-md sticky top-0 z-20">
        <div className="w-4 shrink-0" />
        <div className="w-4 shrink-0" />
        <div className="flex-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Name
        </div>
        <div className="shrink-0 w-20 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-center">
          Assignee
        </div>
        <div className="shrink-0 w-20 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-center">
          Due Date
        </div>
        <div className="shrink-0 w-20 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-center">
          Priority
        </div>
        <div className="shrink-0 w-24 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-center">
          Status
        </div>
        <div className="shrink-0 w-14 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-center">
          Comments
        </div>
      </div>

      {/* Collapsible status groups */}
      {(["TO DO", "IN PROGRESS", "DONE"] as Status[]).map((status) => {
        const groupTasks = tasks.filter((t) => t.status === status);
        const isOpen = openGroups.has(status);

        return (
          <div key={status}>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/30 sticky top-8 z-10">
              <button
                onClick={() => toggleGroup(status)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                {isOpen ? (
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                )}
                <span className={cn("size-2.5 rounded-full shrink-0", STATUS_DOT[status])} />
                <span className={cn("text-xs font-bold uppercase tracking-wide", GROUP_ACCENT[status])}>
                  {status}
                </span>
                <span className="text-xs text-muted-foreground font-medium">{groupTasks.length}</span>
              </button>
            </div>

            {isOpen && (
              <>
                {groupTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 border-b border-border/30 hover:bg-muted/30 transition-colors group cursor-pointer",
                      task.done && "opacity-60"
                    )}
                  >
                    <div className="w-4 shrink-0 flex items-center justify-center">
                      {task.hasSubtasks && (
                        <ChevronRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    <button
                      onClick={() => toggleTask(task.id)}
                      className="shrink-0"
                      aria-label={task.done ? "Mark incomplete" : "Mark complete"}
                    >
                      {task.done ? (
                        <CircleCheck className="size-4 text-emerald-500 shrink-0" />
                      ) : task.status === "IN PROGRESS" ? (
                        <CircleCheck className="size-4 text-blue-500 shrink-0" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                    <span
                      className={cn(
                        "flex-1 text-sm min-w-0 truncate",
                        task.done ? "line-through text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {task.name}
                    </span>
                    <div className="shrink-0 w-20 flex items-center justify-center">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center size-6 rounded-full font-semibold text-white text-[10px] shrink-0",
                          task.assigneeColor
                        )}
                      >
                        {task.assigneeInitials}
                      </span>
                    </div>
                    <div className="shrink-0 w-20 text-xs text-muted-foreground text-center">
                      {task.dueDate}
                    </div>
                    <div className="shrink-0 w-20 flex items-center justify-center gap-1">
                      <Flag className={cn("size-3", PRIORITY_STYLES[task.priority])} />
                      <span className={cn("text-xs", PRIORITY_STYLES[task.priority])}>
                        {PRIORITY_LABEL[task.priority]}
                      </span>
                    </div>
                    <div className="shrink-0 w-24 flex items-center justify-center">
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                          task.status === "TO DO" && "bg-muted text-muted-foreground border-border/60",
                          task.status === "IN PROGRESS" && "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
                          task.status === "DONE" && "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                        )}
                      >
                        {task.status}
                      </span>
                    </div>
                    <div className="shrink-0 w-14 flex items-center justify-center gap-1 text-muted-foreground">
                      <MessageSquare className="size-3.5" />
                      <span className="text-xs">{task.comments}</span>
                    </div>
                  </div>
                ))}
                {onAddTask && (
                  <div
                    onClick={() => onAddTask(status)}
                    className="flex items-center gap-2 px-3 py-2 border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer group"
                  >
                    <div className="w-4 shrink-0" />
                    <Plus className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      Add Task
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
