"use client";

import { useEffect, useState } from "react";
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
  useUpdateTaskMutation,
  useCreateTaskMutation,
  updateTaskSchema,
  taskToFormValuesOrDefaults,
  toUpdateTaskPayload,
  toCreateTaskPayload,
  type UpdateTaskFormValues,
} from "@/domains/projects";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
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
  TaskAttachmentsBlock,
  type DraftSubTask,
} from "./task-collaboration-sections";
import { TASK_DETAIL_SHEET_CLASS } from "./task-sheet.constants";

interface TaskDetailPanelProps {
  taskId: string | null;
  projectId: string;
  open: boolean;
  onClose: () => void;
  onOpenSubTask?: (taskId: string) => void;
  onUpdated?: () => void;
  initialTab?: "comments" | "subtasks";
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
}: TaskDetailPanelProps) {
  const { data: task, isLoading, isError } = useGetTaskByIdQuery(taskId!, {
    skip: !taskId || !open,
  });
  const { data: project } = useGetProjectByIdQuery(projectId, { skip: !open });
  const { data: assignees = [], isLoading: loadingAssignees } =
    useGetProjectTaskAssigneesQuery(projectId, { skip: !open });
  const { data: phases = [], isLoading: loadingPhases } = useGetPhasesQuery(projectId, { skip: !open });
  const [updateTask, { isLoading: isSaving }] = useUpdateTaskMutation();
  const [createTask] = useCreateTaskMutation();
  const [draftSubTasks, setDraftSubTasks] = useState<DraftSubTask[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const activeOwner = assignees.find((assignee) => assignee.userId === watchedOwnerId);

  useEffect(() => {
    if (!task || !open) return;
    reset(taskToFormValuesOrDefaults(task));
    setDraftSubTasks([]);
  }, [task, open, reset]);

  const hasPendingChanges = isDirty || draftSubTasks.length > 0;
  const isBusy = isSaving || isSubmitting;

  const onSave = handleSubmit(async (values) => {
    if (!taskId) return;
    setIsSubmitting(true);
    try {
      await updateTask({ id: taskId, body: toUpdateTaskPayload(values) }).unwrap();

      for (const sub of draftSubTasks) {
        await createTask({
          ...toCreateTaskPayload({
            projectId,
            parentTaskId: taskId,
            phaseId: values.phaseId,
            title: sub.title,
            description: sub.description ?? "",
            priority: "Medium",
            status: "To_Do",
            ownerId: null,
            startDate: values.startDate,
            endDate: values.endDate,
            effortHours: undefined,
          }),
        }).unwrap();
      }

      setDraftSubTasks([]);
      toast.success(
        draftSubTasks.length
          ? `Task updated · ${draftSubTasks.length} sub-task(s) created`
          : "Task updated"
      );
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

  const hasParent = !!task?.parentTaskId;

  return (
    <Sheet open={open && !!taskId} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className={TASK_DETAIL_SHEET_CLASS} showCloseButton>
        <form onSubmit={onSave} className="flex h-full flex-col">
          <SheetHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
            {isLoading ? (
              <SheetTitle className="text-lg font-bold">Loading task...</SheetTitle>
            ) : (
              <>
                <Input
                  className="h-auto border-0 border-b border-transparent px-0 text-lg font-bold shadow-none focus-visible:border-input focus-visible:ring-0"
                  placeholder="Task title..."
                  {...register("title")}
                />
                <FieldError message={errors.title?.message} />
                {task?.parentTask && (
                  <p className="text-xs text-muted-foreground">
                    Sub-task of <span className="font-medium">{task.parentTask.title}</span>
                  </p>
                )}
              </>
            )}
          </SheetHeader>

          {isLoading && (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" />
              Loading...
            </div>
          )}

          {isError && (
            <div className="flex flex-1 items-center justify-center p-6">
              <p className="text-sm text-destructive">Failed to load task details.</p>
            </div>
          )}

          {task && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
              {/* Left: editable metadata + description + attachments */}
              <div className="flex-1 overflow-y-auto border-b border-border px-6 py-5 lg:border-b-0 lg:border-r">
                <div className="space-y-4">
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
                              {STATUS_OPTIONS.map((opt) => (
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

                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs text-muted-foreground">
                      Description
                    </Label>
                    <textarea
                      id="description"
                      rows={5}
                      placeholder="Add a description..."
                      className="flex min-h-[120px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                      {...register("description")}
                    />
                  </div>

                  <TaskAttachmentsBlock taskId={task.id} />
                </div>
              </div>

              {/* Right: subtasks & comments tabs */}
              <div className="flex w-full shrink-0 flex-col overflow-hidden bg-muted/20 lg:w-[360px]">
                {hasParent ? (
                  <TaskCollaborationSections
                    key={`${task.id}-${initialTab ?? "comments"}`}
                    taskId={task.id}
                    projectId={projectId}
                    onOpenSubTask={onOpenSubTask}
                    layout="tabs"
                    showAttachments={false}
                    defaultTab={initialTab ?? "comments"}
                    className="h-full"
                  />
                ) : (
                  <TaskCollaborationSections
                    key={`${task.id}-${initialTab ?? "subtasks"}`}
                    taskId={task.id}
                    projectId={projectId}
                    onOpenSubTask={onOpenSubTask}
                    layout="tabs"
                    showAttachments={false}
                    defaultTab={initialTab ?? "subtasks"}
                    subTaskMode="draft"
                    draftSubTasks={draftSubTasks}
                    onDraftSubTasksChange={setDraftSubTasks}
                    className="h-full"
                  />
                )}
              </div>
            </div>
          )}

          <SheetFooter className="shrink-0 flex-row justify-between gap-2 border-t border-border px-6 py-4">
            <div className="self-center">
              {hasPendingChanges ? (
                <Badge variant="secondary" className="text-[10px]">
                  Unsaved changes
                  {draftSubTasks.length > 0 ? ` · ${draftSubTasks.length} sub-task draft(s)` : ""}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">Edit fields and save</span>
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
