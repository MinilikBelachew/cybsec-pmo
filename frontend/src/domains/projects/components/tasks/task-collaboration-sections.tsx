"use client";

import { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
  ListTree,
  Lock,
  Circle,
  CircleCheck,
  Eye,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { FilePreviewModal } from "./file-preview-modal";
import { TaskChecklistSection } from "./task-checklist-section";
import { SecureFileLink } from "@/shared/components/secure-file-link";
import {
  useGetTaskByIdQuery,
  useAddTaskCommentMutation,
  useUpdateTaskCommentMutation,
  useDeleteTaskCommentMutation,
  useAddTaskAttachmentMutation,
  useDeleteTaskAttachmentMutation,
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useGetTaskChecklistQuery,
} from "@/domains/projects";
import { useAppAbility, useAuth } from "@/domains/auth";
import { useUploadFileMutation } from "@/domains/projects/api/files.api";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_LIMITS_HINT,
  attachmentValidationToastMessage,
  formatFileUploadError,
  validateAttachmentFiles,
} from "@/domains/projects/utils/attachment-limits";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { Separator } from "@/shared/ui/separator";
import { Badge } from "@/shared/ui/badge";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import { cn } from "@/shared/utils/cn";

type TabId = "subtasks" | "checklist" | "comments" | "attachments";

function FileTypeIcon({ filename, className }: { filename: string; className?: string }) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext))
    return <FileImage className={cn("text-sky-500", className)} />;
  if (["pdf"].includes(ext))
    return <FileText className={cn("text-rose-500", className)} />;
  if (["doc", "docx"].includes(ext))
    return <FileText className={cn("text-blue-600", className)} />;
  if (["xls", "xlsx"].includes(ext))
    return <FileSpreadsheet className={cn("text-emerald-600", className)} />;
  if (["csv"].includes(ext))
    return <FileSpreadsheet className={cn("text-teal-500", className)} />;
  if (["txt", "md"].includes(ext))
    return <FileText className={cn("text-muted-foreground", className)} />;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext))
    return <FileArchive className={cn("text-amber-500", className)} />;
  if (["js", "ts", "jsx", "tsx", "py", "java", "cs"].includes(ext))
    return <FileCode className={cn("text-violet-500", className)} />;
  return <File className={cn("text-muted-foreground", className)} />;
}

export interface DraftSubTask {
  id: string;
  title: string;
  description?: string;
}

export interface DraftComment {
  id: string;
  body: string;
  isInternal: boolean;
}

interface TaskCollaborationSectionsProps {
  taskId: string;
  projectId: string;
  onOpenSubTask?: (taskId: string) => void;
  className?: string;
  layout?: "stacked" | "tabs";
  showAttachments?: boolean;
  /** When false, hides the Subtasks tab (used for child tasks — one level only). */
  showSubTasks?: boolean;
  defaultTab?: TabId;
  subTaskMode?: "immediate" | "draft";
  draftSubTasks?: DraftSubTask[];
  onDraftSubTasksChange?: (subTasks: DraftSubTask[]) => void;
  commentMode?: "immediate" | "draft";
  draftComments?: DraftComment[];
  onDraftCommentsChange?: (comments: DraftComment[]) => void;
  attachmentMode?: "immediate" | "draft";
  draftFiles?: File[];
  onDraftFilesChange?: (files: File[]) => void;
  pendingAttachmentDeletes?: string[];
  onPendingAttachmentDeletesChange?: (ids: string[]) => void;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABEL: Record<string, string> = {
  To_Do: "To Do",
  In_Progress: "In Progress",
  Submitted_for_Review: "Submitted for Review",
  Approved: "Approved",
  Rework: "Rework",
  Done: "Done",
};

export function TaskCollaborationSections({
  taskId,
  projectId,
  onOpenSubTask,
  className,
  layout = "stacked",
  showAttachments = true,
  showSubTasks = true,
  defaultTab = "subtasks",
  subTaskMode = "immediate",
  draftSubTasks = [],
  onDraftSubTasksChange,
  commentMode = "immediate",
  draftComments = [],
  onDraftCommentsChange,
  attachmentMode = "immediate",
  draftFiles = [],
  onDraftFilesChange,
  pendingAttachmentDeletes: _pendingAttachmentDeletes = [],
  onPendingAttachmentDeletesChange: _onPendingAttachmentDeletesChange,
}: TaskCollaborationSectionsProps) {
  const { user } = useAuth();
  const ability = useAppAbility();
  const canCreateSubTask = ability?.can("create", "Task") ?? false;
  const canDeleteSubTask = ability?.can("update", "Task") ?? false;
  const canManageComments = ability?.can("update", "Task") ?? false;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>(
    !showSubTasks && defaultTab === "subtasks" ? "comments" : defaultTab,
  );
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [showSubTaskForm, setShowSubTaskForm] = useState(false);
  const [subTaskTitle, setSubTaskTitle] = useState("");
  const [deletingSubTaskId, setDeletingSubTaskId] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<{ filename: string; url?: string | null; storageKey?: string | null; file?: File } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<
    | { type: "subtask"; id: string; title: string }
    | { type: "attachment"; id: string; title: string }
    | { type: "comment"; id: string; title: string }
    | { type: "draft-comment"; id: string; title: string }
    | { type: "draft-subtask"; id: string; title: string }
    | { type: "draft-file"; index: number; title: string }
    | null
  >(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [editingCommentInternal, setEditingCommentInternal] = useState(true);

  const { data: task } = useGetTaskByIdQuery(taskId);
  const { data: checklist } = useGetTaskChecklistQuery(taskId, { skip: !taskId });

  const [addComment, { isLoading: isAddingComment }] = useAddTaskCommentMutation();
  const [updateComment, { isLoading: isUpdatingComment }] = useUpdateTaskCommentMutation();
  const [deleteComment, { isLoading: isDeletingComment }] = useDeleteTaskCommentMutation();
  const [uploadFile, { isLoading: isUploading }] = useUploadFileMutation();
  const [addAttachment, { isLoading: isLinking }] = useAddTaskAttachmentMutation();
  const [deleteAttachment, { isLoading: isDeletingAttachment }] =
    useDeleteTaskAttachmentMutation();
  const [createTask, { isLoading: isCreatingSubTask }] = useCreateTaskMutation();
  const [deleteTask] = useDeleteTaskMutation();

  const comments = task?.comments ?? [];
  const attachments = task?.attachments ?? [];
  const subTasks = task?.subTasks ?? [];
  const totalSubTaskCount = subTasks.length + draftSubTasks.length;
  const totalCommentCount = comments.length + draftComments.length;
  const totalAttachmentCount = attachments.length + draftFiles.length;
  const completedSubTasks = subTasks.filter(
    (s) => s.status === "Done" || s.status === "Approved"
  ).length;
  const subTaskProgress =
    subTasks.length > 0 ? Math.round((completedSubTasks / subTasks.length) * 100) : 0;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    ...(showSubTasks
      ? [{ id: "subtasks" as const, label: "Subtasks", count: totalSubTaskCount }]
      : []),
    {
      id: "checklist" as const,
      label: "Checklist",
      count: checklist?.total ?? 0,
    },
    { id: "comments", label: "Comments", count: totalCommentCount },
    { id: "attachments", label: "Files", count: totalAttachmentCount },
  ];
  if (!showAttachments) {
    tabs.pop();
  }

  function handleAddComment() {
    if (!commentText.trim()) return;

    if (commentMode === "draft") {
      onDraftCommentsChange?.([
        ...draftComments,
        { id: draftId(), body: commentText.trim(), isInternal },
      ]);
      setCommentText("");
      return;
    }

    void handleAddCommentImmediate();
  }

  async function handleAddCommentImmediate() {
    if (!commentText.trim()) return;
    try {
      await addComment({
        taskId,
        body: commentText.trim(),
        isInternal,
      }).unwrap();
      setCommentText("");
      toast.success("Comment added");
    } catch (err: unknown) {
      const apiError = err as { data?: { errors?: Record<string, string>; message?: string } };
      toast.error(
        apiError?.data?.message ??
          Object.values(apiError?.data?.errors ?? {})[0] ??
          "Failed to add comment"
      );
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;

    if (attachmentMode === "draft") {
      const { valid, issues } = validateAttachmentFiles(selected, {
        existingCount: draftFiles.length,
      });
      if (issues.length) {
        toast.error(attachmentValidationToastMessage(issues));
      }
      if (valid.length) {
        onDraftFilesChange?.([...draftFiles, ...valid]);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    void handleFileSelectImmediate(selected);
  }

  async function handleFileSelectImmediate(files: File[]) {
    const { valid, issues } = validateAttachmentFiles(files, {
      existingCount: attachments.length,
    });
    if (issues.length) {
      toast.error(attachmentValidationToastMessage(issues));
    }
    if (!valid.length) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    let uploadedCount = 0;
    try {
      for (const file of valid) {
        const uploaded = await uploadFile(file).unwrap();
        await addAttachment({
          taskId,
          storageKey: uploaded.storageKey || uploaded.file.path,
          filename: uploaded.filename || file.name,
          mimeType: uploaded.mimeType || file.type,
          sizeBytes: uploaded.sizeBytes || file.size,
        }).unwrap();
        uploadedCount += 1;
      }
      toast.success(uploadedCount > 1 ? "Files attached" : "File attached");
    } catch (err: unknown) {
      toast.error(formatFileUploadError(err));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDeleteAttachment(attachmentId: string, filename: string) {
    setDeleteConfirm({ type: "attachment", id: attachmentId, title: filename });
  }

  async function handleDeleteAttachmentImmediate(attachmentId: string) {
    try {
      await deleteAttachment({ taskId, attachmentId }).unwrap();
      toast.success("File deleted");
    } catch {
      toast.error("Failed to remove attachment");
    }
  }

  function draftId() {
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function handleAddSubTask() {
    if (!canCreateSubTask) return;
    if (!subTaskTitle.trim()) return;

    if (subTaskMode === "draft") {
      onDraftSubTasksChange?.([
        ...draftSubTasks,
        { id: draftId(), title: subTaskTitle.trim() },
      ]);
      setSubTaskTitle("");
      setShowSubTaskForm(false);
      return;
    }

    void handleCreateSubTaskImmediate();
  }

  async function handleCreateSubTaskImmediate() {
    if (!subTaskTitle.trim() || !task) return;
    if (!task.phaseId || !task.startDate || !task.endDate) {
      toast.error("Parent task must have a phase and dates before adding sub-tasks.");
      return;
    }
    try {
      const parentEffort =
        typeof task.effortHours === "number" && task.effortHours > 0
          ? Math.max(1, Math.floor(task.effortHours))
          : 1;
      await createTask({
        projectId,
        parentTaskId: taskId,
        phaseId: task.phaseId,
        title: subTaskTitle.trim(),
        priority: "Medium",
        status: "To_Do",
        startDate: task.startDate.slice(0, 10),
        endDate: task.endDate.slice(0, 10),
        effortHours: parentEffort,
      }).unwrap();
      setSubTaskTitle("");
      setShowSubTaskForm(false);
      toast.success("Sub-task created");
    } catch (err: unknown) {
      const apiError = err as {
        data?: { message?: string; errors?: Record<string, string> };
      };
      toast.error(
        apiError?.data?.message ??
          Object.values(apiError?.data?.errors ?? {})[0] ??
          "Failed to create sub-task",
      );
    }
  }

  function requestDeleteSubTask(subTaskId: string, title: string) {
    if (!canDeleteSubTask) return;
    setDeleteConfirm({ type: "subtask", id: subTaskId, title });
  }

  async function handleDeleteSubTask(subTaskId: string) {
    if (!canDeleteSubTask) return;
    setDeletingSubTaskId(subTaskId);
    try {
      await deleteTask(subTaskId).unwrap();
      toast.success("Sub-task deleted");
    } catch (err: unknown) {
      const apiError = err as {
        data?: { message?: string; errors?: Record<string, string> };
      };
      toast.error(
        apiError?.data?.message ??
          Object.values(apiError?.data?.errors ?? {})[0] ??
          "Failed to delete sub-task",
      );
    } finally {
      setDeletingSubTaskId(null);
    }
  }

  function canModifyComment(authorId: string) {
    return canManageComments || user?.id === authorId;
  }

  function startEditComment(comment: { id: string; body: string; isInternal: boolean }) {
    setEditingCommentId(comment.id);
    setEditingCommentBody(comment.body);
    setEditingCommentInternal(comment.isInternal);
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditingCommentBody("");
    setEditingCommentInternal(true);
  }

  async function saveEditComment() {
    if (!editingCommentId || !editingCommentBody.trim()) return;
    try {
      await updateComment({
        taskId,
        commentId: editingCommentId,
        body: editingCommentBody.trim(),
        isInternal: editingCommentInternal,
      }).unwrap();
      toast.success("Comment updated");
      cancelEditComment();
    } catch (err: unknown) {
      const apiError = err as { data?: { message?: string; errors?: Record<string, string> } };
      toast.error(
        apiError?.data?.message ??
          Object.values(apiError?.data?.errors ?? {})[0] ??
          "Failed to update comment",
      );
    }
  }

  async function confirmDeleteAction() {
    if (!deleteConfirm) return;
    const pending = deleteConfirm;

    if (pending.type === "subtask") {
      await handleDeleteSubTask(pending.id);
      setDeleteConfirm(null);
      return;
    }
    if (pending.type === "attachment") {
      // Existing attachments delete immediately (API), including Update Task sheet.
      await handleDeleteAttachmentImmediate(pending.id);
      setDeleteConfirm(null);
      return;
    }
    if (pending.type === "comment") {
      try {
        await deleteComment({ taskId, commentId: pending.id }).unwrap();
        if (editingCommentId === pending.id) cancelEditComment();
        toast.success("Comment deleted");
      } catch (err: unknown) {
        const apiError = err as { data?: { message?: string; errors?: Record<string, string> } };
        toast.error(
          apiError?.data?.message ??
            Object.values(apiError?.data?.errors ?? {})[0] ??
            "Failed to delete comment",
        );
      } finally {
        setDeleteConfirm(null);
      }
      return;
    }
    if (pending.type === "draft-comment") {
      onDraftCommentsChange?.(draftComments.filter((c) => c.id !== pending.id));
      toast.success("Comment deleted");
      setDeleteConfirm(null);
      return;
    }
    if (pending.type === "draft-subtask") {
      onDraftSubTasksChange?.(draftSubTasks.filter((d) => d.id !== pending.id));
      toast.success("Sub-task deleted");
      setDeleteConfirm(null);
      return;
    }
    if (pending.type === "draft-file") {
      onDraftFilesChange?.(draftFiles.filter((_, i) => i !== pending.index));
      toast.success("Draft file discarded");
      setDeleteConfirm(null);
    }
  }

  const deleteDialogCopy = (() => {
    if (!deleteConfirm) {
      return { title: "Delete", description: "" };
    }
    if (deleteConfirm.type === "subtask" || deleteConfirm.type === "draft-subtask") {
      return {
        title: "Delete sub-task",
        description: `Delete sub-task "${deleteConfirm.title}"? This cannot be undone.`,
      };
    }
    if (deleteConfirm.type === "attachment") {
      return {
        title: "Delete file",
        description: `Delete file "${deleteConfirm.title}"? This removes it immediately and cannot be undone.`,
      };
    }
    if (deleteConfirm.type === "draft-file") {
      return {
        title: "Discard draft file",
        description: `Remove "${deleteConfirm.title}" from this draft? It has not been uploaded yet.`,
      };
    }
    return {
      title: "Delete comment",
      description: `Delete this comment? This cannot be undone.`,
    };
  })();

  const subTasksSection = (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {layout === "tabs" && (
            <>
              <span className="text-sm font-semibold">{totalSubTaskCount} Subtasks</span>
              {subTasks.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {subTaskProgress}%
                </Badge>
              )}
              {draftSubTasks.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {draftSubTasks.length} draft
                </Badge>
              )}
            </>
          )}
          {layout === "stacked" && (
            <>
              <ListTree className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">Sub-tasks</h3>
              <span className="text-xs text-muted-foreground">({totalSubTaskCount})</span>
            </>
          )}
        </div>
        {canCreateSubTask && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowSubTaskForm((v) => !v)}
          >
            <Plus className="mr-1 size-3.5" />
            Add
          </Button>
        )}
      </div>

      {canCreateSubTask && showSubTaskForm && (
        <div className="flex gap-2">
          <Input
            value={subTaskTitle}
            onChange={(e) => setSubTaskTitle(e.target.value)}
            placeholder="Sub-task title..."
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSubTask())}
          />
          <Button
            type="button"
            size="sm"
            disabled={!subTaskTitle.trim() || (subTaskMode === "immediate" && isCreatingSubTask)}
            onClick={handleAddSubTask}
          >
            {subTaskMode === "immediate" && isCreatingSubTask ? (
              <Loader2 className="size-4 animate-spin" />
            ) : subTaskMode === "draft" ? (
              "Add to list"
            ) : (
              "Add sub-task"
            )}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {subTasks.length === 0 && draftSubTasks.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">No sub-tasks yet.</p>
        )}
        {subTasks.map((sub) => {
          const isDone = sub.status === "Done" || sub.status === "Approved";
          const isDeleting = deletingSubTaskId === sub.id;
          return (
            <div
              key={sub.id}
              className={cn(
                "flex w-full gap-3 rounded-xl border border-border bg-background p-3 text-left transition hover:border-primary/30 hover:bg-primary/5",
                isDone && "opacity-70"
              )}
            >
              <button
                type="button"
                onClick={() => onOpenSubTask?.(sub.id)}
                className="flex min-w-0 flex-1 gap-3 text-left"
              >
                {isDone ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", isDone && "line-through")}>{sub.title}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {STATUS_LABEL[sub.status] ?? sub.status}
                    {" · "}
                    Open to edit
                  </p>
                </div>
              </button>
              {canDeleteSubTask && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => requestDeleteSubTask(sub.id, sub.title)}
                  className="shrink-0 self-center p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors disabled:opacity-50"
                  title="Delete sub-task"
                >
                  {isDeleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              )}
            </div>
          );
        })}
        {draftSubTasks.map((sub) => (
          <div
            key={sub.id}
            className="flex gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3"
          >
            <Circle className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{sub.title}</p>
              <p className="mt-0.5 text-[10px] text-primary">Draft — saves with task</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setDeleteConfirm({ type: "draft-subtask", id: sub.id, title: sub.title })
              }
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );

  const commentsSection = (
    <section className="space-y-3">
      {layout === "stacked" && (
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Comments</h3>
          <span className="text-xs text-muted-foreground">({comments.length})</span>
        </div>
      )}

      {/* Comment Input */}
      <div className="space-y-2 rounded-xl border border-border bg-background p-3">
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write a comment..."
          rows={3}
          className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <div className="flex items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={isInternal}
              onCheckedChange={(checked) => setIsInternal(checked === true)}
            />
            Internal only
          </label>
          <Button
            type="button"
            size="sm"
            disabled={!commentText.trim() || (commentMode === "immediate" && isAddingComment)}
            onClick={handleAddComment}
          >
            {commentMode === "immediate" && isAddingComment ? (
              <Loader2 className="size-4 animate-spin" />
            ) : commentMode === "draft" ? (
              "Add to list"
            ) : (
              "Post comment"
            )}
          </Button>
        </div>
      </div>

      {/* Comments List */}
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {comments.length === 0 && draftComments.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {commentMode === "draft"
              ? "No comments yet. They will be posted with the main task."
              : "No comments yet."}
          </p>
        )}
        {comments.map((comment) => {
          const isEditing = editingCommentId === comment.id;
          const canModify = canModifyComment(comment.authorId);
          return (
            <div
              key={comment.id}
              className="rounded-xl border border-border bg-background p-3"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{comment.author.displayName}</span>
                <div className="flex items-center gap-2">
                  {comment.isInternal && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                      <Lock className="size-3" /> Internal
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                  {canModify && !isEditing && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEditComment(comment)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Edit comment"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteConfirm({
                            type: "comment",
                            id: comment.id,
                            title: comment.body.slice(0, 40),
                          })
                        }
                        className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Delete comment"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editingCommentBody}
                    onChange={(e) => setEditingCommentBody(e.target.value)}
                    rows={3}
                    className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={editingCommentInternal}
                        onCheckedChange={(checked) =>
                          setEditingCommentInternal(checked === true)
                        }
                      />
                      Internal only
                    </label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={cancelEditComment}
                        disabled={isUpdatingComment}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!editingCommentBody.trim() || isUpdatingComment}
                        onClick={() => void saveEditComment()}
                      >
                        {isUpdatingComment ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground/90">{comment.body}</p>
              )}
            </div>
          );
        })}
        {draftComments.map((comment) => (
          <div
            key={comment.id}
            className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-primary">Draft comment</span>
              <div className="flex items-center gap-2">
                {comment.isInternal && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                    <Lock className="size-3" /> Internal
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setDeleteConfirm({
                      type: "draft-comment",
                      id: comment.id,
                      title: comment.body.slice(0, 40),
                    })
                  }
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
            <p className="text-sm text-foreground/90">{comment.body}</p>
          </div>
        ))}
      </div>
    </section>
  );

  const attachmentsSection = (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Attachments</h3>
          <span className="text-xs text-muted-foreground">({totalAttachmentCount})</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={attachmentMode === "immediate" && (isUploading || isLinking)}
          onClick={() => fileInputRef.current?.click()}
        >
          {attachmentMode === "immediate" && (isUploading || isLinking) ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Plus className="mr-1 size-3.5" />
              {attachmentMode === "draft" ? "Add files" : isUploading || isLinking ? "Uploading…" : "Add files"}
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept={ATTACHMENT_ACCEPT}
          onChange={handleFileSelect}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{ATTACHMENT_LIMITS_HINT}</p>

      <div className="space-y-2">
        {attachments.length === 0 && draftFiles.length === 0 && (
          <p className="text-xs text-muted-foreground">No attachments yet.</p>
        )}
        {attachments.map((att) => (
          <div
            key={att.id}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
          >
            <FileTypeIcon filename={att.filename} className="size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setPreviewTarget({ filename: att.filename, url: att.url, storageKey: att.s3Key })}
                className="truncate text-sm font-medium hover:text-primary transition-colors text-left w-full outline-none"
              >
                {att.filename}
              </button>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {att.uploader.displayName}
                {att.sizeBytes ? ` · ${formatFileSize(att.sizeBytes)}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewTarget({ filename: att.filename, url: att.url, storageKey: att.s3Key })}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
              title="Preview file"
            >
              <Eye className="size-4" />
            </button>
            <SecureFileLink
              storageKey={att.s3Key}
              filename={att.filename}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
              iconClassName="size-4"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isDeletingAttachment}
              onClick={() => handleDeleteAttachment(att.id, att.filename)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {draftFiles.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className="flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2"
          >
            <FileTypeIcon filename={file.name} className="size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setPreviewTarget({ filename: file.name, file })}
                className="truncate text-sm font-medium hover:text-primary transition-colors text-left w-full outline-none"
              >
                {file.name}
              </button>
              <p className="text-[10px] text-primary mt-0.5">Draft — saves with task</p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewTarget({ filename: file.name, file })}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
              title="Preview file"
            >
              <Eye className="size-4" />
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                setDeleteConfirm({ type: "draft-file", index, title: file.name })
              }
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );

  if (layout === "tabs") {
    return (
      <>
      <div className={cn("flex h-full flex-col", className)}>
        <div className="flex shrink-0 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold transition",
                activeTab === tab.id
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "subtasks" && showSubTasks && subTasksSection}
          {activeTab === "checklist" && <TaskChecklistSection taskId={taskId} />}
          {activeTab === "comments" && commentsSection}
          {activeTab === "attachments" && showAttachments && attachmentsSection}
        </div>
      </div>
      
      <FilePreviewModal
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
        filename={previewTarget?.filename ?? ""}
        url={previewTarget?.url}
        storageKey={previewTarget?.storageKey}
        file={previewTarget?.file}
      />
      <DeleteDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => void confirmDeleteAction()}
        title={deleteDialogCopy.title}
        description={deleteDialogCopy.description}
        isDeleting={
          !!deletingSubTaskId || isDeletingAttachment || isDeletingComment
        }
      />
      </>
    );
  }

  return (
    <>
    <div className={cn("space-y-6", className)}>
      <Separator />
      {commentsSection}
      <Separator />
      <TaskChecklistSection taskId={taskId} />
      <Separator />
      {showAttachments && attachmentsSection}
      {showSubTasks && (
        <>
          <Separator />
          {subTasksSection}
        </>
      )}
    </div>
    
    <FilePreviewModal
      open={!!previewTarget}
      onClose={() => setPreviewTarget(null)}
      filename={previewTarget?.filename ?? ""}
      url={previewTarget?.url}
      storageKey={previewTarget?.storageKey}
      file={previewTarget?.file}
    />
    <DeleteDialog
      isOpen={!!deleteConfirm}
      onClose={() => setDeleteConfirm(null)}
      onConfirm={() => void confirmDeleteAction()}
      title={deleteDialogCopy.title}
      description={deleteDialogCopy.description}
      isDeleting={
        !!deletingSubTaskId || isDeletingAttachment || isDeletingComment
      }
    />
    </>
  );
}

/** Standalone attachments block for the detail sheet left column */
export function TaskAttachmentsBlock({
  taskId,
  className,
}: {
  taskId: string;
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: task } = useGetTaskByIdQuery(taskId);
  const [uploadFile, { isLoading: isUploading }] = useUploadFileMutation();
  const [addAttachment, { isLoading: isLinking }] = useAddTaskAttachmentMutation();
  const [deleteAttachment, { isLoading: isDeletingAttachment }] =
    useDeleteTaskAttachmentMutation();
  const [previewTarget, setPreviewTarget] = useState<{ filename: string; url?: string | null; storageKey?: string | null; file?: File } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const attachments = task?.attachments ?? [];

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const { valid, issues } = validateAttachmentFiles(files, {
      existingCount: attachments.length,
    });
    if (issues.length) {
      toast.error(attachmentValidationToastMessage(issues));
    }
    if (!valid.length) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    let uploadedCount = 0;
    for (const file of valid) {
      try {
        const uploaded = await uploadFile(file).unwrap();
        await addAttachment({
          taskId,
          storageKey: uploaded.storageKey || uploaded.file.path,
          filename: uploaded.filename || file.name,
          mimeType: uploaded.mimeType || file.type,
          sizeBytes: uploaded.sizeBytes || file.size,
        }).unwrap();
        uploadedCount += 1;
      } catch (err: unknown) {
        toast.error(formatFileUploadError(err));
        break;
      }
    }
    if (uploadedCount > 0) {
      toast.success(uploadedCount > 1 ? "Files attached" : "File attached");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    try {
      await deleteAttachment({ taskId, attachmentId: id }).unwrap();
      toast.success("File deleted");
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to remove attachment");
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">Attachments</p>
        <span className="text-[10px] text-muted-foreground">{attachments.length} file(s)</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {attachments.map((att) => (
          <div
            key={att.id}
            className="group relative flex flex-col gap-1 rounded-xl border border-border bg-muted/20 p-3"
          >
            <FileTypeIcon filename={att.filename} className="size-5" />
            <button
              type="button"
              onClick={() => setPreviewTarget({ filename: att.filename, url: att.url, storageKey: att.s3Key })}
              className="truncate text-xs font-medium hover:text-primary text-left w-full outline-none"
            >
              {att.filename}
            </button>
            <Paperclip className="size-5 text-primary" />
            <SecureFileLink
              storageKey={att.s3Key}
              filename={att.filename}
              showLabel
              label={att.filename}
              className="truncate text-xs font-medium text-foreground hover:text-primary"
            />
            <p className="text-[10px] text-muted-foreground">
              {att.sizeBytes ? formatFileSize(att.sizeBytes) : "—"}
            </p>
            <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setPreviewTarget({ filename: att.filename, url: att.url, storageKey: att.s3Key })}
                className="rounded-md p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                title="Preview file"
              >
                <Eye className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setDeleteConfirm({ id: att.id, title: att.filename })
                }
                disabled={isDeletingAttachment}
                className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Delete file"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          disabled={isUploading || isLinking}
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          {isUploading || isLinking ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <Plus className="size-5" />
              <span className="text-[10px] font-medium">Add files</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept={ATTACHMENT_ACCEPT}
        onChange={handleFileSelect}
      />
      <p className="text-[10px] text-muted-foreground">{ATTACHMENT_LIMITS_HINT}</p>

      <FilePreviewModal
        open={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
        filename={previewTarget?.filename ?? ""}
        url={previewTarget?.url}
        storageKey={previewTarget?.storageKey}
        file={previewTarget?.file}
      />
      <DeleteDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete file"
        description={`Delete file "${deleteConfirm?.title ?? ""}"? This cannot be undone.`}
        isDeleting={isDeletingAttachment}
      />
    </div>
  );
}
