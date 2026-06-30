"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import {
  Loader2,
  Calendar as CalendarIcon,
  FolderKanban,
  Save,
} from "lucide-react";
import {
  useGetTaskByIdQuery,
  useGetProjectByIdQuery,
  useGetProjectTaskAssigneesQuery,
  useGetPhasesQuery,
  useUpdateTaskBundleMutation,
  updateTaskSchema,
  taskToFormValuesOrDefaults,
  toUpdateTaskPayload,
  type UpdateTaskFormValues,
  TaskProgressSection,
  TaskDependenciesSection,
  filterStatusOptionsForRole,
} from "@/domains/projects";
import { useAuth, useAppAbility } from "@/domains/auth";
import {
  Sheet,
  SheetContent,
  SheetFooter,
} from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
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
import {
  TaskCollaborationSections,
  type DraftComment,
  type DraftSubTask,
} from "./task-collaboration-sections";
import type { DraftDependencyAdd } from "./task-dependencies-section";
import {
  TASK_DETAIL_SHEET_CLASS,
  TASK_SHEET_COLUMN_CLASS,
  TASK_SHEET_FOOTER_PADDING,
  TASK_SHEET_MAIN_PADDING,
} from "./task-sheet.constants";
import { TaskAssigneeAvailabilityAlert } from "./task-assignee-availability-alert";

interface TaskDetailPanelProps {
  taskId: string | null;
  projectId: string;
  open: boolean;
  onClose: () => void;
  onOpenSubTask?: (taskId: string) => void;
  onUpdated?: () => void;
  initialTab?: "comments" | "subtasks";
  focusProgressReview?: boolean;
}

const STATUS_OPTIONS: { value: UpdateTaskFormValues["status"]; label: string }[] = [
  { value: "To_Do", label: "To Do" },
  { value: "In_Progress", label: "In Progress" },
  { value: "Submitted_for_Review", label: "Submitted for Review" },
  { value: "Approved", label: "Approved" },
  { value: "Rework", label: "Rework" },
  { value: "Done", label: "Done" },
];

const PRIORITY_DOT: Record<string, string> = {
  Low: "bg-slate-400",
  Medium: "bg-purple-500",
  High: "bg-amber-500",
  Critical: "bg-red-500",
};

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
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Pick a date";
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TaskDetailPanel({
  taskId,
  projectId,
  open,
  onClose,
  onOpenSubTask,
  onUpdated,
  initialTab,
  focusProgressReview = false,
}: TaskDetailPanelProps) {
  const { user } = useAuth();
  const ability = useAppAbility();
  const { data: task, isLoading, isError } = useGetTaskByIdQuery(taskId!, {
    skip: !taskId || !open,
  });
  const { data: project } = useGetProjectByIdQuery(projectId, { skip: !open });
  const { data: assignees = [], isLoading: loadingAssignees } =
    useGetProjectTaskAssigneesQuery(projectId, { skip: !open });
  const { data: phases = [], isLoading: loadingPhases } = useGetPhasesQuery(projectId, { skip: !open });
  const [updateTaskBundle, { isLoading: isSaving }] = useUpdateTaskBundleMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftSubTasks, setDraftSubTasks] = useState<DraftSubTask[]>([]);
  const [draftComments, setDraftComments] = useState<DraftComment[]>([]);
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [pendingAttachmentDeletes, setPendingAttachmentDeletes] = useState<string[]>([]);
  const [draftDependencyAdds, setDraftDependencyAdds] = useState<DraftDependencyAdd[]>([]);
  const [pendingDependencyRemoves, setPendingDependencyRemoves] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<UpdateTaskFormValues>({
    resolver: zodResolver(updateTaskSchema) as import("react-hook-form").Resolver<UpdateTaskFormValues>,
    defaultValues: {
      title: "",
      description: "",
      priority: "Medium",
      status: "To_Do",
      ownerId: null,
      startDate: undefined,
      endDate: undefined,
      effortHours: undefined,
    },
  });

  const watchedOwnerId = watch("ownerId");
  const watchedStartDate = watch("startDate");
  const watchedEndDate = watch("endDate");
  const watchedEffortHours = watch("effortHours");
  const watchedStatus = watch("status");
  const activeOwner = assignees.find((assignee) => assignee.userId === watchedOwnerId);

  const statusOptions = useMemo(
    () =>
      filterStatusOptionsForRole(
        watchedStatus ?? task?.status ?? "To_Do",
        STATUS_OPTIONS,
        user?.id === task?.ownerId,
        ability?.can("approve", "Task") ?? false,
      ),
    [watchedStatus, task?.status, task?.ownerId, user?.id, ability],
  );

  useEffect(() => {
    if (!open) return;
    setDraftSubTasks([]);
    setDraftComments([]);
    setDraftFiles([]);
    setPendingAttachmentDeletes([]);
    setDraftDependencyAdds([]);
    setPendingDependencyRemoves([]);
  }, [taskId, open]);

  useEffect(() => {
    if (!task || !open || task.id !== taskId) return;
    reset(taskToFormValuesOrDefaults(task));
  }, [task, taskId, open, reset]);

  const hasDraftChanges =
    draftSubTasks.length > 0 ||
    draftComments.length > 0 ||
    draftFiles.length > 0 ||
    pendingAttachmentDeletes.length > 0 ||
    draftDependencyAdds.length > 0 ||
    pendingDependencyRemoves.length > 0;

  const hasPendingChanges = isDirty || hasDraftChanges;
  const isBusy = isSaving || isSubmitting;
  const hasParent = !!task?.parentTaskId;

  const onSave = handleSubmit(async (values) => {
    if (!taskId) return;
    setIsSubmitting(true);
    try {
      const result = await updateTaskBundle({
        taskId,
        payload: {
          ...toUpdateTaskPayload(values),
          comments: draftComments.map((comment) => ({
            body: comment.body,
            isInternal: comment.isInternal,
          })),
          subTasks: hasParent
            ? []
            : draftSubTasks.map((sub) => ({
                title: sub.title,
                description: sub.description ?? null,
              })),
          removeAttachmentIds: pendingAttachmentDeletes,
          addDependencies: draftDependencyAdds.map((dep) => ({
            predecessorId: dep.predecessorId,
            successorId: dep.successorId,
            depType: dep.depType,
            lagDays: dep.lagDays,
          })),
          removeDependencyIds: pendingDependencyRemoves,
        },
        files: draftFiles,
      }).unwrap();
      result.warnings?.forEach((warning) => toast(warning, { icon: "⚠️" }));
      toast.success("Task updated");
      onUpdated?.();
      onClose();
    } catch (err: unknown) {
      const apiError = err as { data?: { errors?: Record<string, string>; message?: string } };
      const fieldErrors = apiError?.data?.errors;
      toast.error(
        fieldErrors
          ? Object.values(fieldErrors)[0]
          : apiError?.data?.message ?? "Failed to update task"
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Sheet open={open && !!taskId} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className={TASK_DETAIL_SHEET_CLASS} showCloseButton>
        <form onSubmit={onSave} className="flex h-full flex-col">
          {isLoading && (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" />
              Loading task...
            </div>
          )}

          {isError && (
            <div className="flex flex-1 items-center justify-center p-6">
              <p className="text-sm text-destructive">Failed to load task details.</p>
            </div>
          )}

          {task && (
            <>
              {(task.progressApproved > 0 || task.progressPending > 0) && (
                <div className="shrink-0 border-b border-border px-8 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {task.progressApproved > 0 && (
                      <Badge className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-[10px]">
                        {task.progressApproved}% approved
                      </Badge>
                    )}
                    {task.progressPending > 0 && (
                      <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px]">
                        {task.progressPending}% pending review
                      </Badge>
                    )}
                  </div>
                </div>
              )}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
              <div className={cn(TASK_SHEET_COLUMN_CLASS, "overflow-y-auto border-b border-border lg:border-b-0 lg:border-r", TASK_SHEET_MAIN_PADDING)}>
                <div className="space-y-5">
                  <div className="space-y-3">
                    <Input
                      className="h-auto border-0 border-b border-input rounded-none px-0 text-lg font-bold shadow-none focus-visible:ring-0"
                      placeholder="Task title..."
                      {...register("title")}
                    />
                    <FieldError message={errors.title?.message} />
                    <textarea
                      id="description"
                      rows={4}
                      placeholder="Add a description..."
                      className="flex min-h-[100px] w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      {...register("description")}
                    />
                    {task.parentTask && (
                      <p className="text-xs text-muted-foreground">
                        Sub-task of <span className="font-medium">{task.parentTask.title}</span>
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
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
                              {statusOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
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
                              <SelectValue>
                                <span className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "size-2 rounded-full",
                                      PRIORITY_DOT[field.value]
                                    )}
                                  />
                                  {field.value}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {(["Low", "Medium", "High", "Critical"] as const).map((p) => (
                                <SelectItem key={p} value={p}>
                                  <span className="flex items-center gap-2">
                                    <span className={cn("size-2 rounded-full", PRIORITY_DOT[p])} />
                                    {p}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
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
                                {activeOwner ? (
                                  <span className="flex items-center gap-2">
                                    <Avatar className="size-5">
                                      <AvatarFallback className="text-[9px]">
                                        {initials(activeOwner.displayName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    {activeOwner.displayName}
                                  </span>
                                ) : field.value ? (
                                  "Former assignee (not on project team)"
                                ) : (
                                  "Unassigned"
                                )}
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
                        excludeTaskId={taskId ?? undefined}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Phase *</Label>
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
                      <FieldError message={errors.phaseId?.message} />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
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
                              <span className={cn("truncate", !field.value && "text-muted-foreground")}>
                                {formatDateLabel(field.value)}
                              </span>
                              <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
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
                              <span className={cn("truncate", !field.value && "text-muted-foreground")}>
                                {formatDateLabel(field.value)}
                              </span>
                              <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
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
                    <Label className="text-xs text-muted-foreground">Project</Label>
                    <div className="flex h-9 items-center gap-2 rounded-lg border border-input bg-muted/20 px-3 text-sm">
                      <FolderKanban className="size-4 text-emerald-600" />
                      <span className="truncate font-medium">
                        {project?.name ?? task.project?.name ?? "—"}
                      </span>
                    </div>
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

                  <div className="space-y-4 rounded-xl border border-border/60 bg-muted/15 p-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Linked activity
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Progress submissions save immediately. Dependencies are saved with Save changes.
                      </p>
                    </div>

                    <TaskProgressSection
                      task={task}
                      focusProgressReview={focusProgressReview}
                      onUpdated={() => {
                        onUpdated?.();
                      }}
                    />

                    <TaskDependenciesSection
                      task={task}
                      mode="draft"
                      draftAdds={draftDependencyAdds}
                      onDraftAddsChange={setDraftDependencyAdds}
                      pendingRemoves={pendingDependencyRemoves}
                      onPendingRemovesChange={setPendingDependencyRemoves}
                    />
                  </div>
                </div>
              </div>

              {/* Right: subtasks, comments & attachments */}
              <div className={cn(TASK_SHEET_COLUMN_CLASS, "bg-muted/20")}>
                <TaskCollaborationSections
                  key={`${task.id}-${initialTab ?? (hasParent ? "comments" : "subtasks")}`}
                  taskId={task.id}
                  projectId={projectId}
                  onOpenSubTask={onOpenSubTask}
                  layout="tabs"
                  showAttachments
                  defaultTab={initialTab ?? (hasParent ? "comments" : "subtasks")}
                  className="h-full"
                  subTaskMode={hasParent ? "immediate" : "draft"}
                  draftSubTasks={draftSubTasks}
                  onDraftSubTasksChange={setDraftSubTasks}
                  commentMode="draft"
                  draftComments={draftComments}
                  onDraftCommentsChange={setDraftComments}
                  attachmentMode="draft"
                  draftFiles={draftFiles}
                  onDraftFilesChange={setDraftFiles}
                  pendingAttachmentDeletes={pendingAttachmentDeletes}
                  onPendingAttachmentDeletesChange={setPendingAttachmentDeletes}
                />
              </div>
            </div>
            </>
          )}

          <SheetFooter className={cn("shrink-0 flex-row justify-between gap-2 border-t border-border", TASK_SHEET_FOOTER_PADDING)}>
            <div className="max-w-md self-center">
              {hasPendingChanges ? (
                <Badge variant="secondary" className="text-[10px]">
                  Unsaved changes
                </Badge>
              ) : (
                <span className="text-xs leading-relaxed text-muted-foreground">
                  Comments, sub-tasks, files, and links save together on Save changes.
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
                Close
              </Button>
              <Button type="submit" disabled={!hasPendingChanges || isBusy || isLoading}>
                {isBusy ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 size-4" />
                    Save changes
                  </>
                )}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
