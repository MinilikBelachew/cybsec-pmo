"use client";

import React, { useState, useRef, useMemo } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "react-hot-toast";
import {
  useGetDepartmentsQuery,
  useGetCustomersQuery,
  useGetProjectManagersQuery,
  useCreateProjectMutation,
  useCreatePhaseMutation,
  useCreateMilestoneMutation,
} from "../../api/projects.api";
import { useCreateTaskMutation } from "../../api/tasks.api";
import { Department, Customer, ProjectManager } from "../../types/projects.types";
import {
  processRawCSVRows,
  ParsedProjectRow,
  parseXLSXSheet,
  getXLSXSheetNames,
  processRawPhaseRows,
  processRawTaskCSVRows,
  processRawMilestoneRows,
  generateProjectsXLSXTemplate,
  ParsedPhaseRow,
  ParsedTaskRow,
  ParsedMilestoneRow,
} from "../../utils/import-export";
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
  ChevronRight,
  FolderOpen,
  Layers,
  CheckSquare,
  Milestone,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";

import {
  PROJECT_STATUS_CONFIG,
  PROJECT_STATUSES,
  getProjectStatusLabel,
} from "../../utils/project-status";

const STATUS_CONFIG = PROJECT_STATUS_CONFIG;

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  Critical: { label: "Critical", dot: "bg-red-500", bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-700 dark:text-red-400" },
  High: { label: "High", dot: "bg-rose-500", bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400" },
  Medium: { label: "Medium", dot: "bg-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400" },
  Low: { label: "Low", dot: "bg-slate-400", bg: "bg-slate-50 dark:bg-slate-900/20", text: "text-slate-600 dark:text-slate-400" },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
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

const isEngagementValid = (val: string) => ["ManagedServices", "StaffAugmentation", "FixedPrice"].includes(val);
const isBillingValid = (val: string) => ["TimeAndMaterial", "FixedPrice", "Retainer"].includes(val);
const isPriorityValid = (val: string) => ["Low", "Medium", "High", "Critical"].includes(val);
const isCurrencyValid = (val: string) => ["USD", "EUR", "AED", "SAR"].includes(val);
const isStatusValid = (val: string) => PROJECT_STATUSES.includes(val as (typeof PROJECT_STATUSES)[number]);
const isTaskStatusValid = (val: string) => ["To_Do", "In_Progress", "Submitted_for_Review", "Approved", "Rework", "Done"].includes(val);
const isPhaseStatusValid = (val: string) => ["Planned", "Active", "Completed", "On_Hold"].includes(val);
const isMilestoneStatusValid = (val: string) => ["Pending", "Completed", "Missed"].includes(val);

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

const STATUS_OPTIONS = PROJECT_STATUSES.map((value) => ({
  value,
  label: getProjectStatusLabel(value),
}));

const TASK_STATUS_OPTIONS = [
  { value: "To_Do", label: "To Do" },
  { value: "In_Progress", label: "In Progress" },
  { value: "Submitted_for_Review", label: "Submitted for Review" },
  { value: "Approved", label: "Approved" },
  { value: "Rework", label: "Rework" },
  { value: "Done", label: "Done" },
];

const PHASE_STATUS_OPTIONS = [
  { value: "Planned", label: "Planned" },
  { value: "Active", label: "Active" },
  { value: "Completed", label: "Completed" },
  { value: "On_Hold", label: "On Hold" },
];

const MILESTONE_STATUS_OPTIONS = [
  { value: "Pending", label: "Pending" },
  { value: "Completed", label: "Completed" },
  { value: "Missed", label: "Missed" },
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
  
  // Extra sheets parsed data
  const [parsedPhases, setParsedPhases] = useState<Record<string, ParsedPhaseRow[]>>({});
  const [parsedTasks, setParsedTasks] = useState<Record<string, ParsedTaskRow[]>>({});
  const [parsedMilestones, setParsedMilestones] = useState<Record<string, ParsedMilestoneRow[]>>({});

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState("");

  // UI accordion and tabs state
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<Record<string, "phases" | "tasks" | "milestones">>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch metadata lists for mapping
  const { data: departments = [] } = useGetDepartmentsQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: managers = [] } = useGetProjectManagersQuery();

  const [createProject] = useCreateProjectMutation();
  const [createPhase] = useCreatePhaseMutation();
  const [createMilestone] = useCreateMilestoneMutation();
  const [createTask] = useCreateTaskMutation();

  const downloadSampleXLSX = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent triggering file selection dialog
    try {
      const buffer = generateProjectsXLSXTemplate(departments, customers, managers);
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "projects_import_template.xlsx");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Sample XLSX template downloaded.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate XLSX template.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".xlsx")) {
      toast.error("Please upload a valid Excel (.xlsx) file.");
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        
        // 1. Get sheets and parse Projects sheet
        const sheetNames = getXLSXSheetNames(buffer);
        const projectsData = parseXLSXSheet(buffer, "Projects");
        if (projectsData.length <= 1) {
          toast.error("The XLSX file must contain a 'Projects' sheet with at least one project row.");
          handleReset();
          return;
        }

        const processed = processRawCSVRows(projectsData, departments, customers, managers);
        
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

        // 2. Scan and parse extra sheets matching '[Project Name] Phases', '[Project Name] Tasks', '[Project Name] Milestones'
        const tempPhases: Record<string, ParsedPhaseRow[]> = {};
        const tempTasks: Record<string, ParsedTaskRow[]> = {};
        const tempMilestones: Record<string, ParsedMilestoneRow[]> = {};

        for (const projRow of finalProcessed) {
          const projName = projRow.name.trim();
          if (!projName) continue;

          // Parse Phases
          const phaseSheetName = `${projName} Phases`;
          if (sheetNames.includes(phaseSheetName)) {
            const phaseRaw = parseXLSXSheet(buffer, phaseSheetName, true);
            if (phaseRaw.length > 1) {
              tempPhases[projName] = processRawPhaseRows(phaseRaw);
            }
          }

          // Parse Tasks
          const taskSheetName = `${projName} Tasks`;
          if (sheetNames.includes(taskSheetName)) {
            const taskRaw = parseXLSXSheet(buffer, taskSheetName, true);
            if (taskRaw.length > 1) {
              tempTasks[projName] = processRawTaskCSVRows(taskRaw, [], []);
            }
          }

          // Parse Milestones
          const msSheetName = `${projName} Milestones`;
          if (sheetNames.includes(msSheetName)) {
            const msRaw = parseXLSXSheet(buffer, msSheetName, true);
            if (msRaw.length > 1) {
              tempMilestones[projName] = processRawMilestoneRows(msRaw);
            }
          }
        }

        setParsedRows(finalProcessed);
        setParsedPhases(tempPhases);
        setParsedTasks(tempTasks);
        setParsedMilestones(tempMilestones);
        
        // Auto-select first project tab that has extra sheets and does not already exist
        const firstWithSheets = finalProcessed.find(
          (p) => !p.errors.some(err => err.includes("already exists")) &&
                 (tempPhases[p.name]?.length || tempTasks[p.name]?.length || tempMilestones[p.name]?.length)
        );
        if (firstWithSheets) {
          setOpenAccordion(firstWithSheets.name);
        }

        toast.success(`Loaded ${finalProcessed.length} projects from XLSX`);
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
    setParsedPhases({});
    setParsedTasks({});
    setParsedMilestones({});
    setOpenAccordion(null);
    setActiveSubTab({});
    setImportProgress(0);
    setImportStatusText("");
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

  // Handler for project inline change
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

  // Handler for Phase, Task or Milestone inline change
  const handleSubRowChange = (
    projName: string,
    type: "phases" | "tasks" | "milestones",
    rowIndex: number,
    field: string,
    value: any
  ) => {
    if (type === "phases") {
      setParsedPhases((prev) => {
        const rows = [...(prev[projName] || [])];
        const updated = { ...rows[rowIndex], [field]: value };
        
        // Re-validate
        const errors: string[] = [];
        if (!updated.name) errors.push("Phase name is required.");
        if (updated.startDate && isNaN(Date.parse(updated.startDate))) {
          errors.push("Start date must be a valid date.");
        }
        if (updated.endDate && isNaN(Date.parse(updated.endDate))) {
          errors.push("End date must be a valid date.");
        }
        if (updated.startDate && updated.endDate && !isNaN(Date.parse(updated.startDate)) && !isNaN(Date.parse(updated.endDate))) {
          if (new Date(updated.startDate) > new Date(updated.endDate)) {
            errors.push("End date must be on or after start date.");
          }
        }
        updated.errors = errors;
        rows[rowIndex] = updated;
        return { ...prev, [projName]: rows };
      });
    } else if (type === "tasks") {
      setParsedTasks((prev) => {
        const rows = [...(prev[projName] || [])];
        const updated = { ...rows[rowIndex], [field]: value };
        
        // Re-validate
        const errors: string[] = [];
        if (!updated.title) errors.push("Task title is required.");
        if (updated.startDate && isNaN(Date.parse(updated.startDate))) {
          errors.push("Start date must be valid.");
        }
        if (updated.endDate && isNaN(Date.parse(updated.endDate))) {
          errors.push("End date must be valid.");
        }
        if (updated.startDate && updated.endDate && !isNaN(Date.parse(updated.startDate)) && !isNaN(Date.parse(updated.endDate))) {
          if (new Date(updated.startDate) > new Date(updated.endDate)) {
            errors.push("End date must be on or after start date.");
          }
        }
        if (!isTaskStatusValid(updated.status)) {
          errors.push(`Status "${updated.status}" is invalid.`);
        }
        if (!isPriorityValid(updated.priority)) {
          errors.push(`Priority "${updated.priority}" is invalid.`);
        }
        updated.errors = errors;
        rows[rowIndex] = updated;
        return { ...prev, [projName]: rows };
      });
    } else if (type === "milestones") {
      setParsedMilestones((prev) => {
        const rows = [...(prev[projName] || [])];
        const updated = { ...rows[rowIndex], [field]: value };
        
        // Re-validate
        const errors: string[] = [];
        if (!updated.title) errors.push("Milestone title is required.");
        if (!updated.targetDate) {
          errors.push("Target date is required.");
        } else if (isNaN(Date.parse(updated.targetDate))) {
          errors.push("Target date must be valid YYYY-MM-DD.");
        }
        updated.errors = errors;
        rows[rowIndex] = updated;
        return { ...prev, [projName]: rows };
      });
    }
  };

  // Determine if import is allowed (valid rows exist in Projects and sub-sheets contain no errors)
  const validRows = useMemo(() => parsedRows.filter((r) => r.errors.length === 0), [parsedRows]);
  const hasErrors = useMemo(() => {
    if (parsedRows.some((r) => r.errors.length > 0)) return true;
    for (const key of Object.keys(parsedPhases)) {
      if (parsedPhases[key].some((row) => row.errors.length > 0)) return true;
    }
    for (const key of Object.keys(parsedTasks)) {
      if (parsedTasks[key].some((row) => row.errors.length > 0)) return true;
    }
    for (const key of Object.keys(parsedMilestones)) {
      if (parsedMilestones[key].some((row) => row.errors.length > 0)) return true;
    }
    return false;
  }, [parsedRows, parsedPhases, parsedTasks, parsedMilestones]);

  const hasActiveErrors = useMemo(() => {
    for (const proj of validRows) {
      if (parsedPhases[proj.name]?.some((row) => row.errors.length > 0)) return true;
      if (parsedTasks[proj.name]?.some((row) => row.errors.length > 0)) return true;
      if (parsedMilestones[proj.name]?.some((row) => row.errors.length > 0)) return true;
    }
    return false;
  }, [validRows, parsedPhases, parsedTasks, parsedMilestones]);

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast.error("No valid projects to import.");
      return;
    }

    setIsImporting(true);
    let successProjects = 0;
    let failProjects = 0;
    let successPhases = 0;
    let successTasks = 0;
    let successMilestones = 0;

    for (let i = 0; i < validRows.length; i++) {
      const projRow = validRows[i];
      setImportStatusText(`Creating project: ${projRow.name}`);
      setImportProgress(Math.round((i / validRows.length) * 100));

      try {
        // 1. Create project
        const projectResult = await createProject({
          name: projRow.name,
          objective: projRow.objective,
          departmentId: projRow.resolvedDepartmentId!,
          customerId: projRow.resolvedCustomerId!,
          engagementType: projRow.engagementType as any,
          billingModel: projRow.billingModel as any,
          priority: projRow.priority as any,
          startDate: new Date(projRow.startDate).toISOString(),
          endDate: new Date(projRow.endDate).toISOString(),
          value: projRow.value,
          currency: projRow.currency as any,
          primaryPmId: projRow.resolvedPrimaryPmId!,
          secondaryPmId: projRow.resolvedSecondaryPmId || undefined,
          status: "Draft",
        }).unwrap();

        successProjects++;
        const projectId = projectResult.id;
        const phaseNameToId: Record<string, string> = {};

        // 2. Create phases if available
        const projectPhases = parsedPhases[projRow.name] || [];
        if (projectPhases.length > 0) {
          setImportStatusText(`Creating phases for project: ${projRow.name}`);
          for (const phaseRow of projectPhases) {
            if (phaseRow.errors.length > 0) continue;
            try {
              const res = await createPhase({
                projectId,
                body: {
                  name: phaseRow.name,
                  description: phaseRow.description || null,
                  orderIndex: phaseRow.orderIndex,
                  status: phaseRow.status as any,
                  startDate: phaseRow.startDate ? new Date(phaseRow.startDate).toISOString() : new Date(projRow.startDate).toISOString(),
                  endDate: phaseRow.endDate ? new Date(phaseRow.endDate).toISOString() : new Date(projRow.endDate).toISOString(),
                },
              }).unwrap();
              phaseNameToId[phaseRow.name.toLowerCase().trim()] = res.id;
              successPhases++;
            } catch (err) {
              console.error(`Failed to create phase "${phaseRow.name}" for project "${projRow.name}":`, err);
            }
          }
        }

        // 3. Create tasks if available
        const projectTasks = parsedTasks[projRow.name] || [];
        if (projectTasks.length > 0) {
          setImportStatusText(`Creating tasks for project: ${projRow.name}`);
          for (const taskRow of projectTasks) {
            if (taskRow.errors.length > 0) continue;
            try {
              // Resolve phase if name matches
              const resolvedPhaseId = taskRow.phaseName
                ? phaseNameToId[taskRow.phaseName.toLowerCase().trim()] || null
                : null;

              await createTask({
                projectId,
                title: taskRow.title,
                description: taskRow.description || null,
                priority: taskRow.priority,
                status: taskRow.status,
                ownerId: null, // Always unassigned on bulk import
                phaseId: resolvedPhaseId,
                startDate: taskRow.startDate ? new Date(taskRow.startDate).toISOString() : null,
                endDate: taskRow.endDate ? new Date(taskRow.endDate).toISOString() : null,
                effortHours: taskRow.effortHours || null,
              }).unwrap();
              successTasks++;
            } catch (err) {
              console.error(`Failed to create task "${taskRow.title}" for project "${projRow.name}":`, err);
            }
          }
        }

        // 4. Create milestones if available
        const projectMilestones = parsedMilestones[projRow.name] || [];
        if (projectMilestones.length > 0) {
          setImportStatusText(`Creating milestones for project: ${projRow.name}`);
          for (const msRow of projectMilestones) {
            if (msRow.errors.length > 0) continue;
            try {
              const resolvedPhaseId = msRow.phaseName
                ? phaseNameToId[msRow.phaseName.toLowerCase().trim()] || null
                : null;

              await createMilestone({
                projectId,
                body: {
                  title: msRow.title,
                  targetDate: new Date(msRow.targetDate).toISOString(),
                  weight: msRow.weight || 0,
                  status: msRow.status,
                  phaseId: resolvedPhaseId,
                },
              }).unwrap();
              successMilestones++;
            } catch (err) {
              console.error(`Failed to create milestone "${msRow.title}" for project "${projRow.name}":`, err);
            }
          }
        }

      } catch (err) {
        console.error(`Failed to import project: ${projRow.name}`, err);
        failProjects++;
      }
    }

    setImportProgress(100);
    setImportStatusText("Done");

    if (successProjects > 0) {
      toast.success(
        `Import summary:\n` +
        `• ${successProjects} Projects created\n` +
        `• ${successPhases} Phases created\n` +
        `• ${successTasks} Tasks created\n` +
        `• ${successMilestones} Milestones created`
      );
      refetch();
    }
    if (failProjects > 0) {
      toast.error(`Failed to import ${failProjects} projects.`);
    }

    setIsImporting(false);
    handleClose();
  };

  // Helper to determine if a project has any child sheets data
  const hasExtraData = (projName: string) => {
    return (
      (parsedPhases[projName]?.length || 0) > 0 ||
      (parsedTasks[projName]?.length || 0) > 0 ||
      (parsedMilestones[projName]?.length || 0) > 0
    );
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-7xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-primary" />
              <DialogPrimitive.Title className="text-sm font-bold text-foreground">
                Import Projects from XLSX
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
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            {!file ? (
              /* File Upload Area */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-h-[300px] border-2 border-dashed border-border/80 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/10 transition-all gap-3 p-6"
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
                <div className="mt-4 p-4 bg-muted/40 border border-border/50 rounded-xl max-w-2xl text-[11px] text-muted-foreground space-y-2 font-medium leading-relaxed">
                  <p className="font-bold text-foreground mb-1 uppercase tracking-wider">XLSX Sheet Guidelines:</p>
                  <p>• <strong>Projects:</strong> Contains core project metadata (Name, Objective, Department, Customer, Primary PM, timeline, etc.)</p>
                  <p>• <strong>[Project Name] Phases:</strong> Optional sheet containing columns: Name, Description, Order, Status, Start Date, End Date</p>
                  <p>• <strong>[Project Name] Tasks:</strong> Optional sheet containing columns: Title, Description, Priority, Status, Phase, Start Date, End Date, Effort Hours</p>
                  <p>• <strong>[Project Name] Milestones:</strong> Optional sheet containing columns: Title, Target Date, Weight (%), Status, Phase</p>
                </div>
              </div>
            ) : (
              /* Preview Area */
              <div className="flex-1 flex flex-col gap-6">
                {/* File Information Alert */}
                <div className="flex items-center justify-between bg-muted/30 border border-border/40 p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="size-5 text-primary" />
                    <div>
                      <p className="text-xs font-bold text-foreground truncate max-w-[200px] sm:max-w-md">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium">
                        {(file.size / 1024).toFixed(1)} KB · {parsedRows.length} projects loaded · {Object.keys(parsedPhases).length} phase sheets · {Object.keys(parsedTasks).length} task sheets · {Object.keys(parsedMilestones).length} milestone sheets detected
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
                      <p className="text-sm font-bold">{importStatusText}</p>
                      <p className="text-xs text-muted-foreground">
                        Please do not close this dialog or navigate away.
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
                    {/* Projects Preview Table */}
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Core Projects Sheet</h3>
                      <div className="border border-border rounded-xl flex flex-col bg-card">
                        <div className="w-full overflow-x-auto overflow-y-auto max-h-[35vh]">
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
                                      className={cn(
                                        "hover:bg-muted/10 transition-colors",
                                        hasRowErrors ? "bg-rose-50/20 dark:bg-rose-950/5" : ""
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

                                      {/* Details */}
                                      <td className="p-3">
                                        <div className="flex flex-col gap-1 w-56">
                                          <div className="font-bold text-foreground truncate">{row.name || <span className="italic text-rose-400">Missing Name</span>}</div>
                                          <div className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                                            {row.objective || "No objective"}
                                          </div>
                                        </div>
                                      </td>

                                      {/* Department Dropdown */}
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

                                      {/* Customer Dropdown */}
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
                                            const priorityCfg = PRIORITY_CONFIG[row.priority] || PRIORITY_CONFIG.Medium;
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

                                      {/* Primary PM Dropdown */}
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

                                      {/* Budget */}
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
                                            const statusCfg = STATUS_CONFIG[row.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.Draft;
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
                    </div>

                    {/* Child Accordions section */}
                    {parsedRows.some((p) => hasExtraData(p.name)) && (
                      <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phases, Tasks & Milestones Sheets</h3>
                        
                        <div className="space-y-3">
                          {parsedRows.map((proj) => {
                            if (!hasExtraData(proj.name)) return null;

                            const isExpanded = openAccordion === proj.name;
                            const phasesList = parsedPhases[proj.name] || [];
                            const tasksList = parsedTasks[proj.name] || [];
                            const milestonesList = parsedMilestones[proj.name] || [];

                            const activeTab = activeSubTab[proj.name] || (phasesList.length > 0 ? "phases" : tasksList.length > 0 ? "tasks" : "milestones");
                            const isProjectExisting = proj.errors.some(err => err.includes("already exists"));

                            return (
                              <div key={proj.name} className={cn("border rounded-xl overflow-hidden bg-muted/5", isProjectExisting ? "border-border/40 opacity-70" : "border-border/80")}>
                                {/* Accordion Header */}
                                <button
                                  onClick={() => !isProjectExisting && setOpenAccordion(isExpanded ? null : proj.name)}
                                  disabled={isProjectExisting}
                                  className={cn(
                                    "w-full flex items-center justify-between p-4 bg-muted/20 border-b border-border/60 transition text-left",
                                    isProjectExisting ? "opacity-50 cursor-not-allowed bg-muted/10" : "hover:bg-muted/30 cursor-pointer"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    {isExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                                    <FolderOpen className="size-4.5 text-primary shrink-0" />
                                    <span className={cn("text-xs font-bold", isProjectExisting ? "text-muted-foreground font-medium" : "text-foreground")}>
                                      {proj.name}
                                      {isProjectExisting && (
                                        <span className="text-[10px] text-rose-500 font-bold ml-2">
                                          (Project already exists - Sheets disabled)
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {phasesList.length > 0 && <Badge variant="outline" className="text-[10px] gap-1 font-semibold"><Layers className="size-3" />{phasesList.length} Phases</Badge>}
                                    {tasksList.length > 0 && <Badge variant="outline" className="text-[10px] gap-1 font-semibold"><CheckSquare className="size-3" />{tasksList.length} Tasks</Badge>}
                                    {milestonesList.length > 0 && <Badge variant="outline" className="text-[10px] gap-1 font-semibold"><Milestone className="size-3" />{milestonesList.length} Milestones</Badge>}
                                  </div>
                                </button>

                                {/* Accordion Body */}
                                {isExpanded && (
                                  <div className="p-4 flex flex-col gap-4">
                                    {/* Tabs selection */}
                                    <div className="flex border-b border-border gap-2">
                                      {phasesList.length > 0 && (
                                        <button
                                          onClick={() => setActiveSubTab((prev) => ({ ...prev, [proj.name]: "phases" }))}
                                          className={cn(
                                            "pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors",
                                            activeTab === "phases" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                                          )}
                                        >
                                          Phases ({phasesList.length})
                                        </button>
                                      )}
                                      {tasksList.length > 0 && (
                                        <button
                                          onClick={() => setActiveSubTab((prev) => ({ ...prev, [proj.name]: "tasks" }))}
                                          className={cn(
                                            "pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors",
                                            activeTab === "tasks" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                                          )}
                                        >
                                          Tasks ({tasksList.length})
                                        </button>
                                      )}
                                      {milestonesList.length > 0 && (
                                        <button
                                          onClick={() => setActiveSubTab((prev) => ({ ...prev, [proj.name]: "milestones" }))}
                                          className={cn(
                                            "pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-colors",
                                            activeTab === "milestones" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                                          )}
                                        >
                                          Milestones ({milestonesList.length})
                                        </button>
                                      )}
                                    </div>

                                    {/* Table View per Tab */}
                                    <div className="border border-border/60 rounded-lg overflow-x-auto bg-card max-h-[30vh]">
                                      {activeTab === "phases" && phasesList.length > 0 && (
                                        <table className="w-full text-left text-xs min-w-[1000px]">
                                          <thead>
                                            <tr className="bg-muted/40 font-bold border-b border-border text-muted-foreground text-[10px] uppercase">
                                              <th className="p-3 w-40">Validation</th>
                                              <th className="p-3 w-48">Name</th>
                                              <th className="p-3 w-56">Description</th>
                                              <th className="p-3 w-24">Order</th>
                                              <th className="p-3 w-32">Status</th>
                                              <th className="p-3 w-36">Start Date</th>
                                              <th className="p-3 w-36">End Date</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-border/60">
                                            {phasesList.map((phRow, idx) => (
                                              <tr key={idx} className={cn("hover:bg-muted/5", phRow.errors.length > 0 ? "bg-rose-50/10" : "")}>
                                                <td className="p-3">
                                                  {phRow.errors.length > 0 ? (
                                                    <div className="text-rose-500 font-bold flex items-center gap-1.5">
                                                      <XCircle className="size-3.5" />
                                                      <span className="text-[10px]">{phRow.errors[0]}</span>
                                                    </div>
                                                  ) : (
                                                    <span className="text-emerald-600 font-semibold flex items-center gap-1.5"><CheckCircle className="size-3.5" />Ready</span>
                                                  )}
                                                </td>
                                                <td className="p-3 font-semibold">{phRow.name}</td>
                                                <td className="p-3 text-muted-foreground truncate max-w-xs">{phRow.description || "—"}</td>
                                                <td className="p-3">{phRow.orderIndex}</td>
                                                <td className="p-3">
                                                  {isPhaseStatusValid(phRow.status) ? (
                                                    <Badge variant="outline" className="text-[9px]">{phRow.status}</Badge>
                                                  ) : (
                                                    <EnumSelect
                                                      value={phRow.status}
                                                      options={PHASE_STATUS_OPTIONS}
                                                      onChange={(val) => handleSubRowChange(proj.name, "phases", idx, "status", val)}
                                                    />
                                                  )}
                                                </td>
                                                <td className="p-3">{phRow.startDate || "—"}</td>
                                                <td className="p-3">{phRow.endDate || "—"}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}

                                      {activeTab === "tasks" && tasksList.length > 0 && (
                                        <table className="w-full text-left text-xs min-w-[1200px]">
                                          <thead>
                                            <tr className="bg-muted/40 font-bold border-b border-border text-muted-foreground text-[10px] uppercase">
                                              <th className="p-3 w-40">Validation</th>
                                              <th className="p-3 w-56">Title & Description</th>
                                              <th className="p-3 w-32">Priority</th>
                                              <th className="p-3 w-32">Status</th>
                                              <th className="p-3 w-44">Assignee</th>
                                              <th className="p-3 w-44">Phase</th>
                                              <th className="p-3 w-36">Start Date</th>
                                              <th className="p-3 w-36">End Date</th>
                                              <th className="p-3 w-28">Effort</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-border/60">
                                            {tasksList.map((tRow, idx) => (
                                              <tr key={idx} className={cn("hover:bg-muted/5", tRow.errors.length > 0 ? "bg-rose-50/10" : "")}>
                                                <td className="p-3">
                                                  {tRow.errors.length > 0 ? (
                                                    <div className="text-rose-500 font-bold flex items-center gap-1.5">
                                                      <XCircle className="size-3.5" />
                                                      <span className="text-[10px]">{tRow.errors[0]}</span>
                                                    </div>
                                                  ) : (
                                                    <span className="text-emerald-600 font-semibold flex items-center gap-1.5"><CheckCircle className="size-3.5" />Ready</span>
                                                  )}
                                                </td>
                                                <td className="p-3">
                                                  <div className="font-bold truncate">{tRow.title}</div>
                                                  <div className="text-[10px] text-muted-foreground line-clamp-1">{tRow.description || "No description"}</div>
                                                </td>
                                                <td className="p-3">
                                                  {isPriorityValid(tRow.priority) ? (
                                                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", PRIORITY_CONFIG[tRow.priority]?.bg, PRIORITY_CONFIG[tRow.priority]?.text)}>
                                                      {tRow.priority}
                                                    </span>
                                                  ) : (
                                                    <EnumSelect
                                                      value={tRow.priority}
                                                      options={PRIORITY_OPTIONS}
                                                      onChange={(val) => handleSubRowChange(proj.name, "tasks", idx, "priority", val)}
                                                    />
                                                  )}
                                                </td>
                                                <td className="p-3">
                                                  {isTaskStatusValid(tRow.status) ? (
                                                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1", TASK_STATUS_CONFIG[tRow.status]?.bg, TASK_STATUS_CONFIG[tRow.status]?.text, TASK_STATUS_CONFIG[tRow.status]?.border)}>
                                                      <span className={cn("size-1 rounded-full", TASK_STATUS_CONFIG[tRow.status]?.dot)} />
                                                      {TASK_STATUS_CONFIG[tRow.status]?.label}
                                                    </span>
                                                  ) : (
                                                    <EnumSelect
                                                      value={tRow.status}
                                                      options={TASK_STATUS_OPTIONS}
                                                      onChange={(val) => handleSubRowChange(proj.name, "tasks", idx, "status", val)}
                                                    />
                                                  )}
                                                </td>
                                                <td className="p-3 text-muted-foreground">
                                                  {tRow.assigneeName ? (
                                                    <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-500" title="Assignees are mapped to project team members after import. This task will import as Unassigned.">
                                                      <AlertTriangle className="size-3" />
                                                      {tRow.assigneeName} (Will be Unassigned)
                                                    </span>
                                                  ) : (
                                                    "Unassigned"
                                                  )}
                                                </td>
                                                <td className="p-3 text-muted-foreground font-semibold">
                                                  {tRow.phaseName ? (
                                                    <span className="text-primary">{tRow.phaseName}</span>
                                                  ) : (
                                                    "No Phase"
                                                  )}
                                                </td>
                                                <td className="p-3">{tRow.startDate || "—"}</td>
                                                <td className="p-3">{tRow.endDate || "—"}</td>
                                                <td className="p-3">{tRow.effortHours ? `${tRow.effortHours} hrs` : "—"}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}

                                      {activeTab === "milestones" && milestonesList.length > 0 && (
                                        <table className="w-full text-left text-xs min-w-[800px]">
                                          <thead>
                                            <tr className="bg-muted/40 font-bold border-b border-border text-muted-foreground text-[10px] uppercase">
                                              <th className="p-3 w-40">Validation</th>
                                              <th className="p-3 w-56">Title</th>
                                              <th className="p-3 w-32">Target Date</th>
                                              <th className="p-3 w-24">Weight</th>
                                              <th className="p-3 w-32">Status</th>
                                              <th className="p-3 w-44">Phase</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-border/60">
                                            {milestonesList.map((msRow, idx) => (
                                              <tr key={idx} className={cn("hover:bg-muted/5", msRow.errors.length > 0 ? "bg-rose-50/10" : "")}>
                                                <td className="p-3">
                                                  {msRow.errors.length > 0 ? (
                                                    <div className="text-rose-500 font-bold flex items-center gap-1.5">
                                                      <XCircle className="size-3.5" />
                                                      <span className="text-[10px]">{msRow.errors[0]}</span>
                                                    </div>
                                                  ) : (
                                                    <span className="text-emerald-600 font-semibold flex items-center gap-1.5"><CheckCircle className="size-3.5" />Ready</span>
                                                  )}
                                                </td>
                                                <td className="p-3 font-semibold">{msRow.title}</td>
                                                <td className="p-3">{msRow.targetDate}</td>
                                                <td className="p-3 font-medium">{msRow.weight}%</td>
                                                <td className="p-3">
                                                  {isMilestoneStatusValid(msRow.status) ? (
                                                    <Badge variant="outline" className="text-[9px]">{msRow.status}</Badge>
                                                  ) : (
                                                    <EnumSelect
                                                      value={msRow.status}
                                                      options={MILESTONE_STATUS_OPTIONS}
                                                      onChange={(val) => handleSubRowChange(proj.name, "milestones", idx, "status", val)}
                                                    />
                                                  )}
                                                </td>
                                                <td className="p-3 text-primary font-semibold">{msRow.phaseName || "No Phase"}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-muted/15">
            <div className="text-xs text-muted-foreground font-semibold font-mono">
              {file && !isImporting && (
                <span>
                  {validRows.length} of {parsedRows.length} projects ready to import.
                  {hasActiveErrors && (
                    <span className="text-rose-500 ml-1">
                      (Some sheets contain validation errors)
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
                  disabled={validRows.length === 0 || hasActiveErrors}
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
