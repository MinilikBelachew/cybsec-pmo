"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/shared/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/utils/cn";
import {
  useCreateProjectMutation,
  useGetCustomersQuery,
  useGetDepartmentsQuery,
  useGetProjectManagersQuery,
  createProjectSchema,
  toCreateProjectPayload,
  type CreateProjectFormValues,
} from "@/domains/projects";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const selectClassName =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[0.8rem] font-medium text-destructive">{message}</p>;
}

function FormSelect({
  id,
  label,
  error,
  placeholder,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={cn(error && "text-destructive")}>
        {label}
      </Label>
      <select id={id} className={cn(selectClassName, error && "border-destructive")} {...props}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </div>
  );
}

export function CreateProjectForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: departments = [], isLoading: loadingDepartments } = useGetDepartmentsQuery();
  const { data: customers = [], isLoading: loadingCustomers } = useGetCustomersQuery();
  const { data: projectManagers = [], isLoading: loadingPms } = useGetProjectManagersQuery();
  const [createProject, { isLoading: isSubmitting }] = useCreateProjectMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema) as import("react-hook-form").Resolver<CreateProjectFormValues>,
    defaultValues: {
      methodology: "Hybrid",
      priority: "Medium",
      currency: "USD",
      status: "Draft",
      secondaryPmId: null,
    },
  });

  const isLoadingLookups = loadingDepartments || loadingCustomers || loadingPms;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const project = await createProject(toCreateProjectPayload(values)).unwrap();
      router.push("/dashboard/projects");
    } catch (err: unknown) {
      const apiError = err as { data?: { errors?: Record<string, string>; message?: string } };
      const fieldErrors = apiError?.data?.errors;
      if (fieldErrors) {
        const firstError = Object.values(fieldErrors)[0];
        setSubmitError(typeof firstError === "string" ? firstError : "Failed to create project.");
      } else {
        setSubmitError(apiError?.data?.message ?? "Failed to create project. Please try again.");
      }
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <PageHeader
        title="Create Project"
        description="Define a new engagement with customer, delivery, and commercial details."
      />

      {submitError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Project Overview</CardTitle>
          <CardDescription>Core identification and objective for the engagement.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="name" className={cn(errors.name && "text-destructive")}>
              Project Name
            </Label>
            <Input id="name" placeholder="SOC Transformation 2026" {...register("name")} />
            <FieldError message={errors.name?.message} />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="objective" className={cn(errors.objective && "text-destructive")}>
              Objective
            </Label>
            <textarea
              id="objective"
              rows={3}
              placeholder="Describe the project objective..."
              className={cn(
                "flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
                errors.objective && "border-destructive"
              )}
              {...register("objective")}
            />
            <FieldError message={errors.objective?.message} />
          </div>

          <FormSelect
            id="departmentId"
            label="Department"
            placeholder={isLoadingLookups ? "Loading..." : "Select department"}
            error={errors.departmentId?.message}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            disabled={isLoadingLookups}
            {...register("departmentId")}
          />

          <FormSelect
            id="customerId"
            label="Customer"
            placeholder={isLoadingLookups ? "Loading..." : "Select customer"}
            error={errors.customerId?.message}
            options={customers.map((c) => ({ value: c.id, label: c.displayName }))}
            disabled={isLoadingLookups}
            {...register("customerId")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery & Commercial</CardTitle>
          <CardDescription>Engagement model, timeline, and contract value.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormSelect
            id="engagementType"
            label="Engagement Type"
            error={errors.engagementType?.message}
            options={[
              { value: "ManagedServices", label: "Managed Services" },
              { value: "StaffAugmentation", label: "Staff Augmentation" },
              { value: "FixedPrice", label: "Fixed Price" },
            ]}
            {...register("engagementType")}
          />

          <FormSelect
            id="methodology"
            label="Methodology"
            error={errors.methodology?.message}
            options={[
              { value: "Agile", label: "Agile" },
              { value: "Waterfall", label: "Waterfall" },
              { value: "Hybrid", label: "Hybrid" },
            ]}
            {...register("methodology")}
          />

          <FormSelect
            id="billingModel"
            label="Billing Model"
            error={errors.billingModel?.message}
            options={[
              { value: "TimeAndMaterial", label: "Time & Material" },
              { value: "FixedPrice", label: "Fixed Price" },
              { value: "Retainer", label: "Retainer" },
            ]}
            {...register("billingModel")}
          />

          <FormSelect
            id="priority"
            label="Priority"
            error={errors.priority?.message}
            options={[
              { value: "Low", label: "Low" },
              { value: "Medium", label: "Medium" },
              { value: "High", label: "High" },
              { value: "Critical", label: "Critical" },
            ]}
            {...register("priority")}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate" className={cn(errors.startDate && "text-destructive")}>
              Start Date
            </Label>
            <Input id="startDate" type="date" {...register("startDate")} />
            <FieldError message={errors.startDate?.message as string | undefined} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endDate" className={cn(errors.endDate && "text-destructive")}>
              End Date
            </Label>
            <Input id="endDate" type="date" {...register("endDate")} />
            <FieldError message={errors.endDate?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="value" className={cn(errors.value && "text-destructive")}>
              Contract Value
            </Label>
            <Input id="value" type="number" min="0" step="0.01" {...register("value")} />
            <FieldError message={errors.value?.message} />
          </div>

          <FormSelect
            id="currency"
            label="Currency"
            error={errors.currency?.message}
            options={[
              { value: "USD", label: "USD" },
              { value: "EUR", label: "EUR" },
              { value: "AED", label: "AED" },
              { value: "SAR", label: "SAR" },
            ]}
            {...register("currency")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignment</CardTitle>
          <CardDescription>Assign project managers and initial status.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormSelect
            id="primaryPmId"
            label="Primary PM"
            placeholder={isLoadingLookups ? "Loading..." : "Select primary PM"}
            error={errors.primaryPmId?.message}
            options={projectManagers.map((pm) => ({
              value: pm.id,
              label: `${pm.displayName} (${pm.roleCode})`,
            }))}
            disabled={isLoadingLookups}
            {...register("primaryPmId")}
          />

          <FormSelect
            id="secondaryPmId"
            label="Secondary PM (optional)"
            placeholder="None"
            error={errors.secondaryPmId?.message}
            options={[
              { value: "", label: "None" },
              ...projectManagers.map((pm) => ({
                value: pm.id,
                label: `${pm.displayName} (${pm.roleCode})`,
              })),
            ]}
            disabled={isLoadingLookups}
            {...register("secondaryPmId", {
              setValueAs: (v) => (v === "" ? null : v),
            })}
          />

          <FormSelect
            id="status"
            label="Status"
            error={errors.status?.message}
            options={[
              { value: "Draft", label: "Draft" },
              { value: "Active", label: "Active" },
              { value: "OnHold", label: "On Hold" },
              { value: "PendingClosure", label: "Pending Closure" },
              { value: "Closed", label: "Closed" },
            ]}
            {...register("status")}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || isLoadingLookups}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Project"
          )}
        </Button>
      </div>
    </form>
  );
}
