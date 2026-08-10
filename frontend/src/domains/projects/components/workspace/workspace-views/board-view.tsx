import { useState, useRef, useCallback, useMemo, type ReactNode, useEffect } from "react";
import { toast } from "react-hot-toast";
import { cn } from "@/shared/utils/cn";
import {
  Plus,
  Flag,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Loader2,
  User,
  CornerDownLeft,
  Pencil,
  Search,
  Layers,
  Clock3,
} from "lucide-react";
import type { ProjectPhase, ProjectTaskAssignee } from "@/domains/projects/types/projects.types";
import type { TaskDependency, TaskPriority } from "@/domains/projects/types/tasks.types";
import {
  usePaginatedStatusTasks,
  type StatusColumnFilters,
} from "@/domains/projects/hooks/use-paginated-status-tasks";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import {
  formatTaskDayLabel,
  taskDatesOutsidePhaseErrors,
  toTaskDayKey,
} from "../../../schemas/task/task-date-fields";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { Button } from "@/shared/ui/button";
import { toDateString } from "@/shared/utils/date";
import { BoardTaskDatePicker } from "./board-task-date-picker";
import { TaskDependenciesPicker } from "./task-predecessors-cell";
import { filterStatusOptionsForRole } from "../../tasks/task-progress-section";
import { EmployeeTooltip } from "../../shared/employee-tooltip";
import {
  TaskAssigneePicker,
  TaskStatusPicker,
  TaskCommentPicker,
  TaskPriorityPicker,
  assigneeAvatarInitials,
  assigneeAvatarColor,
  STATUS_PILL,
  STATUS_OPTIONS,
  type Status as TaskStatus,
  type ApiPriority,
  API_PRIORITY_OPTIONS,
  getPriorityColors,
} from "./task-cell-pickers";

type Priority = "high" | "medium" | "low" | "critical";
type Status = "To_Do" | "In_Progress" | "Submitted_for_Review" | "Approved" | "Rework" | "Done";

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

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
  parentTaskId?: string | null;
  depth?: number;
  children?: Task[];
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

const BOARD_EXTRAS: Record<string, Partial<Task>> = {};

function parseBoardYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export type BoardQuickCreatePayload = {
  title: string;
  phaseId: string;
  effortHours: number;
  ownerId?: string | null;
  startDate: string;
  endDate: string;
  priority: ApiPriority;
};

interface BoardViewProps {
  projectId: string;
  search?: string;
  priority?: TaskPriority;
  phases?: ProjectPhase[];
  /** Server totals per status (top-level). Falls back to loaded length if omitted. */
  statusCounts?: Partial<Record<Status, number>>;
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
  onUpdateTaskPriority?: (taskId: string, priority: ApiPriority) => Promise<void>;
  dependencies?: TaskDependency[];
}

function BoardStatusColumn({
  col,
  filters,
  statusCount,
  dragOverCol,
  dragOverTask,
  dragging,
  onColDragOver,
  onColDrop,
  onTaskDragOver,
  onTaskDrop,
  onDragStart,
  onDragEnd,
  addingInColumn,
  setAddingInColumn,
  onCreateTask,
  onRenameTask,
  onAssignTask,
  onUpdateTaskDates,
  canAssignTask,
  canEditDates,
  currentUserId,
  assignees,
  onTaskClick,
  canApproveTask,
  onMoveTask,
  onUpdateTaskPriority,
  dependencies = [],
  projectId,
  canEditDependencies = false,
  phases = [],
}: {
  col: ColumnDef;
  filters: StatusColumnFilters;
  statusCount?: number;
  dragOverCol: Status | null;
  dragOverTask: string | null;
  dragging: string | null;
  onColDragOver: (e: React.DragEvent, colId: Status) => void;
  onColDrop: (e: React.DragEvent, colId: Status) => void;
  onTaskDragOver: (e: React.DragEvent, taskId: string, colId: Status) => void;
  onTaskDrop: (e: React.DragEvent, beforeTaskId: string, colId: Status) => void;
  onDragStart: (e: React.DragEvent, taskId: string, fromStatus: Status) => void;
  onDragEnd: () => void;
  addingInColumn: Status | null;
  setAddingInColumn: (s: Status | null) => void;
  onCreateTask?: BoardViewProps["onCreateTask"];
  onRenameTask?: BoardViewProps["onRenameTask"];
  onAssignTask?: BoardViewProps["onAssignTask"];
  onUpdateTaskDates?: BoardViewProps["onUpdateTaskDates"];
  canAssignTask?: boolean;
  canEditDates?: boolean;
  currentUserId?: string;
  assignees?: ProjectTaskAssignee[];
  onTaskClick?: (taskId: string) => void;
  canApproveTask?: boolean;
  onMoveTask?: (taskId: string, toStatus: Status) => void;
  onUpdateTaskPriority?: BoardViewProps["onUpdateTaskPriority"];
  dependencies?: TaskDependency[];
  projectId: string;
  canEditDependencies?: boolean;
  phases?: ProjectPhase[];
}) {
  const { tasks, total, hasNextPage, isLoading, isFetching, loadMore } =
    usePaginatedStatusTasks(col.id, filters, { pageSize: 20 });

  const displayCount = typeof statusCount === "number" ? statusCount : total;
  const isOver = dragOverCol === col.id && dragOverTask === null;
  const overLimit = col.wipLimit !== undefined && displayCount > col.wipLimit;

  const enriched = useMemo(
    () =>
      tasks.map((t) => {
        const children = t.children ?? [];
        const subtasksTotal = children.length;
        const subtasksDone = children.filter(
          (c) => c.done || c.status === "Done" || c.status === "Approved",
        ).length;
        return {
          ...t,
          ...(BOARD_EXTRAS[t.id] ?? {}),
          hasSubtasks: children.length > 0 || t.hasSubtasks,
          subtasksTotal,
          subtasksDone,
          children,
        } as Task;
      }),
    [tasks],
  );

  return (
    <div
      className="flex flex-col w-[280px] shrink-0 h-full min-h-0"
      onDragOver={(e) => onColDragOver(e, col.id)}
      onDrop={(e) => onColDrop(e, col.id)}
    >
      <div
        className={cn(
          "flex flex-col flex-1 min-h-0 rounded-2xl px-2.5 pt-2.5 pb-2 transition-colors duration-150",
          isOver ? col.columnBgDrag : col.columnBg,
        )}
      >
        <div className="flex items-center gap-2 px-0.5 pb-2.5">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
              col.pillBg,
              col.pillText,
            )}
          >
            {col.shortLabel}
          </span>
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              overLimit ? "text-rose-500" : col.countText,
            )}
            title={
              col.wipLimit != null
                ? overLimit
                  ? `${displayCount} tasks (over WIP limit of ${col.wipLimit})`
                  : `${displayCount} tasks (WIP limit ${col.wipLimit})`
                : `${displayCount} tasks`
            }
          >
            {displayCount}
            {col.wipLimit != null && overLimit ? (
              <span className="ml-1 text-[10px] font-bold opacity-80">
                WIP {col.wipLimit}
              </span>
            ) : null}
          </span>
        </div>

        <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[72px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : (
            enriched.map((task) => (
              <div key={task.id}>
                {dragOverTask === task.id && (
                  <div className="h-0.5 rounded-full bg-primary mb-1.5 mx-1" />
                )}
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
                  onUpdateTaskPriority={onUpdateTaskPriority}
                  dependencies={dependencies}
                  projectId={projectId}
                  canEditDependencies={canEditDependencies}
                  onDragStart={(e) => onDragStart(e, task.id, col.id)}
                  onDragEnd={onDragEnd}
                  onDragOver={(e) => onTaskDragOver(e, task.id, col.id)}
                  onDrop={(e) => onTaskDrop(e, task.id, col.id)}
                />
              </div>
            ))
          )}

          {!isLoading && enriched.length === 0 && (
            <div className="flex items-center justify-center rounded-xl min-h-[72px]">
              <p className="text-[11px] text-muted-foreground/40">Drop tasks here</p>
            </div>
          )}

          {hasNextPage && (
            <button
              type="button"
              onClick={loadMore}
              disabled={isFetching}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
            >
              {isFetching ? (
                <Loader2 className="size-3 animate-spin" />
              ) : null}
              Load more
              {typeof statusCount === "number" && statusCount > enriched.length
                ? ` (${statusCount - enriched.length} left)`
                : ""}
            </button>
          )}

          {onCreateTask && (
            <ColumnInlineAddTask
              status={col.id}
              isActive={addingInColumn === col.id}
              onOpen={() => setAddingInColumn(col.id)}
              onClose={() => setAddingInColumn(null)}
              onCreateTask={onCreateTask}
              assignees={assignees ?? []}
              phases={phases}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function BoardView({
  projectId,
  search,
  priority,
  phases = [],
  statusCounts,
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
  onUpdateTaskPriority,
  dependencies = [],
}: BoardViewProps) {
  // Remove unused callback noise for column props that BoardCard does not use yet.
  void toggleTask;
  void onDeleteTask;
  void onDuplicateTask;
  void onSetDueDate;

  const { canEditDependencies } = useModulePermissions();

  const [addingInColumn, setAddingInColumn] = useState<Status | null>(null);

  const filters = useMemo(
    (): StatusColumnFilters => ({
      projectId,
      search,
      priority,
    }),
    [projectId, search, priority],
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
    setDragging(null);
    dragTaskId.current = null;
    dragFromCol.current = null;
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
    setDragging(null);
    dragTaskId.current = null;
    dragFromCol.current = null;
  }

  return (
    <div className="flex gap-3 p-4 h-full overflow-x-auto overflow-y-hidden items-stretch bg-white dark:bg-background">
      {COLUMNS.map((col) => (
        <BoardStatusColumn
          key={col.id}
          col={col}
          filters={filters}
          statusCount={statusCounts?.[col.id]}
          dragOverCol={dragOverCol}
          dragOverTask={dragOverTask}
          dragging={dragging}
          onColDragOver={handleColDragOver}
          onColDrop={handleColDrop}
          onTaskDragOver={handleTaskDragOver}
          onTaskDrop={handleTaskDrop}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          addingInColumn={addingInColumn}
          setAddingInColumn={setAddingInColumn}
          onCreateTask={onCreateTask}
          onRenameTask={onRenameTask}
          onAssignTask={onAssignTask}
          onUpdateTaskDates={onUpdateTaskDates}
          canAssignTask={canAssignTask}
          canEditDates={canEditDates}
          currentUserId={currentUserId}
          assignees={assignees}
          onTaskClick={onTaskClick}
          canApproveTask={canApproveTask}
          onMoveTask={onMoveTask}
          onUpdateTaskPriority={onUpdateTaskPriority}
          dependencies={dependencies}
          projectId={projectId}
          canEditDependencies={canEditDependencies}
          phases={phases}
        />
      ))}
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
  phases,
}: {
  status: Status;
  isActive: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCreateTask: (status: Status, payload: BoardQuickCreatePayload) => Promise<void>;
  assignees: ProjectTaskAssignee[];
  phases: ProjectPhase[];
}) {
  const [title, setTitle] = useState("");
  const [phaseId, setPhaseId] = useState<string>("");
  const [effortHours, setEffortHours] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState<ApiPriority>("Medium");
  const [expandedField, setExpandedField] = useState<
    "assignee" | "dates" | "priority" | "phase" | "effort" | null
  >(null);
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setTitle("");
    setPhaseId("");
    setEffortHours("");
    setOwnerId(null);
    setStartDate("");
    setEndDate("");
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
  const selectedPhase = phases.find((p) => p.id === phaseId);
  const parsedEffort = Number.parseInt(effortHours, 10);
  const effortMissing = effortHours.trim() === "";
  const effortInvalid =
    !effortMissing && (!Number.isInteger(parsedEffort) || parsedEffort < 1);

  const titleMissing = !title.trim();
  const phaseMissing = !phaseId;
  const effortRequiredInvalid = effortMissing || effortInvalid;
  const datesMissing = !startDate || !endDate;
  const datesOrderInvalid =
    !!startDate && !!endDate && startDate > endDate;

  const startAsDate = startDate ? parseBoardYmd(startDate) : undefined;
  const endAsDate = endDate ? parseBoardYmd(endDate) : undefined;
  const phaseDateErrors = taskDatesOutsidePhaseErrors({
    start: startAsDate ?? null,
    end: endAsDate ?? null,
    phaseStart: selectedPhase?.startDate,
    phaseEnd: selectedPhase?.endDate,
  });
  const startDateError =
    (showErrors && !startDate && "Start date is required") ||
    phaseDateErrors.startDate ||
    undefined;
  const endDateError =
    (showErrors && !endDate && "Due date is required") ||
    (datesOrderInvalid ? "Due date must be on or after start date" : undefined) ||
    phaseDateErrors.endDate ||
    undefined;
  const datesHaveErrors = Boolean(
    (showErrors && datesMissing) ||
      datesOrderInvalid ||
      phaseDateErrors.startDate ||
      phaseDateErrors.endDate,
  );
  const canSave = !isSubmitting;

  const phaseStartYmd = toTaskDayKey(selectedPhase?.startDate);
  const phaseEndYmd = toTaskDayKey(selectedPhase?.endDate);
  const phaseMin = phaseStartYmd ? parseBoardYmd(phaseStartYmd) : undefined;
  const phaseMax = phaseEndYmd ? parseBoardYmd(phaseEndYmd) : undefined;

  const isDateDisabled = (date: Date) => {
    const day = toDateString(date);
    if (phaseStartYmd && day < phaseStartYmd) return true;
    if (phaseEndYmd && day > phaseEndYmd) return true;
    return false;
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setShowErrors(true);
    if (
      titleMissing ||
      phaseMissing ||
      effortRequiredInvalid ||
      datesMissing ||
      datesOrderInvalid ||
      phaseDateErrors.startDate ||
      phaseDateErrors.endDate ||
      isSubmitting
    ) {
      if (!datesMissing || datesOrderInvalid || phaseDateErrors.startDate || phaseDateErrors.endDate) {
        setExpandedField("dates");
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateTask(status, {
        title: title.trim(),
        phaseId,
        effortHours: parsedEffort,
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
    return formatTaskDayLabel(value);
  };

  const setStartFromCalendar = (date: Date | undefined) => {
    const next = date ? toDateString(date) : "";
    setStartDate(next);
    if (next && endDate && next > endDate) {
      setEndDate(next);
    }
  };

  const setEndFromCalendar = (date: Date | undefined) => {
    setEndDate(date ? toDateString(date) : "");
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
            showErrors && titleMissing && "placeholder:text-destructive/70",
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
        {expandedField === "phase" ? (
          <div className="py-1 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Phase
            </p>
            <div className="max-h-28 overflow-y-auto space-y-0.5 rounded-md border border-border/50 p-1">
              {phases.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No phases available — add a phase first
                </p>
              ) : (
                phases.map((phase) => (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={() => {
                      setPhaseId(phase.id);
                      setStartDate("");
                      setEndDate("");
                      setExpandedField(null);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60",
                      phaseId === phase.id && "bg-primary/10 text-primary",
                    )}
                  >
                    <Layers className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{phase.name}</span>
                  </button>
                ))
              )}
            </div>
            {showErrors && phaseMissing && (
              <p className="text-[11px] text-destructive">Select a phase</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpandedField("phase")}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-xs transition-colors hover:bg-muted/40 hover:text-foreground",
              showErrors && phaseMissing
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            <Layers className="size-3.5 shrink-0" />
            {selectedPhase ? (
              <span className="font-medium text-foreground">{selectedPhase.name}</span>
            ) : (
              <span>Select phase</span>
            )}
          </button>
        )}

        {expandedField === "effort" ? (
          <div className="py-1 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Effort (hours)
            </p>
            <input
              type="number"
              min={1}
              step={1}
              value={effortHours}
              onChange={(e) => setEffortHours(e.target.value)}
              className="w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
              placeholder="e.g. 8"
            />
            {showErrors && effortRequiredInvalid && (
              <p className="text-[11px] text-destructive">
                {effortMissing
                  ? "Effort hours are required"
                  : "Enter a positive whole number of hours"}
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
            onClick={() => setExpandedField("effort")}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-xs transition-colors hover:bg-muted/40 hover:text-foreground",
              showErrors && effortRequiredInvalid
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            <Clock3 className="size-3.5 shrink-0" />
            {!effortMissing && !effortInvalid ? (
              <span className="font-medium text-foreground">{parsedEffort}h effort</span>
            ) : (
              <span>Add effort hours</span>
            )}
          </button>
        )}

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
                      ownerId === assignee.userId && "bg-primary/10 text-primary",
                    )}
                  >
                    <User className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{assignee.displayName || assignee.name}</span>
                  </button>
                ))
              )}
            </div>
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
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Dates
            </p>
            {!phaseId ? (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Select a phase first so dates stay within the phase range.
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Start</span>
                <Popover>
                  <PopoverTrigger
                    type="button"
                    disabled={!phaseId}
                    className={cn(
                      "flex h-8 w-full items-center justify-between rounded-md border bg-background px-2 text-xs outline-none disabled:opacity-50",
                      startDateError ? "border-destructive" : "border-border/60",
                    )}
                  >
                    <span className={startDate ? "text-foreground" : "text-muted-foreground"}>
                      {startDate ? formatDateLabel(startDate) : "Pick date"}
                    </span>
                    <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startAsDate}
                      onSelect={setStartFromCalendar}
                      disabled={isDateDisabled}
                      startMonth={phaseMin}
                      endMonth={phaseMax}
                    />
                  </PopoverContent>
                </Popover>
                {startDateError ? (
                  <p className="text-[10px] leading-snug text-destructive">{startDateError}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">Due</span>
                <Popover>
                  <PopoverTrigger
                    type="button"
                    disabled={!phaseId}
                    className={cn(
                      "flex h-8 w-full items-center justify-between rounded-md border bg-background px-2 text-xs outline-none disabled:opacity-50",
                      endDateError ? "border-destructive" : "border-border/60",
                    )}
                  >
                    <span className={endDate ? "text-foreground" : "text-muted-foreground"}>
                      {endDate ? formatDateLabel(endDate) : "Pick date"}
                    </span>
                    <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endAsDate}
                      onSelect={setEndFromCalendar}
                      disabled={(date) => {
                        if (startAsDate && date < startAsDate) return true;
                        return isDateDisabled(date);
                      }}
                      startMonth={phaseMin}
                      endMonth={phaseMax}
                    />
                  </PopoverContent>
                </Popover>
                {endDateError ? (
                  <p className="text-[10px] leading-snug text-destructive">{endDateError}</p>
                ) : null}
              </div>
            </div>
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
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-xs transition-colors hover:bg-muted/40 hover:text-foreground",
              datesHaveErrors ? "text-destructive" : "text-muted-foreground",
            )}
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
                      : "border-border/60 text-muted-foreground hover:bg-muted/50",
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
      {showErrors && phases.length === 0 && (
        <p className="px-2.5 pb-2 text-[11px] text-destructive">
          Add a project phase before creating tasks
        </p>
      )}
    </div>
  );
}

// BoardAssigneePicker, BoardStatusPicker, BoardCommentPicker are now
// shared via task-cell-pickers.tsx. Use the re-exported names here.
const BoardAssigneePicker = TaskAssigneePicker;
const BoardStatusPicker = TaskStatusPicker;
const BoardCommentPicker = TaskCommentPicker;
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
  onUpdateTaskPriority?: (taskId: string, priority: ApiPriority) => Promise<void>;
  dependencies?: TaskDependency[];
  projectId: string;
  canEditDependencies?: boolean;
}

function BoardCardMeta({
  task,
  onAssignTask,
  onUpdateTaskDates,
  canAssignTask = false,
  canEditDates = false,
  currentUserId,
  assignees = [],
  onUpdateTaskPriority,
  compact = false,
  dependencies = [],
  projectId,
  canEditDependencies = false,
}: {
  task: Task;
  onAssignTask?: (taskId: string, ownerId: string | null) => Promise<void>;
  onUpdateTaskDates?: (taskId: string, dates: { startDate: string; endDate: string }) => Promise<void>;
  canAssignTask?: boolean;
  canEditDates?: boolean;
  currentUserId?: string;
  assignees?: ProjectTaskAssignee[];
  onUpdateTaskPriority?: (taskId: string, priority: ApiPriority) => Promise<void>;
  compact?: boolean;
  dependencies?: TaskDependency[];
  projectId: string;
  canEditDependencies?: boolean;
}) {
  const overdue = task.dueDate && !task.dueDate.includes("-") ? isOverdue(task.dueDate) : false;
  const dueSoon =
    task.dueDate && !task.dueDate.includes("-") ? !overdue && isDueSoon(task.dueDate) : false;

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

  const avatarSize = compact ? "size-5 text-[9px]" : "size-6 text-[10px]";
  const iconSize = compact ? "size-3" : "size-3.5";

  const assigneeAvatar = task.assigneeId ? (
    employeeData ? (
      <EmployeeTooltip employee={employeeData}>
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 hover:opacity-85",
            avatarSize,
            task.assigneeColor,
          )}
        >
          {task.assigneeInitials}
        </span>
      </EmployeeTooltip>
    ) : (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 hover:opacity-85",
          avatarSize,
          task.assigneeColor,
        )}
      >
        {task.assigneeInitials}
      </span>
    )
  ) : (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 shrink-0 hover:border-primary/50 transition-colors",
        compact ? "size-5" : "size-6",
      )}
    >
      <User className={iconSize} />
    </span>
  );

  return (
    <div className="flex items-center gap-2">
      {canAssignTask && onAssignTask ? (
        <BoardAssigneePicker
          assignees={assignees}
          currentUserId={currentUserId}
          selectedUserId={task.assigneeId}
          onAssign={(ownerId) => onAssignTask(task.id, ownerId)}
        >
          {assigneeAvatar}
        </BoardAssigneePicker>
      ) : (
        assigneeAvatar
      )}

      <TaskDependenciesPicker
        taskId={task.id}
        projectId={projectId}
        dependencies={dependencies}
        canEdit={canEditDependencies}
      />

      {canEditDates && onUpdateTaskDates ? (
        <BoardTaskDatePicker
          startDate={task.rawStartDate}
          endDate={task.rawEndDate}
          onSave={(dates) => onUpdateTaskDates(task.id, dates)}
        >
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors hover:bg-muted/50",
              overdue
                ? "text-rose-500"
                : dueSoon
                  ? "text-amber-500"
                  : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Set dates"
          >
            <CalendarIcon className={cn(iconSize, "shrink-0")} />
            {task.dueDate && task.dueDate !== "No due date" ? (
              <span>{task.dueDate}</span>
            ) : null}
          </span>
        </BoardTaskDatePicker>
      ) : (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground",
            overdue && "text-rose-500",
            dueSoon && !overdue && "text-amber-500",
          )}
          aria-label="Dates"
        >
          <CalendarIcon className={cn(iconSize, "shrink-0")} />
          {task.dueDate && task.dueDate !== "No due date" && <span>{task.dueDate}</span>}
        </span>
      )}

      <div className="flex-1" />

      {onUpdateTaskPriority ? (
        <TaskPriorityPicker
          priority={task.priority}
          onPriorityChange={(priority) => onUpdateTaskPriority(task.id, priority)}
        >
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold transition-colors hover:bg-muted/50",
              getPriorityColors(task.priority).text,
            )}
            aria-label="Set priority"
            title={`Priority: ${task.priority || "Medium"}`}
          >
            <Flag className={cn(iconSize, "shrink-0")} />
            {!compact && <span>{PRIORITY_LABEL[task.priority] || "Medium"}</span>}
          </span>
        </TaskPriorityPicker>
      ) : (
        task.priority && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground",
              getPriorityColors(task.priority).text,
            )}
            title={`Priority: ${task.priority}`}
          >
            <Flag className={cn(iconSize, "shrink-0")} />
            {!compact && <span>{PRIORITY_LABEL[task.priority]}</span>}
          </span>
        )
      )}

      <BoardCommentPicker taskId={task.id} commentCount={task.comments} />
    </div>
  );
}

function BoardSubtaskCard({
  task,
  onTaskClick,
  onAssignTask,
  onUpdateTaskDates,
  canAssignTask = false,
  canEditDates = false,
  currentUserId,
  assignees = [],
  onUpdateTaskPriority,
  dependencies = [],
  projectId,
  canEditDependencies = false,
}: {
  task: Task;
  onTaskClick?: (id: string) => void;
  onAssignTask?: (taskId: string, ownerId: string | null) => Promise<void>;
  onUpdateTaskDates?: (taskId: string, dates: { startDate: string; endDate: string }) => Promise<void>;
  canAssignTask?: boolean;
  canEditDates?: boolean;
  currentUserId?: string;
  assignees?: ProjectTaskAssignee[];
  onUpdateTaskPriority?: (taskId: string, priority: ApiPriority) => Promise<void>;
  dependencies?: TaskDependency[];
  projectId: string;
  canEditDependencies?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-white dark:bg-zinc-950 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        task.done && "opacity-60",
      )}
    >
      <div className="px-2.5 pt-2 pb-2 space-y-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTaskClick?.(task.id);
          }}
          className={cn(
            "text-[13px] font-medium leading-snug text-left w-full hover:text-primary transition-colors",
            task.done ? "line-through text-muted-foreground" : "text-foreground",
          )}
        >
          {task.name}
        </button>
        <BoardCardMeta
          task={task}
          onAssignTask={onAssignTask}
          onUpdateTaskDates={onUpdateTaskDates}
          canAssignTask={canAssignTask}
          canEditDates={canEditDates}
          currentUserId={currentUserId}
          assignees={assignees}
          onUpdateTaskPriority={onUpdateTaskPriority}
          compact
          dependencies={dependencies}
          projectId={projectId}
          canEditDependencies={canEditDependencies}
        />
      </div>
    </div>
  );
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
  onUpdateTaskPriority,
  dependencies = [],
  projectId,
  canEditDependencies = false,
}: BoardCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(task.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const [subsExpanded, setSubsExpanded] = useState(false);
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

  const hasProgress = task.progress !== undefined;
  const subtaskCount = task.children?.length || task.subtasksTotal || 0;
  const hasSubs = subtaskCount > 0;

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
        isEditingName && "cursor-default",
      )}
    >
      <div className="px-3 pt-2.5 pb-2.5 space-y-2">
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
                task.done ? "line-through text-muted-foreground" : "text-foreground",
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

        {task.description && (
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
            {task.description}
          </p>
        )}

        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", tagColor(tag))}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

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
                        : "bg-muted-foreground/40",
                )}
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        )}

        <BoardCardMeta
          task={task}
          onAssignTask={onAssignTask}
          onUpdateTaskDates={onUpdateTaskDates}
          canAssignTask={canAssignTask}
          canEditDates={canEditDates}
          currentUserId={currentUserId}
          assignees={assignees}
          onUpdateTaskPriority={onUpdateTaskPriority}
          dependencies={dependencies}
          projectId={projectId}
          canEditDependencies={canEditDependencies}
        />

        {hasSubs && (
          <div className="space-y-2 pt-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSubsExpanded((v) => !v);
              }}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {subsExpanded ? (
                <ChevronDown className="size-3.5 shrink-0" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0" />
              )}
              <span>
                {subtaskCount} {subtaskCount === 1 ? "subtask" : "subtasks"}
              </span>
            </button>

            {subsExpanded && (task.children?.length ?? 0) > 0 && (
              <div className="ml-4 space-y-2">
                {task.children!.map((child) => (
                  <BoardSubtaskCard
                    key={child.id}
                    task={child}
                    onTaskClick={onTaskClick}
                    onAssignTask={onAssignTask}
                    onUpdateTaskDates={onUpdateTaskDates}
                    canAssignTask={canAssignTask}
                    canEditDates={canEditDates}
                    currentUserId={currentUserId}
                    assignees={assignees}
                    onUpdateTaskPriority={onUpdateTaskPriority}
                    dependencies={dependencies}
                    projectId={projectId}
                    canEditDependencies={canEditDependencies}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
