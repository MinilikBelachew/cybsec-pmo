"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Save } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/utils/cn";
import { getApiErrorMessage } from "@/core/errors/api-error";
import {
  useGetTimesheetEscalationSettingsQuery,
  useUpdateTimesheetEscalationSettingsMutation,
} from "../api/settings.api";

const MIN_DAYS = 1;
const MAX_DAYS = 30;
/** Matches backend DEFAULT_TIMESHEET_ESCALATION. */
const DEFAULT_ESCALATION_DAYS = 3;

type TimesheetEscalationSectionProps = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function TimesheetEscalationSection({
  onSuccess,
  onError,
}: TimesheetEscalationSectionProps) {
  const { data, isLoading, isError, error } =
    useGetTimesheetEscalationSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] =
    useUpdateTimesheetEscalationSettingsMutation();
  const loadErrorNotified = useRef(false);

  const [escalationDays, setEscalationDays] = useState(
    String(DEFAULT_ESCALATION_DAYS),
  );
  const [fieldError, setFieldError] = useState<string | undefined>();

  useEffect(() => {
    if (!data) return;
    setEscalationDays(String(data.escalationDays));
    setFieldError(undefined);
    loadErrorNotified.current = false;
  }, [data]);

  useEffect(() => {
    if (!isError || loadErrorNotified.current) return;
    loadErrorNotified.current = true;
    onError(
      getApiErrorMessage(
        error,
        "Could not load timesheet escalation settings. Check your permissions and try again.",
      ),
    );
  }, [isError, error, onError]);

  const validate = (value: string): string | undefined => {
    const days = Number(value);
    if (!Number.isInteger(days) || days < MIN_DAYS || days > MAX_DAYS) {
      return `Must be a whole number between ${MIN_DAYS} and ${MAX_DAYS}.`;
    }
    return undefined;
  };

  const handleSave = async () => {
    const err = validate(escalationDays);
    setFieldError(err);
    if (err) return;

    try {
      await updateSettings({
        escalationDays: Number(escalationDays),
      }).unwrap();
      setFieldError(undefined);
      onSuccess("Timesheet escalation settings saved.");
    } catch (saveError) {
      const raw = getApiErrorMessage(
        saveError,
        "Could not save timesheet escalation settings. Check values and try again.",
      );
      if (raw === "escalationDaysOutOfRange") {
        setFieldError(`Must be between ${MIN_DAYS} and ${MAX_DAYS} days.`);
        return;
      }
      onError(raw);
    }
  };

  const handleSetDefaults = async () => {
    setEscalationDays(String(DEFAULT_ESCALATION_DAYS));
    setFieldError(undefined);
    try {
      await updateSettings({
        escalationDays: DEFAULT_ESCALATION_DAYS,
      }).unwrap();
      onSuccess(
        `Timesheet escalation restored to default (${DEFAULT_ESCALATION_DAYS} days).`,
      );
    } catch (restoreError) {
      onError(
        getApiErrorMessage(
          restoreError,
          "Could not restore default timesheet escalation settings.",
        ),
      );
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading timesheet escalation settings…
      </p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        Timesheet escalation settings could not be loaded. Refresh the page or
        contact an administrator.
      </p>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Timesheet escalation</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pending timesheet submissions older than this many days are marked
            Escalated on the Approvals queue and notify project PMs / PMO.
            Applies organization-wide.
          </p>
        </div>
      </div>

      <div className="max-w-xs space-y-2">
        <Label htmlFor="timesheet-escalation-days">Escalate after (days)</Label>
        <Input
          id="timesheet-escalation-days"
          type="number"
          min={MIN_DAYS}
          max={MAX_DAYS}
          step={1}
          aria-invalid={Boolean(fieldError)}
          className={cn(fieldError && "border-destructive")}
          value={escalationDays}
          onChange={(e) => {
            setEscalationDays(e.target.value);
            setFieldError(undefined);
          }}
        />
        {fieldError ? (
          <p className="text-xs text-destructive">{fieldError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Whole days between {MIN_DAYS} and {MAX_DAYS}. Default is{" "}
            {DEFAULT_ESCALATION_DAYS}.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={isSaving}
          onClick={() => void handleSave()}
        >
          <Save className="size-4" />
          {isSaving ? "Saving…" : "Save escalation days"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isSaving}
          onClick={() => void handleSetDefaults()}
        >
          Set to default
        </Button>
      </div>
    </section>
  );
}
