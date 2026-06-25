"use client";

import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import {
  useGetDepartmentsQuery,
  useGetCustomersQuery,
  useGetProjectManagersQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  createProjectSchema,
  toCreateProjectPayload,
  type CreateProjectFormValues,
  type Project,
} from "@/domains/projects";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import {
  FolderKanban,
  Briefcase,
  Users2,
  DollarSign,
  Loader2,
  Calendar as CalendarIcon,
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
import { CREATE_PROJECT_SHEET_CLASS } from "./task-sheet.constants";

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
    methodology: project.methodology,
    primaryPmId: project.primaryPmId,
    secondaryPmId: project.secondaryPmId ?? "",
    startDate: new Date(project.startDate),
    endDate: new Date(project.endDate),
    value: project.value,
    currency: project.currency,
    engagementType: project.engagementType,
    billingModel: project.billingModel,
    priority: project.priority,
    status: project.status,
  };
}

export function CreateProjectSheet({ open, onClose, refetch, project }: CreateProjectSheetProps) {
  const isEditMode = Boolean(project);
  const [createProject, { isLoading: isCreating }] = useCreateProjectMutation();
  const [updateProject, { isLoading: isUpdating }] = useUpdateProjectMutation();
  const isSubmitting = isCreating || isUpdating;

  const { data: departments = [] } = useGetDepartmentsQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: managers = [] } = useGetProjectManagersQuery();

  const {
    handleSubmit,
    watch,
    control,
    register,
    reset,
    formState: { errors },
  } = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema) as import("react-hook-form").Resolver<CreateProjectFormValues>,
    defaultValues: {
      name: "",
      objective: "",
      departmentId: "",
      customerId: "",
      methodology: "Agile",
      primaryPmId: "",
      secondaryPmId: "",
      startDate: "" as any,
      endDate: "" as any,
      value: "" as any,
      currency: "USD",
      engagementType: "FixedPrice",
      billingModel: "FixedPrice",
      priority: "Medium",
      status: "Draft",
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (!open) return;
    if (project) {
      reset(projectToFormValues(project));
    } else {
      reset({
        name: "",
        objective: "",
        departmentId: "",
        customerId: "",
        methodology: "Agile",
        primaryPmId: "",
        secondaryPmId: "",
        startDate: "" as any,
        endDate: "" as any,
        value: "" as any,
        currency: "USD",
        engagementType: "FixedPrice",
        billingModel: "FixedPrice",
        priority: "Medium",
        status: "Draft",
      });
    }
  }, [open, project, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload = toCreateProjectPayload(values);
      if (isEditMode && project) {
        await updateProject({ id: project.id, body: payload }).unwrap();
        toast.success("Project updated successfully!");
      } else {
        await createProject(payload).unwrap();
        toast.success("Project created successfully!");
      }
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
  });

  const watchedName = watch("name");
  const watchedDeptId = watch("departmentId");
  const watchedCustomerId = watch("customerId");
  const watchedMethodology = watch("methodology");
  const watchedPmId = watch("primaryPmId");
  const watchedSecondaryPmId = watch("secondaryPmId");
  const watchedEngagementType = watch("engagementType");
  const watchedBillingModel = watch("billingModel");
  const watchedStartDate = watch("startDate");
  const watchedEndDate = watch("endDate");
  const watchedStatus = watch("status");
  const watchedPriority = watch("priority");
  const watchedCurrency = watch("currency");

  const activeDept = departments.find((d) => d.id === watchedDeptId);
  const activeCustomer = customers.find((c) => c.id === watchedCustomerId);
  const activePM = managers.find((m) => m.id === watchedPmId);
  const activeSecondaryPM = managers.find((m) => m.id === watchedSecondaryPmId);

  const formatDateLabel = (dateVal: any) => {
    if (!dateVal) return "Pick a date";
    try {
      const date = new Date(dateVal);
      if (isNaN(date.getTime())) return "Pick a date";
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Pick a date";
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className={CREATE_PROJECT_SHEET_CLASS} showCloseButton>
        <form onSubmit={onSubmit} className="flex h-full flex-col">
          <SheetHeader className="shrink-0 border-b border-slate-100 px-8 py-5 text-left dark:border-white/[0.06]">
            <SheetTitle className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              <FolderKanban className="size-5 text-primary" />
              {isEditMode ? "Edit Project" : "New Project"}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 dark:text-slate-400">
              {isEditMode
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
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Project Name *
              </label>
              <input
                type="text"
                placeholder="e.g. ERP Migration Phase 3"
                className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
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
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Description / Objective *
              </label>
              <textarea
                placeholder="Brief overview of project goals, compliance scoping, and technical deliverables..."
                rows={3}
                className="w-full p-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
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
                    <Select value={field.value || ""} onValueChange={field.onChange}>
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
                    <Select value={field.value || ""} onValueChange={field.onChange}>
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

            <div className="grid grid-cols-2 gap-4">
              {/* Methodology */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Methodology *
                </label>
                <Controller
                  control={control}
                  name="methodology"
                  render={({ field }) => (
                    <Select value={field.value || "Agile"} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none flex items-center justify-between">
                        <SelectValue placeholder="Select methodology...">
                          {watchedMethodology === "Agile" ? "⚡ Agile" : watchedMethodology === "Waterfall" ? "🌊 Waterfall" : watchedMethodology === "Hybrid" ? "🔀 Hybrid" : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.07] rounded-lg">
                        <SelectItem value="Agile">⚡ Agile</SelectItem>
                        <SelectItem value="Waterfall">🌊 Waterfall</SelectItem>
                        <SelectItem value="Hybrid">🔀 Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.methodology && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.methodology.message}
                  </p>
                )}
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Status *
                </label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value || "Draft"} onValueChange={field.onChange}>
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
                    <Select value={field.value || ""} onValueChange={field.onChange}>
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

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Start Date *
                </label>
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger type="button" className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none flex items-center justify-between cursor-pointer hover:border-slate-300 dark:hover:border-white/20 transition-all font-normal">
                        <span className={field.value ? "text-slate-900 dark:text-white font-medium" : "text-slate-400"}>
                          {formatDateLabel(field.value)}
                        </span>
                        <CalendarIcon className="size-4 text-slate-400" />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.08] rounded-lg shadow-xl" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => {
                            if (!date) {
                              field.onChange("");
                              return;
                            }
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, "0");
                            const day = String(date.getDate()).padStart(2, "0");
                            field.onChange(`${year}-${month}-${day}`);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
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
                    <Popover>
                      <PopoverTrigger type="button" className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none flex items-center justify-between cursor-pointer hover:border-slate-300 dark:hover:border-white/20 transition-all font-normal">
                        <span className={field.value ? "text-slate-900 dark:text-white font-medium" : "text-slate-400"}>
                          {formatDateLabel(field.value)}
                        </span>
                        <CalendarIcon className="size-4 text-slate-400" />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.08] rounded-lg shadow-xl" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => {
                            if (!date) {
                              field.onChange("");
                              return;
                            }
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, "0");
                            const day = String(date.getDate()).padStart(2, "0");
                            field.onChange(`${year}-${month}-${day}`);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.endDate && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {errors.endDate.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Budget */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Budget Value (k) *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 150"
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                  {...register("value")}
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
                    <Select value={field.value || "USD"} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-sm text-slate-900 dark:text-white outline-none flex items-center justify-between">
                        <SelectValue placeholder="Select currency...">
                          {watchedCurrency || "USD"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-white/[0.07] rounded-lg">
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="AED">AED (د.إ)</SelectItem>
                        <SelectItem value="SAR">SAR (ر.س)</SelectItem>
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
          </div>

          {/* SECTION 3: DELIVERY SETTINGS */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest border-b border-slate-100 dark:border-white/[0.04] pb-2">
              <DollarSign className="size-4" />
              <span>Engagement & Billing</span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Engagement Type *
                </label>
                <Controller
                  control={control}
                  name="engagementType"
                  render={({ field }) => (
                    <Select value={field.value || "FixedPrice"} onValueChange={field.onChange}>
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
                    <Select value={field.value || "FixedPrice"} onValueChange={field.onChange}>
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

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Priority *
                </label>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value || "Medium"} onValueChange={field.onChange}>
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

        </div>

        <SheetFooter className="shrink-0 flex-row justify-between border-t border-slate-100 bg-slate-50 px-8 py-4 dark:border-white/[0.06] dark:bg-zinc-950/40">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditMode ? "Save Changes" : "Create Project"}
          </Button>
        </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
