"use client";

import { useEffect, useMemo } from "react";
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
import { useCreateAlertRuleMutation } from "../api/alerts.api";
import {
  ALERT_CHANNELS,
  ALERT_ESCALATION_ROLE_CODES,
  ALERT_EVENT_TYPES,
  createAlertRuleSchema,
  type AlertRuleFormValues,
} from "../schemas/alert.schema";
import { FormSheet } from "./form-sheet";

type RoleOption = { id: number; code: string; label: string };

const DEFAULT_VALUES: AlertRuleFormValues = {
  eventType: "RISK_SCORE_BREACHED",
  scoreThreshold: 12,
  channels: ["in_app", "email"],
  escalationRole: "",
  reminderCadenceHrs: 24,
  escalationDelayHrs: 48,
  recipientRoleIds: [],
};

const EVENT_TYPE_LABELS: Record<(typeof ALERT_EVENT_TYPES)[number], string> = {
  RISK_SCORE_BREACHED: "Risk score breached",
  ISSUE_ESCALATED: "Issue escalated",
};

const CHANNEL_LABELS: Record<(typeof ALERT_CHANNELS)[number], string> = {
  in_app: "In-app",
  email: "Email",
};

type AlertRuleFormProps = {
  open: boolean;
  roles: RoleOption[];
  onCancel: () => void;
  onSuccess: () => void;
};

export function AlertRuleForm({
  open,
  roles,
  onCancel,
  onSuccess,
}: AlertRuleFormProps) {
  const [createRule, { isLoading: isCreating }] = useCreateAlertRuleMutation();
  const escalationRoles = useMemo(
    () =>
      roles.filter((r) =>
        (ALERT_ESCALATION_ROLE_CODES as readonly string[]).includes(r.code),
      ),
    [roles],
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AlertRuleFormValues>({
    resolver: zodResolver(
      createAlertRuleSchema,
    ) as import("react-hook-form").Resolver<AlertRuleFormValues>,
    defaultValues: {
      ...DEFAULT_VALUES,
      escalationRole: escalationRoles[0]?.code ?? "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      ...DEFAULT_VALUES,
      escalationRole: escalationRoles[0]?.code ?? "",
    });
  }, [open, escalationRoles, reset]);

  const eventType = watch("eventType");
  const escalationRole = watch("escalationRole");
  const recipientRoleIds = watch("recipientRoleIds") ?? [];
  const requiresScoreThreshold = eventType === "RISK_SCORE_BREACHED";

  const selectedEscalationLabel = useMemo(() => {
    const role = escalationRoles.find((r) => r.code === escalationRole);
    return role ? role.label : escalationRole || undefined;
  }, [escalationRoles, escalationRole]);

  const selectedRecipientLabels = useMemo(() => {
    if (recipientRoleIds.length === 0) return "None selected";
    return recipientRoleIds
      .map((id) => roles.find((r) => r.id === id)?.label ?? String(id))
      .join(", ");
  }, [recipientRoleIds, roles]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createRule({
        eventType: values.eventType,
        thresholdConfig:
          values.eventType === "RISK_SCORE_BREACHED"
            ? { scoreGte: values.scoreThreshold }
            : {},
        channels: values.channels,
        escalationRole: values.escalationRole,
        reminderCadenceHrs: values.reminderCadenceHrs,
        escalationDelayHrs: values.escalationDelayHrs,
        recipientRoleIds: values.recipientRoleIds,
        isActive: true,
      }).unwrap();
      toast.success("Alert rule created");
      onSuccess();
    } catch {
      toast.error("Failed to create alert rule");
    }
  });

  const fieldErrorClass = "text-[11px] font-medium text-rose-500";

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title="New alert rule"
      description="Define when alerts fire, who receives them, and escalation."
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
            Event type <span className="text-destructive font-bold">*</span>
          </label>
          <Controller
            control={control}
            name="eventType"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) =>
                  field.onChange(
                    (v as AlertRuleFormValues["eventType"]) || field.value,
                  )
                }
              >
                <SelectTrigger
                  className={cn(
                    "w-full",
                    errors.eventType && "border-rose-500",
                  )}
                >
                  <SelectValue placeholder="Select event type">
                    {EVENT_TYPE_LABELS[eventType] ?? eventType}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ALERT_EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {EVENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.eventType && (
            <p className={fieldErrorClass}>{errors.eventType.message}</p>
          )}
        </div>
        {requiresScoreThreshold && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Score threshold (≥){" "}
              <span className="text-destructive font-bold">*</span>
            </label>
            <Input
              type="number"
              min={1}
              {...register("scoreThreshold", { valueAsNumber: true })}
              className={cn(errors.scoreThreshold && "border-rose-500")}
            />
            {errors.scoreThreshold && (
              <p className={fieldErrorClass}>{errors.scoreThreshold.message}</p>
            )}
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Channels <span className="text-destructive font-bold">*</span>
          </label>
          <Controller
            control={control}
            name="channels"
            render={({ field }) => (
              <div
                className={cn(
                  "flex flex-wrap gap-2 rounded-lg border border-border/60 p-2",
                  errors.channels && "border-rose-500",
                )}
              >
                {ALERT_CHANNELS.map((channel) => {
                  const checked = (field.value ?? []).includes(channel);
                  return (
                    <label
                      key={channel}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1 text-xs cursor-pointer hover:bg-muted/40"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const current = field.value ?? [];
                          field.onChange(
                            checked
                              ? current.filter((c) => c !== channel)
                              : [...current, channel],
                          );
                        }}
                      />
                      {CHANNEL_LABELS[channel]}
                    </label>
                  );
                })}
              </div>
            )}
          />
          {errors.channels && (
            <p className={fieldErrorClass}>{errors.channels.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Escalation role <span className="text-destructive font-bold">*</span>
          </label>
          <Controller
            control={control}
            name="escalationRole"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={(v) => field.onChange(v ?? "")}
              >
                <SelectTrigger
                  className={cn(
                    "w-full",
                    errors.escalationRole && "border-rose-500",
                  )}
                >
                  <SelectValue placeholder="Select escalation role">
                    {selectedEscalationLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {escalationRoles.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No roles available
                    </SelectItem>
                  ) : (
                    escalationRoles.map((role) => (
                      <SelectItem key={role.id} value={role.code}>
                        {role.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          />
          {errors.escalationRole && (
            <p className={fieldErrorClass}>{errors.escalationRole.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Reminder cadence (hrs){" "}
            <span className="text-destructive font-bold">*</span>
          </label>
          <Input
            type="number"
            min={1}
            {...register("reminderCadenceHrs", { valueAsNumber: true })}
            className={cn(errors.reminderCadenceHrs && "border-rose-500")}
          />
          {errors.reminderCadenceHrs && (
            <p className={fieldErrorClass}>{errors.reminderCadenceHrs.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Escalation delay (hrs){" "}
            <span className="text-destructive font-bold">*</span>
          </label>
          <Input
            type="number"
            min={1}
            {...register("escalationDelayHrs", { valueAsNumber: true })}
            className={cn(errors.escalationDelayHrs && "border-rose-500")}
          />
          {errors.escalationDelayHrs && (
            <p className={fieldErrorClass}>{errors.escalationDelayHrs.message}</p>
          )}
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs text-muted-foreground">
            Recipient roles ({selectedRecipientLabels}){" "}
            <span className="text-destructive font-bold">*</span>
          </label>
          <Controller
            control={control}
            name="recipientRoleIds"
            render={({ field }) => (
              <div
                className={cn(
                  "flex flex-wrap gap-2 rounded-lg border border-border/60 p-2 max-h-32 overflow-y-auto",
                  errors.recipientRoleIds && "border-rose-500",
                )}
              >
                {roles.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    No roles available
                  </span>
                ) : (
                  roles.map((role) => {
                    const checked = (field.value ?? []).includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1 text-xs cursor-pointer hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const current = field.value ?? [];
                            field.onChange(
                              checked
                                ? current.filter((id) => id !== role.id)
                                : [...current, role.id],
                            );
                          }}
                        />
                        {role.label}
                      </label>
                    );
                  })
                )}
              </div>
            )}
          />
          {errors.recipientRoleIds && (
            <p className={fieldErrorClass}>{errors.recipientRoleIds.message}</p>
          )}
        </div>
      </div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isCreating}>
          {isCreating && <Loader2 className="size-4 me-2 animate-spin" />}
          Save rule
        </Button>
      </div>
    </form>
    </FormSheet>
  );
}
