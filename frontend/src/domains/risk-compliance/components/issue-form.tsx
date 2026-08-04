"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import { useGetProjectTaskAssigneesQuery } from "@/domains/projects/api/projects.api";
import { ProjectDatePicker } from "@/domains/projects/components/shared/project-date-picker";
import {
  useCreateIssueMutation,
  useUpdateIssueMutation,
} from "../api/issues.api";
import {
  ISSUE_PRIORITY_OPTIONS,
  ISSUE_STATUS_OPTIONS,
  createIssueSchema,
  type IssueFormValues,
} from "../schemas/issue.schema";
import type { Issue } from "../types/issues.types";
import {
  assigneeLabel,
  getApiErrorMessage,
  toApiDate,
  toDateOnly,
} from "../utils/form-utils";

type ProjectOption = { id: string; name: string };

type IssueFormProps = {
  mode: "create" | "edit";
  issue?: Issue | null;
  projects: ProjectOption[];
  defaultProjectId?: string;
  onCancel: () => void;
  onSuccess: () => void;
};

export function IssueForm({
  mode,
  issue,
  projects,
  defaultProjectId,
  onCancel,
  onSuccess,
}: IssueFormProps) {
  const [createIssue, { isLoading: isCreating }] = useCreateIssueMutation();
  const [updateIssue, { isLoading: isUpdating }] = useUpdateIssueMutation();

  const form = useForm<IssueFormValues>({
    resolver: zodResolver(createIssueSchema),
    defaultValues: {
      projectId: defaultProjectId || projects[0]?.id || "",
      title: "",
      priority: "Medium",
      ownerId: "",
      status: "Open",
      resolutionNote: "",
      expectedResolutionDate: null,
    },
  });

  useEffect(() => {
    if (mode === "edit" && issue) {
      form.reset({
        projectId: issue.projectId,
        title: issue.title,
        priority: (issue.priority as IssueFormValues["priority"]) || "Medium",
        ownerId: issue.ownerId,
        dueDate: toDateOnly(issue.dueDate)!,
        expectedResolutionDate: toDateOnly(issue.expectedResolutionDate) ?? null,
        status: (issue.status as IssueFormValues["status"]) || "Open",
        resolutionNote: issue.resolutionNote ?? "",
      });
      return;
    }
    form.reset({
      projectId: defaultProjectId || projects[0]?.id || "",
      title: "",
      priority: "Medium",
      ownerId: "",
      dueDate: undefined as unknown as Date,
      expectedResolutionDate: null,
      status: "Open",
      resolutionNote: "",
    });
  }, [mode, issue, defaultProjectId, projects, form]);

  const projectId = form.watch("projectId");
  const ownerId = form.watch("ownerId");

  const {
    data: assignees = [],
    isFetching: assigneesFetching,
    isLoading: assigneesLoading,
  } = useGetProjectTaskAssigneesQuery(projectId, {
    skip: !projectId,
  });

  useEffect(() => {
    if (!projectId || assigneesLoading || assigneesFetching) return;
    if (!ownerId) return;
    if (!assignees.some((a) => a.userId === ownerId)) {
      form.setValue("ownerId", "");
    }
  }, [
    projectId,
    assignees,
    assigneesLoading,
    assigneesFetching,
    ownerId,
    form,
  ]);

  const assigneesPending =
    Boolean(projectId) && (assigneesLoading || (assigneesFetching && assignees.length === 0));

  const selectedProjectName =
    projects.find((p) => p.id === projectId)?.name ??
    issue?.projectName ??
    undefined;
  const selectedOwner = assignees.find((a) => a.userId === ownerId);
  const selectedOwnerLabel =
    assigneeLabel(selectedOwner) ||
    (mode === "edit" &&
    issue &&
    issue.projectId === projectId &&
    issue.ownerId === ownerId
      ? issue.owner?.displayName
      : undefined);

  const onSubmit = form.handleSubmit(async (values) => {
    const body = {
      title: values.title,
      priority: values.priority,
      ownerId: values.ownerId,
      dueDate: toApiDate(values.dueDate),
      expectedResolutionDate: values.expectedResolutionDate
        ? toApiDate(values.expectedResolutionDate)
        : undefined,
      status: values.status,
      resolutionNote: values.resolutionNote || undefined,
    };
    try {
      if (mode === "edit" && issue) {
        await updateIssue({
          projectId: issue.projectId,
          issueId: issue.id,
          body,
        }).unwrap();
        toast.success("Issue updated");
      } else {
        await createIssue({ projectId: values.projectId, body }).unwrap();
        toast.success("Issue created");
      }
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save issue"));
    }
  });

  const fieldErrorClass = "text-xs text-destructive";
  const isSaving = isCreating || isUpdating;

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-border/60 bg-card p-4 space-y-4"
      noValidate
    >
      <p className="text-sm font-semibold">
        {mode === "edit" ? "Edit issue" : "New issue"}
      </p>

      {mode === "create" && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Project <span className="text-destructive font-bold">*</span>
          </label>
          <Controller
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={(v) => {
                  field.onChange(v ?? "");
                  form.setValue("ownerId", "");
                }}
              >
                <SelectTrigger
                  className={cn(
                    "w-full",
                    form.formState.errors.projectId && "border-rose-500",
                  )}
                >
                  <SelectValue placeholder="Select project">
                    {selectedProjectName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.projectId && (
            <p className={fieldErrorClass}>
              {form.formState.errors.projectId.message}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs text-muted-foreground">
            Title <span className="text-destructive font-bold">*</span>
          </label>
          <Input {...form.register("title")} placeholder="Issue title" />
          {form.formState.errors.title && (
            <p className={fieldErrorClass}>{form.formState.errors.title.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Priority <span className="text-destructive font-bold">*</span>
          </label>
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? field.value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{field.value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Owner <span className="text-destructive font-bold">*</span>
          </label>
          <Controller
            control={form.control}
            name="ownerId"
            render={({ field }) => (
              <Select
                key={`issue-owner-${projectId || "none"}`}
                value={
                  field.value && selectedOwnerLabel
                    ? field.value
                    : undefined
                }
                onValueChange={(v) => {
                  if (!v || v === "__none") return;
                  field.onChange(v);
                }}
              >
                <SelectTrigger
                  className={cn(
                    "w-full",
                    form.formState.errors.ownerId && "border-rose-500",
                  )}
                >
                  <SelectValue placeholder="Select owner">
                    {selectedOwnerLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {assigneesPending ? (
                    <SelectItem value="__none" disabled>
                      Loading assignees…
                    </SelectItem>
                  ) : assignees.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      {projectId
                        ? "No assignees — add team members first"
                        : "Select a project first"}
                    </SelectItem>
                  ) : (
                    assignees.map((a) => (
                      <SelectItem key={a.userId} value={a.userId}>
                        {assigneeLabel(a) || a.userId}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.ownerId && (
            <p className={fieldErrorClass}>
              {form.formState.errors.ownerId.message}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Due date <span className="text-destructive font-bold">*</span>
          </label>
          <Controller
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <ProjectDatePicker
                value={field.value}
                onChange={field.onChange}
                minDate={new Date(2000, 0, 1)}
                invalid={Boolean(form.formState.errors.dueDate)}
              />
            )}
          />
          {form.formState.errors.dueDate && (
            <p className={fieldErrorClass}>
              {form.formState.errors.dueDate.message}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Status <span className="text-destructive font-bold">*</span>
          </label>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? field.value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{field.value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="md:col-span-2 rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            Resolution details
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Expected resolution
              </label>
              <Controller
                control={form.control}
                name="expectedResolutionDate"
                render={({ field }) => (
                  <ProjectDatePicker
                    value={field.value ?? undefined}
                    onChange={field.onChange}
                    minDate={new Date(2000, 0, 1)}
                  />
                )}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">
                Resolution note
              </label>
              <Input
                {...form.register("resolutionNote")}
                placeholder="Optional resolution / evidence note"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="size-4 me-2 animate-spin" />}
          {mode === "edit" ? "Save changes" : "Create issue"}
        </Button>
      </div>
    </form>
  );
}
