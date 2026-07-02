"use client";

import React, { useState, useRef, useMemo } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "react-hot-toast";
import {
  useGetPhasesQuery,
  useGetProjectTaskAssigneesQuery,
} from "../../api/projects.api";
import { useCreateTaskMutation } from "../../api/tasks.api";
import { ProjectPhase, ProjectTaskAssignee } from "../../types/projects.types";
import {
  parseXLSXSheet,
  processRawTaskCSVRows,
  detectTaskCsvImportKind,
  revalidateParsedTaskRow,
  generateTasksXLSXTemplate,
  ParsedTaskRow,
} from "../../utils/import-export";
import { Button } from "@/shared/ui/button";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  PlayCircle,
  Download,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface ImportTasksDialogProps {
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  projectId: string;
}

const STATUS_CONFIG: Record<string, {
  label: string; dot: string; text: string; bg: string; border: string;
}> = {
  To_Do: {
    label: "To Do",
    dot: "border-2 border-slate-400 dark:border-white/30 bg-transparent",
    text: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-900/20",
    border: "border-slate-200 dark:border-slate-800",
  },
  In_Progress: {
    label: "In Progress",
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
  },
  Submitted_for_Review: {
    label: "Submitted for Review",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
  },
  Approved: {
    label: "Approved",
    dot: "bg-teal-500",
    text: "text-teal-700 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-900/20",
    border: "border-teal-200 dark:border-teal-800",
  },
  Rework: {
    label: "Rework",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
  },
  Done: {
    label: "Done",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  Critical: { label: "Critical", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400" },
  High: { label: "High", bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400" },
  Medium: { label: "Medium", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400" },
  Low: { label: "Low", bg: "bg-slate-50 dark:bg-slate-900/20", text: "text-slate-600 dark:text-slate-400" },
};

const isPriorityValid = (val: string) => ["Low", "Medium", "High", "Critical"].includes(val);
const isStatusValid = (val: string) => ["To_Do", "In_Progress", "Submitted_for_Review", "Approved", "Rework", "Done"].includes(val);

const PRIORITY_OPTIONS = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" },
];

const STATUS_OPTIONS = [
  { value: "To_Do", label: "To Do" },
  { value: "In_Progress", label: "In Progress" },
  { value: "Submitted_for_Review", label: "Submitted for Review" },
  { value: "Approved", label: "Approved" },
  { value: "Rework", label: "Rework" },
  { value: "Done", label: "Done" },
];

interface EnumSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

function EnumSelect({ value, options, onChange, placeholder = "Select...", className }: EnumSelectProps) {
  const isValInOpts = options.some((o) => o.value === value);
  return (
    <div className={cn("relative inline-flex items-center w-fit bg-transparent", className)}>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border-0 outline-none ring-0 appearance-none pr-4 text-xs font-semibold cursor-pointer text-foreground focus:ring-0 focus:outline-none"
      >
        {(!value || !isValInOpts) && (
          <option value={value || ""} disabled className="bg-background text-rose-500 font-bold">
            {value || placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-background text-foreground font-semibold">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
    </div>
  );
}

export function ImportTasksDialog({ open, onClose, refetch, projectId }: ImportTasksDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedTaskRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch metadata lists for mapping
  const { data: phases = [] } = useGetPhasesQuery(projectId);
  const { data: assignees = [] } = useGetProjectTaskAssigneesQuery(projectId, { skip: !projectId });

  const [createTask] = useCreateTaskMutation();

  const downloadSampleXLSX = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const buffer = generateTasksXLSXTemplate(assignees, phases);
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "tasks_import_template.xlsx");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Sample XLSX template downloaded.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate sample tasks XLSX.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".xlsx")) {
      toast.error("Please upload a valid Excel (.xlsx) file.");
      return;
    }
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const taskData = parseXLSXSheet(buffer, "Tasks");
        if (taskData.length <= 1) {
          toast.error("The XLSX file is empty or only contains headers.");
          return;
        }

        const importKind = detectTaskCsvImportKind(taskData);
        if (importKind === "projects") {
          toast.error(
            "This file looks like a Projects export. Use Import Projects on the Projects page, or download the Tasks sample XLSX.",
          );
          return;
        }

        const processed = processRawTaskCSVRows(taskData, phases, assignees);
        setParsedRows(processed);
        toast.success(`Loaded ${processed.length} rows from XLSX`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse XLSX file.");
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setImportProgress(0);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (isImporting) return;
    handleReset();
    onClose();
  };

  const handleInlineChange = (index: number, field: keyof ParsedTaskRow, value: any) => {
    setParsedRows((prev) => {
      const duplicateTitles = new Set(
        prev
          .map((row) => row.title.trim().toLowerCase())
          .filter((title, titleIndex, all) => title && all.indexOf(title) !== titleIndex),
      );

      return prev.map((row, idx) => {
        if (idx !== index) return row;
        const updated = { ...row, [field]: value };
        return revalidateParsedTaskRow(updated, phases, assignees, duplicateTitles);
      });
    });
  };

  const validRows = useMemo(
    () => parsedRows.filter((r) => r.errors.length === 0),
    [parsedRows]
  );
  const hasErrors = useMemo(() => parsedRows.some((r) => r.errors.length > 0), [parsedRows]);

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast.error("No valid rows to import.");
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        await createTask({
          projectId,
          title: row.title,
          description: row.description || null,
          priority: row.priority,
          status: row.status,
          ownerId: row.resolvedAssigneeId || null,
          phaseId: row.resolvedPhaseId || null,
          startDate: row.startDate ? new Date(row.startDate).toISOString() : null,
          endDate: row.endDate ? new Date(row.endDate).toISOString() : null,
          effortHours: row.effortHours || null,
        }).unwrap();
        successCount++;
      } catch (err) {
        console.error(`Failed to import task: ${row.title}`, err);
        failCount++;
      }
      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} tasks.`);
      refetch();
    }
    if (failCount > 0) {
      toast.error(`Failed to import ${failCount} tasks.`);
    }

    setIsImporting(false);
    handleClose();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="size-5 text-primary" />
              <DialogPrimitive.Title className="text-sm font-bold text-foreground">
                Import Tasks
              </DialogPrimitive.Title>
            </div>
            <div className="flex items-center gap-2">
              {!isImporting && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={downloadSampleXLSX}
                  className="h-8 gap-1 rounded-lg text-[11px] font-bold cursor-pointer border-primary/20 text-primary hover:bg-primary/5"
                >
                  <Download className="size-3.5" />
                  Download Sample XLSX
                </Button>
              )}
              {!isImporting && (
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          {/* Main Body */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col">
            {!file ? (
              /* File Upload Area */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-h-[250px] border-2 border-dashed border-border/80 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/10 transition-all gap-3 p-6"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx"
                  className="hidden"
                />
                <div className="size-12 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-center text-primary">
                  <Upload className="size-6" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-foreground">Click to select or drag XLSX file</p>
                  <p className="text-xs text-muted-foreground">Supported format: Excel workbook only (.xlsx)</p>
                </div>
                <div className="mt-4 p-3 bg-muted/40 border border-border/50 rounded-xl max-w-md text-[10px] text-muted-foreground space-y-1 font-medium leading-relaxed">
                  <p className="font-bold text-foreground mb-1 uppercase tracking-wider">Required Column Headers:</p>
                  <p>• Title</p>
                  <p>• Description, Priority, Status, Assignee, Phase, Start Date, End Date, Effort Hours</p>
                </div>
              </div>
            ) : (
              /* Preview Area */
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center justify-between bg-muted/30 border border-border/40 p-3 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="size-4 text-primary" />
                    <div>
                      <p className="text-xs font-bold text-foreground truncate max-w-[200px] sm:max-w-md">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium">
                        {(file.size / 1024).toFixed(1)} KB · {parsedRows.length} rows loaded
                      </p>
                    </div>
                  </div>
                  {!isImporting && (
                    <Button variant="outline" size="xs" onClick={handleReset}>
                      Change File
                    </Button>
                  )}
                </div>

                {isImporting ? (
                  /* Loading Progress UI */
                  <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4">
                    <Loader2 className="size-8 text-primary animate-spin" />
                    <div className="text-center space-y-1">
                      <p className="text-sm font-bold">Importing tasks...</p>
                      <p className="text-xs text-muted-foreground">
                        Please do not close this dialog.
                      </p>
                    </div>
                    <div className="w-full max-w-xs bg-muted h-2 rounded-full overflow-hidden border border-border/40 mt-2">
                      <div
                        className="bg-primary h-full transition-all duration-300"
                        style={{ width: `${importProgress}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-primary">{importProgress}%</span>
                  </div>
                ) : (
                  <>
                  {/* Task Preview Table */}
                  <div className="border border-border rounded-xl flex flex-col bg-card">
                    <div className="w-full overflow-x-auto overflow-y-auto max-h-[50vh]">
                      <div className="min-w-[1600px]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase tracking-wider text-[10px] sticky top-0 z-10">
                              <th className="p-3 w-64">Validation</th>
                              <th className="p-3 w-60">Task Title & Description</th>
                              <th className="p-3 w-40">Priority</th>
                              <th className="p-3 w-40">Status</th>
                              <th className="p-3 w-48">Assignee</th>
                              <th className="p-3 w-48">Phase</th>
                              <th className="p-3 w-44">Timeline (Start / End)</th>
                              <th className="p-3 w-32">Effort Hours</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {parsedRows.map((row, idx) => {
                              const hasRowErrors = row.errors.length > 0;
                              const hasRowWarnings = row.warnings.length > 0;

                              return (
                                <tr
                                  key={idx}
                                  className={cn(
                                    "hover:bg-muted/10 transition-colors",
                                    hasRowErrors ? "bg-rose-50/20 dark:bg-rose-950/5" : "",
                                    row.isSummary ? "opacity-70 bg-slate-500/5" : ""
                                  )}
                                >
                                  {/* Validation Column */}
                                  <td className="p-3">
                                    <div className="flex items-start gap-2">
                                      {hasRowErrors ? (
                                        <XCircle className="size-4 text-rose-500 shrink-0 mt-0.5" />
                                      ) : hasRowWarnings ? (
                                        <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                                      ) : (
                                        <CheckCircle className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                                      )}
                                      <div className="space-y-1">
                                        {row.errors.map((err, i) => (
                                          <p key={i} className="text-[10px] text-rose-600 dark:text-rose-400 font-bold leading-snug">
                                            {err}
                                          </p>
                                        ))}
                                        {row.warnings.map((warn, i) => (
                                          <p key={i} className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold leading-snug">
                                            {warn}
                                          </p>
                                        ))}
                                        {row.errors.length === 0 && row.warnings.length === 0 && (
                                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                            Ready
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Title & Description */}
                                  <td className="p-3">
                                    <div className="flex flex-col gap-1 w-56">
                                      <div className="font-bold text-foreground truncate flex items-center gap-1.5">
                                        {row.isSummary && (
                                          <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[8px] font-extrabold px-1 rounded uppercase tracking-wider shrink-0">
                                            Summary
                                          </span>
                                        )}
                                        {row.isMilestone && (
                                          <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[8px] font-extrabold px-1 rounded uppercase tracking-wider shrink-0">
                                            Milestone
                                          </span>
                                        )}
                                        <span className="truncate">{row.title || <span className="italic text-rose-400">Missing Title</span>}</span>
                                      </div>
                                      <div className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                                        {row.description || "No description"}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Priority */}
                                  <td className="p-3">
                                    {isPriorityValid(row.priority) ? (
                                      (() => {
                                        const priorityCfg = PRIORITY_CONFIG[row.priority] || { label: row.priority || "Medium", bg: "bg-slate-50 dark:bg-slate-900/20", text: "text-slate-600 dark:text-slate-400" };
                                        return (
                                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border border-current/10 w-fit", priorityCfg.bg, priorityCfg.text)}>
                                            {priorityCfg.label}
                                          </span>
                                        );
                                      })()
                                    ) : (
                                      <EnumSelect
                                        value={row.priority}
                                        options={PRIORITY_OPTIONS}
                                        onChange={(val) => handleInlineChange(idx, "priority", val)}
                                        placeholder="Select Priority"
                                      />
                                    )}
                                  </td>

                                  {/* Status */}
                                  <td className="p-3">
                                    {isStatusValid(row.status) ? (
                                      (() => {
                                        const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.To_Do;
                                        return (
                                          <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0", statusCfg.bg, statusCfg.text, statusCfg.border)}>
                                            <span className={cn("size-1.5 rounded-full", statusCfg.dot)} />
                                            {statusCfg.label}
                                          </span>
                                        );
                                      })()
                                    ) : (
                                      <EnumSelect
                                        value={row.status}
                                        options={STATUS_OPTIONS}
                                        onChange={(val) => handleInlineChange(idx, "status", val)}
                                        placeholder="Select Status"
                                      />
                                    )}
                                  </td>

                                  {/* Assignee */}
                                  <td className="p-3">
                                    <select
                                      value={row.resolvedAssigneeId || ""}
                                      onChange={(e) => handleInlineChange(idx, "resolvedAssigneeId", e.target.value || null)}
                                      className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
                                      disabled={row.isSummary}
                                    >
                                      {!row.resolvedAssigneeId && row.assigneeName && (
                                        <option value="" disabled className="text-rose-500 font-bold">
                                          {row.assigneeName}
                                        </option>
                                      )}
                                      <option value="">None (Unassigned)</option>
                                      {assignees.map((assignee: ProjectTaskAssignee) => (
                                        <option key={assignee.userId} value={assignee.userId}>
                                          {assignee.displayName}
                                        </option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* Phase */}
                                  <td className="p-3">
                                    {phases.length === 0 ? (
                                      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                        Create project phases first
                                      </span>
                                    ) : (
                                      <select
                                        value={row.resolvedPhaseId || ""}
                                        onChange={(e) =>
                                          handleInlineChange(idx, "resolvedPhaseId", e.target.value || null)
                                        }
                                        className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
                                        disabled={row.isSummary}
                                      >
                                        <option value="">No phase</option>
                                        {!row.resolvedPhaseId && row.phaseName && (
                                          <option value="" disabled className="text-rose-500 font-bold">
                                            {row.phaseName}
                                          </option>
                                        )}
                                        {phases.map((p: ProjectPhase) => (
                                          <option key={p.id} value={p.id}>
                                            {p.name}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </td>

                                  {/* Timeline Dates */}
                                  <td className="p-3">
                                    <div className="text-xs text-foreground font-medium space-y-0.5 w-36">
                                      <div>{row.startDate ? row.startDate.slice(0, 10) : "—"}</div>
                                      <div className="text-muted-foreground/60">→ {row.endDate ? row.endDate.slice(0, 10) : "—"}</div>
                                    </div>
                                  </td>

                                  {/* Effort Hours */}
                                  <td className="p-3">
                                    <div className="text-xs font-semibold text-foreground">
                                      {row.effortHours != null ? `${row.effortHours} hrs` : "—"}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-muted/15">
            <div className="text-xs text-muted-foreground font-semibold">
              {file && !isImporting && (
                <span>
                  {`${validRows.length} of ${parsedRows.length} tasks ready to import.`}
                  {hasErrors && (
                    <span className="text-rose-500 ml-1">
                      ({parsedRows.filter(r => r.errors.length > 0).length} tasks contain errors)
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isImporting}
                className="font-bold h-9 text-xs rounded-xl"
              >
                Cancel
              </Button>
              {file && !isImporting && (
                <Button
                  onClick={handleImport}
                  disabled={validRows.length === 0}
                  size="sm"
                  className="font-bold h-9 text-xs rounded-xl gap-1.5"
                >
                  <PlayCircle className="size-4" />
                  Import Tasks
                </Button>
              )}
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
