"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import { getApiErrorMessage } from "@/core/errors/api-error";
import {
  useApproveCostFormulaSettingsMutation,
  useGetCostFormulaSettingsQuery,
  useUpdateCostFormulaSettingsMutation,
} from "../api/settings.api";
import type { UpdateCostFormulaPayload } from "../types/settings.types";

type CostFormulaSectionProps = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  canEdit: boolean;
};

export function CostFormulaSection({
  onSuccess,
  onError,
  canEdit,
}: CostFormulaSectionProps) {
  const { data, isLoading, isError, error } = useGetCostFormulaSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] =
    useUpdateCostFormulaSettingsMutation();
  const [approveSettings, { isLoading: isApproving }] =
    useApproveCostFormulaSettingsMutation();
  const loadErrorNotified = useRef(false);

  const [basis, setBasis] = useState<"ctc" | "gross">("ctc");
  const [hoursPerWeek, setHoursPerWeek] = useState("40");
  const [weeksPerYear, setWeeksPerYear] = useState("52");
  const [otMultiplier, setOtMultiplier] = useState("1.5");
  const [leaveMode, setLeaveMode] = useState<
    "ignore" | "exclude_unpaid" | "prorate"
  >("ignore");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setBasis(data.basis);
    setHoursPerWeek(String(data.hoursPerWeek));
    setWeeksPerYear(String(data.weeksPerYear));
    setOtMultiplier(String(data.otMultiplier));
    setLeaveMode(data.leaveMode);
    setFieldErrors({});
    loadErrorNotified.current = false;
  }, [data]);

  useEffect(() => {
    if (!isError || loadErrorNotified.current) return;
    loadErrorNotified.current = true;
    onError(
      getApiErrorMessage(
        error,
        "Could not load cost formula settings. Check your permissions and try again.",
      ),
    );
  }, [isError, error, onError]);

  const buildPayload = (): UpdateCostFormulaPayload | null => {
    const hours = Number(hoursPerWeek);
    const weeks = Number(weeksPerYear);
    const ot = Number(otMultiplier);
    const nextErrors: Record<string, string> = {};

    if (!Number.isFinite(hours) || hours < 1 || hours > 80) {
      nextErrors.hoursPerWeek = "Must be between 1 and 80.";
    }
    if (!Number.isFinite(weeks) || weeks < 1 || weeks > 53) {
      nextErrors.weeksPerYear = "Must be between 1 and 53.";
    }
    if (!Number.isFinite(ot) || ot < 1 || ot > 3) {
      nextErrors.otMultiplier = "Must be between 1 and 3.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return null;

    return {
      basis,
      hoursPerWeek: hours,
      weeksPerYear: weeks,
      otMultiplier: ot,
      leaveMode,
    };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    if (!payload) return;
    try {
      await updateSettings(payload).unwrap();
      onSuccess("Cost formula saved (draft). Approve to version it.");
    } catch (saveError) {
      onError(
        getApiErrorMessage(
          saveError,
          "Could not save cost formula. Check values and try again.",
        ),
      );
    }
  };

  const handleApprove = async () => {
    const payload = buildPayload();
    if (!payload) return;
    try {
      await approveSettings(payload).unwrap();
      onSuccess("Cost formula approved and versioned.");
    } catch (approveError) {
      onError(
        getApiErrorMessage(
          approveError,
          "Could not approve cost formula. Check values and try again.",
        ),
      );
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading cost formula…</p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        Cost formula settings could not be loaded. Refresh the page or contact
        an administrator.
      </p>
    );
  }

  const busy = isSaving || isApproving;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-start gap-3">
        <Calculator className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Employee cost formula</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Converts compensation to hourly rates and applies overtime for
            approved timesheets. Finance must approve to bump the version used
            in payroll.
          </p>
          <p className="text-xs text-muted-foreground">
            Version {data.version}
            {data.approvedAt
              ? ` · approved ${new Date(data.approvedAt).toLocaleString()}`
              : " · not yet approved"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <div className="space-y-2">
          <Label>Compensation basis</Label>
          <Select
            value={basis}
            onValueChange={(v) => setBasis(v as "ctc" | "gross")}
            disabled={!canEdit || busy}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ctc">CTC</SelectItem>
              <SelectItem value="gross">Gross</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Leave costing mode</Label>
          <Select
            value={leaveMode}
            onValueChange={(v) =>
              setLeaveMode(v as "ignore" | "exclude_unpaid" | "prorate")
            }
            disabled={!canEdit || busy}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ignore">Ignore (approved hours only)</SelectItem>
              <SelectItem value="exclude_unpaid">Exclude unpaid leave</SelectItem>
              <SelectItem value="prorate">Prorate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost-hours-week">Hours per week</Label>
          <Input
            id="cost-hours-week"
            type="number"
            min={1}
            max={80}
            step={1}
            disabled={!canEdit || busy}
            aria-invalid={Boolean(fieldErrors.hoursPerWeek)}
            className={cn(fieldErrors.hoursPerWeek && "border-destructive")}
            value={hoursPerWeek}
            onChange={(e) => setHoursPerWeek(e.target.value)}
          />
          {fieldErrors.hoursPerWeek ? (
            <p className="text-xs text-destructive">{fieldErrors.hoursPerWeek}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost-weeks-year">Weeks per year</Label>
          <Input
            id="cost-weeks-year"
            type="number"
            min={1}
            max={53}
            step={1}
            disabled={!canEdit || busy}
            aria-invalid={Boolean(fieldErrors.weeksPerYear)}
            className={cn(fieldErrors.weeksPerYear && "border-destructive")}
            value={weeksPerYear}
            onChange={(e) => setWeeksPerYear(e.target.value)}
          />
          {fieldErrors.weeksPerYear ? (
            <p className="text-xs text-destructive">{fieldErrors.weeksPerYear}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost-ot-mult">Overtime multiplier</Label>
          <Input
            id="cost-ot-mult"
            type="number"
            min={1}
            max={3}
            step={0.1}
            disabled={!canEdit || busy}
            aria-invalid={Boolean(fieldErrors.otMultiplier)}
            className={cn(fieldErrors.otMultiplier && "border-destructive")}
            value={otMultiplier}
            onChange={(e) => setOtMultiplier(e.target.value)}
          />
          {fieldErrors.otMultiplier ? (
            <p className="text-xs text-destructive">{fieldErrors.otMultiplier}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              OT cost = overtime hours × rate × multiplier (default 1.5).
            </p>
          )}
        </div>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={busy}
            onClick={() => void handleSave()}
          >
            <Save className="size-4" />
            {isSaving ? "Saving…" : "Save draft"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => void handleApprove()}
          >
            <ShieldCheck className="size-4" />
            {isApproving ? "Approving…" : "Approve formula"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          You can view the formula but need financials edit permission to change
          it.
        </p>
      )}
    </section>
  );
}
