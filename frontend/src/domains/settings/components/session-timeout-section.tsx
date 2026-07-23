"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Save } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/utils/cn";
import { getApiErrorMessage } from "@/core/errors/api-error";
import {
  useGetSessionSecuritySettingsQuery,
  useUpdateSessionSecuritySettingsMutation,
} from "../api/settings.api";

const IDLE_MIN_MINUTES = 1;
const IDLE_MAX_MINUTES = 1440;
const WARNING_MIN_MINUTES = 1;
/** Matches backend DEFAULT_SESSION_SECURITY (900s / 300s). */
const DEFAULT_IDLE_MINUTES = "15";
const DEFAULT_WARNING_MINUTES = "5";
const DEFAULT_IDLE_TIMEOUT_SEC = 900;
const DEFAULT_WARNING_BEFORE_SEC = 300;

type SessionTimeoutSectionProps = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

type FieldErrors = {
  idle?: string;
  warning?: string;
};

function secToMinutes(sec: number): string {
  return String(Math.max(1, Math.round(sec / 60)));
}

function minutesToSec(minutes: string): number {
  return Math.round(Number(minutes) * 60);
}

function validateFields(idleMinutes: string, warningMinutes: string): FieldErrors {
  const idle = Number(idleMinutes);
  const warning = Number(warningMinutes);
  const errors: FieldErrors = {};

  if (!Number.isFinite(idle) || idle < IDLE_MIN_MINUTES || idle > IDLE_MAX_MINUTES) {
    errors.idle = `Must be between ${IDLE_MIN_MINUTES} and ${IDLE_MAX_MINUTES} minutes.`;
  }

  if (!Number.isFinite(warning) || warning < WARNING_MIN_MINUTES) {
    errors.warning = `Must be at least ${WARNING_MIN_MINUTES} minute.`;
  } else if (Number.isFinite(idle) && warning >= idle) {
    errors.warning = "Must be shorter than the idle timeout.";
  }

  return errors;
}

export function SessionTimeoutSection({
  onSuccess,
  onError,
}: SessionTimeoutSectionProps) {
  const { data, isLoading, isError, error } = useGetSessionSecuritySettingsQuery();
  const [updateSettings, { isLoading: isSaving }] =
    useUpdateSessionSecuritySettingsMutation();
  const loadErrorNotified = useRef(false);

  const [idleMinutes, setIdleMinutes] = useState("15");
  const [warningMinutes, setWarningMinutes] = useState("5");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!data) return;
    setIdleMinutes(secToMinutes(data.idleTimeoutSec));
    setWarningMinutes(secToMinutes(data.warningBeforeSec));
    setFieldErrors({});
    loadErrorNotified.current = false;
  }, [data]);

  useEffect(() => {
    if (!isError || loadErrorNotified.current) return;
    loadErrorNotified.current = true;
    onError(
      getApiErrorMessage(
        error,
        "Could not load session timeout settings. Check your permissions and try again.",
      ),
    );
  }, [isError, error, onError]);

  const handleSave = async () => {
    const errors = validateFields(idleMinutes, warningMinutes);
    setFieldErrors(errors);
    if (errors.idle || errors.warning) return;

    try {
      await updateSettings({
        idleTimeoutSec: minutesToSec(idleMinutes),
        warningBeforeSec: minutesToSec(warningMinutes),
      }).unwrap();
      setFieldErrors({});
      onSuccess("Session timeout settings saved.");
    } catch (err) {
      const raw = getApiErrorMessage(
        err,
        "Could not save session timeout settings. Check values and try again.",
      );
      if (raw === "warningBeforeSecMustBeLessThanIdleTimeoutSec") {
        setFieldErrors({ warning: "Must be shorter than the idle timeout." });
        return;
      }
      onError(raw);
    }
  };

  const handleSetDefaults = async () => {
    setIdleMinutes(DEFAULT_IDLE_MINUTES);
    setWarningMinutes(DEFAULT_WARNING_MINUTES);
    setFieldErrors({});
    try {
      await updateSettings({
        idleTimeoutSec: DEFAULT_IDLE_TIMEOUT_SEC,
        warningBeforeSec: DEFAULT_WARNING_BEFORE_SEC,
      }).unwrap();
      onSuccess("Session timeout restored to defaults (15 min idle, 5 min warning).");
    } catch (err) {
      onError(
        getApiErrorMessage(
          err,
          "Could not restore default session timeout settings.",
        ),
      );
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading session timeout settings…</p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        Session timeout settings could not be loaded. Refresh the page or contact an
        administrator.
      </p>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-start gap-3">
        <Clock className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Session timeout</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sign users out after a period of inactivity. A warning appears before logout so they
            can stay signed in. Applies to all users organization-wide.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="idle-timeout-minutes">Idle timeout (minutes)</Label>
          <Input
            id="idle-timeout-minutes"
            type="number"
            min={IDLE_MIN_MINUTES}
            max={IDLE_MAX_MINUTES}
            aria-invalid={Boolean(fieldErrors.idle)}
            className={cn(fieldErrors.idle && "border-destructive")}
            value={idleMinutes}
            onChange={(e) => {
              setIdleMinutes(e.target.value);
              setFieldErrors((prev) => ({ ...prev, idle: undefined }));
            }}
          />
          {fieldErrors.idle ? (
            <p className="text-xs text-destructive">{fieldErrors.idle}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Logout after this many minutes without activity (1–1440).
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="warning-before-minutes">Warning before logout (minutes)</Label>
          <Input
            id="warning-before-minutes"
            type="number"
            min={WARNING_MIN_MINUTES}
            max={Math.max(WARNING_MIN_MINUTES, Number(idleMinutes) - 1 || 1)}
            aria-invalid={Boolean(fieldErrors.warning)}
            className={cn(fieldErrors.warning && "border-destructive")}
            value={warningMinutes}
            onChange={(e) => {
              setWarningMinutes(e.target.value);
              setFieldErrors((prev) => ({ ...prev, warning: undefined }));
            }}
          />
          {fieldErrors.warning ? (
            <p className="text-xs text-destructive">{fieldErrors.warning}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Show the “Stay signed in?” dialog this many minutes before timeout.
            </p>
          )}
        </div>
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
          {isSaving ? "Saving…" : "Save session timeout"}
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
