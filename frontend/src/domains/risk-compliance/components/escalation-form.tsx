"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useDebounce } from "@/shared/hooks/use-debounce";
import {
  EmployeePickerSelect,
  type EmployeePickerOption,
} from "@/shared/components/employee-picker-select";
import { useGetTeamDirectoryQuery } from "@/domains/resources";
import {
  useAddEscalationCommunicationMutation,
  useCloseEscalationMutation,
  useCreateEscalationMutation,
} from "../api/escalations.api";
import {
  closeEscalationSchema,
  createEscalationSchema,
  escalationCommunicationSchema,
  type CloseEscalationFormValues,
  type EscalationCommunicationFormValues,
  type EscalationFormValues,
} from "../schemas/escalation.schema";
import { FormSheet } from "./form-sheet";

const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
const COMM_CHANNELS = ["Call", "Email", "Meeting", "Chat", "Other"] as const;
const EMPLOYEE_PAGE_SIZE = 30;

type CustomerOption = { id: string; displayName?: string | null };

const CREATE_DEFAULTS: EscalationFormValues = {
  customerId: "",
  severity: "High",
  slaTargetHrs: 24,
  ownerId: "",
  initialCommunication: "",
  initialChannel: "Email",
};

type EscalationFormProps = {
  open: boolean;
  customers: CustomerOption[];
  onCancel: () => void;
  onSuccess: () => void;
};

export function EscalationForm({
  open,
  customers,
  onCancel,
  onSuccess,
}: EscalationFormProps) {
  const [createEscalation, { isLoading: isCreating }] =
    useCreateEscalationMutation();
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerPage, setOwnerPage] = useState(1);
  const [ownerPages, setOwnerPages] = useState<EmployeePickerOption[][]>([]);
  const debouncedOwnerSearch = useDebounce(ownerSearch, 300);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<EscalationFormValues>({
    resolver: zodResolver(
      createEscalationSchema,
    ) as import("react-hook-form").Resolver<EscalationFormValues>,
    defaultValues: CREATE_DEFAULTS,
  });

  useEffect(() => {
    if (!open) return;
    reset(CREATE_DEFAULTS);
    setOwnerSearch("");
    setOwnerPage(1);
    setOwnerPages([]);
  }, [open, reset]);

  useEffect(() => {
    setOwnerPage(1);
    setOwnerPages([]);
  }, [debouncedOwnerSearch]);

  const {
    data: teamDirectoryData,
    isLoading: isEmployeesLoading,
    isFetching: isEmployeesFetching,
  } = useGetTeamDirectoryQuery(
    {
      page: ownerPage,
      limit: EMPLOYEE_PAGE_SIZE,
      search: debouncedOwnerSearch.trim() || undefined,
      sortBy: "name",
      sortOrder: "asc",
      requireUserId: true,
    },
    { skip: !open, refetchOnMountOrArgChange: true },
  );

  useEffect(() => {
    const members = teamDirectoryData?.members;
    if (!members || teamDirectoryData.page !== ownerPage) return;

    const mapped = members
      .filter((m) => Boolean(m.userId))
      .map((m) => ({
        id: m.userId as string,
        name: m.name,
        profileImageUrl: m.profileImageUrl,
        subtitle: `${m.department.name} · ${m.designation}`,
      }));

    setOwnerPages((prev) => {
      const next = prev.slice(0, Math.max(0, ownerPage - 1));
      next[ownerPage - 1] = mapped;
      return next;
    });
  }, [teamDirectoryData, ownerPage]);

  const ownerOptions = useMemo(
    () => ownerPages.flat(),
    [ownerPages],
  );

  const customerId = watch("customerId");
  const ownerId = watch("ownerId");
  const severity = watch("severity");
  const initialChannel = watch("initialChannel");

  const selectedCustomerName =
    customers.find((c) => c.id === customerId)?.displayName || undefined;
  const selectedOwner = useMemo(
    () => ownerOptions.find((o) => o.id === ownerId) ?? null,
    [ownerOptions, ownerId],
  );

  const totalEmployees = teamDirectoryData?.total ?? 0;
  const hasMoreOwners = ownerOptions.length < totalEmployees;
  const isFetchingMoreOwners =
    isEmployeesFetching && ownerOptions.length > 0 && ownerPage > 1;
  const isOwnerListLoading =
    (isEmployeesLoading || isEmployeesFetching) && ownerOptions.length === 0;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createEscalation({
        customerId: values.customerId,
        severity: values.severity,
        slaTargetHrs: Number(values.slaTargetHrs),
        ownerId: values.ownerId,
        initialCommunication: values.initialCommunication?.trim() || undefined,
        initialChannel: values.initialChannel,
      }).unwrap();
      toast.success("Escalation created");
      onSuccess();
    } catch {
      toast.error("Failed to create escalation");
    }
  });

  const fieldErrorClass = "text-[11px] font-medium text-rose-500";

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title="New escalation"
      description="Open a customer escalation with severity, SLA, and owner."
    >
    <form
      onSubmit={onSubmit}
      className="flex min-h-0 flex-1 flex-col"
      noValidate
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Customer <span className="text-destructive font-bold">*</span>
          </label>
          <Controller
            control={control}
            name="customerId"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={(v) => field.onChange(v ?? "")}
              >
                <SelectTrigger className={cn(errors.customerId && "border-rose-500", "w-full")}>
                  <SelectValue placeholder="Select customer">
                    {selectedCustomerName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.displayName || c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.customerId && (
            <p className={fieldErrorClass}>{errors.customerId.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Severity <span className="text-destructive font-bold">*</span>
          </label>
          <Controller
            control={control}
            name="severity"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) =>
                  field.onChange((v as (typeof SEVERITIES)[number]) || "High")
                }
              >
                <SelectTrigger className={cn(errors.severity && "border-rose-500", "w-full")}>
                  <SelectValue>{severity}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            SLA hours <span className="text-destructive font-bold">*</span>
          </label>
          <Input
            type="number"
            min={1}
            {...register("slaTargetHrs", { valueAsNumber: true })}
            className={cn(errors.slaTargetHrs && "border-rose-500")}
          />
          {errors.slaTargetHrs && (
            <p className={fieldErrorClass}>{errors.slaTargetHrs.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Owner <span className="text-destructive font-bold">*</span>
          </label>
          <Controller
            control={control}
            name="ownerId"
            render={({ field }) => (
              <EmployeePickerSelect
                value={field.value || null}
                onValueChange={(v) => field.onChange(v ?? "")}
                options={ownerOptions}
                selectedOption={selectedOwner}
                placeholder="Select owner"
                noneLabel="Select owner"
                searchable
                remoteSearch
                searchValue={ownerSearch}
                onSearchChange={setOwnerSearch}
                searchPlaceholder="Search employee..."
                onLoadMore={() => {
                  if (!hasMoreOwners || isEmployeesFetching) return;
                  setOwnerPage((p) => p + 1);
                }}
                hasMore={hasMoreOwners}
                isLoading={isOwnerListLoading}
                isFetchingMore={isFetchingMoreOwners}
                triggerClassName={cn(
                  "h-9 w-full min-w-0",
                  errors.ownerId && "border-rose-500",
                )}
              />
            )}
          />
          {errors.ownerId && (
            <p className={fieldErrorClass}>{errors.ownerId.message}</p>
          )}
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs text-muted-foreground">
            Initial communication
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Controller
              control={control}
              name="initialChannel"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) =>
                    field.onChange(
                      (v as EscalationFormValues["initialChannel"]) || "Email",
                    )
                  }
                >
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue>{initialChannel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {COMM_CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Input
              {...register("initialCommunication")}
              placeholder="Optional first customer communication"
              className="flex-1"
            />
          </div>
        </div>
      </div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isCreating}>
          {isCreating && <Loader2 className="size-4 me-2 animate-spin" />}
          Create
        </Button>
      </div>
    </form>
    </FormSheet>
  );
}

type EscalationCommFormProps = {
  escalationId: string;
};

export function EscalationCommForm({ escalationId }: EscalationCommFormProps) {
  const [addComm, { isLoading }] = useAddEscalationCommunicationMutation();
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EscalationCommunicationFormValues>({
    resolver: zodResolver(escalationCommunicationSchema),
    defaultValues: { channel: "Email", content: "" },
  });

  const channel = watch("channel");

  const onSubmit = handleSubmit(async (values) => {
    try {
      await addComm({
        id: escalationId,
        channel: values.channel,
        content: values.content,
      }).unwrap();
      toast.success("Communication logged");
      reset({ channel: "Email", content: "" });
    } catch {
      toast.error("Failed to log communication");
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap gap-2 items-start" noValidate>
      <Controller
        control={control}
        name="channel"
        render={({ field }) => (
          <Select
            value={field.value}
            onValueChange={(v) =>
              field.onChange(
                (v as EscalationCommunicationFormValues["channel"]) || "Email",
              )
            }
          >
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue>{channel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COMM_CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <div className="flex-1 min-w-[160px] space-y-1">
        <Input
          placeholder="Log communication…"
          {...register("content")}
          className={cn(errors.content && "border-rose-500")}
        />
        {errors.content && (
          <p className="text-[11px] text-rose-500">{errors.content.message}</p>
        )}
      </div>
      <Button type="submit" size="sm" disabled={isLoading}>
        {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : "Log"}
      </Button>
    </form>
  );
}

type CloseEscalationFormProps = {
  escalationId: string;
  onClosed: () => void;
  onCancel: () => void;
};

export function CloseEscalationForm({
  escalationId,
  onClosed,
  onCancel,
}: CloseEscalationFormProps) {
  const [closeEscalation, { isLoading }] = useCloseEscalationMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CloseEscalationFormValues>({
    resolver: zodResolver(closeEscalationSchema),
    defaultValues: { resolutionSummary: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await closeEscalation({
        id: escalationId,
        resolutionSummary: values.resolutionSummary,
      }).unwrap();
      toast.success("Escalation closed");
      onClosed();
    } catch {
      toast.error("Failed to close");
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2 rounded-lg border border-border/50 p-3"
      noValidate
    >
      <label className="text-xs text-muted-foreground">
        Resolution summary <span className="text-destructive font-bold">*</span>
      </label>
      <Input
        {...register("resolutionSummary")}
        placeholder="How was this resolved?"
        className={cn(errors.resolutionSummary && "border-rose-500")}
      />
      {errors.resolutionSummary && (
        <p className="text-[11px] text-rose-500">
          {errors.resolutionSummary.message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isLoading}>
          {isLoading && <Loader2 className="size-3.5 me-1 animate-spin" />}
          Confirm close
        </Button>
      </div>
    </form>
  );
}
