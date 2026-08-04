"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
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
  useCreateRiskMutation,
  useUpdateRiskMutation,
} from "../api/risks.api";
import {
  RISK_CATEGORY_OPTIONS,
  RISK_STATUS_OPTIONS,
  createRiskSchema,
  type RiskFormValues,
} from "../schemas/risk.schema";
import type { Risk } from "../types/risks.types";
import {
  assigneeLabel,
  getApiErrorMessage,
  scoreBadgeClass,
  toApiDate,
  toDateOnly,
} from "../utils/form-utils";

type ProjectOption = { id: string; name: string };

type RiskFormProps = {
  mode: "create" | "edit";
  risk?: Risk | null;
  projects: ProjectOption[];
  defaultProjectId?: string;
  onCancel: () => void;
  onSuccess: () => void;
};

export function RiskForm({
  mode,
  risk,
  projects,
  defaultProjectId,
  onCancel,
  onSuccess,
}: RiskFormProps) {
  const [createRisk, { isLoading: isCreating }] = useCreateRiskMutation();
  const [updateRisk, { isLoading: isUpdating }] = useUpdateRiskMutation();

  const form = useForm<RiskFormValues>({
    resolver: zodResolver(createRiskSchema),
    defaultValues: {
      projectId: defaultProjectId || projects[0]?.id || "",
      title: "",
      category: "TECHNICAL",
      impact: 3,
      likelihood: 3,
      ownerId: "",
      mitigationPlan: "",
      residualImpact: null,
      residualLikelihood: null,
      status: "Open",
    },
  });

  useEffect(() => {
    if (mode === "edit" && risk) {
      form.reset({
        projectId: risk.projectId,
        title: risk.title,
        category: risk.category,
        impact: risk.impact,
        likelihood: risk.likelihood,
        ownerId: risk.ownerId,
        mitigationPlan: risk.mitigationPlan ?? "",
        targetDate: toDateOnly(risk.targetDate),
        residualImpact: risk.residualImpact ?? null,
        residualLikelihood: risk.residualLikelihood ?? null,
        status: (risk.status as RiskFormValues["status"]) || "Open",
      });
      return;
    }
    form.reset({
      projectId: defaultProjectId || projects[0]?.id || "",
      title: "",
      category: "TECHNICAL",
      impact: 3,
      likelihood: 3,
      ownerId: "",
      mitigationPlan: "",
      targetDate: undefined,
      residualImpact: null,
      residualLikelihood: null,
      status: "Open",
    });
  }, [mode, risk, defaultProjectId, projects, form]);

  const projectId = form.watch("projectId");
  const ownerId = form.watch("ownerId");
  const impact = form.watch("impact");
  const likelihood = form.watch("likelihood");
  const liveScore =
    Number.isFinite(impact) && Number.isFinite(likelihood)
      ? Number(impact) * Number(likelihood)
      : 0;

  const {
    data: assignees = [],
    isFetching: assigneesFetching,
    isLoading: assigneesLoading,
  } = useGetProjectTaskAssigneesQuery(projectId, {
    skip: !projectId,
  });

  // Clear owner only after the new project's assignees have loaded.
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
    risk?.projectName ??
    undefined;
  const selectedOwner = assignees.find((a) => a.userId === ownerId);
  const selectedOwnerLabel =
    assigneeLabel(selectedOwner) ||
    (mode === "edit" &&
    risk &&
    risk.projectId === projectId &&
    risk.ownerId === ownerId
      ? risk.owner?.displayName
      : undefined);

  const onSubmit = form.handleSubmit(async (values) => {
    const body = {
      title: values.title,
      category: values.category,
      impact: values.impact,
      likelihood: values.likelihood,
      ownerId: values.ownerId,
      mitigationPlan: values.mitigationPlan || undefined,
      targetDate: values.targetDate ? toApiDate(values.targetDate) : undefined,
      residualImpact: values.residualImpact ?? undefined,
      residualLikelihood: values.residualLikelihood ?? undefined,
      status: values.status,
    };
    try {
      if (mode === "edit" && risk) {
        await updateRisk({
          projectId: risk.projectId,
          riskId: risk.id,
          body,
        }).unwrap();
        toast.success("Risk updated");
      } else {
        await createRisk({ projectId: values.projectId, body }).unwrap();
        toast.success("Risk created");
      }
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save risk"));
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
        {mode === "edit" ? "Edit risk" : "New risk"}
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
          <Input {...form.register("title")} placeholder="Risk title" />
          {form.formState.errors.title && (
            <p className={fieldErrorClass}>{form.formState.errors.title.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Category <span className="text-destructive font-bold">*</span>
          </label>
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? field.value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{field.value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RISK_CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
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
                key={`risk-owner-${projectId || "none"}`}
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

        <div className="md:col-span-2 grid gap-3 sm:grid-cols-[minmax(9rem,11rem)_1fr_1fr] items-start">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Score</label>
            <div className="flex h-8 items-center rounded-lg border border-border/60 bg-muted/30 px-3">
              <Badge
                variant="outline"
                className={cn("border", scoreBadgeClass(liveScore))}
              >
                {Number.isFinite(impact) ? impact : "—"} ×{" "}
                {Number.isFinite(likelihood) ? likelihood : "—"} ={" "}
                {liveScore || "—"}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Impact × Likelihood
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Impact (1–4) <span className="text-destructive font-bold">*</span>
            </label>
            <Controller
              control={form.control}
              name="impact"
              render={({ field }) => (
                <Input
                  type="number"
                  min={1}
                  max={4}
                  value={Number.isNaN(field.value) ? "" : field.value}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? NaN : Number(e.target.value),
                    )
                  }
                  className={cn(
                    form.formState.errors.impact && "border-rose-500",
                  )}
                />
              )}
            />
            {form.formState.errors.impact && (
              <p className={fieldErrorClass}>
                {form.formState.errors.impact.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Likelihood (1–4){" "}
              <span className="text-destructive font-bold">*</span>
            </label>
            <Controller
              control={form.control}
              name="likelihood"
              render={({ field }) => (
                <Input
                  type="number"
                  min={1}
                  max={4}
                  value={Number.isNaN(field.value) ? "" : field.value}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? NaN : Number(e.target.value),
                    )
                  }
                  className={cn(
                    form.formState.errors.likelihood && "border-rose-500",
                  )}
                />
              )}
            />
            {form.formState.errors.likelihood && (
              <p className={fieldErrorClass}>
                {form.formState.errors.likelihood.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Target date</label>
          <Controller
            control={form.control}
            name="targetDate"
            render={({ field }) => (
              <ProjectDatePicker
                value={field.value ?? undefined}
                onChange={field.onChange}
              />
            )}
          />
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
                  {RISK_STATUS_OPTIONS.map((s) => (
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
            Residual risk &amp; mitigation
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Residual impact
              </label>
              <Controller
                control={form.control}
                name="residualImpact"
                render={({ field }) => (
                  <Input
                    type="number"
                    min={1}
                    max={4}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className={cn(
                      form.formState.errors.residualImpact && "border-rose-500",
                    )}
                  />
                )}
              />
              {form.formState.errors.residualImpact && (
                <p className={fieldErrorClass}>
                  {form.formState.errors.residualImpact.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Residual likelihood
              </label>
              <Controller
                control={form.control}
                name="residualLikelihood"
                render={({ field }) => (
                  <Input
                    type="number"
                    min={1}
                    max={4}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className={cn(
                      form.formState.errors.residualLikelihood &&
                        "border-rose-500",
                    )}
                  />
                )}
              />
              {form.formState.errors.residualLikelihood && (
                <p className={fieldErrorClass}>
                  {form.formState.errors.residualLikelihood.message}
                </p>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-muted-foreground">
                Mitigation plan
              </label>
              <Input
                {...form.register("mitigationPlan")}
                placeholder="Mitigation / treatment plan"
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
          {mode === "edit" ? "Save changes" : "Create risk"}
        </Button>
      </div>
    </form>
  );
}
