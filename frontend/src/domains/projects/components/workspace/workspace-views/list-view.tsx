"use client";

import React from "react";
import { ChevronDown, ChevronRight, Circle, CircleCheck, Flag, MessageSquare, Plus, MoreHorizontal, User, Calendar } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

type Priority = "high" | "medium" | "low" | "critical";
type Status = "To_Do" | "In_Progress" | "Submitted_for_Review" | "Approved" | "Rework" | "Done";

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
  phaseId?: string | null;
  phaseName?: string;
  phaseColor?: string;
  owner?: { id: string; displayName: string; email: string };
  rawStartDate?: string | null;
  rawEndDate?: string | null;
}

function formatDueDate(dateStr?: string | null) {
  if (!dateStr || dateStr === "No due date") return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return null;
  }
}

import { type ProjectPhase, type ProjectTaskAssignee } from "../../../types/projects.types";
import { EmployeeTooltip } from "../../shared/employee-tooltip";

interface ListViewProps {
  tasks: Task[];
  openGroups: Set<Status>;
  toggleGroup: (status: Status) => void;
  toggleTask: (taskId: string) => void;
  onAddTask?: (status: Status, phaseId?: string | null) => void;
  onTaskClick?: (taskId: string, initialTab?: "comments" | "subtasks") => void;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
  onMoveTask?: (taskId: string, toStatus: Status) => void;
  phases?: ProjectPhase[];
  assignees?: ProjectTaskAssignee[];
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
  "To_Do": "border-2 border-muted-foreground bg-transparent",
  "In_Progress": "bg-blue-500",
  "Submitted_for_Review": "bg-amber-500",
  "Approved": "bg-teal-500",
  "Rework": "bg-rose-500",
  "Done": "bg-emerald-500",
};

const GROUP_ACCENT: Record<Status, string> = {
  "To_Do": "text-muted-foreground",
  "In_Progress": "text-blue-600 dark:text-blue-400",
  "Submitted_for_Review": "text-amber-600 dark:text-amber-400",
  "Approved": "text-teal-655 dark:text-teal-405",
  "Rework": "text-rose-600 dark:text-rose-400",
  "Done": "text-emerald-600 dark:text-emerald-400",
};

const STATUS_LABEL: Record<Status, string> = {
  "To_Do": "To Do",
  "In_Progress": "In Progress",
  "Submitted_for_Review": "Submitted for Review",
  "Approved": "Approved",
  "Rework": "Rework",
  "Done": "Done",
};

export function ListView({
  tasks,
  openGroups,
  toggleGroup,
  toggleTask,
  onAddTask,
  onTaskClick,
  onDeleteTask,
  onDuplicateTask,
  onMoveTask,
  phases = [],
  assignees = [],
}: ListViewProps) {
  const [groupByPhase, setGroupByPhase] = React.useState(false);
  const [openPhases, setOpenPhases] = React.useState<Record<string, boolean>>({});

  const togglePhaseGroup = (name: string) => {
    setOpenPhases((prev) => ({
      ...prev,
      [name]: prev[name] === false ? true : false,
    }));
  };

  const phaseGroups = React.useMemo(() => {
    const map: Record<string, { id: string | null; name: string; color: string; tasks: typeof tasks }> = {};

    tasks.forEach((t) => {
      const name = t.phaseName || "Unassigned";
      if (!map[name]) {
        map[name] = {
          id: t.phaseId || null,
          name,
          color: t.phaseColor || "#64748b",
          tasks: [],
        };
      }
      map[name].tasks.push(t);
    });

    return Object.values(map).sort((a, b) => {
      if (a.name === "Unassigned") return 1;
      if (b.name === "Unassigned") return -1;
      
      const phaseA = phases.find((p) => p.id === a.id);
      const phaseB = phases.find((p) => p.id === b.id);
      
      if (!phaseA?.startDate && !phaseB?.startDate) return a.name.localeCompare(b.name);
      if (!phaseA?.startDate) return 1;
      if (!phaseB?.startDate) return -1;
      
      const diff = new Date(phaseA.startDate).getTime() - new Date(phaseB.startDate).getTime();
      if (diff !== 0) return diff;
      
      if (!phaseA?.endDate && !phaseB?.endDate) return a.name.localeCompare(b.name);
      if (!phaseA?.endDate) return 1;
      if (!phaseB?.endDate) return -1;
      
      return new Date(phaseA.endDate).getTime() - new Date(phaseB.endDate).getTime();
    });
  }, [tasks, phases]);

  function getStatusBadge(status: Status, isHeader = false) {
    const label = STATUS_LABEL[status] || status;
    
    if (status === "To_Do") {
      return (
        <span className={cn(
          "inline-flex items-center rounded border border-dashed border-slate-350 bg-slate-50/50 text-slate-500 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-700",
          isHeader && "shadow-xs"
        )}>
          <Circle className="size-2.5 mr-1.5 text-slate-400 shrink-0" />
          {label}
        </span>
      );
    }

    const bgStyles: Record<Status, string> = {
      "To_Do": "",
      "In_Progress": "bg-blue-500 text-white",
      "Submitted_for_Review": "bg-amber-500 text-white",
      "Approved": "bg-teal-500 text-white",
      "Rework": "bg-rose-500 text-white",
      "Done": "bg-emerald-500 text-white",
    };

    return (
      <span className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs",
        bgStyles[status]
      )}>
        <CircleCheck className="size-2.5 mr-1.5 shrink-0" />
        {label}
      </span>
    );
  }

  const renderColumnHeaders = () => (
    <div className="flex items-center gap-4 px-3 py-1.5 border-b border-border/30 bg-slate-50/30 dark:bg-slate-900/10 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
      <div className="w-4 shrink-0" />
      <div className="w-4 shrink-0" />
      <div className="flex-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider text-left">
        Name
      </div>
      <div className="shrink-0 w-28 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Assignee
      </div>
      <div className="shrink-0 w-28 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Due Date
      </div>
      <div className="shrink-0 w-28 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Priority
      </div>
      <div className="shrink-0 w-32 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Status
      </div>
      <div className="shrink-0 w-18 text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wider text-center">
        Comments
      </div>
      <div className="shrink-0 w-12 text-[11px] font-medium text-slate-400 dark:text-slate-500 text-center flex items-center justify-center">
        <Plus className="size-3.5 text-muted-foreground/60 cursor-pointer hover:text-primary transition-colors" />
      </div>
    </div>
  );

  const renderTaskRow = (task: Task) => {
    const fullAssignee = task.owner?.id
      ? assignees.find((a) => a.userId === task.owner?.id)
      : null;
    const employeeData = fullAssignee
      ? {
          displayName: fullAssignee.displayName,
          email: fullAssignee.email,
          designation: fullAssignee.designation,
          role: fullAssignee.role,
          department: fullAssignee.department,
          employeeId: fullAssignee.employeeId,
        }
      : task.owner
      ? {
          displayName: task.owner.displayName,
          email: task.owner.email,
          role: "Assignee",
        }
      : null;

    return (
      <div
        key={task.id}
        className={cn(
          "flex items-center gap-4 px-3 py-2 border-b border-border/30 hover:bg-muted/30 transition-colors group cursor-pointer",
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
          ) : task.status === "In_Progress" ? (
            <CircleCheck className="size-4 text-blue-500 shrink-0" />
          ) : (
            <Circle className="size-4 text-muted-foreground shrink-0" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onTaskClick?.(task.id)}
          className={cn(
            "flex-1 text-sm min-w-0 truncate text-left hover:text-primary transition-colors",
            task.done ? "line-through text-muted-foreground" : "text-foreground"
          )}
        >
          {task.name}
        </button>
        <div className="shrink-0 w-28 flex items-center justify-center">
          {employeeData ? (
            <EmployeeTooltip employee={employeeData}>
              <span
                className={cn(
                  "inline-flex items-center justify-center size-6 rounded-full font-semibold text-white text-[10px] shrink-0 cursor-default",
                  task.assigneeColor
                )}
              >
                {task.assigneeInitials}
              </span>
            </EmployeeTooltip>
          ) : (
            <span className="inline-flex items-center justify-center size-6 rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 shrink-0 cursor-default hover:border-primary/50 transition-colors">
              <User className="size-3.5" />
            </span>
          )}
        </div>
        <div className="shrink-0 w-28 text-xs text-muted-foreground text-center flex items-center justify-center">
          {task.rawEndDate || (task.dueDate && task.dueDate !== "No due date") ? (
            <span>{formatDueDate(task.rawEndDate || task.dueDate)}</span>
          ) : (
            <span className="text-slate-350 hover:text-primary transition-colors cursor-pointer dark:text-slate-650">
              <Calendar className="size-4" />
            </span>
          )}
        </div>
        <div className="shrink-0 w-28 flex items-center justify-center gap-1">
          {task.priority ? (
            <>
              <Flag className={cn("size-3.5", PRIORITY_STYLES[task.priority])} />
              <span className={cn("text-xs font-medium", PRIORITY_STYLES[task.priority])}>
                {PRIORITY_LABEL[task.priority]}
              </span>
            </>
          ) : (
            <Flag className="size-3.5 text-slate-350 dark:text-slate-650" />
          )}
        </div>
        <div className="shrink-0 w-32 flex items-center justify-center">
          {getStatusBadge(task.status)}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTaskClick?.(task.id, "comments");
          }}
          className="shrink-0 w-18 flex items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <MessageSquare className="size-3.5" />
          {task.comments > 0 && <span className="text-xs font-semibold">{task.comments}</span>}
        </button>
        <div className="shrink-0 w-12 flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskClick?.(task.id);
                }}
              >
                Edit task
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateTask?.(task.id);
                }}
              >
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-rose-600 focus:text-rose-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTask?.(task.id);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* List View Toolbar */}
      <div className="flex items-center justify-between px-5 py-2 bg-slate-50/50 dark:bg-slate-950/20 border-b border-border/50 shrink-0">
        <span className="text-xs font-semibold text-slate-500">Tasks</span>
        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none text-slate-650 dark:text-slate-450 hover:text-slate-905 dark:hover:text-white">
          <input
            type="checkbox"
            checked={groupByPhase}
            onChange={(e) => setGroupByPhase(e.target.checked)}
            className="rounded border-slate-300 dark:border-white/10 accent-primary focus:ring-primary"
          />
          Group by Phase
        </label>
      </div>

      <div className="flex-1 overflow-y-auto">

        {groupByPhase ? (
          phaseGroups.map((group) => {
            const isOpen = openPhases[group.name] !== false;
            return (
              <div key={group.name} className="mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-background border-b border-border/30 sticky top-0 z-10">
                  <button
                    type="button"
                    onClick={() => togglePhaseGroup(group.name)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="inline-flex items-center rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                      <span
                        className="size-2 rounded-full shrink-0 mr-1.5"
                        style={{ backgroundColor: group.color }}
                      />
                      {group.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold ml-1">{group.tasks.length}</span>
                  </button>
                </div>

                {isOpen && (
                  <>
                    {renderColumnHeaders()}
                    {group.tasks.map((task) => renderTaskRow(task))}
                    {onAddTask && group.id && (
                      <div
                        onClick={() => onAddTask("To_Do", group.id)}
                        className="flex items-center gap-2 px-3 py-2 border-b border-border/30 hover:bg-muted/10 transition-colors cursor-pointer group"
                      >
                        <div className="w-4 shrink-0" />
                        <div className="w-4 shrink-0" />
                        <Plus className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                          Add Task to Phase
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        ) : (
          (["To_Do", "In_Progress", "Submitted_for_Review", "Approved", "Rework", "Done"] as Status[]).map((status) => {
            const groupTasks = tasks.filter((t) => t.status === status);
            const isOpen = openGroups.has(status);

            return (
              <div key={status} className="mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-background border-b border-border/30 sticky top-0 z-10">
                  <button
                    type="button"
                    onClick={() => toggleGroup(status)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    )}
                    {getStatusBadge(status, true)}
                    <span className="text-xs text-muted-foreground font-semibold ml-1">{groupTasks.length}</span>
                  </button>
                </div>

                {isOpen && (
                  <>
                    {renderColumnHeaders()}
                    {groupTasks.map((task) => renderTaskRow(task))}
                    {onAddTask && (
                      <div
                        onClick={() => onAddTask(status)}
                        className="flex items-center gap-2 px-3 py-2 border-b border-border/30 hover:bg-muted/10 transition-colors cursor-pointer group"
                      >
                        <div className="w-4 shrink-0" />
                        <div className="w-4 shrink-0" />
                        <Plus className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                          Add Task
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
