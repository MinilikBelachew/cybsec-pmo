"use client";

import React, { useState, useRef, useMemo } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "react-hot-toast";
import {
  useGetDepartmentsQuery,
  useGetCustomersQuery,
  useGetProjectManagersQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useLazyGetPhasesQuery,
  useCreatePhaseMutation,
  useUpdatePhaseMutation,
  useCreateMilestoneMutation,
  useUpdateMilestoneMutation,
  useLazyGetMilestonesQuery,
  useLazyGetProjectTaskAssigneesQuery,
  useLazyExportProjectsQuery,
} from "../../api/projects.api";
import { useCreateTaskMutation, useUpdateTaskMutation, useLazyGetTasksQuery } from "../../api/tasks.api";
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
  resolveProjectImportMatch,
  resolvePhaseImportMatch,
  resolveMilestoneImportMatch,
  revalidateParsedTaskRow,
} from "../../utils/import-export";
import type { ProjectPhase, ProjectTaskAssignee } from "../../types/projects.types";
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
  /** Fallback when full export catalog cannot be loaded */
  existingProjects?: { id: string; name: string }[];
}

type ProjectNestedMeta = {
  phases: ProjectPhase[];
  assignees: ProjectTaskAssignee[];
  existingTasks: { id: string; title: string }[];
  existingPhases: { id: string; name: string }[];
  existingMilestones: { id: string; title: string }[];
};

export function ImportProjectsDialog({
  open,
  onClose,
  refetch,
  existingProjects = [],
}: ImportProjectsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProjectRow[]>([]);
  const [parsedPhases, setParsedPhases] = useState<Record<string, ParsedPhaseRow[]>>({});
  const [parsedTasks, setParsedTasks] = useState<Record<string, ParsedTaskRow[]>>({});
  const [parsedMilestones, setParsedMilestones] = useState<Record<string, ParsedMilestoneRow[]>>({});
  const [projectMatchCatalog, setProjectMatchCatalog] = useState<{ id: string; name: string }[]>([]);
  const [nestedMetaByProject, setNestedMetaByProject] = useState<Record<string, ProjectNestedMeta>>({});

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
  const [updateProject] = useUpdateProjectMutation();
  const [triggerExportProjects] = useLazyExportProjectsQuery();
  const [triggerGetPhases] = useLazyGetPhasesQuery();
  const [createPhase] = useCreatePhaseMutation();
  const [updatePhase] = useUpdatePhaseMutation();
  const [createMilestone] = useCreateMilestoneMutation();
  const [updateMilestone] = useUpdateMilestoneMutation();
  const [triggerGetMilestones] = useLazyGetMilestonesQuery();
  const [triggerGetAssignees] = useLazyGetProjectTaskAssigneesQuery();
  const [createTask] = useCreateTaskMutation();
  const [updateTask] = useUpdateTaskMutation();
  const [triggerGetTasks] = useLazyGetTasksQuery();

  const hasExtraData = (projName: string) =>
    (parsedPhases[projName]?.length || 0) > 0 ||
    (parsedTasks[projName]?.length || 0) > 0 ||
    (parsedMilestones[projName]?.length || 0) > 0;

  const validRows = useMemo(
    () => parsedRows.filter((r) => r.errors.length === 0),
    [parsedRows]
  );

  const nestedErrorCount = useMemo(() => {
    let count = 0;
    for (const proj of validRows) {
      count += parsedPhases[proj.name]?.filter((r) => r.errors.length > 0).length || 0;
      count += parsedTasks[proj.name]?.filter((r) => r.errors.length > 0).length || 0;
      count += parsedMilestones[proj.name]?.filter((r) => r.errors.length > 0).length || 0;
    }
    return count;
  }, [validRows, parsedPhases, parsedTasks, parsedMilestones]);

  const hasActiveErrors = nestedErrorCount > 0;

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

        // Prefer full portfolio catalog so matches are not limited to the current list page
        let matchCatalog = existingProjects;
        try {
          const allProjects = await triggerExportProjects({}).unwrap();
          matchCatalog = allProjects.map((p) => ({ id: p.id, name: p.name }));
        } catch (err) {
          console.error("Failed to load full project catalog for import matching:", err);
        }
        setProjectMatchCatalog(matchCatalog);

        const processed = processRawCSVRows(projectsData, departments, customers, managers, matchCatalog);

        const existingSet = new Set(matchCatalog.map((p) => p.name.trim().toLowerCase()));
        const finalProcessed = processed.map((row) => {
          if (row.importMode === "update") return row;
          const lowerName = row.name.trim().toLowerCase();
          if (lowerName && existingSet.has(lowerName)) {
            return { ...row, errors: [...row.errors, `Project "${row.name}" already exists.`] };
          }
          return row;
        });

        const tempPhases: Record<string, ParsedPhaseRow[]> = {};
        const tempTasks: Record<string, ParsedTaskRow[]> = {};
        const tempMilestones: Record<string, ParsedMilestoneRow[]> = {};
        const tempNestedMeta: Record<string, ProjectNestedMeta> = {};

        for (const projRow of finalProcessed) {
          const projName = projRow.name.trim();
          if (!projName) continue;

          const phaseSheetName = `${projName} Phases`;
          const taskSheetName = `${projName} Tasks`;
          const msSheetName = `${projName} Milestones`;
          const hasPhaseSheet = sheetNames.includes(phaseSheetName);
          const hasTaskSheet = sheetNames.includes(taskSheetName);
          const hasMsSheet = sheetNames.includes(msSheetName);

          let existingTasks: { id: string; title: string }[] = [];
          let phasesForProject: ProjectPhase[] = [];
          let assigneesForProject: ProjectTaskAssignee[] = [];
          let existingPhases: { id: string; name: string }[] = [];
          let existingMilestones: { id: string; title: string }[] = [];

          if (
            projRow.importMode === "update" &&
            projRow.resolvedProjectId &&
            (hasPhaseSheet || hasTaskSheet || hasMsSheet)
          ) {
            const projectId = projRow.resolvedProjectId;
            const [tasksResult, phasesResult, assigneesResult, milestonesResult] =
              await Promise.allSettled([
                hasTaskSheet
                  ? triggerGetTasks({ projectId, limit: 1000, topLevelOnly: false }).unwrap()
                  : Promise.resolve(null),
                hasPhaseSheet || hasTaskSheet
                  ? triggerGetPhases(projectId).unwrap()
                  : Promise.resolve(null),
                hasTaskSheet ? triggerGetAssignees(projectId).unwrap() : Promise.resolve(null),
                hasMsSheet ? triggerGetMilestones(projectId).unwrap() : Promise.resolve(null),
              ]);

            if (tasksResult.status === "fulfilled" && tasksResult.value) {
              existingTasks = tasksResult.value.data.map((t) => ({ id: t.id, title: t.title }));
            } else if (tasksResult.status === "rejected") {
              console.error("Failed to fetch existing tasks for preview:", tasksResult.reason);
            }
            if (phasesResult.status === "fulfilled" && phasesResult.value) {
              phasesForProject = phasesResult.value;
              existingPhases = phasesResult.value.map((p) => ({ id: p.id, name: p.name }));
            } else if (phasesResult.status === "rejected") {
              console.error("Failed to fetch existing phases for preview:", phasesResult.reason);
            }
            if (assigneesResult.status === "fulfilled" && assigneesResult.value) {
              assigneesForProject = assigneesResult.value;
            } else if (assigneesResult.status === "rejected") {
              console.error("Failed to fetch assignees for preview:", assigneesResult.reason);
            }
            if (milestonesResult.status === "fulfilled" && milestonesResult.value) {
              existingMilestones = milestonesResult.value.map((m) => ({
                id: m.id,
                title: m.title,
              }));
            } else if (milestonesResult.status === "rejected") {
              console.error("Failed to fetch existing milestones for preview:", milestonesResult.reason);
            }
          }

          if (hasPhaseSheet || hasTaskSheet || hasMsSheet) {
            tempNestedMeta[projName] = {
              phases: phasesForProject,
              assignees: assigneesForProject,
              existingTasks,
              existingPhases,
              existingMilestones,
            };
          }

          if (hasPhaseSheet) {
            const raw = parseXLSXSheet(buffer, phaseSheetName, true);
            if (raw.length > 1) tempPhases[projName] = processRawPhaseRows(raw, existingPhases);
          }

          if (hasTaskSheet) {
            const raw = parseXLSXSheet(buffer, taskSheetName, true);
            if (raw.length > 1) {
              tempTasks[projName] = processRawTaskCSVRows(
                raw,
                phasesForProject,
                assigneesForProject,
                existingTasks,
              );
            }
          }

          if (hasMsSheet) {
            const raw = parseXLSXSheet(buffer, msSheetName, true);
            if (raw.length > 1) {
              tempMilestones[projName] = processRawMilestoneRows(raw, existingMilestones);
            }
          }
        }

        setParsedRows(finalProcessed);
        setParsedPhases(tempPhases);
        setParsedTasks(tempTasks);
        setParsedMilestones(tempMilestones);
        setNestedMetaByProject(tempNestedMeta);

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
        setParsedPhases({});
        setParsedTasks({});
        setParsedMilestones({});
        setProjectMatchCatalog([]);
        setNestedMetaByProject({});
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
    setProjectMatchCatalog([]);
    setNestedMetaByProject({});
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
    setParsedRows((prev) => {
      const duplicateNames = new Set(
        prev
          .map((row) => row.name.trim().toLowerCase())
          .filter((name, nameIndex, all) => name && all.indexOf(name) !== nameIndex),
      );

      return prev.map((row, idx) => {
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
        if (lowerName && duplicateNames.has(lowerName)) {
          rowErrors.push(`Duplicate project name "${updated.name}" found in this file.`);
        }

        const match = resolveProjectImportMatch(updated.name, projectMatchCatalog);
        if (match.importMode !== "update" && lowerName) {
          const existingSet = new Set(projectMatchCatalog.map((p) => p.name.trim().toLowerCase()));
          if (existingSet.has(lowerName)) {
            rowErrors.push(`Project "${updated.name}" already exists.`);
          }
        }

        return {
          ...updated,
          importMode: match.importMode,
          resolvedProjectId: match.resolvedProjectId,
          errors: rowErrors,
        };
      });
    });
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
        const match = resolvePhaseImportMatch(
          updated.name,
          nestedMetaByProject[projName]?.existingPhases,
        );
        rows[rowIndex] = {
          ...updated,
          importMode: match.importMode,
          resolvedPhaseId: match.resolvedPhaseId,
          errors,
        };
        return { ...prev, [projName]: rows };
      });
    } else if (type === "tasks") {
      setParsedTasks((prev) => {
        const rows = [...(prev[projName] || [])];
        const updated = { ...rows[rowIndex], [field]: value };
        const meta = nestedMetaByProject[projName] || {
          phases: [],
          assignees: [],
          existingTasks: [],
          existingPhases: [],
          existingMilestones: [],
        };
        const duplicateTitles = new Set(
          rows
            .map((row, idx) =>
              idx === rowIndex ? updated.title.trim().toLowerCase() : row.title.trim().toLowerCase(),
            )
            .filter((title, titleIndex, all) => title && all.indexOf(title) !== titleIndex),
        );
        rows[rowIndex] = revalidateParsedTaskRow(
          updated,
          meta.phases,
          meta.assignees,
          duplicateTitles,
          meta.existingTasks,
        );
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
        const match = resolveMilestoneImportMatch(
          updated.title,
          nestedMetaByProject[projName]?.existingMilestones,
        );
        rows[rowIndex] = {
          ...updated,
          importMode: match.importMode,
          resolvedMilestoneId: match.resolvedMilestoneId,
          errors,
        };
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
    let successCreated = 0;
    let successUpdated = 0;
    let failProjects = 0;
    let successPhases = 0;
    let successTasksCreated = 0;
    let successTasksUpdated = 0;
    let successMilestones = 0;

    for (let i = 0; i < validRows.length; i++) {
      const projRow = validRows[i];
      const isUpdate = projRow.importMode === "update" && projRow.resolvedProjectId;
      setImportStatusText(`${isUpdate ? "Updating" : "Creating"} project: ${projRow.name}`);
      setImportProgress(Math.round((i / validRows.length) * 100));

      try {
        let projectId: string;

        if (isUpdate) {
          // Update existing project
          await updateProject({
            id: projRow.resolvedProjectId!,
            body: {
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
              status: projRow.status as any,
            },
          }).unwrap();
          projectId = projRow.resolvedProjectId!;
          successUpdated++;
        } else {
          // Create new project
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
            status: (projRow.status as any) || "Draft",
          }).unwrap();
          projectId = projectResult.id;
          successCreated++;
        }

        const phaseNameToId: Record<string, string> = {};

        // Fetch existing phases for update mode
        if (isUpdate) {
          try {
            const existingPhases = await triggerGetPhases(projectId).unwrap();
            for (const phase of existingPhases) {
              phaseNameToId[phase.name.toLowerCase().trim()] = phase.id;
            }
          } catch (err) {
            console.error("Failed to fetch existing phases:", err);
          }
        }

        // Create or update Phases
        const projectPhases = parsedPhases[projRow.name] || [];
        if (projectPhases.length > 0) {
          setImportStatusText(`${isUpdate ? "Updating" : "Creating"} phases for: ${projRow.name}`);
          for (const phaseRow of projectPhases) {
            if (phaseRow.errors.length > 0) continue;
            const phaseKey = phaseRow.name.toLowerCase().trim();
            const existingPhaseId =
              phaseRow.resolvedPhaseId || phaseNameToId[phaseKey];
            const phaseBody = {
              name: phaseRow.name,
              description: phaseRow.description || undefined,
              orderIndex: phaseRow.orderIndex,
              status: phaseRow.status as any,
              startDate: phaseRow.startDate
                ? new Date(phaseRow.startDate).toISOString()
                : new Date(projRow.startDate).toISOString(),
              endDate: phaseRow.endDate
                ? new Date(phaseRow.endDate).toISOString()
                : new Date(projRow.endDate).toISOString(),
            };
            try {
              if (existingPhaseId) {
                await updatePhase({
                  projectId,
                  phaseId: existingPhaseId,
                  body: phaseBody,
                }).unwrap();
                phaseNameToId[phaseKey] = existingPhaseId;
              } else {
                const res = await createPhase({
                  projectId,
                  body: phaseBody,
                }).unwrap();
                phaseNameToId[phaseKey] = res.id;
              }
              successPhases++;
            } catch (err) {
              console.error(`Failed to import phase "${phaseRow.name}" for "${projRow.name}":`, err);
            }
          }
        }

        const projectTasks = parsedTasks[projRow.name] || [];

        // If tasks exist but we have no phases resolved, auto-create a "General Phase"
        if (projectTasks.length > 0 && Object.keys(phaseNameToId).length === 0) {
          try {
            setImportStatusText(`Creating default phase for: ${projRow.name}`);
            const defaultPhaseRes = await createPhase({
              projectId,
              body: {
                name: "General Phase",
                description: "Default phase for imported tasks",
                orderIndex: 0,
                status: "Active" as any,
                startDate: new Date(projRow.startDate).toISOString(),
                endDate: new Date(projRow.endDate).toISOString(),
              },
            }).unwrap();
            phaseNameToId["general phase"] = defaultPhaseRes.id;
            successPhases++;
          } catch (err) {
            console.error(`Failed to create default phase for "${projRow.name}":`, err);
          }
        }

        // Resolve existing tasks + assignees for matching
        let existingProjectTasks: { id: string; title: string }[] = [];
        let projectAssignees: ProjectTaskAssignee[] = [];
        if (isUpdate) {
          const [tasksResult, assigneesResult] = await Promise.allSettled([
            triggerGetTasks({ projectId, limit: 1000, topLevelOnly: false }).unwrap(),
            triggerGetAssignees(projectId).unwrap(),
          ]);
          if (tasksResult.status === "fulfilled") {
            existingProjectTasks = tasksResult.value.data.map((t) => ({ id: t.id, title: t.title }));
          } else {
            console.error("Failed to fetch existing tasks:", tasksResult.reason);
          }
          if (assigneesResult.status === "fulfilled") {
            projectAssignees = assigneesResult.value;
          } else {
            console.error("Failed to fetch assignees:", assigneesResult.reason);
          }
        }

        const existingTaskMap = new Map<string, string>();
        for (const t of existingProjectTasks) {
          existingTaskMap.set(t.title.trim().toLowerCase(), t.id);
        }

        const resolveOwnerId = (taskRow: ParsedTaskRow): string | undefined => {
          if (taskRow.resolvedAssigneeId) {
            const stillOnTeam = projectAssignees.some((a) => a.userId === taskRow.resolvedAssigneeId);
            if (stillOnTeam || projectAssignees.length === 0) return taskRow.resolvedAssigneeId;
          }
          if (!taskRow.assigneeName || projectAssignees.length === 0) return undefined;
          const normalized = taskRow.assigneeName.toLowerCase().trim();
          const match = projectAssignees.find(
            (a) =>
              a.displayName.toLowerCase() === normalized ||
              a.email.toLowerCase() === normalized ||
              a.name.toLowerCase() === normalized,
          );
          return match?.userId;
        };

        // Create/Update Tasks
        if (projectTasks.length > 0) {
          setImportStatusText(`Importing tasks for: ${projRow.name}`);
          for (const taskRow of projectTasks) {
            if (taskRow.errors.length > 0) continue;
            try {
              let resolvedPhaseId = taskRow.phaseName
                ? phaseNameToId[taskRow.phaseName.toLowerCase().trim()]
                : taskRow.resolvedPhaseId || undefined;

              // Fallback to first available phase ID if none is resolved (since phaseId is required)
              if (!resolvedPhaseId) {
                const phaseIds = Object.values(phaseNameToId);
                if (phaseIds.length > 0) {
                  resolvedPhaseId = phaseIds[0];
                }
              }

              const lowerTitle = taskRow.title.trim().toLowerCase();
              const resolvedTaskId =
                taskRow.resolvedTaskId ||
                (lowerTitle ? existingTaskMap.get(lowerTitle) : undefined);
              const ownerId = resolveOwnerId(taskRow);

              if (resolvedTaskId) {
                await updateTask({
                  id: resolvedTaskId,
                  body: {
                    title: taskRow.title,
                    description: taskRow.description || undefined,
                    priority: taskRow.priority,
                    status: taskRow.status,
                    ownerId,
                    phaseId: resolvedPhaseId,
                    startDate: taskRow.startDate ? new Date(taskRow.startDate).toISOString() : undefined,
                    endDate: taskRow.endDate ? new Date(taskRow.endDate).toISOString() : undefined,
                    effortHours: taskRow.effortHours || undefined,
                  },
                }).unwrap();
                successTasksUpdated++;
              } else {
                await createTask({
                  projectId,
                  title: taskRow.title,
                  description: taskRow.description || undefined,
                  priority: taskRow.priority,
                  status: taskRow.status,
                  ownerId,
                  phaseId: resolvedPhaseId,
                  startDate: taskRow.startDate ? new Date(taskRow.startDate).toISOString() : undefined,
                  endDate: taskRow.endDate ? new Date(taskRow.endDate).toISOString() : undefined,
                  effortHours: taskRow.effortHours || undefined,
                }).unwrap();
                successTasksCreated++;
              }
            } catch (err) {
              console.error(`Failed to import task "${taskRow.title}" for "${projRow.name}":`, err);
            }
          }
        }

        // Create or update Milestones
        const projectMilestones = parsedMilestones[projRow.name] || [];
        if (projectMilestones.length > 0) {
          setImportStatusText(`${isUpdate ? "Updating" : "Creating"} milestones for: ${projRow.name}`);
          const existingMilestoneMap = new Map<string, string>();
          if (isUpdate) {
            try {
              const existingMilestones = await triggerGetMilestones(projectId).unwrap();
              for (const ms of existingMilestones) {
                existingMilestoneMap.set(ms.title.trim().toLowerCase(), ms.id);
              }
            } catch (err) {
              console.error("Failed to fetch existing milestones:", err);
            }
          }

          for (const msRow of projectMilestones) {
            if (msRow.errors.length > 0) continue;
            try {
              let resolvedPhaseId = msRow.phaseName
                ? phaseNameToId[msRow.phaseName.toLowerCase().trim()]
                : undefined;

              if (!resolvedPhaseId && msRow.phaseName) {
                const phaseIds = Object.values(phaseNameToId);
                if (phaseIds.length > 0) {
                  resolvedPhaseId = phaseIds[0];
                }
              }

              const msBody = {
                title: msRow.title,
                targetDate: new Date(msRow.targetDate).toISOString(),
                weight: msRow.weight || 0,
                status: msRow.status,
                phaseId: resolvedPhaseId,
              };
              const existingMilestoneId =
                msRow.resolvedMilestoneId ||
                existingMilestoneMap.get(msRow.title.trim().toLowerCase());

              if (existingMilestoneId) {
                await updateMilestone({
                  projectId,
                  milestoneId: existingMilestoneId,
                  body: msBody,
                }).unwrap();
              } else {
                await createMilestone({
                  projectId,
                  body: msBody,
                }).unwrap();
              }
              successMilestones++;
            } catch (err) {
              console.error(`Failed to import milestone "${msRow.title}" for "${projRow.name}":`, err);
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

    const totalSuccess = successCreated + successUpdated;
    if (totalSuccess > 0) {
      const parts = [];
      if (successCreated > 0) parts.push(`${successCreated} created`);
      if (successUpdated > 0) parts.push(`${successUpdated} updated`);
      const taskParts = [];
      if (successTasksCreated > 0) taskParts.push(`${successTasksCreated} created`);
      if (successTasksUpdated > 0) taskParts.push(`${successTasksUpdated} updated`);
      const taskSummary = taskParts.length > 0 ? taskParts.join(", ") : "0";

      toast.success(
        `Import complete:\n` +
          `• Projects: ${parts.join(", ")}\n` +
          `• ${successPhases} Phases\n` +
          `• Tasks: ${taskSummary}\n` +
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
                    <span className="text-amber-600 dark:text-amber-400 ml-1 font-medium">
                      ({nestedErrorCount} nested row{nestedErrorCount === 1 ? "" : "s"} with errors will be skipped)
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
                  disabled={validRows.length === 0 || !!validationError}
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
