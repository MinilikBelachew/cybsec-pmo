"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import {
  CheckSquare,
  Loader2,
  Calendar as CalendarIcon,
  ListTree,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
  FileText,
  Lock,
  Circle,
  Flag,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  useCreateTaskBundleMutation,
  useGetProjectTaskAssigneesQuery,
  useGetPhasesQuery,
  useCreatePhaseMutation,
  createTaskSchema,
  toCreateTaskPayload,
  type CreateTaskFormValues,
  useGetProjectByIdQuery,
} from "@/domains/projects";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { cn } from "@/shared/utils/cn";
import { ADD_TASK_SHEET_CLASS } from "./task-sheet.constants";
import { TaskAssigneeAvailabilityAlert } from "./task-assignee-availability-alert";
import { defaultTaskDateRange } from "../../schemas/task/task-date-fields";
import { PhaseForm } from "../roadmap/phase-form";
import { type PhaseFormValues } from "../../schemas/phase/phase.schema";

type WorkspaceStatus = "To_Do" | "In_Progress" | "Submitted_for_Review" | "Approved" | "Rework" | "Done";
type SideTab = "subtasks" | "comments";

const WORKSPACE_STATUS_TO_API: Record<WorkspaceStatus, CreateTaskFormValues["status"]> = {
  "To_Do": "To_Do",
  "In_Progress": "In_Progress",
  "Submitted_for_Review": "Submitted_for_Review",
  "Approved": "Approved",
  "Rework": "Rework",
  "Done": "Done",
};

interface DraftComment {
  id: string;
  body: string;
  isInternal: boolean;
}

interface DraftSubTask {
  id: string;
  title: string;
  description?: string;
}

interface AddTaskSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  projectId: string;
  parentTaskId?: string | null;
  defaultStatus?: WorkspaceStatus;
  defaultPhaseId?: string | null;
  projectName?: string;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[0.8rem] font-medium text-destructive">{message}</p>;
}

function formatDateLabel(dateVal: string | Date | undefined) {
  if (!dateVal) return "Pick a date";
  try {
    const date = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(date.getTime())) return "Pick a date";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Pick a date";
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function draftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AddTaskSheet({
  open,
  onClose,
  onCreated,
  projectId,
  parentTaskId = null,
  defaultStatus = "To_Do",
  defaultPhaseId = null,
  projectName = "Workspace",
}: AddTaskSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sideTab, setSideTab] = useState<SideTab>("subtasks");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreatePhase, setShowCreatePhase] = useState(false);
  const [isSavingPhase, setIsSavingPhase] = useState(false);

  const [draftComments, setDraftComments] = useState<DraftComment[]>([]);
  const [draftSubTasks, setDraftSubTasks] = useState<DraftSubTask[]>([]);
  const [draftFiles, setDraftFiles] = useState<File[]>([]);

  const [commentDraft, setCommentDraft] = useState("");
  const [commentInternal, setCommentInternal] = useState(true);
  const [subTaskTitle, setSubTaskTitle] = useState("");
  const [subTaskDescription, setSubTaskDescription] = useState("");

  const [createTaskBundle] = useCreateTaskBundleMutation();
  const [createPhase] = useCreatePhaseMutation();
  const { data: assignees = [], isLoading: loadingAssignees } =
    useGetProjectTaskAssigneesQuery(projectId, { skip: !projectId });
  const { data: phases = [], isLoading: loadingPhases } = useGetPhasesQuery(projectId);
  const { data: project } = useGetProjectByIdQuery(projectId, { skip: !projectId });
  const defaultDates = defaultTaskDateRange();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema) as import("react-hook-form").Resolver<CreateTaskFormValues>,
    defaultValues: {
      projectId,
      parentTaskId: parentTaskId ?? null,
      phaseId: defaultPhaseId ?? "",
      title: "",
      description: "",
      priority: "Medium",
      status: WORKSPACE_STATUS_TO_API[defaultStatus],
      ownerId: null,
      startDate: defaultDates.startDate,
      endDate: defaultDates.endDate,
      effortHours: undefined,
    },
  });

  const watchedOwnerId = watch("ownerId");
  const watchedStartDate = watch("startDate");
  const watchedEndDate = watch("endDate");
  const watchedEffortHours = watch("effortHours");
  const activeOwner = assignees.find((assignee) => assignee.userId === watchedOwnerId);

  const handleCreatePhase = async (values: PhaseFormValues) => {
    setIsSavingPhase(true);
    try {
      const newPhase = await createPhase({
        projectId,
        body: {
          name: values.name,
          description: values.description,
          startDate: values.startDate,
          endDate: values.endDate,
          status: values.status,
          orderIndex: 0,
        },
      }).unwrap();
      setValue("phaseId", newPhase.id);
      setShowCreatePhase(false);
      toast.success(`Phase "${newPhase.name}" created and selected`);
    } catch (err: unknown) {
      const apiError = err as { data?: { message?: string } };
      toast.error(apiError?.data?.message ?? "Failed to create phase");
    } finally {
      setIsSavingPhase(false);
    }
  };

  const resetDrafts = () => {
    setDraftComments([]);
    setDraftSubTasks([]);
    setDraftFiles([]);
    setCommentDraft("");
    setCommentInternal(true);
    setSubTaskTitle("");
    setSubTaskDescription("");
    setSideTab("subtasks");
  };

  useEffect(() => {
    if (!open) return;
    resetDrafts();
    setSideTab(parentTaskId ? "comments" : "subtasks");
    const dates = defaultTaskDateRange();
    reset({
      projectId,
      parentTaskId: parentTaskId ?? null,
      phaseId: defaultPhaseId ?? "",
      title: "",
      description: "",
      priority: "Medium",
      status: WORKSPACE_STATUS_TO_API[defaultStatus],
      ownerId: null,
      startDate: dates.startDate,
      endDate: dates.endDate,
      effortHours: undefined,
    });
  }, [open, projectId, parentTaskId, defaultStatus, defaultPhaseId, reset]);

  const handleClose = () => {
    resetDrafts();
    onClose();
  };

  function addDraftComment() {
    if (!commentDraft.trim()) return;
    setDraftComments((prev) => [
      ...prev,
      { id: draftId(), body: commentDraft.trim(), isInternal: commentInternal },
    ]);
    setCommentDraft("");
  }

  function addDraftSubTask() {
    if (!subTaskTitle.trim()) return;
    setDraftSubTasks((prev) => [
      ...prev,
      {
        id: draftId(),
        title: subTaskTitle.trim(),
        description: subTaskDescription.trim() || undefined,
      },
    ]);
    setSubTaskTitle("");
    setSubTaskDescription("");
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) {
      setDraftFiles((prev) => [...prev, ...files]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      const result = await createTaskBundle({
        payload: {
          ...toCreateTaskPayload(values),
          comments: draftComments.map((comment) => ({
            body: comment.body,
            isInternal: comment.isInternal,
          })),
          subTasks: parentTaskId
            ? []
            : draftSubTasks.map((sub) => ({
                title: sub.title,
                description: sub.description ?? null,
              })),
        },
        files: draftFiles,
      }).unwrap();

      result.warnings?.forEach((warning) => toast(warning, { icon: "⚠️" }));

      const parts = ["Task created"];
      if (draftSubTasks.length) parts.push(`${draftSubTasks.length} sub-task(s)`);
      if (draftComments.length) parts.push(`${draftComments.length} comment(s)`);
      if (draftFiles.length) parts.push(`${draftFiles.length} file(s)`);
      toast.success(parts.join(" · "));

      onCreated?.();
      handleClose();
    } catch (err: unknown) {
      const apiError = err as { data?: { errors?: Record<string, string>; message?: string } };
      const fieldErrors = apiError?.data?.errors;
      if (fieldErrors) {
        toast.error(Object.values(fieldErrors)[0] ?? "Failed to create task.");
      } else {
        toast.error(apiError?.data?.message ?? "Failed to create task. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent side="right" className={ADD_TASK_SHEET_CLASS} showCloseButton>
        <form onSubmit={onSubmit} className="flex h-full flex-col">
          <SheetHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
            <SheetTitle className="flex items-center gap-2 text-lg font-bold">
              <CheckSquare className="size-5 text-primary" />
              {parentTaskId ? "New Sub-task" : "New Task"}
            </SheetTitle>
            <SheetDescription>
              {parentTaskId ? (
                <span className="flex items-center gap-1.5 text-primary">
                  <ListTree className="size-3.5" />
                  Sub-task in {projectName}
                </span>
              ) : (
                <>Fill in everything below, then create once — task, sub-tasks, comments & files.</>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
            {/* ── Left: task fields + attachments ── */}
            <div className="flex-1 overflow-y-auto border-b border-border px-6 py-5 lg:border-b-0 lg:border-r">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Input
                    id="title"
                    placeholder="Task title..."
                    className="h-11 border-0 border-b border-input rounded-none px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                    {...register("title")}
                  />
                  <FieldError message={errors.title?.message} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Controller
                      control={control}
                      name="status"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="To_Do">To Do</SelectItem>
                            <SelectItem value="In_Progress">In Progress</SelectItem>
                            <SelectItem value="Submitted_for_Review">Submitted for Review</SelectItem>
                            <SelectItem value="Approved">Approved</SelectItem>
                            <SelectItem value="Rework">Rework</SelectItem>
                            <SelectItem value="Done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <Controller
                      control={control}
                      name="priority"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Low">Low</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Assignee</Label>
                    <Controller
                      control={control}
                      name="ownerId"
                      render={({ field }) => (
                        <Select
                          value={field.value ?? "none"}
                          onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                          disabled={loadingAssignees}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Unassigned">
                              {activeOwner ? activeOwner.displayName : "Unassigned"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {assignees.map((assignee) => (
                              <SelectItem key={assignee.userId} value={assignee.userId}>
                                <div className="flex flex-col gap-0.5 py-0.5 text-left">
                                  <span>{assignee.displayName}</span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {assignee.role} · {assignee.department.name}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {!loadingAssignees && assignees.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Add project team members with linked login accounts before assigning tasks.
                      </p>
                    )}
                    <TaskAssigneeAvailabilityAlert
                      projectId={projectId}
                      ownerId={watchedOwnerId}
                      startDate={watchedStartDate}
                      endDate={watchedEndDate}
                      effortHours={watchedEffortHours}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Phase *</Label>
                    </div>
                    {!loadingPhases && phases.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowCreatePhase(true)}
                        className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10 transition"
                      >
                        <Flag className="size-3.5" />
                        No phases yet — Create one
                      </button>
                    ) : (
                      <Controller
                        control={control}
                        name="phaseId"
                        render={({ field }) => (
                          <Select
                            value={field.value ?? ""}
                            onValueChange={field.onChange}
                            disabled={loadingPhases}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select phase">
                                {phases.find((p) => p.id === field.value)?.name || "Select phase"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {phases.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    )}
                    <FieldError message={errors.phaseId?.message} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Start date *</Label>
                    <Controller
                      control={control}
                      name="startDate"
                      render={({ field }) => (
                        <Popover>
                          <PopoverTrigger
                            type="button"
                            className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 text-sm"
                          >
                            <span className={field.value ? "" : "text-muted-foreground"}>
                              {formatDateLabel(field.value)}
                            </span>
                            <CalendarIcon className="size-4 text-muted-foreground" />
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ?? undefined)}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    />
                    <FieldError message={errors.startDate?.message as string | undefined} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Due date *</Label>
                    <Controller
                      control={control}
                      name="endDate"
                      render={({ field }) => (
                        <Popover>
                          <PopoverTrigger
                            type="button"
                            className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 text-sm"
                          >
                            <span className={field.value ? "" : "text-muted-foreground"}>
                              {formatDateLabel(field.value)}
                            </span>
                            <CalendarIcon className="size-4 text-muted-foreground" />
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={(date) => field.onChange(date ?? undefined)}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    />
                    <FieldError message={errors.endDate?.message} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs text-muted-foreground">
                    Description
                  </Label>
                  <textarea
                    id="description"
                    rows={4}
                    placeholder="Add a description..."
                    className="flex min-h-[96px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    {...register("description")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="effortHours" className="text-xs text-muted-foreground">
                    Effort (hours)
                  </Label>
                  <Input
                    id="effortHours"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Optional"
                    {...register("effortHours")}
                  />
                </div>

                {/* Attachments — draft files */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-semibold">
                      <Paperclip className="size-4 text-primary" />
                      Attachments
                      {draftFiles.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {draftFiles.length}
                        </Badge>
                      )}
                    </Label>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {draftFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="group relative flex flex-col gap-1 rounded-xl border border-border bg-muted/20 p-3"
                      >
                        <FileText className="size-5 text-primary" />
                        <p className="truncate text-xs font-medium">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftFiles((prev) => prev.filter((_, i) => i !== index))
                          }
                          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    >
                      <Plus className="size-5" />
                      <span className="text-[10px] font-medium">Add files</span>
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    onChange={handleFilesSelected}
                  />
                </div>
              </div>
            </div>

            {/* ── Right: sub-tasks & comments tabs ── */}
            <div className="flex w-full shrink-0 flex-col overflow-hidden bg-muted/20 lg:w-[340px]">
              <div className="flex shrink-0 border-b border-border">
                {!parentTaskId && (
                  <button
                    type="button"
                    onClick={() => setSideTab("subtasks")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold transition",
                      sideTab === "subtasks"
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <ListTree className="size-3.5" />
                    Subtasks
                    {draftSubTasks.length > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                        {draftSubTasks.length}
                      </Badge>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSideTab("comments")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold transition",
                    sideTab === "comments"
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquare className="size-3.5" />
                  Comments
                  {draftComments.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                      {draftComments.length}
                    </Badge>
                  )}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {sideTab === "subtasks" && (
                  <div className="space-y-3">
                    <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                      <Input
                        value={subTaskTitle}
                        onChange={(e) => setSubTaskTitle(e.target.value)}
                        placeholder="Sub-task title..."
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDraftSubTask())}
                      />
                      <Input
                        value={subTaskDescription}
                        onChange={(e) => setSubTaskDescription(e.target.value)}
                        placeholder="Short description (optional)"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={!subTaskTitle.trim()}
                        onClick={addDraftSubTask}
                      >
                        <Plus className="mr-1 size-3.5" />
                        Add to list
                      </Button>
                    </div>

                    {draftSubTasks.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-6">
                        No sub-tasks yet. They will be created with the main task.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {draftSubTasks.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex gap-2 rounded-xl border border-border bg-background p-3"
                          >
                            <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{sub.title}</p>
                              {sub.description && (
                                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                                  {sub.description}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setDraftSubTasks((prev) => prev.filter((s) => s.id !== sub.id))
                              }
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {sideTab === "comments" && (
                  <div className="space-y-3">
                    <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                      <textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Write a comment..."
                        rows={3}
                        className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                      />
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={commentInternal}
                          onCheckedChange={(c) => setCommentInternal(c === true)}
                        />
                        Internal only
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={!commentDraft.trim()}
                        onClick={addDraftComment}
                      >
                        <Plus className="mr-1 size-3.5" />
                        Add to list
                      </Button>
                    </div>

                    {draftComments.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-6">
                        No comments yet. They will be posted with the main task.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {draftComments.map((c) => (
                          <div
                            key={c.id}
                            className="rounded-xl border border-border bg-background p-3"
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              {c.isInternal && (
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                                  <Lock className="size-3" /> Internal
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setDraftComments((prev) => prev.filter((x) => x.id !== c.id))
                                }
                                className="ml-auto text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                            <p className="text-sm">{c.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <SheetFooter className="shrink-0 flex-row justify-between gap-2 border-t border-border px-6 py-4">
            <p className="text-xs text-muted-foreground self-center">
              {draftSubTasks.length + draftComments.length + draftFiles.length > 0
                ? `${draftSubTasks.length} sub-task(s) · ${draftComments.length} comment(s) · ${draftFiles.length} file(s) ready`
                : "All items save together on create"}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Creating...
                  </>
                ) : parentTaskId ? (
                  "Create Sub-task"
                ) : (
                  "Create Task"
                )}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>

    {/* ── Create Phase Modal ── */}
    <DialogPrimitive.Root open={showCreatePhase} onOpenChange={(open) => !open && setShowCreatePhase(false)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background shadow-xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-6 py-4">
            <Flag className="size-4 text-primary" />
            <DialogPrimitive.Title className="text-sm font-bold">
              Create New Phase
            </DialogPrimitive.Title>
          </div>
          <PhaseForm
            initialValues={{
              name: "",
              description: "",
              startDate: "",
              endDate: "",
              status: "Planned",
            }}
            onSubmit={handleCreatePhase}
            onCancel={() => setShowCreatePhase(false)}
            isSaving={isSavingPhase}
            existingPhases={phases}
            projectStartDate={project?.startDate}
            projectEndDate={project?.endDate}
          />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
    </>
  );
}
