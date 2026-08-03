"use client";

import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useCreateAlertRuleMutation } from "../api/alerts.api";
import {
  createAlertRuleSchema,
  type AlertRuleFormValues,
} from "../schemas/alert.schema";

type RoleOption = { id: number; label: string };

const DEFAULT_VALUES: AlertRuleFormValues = {
  eventType: "RISK_SCORE_BREACHED",
  scoreThreshold: 12,
  channels: "in_app,email",
  escalationRole: "pmo_lead",
  reminderCadenceHrs: 24,
  escalationDelayHrs: 48,
  recipientRoleIds: [],
};

type AlertRuleFormProps = {
  roles: RoleOption[];
  onCancel: () => void;
  onSuccess: () => void;
};

export function AlertRuleForm({ roles, onCancel, onSuccess }: AlertRuleFormProps) {
  const [createRule, { isLoading: isCreating }] = useCreateAlertRuleMutation();
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AlertRuleFormValues>({
    resolver: zodResolver(
      createAlertRuleSchema,
    ) as import("react-hook-form").Resolver<AlertRuleFormValues>,
    defaultValues: DEFAULT_VALUES,
  });

  const recipientRoleIds = watch("recipientRoleIds") ?? [];
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
        thresholdConfig: { scoreGte: values.scoreThreshold },
        channels: values.channels
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
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
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-border/60 bg-card p-4 space-y-3"
      noValidate
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Event type</label>
          <Input {...register("eventType")} />
          {errors.eventType && (
            <p className={fieldErrorClass}>{errors.eventType.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Score threshold (≥)</label>
          <Input
            type="number"
            min={1}
            {...register("scoreThreshold", { valueAsNumber: true })}
          />
          {errors.scoreThreshold && (
            <p className={fieldErrorClass}>{errors.scoreThreshold.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Channels (comma-separated)
          </label>
          <Input {...register("channels")} placeholder="in_app,email" />
          {errors.channels && (
            <p className={fieldErrorClass}>{errors.channels.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Escalation role</label>
          <Input {...register("escalationRole")} />
          {errors.escalationRole && (
            <p className={fieldErrorClass}>{errors.escalationRole.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Reminder cadence (hrs)</label>
          <Input
            type="number"
            min={1}
            {...register("reminderCadenceHrs", { valueAsNumber: true })}
          />
          {errors.reminderCadenceHrs && (
            <p className={fieldErrorClass}>{errors.reminderCadenceHrs.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Escalation delay (hrs)</label>
          <Input
            type="number"
            min={1}
            {...register("escalationDelayHrs", { valueAsNumber: true })}
          />
          {errors.escalationDelayHrs && (
            <p className={fieldErrorClass}>{errors.escalationDelayHrs.message}</p>
          )}
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs text-muted-foreground">
            Recipient roles ({selectedRecipientLabels})
          </label>
          <Controller
            control={control}
            name="recipientRoleIds"
            render={({ field }) => (
              <div className="flex flex-wrap gap-2 rounded-lg border border-border/60 p-2 max-h-32 overflow-y-auto">
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
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isCreating}>
          {isCreating && <Loader2 className="size-4 me-2 animate-spin" />}
          Save rule
        </Button>
      </div>
    </form>
  );
}
