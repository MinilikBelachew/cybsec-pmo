"use client";
import { Spinner } from "@/shared/components/spinner";

import { useEffect, useMemo, useRef } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Clock, X } from "lucide-react";
import {
  Controller,
  useForm,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { toast } from "react-hot-toast";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { FilterSelect } from "@/shared/components/filter-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import { useGetProjectsQuery } from "@/domains/projects";
import { useGetRolesQuery } from "@/domains/roles/api/roles.api";
import { useCreateReportScheduleMutation } from "../api/reports.api";
import {
  WEEKDAYS,
  buildCronExpression,
  describeCronExpression,
  emptyReportScheduleFormValues,
  reportScheduleFormSchema,
  type ReportScheduleFormValues,
} from "../schemas/report-schedule.schema";

type CreateReportScheduleModalProps = {
  open: boolean;
  onClose: () => void;
};

const fieldErrorClass = "text-[11px] font-medium text-rose-600";

const WEEKDAY_OPTIONS = WEEKDAYS.map((day) => ({
  id: String(day.value),
  label: day.label,
}));

function RequiredLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span className="text-rose-600" aria-hidden>
        *
      </span>
    </Label>
  );
}

function openNativeTimePicker(input: HTMLInputElement | null) {
  if (!input) return;
  input.focus();
  const withPicker = input as HTMLInputElement & {
    showPicker?: () => void;
  };
  try {
    withPicker.showPicker?.();
  } catch {
    // Browser may block showPicker outside a direct gesture; focus still helps.
  }
}

export function CreateReportScheduleModal({
  open,
  onClose,
}: CreateReportScheduleModalProps) {
  const { data: projects } = useGetProjectsQuery({ page: 1, limit: 100 });
  const { data: roles } = useGetRolesQuery({ page: 1, limit: 100 });
  const [create, { isLoading }] = useCreateReportScheduleMutation();
  const timeInputRef = useRef<HTMLInputElement | null>(null);

  const internalRoles = useMemo(
    () => (roles?.data ?? []).filter((role) => !role.isExternal),
    [roles?.data],
  );

  const projectOptions = useMemo(
    () =>
      (projects?.data ?? []).map((project) => ({
        id: project.id,
        label: project.name,
      })),
    [projects?.data],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitted },
  } = useForm<ReportScheduleFormValues>({
    resolver: zodResolver(
      reportScheduleFormSchema,
    ) as Resolver<ReportScheduleFormValues>,
    defaultValues: emptyReportScheduleFormValues(),
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const { ref: timeRegisterRef, ...timeRegister } = register("time");

  const reportType = useWatch({ control, name: "reportType" });
  const weekday = useWatch({ control, name: "weekday" });
  const dayOfMonth = useWatch({ control, name: "dayOfMonth" });
  const time = useWatch({ control, name: "time" });

  useEffect(() => {
    if (!open) return;
    reset(emptyReportScheduleFormValues());
  }, [open, reset]);

  const cronPreview = (() => {
    try {
      const values: ReportScheduleFormValues = {
        reportType,
        projectId: "preview",
        roleIds: [1],
        weekday: weekday ?? 1,
        dayOfMonth: dayOfMonth ?? 1,
        time: time || "09:00",
      };
      const cron = buildCronExpression(values);
      return describeCronExpression(cron, reportType);
    } catch {
      return "";
    }
  })();

  const onSubmit = async (values: ReportScheduleFormValues) => {
    try {
      await create({
        reportType: values.reportType,
        projectId: values.projectId,
        cronExpression: buildCronExpression(values),
        isActive: true,
        recipients: values.roleIds.map((roleId) => ({ roleId })),
      }).unwrap();
      toast.success("Schedule created");
      onClose();
    } catch {
      toast.error("Could not create schedule");
    }
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <DialogPrimitive.Title className="flex items-center gap-2 text-sm font-bold text-foreground">
                <CalendarClock className="size-4 text-primary" />
                Create report schedule
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-xs text-muted-foreground">
                Automate WSR/MSR generation for a project on a weekly or monthly
                cadence.
              </DialogPrimitive.Description>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>

          <form
            id="create-report-schedule-form"
            onSubmit={handleSubmit(onSubmit)}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4"
            noValidate
          >
            <div className="space-y-2">
              <RequiredLabel>Report type</RequiredLabel>
              <div className="grid grid-cols-2 gap-2">
                {(["WSR", "MSR"] as const).map((type) => (
                  <label
                    key={type}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2.5 hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="radio"
                      value={type}
                      className="accent-primary"
                      {...register("reportType")}
                    />
                    <span className="text-sm font-medium">
                      {type === "WSR" ? "Weekly (WSR)" : "Monthly (MSR)"}
                    </span>
                  </label>
                ))}
              </div>
              {errors.reportType && (
                <p className={fieldErrorClass}>{errors.reportType.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <RequiredLabel htmlFor="schedule-project">Project</RequiredLabel>
              <Controller
                control={control}
                name="projectId"
                render={({ field }) => (
                  <FilterSelect
                    value={field.value || null}
                    onValueChange={(next) => field.onChange(next ?? "")}
                    options={projectOptions}
                    noneLabel="Select project"
                    searchable
                    searchPlaceholder="Search projects..."
                    allowNone={false}
                    triggerClassName={cn(
                      "h-10 w-full max-w-full rounded-lg border-border/60 bg-background px-3 shadow-none",
                      errors.projectId &&
                        "border-destructive ring-3 ring-destructive/20",
                    )}
                    className="w-full max-w-full"
                  />
                )}
              />
              {errors.projectId && (
                <p className={fieldErrorClass}>{errors.projectId.message}</p>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
              <Label>Schedule</Label>
              <p className="text-xs text-muted-foreground">
                {reportType === "WSR"
                  ? "Choose which weekday the weekly status report should run."
                  : "Choose which day of the month the monthly status report should run."}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {reportType === "WSR" ? (
                  <div className="space-y-1.5">
                    <RequiredLabel htmlFor="schedule-weekday">
                      Day of week
                    </RequiredLabel>
                    <Controller
                      control={control}
                      name="weekday"
                      render={({ field }) => (
                        <FilterSelect
                          value={
                            field.value != null ? String(field.value) : null
                          }
                          onValueChange={(next) =>
                            field.onChange(Number(next ?? field.value ?? 1))
                          }
                          options={WEEKDAY_OPTIONS}
                          noneLabel="Select day"
                          allowNone={false}
                          triggerClassName={cn(
                            "h-10 w-full max-w-full rounded-lg border-border/60 bg-background px-3 shadow-none",
                            errors.weekday &&
                              "border-destructive ring-3 ring-destructive/20",
                          )}
                          className="w-full max-w-full"
                        />
                      )}
                    />
                    {errors.weekday && (
                      <p className={fieldErrorClass}>{errors.weekday.message}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <RequiredLabel>Day of month</RequiredLabel>
                    <Controller
                      control={control}
                      name="dayOfMonth"
                      render={({ field }) => (
                        <Select
                          value={
                            field.value != null ? String(field.value) : undefined
                          }
                          onValueChange={(value) =>
                            field.onChange(Number(value))
                          }
                        >
                          <SelectTrigger
                            className="h-10 w-full"
                            aria-invalid={Boolean(errors.dayOfMonth)}
                          >
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                          <SelectContent
                            alignItemWithTrigger={false}
                            className="max-h-40"
                          >
                            {Array.from(
                              { length: 28 },
                              (_, index) => index + 1,
                            ).map((day) => (
                              <SelectItem key={day} value={String(day)}>
                                {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.dayOfMonth && (
                      <p className={fieldErrorClass}>
                        {errors.dayOfMonth.message}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <RequiredLabel htmlFor="schedule-time">Time</RequiredLabel>
                  <div
                    className={cn(
                      "relative flex h-10 cursor-pointer items-center rounded-lg border border-border/60 bg-background px-3 shadow-none transition-colors hover:border-border focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
                      errors.time &&
                        "border-destructive ring-3 ring-destructive/20",
                    )}
                    onClick={() => openNativeTimePicker(timeInputRef.current)}
                  >
                    <Clock
                      className="pointer-events-none mr-2 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="schedule-time"
                      type="time"
                      step={60}
                      className="h-auto flex-1 cursor-pointer border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                      aria-invalid={Boolean(errors.time)}
                      {...timeRegister}
                      ref={(element) => {
                        timeRegisterRef(element);
                        timeInputRef.current = element;
                      }}
                      onFocus={(event) =>
                        openNativeTimePicker(event.currentTarget)
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        openNativeTimePicker(event.currentTarget);
                      }}
                    />
                  </div>
                  {errors.time && (
                    <p className={fieldErrorClass}>{errors.time.message}</p>
                  )}
                </div>
              </div>

              {cronPreview ? (
                <p className="rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">
                  Runs:{" "}
                  <span className="font-medium text-foreground">
                    {cronPreview}
                  </span>
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <RequiredLabel>Recipient roles</RequiredLabel>
              <p className="text-xs text-muted-foreground">
                Reports are emailed only to users with these roles who are on
                the selected project team (active allocation or project PM).
              </p>
              <Controller
                control={control}
                name="roleIds"
                render={({ field }) => (
                  <div
                    className={cn(
                      "max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-2",
                      errors.roleIds &&
                        isSubmitted &&
                        "border-destructive ring-3 ring-destructive/20",
                    )}
                  >
                    {internalRoles.length === 0 ? (
                      <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                        No internal roles available.
                      </p>
                    ) : (
                      internalRoles.map((role) => {
                        const checked = field.value?.includes(role.id) ?? false;
                        return (
                          <label
                            key={role.id}
                            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                const next = new Set(field.value ?? []);
                                if (value === true) next.add(role.id);
                                else next.delete(role.id);
                                field.onChange([...next]);
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {role.label}
                              </span>
                              {role.code ? (
                                <span className="block truncate text-[11px] text-muted-foreground">
                                  {role.code}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              />
              {errors.roleIds && (
                <p className={fieldErrorClass}>{errors.roleIds.message}</p>
              )}
            </div>
          </form>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-report-schedule-form"
              disabled={isLoading}
            >
              {isLoading ? (
                <Spinner size="sm" className="mr-1" />
              ) : (
                <CalendarClock className="mr-1 size-4" />
              )}
              Create schedule
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
