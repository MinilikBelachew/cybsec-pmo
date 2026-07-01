"use client";

/**
 * Shared inline task cell pickers.
 * Used by both BoardCard (board-view.tsx) and task rows (list-view.tsx).
 */

import { useState, useMemo, type ReactNode } from "react";
import { Search, Loader2, Send, MessageSquare, Flag } from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "@/shared/utils/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { filterStatusOptionsForRole } from "../../tasks/task-progress-section";
import { useGetTaskCommentsQuery, useAddTaskCommentMutation } from "@/domains/projects";
import type { ProjectTaskAssignee } from "@/domains/projects/types/projects.types";

// Re-export the date picker so consumers only need one import file
export { BoardTaskDatePicker as TaskDatePicker } from "./board-task-date-picker";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "To_Do" | "In_Progress" | "Submitted_for_Review" | "Approved" | "Rework" | "Done";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "To_Do", label: "To Do" },
  { value: "In_Progress", label: "In Progress" },
  { value: "Submitted_for_Review", label: "Submitted for Review" },
  { value: "Approved", label: "Approved" },
  { value: "Rework", label: "Rework" },
  { value: "Done", label: "Done" },
];

export const STATUS_PILL: Record<Status, string> = {
  To_Do: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  In_Progress: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Submitted_for_Review: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Approved: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  Rework: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  Done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

// ─── Avatar helpers ────────────────────────────────────────────────────────────

const ASSIGNEE_AVATAR_COLORS = [
  "bg-slate-600",
  "bg-violet-600",
  "bg-sky-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
];

export function assigneeAvatarInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function assigneeAvatarColor(userId: string) {
  return ASSIGNEE_AVATAR_COLORS[userId.charCodeAt(0) % ASSIGNEE_AVATAR_COLORS.length];
}

// ─── TaskAssigneePicker ────────────────────────────────────────────────────────

interface TaskAssigneePickerProps {
  assignees: ProjectTaskAssignee[];
  currentUserId?: string;
  selectedUserId?: string | null;
  onAssign: (userId: string | null) => Promise<void>;
  children: ReactNode;
}

export function TaskAssigneePicker({
  assignees,
  currentUserId,
  selectedUserId,
  onAssign,
  children,
}: TaskAssigneePickerProps) {
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

// ─── TaskStatusPicker ─────────────────────────────────────────────────────────

interface TaskStatusPickerProps {
  task: {
    id: string;
    status: Status;
    assigneeId?: string | null;
  };
  currentUserId?: string;
  canApproveTask: boolean;
  onStatusChange: (taskId: string, status: Status) => void;
  children?: ReactNode;
}

export function TaskStatusPicker({
  task,
  currentUserId,
  canApproveTask,
  onStatusChange,
  children,
}: TaskStatusPickerProps) {
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

  const pill = children || (
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
    return <>{pill}</>;
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

// ─── TaskCommentPicker ────────────────────────────────────────────────────────

interface TaskCommentPickerProps {
  taskId: string;
  commentCount: number;
  children?: ReactNode;
}

export function TaskCommentPicker({ taskId, commentCount, children }: TaskCommentPickerProps) {
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
        {children || <MessageSquare className="size-3.5" />}
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

// Re-export STATUS_OPTIONS for use in consumers
export { STATUS_OPTIONS };
export type { Status };

// ─── TaskPriorityPicker ──────────────────────────────────────────────────────

export type ApiPriority = "Low" | "Medium" | "High" | "Critical";

export const PRIORITY_COLORS = {
  low: {
    text: "text-slate-400 dark:text-white/30",
    bg: "bg-slate-100 text-slate-600 dark:bg-slate-900/50 dark:text-slate-400 border border-slate-200 dark:border-slate-800",
    dot: "bg-slate-400",
  },
  medium: {
    text: "text-amber-500",
    bg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 dark:border-amber-500/30",
    dot: "bg-amber-500",
  },
  high: {
    text: "text-rose-500",
    bg: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 dark:border-rose-500/30",
    dot: "bg-rose-500",
  },
  critical: {
    text: "text-red-600 dark:text-red-400 font-bold",
    bg: "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20 dark:border-red-500/30 font-bold",
    dot: "bg-red-600 dark:bg-red-400",
  },
} as const;

export function getPriorityColors(priority?: string | null) {
  const p = (priority || "medium").toLowerCase() as "low" | "medium" | "high" | "critical";
  return PRIORITY_COLORS[p] || PRIORITY_COLORS.medium;
}

export const PRIORITY_STYLES: Record<"low" | "medium" | "high" | "critical", string> = {
  low: PRIORITY_COLORS.low.text,
  medium: PRIORITY_COLORS.medium.text,
  high: PRIORITY_COLORS.high.text,
  critical: PRIORITY_COLORS.critical.text,
};


export const API_PRIORITY_OPTIONS: { value: ApiPriority; label: string; colorClass: string }[] = [
  { value: "Low", label: "Low", colorClass: PRIORITY_STYLES.low },
  { value: "Medium", label: "Medium", colorClass: PRIORITY_STYLES.medium },
  { value: "High", label: "High", colorClass: PRIORITY_STYLES.high },
  { value: "Critical", label: "Critical", colorClass: PRIORITY_STYLES.critical },
];

export function mapPriorityToApi(p?: string | null): ApiPriority {
  if (!p) return "Medium";
  const lower = p.toLowerCase();
  if (lower === "critical") return "Critical";
  if (lower === "high") return "High";
  if (lower === "low") return "Low";
  return "Medium";
}

interface TaskPriorityPickerProps {
  priority?: string | null;
  onPriorityChange: (priority: ApiPriority) => Promise<void>;
  children?: ReactNode;
}

export function TaskPriorityPicker({
  priority,
  onPriorityChange,
  children,
}: TaskPriorityPickerProps) {
  const [open, setOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const activePriority = mapPriorityToApi(priority);

  const handleSelect = async (val: ApiPriority) => {
    if (val === activePriority || isUpdating) return;
    setIsUpdating(true);
    try {
      await onPriorityChange(val);
      setOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const currentOption = API_PRIORITY_OPTIONS.find((o) => o.value === activePriority) || API_PRIORITY_OPTIONS[1];

  const triggerEl = children || (
    <span className={cn("inline-flex items-center justify-center p-1 rounded hover:bg-muted/50 cursor-pointer text-xs font-semibold", currentOption.colorClass)}>
      <Flag className="size-3.5 mr-1" />
      {currentOption.label}
    </span>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={isUpdating}
        className="text-left disabled:opacity-50"
        onClick={(e) => e.stopPropagation()}
      >
        {triggerEl}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-40 p-1.5" onClick={(e) => e.stopPropagation()}>
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Priority
        </p>
        {API_PRIORITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => void handleSelect(opt.value)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted/50",
              opt.value === activePriority && "bg-primary/10 text-primary"
            )}
          >
            <Flag className={cn("size-3.5", opt.colorClass)} />
            <span>{opt.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
