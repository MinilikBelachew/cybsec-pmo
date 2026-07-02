"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "react-hot-toast";
import {
  CheckCircle2,
  FileUp,
  GitBranch,
  Layers,
  Loader2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { Button } from "@/shared/ui/button";
import {
  useGetCustomersQuery,
  useGetDepartmentsQuery,
  useGetProjectManagersQuery,
  useCreateProjectMutation,
} from "../../api/projects.api";
import type { CreateProjectDto } from "../../types/projects.types";
import {
  useImportMppMutation,
  usePreviewMppImportMutation,
} from "../../api/mpp-import.api";
import type { MppImportPreview } from "../../types/mpp-import.types";

const ACCEPTED_EXTENSIONS = [".mpp", ".mpx", ".xml"];

const ENGAGEMENT_OPTIONS = [
  { value: "ManagedServices", label: "Managed Services" },
  { value: "StaffAugmentation", label: "Staff Augmentation" },
  { value: "FixedPrice", label: "Fixed Price" },
];
const BILLING_OPTIONS = [
  { value: "TimeAndMaterial", label: "Time & Material" },
  { value: "FixedPrice", label: "Fixed Price" },
  { value: "Retainer", label: "Retainer" },
];
const PRIORITY_OPTIONS = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" },
];
const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "AED", label: "AED" },
  { value: "SAR", label: "SAR" },
];

type ImportMppDialogProps = {
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
  /** When set, tasks are imported into this existing project (task-level). When absent, a NEW project is created (project-level). */
  projectId?: string;
};

type Step = "select" | "preview" | "done";

type ProjectForm = {
  name: string;
  objective: string;
  departmentId: string;
  customerId: string;
  primaryPmId: string;
  engagementType: string;
  billingModel: string;
  priority: string;
  currency: string;
  value: string;
};

const EMPTY_FORM: ProjectForm = {
  name: "",
  objective: "",
  departmentId: "",
  customerId: "",
  primaryPmId: "",
  engagementType: "ManagedServices",
  billingModel: "TimeAndMaterial",
  priority: "Medium",
  currency: "USD",
  value: "0",
};

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function toIso(value: string | undefined, fallback: Date): string {
  if (value) {
    const parsed = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return fallback.toISOString();
}

function extractError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    return typeof data === "string" ? data : fallback;
  }
  return fallback;
}

export function ImportMppDialog({
  open,
  onClose,
  onCompleted,
  projectId,
}: ImportMppDialogProps) {
  const isNewProject = !projectId;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("select");
  const [preview, setPreview] = useState<MppImportPreview | null>(null);
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [result, setResult] = useState<{
    tasksCreated: number;
    dependenciesCreated: number;
    projectCreated: boolean;
  } | null>(null);

  const [previewMpp, { isLoading: isPreviewing }] = usePreviewMppImportMutation();
  const [importMpp, { isLoading: isImporting }] = useImportMppMutation();
  const [createProject, { isLoading: isCreatingProject }] = useCreateProjectMutation();

  // Metadata only needed when creating a new project.
  const { data: departments = [] } = useGetDepartmentsQuery(undefined, { skip: !isNewProject });
  const { data: customers = [] } = useGetCustomersQuery(undefined, { skip: !isNewProject });
  const { data: managers = [] } = useGetProjectManagersQuery(undefined, { skip: !isNewProject });

  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setStep("select");
      setPreview(null);
      setForm(EMPTY_FORM);
      setResult(null);
    }
  }, [open]);

  const isSaving = isImporting || isCreatingProject;
  const isBusy = isPreviewing || isSaving;

  const previewTitle = useMemo(() => {
    if (preview?.projectName) return preview.projectName;
    return selectedFile?.name?.replace(/\.[^.]+$/, "") ?? "Imported schedule";
  }, [preview?.projectName, selectedFile?.name]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
    setPreview(null);
    setStep("select");
  };

  const validateFile = (): File | null => {
    if (!selectedFile) {
      toast.error("Choose an MPP file first");
      return null;
    }
    const extension = selectedFile.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "";
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      toast.error("Use a .mpp, .mpx, or MSPDI .xml file");
      return null;
    }
    return selectedFile;
  };

  const handlePreview = async () => {
    const file = validateFile();
    if (!file) return;

    try {
      const data = await previewMpp({ projectId, file }).unwrap();
      setPreview(data);
      if (isNewProject) {
        setForm((prev) => ({
          ...prev,
          name: (data.projectName || file.name.replace(/\.[^.]+$/, "")).slice(0, 255),
          objective: prev.objective || `Imported from ${file.name}`,
          departmentId: prev.departmentId || departments[0]?.id || "",
          customerId: prev.customerId || customers[0]?.id || "",
          primaryPmId: prev.primaryPmId || managers[0]?.id || "",
        }));
      }
      setStep("preview");
    } catch (error) {
      toast.error(extractError(error, "Failed to read MPP file"));
    }
  };

  const handleConfirm = async () => {
    const file = selectedFile;
    if (!file) return;

    try {
      let targetProjectId = projectId;

      if (isNewProject) {
        if (!form.name.trim()) return toast.error("Project name is required");
        if (!form.objective.trim()) return toast.error("Objective is required");
        if (!form.departmentId) return toast.error("Select a department");
        if (!form.customerId) return toast.error("Select a customer");
        if (!form.primaryPmId) return toast.error("Select a primary PM");

        const start = new Date(toIso(preview?.startDate, new Date()));
        const fallbackEnd = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
        let end = new Date(toIso(preview?.finishDate, fallbackEnd));
        if (end.getTime() < start.getTime()) end = fallbackEnd;

        const payload: CreateProjectDto = {
          name: form.name.trim(),
          objective: form.objective.trim(),
          departmentId: form.departmentId,
          customerId: form.customerId,
          engagementType: form.engagementType as CreateProjectDto["engagementType"],
          billingModel: form.billingModel as CreateProjectDto["billingModel"],
          priority: form.priority as CreateProjectDto["priority"],
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          value: Number(form.value) || 0,
          currency: form.currency as CreateProjectDto["currency"],
          primaryPmId: form.primaryPmId,
        };

        const created = await createProject(payload).unwrap();
        targetProjectId = created.id;
      }

      if (!targetProjectId) return;

      const summary = await importMpp({ projectId: targetProjectId, file }).unwrap();
      setResult({
        tasksCreated: summary.tasksCreated,
        dependenciesCreated: summary.dependenciesCreated,
        projectCreated: isNewProject,
      });
      setStep("done");
      toast.success(
        isNewProject
          ? `Created project with ${summary.tasksCreated} tasks`
          : `Imported ${summary.tasksCreated} tasks and ${summary.dependenciesCreated} dependencies`,
      );
      onCompleted?.();
    } catch (error) {
      toast.error(extractError(error, "Failed to import MPP file"));
    }
  };

  const setField = (field: keyof ProjectForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleBack = () => {
    if (isBusy) return;
    setStep("select");
  };

  const handleClose = () => {
    if (isBusy) return;
    onClose();
  };

  const confirmLabel = isNewProject
    ? `Create project & import ${preview?.counts.importableTasks ?? 0} tasks`
    : `Confirm & save ${preview?.counts.importableTasks ?? 0} tasks`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border/60 bg-popover p-6 shadow-xl",
            "transition duration-200 data-ending-style:scale-95 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogPrimitive.Title className="text-base font-bold text-foreground">
                {isNewProject ? "Import MPP as new project" : "Import MPP into project"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {step === "preview"
                  ? isNewProject
                    ? "Review the parsed schedule and project details, then create it."
                    : "Review the parsed schedule, then save it into the project."
                  : "Upload a Microsoft Project file to preview before importing."}
              </DialogPrimitive.Description>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isBusy}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {step === "select" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  MS Project file
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mpp,.mpx,.xml"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isBusy}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-border/70 bg-muted/30 px-4 py-4 text-left transition hover:bg-muted/50",
                    isBusy && "opacity-60",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {selectedFile ? selectedFile.name : "Choose .mpp, .mpx, or .xml"}
                    </p>
                    <p className="text-xs text-muted-foreground">Max 50 MB</p>
                  </div>
                  <Upload className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </div>
            )}

            {step === "preview" && preview && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-foreground">{previewTitle}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(preview.startDate)} – {formatDate(preview.finishDate)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard icon={<Layers className="size-4" />} label="Tasks" value={preview.counts.importableTasks} />
                  <StatCard icon={<GitBranch className="size-4" />} label="Dependencies" value={preview.counts.dependencies} />
                  <StatCard icon={<Users className="size-4" />} label="Resources matched" value={preview.counts.resourcesMatched} />
                  <StatCard icon={<Layers className="size-4" />} label="Summary rows skipped" value={preview.counts.skippedSummaryTasks} />
                </div>

                {isNewProject && (
                  <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      New project details
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Project name">
                        <input
                          value={form.name}
                          onChange={(e) => setField("name", e.target.value)}
                          className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                        />
                      </Field>
                      <Field label="Objective">
                        <input
                          value={form.objective}
                          onChange={(e) => setField("objective", e.target.value)}
                          className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                        />
                      </Field>
                      <Field label="Department">
                        <SelectField value={form.departmentId} onChange={(v) => setField("departmentId", v)} placeholder="Select department">
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </SelectField>
                      </Field>
                      <Field label="Customer">
                        <SelectField value={form.customerId} onChange={(v) => setField("customerId", v)} placeholder="Select customer">
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>{c.displayName}</option>
                          ))}
                        </SelectField>
                      </Field>
                      <Field label="Primary PM">
                        <SelectField value={form.primaryPmId} onChange={(v) => setField("primaryPmId", v)} placeholder="Select PM">
                          {managers.map((m) => (
                            <option key={m.id} value={m.id}>{m.displayName}</option>
                          ))}
                        </SelectField>
                      </Field>
                      <Field label="Engagement type">
                        <SelectField value={form.engagementType} onChange={(v) => setField("engagementType", v)}>
                          {ENGAGEMENT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </SelectField>
                      </Field>
                      <Field label="Billing model">
                        <SelectField value={form.billingModel} onChange={(v) => setField("billingModel", v)}>
                          {BILLING_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </SelectField>
                      </Field>
                      <Field label="Priority">
                        <SelectField value={form.priority} onChange={(v) => setField("priority", v)}>
                          {PRIORITY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </SelectField>
                      </Field>
                      <Field label="Currency">
                        <SelectField value={form.currency} onChange={(v) => setField("currency", v)}>
                          {CURRENCY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </SelectField>
                      </Field>
                      <Field label="Value">
                        <input
                          type="number"
                          min={0}
                          value={form.value}
                          onChange={(e) => setField("value", e.target.value)}
                          className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    <p className="mb-1 font-semibold">Notes</p>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {preview.warnings.slice(0, 6).map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                      {preview.warnings.length > 6 && <li>+{preview.warnings.length - 6} more…</li>}
                    </ul>
                  </div>
                )}

                <div className="overflow-hidden rounded-xl border border-border/60">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Task</th>
                        <th className="px-3 py-2 font-semibold">Start</th>
                        <th className="px-3 py-2 font-semibold">Finish</th>
                        <th className="px-3 py-2 text-right font-semibold">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {preview.tasks.map((task) => (
                        <tr key={task.uid} className="align-top">
                          <td className="px-3 py-2">
                            <span className={cn("block max-w-[280px] truncate text-foreground", task.hasParent && "pl-3")}>
                              {task.hasParent && <span className="text-muted-foreground">↳ </span>}
                              {task.name}
                            </span>
                            {task.predecessorCount > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {task.predecessorCount} dependency
                                {task.predecessorCount > 1 ? "s" : ""}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(task.startDate)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(task.finishDate)}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">{task.percentComplete ?? 0}%</td>
                        </tr>
                      ))}
                      {preview.tasks.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                            No importable tasks found in this file.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {step === "done" && result && (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <CheckCircle2 className="size-8 text-emerald-500" />
                <p className="text-sm font-semibold text-foreground">
                  {result.projectCreated ? "Project created" : "Import complete"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {result.tasksCreated} tasks and {result.dependenciesCreated} dependencies added.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            {step === "preview" ? (
              <>
                <Button type="button" variant="outline" onClick={handleBack} disabled={isBusy}>
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isBusy || preview?.counts.importableTasks === 0}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <FileUp className="size-4" />
                      {confirmLabel}
                    </>
                  )}
                </Button>
              </>
            ) : step === "done" ? (
              <Button type="button" onClick={handleClose}>
                Close
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleClose} disabled={isBusy}>
                  Cancel
                </Button>
                <Button type="button" onClick={handlePreview} disabled={isBusy}>
                  {isPreviewing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Reading…
                    </>
                  ) : (
                    "Preview"
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SelectField({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}
