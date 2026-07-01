"use client";

import React, { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import {
  useGetDepartmentsQuery,
  useGetCustomersQuery,
  useGetProjectManagersQuery,
  useCreateProjectBundleMutation,
  useGetCurrenciesQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useAddProjectTeamMembersMutation,
  useGetMilestonesQuery,
  useCreateMilestoneMutation,
  createProjectFormSchema,
  editProjectFormSchema,
  toCreateProjectPayload,
  ProjectTeamSection,
  type CreateProjectFormValues,
  type PendingTeamMember,
  type Project,
  type ProjectTeamSectionHandle,
} from "@/domains/projects";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { ProjectDatePicker, startOfToday } from "../shared/project-date-picker";
import {
  FolderKanban,
  Briefcase,
  Users2,
  DollarSign,
  Loader2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { CREATE_PROJECT_SHEET_CLASS } from "../tasks/task-sheet.constants";
import { BudgetValueInput } from "../shared/budget-value-input";
import {
  ProjectFormMilestonesSection,
  toDraftMilestonePayload,
  isMilestoneDateOutOfRange,
  type DraftProjectMilestone,
  type ProjectFormMilestonesSectionHandle,
} from "./project-form-milestones-section";

interface CreateProjectSheetProps {
  open: boolean;
  onClose: () => void;
  refetch?: () => void;
  project?: Project | null;
}

function projectToFormValues(project: Project): CreateProjectFormValues {
  return {
    name: project.name,
    objective: project.objective,
    departmentId: project.departmentId,
    customerId: project.customerId,
    primaryPmId: project.primaryPmId,
    secondaryPmId: project.secondaryPmId ?? "",
    startDate: new Date(project.startDate),
    endDate: new Date(project.endDate),
    value: project.value ?? ("" as any),
    currency: project.currency ?? "USD",
    engagementType: project.engagementType ?? "FixedPrice",
    billingModel: project.billingModel ?? "FixedPrice",
    priority: project.priority,
    status: project.status,
  };
}

function mergeTeamMembers(
  pendingMembers: PendingTeamMember[],
  draftMembers: PendingTeamMember[],
): PendingTeamMember[] {
  const byEmployeeId = new Map(
    pendingMembers.map((member) => [member.employeeId, member]),
  );

  for (const member of draftMembers) {
    if (!byEmployeeId.has(member.employeeId)) {
      byEmployeeId.set(member.employeeId, member);
    }
  }

  return Array.from(byEmployeeId.values());
}

function toAllocationPayload(members: PendingTeamMember[]) {
  return members.map((member) => ({
    employeeId: member.employeeId,
    role: member.role,
    hours: member.hoursPerWeek,
    startDate: member.startDate,
    endDate: member.endDate,
  }));
}

function toMilestoneApiPayload(draft: ReturnType<typeof toDraftMilestonePayload>[number]) {
  return {
    title: draft.title,
    targetDate: new Date(draft.targetDate).toISOString(),
    weight: draft.weight ?? undefined,
    status: draft.status,
  };
}

const PROJECT_NAME_MAX = 255;
const PROJECT_OBJECTIVE_MAX = 2000;

function validateMilestoneDraftDates(
  drafts: DraftProjectMilestone[],
  projectStartDate?: Date,
  projectEndDate?: Date,
): string | null {
  for (const draft of drafts) {
    if (!draft.targetDate) continue;
    const target = new Date(draft.targetDate);
    if (Number.isNaN(target.getTime())) {
      return `Milestone "${draft.title}" has an invalid target date.`;
    }
    if (projectEndDate) {
      const end = new Date(projectEndDate);
      end.setHours(23, 59, 59, 999);
      if (target > end) {
        return `Milestone "${draft.title}" cannot be after the project end date.`;
      }
    }
    if (projectStartDate) {
      const start = new Date(projectStartDate);
      start.setHours(0, 0, 0, 0);
      if (target < start) {
        return `Milestone "${draft.title}" cannot be before the project start date.`;
      }
    }
  }
  return null;
}

export function CreateProjectSheet({ open, onClose, refetch, project }: CreateProjectSheetProps) {
  const isEditMode = Boolean(project);
  const {
    canEditProjects,
    canViewFinancials,
    canEditTeam: canManageTeam,
    canEditMilestones,
  } = useModulePermissions();
  const canEditProject = canEditProjects;
  const canEditTeam = canEditProject && canManageTeam;
  const isViewOnly = isEditMode && !canEditProject;
  const showFinancialFields = canViewFinancials || canEditProject;
  const milestonesReadOnly = isViewOnly || !canEditMilestones;
  const teamSectionRef = useRef<ProjectTeamSectionHandle>(null);
  const milestoneSectionRef = useRef<ProjectFormMilestonesSectionHandle>(null);
  const [pendingTeamMembers, setPendingTeamMembers] = useState<PendingTeamMember[]>([]);
  const [milestoneDrafts, setMilestoneDrafts] = useState<DraftProjectMilestone[]>([]);
  const [milestoneError, setMilestoneError] = useState<string | null>(null);
  const [createProjectBundle, { isLoading: isCreating }] = useCreateProjectBundleMutation();
  const [updateProject, { isLoading: isUpdating }] = useUpdateProjectMutation();
  const [addProjectTeamMembers, { isLoading: isSavingTeam }] = useAddProjectTeamMembersMutation();
  const [createMilestone, { isLoading: isSavingMilestones }] = useCreateMilestoneMutation();
  const isSubmitting = isCreating || isUpdating || isSavingTeam || isSavingMilestones;

  const { data: existingMilestones = [] } = useGetMilestonesQuery(project?.id ?? "", {
    skip: !isEditMode || !project?.id || !open,
  });

  const { data: departments = [] } = useGetDepartmentsQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: managers = [] } = useGetProjectManagersQuery();
  const { data: currencies = [] } = useGetCurrenciesQuery();

  const {
    handleSubmit,
    watch,
    control,
    register,
    reset,
    trigger,
    formState: { errors },
  } = useForm<CreateProjectFormValues>({
    resolver: zodResolver(
      isEditMode ? editProjectFormSchema : createProjectFormSchema,
    ) as import("react-hook-form").Resolver<CreateProjectFormValues>,
    defaultValues: {
      name: "",
      objective: "",
      departmentId: "",
      customerId: "",
      primaryPmId: "",
      secondaryPmId: "",
      startDate: undefined,
      endDate: undefined,
      value: "" as any,
      currency: "USD",
      engagementType: "FixedPrice",
      billingModel: "FixedPrice",
      priority: "Medium",
      status: "Draft",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (!open) {
      setPendingTeamMembers([]);
      setMilestoneDrafts([]);
      setMilestoneError(null);
      return;
    }
    setMilestoneError(null);
    if (project) {
      reset(projectToFormValues(project));
    } else {
      reset({
        name: "",
        objective: "",
        departmentId: "",
        customerId: "",
        primaryPmId: "",
        secondaryPmId: "",
        startDate: undefined,
        endDate: undefined,
        value: "" as any,
        currency: "USD",
        engagementType: "FixedPrice",
        billingModel: "FixedPrice",
        priority: "Medium",
        status: "Draft",
      });
    }
  }, [open, project, reset]);

  const onFormError = (formErrors: any) => {
    console.log("Validation errors:", formErrors);
    setTimeout(() => {
      const firstErrorElement = document.querySelector("p.text-rose-500");
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  };

  const onValidSubmit = async (values: CreateProjectFormValues) => {
    setMilestoneError(null);
    let currentMilestoneDrafts = milestoneDrafts;
    const unsaved = milestoneSectionRef.current?.getUnsavedMilestone();
    if (unsaved && (unsaved.title || unsaved.targetDate || unsaved.weight)) {
      if (!unsaved.title) {
        setMilestoneError("Milestone title is required.");
        document.getElementById("project-milestones-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (!unsaved.targetDate) {
        setMilestoneError("Milestone target date is required.");
        document.getElementById("project-milestones-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const dateError = isMilestoneDateOutOfRange(
        unsaved.targetDate,
        values.startDate,
        values.endDate,
      );
      if (dateError) {
        setMilestoneError(`${dateError}`);
        document.getElementById("project-milestones-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (unsaved.weight) {
        const wVal = Number(unsaved.weight);
        if (Number.isNaN(wVal) || wVal < 0 || wVal > 100) {
          setMilestoneError("Milestone weight % must be between 0 and 100.");
          document.getElementById("project-milestones-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }

      const newDraft = {
        clientId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: unsaved.title.trim().replace(/\s+/g, " "),
        targetDate: unsaved.targetDate,
        weight: unsaved.weight ? Number(unsaved.weight) : null,
        status: "Pending",
      };

      currentMilestoneDrafts = [...milestoneDrafts, newDraft];
      setMilestoneDrafts(currentMilestoneDrafts);
      milestoneSectionRef.current?.clearUnsavedMilestone();
    }

    const milestoneDateError = validateMilestoneDraftDates(
      currentMilestoneDrafts,
      values.startDate,
      values.endDate,
    );
    if (milestoneDateError) {
      setMilestoneError(milestoneDateError);
      document.getElementById("project-milestones-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    try {
      const payload = toCreateProjectPayload(values);
      const draftMembers = teamSectionRef.current?.collectMembersToSave() ?? [];
      const membersToSave = mergeTeamMembers(pendingTeamMembers, draftMembers);
      const newMilestones = toDraftMilestonePayload(currentMilestoneDrafts);
      let targetProjectId = project?.id;

      if (isEditMode && project) {
        await updateProject({ id: project.id, body: payload }).unwrap();
        targetProjectId = project.id;
        toast.success("Project updated successfully!");

        if (targetProjectId && membersToSave.length > 0) {
          const teamResult = await addProjectTeamMembers({
            projectId: targetProjectId,
            body: { allocations: toAllocationPayload(membersToSave) },
          }).unwrap();

          teamResult.warnings.forEach((warning) => toast(warning, { icon: "⚠️" }));
          if (teamResult.created.length > 0) {
            toast.success(
              `${teamResult.created.length} team member${teamResult.created.length === 1 ? "" : "s"} assigned.`,
            );
          }
        }

        if (targetProjectId && newMilestones.length > 0) {
          for (const milestone of newMilestones) {
            await createMilestone({
              projectId: targetProjectId,
              body: toMilestoneApiPayload(milestone),
            }).unwrap();
          }
          toast.success(
            `${newMilestones.length} milestone${newMilestones.length === 1 ? "" : "s"} added.`,
          );
        }
      } else {
        const created = await createProjectBundle({
          ...payload,
          allocations:
            membersToSave.length > 0 ? toAllocationPayload(membersToSave) : undefined,
          milestones:
            newMilestones.length > 0
              ? newMilestones.map((milestone) => toMilestoneApiPayload(milestone))
              : undefined,
        }).unwrap();
        targetProjectId = created.id;
        const milestoneNote =
          newMilestones.length > 0
            ? ` and ${newMilestones.length} milestone${newMilestones.length === 1 ? "" : "s"}`
            : "";
        toast.success(
          membersToSave.length > 0
            ? `Project created with ${membersToSave.length} team member${membersToSave.length === 1 ? "" : "s"}${milestoneNote}.`
            : newMilestones.length > 0
              ? `Project created with ${newMilestones.length} milestone${newMilestones.length === 1 ? "" : "s"}.`
              : "Project created successfully!",
        );
      }

      setPendingTeamMembers([]);
      setMilestoneDrafts([]);
      refetch?.();
      onClose();
    } catch (err: any) {
      console.error("Project save failed:", err);
      const apiError = err as { data?: { errors?: Record<string, string>; message?: string } };
      const fieldErrors = apiError?.data?.errors;
      if (fieldErrors) {
        const firstError = Object.values(fieldErrors)[0];
        toast.error(typeof firstError === "string" ? firstError : "Failed to save project.");
      } else {
        toast.error(apiError?.data?.message ?? "Failed to save project. Please try again.");
      }
    }
  };

  const onSubmit = handleSubmit(onValidSubmit, onFormError);

  const watchedName = watch("name");
  const watchedObjective = watch("objective");
  const watchedDeptId = watch("departmentId");
  const watchedCustomerId = watch("customerId");
  const watchedPmId = watch("primaryPmId");
  const watchedSecondaryPmId = watch("secondaryPmId");
  const watchedEngagementType = watch("engagementType");
  const watchedBillingModel = watch("billingModel");
  const watchedStartDate = watch("startDate");
  const watchedEndDate = watch("endDate");

  useEffect(() => {
    if (!watchedStartDate || !watchedEndDate) return;
    void trigger("endDate");
  }, [watchedStartDate, watchedEndDate, trigger]);
  const watchedStatus = watch("status");
  const watchedPriority = watch("priority");
  const watchedCurrency = watch("currency");

  const activeDept = departments.find((d) => d.id === watchedDeptId);
  const activeCustomer = customers.find((c) => c.id === watchedCustomerId);
  const activePM = managers.find((m) => m.id === watchedPmId);
  const activeSecondaryPM = managers.find((m) => m.id === watchedSecondaryPmId);

  const endDateMin = (() => {
    const today = startOfToday();
    if (!watchedStartDate) return today;
    const start = watchedStartDate instanceof Date ? watchedStartDate : new Date(watchedStartDate);
    return start > today ? start : today;
  })();

  const readOnlyFieldClass =
    "disabled:cursor-default disabled:opacity-90 disabled:bg-slate-100/80 dark:disabled:bg-white/[0.04]";

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className={CREATE_PROJECT_SHEET_CLASS} showCloseButton>
        <form onSubmit={onSubmit} className="flex h-full flex-col">
          <SheetHeader className="shrink-0 border-b border-slate-100 px-8 py-5 text-left dark:border-white/[0.06]">
            <SheetTitle className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              <FolderKanban className="size-5 text-primary" />
              {isEditMode ? (isViewOnly ? "View Project" : "Edit Project") : "New Project"}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 dark:text-slate-400">
              {isViewOnly
                ? "Project details are read-only for your role."
                : isEditMode
                  ? "Update project specifications and delivery settings"
                  : "Configure project specifications inside a unified ledger"}
            </SheetDescription>
          </SheetHeader>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* SECTION 1: OVERVIEW */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest border-b border-slate-100 dark:border-white/[0.04] pb-2">
              <Briefcase className="size-4" />
              <span>Project Overview</span>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Project Name *
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {(watchedName ?? "").length}/{PROJECT_NAME_MAX}
                </span>
              </div>
              <input
                type="text"
                placeholder="e.g. ERP Migration Phase 3"
                maxLength={PROJECT_NAME_MAX}
                disabled={isViewOnly}
                className={`w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium ${readOnlyFieldClass}`}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-[11px] font-semibold text-rose-500 mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Description / Objective *
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {(watchedObjective ?? "").length}/{PROJECT_OBJECTIVE_MAX}
                </span>
              </div>
              <textarea
                placeholder="Brief overview of project goals, compliance scoping, and technical deliverables..."
                rows={3}
                maxLength={PROJECT_OBJECTIVE_MAX}
                disabled={isViewOnly}
                className={`w-full p-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none ${readOnlyFieldClass}`}
                {...register("objective")}
              />
              {errors.objective && (
                <p className="text-[11px] font-semibold text-rose-500 mt-1">
                  {errors.objective.message}
                </p>
              )}
            </div>

            {/* Department & Customer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Department *
                </label>
                <Controller
                  control={control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange} disabled={isViewOnly}>
                      <SelectTrigger className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none flex items-center justify-between">
                        <SelectValue placeholder="Select...">
                          {activeDept ? `${activeDept.name} (${activeDept.code})` : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.07] rounded-lg max-h-60 overflow-y-auto">
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.departmentId && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.departmentId.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Client / Customer *
                </label>
                <Controller
                  control={control}
                  name="customerId"
                  render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange} disabled={isViewOnly}>
                      <SelectTrigger className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none flex items-center justify-between">
                        <SelectValue placeholder="Select...">
                          {activeCustomer ? activeCustomer.displayName : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.07] rounded-lg max-h-60 overflow-y-auto">
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.customerId && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.customerId.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Status *
                </label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value || "Draft"} onValueChange={field.onChange} disabled={isViewOnly}>
                      <SelectTrigger className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none flex items-center justify-between">
                        <SelectValue placeholder="Select status...">
                          {watchedStatus === "Draft" ? "Draft" : watchedStatus === "Active" ? "Active" : watchedStatus === "OnHold" ? "On Hold" : watchedStatus === "PendingClosure" ? "At Risk" : watchedStatus === "Closed" ? "Completed" : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.07] rounded-lg">
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="OnHold">On Hold</SelectItem>
                        <SelectItem value="PendingClosure">At Risk</SelectItem>
                        <SelectItem value="Closed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.status && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.status.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: GOVERNANCE & TIMELINE */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest border-b border-slate-100 dark:border-white/[0.04] pb-2">
              <Users2 className="size-4" />
              <span>Governance & Schedule</span>
            </div>

            {/* Project Managers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Primary PM *
                </label>
                <Controller
                  control={control}
                  name="primaryPmId"
                  render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange} disabled={isViewOnly}>
                      <SelectTrigger className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none flex items-center justify-between">
                        <SelectValue placeholder="Select PM...">
                          {activePM ? activePM.displayName : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.07] rounded-lg max-h-60 overflow-y-auto">
                        {managers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.primaryPmId && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.primaryPmId.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Secondary PM
                </label>
                <Controller
                  control={control}
                  name="secondaryPmId"
                  render={({ field }) => (
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                      disabled={isViewOnly}
                    >
                      <SelectTrigger className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none flex items-center justify-between">
                        <SelectValue placeholder="None">
                          {activeSecondaryPM ? activeSecondaryPM.displayName : "None"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.07] rounded-lg max-h-60 overflow-y-auto">
                        <SelectItem value="none">None</SelectItem>
                        {managers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.secondaryPmId && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.secondaryPmId.message}
                  </p>
                )}
              </div>
            </div>

            {/* Dates — before team so availability uses this range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Start Date *
                </label>
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field }) => (
                    <ProjectDatePicker
                      value={field.value}
                      onChange={(date) => {
                        field.onChange(date);
                        void trigger("endDate");
                      }}
                      minDate={isEditMode ? startOfToday() : startOfToday()}
                      disabled={isViewOnly}
                    />
                  )}
                />
                {errors.startDate && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.startDate.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  End Date *
                </label>
                <Controller
                  control={control}
                  name="endDate"
                  render={({ field }) => (
                    <ProjectDatePicker
                      value={field.value}
                      onChange={(date) => {
                        field.onChange(date);
                        void trigger("endDate");
                      }}
                      minDate={endDateMin}
                      invalid={Boolean(errors.endDate)}
                      disabled={isViewOnly}
                    />
                  )}
                />
                {errors.endDate && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.endDate.message}
                  </p>
                )}
              </div>
            </div>

            <ProjectTeamSection
              ref={teamSectionRef}
              projectId={project?.id}
              departmentId={watchedDeptId || undefined}
              startDate={watchedStartDate}
              endDate={watchedEndDate}
              pendingMembers={pendingTeamMembers}
              onPendingMembersChange={setPendingTeamMembers}
              canEdit={canEditTeam}
            />

            {showFinancialFields && (
            <div className="grid grid-cols-2 gap-4">
              {/* Budget */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Budget value *
                </label>
                <Controller
                  control={control}
                  name="value"
                  render={({ field }) => (
                    <BudgetValueInput
                      value={field.value as number | undefined}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  )}
                />
                {errors.value && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.value.message}
                  </p>
                )}
              </div>

              {/* Currency */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Currency *
                </label>
                <Controller
                  control={control}
                  name="currency"
                  render={({ field }) => (
                    <Select value={field.value || "USD"} onValueChange={field.onChange} disabled={isViewOnly}>
                      <SelectTrigger className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none flex items-center justify-between">
                        <SelectValue placeholder="Select currency...">
                          {(() => {
                            const found = currencies.find((c) => c.code === watchedCurrency);
                            return found ? `${found.code} (${found.symbol})` : (watchedCurrency || "USD");
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.07] rounded-lg">
                        {currencies.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code} ({c.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.currency && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.currency.message}
                  </p>
                )}
              </div>
            </div>
            )}
          </div>

          {/* SECTION 3: DELIVERY SETTINGS */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest border-b border-slate-100 dark:border-white/[0.04] pb-2">
              <DollarSign className="size-4" />
              <span>{showFinancialFields ? "Engagement & Billing" : "Delivery"}</span>
            </div>

            <div className={showFinancialFields ? "grid grid-cols-3 gap-4" : "grid grid-cols-1 gap-4 sm:max-w-xs"}>
              {showFinancialFields && (
                <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Engagement Type *
                </label>
                <Controller
                  control={control}
                  name="engagementType"
                  render={({ field }) => (
                    <Select value={field.value || "FixedPrice"} onValueChange={field.onChange} disabled={isViewOnly}>
                      <SelectTrigger className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none flex items-center justify-between">
                        <SelectValue placeholder="Select type...">
                          {watchedEngagementType === "ManagedServices" ? "Managed Services" : watchedEngagementType === "StaffAugmentation" ? "Staff Augmentation" : watchedEngagementType === "FixedPrice" ? "Fixed Price" : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.07] rounded-lg">
                        <SelectItem value="ManagedServices">Managed Services</SelectItem>
                        <SelectItem value="StaffAugmentation">Staff Augmentation</SelectItem>
                        <SelectItem value="FixedPrice">Fixed Price</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.engagementType && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.engagementType.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Billing Model *
                </label>
                <Controller
                  control={control}
                  name="billingModel"
                  render={({ field }) => (
                    <Select value={field.value || "FixedPrice"} onValueChange={field.onChange} disabled={isViewOnly}>
                      <SelectTrigger className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none flex items-center justify-between">
                        <SelectValue placeholder="Select model...">
                          {watchedBillingModel === "FixedPrice" ? "Fixed Price" : watchedBillingModel === "TimeAndMaterial" ? "Time & Material" : watchedBillingModel === "Retainer" ? "Retainer" : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.07] rounded-lg">
                        <SelectItem value="FixedPrice">Fixed Price</SelectItem>
                        <SelectItem value="TimeAndMaterial">Time & Material</SelectItem>
                        <SelectItem value="Retainer">Retainer</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.billingModel && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.billingModel.message}
                  </p>
                )}
              </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Priority *
                </label>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value || "Medium"} onValueChange={field.onChange} disabled={isViewOnly}>
                      <SelectTrigger className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none flex items-center justify-between">
                        <SelectValue placeholder="Select priority...">
                          {watchedPriority || "Medium"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.07] rounded-lg">
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.priority && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.priority.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <ProjectFormMilestonesSection
            ref={milestoneSectionRef}
            existingMilestones={isEditMode ? existingMilestones : []}
            drafts={milestoneDrafts}
            onDraftsChange={(newDrafts) => {
              setMilestoneDrafts(newDrafts);
              setMilestoneError(null);
            }}
            projectStartDate={watchedStartDate}
            projectEndDate={watchedEndDate}
            error={milestoneError || undefined}
            readOnly={milestonesReadOnly}
          />

        </div>

        <SheetFooter className="shrink-0 flex-row justify-between border-t border-slate-100 bg-slate-50 px-8 py-4 dark:border-white/[0.06] dark:bg-zinc-950/40">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {isViewOnly ? "Close" : "Cancel"}
          </Button>
          {!isViewOnly && (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isEditMode ? "Save Changes" : "Create Project"}
            </Button>
          )}
        </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
