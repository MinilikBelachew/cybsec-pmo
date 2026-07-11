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
  detectTaskCsvImportKind,
} from "../../utils/import-export";
import { Button } from "@/shared/ui/button";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  X,
  PlayCircle,
  Download,
  AlertTriangle,
} from "lucide-react";

import { ProjectsPreviewTable } from "./projects-preview-table";
import { ProjectAccordionItem } from "./project-accordion-item";

interface ImportProjectsDialogProps {
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  existingProjectNames: string[];
}

export function ImportProjectsDialog({
  open,
  onClose,
  refetch,
  existingProjectNames,
}: ImportProjectsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProjectRow[]>([]);
  const [parsedPhases, setParsedPhases] = useState<Record<string, ParsedPhaseRow[]>>({});
  const [parsedTasks, setParsedTasks] = useState<Record<string, ParsedTaskRow[]>>({});
  const [parsedMilestones, setParsedMilestones] = useState<Record<string, ParsedMilestoneRow[]>>({});

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState("");

  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<Record<string, "phases" | "tasks" | "milestones">>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: departments = [] } = useGetDepartmentsQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: managers = [] } = useGetProjectManagersQuery();

  const [createProject] = useCreateProjectMutation();
  const [createPhase] = useCreatePhaseMutation();
  const [createMilestone] = useCreateMilestoneMutation();
  const [createTask] = useCreateTaskMutation();

  const hasExtraData = (projName: string) =>
    (parsedPhases[projName]?.length || 0) > 0 ||
    (parsedTasks[projName]?.length || 0) > 0 ||
    (parsedMilestones[projName]?.length || 0) > 0;

  const validRows = useMemo(
    () => parsedRows.filter((r) => r.errors.length === 0),
    [parsedRows]
  );

  const hasActiveErrors = useMemo(() => {
    for (const proj of validRows) {
      if (parsedPhases[proj.name]?.some((r) => r.errors.length > 0)) return true;
      if (parsedTasks[proj.name]?.some((r) => r.errors.length > 0)) return true;
      if (parsedMilestones[proj.name]?.some((r) => r.errors.length > 0)) return true;
    }
    return false;
  }, [validRows, parsedPhases, parsedTasks, parsedMilestones]);

  const downloadSampleXLSX = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const buffer = generateProjectsXLSXTemplate(departments, customers, managers);
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "projects_import_template.xlsx";
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
    setValidationError(null);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;

        const sheetNames = getXLSXSheetNames(buffer);
        const projectsData = parseXLSXSheet(buffer, "Projects");

        if (projectsData.length <= 1) {
          setValidationError("The XLSX file must contain a 'Projects' sheet with at least one project row.");
          setParsedRows([]);
          return;
        }

        const importKind = detectTaskCsvImportKind(projectsData);
        if (importKind === "tasks") {
          setValidationError(
            "This file looks like a Tasks export. Please upload it in the Project workspace under Import Tasks."
          );
          setParsedRows([]);
          return;
        }
        if (importKind === "unknown") {
          setValidationError(
            "The uploaded file does not match the expected Projects format. Please make sure the sheet has headers like 'Name', 'Objective', 'Department', 'Customer', etc."
          );
          setParsedRows([]);
          return;
        }

        const processed = processRawCSVRows(projectsData, departments, customers, managers);

        const existingSet = new Set(existingProjectNames.map((n) => n.trim().toLowerCase()));
        const finalProcessed = processed.map((row) => {
          const lowerName = row.name.trim().toLowerCase();
          if (lowerName && existingSet.has(lowerName)) {
            return { ...row, errors: [...row.errors, `Project "${row.name}" already exists.`] };
          }
          return row;
        });

        const tempPhases: Record<string, ParsedPhaseRow[]> = {};
        const tempTasks: Record<string, ParsedTaskRow[]> = {};
        const tempMilestones: Record<string, ParsedMilestoneRow[]> = {};

        for (const projRow of finalProcessed) {
          const projName = projRow.name.trim();
          if (!projName) continue;

          const phaseSheetName = `${projName} Phases`;
          if (sheetNames.includes(phaseSheetName)) {
            const raw = parseXLSXSheet(buffer, phaseSheetName, true);
            if (raw.length > 1) tempPhases[projName] = processRawPhaseRows(raw);
          }

          const taskSheetName = `${projName} Tasks`;
          if (sheetNames.includes(taskSheetName)) {
            const raw = parseXLSXSheet(buffer, taskSheetName, true);
            if (raw.length > 1) tempTasks[projName] = processRawTaskCSVRows(raw, [], []);
          }

          const msSheetName = `${projName} Milestones`;
          if (sheetNames.includes(msSheetName)) {
            const raw = parseXLSXSheet(buffer, msSheetName, true);
            if (raw.length > 1) tempMilestones[projName] = processRawMilestoneRows(raw);
          }
        }

        setParsedRows(finalProcessed);
        setParsedPhases(tempPhases);
        setParsedTasks(tempTasks);
        setParsedMilestones(tempMilestones);

        // Auto-expand first new project that has sub-sheets
        const firstWithSheets = finalProcessed.find(
          (p) =>
            !p.errors.some((err) => err.includes("already exists")) &&
            (tempPhases[p.name]?.length || tempTasks[p.name]?.length || tempMilestones[p.name]?.length)
        );
        if (firstWithSheets) setOpenAccordion(firstWithSheets.name);

        toast.success(`Loaded ${finalProcessed.length} projects from XLSX`);
      } catch (err) {
        console.error(err);
        setValidationError("Failed to parse XLSX file. Please ensure it is not password-protected or corrupted.");
        setParsedRows([]);
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
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (isImporting) return;
    handleReset();
    onClose();
  };

  const handleInlineChange = (index: number, field: keyof ParsedProjectRow, value: any) => {
    setParsedRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        const updated = { ...row, [field]: value };

        const rowErrors: string[] = [];
        if (!updated.name) rowErrors.push("Project name is required.");
        if (!updated.objective) rowErrors.push("Objective is required.");

        let isStartValid = false;
        if (updated.startDate) {
          if (!isNaN(Date.parse(updated.startDate))) isStartValid = true;
          else rowErrors.push("Start date must be a valid date (YYYY-MM-DD).");
        } else {
          rowErrors.push("Start date is required.");
        }

        let isEndValid = false;
        if (updated.endDate) {
          if (!isNaN(Date.parse(updated.endDate))) isEndValid = true;
          else rowErrors.push("End date must be a valid date (YYYY-MM-DD).");
        } else {
          rowErrors.push("End date is required.");
        }

        if (isStartValid && isEndValid) {
          if (new Date(updated.startDate).getTime() > new Date(updated.endDate).getTime()) {
            rowErrors.push("End date must be on or after start date.");
          }
        }

        if (!updated.resolvedDepartmentId) rowErrors.push("Department is required.");
        if (!updated.resolvedCustomerId) rowErrors.push("Customer is required.");
        if (!updated.resolvedPrimaryPmId) rowErrors.push("Primary PM is required.");

        const validEngagement = ["ManagedServices", "StaffAugmentation", "FixedPrice"];
        if (!validEngagement.includes(updated.engagementType)) {
          rowErrors.push(`Engagement Type "${updated.engagementType}" is invalid.`);
        }
        const validBilling = ["TimeAndMaterial", "FixedPrice", "Retainer"];
        if (!validBilling.includes(updated.billingModel)) {
          rowErrors.push(`Billing Model "${updated.billingModel}" is invalid.`);
        }
        const validPriority = ["Low", "Medium", "High", "Critical"];
        if (!validPriority.includes(updated.priority)) {
          rowErrors.push(`Priority "${updated.priority}" is invalid.`);
        }
        const validCurrency = ["USD", "EUR", "AED", "SAR"];
        if (!validCurrency.includes(updated.currency)) {
          rowErrors.push(`Currency "${updated.currency}" is invalid.`);
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
        const errors: string[] = [];
        if (!updated.name) errors.push("Phase name is required.");
        if (updated.startDate && isNaN(Date.parse(updated.startDate)))
          errors.push("Start date must be a valid date.");
        if (updated.endDate && isNaN(Date.parse(updated.endDate)))
          errors.push("End date must be a valid date.");
        if (
          updated.startDate && updated.endDate &&
          !isNaN(Date.parse(updated.startDate)) && !isNaN(Date.parse(updated.endDate)) &&
          new Date(updated.startDate) > new Date(updated.endDate)
        ) {
          errors.push("End date must be on or after start date.");
        }
        updated.errors = errors;
        rows[rowIndex] = updated;
        return { ...prev, [projName]: rows };
      });
    } else if (type === "tasks") {
      setParsedTasks((prev) => {
        const rows = [...(prev[projName] || [])];
        const updated = { ...rows[rowIndex], [field]: value };
        const errors: string[] = [];
        if (!updated.title) errors.push("Task title is required.");
        if (updated.startDate && isNaN(Date.parse(updated.startDate)))
          errors.push("Start date must be valid.");
        if (updated.endDate && isNaN(Date.parse(updated.endDate)))
          errors.push("End date must be valid.");
        if (
          updated.startDate && updated.endDate &&
          !isNaN(Date.parse(updated.startDate)) && !isNaN(Date.parse(updated.endDate)) &&
          new Date(updated.startDate) > new Date(updated.endDate)
        ) {
          errors.push("End date must be on or after start date.");
        }
        const validTaskStatus = ["To_Do", "In_Progress", "Submitted_for_Review", "Approved", "Rework", "Done"];
        if (!validTaskStatus.includes(updated.status))
          errors.push(`Status "${updated.status}" is invalid.`);
        const validPriority = ["Low", "Medium", "High", "Critical"];
        if (!validPriority.includes(updated.priority))
          errors.push(`Priority "${updated.priority}" is invalid.`);
        updated.errors = errors;
        rows[rowIndex] = updated;
        return { ...prev, [projName]: rows };
      });
    } else if (type === "milestones") {
      setParsedMilestones((prev) => {
        const rows = [...(prev[projName] || [])];
        const updated = { ...rows[rowIndex], [field]: value };
        const errors: string[] = [];
        if (!updated.title) errors.push("Milestone title is required.");
        if (!updated.targetDate) errors.push("Target date is required.");
        else if (isNaN(Date.parse(updated.targetDate)))
          errors.push("Target date must be valid YYYY-MM-DD.");
        updated.errors = errors;
        rows[rowIndex] = updated;
        return { ...prev, [projName]: rows };
      });
    }
  };

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

        // Create Phases
        const projectPhases = parsedPhases[projRow.name] || [];
        if (projectPhases.length > 0) {
          setImportStatusText(`Creating phases for: ${projRow.name}`);
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
                  startDate: phaseRow.startDate
                    ? new Date(phaseRow.startDate).toISOString()
                    : new Date(projRow.startDate).toISOString(),
                  endDate: phaseRow.endDate
                    ? new Date(phaseRow.endDate).toISOString()
                    : new Date(projRow.endDate).toISOString(),
                },
              }).unwrap();
              phaseNameToId[phaseRow.name.toLowerCase().trim()] = res.id;
              successPhases++;
            } catch (err) {
              console.error(`Failed to create phase "${phaseRow.name}" for "${projRow.name}":`, err);
            }
          }
        }

        // Create Tasks
        const projectTasks = parsedTasks[projRow.name] || [];
        if (projectTasks.length > 0) {
          setImportStatusText(`Creating tasks for: ${projRow.name}`);
          for (const taskRow of projectTasks) {
            if (taskRow.errors.length > 0) continue;
            try {
              const resolvedPhaseId = taskRow.phaseName
                ? phaseNameToId[taskRow.phaseName.toLowerCase().trim()] || null
                : null;

              await createTask({
                projectId,
                title: taskRow.title,
                description: taskRow.description || null,
                priority: taskRow.priority,
                status: taskRow.status,
                ownerId: null,
                phaseId: resolvedPhaseId,
                startDate: taskRow.startDate ? new Date(taskRow.startDate).toISOString() : null,
                endDate: taskRow.endDate ? new Date(taskRow.endDate).toISOString() : null,
                effortHours: taskRow.effortHours || null,
              }).unwrap();
              successTasks++;
            } catch (err) {
              console.error(`Failed to create task "${taskRow.title}" for "${projRow.name}":`, err);
            }
          }
        }

        // Create Milestones
        const projectMilestones = parsedMilestones[projRow.name] || [];
        if (projectMilestones.length > 0) {
          setImportStatusText(`Creating milestones for: ${projRow.name}`);
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
              console.error(`Failed to create milestone "${msRow.title}" for "${projRow.name}":`, err);
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
        `Import complete:\n` +
          `• ${successProjects} Projects\n` +
          `• ${successPhases} Phases\n` +
          `• ${successTasks} Tasks\n` +
          `• ${successMilestones} Milestones`
      );
      refetch();
    }
    if (failProjects > 0) {
      toast.error(`Failed to import ${failProjects} project(s).`);
    }

    setIsImporting(false);
    handleClose();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-7xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background shadow-2xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 overflow-hidden flex flex-col max-h-[90vh]">
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
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            {!file ? (
              /* Drop zone */
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
                  <p>• <strong>[Project Name] Phases:</strong> Optional — Name, Description, Order, Status, Start Date, End Date</p>
                  <p>• <strong>[Project Name] Tasks:</strong> Optional — Title, Description, Priority, Status, Phase, Start Date, End Date, Effort Hours</p>
                  <p>• <strong>[Project Name] Milestones:</strong> Optional — Title, Target Date, Weight (%), Status, Phase</p>
                </div>
              </div>
            ) : (
              /* Preview area */
              <div className="flex-1 flex flex-col gap-6">
                {/* File info bar */}
                <div className="flex items-center justify-between bg-muted/30 border border-border/40 p-4 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="size-5 text-primary" />
                    <div>
                      <p className="text-xs font-bold text-foreground truncate max-w-[200px] sm:max-w-md">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium">
                        {(file.size / 1024).toFixed(1)} KB{!validationError && ` · ${parsedRows.length} projects · ${Object.keys(parsedPhases).length} phase sheets · ${Object.keys(parsedTasks).length} task sheets · ${Object.keys(parsedMilestones).length} milestone sheets`}
                      </p>
                    </div>
                  </div>
                  {!isImporting && (
                    <Button variant="outline" size="xs" onClick={handleReset}>
                      Change File
                    </Button>
                  )}
                </div>

                {validationError ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4 border border-rose-500/20 bg-rose-500/5 rounded-2xl min-h-[300px]">
                    <AlertTriangle className="size-12 text-rose-500 animate-bounce" />
                    <div className="text-center space-y-1 max-w-md">
                      <p className="text-sm font-bold text-rose-500">Invalid Projects File</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {validationError}
                      </p>
                    </div>
                    <Button variant="outline" size="xs" onClick={handleReset} className="mt-2 border-rose-500/20 text-rose-600 hover:bg-rose-500/10 cursor-pointer">
                      Select Another File
                    </Button>
                  </div>
                ) : isImporting ? (
                  /* Progress */
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
                    {/* Projects table */}
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Core Projects Sheet
                      </h3>
                      <ProjectsPreviewTable
                        parsedRows={parsedRows}
                        departments={departments}
                        customers={customers}
                        managers={managers}
                        handleInlineChange={handleInlineChange}
                      />
                    </div>

                    {/* Phase / Task / Milestone accordions */}
                    {parsedRows.some((p) => hasExtraData(p.name)) && (
                      <div className="flex flex-col gap-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Phases, Tasks & Milestones Sheets
                        </h3>

                        <div className="space-y-3">
                          {parsedRows.map((proj) => {
                            if (!hasExtraData(proj.name)) return null;

                            const isExpanded = openAccordion === proj.name;
                            const phasesList = parsedPhases[proj.name] || [];
                            const tasksList = parsedTasks[proj.name] || [];
                            const milestonesList = parsedMilestones[proj.name] || [];
                            const activeTab =
                              activeSubTab[proj.name] ||
                              (phasesList.length > 0 ? "phases" : tasksList.length > 0 ? "tasks" : "milestones");

                            return (
                              <ProjectAccordionItem
                                key={proj.name}
                                proj={proj}
                                isExpanded={isExpanded}
                                onToggle={() =>
                                  setOpenAccordion(isExpanded ? null : proj.name)
                                }
                                phasesList={phasesList}
                                tasksList={tasksList}
                                milestonesList={milestonesList}
                                activeTab={activeTab}
                                onTabChange={(tab) =>
                                  setActiveSubTab((prev) => ({ ...prev, [proj.name]: tab }))
                                }
                                handleSubRowChange={handleSubRowChange}
                              />
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
          <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-muted/15">
            <div className="text-xs text-muted-foreground font-semibold">
              {validationError && (
                <span className="text-rose-500 font-medium">File cannot be imported due to validation errors.</span>
              )}
              {file && !validationError && !isImporting && (
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
                  disabled={validRows.length === 0 || hasActiveErrors || !!validationError}
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
