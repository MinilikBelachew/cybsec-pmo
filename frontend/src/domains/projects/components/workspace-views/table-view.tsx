"use client";

import { useState } from "react";
import { cn } from "@/shared/utils/cn";
import { Circle, CircleCheck, Plus, ChevronRight } from "lucide-react";

type Status = "TO DO" | "IN PROGRESS" | "DONE";
type Priority = "high" | "medium" | "low" | "critical";

interface Task {
  id: string;
  name: string;
  assigneeInitials: string;
  assigneeColor: string;
  dueDate: string;
  priority: Priority;
  status: Status;
  hasSubtasks?: boolean;
  done: boolean;
}

const STATUS_PILL: Record<Status, string> = {
  "TO DO": "bg-muted text-muted-foreground border border-border/60",
  "IN PROGRESS": "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  "DONE": "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  critical: "text-red-600 dark:text-red-400 font-bold",
  high: "text-rose-500",
  medium: "text-amber-500",
  low: "text-muted-foreground/50",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

interface TableViewProps {
  tasks: Task[];
  toggleTask: (id: string) => void;
  onTaskClick?: (taskId: string) => void;
}

export function TableView({ tasks, toggleTask, onTaskClick }: TableViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === tasks.length) setSelected(new Set());
    else setSelected(new Set(tasks.map((t) => t.id)));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      {/* Table toolbar */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-border/50 shrink-0 bg-transparent">
        <div className="flex items-center gap-1.5">
          <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Group: None
          </button>
          <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
            Shown
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm text-foreground">
          <thead>
            <tr className="border-b border-border/50 bg-transparent sticky top-0 z-10">
              {/* Row number */}
              <th className="w-8 px-2 py-2 text-left" />
              {/* Checkbox */}
              <th className="w-8 px-2 py-2">
                <input
                  type="checkbox"
                  checked={selected.size === tasks.length && tasks.length > 0}
                  onChange={toggleAll}
                  className="rounded border-border accent-primary cursor-pointer"
                />
              </th>
              {/* Name */}
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide min-w-[200px]">
                Name
              </th>
              {/* Assignee */}
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-36">
                Assignee
              </th>
              {/* Status */}
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-36">
                Status
              </th>
              {/* Due date */}
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-28">
                Due date
              </th>
              {/* Priority */}
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-28">
                Priority
              </th>
              {/* Add column */}
              <th className="w-10 px-2 py-2">
                <button className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="size-3.5" />
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            {tasks.map((task, idx) => {
              const isSelected = selected.has(task.id);
              return (
                <tr
                  key={task.id}
                  className={cn(
                    "border-b border-border/30 hover:bg-muted/30 transition-colors group",
                    isSelected && "bg-primary/5"
                  )}
                >
                  {/* Row number */}
                  <td className="w-8 px-2 py-2 text-[11px] text-muted-foreground/50 text-right select-none">
                    {idx + 1}
                  </td>

                  {/* Checkbox */}
                  <td className="w-8 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(task.id)}
                      className="rounded border-border accent-primary cursor-pointer"
                    />
                  </td>

                  {/* Name */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {/* Subtask expand */}
                      {task.hasSubtasks ? (
                        <ChevronRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      ) : (
                        <div className="size-3 shrink-0" />
                      )}

                      {/* Status toggle */}
                      <button onClick={() => toggleTask(task.id)} className="shrink-0" aria-label="Toggle status">
                        {task.done ? (
                          <CircleCheck className="size-4 text-emerald-500" />
                        ) : (
                          <Circle className="size-4 text-muted-foreground hover:text-primary transition-colors" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onTaskClick?.(task.id)}
                        className={cn(
                          "text-sm font-medium truncate text-left hover:text-primary transition-colors",
                          task.done && "line-through text-muted-foreground"
                        )}
                      >
                        {task.name}
                      </button>
                    </div>
                  </td>

                  {/* Assignee */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center size-6 rounded-full text-[10px] font-bold text-white shrink-0",
                          task.assigneeColor
                        )}
                      >
                        {task.assigneeInitials}
                      </span>
                      <span className="text-xs text-muted-foreground">{task.assigneeInitials}</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {task.status === "DONE" ? (
                        <CircleCheck className="size-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="size-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-md", STATUS_PILL[task.status] || STATUS_PILL["TO DO"])}>
                        {task.status}
                      </span>
                    </div>
                  </td>

                  {/* Due date */}
                  <td className="px-3 py-2 text-xs text-muted-foreground">{task.dueDate}</td>

                  {/* Priority */}
                  <td className="px-3 py-2">
                    <span className={cn("text-xs font-medium", PRIORITY_STYLES[task.priority])}>
                      {PRIORITY_LABEL[task.priority]}
                    </span>
                  </td>

                  {/* Empty add-column cell */}
                  <td className="w-10 px-2 py-2" />
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add row */}
        <div className="flex items-center gap-2 px-5 py-2 hover:bg-muted/20 transition-colors cursor-pointer group border-b border-border/20">
          <div className="w-8 shrink-0" />
          <div className="w-8 shrink-0" />
          <Plus className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Add row</span>
        </div>
      </div>
    </div>
  );
}
