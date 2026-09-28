"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Save } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/utils/cn";
import { getApiErrorMessage } from "@/core/errors/api-error";
import {
  useGetFinanceAlertSettingsQuery,
  useUpdateFinanceAlertSettingsMutation,
} from "../api/settings.api";

const MIN_THRESHOLD = 0;
const MAX_THRESHOLD = 999_999_999;
const DEFAULT_THRESHOLD = 10_000;

type FinanceAlertsSectionProps = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  canEdit: boolean;
};

export function FinanceAlertsSection({
  onSuccess,
  onError,
  canEdit,
}: FinanceAlertsSectionProps) {
  const { data, isLoading, isError, error } = useGetFinanceAlertSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] =
    useUpdateFinanceAlertSettingsMutation();
  const loadErrorNotified = useRef(false);

  const [threshold, setThreshold] = useState(String(DEFAULT_THRESHOLD));
  const [fieldError, setFieldError] = useState<string | undefined>();

  useEffect(() => {
    if (!data) return;
    setThreshold(String(data.largeUnpaidBalanceThreshold));
    setFieldError(undefined);
    loadErrorNotified.current = false;
  }, [data]);

  useEffect(() => {
    if (!isError || loadErrorNotified.current) return;
    loadErrorNotified.current = true;
    onError(
      getApiErrorMessage(
        error,
        "Could not load finance alert settings. Check your permissions and try again.",
      ),
    );
  }, [isError, error, onError]);

  const validate = (value: string): string | undefined => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < MIN_THRESHOLD || n > MAX_THRESHOLD) {
      return `Must be a number between ${MIN_THRESHOLD} and ${MAX_THRESHOLD.toLocaleString()}.`;
    }
    const parts = value.trim().split(".");
    if (parts[1] && parts[1].length > 2) {
      return "At most 2 decimal places.";
    }
    return undefined;
  };

  const handleSave = async () => {
    const err = validate(threshold);
    setFieldError(err);
    if (err) return;

    try {
      await updateSettings({
        largeUnpaidBalanceThreshold: Number(threshold),
      }).unwrap();
      setFieldError(undefined);
      onSuccess("Finance alert settings saved.");
    } catch (saveError) {
      const raw = getApiErrorMessage(
        saveError,
        "Could not save finance alert settings. Check values and try again.",
      );
      if (raw === "largeUnpaidBalanceThresholdOutOfRange") {
        setFieldError(
          `Must be between ${MIN_THRESHOLD} and ${MAX_THRESHOLD.toLocaleString()}.`,
        );
        return;
      }
      onError(raw);
    }
  };

  const handleSetDefaults = async () => {
    setThreshold(String(DEFAULT_THRESHOLD));
    setFieldError(undefined);
    try {
      await updateSettings({
        largeUnpaidBalanceThreshold: DEFAULT_THRESHOLD,
      }).unwrap();
      onSuccess(
        `Large unpaid threshold restored to default (${DEFAULT_THRESHOLD.toLocaleString()}).`,
      );
    } catch (restoreError) {
      onError(
        getApiErrorMessage(
          restoreError,
          "Could not restore default finance alert settings.",
        ),
      );
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-bold flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600" />
          Finance alerts
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Large unpaid balance threshold for Finance notifications (invoice
          currency units). Set to 0 to disable. Overdue and Zoho sync-failure
          alerts always run for Finance / PMO Lead / Super Admin.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3 max-w-sm">
          <div className="space-y-1.5">
            <Label htmlFor="large-unpaid-threshold">
              Large unpaid balance threshold
            </Label>
            <Input
              id="large-unpaid-threshold"
              type="number"
              min={MIN_THRESHOLD}
              max={MAX_THRESHOLD}
              step="0.01"
              value={threshold}
              disabled={!canEdit || isSaving}
              onChange={(e) => {
                setThreshold(e.target.value);
                setFieldError(undefined);
              }}
              className={cn(fieldError && "border-destructive")}
            />
            {fieldError ? (
              <p className="text-xs text-destructive">{fieldError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Alert when project-linked invoice balance ≥ this amount.
              </p>
            )}
          </div>

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={isSaving}
                onClick={() => void handleSave()}
              >
                <Save className="size-3.5" />
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isSaving}
                onClick={() => void handleSetDefaults()}
              >
                Restore default
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
