"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Loader2,
  Paperclip,
  Plus,
  Save,
  Upload,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Spinner } from "@/shared/components/spinner";
import { cn } from "@/shared/utils/cn";
import { useUploadFileMutation } from "../../api/files.api";
import {
  downloadSowPdf,
  useApproveProjectSowMutation,
  useCreateProjectSowMutation,
  useGetProjectSowQuery,
  useUpdateProjectSowMutation,
} from "../../api/sows.api";

type ProjectSowPanelProps = {
  projectId: string;
  canEdit?: boolean;
  canApprove?: boolean;
};

type FormState = {
  customerName: string;
  scope: string;
  deliverables: string;
  exclusions: string;
  assumptions: string;
  value: string;
  currency: string;
  startDate: string;
  endDate: string;
  billingModel: string;
  engagementType: string;
};

const EMPTY_FORM: FormState = {
  customerName: "",
  scope: "",
  deliverables: "",
  exclusions: "",
  assumptions: "",
  value: "",
  currency: "",
  startDate: "",
  endDate: "",
  billingModel: "",
  engagementType: "",
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

export function ProjectSowPanel({
  projectId,
  canEdit = false,
  canApprove = false,
}: ProjectSowPanelProps) {
  const { data, isLoading, isError, error, refetch } =
    useGetProjectSowQuery(projectId);
  const [createSow, { isLoading: creating }] = useCreateProjectSowMutation();
  const [updateSow, { isLoading: saving }] = useUpdateProjectSowMutation();
  const [approveSow, { isLoading: approving }] = useApproveProjectSowMutation();
  const [uploadFile, { isLoading: uploading }] = useUploadFileMutation();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [signatureName, setSignatureName] = useState("");
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    const s = data.snapshot;
    setForm({
      customerName: s.customerName ?? "",
      scope: s.scope ?? "",
      deliverables: s.deliverables ?? "",
      exclusions: s.exclusions ?? "",
      assumptions: s.assumptions ?? "",
      value: s.value ?? "",
      currency: s.currency ?? "",
      startDate: s.startDate ?? "",
      endDate: s.endDate ?? "",
      billingModel: s.billingModel ?? "",
      engagementType: s.engagementType ?? "",
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

  async function onCreate() {
    try {
      await createSow(projectId).unwrap();
      toast.success("SOW created");
    } catch (err) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String(
              (err as { data?: { message?: string } }).data?.message ??
                "Failed to create SOW",
            )
          : "Failed to create SOW";
      toast.error(message);
    }
  }

  async function onSave() {
    try {
      await updateSow({
        projectId,
        body: {
          customerName: form.customerName.trim() || null,
          scope: form.scope.trim() || null,
          deliverables: form.deliverables.trim() || null,
          exclusions: form.exclusions.trim() || null,
          assumptions: form.assumptions.trim() || null,
          value: form.value.trim() || null,
          currency: form.currency.trim() || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          billingModel: form.billingModel.trim() || null,
          engagementType: form.engagementType.trim() || null,
        },
      }).unwrap();
      toast.success("SOW saved");
    } catch (err) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String(
              (err as { data?: { message?: string } }).data?.message ??
                "Failed to save SOW",
            )
          : "Failed to save SOW";
      toast.error(message);
    }
  }

  async function onUpload(file: File) {
    try {
      const uploaded = await uploadFile(file).unwrap();
      await updateSow({
        projectId,
        body: {
          s3FinalKey: uploaded.storageKey,
          documentLink: uploaded.storageKey,
        },
      }).unwrap();
      toast.success("SOW file attached");
    } catch (err) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String(
              (err as { data?: { message?: string } }).data?.message ??
                "Failed to upload file",
            )
          : "Failed to upload file";
      toast.error(message);
    }
  }

  async function onExportPdf() {
    setExporting(true);
    try {
      await downloadSowPdf(projectId);
      toast.success("SOW PDF downloaded");
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
      await approveSow({
        projectId,
        body: { signatureName: name },
      }).unwrap();
      toast.success("SOW approved — Zoho write-back started");
      setSignatureName("");
    } catch (err) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String(
              (err as { data?: { message?: string } }).data?.message ??
                "Failed to approve SOW",
            )
          : "Failed to approve SOW";
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
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-medium text-foreground">No SOW yet</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Create a Statement of Work for this engagement. It seeds from the
          project and charter; approve to attach the PDF to Zoho CRM Deal and
          Books Sales Order.
        </p>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            onClick={onCreate}
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Create SOW
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-destructive">Failed to load SOW.</p>
      </div>
    );
  }

  const signature =
    data.snapshot.approverSignatureName ?? null;

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-bold">Statement of Work</h2>
            <p className="text-xs text-muted-foreground">
              Commercial delivery document. Approve to push the PDF to the
              linked Zoho Deal and Sales Order.
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
            {data.crmWrittenBackAt ? (
              <Badge
                variant="outline"
                className="border-sky-300 bg-sky-50 text-[10px] font-semibold text-sky-900"
              >
                Synced to Zoho{" "}
                {new Date(data.crmWrittenBackAt).toLocaleDateString()}
              </Badge>
            ) : data.status === "Approved" ? (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold text-amber-800"
              >
                Zoho sync pending
              </Badge>
            ) : null}
            {data.opportunityId ? (
              <Badge variant="outline" className="text-[10px] font-semibold">
                CRM linked
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="space-y-0 rounded-xl border border-border bg-card p-4 sm:p-6">
          <Section title="1. Customer & commercial">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sow-customer">Customer</Label>
                <Input
                  id="sow-customer"
                  value={form.customerName}
                  onChange={(e) => setField("customerName", e.target.value)}
                  disabled={!editable}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sow-value">Value</Label>
                <Input
                  id="sow-value"
                  value={form.value}
                  onChange={(e) => setField("value", e.target.value)}
                  disabled={!editable}
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sow-currency">Currency</Label>
                <Input
                  id="sow-currency"
                  value={form.currency}
                  onChange={(e) => setField("currency", e.target.value)}
                  disabled={!editable}
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sow-engagement">Engagement type</Label>
                <Input
                  id="sow-engagement"
                  value={form.engagementType}
                  onChange={(e) => setField("engagementType", e.target.value)}
                  disabled={!editable}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sow-billing">Billing model</Label>
                <Input
                  id="sow-billing"
                  value={form.billingModel}
                  onChange={(e) => setField("billingModel", e.target.value)}
                  disabled={!editable}
                />
              </div>
            </div>
          </Section>

          <Section title="2. Timeline">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sow-start">Start date</Label>
                <Input
                  id="sow-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setField("startDate", e.target.value)}
                  disabled={!editable}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sow-end">End date</Label>
                <Input
                  id="sow-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setField("endDate", e.target.value)}
                  disabled={!editable}
                />
              </div>
            </div>
          </Section>

          <Section title="3. Scope & deliverables">
            <FieldTextarea
              id="sow-scope"
              label="Scope"
              value={form.scope}
              onChange={(v) => setField("scope", v)}
              disabled={!editable}
              rows={4}
            />
            <FieldTextarea
              id="sow-deliverables"
              label="Deliverables"
              value={form.deliverables}
              onChange={(v) => setField("deliverables", v)}
              disabled={!editable}
              placeholder="One deliverable per line"
            />
            <FieldTextarea
              id="sow-exclusions"
              label="Exclusions"
              value={form.exclusions}
              onChange={(v) => setField("exclusions", v)}
              disabled={!editable}
            />
            <FieldTextarea
              id="sow-assumptions"
              label="Assumptions"
              value={form.assumptions}
              onChange={(v) => setField("assumptions", v)}
              disabled={!editable}
            />
          </Section>

          <Section
            title="4. Final document"
            hint="Optional uploaded PDF is what Zoho receives on approve. Otherwise a PDF is generated from this form."
          >
            {data.s3FinalKey ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Paperclip className="size-3.5 shrink-0" />
                File attached ({data.s3FinalKey.split("/").pop()})
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No uploaded file — export/approve will use a generated PDF.
              </p>
            )}
            {editable ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void onUpload(file);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploading || saving}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  Upload PDF
                </Button>
              </div>
            ) : null}
          </Section>

          <Section title="5. Approval & Zoho write-back">
            <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div>
                <dt className="font-medium">Version</dt>
                <dd className="text-foreground">{data.version}</dd>
              </div>
              {signature ? (
                <div>
                  <dt className="font-medium">Signed as</dt>
                  <dd className="text-foreground">{signature}</dd>
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
              {data.crmWrittenBackAt ? (
                <div>
                  <dt className="font-medium">CRM write-back</dt>
                  <dd className="text-foreground">
                    {new Date(data.crmWrittenBackAt).toLocaleString()}
                  </dd>
                </div>
              ) : null}
            </dl>

            {canApprove && isDraft ? (
              <div className="space-y-2 border-t border-border pt-3">
                <Label htmlFor="sow-signature">
                  Type your full name to sign
                </Label>
                <Input
                  id="sow-signature"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Full legal name"
                  disabled={approving}
                />
                <p className="text-[11px] text-muted-foreground">
                  Approving signs the SOW and attaches the PDF to Zoho CRM Deal
                  and Books Sales Order when linked.
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
            disabled={exporting || saving || approving || uploading}
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
              disabled={saving || approving || exporting || uploading}
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
              disabled={saving || approving || exporting || uploading}
            >
              {approving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Approve &amp; sign
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
