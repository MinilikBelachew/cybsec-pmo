"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/shared/utils/cn";
import {
  Plus,
  CircleCheck,
  Flag,
  Calendar as CalendarIcon,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  GripVertical,
  AlertCircle,
  Clock,
  CheckSquare,
} from "lucide-react";
import { Calendar } from "@/shared/ui/calendar";
import { type ProjectTaskAssignee } from "../../../types/projects.types";
import { EmployeeTooltip } from "../../shared/employee-tooltip";

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
  tags?: string[];
  subtasksDone?: number;
  subtasksTotal?: number;
  progress?: number;
  description?: string;
  emoji?: string;
  rawStartDate?: string | null;
  rawEndDate?: string | null;
  owner?: { id: string; displayName: string; email: string };
}

interface ColumnDef {
  id: Status;
  label: string;
  wipLimit?: number;
  borderColor: string;
  headerBg: string;
  headerText: string;
  dotClass: string;
  accentBar: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "To_Do",
    label: "To Do",
    wipLimit: 5,
    borderColor: "border-border/50",
    headerBg: "bg-muted/50",
    headerText: "text-foreground",
    dotClass: "border-2 border-muted-foreground/50 bg-transparent",
    accentBar: "bg-muted-foreground/20",
  },
  {
    id: "In_Progress",
    label: "In Progress",
    wipLimit: 3,
    borderColor: "border-blue-200 dark:border-blue-800/60",
    headerBg: "bg-blue-50/80 dark:bg-blue-900/20",
    headerText: "text-blue-700 dark:text-blue-300",
    dotClass: "bg-blue-500",
    accentBar: "bg-blue-400",
  },
  {
    id: "Submitted_for_Review",
    label: "Submitted for Review",
    wipLimit: 3,
    borderColor: "border-amber-200 dark:border-amber-800/60",
    headerBg: "bg-amber-50/80 dark:bg-amber-900/20",
    headerText: "text-amber-750 dark:text-amber-300",
    dotClass: "bg-amber-500",
    accentBar: "bg-amber-400",
  },
  {
    id: "Approved",
    label: "Approved",
    borderColor: "border-teal-200 dark:border-teal-800/60",
    headerBg: "bg-teal-50/80 dark:bg-teal-900/20",
    headerText: "text-teal-700 dark:text-teal-300",
    dotClass: "bg-teal-500",
    accentBar: "bg-teal-400",
  },
  {
    id: "Rework",
    label: "Rework",
    borderColor: "border-rose-200 dark:border-rose-800/60",
    headerBg: "bg-rose-50/80 dark:bg-rose-900/20",
    headerText: "text-rose-700 dark:text-rose-300",
    dotClass: "bg-rose-500",
    accentBar: "bg-rose-400",
  },
  {
    id: "Done",
    label: "Done",
    borderColor: "border-emerald-200 dark:border-emerald-800/60",
    headerBg: "bg-emerald-50/80 dark:bg-emerald-900/20",
    headerText: "text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
    accentBar: "bg-emerald-400",
  },
];

const PRIORITY_CONFIG: Record<Priority, { label: string; icon: string; text: string; bg: string }> = {
  critical: {
    label: "Critical",
    icon: "💀",
    text: "text-red-600 dark:text-red-400 font-bold",
    bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  },
  high: {
    label: "High",
    icon: "🔴",
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800",
  },
  medium: {
    label: "Medium",
    icon: "🟡",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
  },
  low: {
    label: "Low",
    icon: "🔵",
    text: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800",
  },
};

const TAG_COLORS = [
  "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
];

function tagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % TAG_COLORS.length;
  return TAG_COLORS[h];
}

function isDueSoon(dueDate: string) {
  const MONTHS: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const parts = dueDate.trim().split(" ");
  if (parts.length !== 2) return false;
  const d = new Date(2026, MONTHS[parts[0]] ?? 0, parseInt(parts[1], 10));
  const diff = (d.getTime() - Date.now()) / 86400000;
  return diff < 3;
}

function isOverdue(dueDate: string) {
  const MONTHS: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const parts = dueDate.trim().split(" ");
  if (parts.length !== 2) return false;
  const d = new Date(2026, MONTHS[parts[0]] ?? 0, parseInt(parts[1], 10));
  return d.getTime() < Date.now();
}

const BOARD_EXTRAS: Record<string, Partial<Task>> = {
  t1: {
    tags: ["Backend", "Setup"],
    subtasksDone: 1,
    subtasksTotal: 3,
    progress: 30,
    description: "Initialize repo, CI/CD pipeline, and folder structure.",
    emoji: "🏗️",
  },
  t2: {
    tags: ["API", "Design"],
    subtasksDone: 0,
    subtasksTotal: 2,
    progress: 0,
    description: "Define REST contracts and OpenAPI spec.",
    emoji: "📐",
  },
  t3: {
    tags: ["Auth", "Security"],
    subtasksDone: 3,
    subtasksTotal: 5,
    progress: 60,
    description: "JWT + refresh token flow with EntraID SSO.",
    emoji: "🔐",
  },
  t4: {
    tags: ["UI", "Design"],
    subtasksDone: 2,
    subtasksTotal: 4,
    progress: 50,
    description: "Tailwind tokens, component library, dark mode.",
    emoji: "🎨",
  },
  t5: {
    tags: ["Meeting"],
    subtasksDone: 1,
    subtasksTotal: 1,
    progress: 100,
    description: "Kickoff with all stakeholders.",
    emoji: "🚀",
  },
};

interface BoardViewProps {
  tasks: Task[];
  toggleTask: (id: string) => void;
  onAddTask?: (status: Status) => void;
  onTaskClick?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
  onMoveTask?: (taskId: string, toStatus: Status) => void;
  onSetDueDate?: (taskId: string, date: string | null) => void;
  assignees?: ProjectTaskAssignee[];
}

export function BoardView({
  tasks: externalTasks,
  toggleTask,
  onAddTask,
  onTaskClick,
  onDeleteTask,
  onDuplicateTask,
  onMoveTask,
  onSetDueDate,
  assignees = [],
}: BoardViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    setTasks(externalTasks.map((t) => ({ ...t, ...(BOARD_EXTRAS[t.id] ?? {}) })));
  }, [externalTasks]);

  const dragTaskId = useRef<string | null>(null);
  const dragFromCol = useRef<Status | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);
  const [dragOverTask, setDragOverTask] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const moveTask = useCallback((taskId: string, toStatus: Status, beforeTaskId?: string) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (!task) return prev;
      const without = prev.filter((t) => t.id !== taskId);
      const updated = { ...task, status: toStatus, done: toStatus === "Done" || toStatus === "Approved" };
      if (!beforeTaskId) return [...without, updated];
      const idx = without.findIndex((t) => t.id === beforeTaskId);
      const result = [...without];
      result.splice(idx === -1 ? result.length : idx, 0, updated);
      return result;
    });

    if (onMoveTask) {
      onMoveTask(taskId, toStatus);
    }
  }, [onMoveTask]);

  function handleDragStart(e: React.DragEvent, taskId: string, fromStatus: Status) {
    dragTaskId.current = taskId;
    dragFromCol.current = fromStatus;
    setDragging(taskId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    dragTaskId.current = null;
    dragFromCol.current = null;
    setDragging(null);
    setDragOverCol(null);
    setDragOverTask(null);
  }

  function handleColDragOver(e: React.DragEvent, colId: Status) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
    setDragOverTask(null);
  }

  function handleColDrop(e: React.DragEvent, colId: Status) {
    e.preventDefault();
    if (dragTaskId.current) moveTask(dragTaskId.current, colId);
    setDragOverCol(null);
    setDragOverTask(null);
  }

  function handleTaskDragOver(e: React.DragEvent, taskId: string, colId: Status) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
    setDragOverTask(taskId);
  }

  function handleTaskDrop(e: React.DragEvent, beforeTaskId: string, colId: Status) {
    e.preventDefault();
    e.stopPropagation();
    if (dragTaskId.current) moveTask(dragTaskId.current, colId, beforeTaskId);
    setDragOverCol(null);
    setDragOverTask(null);
  }

  return (
    <div className="flex gap-4 p-5 h-full overflow-x-auto overflow-y-hidden items-stretch bg-transparent">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        const isOver = dragOverCol === col.id && dragOverTask === null;
        const overLimit = col.wipLimit !== undefined && colTasks.length > col.wipLimit;

        return (
          <div
            key={col.id}
            className="flex flex-col w-[260px] shrink-0 h-full min-h-0"
            onDragOver={(e) => handleColDragOver(e, col.id)}
            onDrop={(e) => handleColDrop(e, col.id)}
          >
            {/* Column header */}
            <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-t-xl border border-b-0", col.borderColor, col.headerBg)}>
              {/* Accent dot */}
              <span className={cn("size-2.5 rounded-full shrink-0", col.dotClass)} />

              <span className={cn("text-xs font-bold tracking-wide flex-1", col.headerText)}>{col.label}</span>

              {/* Count + WIP */}
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                    overLimit ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" : "bg-background/60 text-muted-foreground"
                  )}
                >
                  {colTasks.length}
                  {col.wipLimit ? `/${col.wipLimit}` : ""}
                </span>
                <button
                  onClick={() => onAddTask && onAddTask(col.id)}
                  className="size-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Accent bar */}
            <div className={cn("h-0.5 w-full", col.accentBar)} />

            {/* Cards area */}
            <div
              className={cn(
                "flex flex-col gap-2 p-2 rounded-b-xl border flex-1 min-h-0 overflow-y-auto transition-colors duration-150",
                col.borderColor,
                isOver ? "bg-primary/5 border-primary/30" : "bg-muted/10 dark:bg-muted/5"
              )}
            >
              {colTasks.map((task) => (
                <div key={task.id}>
                  {/* Drop indicator above */}
                  {dragOverTask === task.id && <div className="h-0.5 rounded-full bg-primary mb-1.5 mx-1" />}
                  <BoardCard
                    task={task}
                    isDragging={dragging === task.id}
                    onToggle={toggleTask}
                    onTaskClick={onTaskClick}
                    onDragStart={(e) => handleDragStart(e, task.id, col.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleTaskDragOver(e, task.id, col.id)}
                    onDrop={(e) => handleTaskDrop(e, task.id, col.id)}
                    onDeleteTask={onDeleteTask}
                    onDuplicateTask={onDuplicateTask}
                    onMoveTask={onMoveTask}
                    onSetDueDate={onSetDueDate}
                    assignees={assignees}
                  />
                </div>
              ))}

              {/* Empty drop zone hint */}
              {colTasks.length === 0 && (
                <div
                  className={cn(
                    "flex-1 flex items-center justify-center rounded-xl border-2 border-dashed transition-colors duration-150 min-h-[80px]",
                    isOver ? "border-primary/40 bg-primary/5" : "border-border/30"
                  )}
                >
                  <p className="text-[11px] text-muted-foreground/50">Drop here</p>
                </div>
              )}

              {/* Add task */}
              <button
                onClick={() => onAddTask && onAddTask(col.id)}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors mt-0.5 group"
              >
                <Plus className="size-3.5 group-hover:text-primary transition-colors" />
                Add Task
              </button>
            </div>
          </div>
        );
      })}

      {/* Add group */}
      <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-dashed border-border/50 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all shrink-0 self-start mt-0">
        <Plus className="size-3.5" /> Add group
      </button>
    </div>
  );
}

// ─── Board Card Component ────────────────────────────────────────────────────────
interface BoardCardProps {
  task: Task;
  isDragging: boolean;
  onToggle: (id: string) => void;
  onTaskClick?: (id: string) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
  onMoveTask?: (taskId: string, toStatus: Status) => void;
  onSetDueDate?: (taskId: string, date: string | null) => void;
  assignees?: ProjectTaskAssignee[];
}

function BoardCard({
  task,
  isDragging,
  onToggle,
  onTaskClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDeleteTask,
  onDuplicateTask,
  onMoveTask,
  onSetDueDate,
  assignees = [],
}: BoardCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuState, setMenuState] = useState<"main" | "move" | "date">("main");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) {
      setMenuState("main");
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const overdue = task.dueDate && !task.dueDate.includes("-") ? isOverdue(task.dueDate) : false;
  const dueSoon = task.dueDate && !task.dueDate.includes("-") ? !overdue && isDueSoon(task.dueDate) : false;
  const pConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const hasProgress = task.progress !== undefined;
  const hasSubs = (task.subtasksTotal ?? 0) > 0;

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
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group relative bg-card border rounded-xl transition-all duration-150 cursor-grab active:cursor-grabbing select-none",
        isDragging ? "opacity-40 scale-95 shadow-none border-primary/30" : "border-border/60 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5",
        task.done && "opacity-60"
      )}
    >
      {/* Priority accent strip */}
      <div
        className={cn(
          "absolute top-0 left-0 w-1 h-full rounded-l-xl",
          task.priority === "critical" && "bg-red-500",
          task.priority === "high" && "bg-rose-400",
          task.priority === "medium" && "bg-amber-400",
          task.priority === "low" && "bg-sky-300"
        )}
      />

      <div className="pl-3 pr-3 pt-3 pb-2.5 space-y-2.5">
        {/* Top row: drag handle + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <GripVertical className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0 -ml-1" />
            {/* Status toggle */}
            <button onClick={() => onToggle(task.id)} className="shrink-0 mt-0.5" aria-label="Toggle done">
              {task.done ? (
                <CircleCheck className="size-4 text-emerald-500" />
              ) : (
                <div className="size-4 rounded-full border-2 border-muted-foreground/40 hover:border-primary transition-colors" />
              )}
            </button>
          </div>

          {/* More menu */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="opacity-0 group-hover:opacity-100 transition-opacity size-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
            {showMenu && (
              <div
                className={cn(
                  "absolute top-full end-0 mt-1 z-30 bg-popover border border-border/60 rounded-xl shadow-lg p-1.5 transition-all duration-150 bg-white dark:bg-slate-900",
                  menuState === "date" ? "w-[270px]" : "min-w-[140px]"
                )}
              >
                {menuState === "main" && (
                  <div className="space-y-0.5">
                    <button
                      onClick={() => {
                        onTaskClick?.(task.id);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted/60 transition-colors"
                    >
                      Edit task
                    </button>
                    <button
                      onClick={() => {
                        onDuplicateTask?.(task.id);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted/60 transition-colors"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => setMenuState("move")}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted/60 transition-colors flex items-center justify-between"
                    >
                      <span>Move to…</span>
                      <ChevronRight className="size-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => setMenuState("date")}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted/60 transition-colors flex items-center justify-between"
                    >
                      <span>Set due date</span>
                      <ChevronRight className="size-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        onDeleteTask?.(task.id);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}

                {menuState === "move" && (
                  <div>
                    <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/40 mb-1">
                      <button
                        onClick={() => setMenuState("main")}
                        className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Move task</span>
                    </div>
                    <div className="space-y-0.5">
                      {(["To_Do", "In_Progress", "Submitted_for_Review", "Approved", "Rework", "Done"] as const)
                        .filter((status) => status !== task.status)
                        .map((status) => (
                          <button
                            key={status}
                            onClick={() => {
                              onMoveTask?.(task.id, status);
                              setShowMenu(false);
                            }}
                            className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted/60 transition-colors"
                          >
                            {status === "To_Do"
                              ? "To Do"
                              : status === "In_Progress"
                              ? "In Progress"
                              : status === "Submitted_for_Review"
                              ? "Submitted for Review"
                              : status === "Approved"
                              ? "Approved"
                              : status === "Rework"
                              ? "Rework"
                              : "Done"}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {menuState === "date" && (
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/40 mb-1">
                      <button
                        onClick={() => setMenuState("main")}
                        className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Set due date</span>
                    </div>
                    <div className="p-1 flex justify-center">
                      <Calendar
                        mode="single"
                        selected={task.rawEndDate ? new Date(task.rawEndDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const formattedDate = date.toISOString().slice(0, 10);
                            onSetDueDate?.(task.id, formattedDate);
                          }
                          setShowMenu(false);
                        }}
                      />
                    </div>
                    <button
                      onClick={() => {
                        onSetDueDate?.(task.id, null);
                        setShowMenu(false);
                      }}
                      className="w-full text-center py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors border-t border-border/40 mt-1"
                    >
                      Clear due date
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Task name */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTaskClick?.(task.id);
          }}
          className={cn(
            "text-sm font-semibold leading-snug text-left w-full hover:text-primary transition-colors",
            task.done ? "line-through text-muted-foreground" : "text-foreground"
          )}
        >
          {task.name}
        </button>

        {/* Description snippet */}
        {task.description && <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{task.description}</p>}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span key={tag} className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", tagColor(tag))}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Progress bar */}
        {hasProgress && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Progress</span>
              <span className="text-[10px] font-semibold text-foreground">{task.progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  (task.progress ?? 0) === 100
                    ? "bg-emerald-500"
                    : (task.progress ?? 0) >= 60
                    ? "bg-blue-500"
                    : (task.progress ?? 0) >= 30
                    ? "bg-amber-400"
                    : "bg-muted-foreground/40"
                )}
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Subtasks */}
        {hasSubs && (
          <div className="flex items-center gap-1.5">
            <CheckSquare className="size-3 text-muted-foreground shrink-0" />
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60 transition-all duration-300"
                style={{ width: `${((task.subtasksDone ?? 0) / (task.subtasksTotal ?? 1)) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {task.subtasksDone}/{task.subtasksTotal}
            </span>
          </div>
        )}

        {/* Bottom meta row */}
        <div className="flex items-center gap-2 pt-0.5 border-t border-border/30">
          {/* Assignee */}
          <EmployeeTooltip employee={employeeData}>
            <span className={cn("inline-flex items-center justify-center size-5 rounded-full text-[9px] font-bold text-white shrink-0 cursor-default", task.assigneeColor)}>
              {task.assigneeInitials}
            </span>
          </EmployeeTooltip>

          {/* Due date */}
          <div
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium",
              overdue ? "text-rose-500" : dueSoon ? "text-amber-500" : "text-muted-foreground"
            )}
          >
            {overdue ? <AlertCircle className="size-3 shrink-0" /> : dueSoon ? <Clock className="size-3 shrink-0" /> : <CalendarIcon className="size-3 shrink-0" />}
            {task.dueDate}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Priority badge */}
          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md border", pConfig.bg, pConfig.text)}>{pConfig.label}</span>

          {/* Comments */}
          {task.comments > 0 && (
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <MessageSquare className="size-3" />
              {task.comments}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
