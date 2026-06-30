"use client";

import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { toast } from "react-hot-toast";
import { cn } from "@/shared/utils/cn";
import {
  Plus,
  Flag,
  Calendar as CalendarIcon,
  MessageSquare,
  CheckSquare,
  Loader2,
  User,
  CornerDownLeft,
  Pencil,
  Search,
  Send,
} from "lucide-react";
import type { ProjectTaskAssignee } from "@/domains/projects/types/projects.types";
import { useGetTaskCommentsQuery, useAddTaskCommentMutation } from "@/domains/projects";
import { defaultTaskDateRange } from "../../../schemas/task/task-date-fields";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { BoardTaskDatePicker } from "./board-task-date-picker";
import { filterStatusOptionsForRole } from "../../tasks/task-progress-section";
import { Calendar } from "@/shared/ui/calendar";
import { EmployeeTooltip } from "../../shared/employee-tooltip";

type Priority = "high" | "medium" | "low" | "critical";
type Status = "To_Do" | "In_Progress" | "Submitted_for_Review" | "Approved" | "Rework" | "Done";

interface Task {
  id: string;
  name: string;
  assigneeInitials: string;
  assigneeName?: string | null;
  assigneeId?: string | null;
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
  shortLabel: string;
  wipLimit?: number;
  pillBg: string;
  pillText: string;
  countText: string;
  columnBg: string;
  columnBgDrag: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "To_Do",
    label: "To Do",
    shortLabel: "TO DO",
    wipLimit: 5,
    pillBg: "bg-slate-500",
    pillText: "text-white",
    countText: "text-slate-500",
    columnBg: "bg-slate-500/[0.04] dark:bg-slate-400/10",
    columnBgDrag: "bg-slate-500/[0.07] dark:bg-slate-400/15",
  },
  {
    id: "In_Progress",
    label: "In Progress",
    shortLabel: "IN PROGRESS",
    wipLimit: 3,
    pillBg: "bg-blue-500",
    pillText: "text-white",
    countText: "text-blue-600 dark:text-blue-400",
    columnBg: "bg-blue-500/[0.05] dark:bg-blue-400/10",
    columnBgDrag: "bg-blue-500/[0.08] dark:bg-blue-400/15",
  },
  {
    id: "Submitted_for_Review",
    label: "Submitted for Review",
    shortLabel: "IN REVIEW",
    wipLimit: 3,
    pillBg: "bg-amber-500",
    pillText: "text-white",
    countText: "text-amber-600 dark:text-amber-400",
    columnBg: "bg-amber-500/[0.05] dark:bg-amber-400/10",
    columnBgDrag: "bg-amber-500/[0.08] dark:bg-amber-400/15",
  },
  {
    id: "Approved",
    label: "Approved",
    shortLabel: "APPROVED",
    pillBg: "bg-teal-500",
    pillText: "text-white",
    countText: "text-teal-600 dark:text-teal-400",
    columnBg: "bg-teal-500/[0.05] dark:bg-teal-400/10",
    columnBgDrag: "bg-teal-500/[0.08] dark:bg-teal-400/15",
  },
  {
    id: "Rework",
    label: "Rework",
    shortLabel: "REWORK",
    pillBg: "bg-rose-500",
    pillText: "text-white",
    countText: "text-rose-600 dark:text-rose-400",
    columnBg: "bg-rose-500/[0.05] dark:bg-rose-400/10",
    columnBgDrag: "bg-rose-500/[0.08] dark:bg-rose-400/15",
  },
  {
    id: "Done",
    label: "Done",
    shortLabel: "DONE",
    pillBg: "bg-emerald-500",
    pillText: "text-white",
    countText: "text-emerald-600 dark:text-emerald-400",
    columnBg: "bg-emerald-500/[0.05] dark:bg-emerald-400/10",
    columnBgDrag: "bg-emerald-500/[0.08] dark:bg-emerald-400/15",
  },
];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "To_Do", label: "To Do" },
  { value: "In_Progress", label: "In Progress" },
  { value: "Submitted_for_Review", label: "Submitted for Review" },
  { value: "Approved", label: "Approved" },
  { value: "Rework", label: "Rework" },
  { value: "Done", label: "Done" },
];

const STATUS_PILL: Record<Status, string> = {
  To_Do: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  In_Progress: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Submitted_for_Review: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Approved: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  Rework: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  Done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
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

type ApiPriority = "Low" | "Medium" | "High" | "Critical";

export type BoardQuickCreatePayload = {
  title: string;
  ownerId?: string | null;
  startDate: string;
  endDate: string;
  priority: ApiPriority;
};

const API_PRIORITY_OPTIONS: { value: ApiPriority; label: string }[] = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" },
];

interface BoardViewProps {
  tasks: Task[];
  toggleTask: (id: string) => void;
  onCreateTask?: (status: Status, payload: BoardQuickCreatePayload) => Promise<void>;
  onRenameTask?: (taskId: string, title: string) => Promise<void>;
  onAssignTask?: (taskId: string, ownerId: string | null) => Promise<void>;
  onUpdateTaskDates?: (taskId: string, dates: { startDate: string; endDate: string }) => Promise<void>;
  canAssignTask?: boolean;
  canEditDates?: boolean;
  currentUserId?: string;
  assignees?: ProjectTaskAssignee[];
  onTaskClick?: (taskId: string) => void;
  canApproveTask?: boolean;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
  onMoveTask?: (taskId: string, toStatus: Status) => void;
  onSetDueDate?: (taskId: string, date: string | null) => void;
  assignees?: ProjectTaskAssignee[];
}

export function BoardView({
  tasks: externalTasks,
  toggleTask,
  onCreateTask,
  onRenameTask,
  onAssignTask,
  onUpdateTaskDates,
  canAssignTask = false,
  canEditDates = false,
  currentUserId,
  assignees = [],
  onTaskClick,
  canApproveTask = false,
  onDeleteTask,
  onDuplicateTask,
  onMoveTask,
  onSetDueDate,
  assignees = [],
}: BoardViewProps) {
  const [addingInColumn, setAddingInColumn] = useState<Status | null>(null);

  const tasks = useMemo(
    () => externalTasks.map((t) => ({ ...t, ...(BOARD_EXTRAS[t.id] ?? {}) })),
    [externalTasks],
  );

  const dragTaskId = useRef<string | null>(null);
  const dragFromCol = useRef<Status | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);
  const [dragOverTask, setDragOverTask] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const moveTask = useCallback((taskId: string, toStatus: Status) => {
    onMoveTask?.(taskId, toStatus);
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

  function handleTaskDrop(e: React.DragEvent, _beforeTaskId: string, colId: Status) {
    e.preventDefault();
    e.stopPropagation();
    if (dragTaskId.current) moveTask(dragTaskId.current, colId);
    setDragOverCol(null);
    setDragOverTask(null);
  }

  return (
    <div className="flex gap-3 p-4 h-full overflow-x-auto overflow-y-hidden items-stretch bg-white dark:bg-background">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        const isOver = dragOverCol === col.id && dragOverTask === null;
        const overLimit = col.wipLimit !== undefined && colTasks.length > col.wipLimit;

        return (
          <div
            key={col.id}
            className="flex flex-col w-[280px] shrink-0 h-full min-h-0"
            onDragOver={(e) => handleColDragOver(e, col.id)}
            onDrop={(e) => handleColDrop(e, col.id)}
          >
            <div
              className={cn(
                "flex flex-col flex-1 min-h-0 rounded-2xl px-2.5 pt-2.5 pb-2 transition-colors duration-150",
                isOver ? col.columnBgDrag : col.columnBg
              )}
            >
              <div className="flex items-center gap-2 px-0.5 pb-2.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                    col.pillBg,
                    col.pillText
                  )}
                >
                  {col.shortLabel}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    overLimit ? "text-rose-500" : col.countText
                  )}
                >
                  {colTasks.length}
                  {col.wipLimit ? `/${col.wipLimit}` : ""}
                </span>
              </div>

              <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
                {colTasks.map((task) => (
                  <div key={task.id}>
                    {dragOverTask === task.id && <div className="h-0.5 rounded-full bg-primary mb-1.5 mx-1" />}
                    <BoardCard
                      task={task}
                      isDragging={dragging === task.id}
                      onTaskClick={onTaskClick}
                      onMoveTask={onMoveTask}
                      canApproveTask={canApproveTask}
                      onRenameTask={onRenameTask}
                      onAssignTask={onAssignTask}
                      onUpdateTaskDates={onUpdateTaskDates}
                      canAssignTask={canAssignTask}
                      canEditDates={canEditDates}
                      currentUserId={currentUserId}
                      assignees={assignees}
                      onDragStart={(e) => handleDragStart(e, task.id, col.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleTaskDragOver(e, task.id, col.id)}
                      onDrop={(e) => handleTaskDrop(e, task.id, col.id)}
                    />
                  </div>
                ))}

                {colTasks.length === 0 && (
                  <div className="flex items-center justify-center rounded-xl min-h-[72px]">
                    <p className="text-[11px] text-muted-foreground/40">Drop tasks here</p>
                  </div>
                )}

                {onCreateTask && (
                  <ColumnInlineAddTask
                    status={col.id}
                    isActive={addingInColumn === col.id}
                    onOpen={() => setAddingInColumn(col.id)}
                    onClose={() => setAddingInColumn(null)}
                    onCreateTask={onCreateTask}
                    assignees={assignees}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ColumnInlineAddTask({
  status,
  isActive,
  onOpen,
  onClose,
  onCreateTask,
  assignees,
}: {
  status: Status;
  isActive: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCreateTask: (status: Status, payload: BoardQuickCreatePayload) => Promise<void>;
  assignees: ProjectTaskAssignee[];
}) {
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState<ApiPriority>("Medium");
  const [expandedField, setExpandedField] = useState<"assignee" | "dates" | "priority" | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    const { startDate: defaultStart, endDate: defaultEnd } = defaultTaskDateRange();
    setTitle("");
    setOwnerId(null);
    setStartDate(defaultStart.toISOString().slice(0, 10));
    setEndDate(defaultEnd.toISOString().slice(0, 10));
    setPriority("Medium");
    setExpandedField(null);
    setShowErrors(false);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    resetForm();
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isActive, resetForm]);

  const selectedAssignee = assignees.find((a) => a.userId === ownerId);

  const titleMissing = !title.trim();
  const assigneeMissing = expandedField === "assignee" && !ownerId;
  const datesMissing = expandedField === "dates" && (!startDate || !endDate);
  const datesInvalid =
    expandedField === "dates" &&
    !!startDate &&
    !!endDate &&
    new Date(endDate) < new Date(startDate);
  const canSave = !isSubmitting;

  const handleCancel = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setShowErrors(true);
    if (titleMissing || assigneeMissing || datesMissing || datesInvalid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onCreateTask(status, {
        title: title.trim(),
        ownerId,
        startDate,
        endDate,
        priority,
      });
      resetForm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateLabel = (value: string) => {
    if (!value) return "";
    const d = new Date(value);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  if (!isActive) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-1.5 w-full px-1 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors group"
      >
        <Plus className="size-3.5 group-hover:scale-105 transition-transform" />
        Add Task
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border/70 bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 p-2.5 border-b border-border/40">
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSubmit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              handleCancel();
            }
          }}
          placeholder="Task Name..."
          disabled={isSubmitting}
          className={cn(
            "flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 disabled:opacity-50",
            showErrors && titleMissing && "placeholder:text-destructive/70"
          )}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSave}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? <Loader2 className="size-3 animate-spin" /> : <CornerDownLeft className="size-3" />}
          Save
        </button>
      </div>

      <div className="px-2.5 py-1.5 space-y-0.5">
        {expandedField === "assignee" ? (
          <div className="py-1 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assignee</p>
            <div className="max-h-28 overflow-y-auto space-y-0.5 rounded-md border border-border/50 p-1">
              {assignees.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No assignees available</p>
              ) : (
                assignees.map((assignee) => (
                  <button
                    key={assignee.userId}
                    type="button"
                    onClick={() => {
                      setOwnerId(assignee.userId);
                      setExpandedField(null);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60",
                      ownerId === assignee.userId && "bg-primary/10 text-primary"
                    )}
                  >
                    <User className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{assignee.displayName || assignee.name}</span>
                  </button>
                ))
              )}
            </div>
            {showErrors && assigneeMissing && (
              <p className="text-[11px] text-destructive">Select an assignee</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpandedField("assignee")}
            className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <User className="size-3.5 shrink-0" />
            {selectedAssignee ? (
              <span className="font-medium text-foreground">{selectedAssignee.displayName || selectedAssignee.name}</span>
            ) : (
              <span>Add assignee</span>
            )}
          </button>
        )}

        {expandedField === "dates" ? (
          <div className="py-1 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dates</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Start</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none focus:border-ring"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Due</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none focus:border-ring"
                />
              </label>
            </div>
            {showErrors && (datesMissing || datesInvalid) && (
              <p className="text-[11px] text-destructive">
                {datesInvalid ? "Due date must be on or after start date" : "Start and due dates are required"}
              </p>
            )}
            <button
              type="button"
              onClick={() => setExpandedField(null)}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Done
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpandedField("dates")}
            className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <CalendarIcon className="size-3.5 shrink-0" />
            {startDate && endDate ? (
              <span className="font-medium text-foreground">
                {formatDateLabel(startDate)} – {formatDateLabel(endDate)}
              </span>
            ) : (
              <span>Add dates</span>
            )}
          </button>
        )}

        {expandedField === "priority" ? (
          <div className="py-1 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Priority</p>
            <div className="flex flex-wrap gap-1">
              {API_PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setPriority(option.value);
                    setExpandedField(null);
                  }}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                    priority === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpandedField("priority")}
            className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <Flag className="size-3.5 shrink-0" />
            <span className={priority !== "Medium" ? "font-medium text-foreground" : undefined}>
              {priority === "Medium" ? "Add priority" : priority}
            </span>
          </button>
        )}
      </div>

      {showErrors && titleMissing && (
        <p className="px-2.5 pb-2 text-[11px] text-destructive">Task name is required</p>
      )}
    </div>
  );
}

const ASSIGNEE_AVATAR_COLORS = [
  "bg-slate-600",
  "bg-violet-600",
  "bg-sky-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
];

function assigneeAvatarInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function assigneeAvatarColor(userId: string) {
  return ASSIGNEE_AVATAR_COLORS[userId.charCodeAt(0) % ASSIGNEE_AVATAR_COLORS.length];
}

function BoardAssigneePicker({
  assignees,
  currentUserId,
  selectedUserId,
  onAssign,
  children,
}: {
  assignees: ProjectTaskAssignee[];
  currentUserId?: string;
  selectedUserId?: string | null;
  onAssign: (userId: string | null) => Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assignees;
    return assignees.filter((a) => {
      const name = (a.displayName || a.name).toLowerCase();
      return name.includes(q) || a.email.toLowerCase().includes(q);
    });
  }, [assignees, query]);

  const handleSelect = async (userId: string | null) => {
    if (isAssigning) return;
    setIsAssigning(true);
    try {
      await onAssign(userId);
      setOpen(false);
      setQuery("");
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        type="button"
        disabled={isAssigning}
        className="text-left disabled:opacity-50"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-64 p-0" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-border/50 p-2">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or enter email..."
              className="flex-1 min-w-0 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-56 overflow-y-auto p-1.5">
          {selectedUserId && (
            <button
              type="button"
              onClick={() => void handleSelect(null)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Unassigned
            </button>
          )}

          <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            People
          </p>

          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No people found</p>
          ) : (
            filtered.map((assignee) => {
              const name = assignee.displayName || assignee.name;
              const isMe = currentUserId === assignee.userId;
              const isSelected = selectedUserId === assignee.userId;

              return (
                <button
                  key={assignee.userId}
                  type="button"
                  onClick={() => void handleSelect(assignee.userId)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50",
                    isSelected && "bg-primary/10"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                      assigneeAvatarColor(assignee.userId)
                    )}
                  >
                    {assigneeAvatarInitials(name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {isMe ? "Me" : name}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BoardStatusPicker({
  task,
  currentUserId,
  canApproveTask,
  onStatusChange,
}: {
  task: Task;
  currentUserId?: string;
  canApproveTask: boolean;
  onStatusChange: (taskId: string, status: Status) => void;
}) {
  const [open, setOpen] = useState(false);

  const statusOptions = useMemo(
    () =>
      filterStatusOptionsForRole(
        task.status,
        STATUS_OPTIONS,
        currentUserId === task.assigneeId,
        canApproveTask,
      ),
    [task.status, task.assigneeId, currentUserId, canApproveTask],
  );

  const canChange = statusOptions.length > 1;
  const currentLabel = STATUS_OPTIONS.find((o) => o.value === task.status)?.label ?? task.status;

  const pill = (
    <span
      className={cn(
        "text-[9px] font-bold px-1.5 py-0.5 rounded-md",
        STATUS_PILL[task.status],
        canChange && "cursor-pointer hover:opacity-80"
      )}
    >
      {currentLabel}
    </span>
  );

  if (!canChange) {
    return pill;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className="text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {pill}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1.5" onClick={(e) => e.stopPropagation()}>
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Status
        </p>
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              if (opt.value !== task.status) {
                onStatusChange(task.id, opt.value);
              }
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted/50",
              opt.value === task.status && "bg-primary/10 text-primary"
            )}
          >
            {opt.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function BoardCommentPicker({
  taskId,
  commentCount,
}: {
  taskId: string;
  commentCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const { data: comments = [], isLoading, isFetching } = useGetTaskCommentsQuery(taskId, {
    skip: !open,
  });
  const [addComment, { isLoading: isAdding }] = useAddTaskCommentMutation();

  const handleSubmit = async () => {
    const body = commentText.trim();
    if (!body || isAdding) return;
    try {
      await addComment({ taskId, body, isInternal: true }).unwrap();
      setCommentText("");
      toast.success("Comment added");
    } catch (err: unknown) {
      const apiError = err as { data?: { errors?: Record<string, string>; message?: string } };
      toast.error(
        apiError?.data?.message ??
          Object.values(apiError?.data?.errors ?? {})[0] ??
          "Failed to add comment",
      );
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setCommentText("");
      }}
    >
      <PopoverTrigger
        type="button"
        className="inline-flex items-center gap-0.5 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
        aria-label="Comments"
      >
        <MessageSquare className="size-3.5" />
        {commentCount > 0 && (
          <span className="text-[10px] font-medium tabular-nums">{commentCount}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-border/50 px-3 py-2">
          <p className="text-xs font-semibold text-foreground">Comments</p>
        </div>

        <div className="max-h-52 overflow-y-auto p-2 space-y-2">
          {isLoading || isFetching ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No comments yet.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-foreground">
                    {comment.author.displayName}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-xs text-foreground/90 whitespace-pre-wrap">{comment.body}</p>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border/50 p-2 space-y-2">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a comment..."
            rows={2}
            className="flex w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={!commentText.trim() || isAdding}
              onClick={() => void handleSubmit()}
            >
              {isAdding ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="size-3" />
                  Post
                </>
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Board Card Component ────────────────────────────────────────────────────────
interface BoardCardProps {
  task: Task;
  isDragging: boolean;
  onTaskClick?: (id: string) => void;
  onMoveTask?: (taskId: string, toStatus: Status) => void;
  canApproveTask?: boolean;
  onRenameTask?: (taskId: string, title: string) => Promise<void>;
  onAssignTask?: (taskId: string, ownerId: string | null) => Promise<void>;
  onUpdateTaskDates?: (taskId: string, dates: { startDate: string; endDate: string }) => Promise<void>;
  canAssignTask?: boolean;
  canEditDates?: boolean;
  currentUserId?: string;
  assignees?: ProjectTaskAssignee[];
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function BoardCard({
  task,
  isDragging,
  onTaskClick,
  onMoveTask,
  canApproveTask = false,
  onRenameTask,
  onAssignTask,
  onUpdateTaskDates,
  canAssignTask = false,
  canEditDates = false,
  currentUserId,
  assignees = [],
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: BoardCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(task.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditingName) {
      setNameDraft(task.name);
    }
  }, [task.name, isEditingName]);

  useEffect(() => {
    if (!isEditingName) return;
    const frame = requestAnimationFrame(() => nameInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isEditingName]);

  const overdue = task.dueDate && !task.dueDate.includes("-") ? isOverdue(task.dueDate) : false;
  const dueSoon = task.dueDate && !task.dueDate.includes("-") ? !overdue && isDueSoon(task.dueDate) : false;
  const hasProgress = task.progress !== undefined;
  const hasSubs = (task.subtasksTotal ?? 0) > 0;
  const assigneeLabel = task.assigneeName?.trim() || "Unassigned";

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === task.name) {
      setNameDraft(task.name);
      setIsEditingName(false);
      return;
    }
    if (!onRenameTask) {
      setIsEditingName(false);
      return;
    }
    setIsSavingName(true);
    try {
      await onRenameTask(task.id, trimmed);
      setIsEditingName(false);
    } catch {
      setNameDraft(task.name);
    } finally {
      setIsSavingName(false);
    }
  };

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
      draggable={!isEditingName}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group relative rounded-xl transition-all duration-150 cursor-grab active:cursor-grabbing select-none",
        "bg-white dark:bg-zinc-950 shadow-[0_1px_3px_rgba(15,23,42,0.05)]",
        isDragging ? "opacity-40 scale-95 shadow-none" : "",
        task.done && "opacity-60",
        isEditingName && "cursor-default"
      )}
    >
      <div className="px-3 pt-2.5 pb-2.5 space-y-2">
        {/* Task name + edit action */}
        <div className="flex items-start justify-between gap-2">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveName();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setNameDraft(task.name);
                  setIsEditingName(false);
                }
              }}
              onBlur={() => void saveName()}
              disabled={isSavingName}
              className="flex-1 min-w-0 bg-transparent text-sm font-semibold leading-snug outline-none border-b border-primary/40 pb-0.5"
            />
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTaskClick?.(task.id);
              }}
              className={cn(
                "text-sm font-semibold leading-snug text-left flex-1 min-w-0 hover:text-primary transition-colors",
                task.done ? "line-through text-muted-foreground" : "text-foreground"
              )}
            >
              {task.name}
            </button>
          )}

          {onRenameTask && !isEditingName && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingName(true);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/50 bg-background/80"
              aria-label="Edit task name"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
        </div>

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
        <div className="flex items-center gap-2 pt-1">
          {canAssignTask && onAssignTask ? (
            <BoardAssigneePicker
              assignees={assignees}
              currentUserId={currentUserId}
              selectedUserId={task.assigneeId}
              onAssign={(ownerId) => onAssignTask(task.id, ownerId)}
            >
              {task.assigneeId ? (
                <span className="text-[10px] font-medium truncate max-w-[100px] text-foreground transition-colors hover:text-primary">
                  {assigneeLabel}
                </span>
              ) : (
                <User className="size-3.5 text-muted-foreground transition-colors hover:text-foreground" />
              )}
            </BoardAssigneePicker>
          ) : task.assigneeId ? (
            <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[100px]">
              {assigneeLabel}
            </span>
          ) : (
            <User className="size-3.5 text-muted-foreground" aria-label="Unassigned" />
          )}

          {canEditDates && onUpdateTaskDates ? (
            <BoardTaskDatePicker
              startDate={task.rawStartDate}
              endDate={task.rawEndDate}
              onSave={(dates) => onUpdateTaskDates(task.id, dates)}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-md p-0.5 transition-colors hover:bg-muted/50",
                  overdue ? "text-rose-500" : dueSoon ? "text-amber-500" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Set dates"
              >
                <CalendarIcon className="size-3.5 shrink-0" />
              </span>
            </BoardTaskDatePicker>
          ) : (
            <span
              className={cn(
                "inline-flex items-center justify-center text-muted-foreground",
                overdue && "text-rose-500",
                dueSoon && !overdue && "text-amber-500"
              )}
              aria-label="Dates"
            >
              <CalendarIcon className="size-3.5 shrink-0" />
            </span>
          )}

          <div className="flex-1" />

          {onMoveTask ? (
            <BoardStatusPicker
              task={task}
              currentUserId={currentUserId}
              canApproveTask={canApproveTask}
              onStatusChange={onMoveTask}
            />
          ) : (
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md", STATUS_PILL[task.status])}>
              {STATUS_OPTIONS.find((o) => o.value === task.status)?.label}
            </span>
          )}

          <BoardCommentPicker taskId={task.id} commentCount={task.comments} />
        </div>
      </div>
    </div>
  );
}
