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
} from "lucide-react";
import { SecureFileLink } from "@/shared/components/secure-file-link";
import {
  useGetTaskByIdQuery,
  useAddTaskCommentMutation,
  useAddTaskAttachmentMutation,
  useDeleteTaskAttachmentMutation,
  useCreateTaskMutation,
} from "@/domains/projects";
import { useAppAbility } from "@/domains/auth";
import { useUploadFileMutation } from "@/domains/projects/api/files.api";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { Separator } from "@/shared/ui/separator";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";

type TabId = "subtasks" | "comments" | "attachments";

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
  pendingAttachmentDeletes = [],
  onPendingAttachmentDeletesChange,
}: TaskCollaborationSectionsProps) {
  const ability = useAppAbility();
  const canCreateSubTask = ability?.can("create", "Task") ?? false;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [commentText, setCommentText] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [showSubTaskForm, setShowSubTaskForm] = useState(false);
  const [subTaskTitle, setSubTaskTitle] = useState("");

  const { data: task } = useGetTaskByIdQuery(taskId);

  const [addComment, { isLoading: isAddingComment }] = useAddTaskCommentMutation();
  const [uploadFile, { isLoading: isUploading }] = useUploadFileMutation();
  const [addAttachment, { isLoading: isLinking }] = useAddTaskAttachmentMutation();
  const [deleteAttachment, { isLoading: isDeletingAttachment }] =
    useDeleteTaskAttachmentMutation();
  const [createTask, { isLoading: isCreatingSubTask }] = useCreateTaskMutation();

  const comments = task?.comments ?? [];
  const attachments = task?.attachments ?? [];
  const visibleAttachments = attachments.filter((att) => !pendingAttachmentDeletes.includes(att.id));
  const subTasks = task?.subTasks ?? [];
  const totalSubTaskCount = subTasks.length + draftSubTasks.length;
  const totalCommentCount = comments.length + draftComments.length;
  const totalAttachmentCount = visibleAttachments.length + draftFiles.length;
  const completedSubTasks = subTasks.filter(
    (s) => s.status === "Done" || s.status === "Approved"
  ).length;
  const subTaskProgress =
    subTasks.length > 0 ? Math.round((completedSubTasks / subTasks.length) * 100) : 0;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "subtasks", label: "Subtasks", count: totalSubTaskCount },
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
      onDraftFilesChange?.([...draftFiles, ...selected]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    void handleFileSelectImmediate(selected[0]);
  }

  async function handleFileSelectImmediate(file: File) {
    try {
      const uploaded = await uploadFile(file).unwrap();
      await addAttachment({
        taskId,
        storageKey: uploaded.storageKey || uploaded.file.path,
        filename: uploaded.filename || file.name,
        mimeType: uploaded.mimeType || file.type,
        sizeBytes: uploaded.sizeBytes || file.size,
      }).unwrap();
      toast.success("File attached");
    } catch (err: unknown) {
      const apiError = err as { data?: { errors?: Record<string, string>; message?: string } };
      toast.error(
        apiError?.data?.errors?.file ??
          apiError?.data?.message ??
          "Failed to upload file"
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDeleteAttachment(attachmentId: string) {
    if (attachmentMode === "draft") {
      onPendingAttachmentDeletesChange?.([...pendingAttachmentDeletes, attachmentId]);
      return;
    }

    void handleDeleteAttachmentImmediate(attachmentId);
  }

  async function handleDeleteAttachmentImmediate(attachmentId: string) {
    try {
      await deleteAttachment({ taskId, attachmentId }).unwrap();
      toast.success("Attachment removed");
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
      await createTask({
        projectId,
        parentTaskId: taskId,
        phaseId: task.phaseId,
        title: subTaskTitle.trim(),
        priority: "Medium",
        status: "To_Do",
        startDate: task.startDate.slice(0, 10),
        endDate: task.endDate.slice(0, 10),
      }).unwrap();
      setSubTaskTitle("");
      setShowSubTaskForm(false);
      toast.success("Sub-task created");
    } catch (err: unknown) {
      const apiError = err as { data?: { message?: string } };
      toast.error(apiError?.data?.message ?? "Failed to create sub-task");
    }
  }

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
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => onOpenSubTask?.(sub.id)}
              className={cn(
                "flex w-full gap-3 rounded-xl border border-border bg-background p-3 text-left transition hover:border-primary/30 hover:bg-primary/5",
                isDone && "opacity-70"
              )}
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
                </p>
              </div>
            </button>
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
                onDraftSubTasksChange?.(draftSubTasks.filter((d) => d.id !== sub.id))
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

      <div className="max-h-80 space-y-2 overflow-y-auto">
        {comments.length === 0 && draftComments.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">No comments yet.</p>
        )}
        {comments.map((comment) => (
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
              </div>
            </div>
            <p className="text-sm text-foreground/90">{comment.body}</p>
          </div>
        ))}
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
                    onDraftCommentsChange?.(draftComments.filter((c) => c.id !== comment.id))
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
              {attachmentMode === "draft" ? "Add files" : "Upload"}
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple={attachmentMode === "draft"}
          className="hidden"
          accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          onChange={handleFileSelect}
        />
      </div>

      <div className="space-y-2">
        {visibleAttachments.length === 0 && draftFiles.length === 0 && (
          <p className="text-xs text-muted-foreground">No attachments yet.</p>
        )}
        {visibleAttachments.map((att) => (
          <div
            key={att.id}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
          >
            <Paperclip className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{att.filename}</p>
              <p className="text-[10px] text-muted-foreground">
                {att.uploader.displayName}
                {att.sizeBytes ? ` · ${formatFileSize(att.sizeBytes)}` : ""}
              </p>
            </div>
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
              onClick={() => handleDeleteAttachment(att.id)}
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
            <Paperclip className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-[10px] text-primary">Draft — saves with task</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                onDraftFilesChange?.(draftFiles.filter((_, fileIndex) => fileIndex !== index))
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
          {activeTab === "subtasks" && subTasksSection}
          {activeTab === "comments" && commentsSection}
          {activeTab === "attachments" && showAttachments && attachmentsSection}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <Separator />
      {commentsSection}
      <Separator />
      {showAttachments && attachmentsSection}
      <Separator />
      {subTasksSection}
    </div>
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

  const attachments = task?.attachments ?? [];

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      try {
        const uploaded = await uploadFile(file).unwrap();
        await addAttachment({
          taskId,
          storageKey: uploaded.storageKey || uploaded.file.path,
          filename: uploaded.filename || file.name,
          mimeType: uploaded.mimeType || file.type,
          sizeBytes: uploaded.sizeBytes || file.size,
        }).unwrap();
      } catch (err: unknown) {
        const apiError = err as { data?: { message?: string } };
        toast.error(apiError?.data?.message ?? "Failed to upload file");
        break;
      }
    }
    toast.success(files.length > 1 ? "Files attached" : "File attached");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(attachmentId: string) {
    try {
      await deleteAttachment({ taskId, attachmentId }).unwrap();
      toast.success("Attachment removed");
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
            <button
              type="button"
              onClick={() => handleDelete(att.id)}
              disabled={isDeletingAttachment}
              className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
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
        accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
        onChange={handleFileSelect}
      />
    </div>
  );
}
