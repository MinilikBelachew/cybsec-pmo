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
  useUpdateTaskMutation,
  updateTaskSchema,
  taskToFormValuesOrDefaults,
  toUpdateTaskPayload,
  type UpdateTaskFormValues,
  TaskProgressSection,
  TaskDependenciesSection,
  filterStatusOptionsForRole,
  formatTaskApiError,
} from "@/domains/projects";
import { TASKS_POLLING_INTERVAL_MS } from "@/domains/projects/constants/tasks-polling";
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
import {
  taskDatesOutsidePhaseErrors,
  taskDatesOutsideParentErrors,
  toTaskDayKey,
} from "../../schemas/task/task-date-fields";
import { toDateString } from "@/shared/utils/date";

interface TaskDetailPanelProps {
  taskId: string | null;
  projectId: string;
  open: boolean;
  onClose: () => void;
  onOpenSubTask?: (taskId: string) => void;
  /** When a sub-task sheet is opened (e.g. deep link), redirect to its parent. */
  onOpenParentTask?: (parentTaskId: string) => void;
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
  onOpenParentTask,
  onUpdated,
  initialTab,
  focusProgressReview = false,
}: TaskDetailPanelProps) {
  const { user } = useAuth();
  const ability = useAppAbility();
  const { data: task, isLoading, isError } = useGetTaskByIdQuery(taskId!, {
    skip: !taskId || !open,
    pollingInterval: open ? TASKS_POLLING_INTERVAL_MS : 0,
  });
  const { data: project } = useGetProjectByIdQuery(projectId, { skip: !open });
  const { data: assignees = [], isLoading: loadingAssignees } =
    useGetProjectTaskAssigneesQuery(projectId, { skip: !open });
  const { data: phases = [], isLoading: loadingPhases } = useGetPhasesQuery(projectId, { skip: !open });
  const [updateTaskBundle, { isLoading: isSaving }] = useUpdateTaskBundleMutation();
  const [updateTask, { isLoading: isUpdatingStatus }] = useUpdateTaskMutation();
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
    getValues,
    setError,
    clearErrors,
    formState: { errors, isDirty },
  } = useForm<UpdateTaskFormValues>({
    resolver: zodResolver(updateTaskSchema) as import("react-hook-form").Resolver<UpdateTaskFormValues>,
    defaultValues: {
      title: "",
      description: "",
      priority: "Medium",
      status: "To_Do",
      ownerId: null,
      backupOwnerId: null,
      phaseId: "",
      startDate: undefined,
      endDate: undefined,
      effortHours: undefined,
    },
  });

  const watchedOwnerId = watch("ownerId");
  const watchedBackupOwnerId = watch("backupOwnerId");
  const watchedPhaseId = watch("phaseId");
  const watchedStartDate = watch("startDate");
  const watchedEndDate = watch("endDate");
  const watchedEffortHours = watch("effortHours");
  const watchedStatus = watch("status");
  const activeOwner = assignees.find((assignee) => assignee.userId === watchedOwnerId);
  const activeBackupOwner = assignees.find(
    (assignee) => assignee.userId === watchedBackupOwnerId,
  );
  const backupOwnerCandidates = assignees.filter(
    (assignee) => assignee.userId !== watchedOwnerId,
  );
  const selectedPhase = phases.find((p) => p.id === watchedPhaseId);
  const phaseStartYmd = toTaskDayKey(selectedPhase?.startDate);
  const phaseEndYmd = toTaskDayKey(selectedPhase?.endDate);
  const parentStartYmd = toTaskDayKey(task?.parentTask?.startDate);
  const parentEndYmd = toTaskDayKey(task?.parentTask?.endDate);
  const effectiveMinYmd =
    [phaseStartYmd, parentStartYmd].filter(Boolean).sort().at(-1) ||
    toTaskDayKey(project?.startDate);
  const effectiveMaxYmd =
    [phaseEndYmd, parentEndYmd].filter(Boolean).sort()[0] ||
    toTaskDayKey(project?.endDate);
  const effectiveMin = effectiveMinYmd
    ? new Date(
        Number(effectiveMinYmd.slice(0, 4)),
        Number(effectiveMinYmd.slice(5, 7)) - 1,
        Number(effectiveMinYmd.slice(8, 10)),
      )
    : undefined;
  const effectiveMax = effectiveMaxYmd
    ? new Date(
        Number(effectiveMaxYmd.slice(0, 4)),
        Number(effectiveMaxYmd.slice(5, 7)) - 1,
        Number(effectiveMaxYmd.slice(8, 10)),
      )
    : undefined;

  function isDateDisabled(date: Date) {
    const day = toDateString(date);
    if (effectiveMinYmd && day < effectiveMinYmd) return true;
    if (effectiveMaxYmd && day > effectiveMaxYmd) return true;
    return false;
  }

  function applyPhaseDateErrors(start?: Date, end?: Date): boolean {
    const phaseErrors = taskDatesOutsidePhaseErrors({
      start,
      end,
      phaseStart: selectedPhase?.startDate,
      phaseEnd: selectedPhase?.endDate,
    });
    const parentErrors =
      task?.parentTaskId
        ? taskDatesOutsideParentErrors({
            start,
            end,
            parentStart: task.parentTask?.startDate,
            parentEnd: task.parentTask?.endDate,
          })
        : {};
    const next = {
      startDate: parentErrors.startDate ?? phaseErrors.startDate,
      endDate: parentErrors.endDate ?? phaseErrors.endDate,
    };
    if (next.startDate) {
      setError("startDate", { type: "validate", message: next.startDate });
    } else {
      clearErrors("startDate");
    }
    if (next.endDate) {
      setError("endDate", { type: "validate", message: next.endDate });
    } else {
      clearErrors("endDate");
    }
    return Boolean(next.startDate || next.endDate);
  }

  // DEF-P1-011 — assigning a phase to an existing task must re-check dates.
  useEffect(() => {
    if (!open || !watchedPhaseId || (!phaseStartYmd && !phaseEndYmd)) return;
    applyPhaseDateErrors(watchedStartDate, watchedEndDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when phase bounds change
  }, [open, watchedPhaseId, phaseStartYmd, phaseEndYmd]);

  const canManageTasks = ability?.can("create", "Task") ?? false;
  const isTaskOwner =
    user?.id === task?.ownerId ||
    (task?.ownerId == null &&
      user?.id != null &&
      user.id === task?.parentTask?.ownerId);
  const isEngineerView = !canManageTasks;
  const canEditTaskFields = canManageTasks;
  const canChangeStatus = canManageTasks || isTaskOwner;

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
  const isBusy = isSaving || isSubmitting || isUpdatingStatus;
  const hasParent = !!task?.parentTaskId;

  const handleEngineerStatusChange = async (newStatus: UpdateTaskFormValues["status"]) => {
    if (!taskId || newStatus === watchedStatus) return;
    try {
      await updateTask({ id: taskId, body: { status: newStatus } }).unwrap();
      reset({ ...getValues(), status: newStatus });
      toast.success("Status updated");
      onUpdated?.();
    } catch (err) {
      toast.error(formatTaskApiError(err, "Failed to update status"));
    }
  };

  const onSave = handleSubmit(async (values) => {
    if (!taskId) return;
    if (applyPhaseDateErrors(values.startDate, values.endDate)) {
      return;
    }
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
      toast.error(formatTaskApiError(err, "Failed to update task"));
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
              {(task.progressApproved > 0 || task.progressPending > 0 || isEngineerView) && (
                <div className="shrink-0 border-b border-border px-8 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {isEngineerView && (
                      <p className="w-full text-xs text-muted-foreground">
                        {isTaskOwner
                          ? "Task details are read-only. Update status below or submit progress for review."
                          : "Task details are read-only for your role."}
                      </p>
                    )}
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
                      disabled={!canEditTaskFields}
                      readOnly={!canEditTaskFields}
                      {...register("title")}
                    />
                    <FieldError message={errors.title?.message} />
                    <textarea
                      id="description"
                      rows={4}
                      placeholder="Add a description..."
                      disabled={!canEditTaskFields}
                      readOnly={!canEditTaskFields}
                      className="flex min-h-[100px] w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-80 dark:bg-input/30"
                      {...register("description")}
                    />
                    {task.parentTask && (
                      <button
                        type="button"
                        onClick={() =>
                          task.parentTaskId && onOpenParentTask?.(task.parentTaskId)
                        }
                        className="text-xs text-muted-foreground hover:text-primary transition-colors text-left"
                      >
                        Sub-task of{" "}
                        <span className="font-medium underline underline-offset-2">
                          {task.parentTask.title}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Controller
                        control={control}
                        name="status"
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              if (isEngineerView && isTaskOwner) {
                                void handleEngineerStatusChange(
                                  value as UpdateTaskFormValues["status"],
                                );
                                return;
                              }
                              field.onChange(value);
                            }}
                            disabled={!canChangeStatus || statusOptions.length <= 1}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue>
                                {STATUS_OPTIONS.find((opt) => opt.value === field.value)?.label ?? field.value}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
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
                          <Select value={field.value} onValueChange={field.onChange} disabled={!canEditTaskFields}>
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
                            disabled={loadingAssignees || !canEditTaskFields}
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
                            <SelectContent alignItemWithTrigger={false}>
                              <SelectItem value="none">Unassigned</SelectItem>
                              {assignees.map((assignee) => (
                                <SelectItem key={assignee.userId} value={assignee.userId}>
                                  <div className="flex items-center gap-2.5 py-0.5">
                                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                                      {initials(assignee.displayName)}
                                    </span>
                                    <div className="flex flex-col gap-0.5 text-left">
                                      <span>{assignee.displayName}</span>
                                      <span className="text-[11px] text-muted-foreground">
                                        {assignee.role} · {assignee.department.name}
                                      </span>
                                    </div>
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
                      <Label className="text-xs text-muted-foreground">Phase <span className="text-destructive font-bold">*</span></Label>
                      <Controller
                        control={control}
                        name="phaseId"
                        render={({ field }) => (
                          <Select
                            value={field.value ?? ""}
                            onValueChange={(value) => {
                              field.onChange(value);
                              clearErrors("phaseId");
                              const phase = phases.find((p) => p.id === value);
                              const next = taskDatesOutsidePhaseErrors({
                                start: watchedStartDate,
                                end: watchedEndDate,
                                phaseStart: phase?.startDate,
                                phaseEnd: phase?.endDate,
                              });
                              if (next.startDate) {
                                setError("startDate", {
                                  type: "validate",
                                  message: next.startDate,
                                });
                              } else {
                                clearErrors("startDate");
                              }
                              if (next.endDate) {
                                setError("endDate", {
                                  type: "validate",
                                  message: next.endDate,
                                });
                              } else {
                                clearErrors("endDate");
                              }
                            }}
                            disabled={loadingPhases || !canEditTaskFields}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select phase">
                                {phases.find((p) => p.id === field.value)?.name || "Select phase"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
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
                      <Label className="text-xs text-muted-foreground">Backup owner</Label>
                      <Controller
                        control={control}
                        name="backupOwnerId"
                        render={({ field }) => (
                          <Select
                            value={field.value ?? "none"}
                            onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                            disabled={loadingAssignees || !canEditTaskFields}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="No backup">
                                {activeBackupOwner ? (
                                  <span className="flex items-center gap-2">
                                    <Avatar className="size-5">
                                      <AvatarFallback className="text-[9px]">
                                        {initials(activeBackupOwner.displayName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    {activeBackupOwner.displayName}
                                  </span>
                                ) : field.value ? (
                                  task?.backupOwner?.displayName ?? "Former backup (not on project team)"
                                ) : (
                                  "No backup"
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                              <SelectItem value="none">No backup</SelectItem>
                              {backupOwnerCandidates.map((assignee) => (
                                <SelectItem key={assignee.userId} value={assignee.userId}>
                                  <div className="flex items-center gap-2.5 py-0.5">
                                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                                      {initials(assignee.displayName)}
                                    </span>
                                    <div className="flex flex-col gap-0.5 text-left">
                                      <span>{assignee.displayName}</span>
                                      <span className="text-[11px] text-muted-foreground">
                                        {assignee.role} · {assignee.department.name}
                                      </span>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Covers this task when the assignee is on leave.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Start date <span className="text-destructive font-bold">*</span></Label>
                      <Controller
                        control={control}
                        name="startDate"
                        render={({ field }) => (
                          <Popover>
                            <PopoverTrigger
                              type="button"
                              disabled={!canEditTaskFields}
                              className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 text-sm disabled:cursor-default disabled:opacity-80"
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
                                onSelect={(date) => {
                                  field.onChange(date ?? undefined);
                                  applyPhaseDateErrors(date ?? undefined, watchedEndDate);
                                }}
                                disabled={isDateDisabled}
                                startMonth={effectiveMin}
                                endMonth={effectiveMax}
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                      <FieldError message={errors.startDate?.message as string | undefined} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Due date <span className="text-destructive font-bold">*</span></Label>
                      <Controller
                        control={control}
                        name="endDate"
                        render={({ field }) => (
                          <Popover>
                            <PopoverTrigger
                              type="button"
                              disabled={!canEditTaskFields}
                              className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 text-sm disabled:cursor-default disabled:opacity-80"
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
                                onSelect={(date) => {
                                  field.onChange(date ?? undefined);
                                  applyPhaseDateErrors(watchedStartDate, date ?? undefined);
                                }}
                                disabled={(date) => {
                                  if (watchedStartDate && date < new Date(watchedStartDate)) {
                                    return true;
                                  }
                                  return isDateDisabled(date);
                                }}
                                startMonth={effectiveMin}
                                endMonth={effectiveMax}
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
                      Effort (hours) *
                    </Label>
                    <Input
                      id="effortHours"
                      type="number"
                      min={1}
                      step={1}
                      placeholder="Required"
                      disabled={!canEditTaskFields}
                      {...register("effortHours")}
                    />
                    <FieldError message={errors.effortHours?.message} />
                  </div>

                  <div className="space-y-4 rounded-xl border border-border/60 bg-muted/15 p-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Linked activity
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {isEngineerView
                          ? "Progress submissions save immediately."
                          : "Progress submissions save immediately. Dependencies are saved with Save changes."}
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
                  showSubTasks={!hasParent}
                  defaultTab={initialTab ?? (hasParent ? "comments" : "subtasks")}
                  className="h-full"
                  subTaskMode={canManageTasks ? "draft" : "immediate"}
                  draftSubTasks={draftSubTasks}
                  onDraftSubTasksChange={setDraftSubTasks}
                  commentMode={canManageTasks ? "draft" : "immediate"}
                  draftComments={draftComments}
                  onDraftCommentsChange={setDraftComments}
                  attachmentMode={canManageTasks ? "draft" : "immediate"}
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
              {canManageTasks ? (
                hasPendingChanges ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Unsaved changes
                  </Badge>
                ) : (
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    Comments, sub-tasks, files, and links save together on Save changes.
                  </span>
                )
              ) : (
                <span className="text-xs leading-relaxed text-muted-foreground">
                  Comments and attachments save immediately. Use status and progress above to update your work.
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
                Close
              </Button>
              {canManageTasks && (
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
              )}
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
