"use client";

import React, { useState, useRef, useMemo } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "react-hot-toast";
import {
  useGetDepartmentsQuery,
  useGetCustomersQuery,
  useGetProjectManagersQuery,
  useCreateProjectMutation,
} from "../../api/projects.api";
import { Department, Customer, ProjectManager } from "../../types/projects.types";
import { parseCSV, processRawCSVRows, ParsedProjectRow } from "../../utils/import-export";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
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
import { ImportPreviewScrollArea } from "../shared/import-preview-scroll-area";

const STATUS_CONFIG: Record<string, {
  label: string; dot: string; text: string; bg: string; border: string
}> = {
  Active: { 
    label: "Active", 
    dot: "bg-emerald-500", 
    text: "text-emerald-700 dark:text-emerald-400", 
    bg: "bg-emerald-50 dark:bg-emerald-900/20", 
    border: "border-emerald-200 dark:border-emerald-800" 
  },
  OnHold: { 
    label: "On Hold", 
    dot: "bg-amber-400", 
    text: "text-amber-700 dark:text-amber-400", 
    bg: "bg-amber-50 dark:bg-amber-900/20", 
    border: "border-amber-200 dark:border-amber-800" 
  },
  PendingClosure: { 
    label: "At Risk", 
    dot: "bg-rose-500", 
    text: "text-rose-700 dark:text-rose-400", 
    bg: "bg-rose-50 dark:bg-rose-900/20", 
    border: "border-rose-200 dark:border-rose-800" 
  },
  Closed: { 
    label: "Completed", 
    dot: "bg-primary", 
    text: "text-primary", 
    bg: "bg-primary/10", 
    border: "border-primary/30" 
  },
  Draft: { 
    label: "Draft", 
    dot: "bg-muted-foreground", 
    text: "text-muted-foreground", 
    bg: "bg-muted/40", 
    border: "border-border" 
  },
  Planned: {
    label: "Planned",
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800"
  }
};

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  Critical: { label: "Critical", dot: "bg-red-500", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400" },
  High: { label: "High", dot: "bg-rose-500", bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400" },
  Medium: { label: "Medium", dot: "bg-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400" },
  Low: { label: "Low", dot: "bg-slate-400", bg: "bg-slate-50 dark:bg-slate-900/20", text: "text-slate-600 dark:text-slate-400" },
};

const isEngagementValid = (val: string) => ["ManagedServices", "StaffAugmentation", "FixedPrice"].includes(val);
const isBillingValid = (val: string) => ["TimeAndMaterial", "FixedPrice", "Retainer"].includes(val);
const isPriorityValid = (val: string) => ["Low", "Medium", "High", "Critical"].includes(val);
const isCurrencyValid = (val: string) => ["USD", "EUR", "AED", "SAR"].includes(val);
const isStatusValid = (val: string) => ["Draft", "Active", "OnHold", "PendingClosure", "Closed"].includes(val);

const formatBudget = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch (e) {
    return `${currency || "USD"} ${(value || 0).toLocaleString()}`;
  }
};

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

const STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Active", label: "Active" },
  { value: "OnHold", label: "On Hold" },
  { value: "PendingClosure", label: "At Risk" },
  { value: "Closed", label: "Completed" },
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
    <div className={cn("relative flex items-center w-fit bg-transparent", className)}>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border-0 outline-none ring-0 appearance-none pr-5 text-xs font-semibold cursor-pointer text-foreground focus:ring-0 focus:outline-none"
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
      <ChevronDown className="absolute right-0.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}



interface ImportProjectsDialogProps {
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  existingProjectNames: string[];
}

export function ImportProjectsDialog({ open, onClose, refetch, existingProjectNames }: ImportProjectsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProjectRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch metadata lists for mapping
  const { data: departments = [] } = useGetDepartmentsQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: managers = [] } = useGetProjectManagersQuery();

  const [createProject] = useCreateProjectMutation();

  const downloadSampleCSV = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent triggering file selection dialog
    
    const headers = [
      "Name",
      "Objective",
      "Department",
      "Customer",
      "Engagement Type",
      "Billing Model",
      "Priority",
      "Start Date",
      "End Date",
      "Value",
      "Currency",
      "Primary PM",
      "Secondary PM",
      "Status"
    ];

    const defaultDept = departments[0]?.name || "Security";
    const defaultCust = customers[0]?.displayName || "Acme Corp";
    const defaultPm = managers[0]?.displayName || "John Doe";
    const defaultPm2 = managers[1]?.displayName || "";

    const sampleRows = [
      [
        "Cyber Security Assessment",
        "Perform vulnerability assessments and compliance audits.",
        defaultDept,
        defaultCust,
        "FixedPrice",
        "FixedPrice",
        "High",
        "2026-07-01",
        "2026-09-30",
        "45000",
        "USD",
        defaultPm,
        defaultPm2,
        "Planned"
      ],
      [
        "Cloud Infrastructure Migration",
        "Migrate legacy servers to AWS cloud environments.",
        defaultDept,
        defaultCust,
        "TimeAndMaterials",
        "TimeAndMaterials",
        "Medium",
        "2026-08-15",
        "2027-02-15",
        "120000",
        "USD",
        defaultPm,
        "",
        "Active"
      ]
    ];

    const escapeCSV = (str: any) => {
      if (str == null) return "";
      const s = String(str);
      if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvContent = [
      headers.join(","),
      ...sampleRows.map(row => row.map(escapeCSV).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "projects_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Sample CSV template downloaded.");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Please upload a valid CSV file.");
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const csvData = parseCSV(text);
        if (csvData.length <= 1) {
          toast.error("The CSV file is empty or only contains headers.");
          return;
        }

        const processed = processRawCSVRows(csvData, departments, customers, managers);
        
        // Prevent duplication
        const existingSet = new Set(existingProjectNames.map((n) => n.trim().toLowerCase()));
        const finalProcessed = processed.map((row) => {
          const lowerName = row.name.trim().toLowerCase();
          if (lowerName && existingSet.has(lowerName)) {
            return {
              ...row,
              errors: [...row.errors, `Project "${row.name}" already exists.`],
            };
          }
          return row;
        });

        setParsedRows(finalProcessed);
        toast.success(`Loaded ${finalProcessed.length} rows from CSV`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse CSV file.");
      }
    };
    reader.readAsText(selectedFile);
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
    if (isImporting) return; // Prevent closing while importing
    handleReset();
    onClose();
  };

  const handleInlineChange = (index: number, field: keyof ParsedProjectRow, value: any) => {
    setParsedRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        const updated = { ...row, [field]: value };
        
        // Re-validate that specific row
        const rowErrors: string[] = [];
        if (!updated.name) rowErrors.push("Project name is required.");
        if (!updated.objective) rowErrors.push("Objective is required.");
        
        // Validate Start Date
        let isStartValid = false;
        if (updated.startDate) {
          const parsedStart = Date.parse(updated.startDate);
          if (!isNaN(parsedStart)) {
            isStartValid = true;
          } else {
            rowErrors.push("Start date must be a valid date (YYYY-MM-DD).");
          }
        } else {
          rowErrors.push("Start date is required.");
        }

        // Validate End Date
        let isEndValid = false;
        if (updated.endDate) {
          const parsedEnd = Date.parse(updated.endDate);
          if (!isNaN(parsedEnd)) {
            isEndValid = true;
          } else {
            rowErrors.push("End date must be a valid date (YYYY-MM-DD).");
          }
        } else {
          rowErrors.push("End date is required.");
        }

        // Validate Range
        if (isStartValid && isEndValid) {
          if (new Date(updated.startDate).getTime() > new Date(updated.endDate).getTime()) {
            rowErrors.push("End date must be on or after start date.");
          }
        }

        if (!updated.resolvedDepartmentId) rowErrors.push("Department is required.");
        if (!updated.resolvedCustomerId) rowErrors.push("Customer is required.");
        if (!updated.resolvedPrimaryPmId) rowErrors.push("Primary PM is required.");

        if (!isEngagementValid(updated.engagementType)) {
          rowErrors.push(`Engagement Type "${updated.engagementType}" is invalid. Please select one.`);
        }
        if (!isBillingValid(updated.billingModel)) {
          rowErrors.push(`Billing Model "${updated.billingModel}" is invalid. Please select one.`);
        }
        if (!isPriorityValid(updated.priority)) {
          rowErrors.push(`Priority "${updated.priority}" is invalid. Please select one.`);
        }
        if (!isCurrencyValid(updated.currency)) {
          rowErrors.push(`Currency "${updated.currency}" is invalid. Please select one.`);
        }
        if (!isStatusValid(updated.status)) {
          rowErrors.push(`Status "${updated.status}" is invalid. Please select one.`);
        }

        const lowerName = (updated.name || "").trim().toLowerCase();
        const existingSet = new Set(existingProjectNames.map((n) => n.trim().toLowerCase()));
        if (lowerName && existingSet.has(lowerName)) {
          rowErrors.push(`Project "${updated.name}" already exists.`);
        }

        return { ...updated, errors: rowErrors };
      })
    );
  };

  // Determine if import is allowed
  const validRows = useMemo(() => parsedRows.filter((r) => r.errors.length === 0), [parsedRows]);
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
        await createProject({
          name: row.name,
          objective: row.objective,
          departmentId: row.resolvedDepartmentId!,
          customerId: row.resolvedCustomerId!,
          engagementType: row.engagementType as any,
          billingModel: row.billingModel as any,
          priority: row.priority as any,
          startDate: new Date(row.startDate).toISOString(),
          endDate: new Date(row.endDate).toISOString(),
          value: row.value,
          currency: row.currency as any,
          primaryPmId: row.resolvedPrimaryPmId!,
          secondaryPmId: row.resolvedSecondaryPmId || undefined,
          status: row.status as any,
        }).unwrap();
        successCount++;
      } catch (err) {
        console.error(`Failed to import project: ${row.name}`, err);
        failCount++;
      }
      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} projects.`);
      refetch();
    }
    if (failCount > 0) {
      toast.error(`Failed to import ${failCount} projects.`);
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
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-primary" />
              <DialogPrimitive.Title className="text-sm font-bold text-foreground">
                Import Projects from CSV
              </DialogPrimitive.Title>
            </div>
            <div className="flex items-center gap-2">
              {!isImporting && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={downloadSampleCSV}
                  className="h-8 gap-1 rounded-lg text-[11px] font-bold cursor-pointer border-primary/20 text-primary hover:bg-primary/5"
                >
                  <Download className="size-3.5" />
                  Download Sample CSV
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
                  accept=".csv"
                  className="hidden"
                />
                <div className="size-12 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-center text-primary">
                  <Upload className="size-6" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-foreground">Click to select or drag CSV file</p>
                  <p className="text-xs text-muted-foreground">Supported format: CSV only (.csv)</p>
                </div>
                <div className="mt-4 p-3 bg-muted/40 border border-border/50 rounded-xl max-w-md text-[10px] text-muted-foreground space-y-1 font-medium leading-relaxed">
                  <p className="font-bold text-foreground mb-1 uppercase tracking-wider">Required Column Headers:</p>
                  <p>• Name, Objective, Start Date, End Date</p>
                  <p>• Department, Customer, Primary PM</p>
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
                      <p className="text-sm font-bold">Importing projects...</p>
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
                  /* Project Preview Table */
                  <div className="border border-border rounded-xl flex flex-col bg-card">
                    <div className="w-full overflow-x-auto overflow-y-auto max-h-[50vh]">
                      <div className="min-w-[2000px]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase tracking-wider text-[10px] sticky top-0 z-10">
                              <th className="p-3 w-64">Validation</th>
                              <th className="p-3 w-60">Project Name & Objective</th>
                              <th className="p-3 w-48">Department</th>
                              <th className="p-3 w-48">Customer</th>
                              <th className="p-3 w-48">Engagement Type</th>
                              <th className="p-3 w-44">Billing Model</th>
                              <th className="p-3 w-40">Priority</th>
                              <th className="p-3 w-48">Primary PM</th>
                              <th className="p-3 w-48">Secondary PM</th>
                              <th className="p-3 w-48">Timeline (Start / End)</th>
                              <th className="p-3 w-52">Budget (Currency / Value)</th>
                              <th className="p-3 w-40">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {parsedRows.map((row, idx) => {
                              const hasRowErrors = row.errors.length > 0;
                              const hasRowWarnings = row.warnings.length > 0;

                              return (
                                <tr
                                  key={idx}
                                  className={`hover:bg-muted/10 transition-colors ${
                                    hasRowErrors ? "bg-rose-50/20 dark:bg-rose-950/5" : ""
                                  }`}
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

                                  {/* Details */}
                                  <td className="p-3">
                                    <div className="flex flex-col gap-1 w-56">
                                      <div className="font-bold text-foreground truncate">{row.name || <span className="italic text-rose-400">Missing Name</span>}</div>
                                      <div className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                                        {row.objective || "No objective"}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Department Dropdown / Display */}
                                  <td className="p-3">
                                    <select
                                      value={row.resolvedDepartmentId || ""}
                                      onChange={(e) =>
                                        handleInlineChange(idx, "resolvedDepartmentId", e.target.value)
                                      }
                                      className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
                                    >
                                      {!row.resolvedDepartmentId && (
                                        <option value="" disabled className="text-rose-500 font-bold">
                                          {row.departmentName || "Select Department"}
                                        </option>
                                      )}
                                      {departments.map((d: Department) => (
                                        <option key={d.id} value={d.id}>
                                          {d.name} ({d.code})
                                        </option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* Customer Dropdown / Display */}
                                  <td className="p-3">
                                    <select
                                      value={row.resolvedCustomerId || ""}
                                      onChange={(e) =>
                                        handleInlineChange(idx, "resolvedCustomerId", e.target.value)
                                      }
                                      className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
                                    >
                                      {!row.resolvedCustomerId && (
                                        <option value="" disabled className="text-rose-500 font-bold">
                                          {row.customerName || "Select Customer"}
                                        </option>
                                      )}
                                      {customers.map((c: Customer) => (
                                        <option key={c.id} value={c.id}>
                                          {c.displayName}
                                        </option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* Engagement Type */}
                                  <td className="p-3">
                                    {isEngagementValid(row.engagementType) ? (
                                      <span className="text-xs font-medium text-foreground">
                                        {row.engagementType === "FixedPrice" && "Fixed Price"}
                                        {row.engagementType === "ManagedServices" && "Managed Services"}
                                        {row.engagementType === "StaffAugmentation" && "Staff Augmentation"}
                                      </span>
                                    ) : (
                                      <EnumSelect
                                        value={row.engagementType}
                                        options={ENGAGEMENT_OPTIONS}
                                        onChange={(val) => handleInlineChange(idx, "engagementType", val)}
                                        placeholder="Select Type"
                                      />
                                    )}
                                  </td>

                                  {/* Billing Model */}
                                  <td className="p-3">
                                    {isBillingValid(row.billingModel) ? (
                                      <span className="text-xs font-medium text-foreground">
                                        {row.billingModel === "FixedPrice" && "Fixed Price"}
                                        {row.billingModel === "TimeAndMaterial" && "Time & Material"}
                                        {row.billingModel === "Retainer" && "Retainer"}
                                      </span>
                                    ) : (
                                      <EnumSelect
                                        value={row.billingModel}
                                        options={BILLING_OPTIONS}
                                        onChange={(val) => handleInlineChange(idx, "billingModel", val)}
                                        placeholder="Select Billing"
                                      />
                                    )}
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

                                  {/* PM Dropdown / Display */}
                                  <td className="p-3">
                                    <select
                                      value={row.resolvedPrimaryPmId || ""}
                                      onChange={(e) =>
                                        handleInlineChange(idx, "resolvedPrimaryPmId", e.target.value)
                                      }
                                      className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
                                    >
                                      {!row.resolvedPrimaryPmId && (
                                        <option value="" disabled className="text-rose-500 font-bold">
                                          {row.primaryPmName || "Select Primary PM"}
                                        </option>
                                      )}
                                      {managers.map((m: ProjectManager) => (
                                        <option key={m.id} value={m.id}>
                                          {m.displayName}
                                        </option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* Secondary PM Dropdown */}
                                  <td className="p-3">
                                    <select
                                      value={row.resolvedSecondaryPmId || ""}
                                      onChange={(e) => handleInlineChange(idx, "resolvedSecondaryPmId", e.target.value || null)}
                                      className="w-full h-8 text-xs rounded-lg border border-border bg-background px-2 font-medium"
                                    >
                                      <option value="">None</option>
                                      {managers.map((m: ProjectManager) => (
                                        <option key={m.id} value={m.id}>
                                          {m.displayName}
                                        </option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* Timeline Dates */}
                                  <td className="p-3">
                                    <div className="text-xs text-foreground font-medium space-y-0.5 w-36">
                                      <div>{row.startDate ? row.startDate.slice(0, 10) : "—"}</div>
                                      <div className="text-muted-foreground/60">→ {row.endDate ? row.endDate.slice(0, 10) : "—"}</div>
                                    </div>
                                  </td>

                                  {/* Budget (Value & Currency) */}
                                  <td className="p-3">
                                    {isCurrencyValid(row.currency) ? (
                                      <div className="text-xs font-semibold text-foreground w-40">
                                        {formatBudget(row.value, row.currency)}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 w-40">
                                        <EnumSelect
                                          value={row.currency}
                                          options={CURRENCY_OPTIONS}
                                          onChange={(val) => handleInlineChange(idx, "currency", val)}
                                          placeholder="Cur"
                                          className="w-16"
                                        />
                                        <span className="text-xs font-semibold text-foreground">
                                          {(row.value || 0).toLocaleString()}
                                        </span>
                                      </div>
                                    )}
                                  </td>

                                  {/* Status */}
                                  <td className="p-3">
                                    {isStatusValid(row.status) ? (
                                      (() => {
                                        const statusCfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.Planned;
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
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-muted/15">
            <div className="text-xs text-muted-foreground font-semibold">
              {file && !isImporting && (
                <span>
                  {validRows.length} of {parsedRows.length} projects ready to import.
                  {hasErrors && (
                    <span className="text-rose-500 ml-1">
                      ({parsedRows.length - validRows.length} rows contain errors)
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
                  Import Projects
                </Button>
              )}
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
