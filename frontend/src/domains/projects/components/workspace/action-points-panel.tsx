"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  CheckSquare,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import { useAuth } from "@/domains/auth";
import {
  useCreateActionPointMutation,
  useDeleteActionPointMutation,
  useGetActionPointsQuery,
  useUpdateActionPointMutation,
} from "@/domains/projects/api/action-points.api";
import { useGetProjectTaskAssigneesQuery } from "@/domains/projects/api/projects.api";
import type {
  ActionPoint,
  ActionPointPriority,
  ActionPointStatus,
} from "@/domains/projects/types/action-points.types";
import {
  createActionPointSchema,
  type ActionPointFormValues,
} from "@/domains/projects/schemas/action-point/action-point.schema";
import {
  ProjectDatePicker,
} from "@/domains/projects/components/shared/project-date-picker";

const STATUS_OPTIONS: ActionPointStatus[] = [
  "Open",
  "In Progress",
  "Done",
  "Cancelled",
];

/** Statuses assignees (engineers) may set — Cancelled is manager-only. */
const ASSIGNEE_STATUS_OPTIONS: ActionPointStatus[] = [
  "Open",
  "In Progress",
  "Done",
];

const PRIORITY_OPTIONS: ActionPointPriority[] = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

/** Matches backend ACTION_POINT_MANAGER_ROLES */
const ACTION_POINT_MANAGER_ROLES = new Set([
  "super_admin",
  "it_admin",
  "pmo_lead",
  "pm",
  "team_lead",
]);

function toDateOnly(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim());
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toApiDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { message?: string | string[] } }).data;
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }
    if (Array.isArray(data?.message) && data.message[0]) {
      return String(data.message[0]);
    }
  }
  return fallback;
}

type ActionPointsPanelProps = {
  projectId: string;
  canEdit: boolean;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
};

export function ActionPointsPanel({
  projectId,
  canEdit,
  projectStartDate,
  projectEndDate,
}: ActionPointsPanelProps) {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const roleCode = user?.backendRoleCode ?? "";

  const canManage =
    canEdit && ACTION_POINT_MANAGER_ROLES.has(roleCode);

  const { data: actionPoints = [], isLoading, isError } = useGetActionPointsQuery(projectId);
  const { data: assignees = [] } = useGetProjectTaskAssigneesQuery(projectId, {
    skip: !canManage,
  });
  const [createActionPoint, { isLoading: isCreating }] = useCreateActionPointMutation();
  const [updateActionPoint, { isLoading: isUpdating }] = useUpdateActionPointMutation();
  const [deleteActionPoint, { isLoading: isDeleting }] = useDeleteActionPointMutation();

  const [formMode, setFormMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingPoint, setEditingPoint] = useState<ActionPoint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActionPoint | null>(null);

  const projectStart = useMemo(() => toDateOnly(projectStartDate), [projectStartDate]);
  const projectEnd = useMemo(() => toDateOnly(projectEndDate), [projectEndDate]);

  const schema = useMemo(
    () =>
      createActionPointSchema({
        projectStartDate: projectStart,
        projectEndDate: projectEnd,
      }),
    [projectStart, projectEnd],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ActionPointFormValues>({
    resolver: zodResolver(schema) as import("react-hook-form").Resolver<ActionPointFormValues>,
    defaultValues: {
      name: "",
      ownerId: "",
      dueDate: undefined,
      priority: "Medium",
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    if (formMode === "closed") {
      setEditingPoint(null);
      reset({
        name: "",
        ownerId: "",
        dueDate: undefined,
        priority: "Medium",
      });
    }
  }, [formMode, reset]);

  const ownerOptions = useMemo(
    () =>
      assignees.map((a) => ({
        id: a.userId,
        label: a.displayName || a.name || a.email || a.userId,
      })),
    [assignees],
  );

  const overdueCount = actionPoints.filter((ap) => ap.isOverdue).length;

  function canUpdateStatus(ap: ActionPoint): boolean {
    return canManage || Boolean(currentUserId && ap.ownerId === currentUserId);
  }

  function openCreateForm() {
    setEditingPoint(null);
    reset({
      name: "",
      ownerId: "",
      dueDate: undefined,
      priority: "Medium",
    });
    setFormMode("create");
  }

  function openEditForm(ap: ActionPoint) {
    setEditingPoint(ap);
    reset({
      name: ap.title,
      ownerId: ap.ownerId,
      dueDate: toDateOnly(ap.dueDate),
      priority: (PRIORITY_OPTIONS.includes(ap.priority as ActionPointPriority)
        ? ap.priority
        : "Medium") as ActionPointPriority,
    });
    setFormMode("edit");
  }

  function closeForm() {
    setFormMode("closed");
  }

  const onValidSubmit = async (values: ActionPointFormValues) => {
    try {
      if (formMode === "edit" && editingPoint) {
        await updateActionPoint({
          projectId,
          actionPointId: editingPoint.id,
          body: {
            title: values.name.trim(),
            ownerId: values.ownerId,
            dueDate: toApiDate(values.dueDate),
            priority: values.priority,
          },
        }).unwrap();
        toast.success("Action point updated");
      } else {
        await createActionPoint({
          projectId,
          body: {
            title: values.name.trim(),
            ownerId: values.ownerId,
            dueDate: toApiDate(values.dueDate),
            priority: values.priority,
            sourceType: "Project",
            status: "Open",
          },
        }).unwrap();
        toast.success("Action point created");
      }
      closeForm();
    } catch (err: unknown) {
      toast.error(
        getApiErrorMessage(
          err,
          formMode === "edit"
            ? "Failed to update action point"
            : "Failed to create action point",
        ),
      );
    }
  };

  const handleStatusChange = async (actionPointId: string, status: ActionPointStatus) => {
    try {
      await updateActionPoint({
        projectId,
        actionPointId,
        body: { status },
      }).unwrap();
      toast.success("Status updated");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update status"));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteActionPoint({
        projectId,
        actionPointId: deleteTarget.id,
      }).unwrap();
      toast.success("Action point deleted");
      setDeleteTarget(null);
      if (editingPoint?.id === deleteTarget.id) {
        closeForm();
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to delete action point"));
    }
  };

  const fieldErrorClass = "text-[11px] font-medium text-rose-500";
  const isSaving = isCreating || isUpdating;

  const actionPointForm = (
    <form
      onSubmit={handleSubmit(onValidSubmit)}
      className="space-y-3 rounded-2xl border border-border/60 bg-card p-4"
      noValidate
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          {formMode === "edit" ? "Edit action point" : "New action point"}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Name *
        </label>
        <input
          {...register("name")}
          className={cn(
            "h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20",
            errors.name
              ? "border-rose-500 ring-2 ring-rose-500/20"
              : "border-border",
          )}
          placeholder="Action point name"
        />
        {errors.name && <p className={fieldErrorClass}>{errors.name.message}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Owner *
          </label>
          <Controller
            control={control}
            name="ownerId"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={(v) => field.onChange(v ?? "")}
              >
                <SelectTrigger
                  className={cn(
                    "h-9",
                    errors.ownerId && "border-rose-500 ring-2 ring-rose-500/20",
                  )}
                >
                  <SelectValue placeholder="Select owner">
                    {ownerOptions.find((o) => o.id === field.value)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ownerOptions.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No assignees available — add team members first
                    </SelectItem>
                  ) : (
                    ownerOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          />
          {errors.ownerId && <p className={fieldErrorClass}>{errors.ownerId.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Due date *
          </label>
          <Controller
            control={control}
            name="dueDate"
            render={({ field }) => (
              <ProjectDatePicker
                value={field.value}
                onChange={(date) => field.onChange(date)}
                minDate={projectStart ?? new Date(2000, 0, 1)}
                maxDate={projectEnd}
                placeholder="Pick a due date"
                className="h-9"
                invalid={Boolean(errors.dueDate)}
              />
            )}
          />
          {errors.dueDate && <p className={fieldErrorClass}>{errors.dueDate.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Priority
          </label>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) =>
                  field.onChange((v as ActionPointPriority) || "Medium")
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={closeForm} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} className="gap-1.5">
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          {formMode === "edit" ? "Save changes" : "Save action point"}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-bold text-foreground">Action points</h2>
          <p className="text-xs text-muted-foreground">
            {canManage
              ? "Track owners, due dates, status, and overdue items for this project."
              : "Action points assigned to you. You can update status only."}
            {overdueCount > 0 ? (
              <span className="ml-1 font-semibold text-rose-600">
                {overdueCount} overdue
              </span>
            ) : null}
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              formMode === "create" ? closeForm() : openCreateForm()
            }
          >
            <Plus className="size-3.5" />
            {formMode === "create" ? "Close" : "Add action point"}
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div className="space-y-4">
          {formMode === "create" && canManage && actionPointForm}

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading action points…
            </div>
          )}

          {isError && (
            <p className="py-10 text-center text-sm text-rose-500">
              Failed to load action points.
            </p>
          )}

          {!isLoading && !isError && actionPoints.length === 0 && formMode !== "create" && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 py-16 text-center">
              <CheckSquare className="size-8 text-muted-foreground/50" />
              <p className="text-sm font-semibold text-muted-foreground">No action points yet</p>
              <p className="text-xs text-muted-foreground/70">
                {canManage
                  ? "Create one with an owner and due date to start tracking."
                  : "No action points are assigned to you on this project."}
              </p>
            </div>
          )}

          {!isLoading && actionPoints.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="sticky top-0 z-10 grid grid-cols-[1fr_140px_120px_140px_72px] gap-2 border-b border-border/50 bg-muted/80 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                <span>Name</span>
                <span>Owner</span>
                <span>Due</span>
                <span>Status</span>
                <span />
              </div>
              <ul className="divide-y divide-border/40">
                {actionPoints.map((ap) => {
                  const allowStatus = canUpdateStatus(ap);
                  const isEditingRow =
                    formMode === "edit" && editingPoint?.id === ap.id;
                  const statusChoices = canManage
                    ? STATUS_OPTIONS
                    : ASSIGNEE_STATUS_OPTIONS;

                  return (
                    <li key={ap.id} className="block">
                      <div
                        className={cn(
                          "grid grid-cols-[1fr_140px_120px_140px_72px] items-center gap-2 px-4 py-3",
                          ap.isOverdue && "bg-rose-500/5",
                          isEditingRow && "bg-primary/5",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {ap.title}
                            </p>
                            {ap.isOverdue && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                                <AlertTriangle className="size-3" />
                                Overdue
                              </span>
                            )}
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {ap.priority}
                            </span>
                          </div>
                        </div>
                        <p className="truncate text-xs text-foreground">
                          {ap.owner?.displayName || "—"}
                        </p>
                        <p
                          className={cn(
                            "text-xs font-medium",
                            ap.isOverdue ? "text-rose-600" : "text-muted-foreground",
                          )}
                        >
                          {ap.dueDate}
                        </p>
                        <div>
                          {allowStatus ? (
                            <Select
                              value={ap.status}
                              onValueChange={(v) => {
                                if (v) {
                                  void handleStatusChange(ap.id, v as ActionPointStatus);
                                }
                              }}
                              disabled={isUpdating}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusChoices.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs font-medium">{ap.status}</span>
                          )}
                        </div>
                        <div className="flex justify-end gap-0.5">
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  isEditingRow ? closeForm() : openEditForm(ap)
                                }
                                className={cn(
                                  "rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary",
                                  isEditingRow && "bg-primary/10 text-primary",
                                )}
                                title={isEditingRow ? "Close edit" : "Edit"}
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(ap)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                                title="Delete"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {isEditingRow && canManage && (
                        <div className="border-t border-border/40 bg-muted/20 px-4 py-3">
                          {actionPointForm}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      <DeleteDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Delete action point?"
        description={
          deleteTarget
            ? `Delete “${deleteTarget.title}”? This cannot be undone.`
            : "This cannot be undone."
        }
        isDeleting={isDeleting}
      />
    </div>
  );
}
