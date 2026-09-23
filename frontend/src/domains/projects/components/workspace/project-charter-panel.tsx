"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, Save } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Spinner } from "@/shared/components/spinner";
import { cn } from "@/shared/utils/cn";
import {
  downloadCharterPdf,
  useApproveProjectCharterMutation,
  useGetProjectCharterQuery,
  useUpdateProjectCharterMutation,
} from "../../api/charters.api";

type ProjectCharterPanelProps = {
  projectId: string;
  canEdit?: boolean;
  canApprove?: boolean;
};

type FormState = {
  purpose: string;
  successCriteria: string;
  scopeSummary: string;
  scopeExclusions: string;
  keyDeliverables: string;
  highLevelRisks: string;
  milestoneSchedule: string;
  valueSnapshot: string;
  resourceEstimates: string;
  stakeholders: string;
  pmAuthority: string;
  startDate: string;
  endDate: string;
};

const EMPTY_FORM: FormState = {
  purpose: "",
  successCriteria: "",
  scopeSummary: "",
  scopeExclusions: "",
  keyDeliverables: "",
  highLevelRisks: "",
  milestoneSchedule: "",
  valueSnapshot: "",
  resourceEstimates: "",
  stakeholders: "",
  pmAuthority: "",
  startDate: "",
  endDate: "",
};

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-border/60 pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        {hint ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function FieldTextarea({
  id,
  label,
  value,
  onChange,
  disabled,
  rows = 3,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        className={cn(
          "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
    </div>
  );
}

export function ProjectCharterPanel({
  projectId,
  canEdit = false,
  canApprove = false,
}: ProjectCharterPanelProps) {
  const { data, isLoading, isError, error, refetch } =
    useGetProjectCharterQuery(projectId);
  const [updateCharter, { isLoading: saving }] =
    useUpdateProjectCharterMutation();
  const [approveCharter, { isLoading: approving }] =
    useApproveProjectCharterMutation();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [signatureName, setSignatureName] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      purpose: data.purpose ?? "",
      successCriteria: data.successCriteria ?? "",
      scopeSummary: data.scopeSummary ?? "",
      scopeExclusions: data.scopeExclusions ?? "",
      keyDeliverables: data.keyDeliverables ?? "",
      highLevelRisks: data.highLevelRisks ?? "",
      milestoneSchedule: data.milestoneSchedule ?? "",
      valueSnapshot: data.valueSnapshot ?? "",
      resourceEstimates: data.resourceEstimates ?? "",
      stakeholders: data.stakeholders ?? "",
      pmAuthority: data.pmAuthority ?? "",
      startDate: data.startDate ?? "",
      endDate: data.endDate ?? "",
    });
  }, [data]);

  const isDraft = data?.status === "Draft";
  const editable = canEdit && isDraft;
  const notFound =
    isError &&
    error &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status?: number }).status === 404;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSave() {
    try {
      const value =
        form.valueSnapshot.trim() === ""
          ? null
          : Number(form.valueSnapshot.replace(/,/g, ""));
      if (form.valueSnapshot.trim() !== "" && !Number.isFinite(value)) {
        toast.error("Value must be a number");
        return;
      }
      await updateCharter({
        projectId,
        body: {
          purpose: form.purpose.trim() || null,
          successCriteria: form.successCriteria.trim() || null,
          scopeSummary: form.scopeSummary.trim() || null,
          scopeExclusions: form.scopeExclusions.trim() || null,
          keyDeliverables: form.keyDeliverables.trim() || null,
          highLevelRisks: form.highLevelRisks.trim() || null,
          milestoneSchedule: form.milestoneSchedule.trim() || null,
          valueSnapshot: value,
          resourceEstimates: form.resourceEstimates.trim() || null,
          stakeholders: form.stakeholders.trim() || null,
          pmAuthority: form.pmAuthority.trim() || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        },
      }).unwrap();
      toast.success("Charter saved");
    } catch (err) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String(
              (err as { data?: { message?: string } }).data?.message ??
                "Failed to save charter",
            )
          : "Failed to save charter";
      toast.error(message);
    }
  }

  async function onExportPdf() {
    setExporting(true);
    try {
      await downloadCharterPdf(projectId);
      toast.success("Charter PDF downloaded");
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  }

  async function onApprove() {
    const name = signatureName.trim();
    if (name.length < 2) {
      toast.error("Type your full name to sign");
      return;
    }
    try {
      await approveCharter({
        projectId,
        body: { signatureName: name },
      }).unwrap();
      toast.success("Charter approved");
      setSignatureName("");
    } catch (err) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String(
              (err as { data?: { message?: string } }).data?.message ??
                "Failed to approve charter",
            )
          : "Failed to approve charter";
      toast.error(message);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-medium text-foreground">No charter yet</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Charters are created when a Zoho CRM Closed Won deal is synced. Empty
          sections are filled by PMO after CRM data is loaded.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-destructive">Failed to load charter.</p>
      </div>
    );
  }

  const incomplete = data.incompleteFields ?? [];

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-bold">Project charter</h2>
            <p className="text-xs text-muted-foreground">
              Formal authorization document. CRM data is prefilled where
              available; PMO completes the rest before sign-off.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                isDraft
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-emerald-300 bg-emerald-50 text-emerald-800"
              }
            >
              {data.status}
            </Badge>
            {data.sourceOrderId ? (
              <Badge variant="outline" className="text-[10px] font-semibold">
                From Zoho
              </Badge>
            ) : null}
          </div>
        </div>

        {incomplete.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Incomplete — fill before approve
            </p>
            <div className="flex flex-wrap gap-1.5">
              {incomplete.map((field) => (
                <span
                  key={field}
                  className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-0 rounded-xl border border-border bg-card p-4 sm:p-6">
        <Section
          title="1. Purpose & objectives"
          hint="Why the project exists and what it aims to achieve."
        >
          <FieldTextarea
            id="charter-purpose"
            label="Purpose / objectives"
            value={form.purpose}
            onChange={(v) => setField("purpose", v)}
            disabled={!editable}
            rows={4}
          />
        </Section>

        <Section
          title="2. Measurable success criteria"
          hint="How success will be judged."
        >
          <FieldTextarea
            id="charter-success"
            label="Success criteria"
            value={form.successCriteria}
            onChange={(v) => setField("successCriteria", v)}
            disabled={!editable}
          />
        </Section>

        <Section
          title="3. Scope"
          hint="What is included and explicitly excluded."
        >
          <FieldTextarea
            id="charter-scope"
            label="Scope (in)"
            value={form.scopeSummary}
            onChange={(v) => setField("scopeSummary", v)}
            disabled={!editable}
            rows={4}
          />
          <FieldTextarea
            id="charter-exclusions"
            label="Scope exclusions (out)"
            value={form.scopeExclusions}
            onChange={(v) => setField("scopeExclusions", v)}
            disabled={!editable}
          />
        </Section>

        <Section title="4. Key deliverables">
          <FieldTextarea
            id="charter-deliverables"
            label="Deliverables"
            value={form.keyDeliverables}
            onChange={(v) => setField("keyDeliverables", v)}
            disabled={!editable}
            placeholder="One deliverable per line"
          />
        </Section>

        <Section title="5. High-level risks">
          <FieldTextarea
            id="charter-risks"
            label="Risks"
            value={form.highLevelRisks}
            onChange={(v) => setField("highLevelRisks", v)}
            disabled={!editable}
          />
        </Section>

        <Section
          title="6. Milestone schedule"
          hint="Major phases or target dates."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="charter-start">Start date</Label>
              <Input
                id="charter-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setField("startDate", e.target.value)}
                disabled={!editable}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charter-end">End date</Label>
              <Input
                id="charter-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setField("endDate", e.target.value)}
                disabled={!editable}
              />
            </div>
          </div>
          <FieldTextarea
            id="charter-milestones"
            label="Milestone schedule"
            value={form.milestoneSchedule}
            onChange={(v) => setField("milestoneSchedule", v)}
            disabled={!editable}
            placeholder="e.g. Kickoff — date&#10;UAT — date"
          />
        </Section>

        <Section title="7. Budget & resources">
          <div className="space-y-2">
            <Label htmlFor="charter-value">Budget / value</Label>
            <Input
              id="charter-value"
              value={form.valueSnapshot}
              onChange={(e) => setField("valueSnapshot", e.target.value)}
              disabled={!editable}
              inputMode="decimal"
              placeholder="0.00"
            />
          </div>
          <FieldTextarea
            id="charter-resources"
            label="Resource estimates"
            value={form.resourceEstimates}
            onChange={(v) => setField("resourceEstimates", v)}
            disabled={!editable}
          />
        </Section>

        <Section title="8. Stakeholders & roles">
          <FieldTextarea
            id="charter-stakeholders"
            label="Stakeholders"
            value={form.stakeholders}
            onChange={(v) => setField("stakeholders", v)}
            disabled={!editable}
          />
        </Section>

        <Section
          title="9. Project manager authority"
          hint="What decisions the PM is authorized to make."
        >
          <FieldTextarea
            id="charter-authority"
            label="PM authority"
            value={form.pmAuthority}
            onChange={(v) => setField("pmAuthority", v)}
            disabled={!editable}
          />
        </Section>

        <Section title="10. Approval & sign-off">
          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="font-medium">Version</dt>
              <dd className="text-foreground">{data.version}</dd>
            </div>
            {data.approverSignatureName ? (
              <div>
                <dt className="font-medium">Signed as</dt>
                <dd className="text-foreground">{data.approverSignatureName}</dd>
              </div>
            ) : null}
            {data.approvedAt ? (
              <div>
                <dt className="font-medium">Approved at</dt>
                <dd className="text-foreground">
                  {new Date(data.approvedAt).toLocaleString()}
                </dd>
              </div>
            ) : null}
          </dl>

          {canApprove && isDraft ? (
            <div className="space-y-2 border-t border-border pt-3">
              <Label htmlFor="charter-signature">
                Type your full name to sign
              </Label>
              <Input
                id="charter-signature"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Full legal name"
                disabled={approving}
              />
              <p className="text-[11px] text-muted-foreground">
                Approving signs the charter. Project stays Draft until activated
                separately.
              </p>
            </div>
          ) : null}
        </Section>
        </div>

        <div className="flex flex-wrap gap-2 pb-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onExportPdf}
            disabled={exporting || saving || approving}
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export PDF
          </Button>
          {editable ? (
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={saving || approving || exporting}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
            </Button>
          ) : null}
          {canApprove && isDraft ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onApprove}
              disabled={saving || approving || exporting}
            >
              {approving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Approve & sign
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
