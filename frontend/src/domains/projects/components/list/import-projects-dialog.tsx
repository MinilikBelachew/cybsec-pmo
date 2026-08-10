"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "react-hot-toast";
import {
  useGetDepartmentsQuery,
  useGetCustomersQuery,
  useGetProjectManagersQuery,
} from "../../api/projects.api";
import {
  isImportQueueFullError,
  importQueueFullMax,
  usePreviewExcelProjectsImportMutation,
  useLazyPageExcelProjectsPreviewQuery,
  usePatchExcelProjectsPreviewRowMutation,
  useConfirmExcelProjectsImportMutation,
} from "../../api/imports.api";
import { useImportProgress } from "../import/import-progress-provider";
import {
  ParsedProjectRow,
  generateProjectsXLSXTemplate,
  ParsedPhaseRow,
  ParsedTaskRow,
  ParsedMilestoneRow,
  resolveProjectImportMatch,
  resolvePhaseImportMatch,
  resolveMilestoneImportMatch,
  revalidateParsedTaskRow,
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
  Minimize2,
} from "lucide-react";

import { ProjectsPreviewTable } from "./projects-preview-table";
import { ProjectAccordionItem } from "./project-accordion-item";

const PAGE_LIMIT = 50;

interface ImportProjectsDialogProps {
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  /** Kept for callers; matching is handled server-side on preview. */
  existingProjects?: { id: string; name: string }[];
}

type NestedCounts = { phases: number; tasks: number; milestones: number };
type NestedHasMore = { phases?: boolean; tasks?: boolean; milestones?: boolean };
type PreviewCounts = {
  projectsTotal: number;
  projectsValid: number;
  phasesTotal: number;
  tasksTotal: number;
  milestonesTotal: number;
};

function revalidateProjectRow(
  row: ParsedProjectRow,
  allRows: ParsedProjectRow[],
): ParsedProjectRow {
  const projectMatchCatalog: { id: string; name: string }[] = [];
  const duplicateNames = new Set(
    allRows
      .map((r) => r.name.trim().toLowerCase())
      .filter((name, nameIndex, all) => name && all.indexOf(name) !== nameIndex),
  );

  const updated = { ...row };
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

  return {
    ...updated,
    importMode: match.importMode,
    resolvedProjectId: match.resolvedProjectId ?? updated.resolvedProjectId,
    errors: rowErrors,
  };
}

export function ImportProjectsDialog({
  open,
  onClose,
  refetch,
}: ImportProjectsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [counts, setCounts] = useState<PreviewCounts | null>(null);
  const [nestedCounts, setNestedCounts] = useState<Record<string, NestedCounts>>({});
  const [parsedRows, setParsedRows] = useState<ParsedProjectRow[]>([]);
  const [projectsHasMore, setProjectsHasMore] = useState(false);
  const [projectsTotal, setProjectsTotal] = useState(0);
  const [parsedPhases, setParsedPhases] = useState<Record<string, ParsedPhaseRow[]>>({});
  const [parsedTasks, setParsedTasks] = useState<Record<string, ParsedTaskRow[]>>({});
  const [parsedMilestones, setParsedMilestones] = useState<
    Record<string, ParsedMilestoneRow[]>
  >({});
  const [nestedHasMore, setNestedHasMore] = useState<Record<string, NestedHasMore>>({});

  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState("");
  const [loadingMoreProjects, setLoadingMoreProjects] = useState(false);
  const [loadingNested, setLoadingNested] = useState(false);

  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<
    Record<string, "phases" | "tasks" | "milestones">
  >({});
  const [validationError, setValidationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nestedLoadInflight = useRef<Set<string>>(new Set());

  const { data: departments = [] } = useGetDepartmentsQuery();
  const { data: customers = [] } = useGetCustomersQuery();
  const { data: managers = [] } = useGetProjectManagersQuery();

  const [previewExcelProjectsImport] = usePreviewExcelProjectsImportMutation();
  const [pageExcelProjectsPreview] = useLazyPageExcelProjectsPreviewQuery();
  const [patchExcelProjectsPreviewRow] = usePatchExcelProjectsPreviewRowMutation();
  const [confirmExcelProjectsImport] = useConfirmExcelProjectsImportMutation();
  const { trackImport, trackQueuedImport, showQueueFull } = useImportProgress();

  const hasExtraData = useCallback(
    (projName: string) => {
      const nc = nestedCounts[projName];
      if (!nc) return false;
      return nc.phases > 0 || nc.tasks > 0 || nc.milestones > 0;
    },
    [nestedCounts],
  );

  const validRows = useMemo(
    () => parsedRows.filter((r) => r.errors.length === 0),
    [parsedRows],
  );

  const nestedErrorCount = useMemo(() => {
    let count = 0;
    for (const proj of validRows) {
      count += parsedPhases[proj.name]?.filter((r) => r.errors.length > 0).length || 0;
      count += parsedTasks[proj.name]?.filter((r) => r.errors.length > 0).length || 0;
      count +=
        parsedMilestones[proj.name]?.filter((r) => r.errors.length > 0).length || 0;
    }
    return count;
  }, [validRows, parsedPhases, parsedTasks, parsedMilestones]);

  const hasActiveErrors = nestedErrorCount > 0;

  const defaultTabForProject = useCallback(
    (projName: string): "phases" | "tasks" | "milestones" => {
      const nc = nestedCounts[projName];
      if (nc?.phases > 0) return "phases";
      if (nc?.tasks > 0) return "tasks";
      return "milestones";
    },
    [nestedCounts],
  );

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

  const loadNestedPages = useCallback(
    async (projName: string, entities: Array<"phases" | "tasks" | "milestones">) => {
      if (!previewId || entities.length === 0) return;

      setLoadingNested(true);
      try {
        const results = await Promise.all(
          entities.map(async (entity) => {
            const currentLen =
              entity === "phases"
                ? parsedPhases[projName]?.length ?? 0
                : entity === "tasks"
                  ? parsedTasks[projName]?.length ?? 0
                  : parsedMilestones[projName]?.length ?? 0;

            const page = await pageExcelProjectsPreview({
              previewId,
              entity,
              projectName: projName,
              offset: currentLen,
              limit: PAGE_LIMIT,
            }).unwrap();

            return { entity, page };
          }),
        );

        for (const { entity, page } of results) {
          const rows = page.rows;
          if (entity === "phases") {
            setParsedPhases((prev) => ({
              ...prev,
              [projName]: [
                ...(prev[projName] || []),
                ...(rows as ParsedPhaseRow[]),
              ],
            }));
          } else if (entity === "tasks") {
            setParsedTasks((prev) => ({
              ...prev,
              [projName]: [
                ...(prev[projName] || []),
                ...(rows as ParsedTaskRow[]),
              ],
            }));
          } else {
            setParsedMilestones((prev) => ({
              ...prev,
              [projName]: [
                ...(prev[projName] || []),
                ...(rows as ParsedMilestoneRow[]),
              ],
            }));
          }

          setNestedHasMore((prev) => ({
            ...prev,
            [projName]: {
              ...prev[projName],
              [entity]: page.hasMore,
            },
          }));
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load nested preview rows.");
      } finally {
        setLoadingNested(false);
      }
    },
    [
      previewId,
      pageExcelProjectsPreview,
      parsedPhases,
      parsedTasks,
      parsedMilestones,
    ],
  );

  const ensureNestedLoaded = useCallback(
    async (projName: string) => {
      const nc = nestedCounts[projName];
      if (!nc || !previewId) return;

      const toFetch: Array<"phases" | "tasks" | "milestones"> = [];
      if (nc.phases > 0 && !(projName in parsedPhases) && !nestedLoadInflight.current.has(`${projName}:phases`)) {
        toFetch.push("phases");
      }
      if (nc.tasks > 0 && !(projName in parsedTasks) && !nestedLoadInflight.current.has(`${projName}:tasks`)) {
        toFetch.push("tasks");
      }
      if (
        nc.milestones > 0 &&
        !(projName in parsedMilestones) &&
        !nestedLoadInflight.current.has(`${projName}:milestones`)
      ) {
        toFetch.push("milestones");
      }

      if (toFetch.length === 0) return;

      for (const entity of toFetch) {
        nestedLoadInflight.current.add(`${projName}:${entity}`);
      }

      setLoadingNested(true);
      try {
        const results = await Promise.all(
          toFetch.map(async (entity) => {
            const page = await pageExcelProjectsPreview({
              previewId,
              entity,
              projectName: projName,
              offset: 0,
              limit: PAGE_LIMIT,
            }).unwrap();
            return { entity, page };
          }),
        );

        for (const { entity, page } of results) {
          const rows = page.rows;
          if (entity === "phases") {
            setParsedPhases((prev) => ({
              ...prev,
              [projName]: rows as ParsedPhaseRow[],
            }));
          } else if (entity === "tasks") {
            setParsedTasks((prev) => ({
              ...prev,
              [projName]: rows as ParsedTaskRow[],
            }));
          } else {
            setParsedMilestones((prev) => ({
              ...prev,
              [projName]: rows as ParsedMilestoneRow[],
            }));
          }

          setNestedHasMore((prev) => ({
            ...prev,
            [projName]: {
              ...prev[projName],
              [entity]: page.hasMore,
            },
          }));
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load nested preview rows.");
      } finally {
        for (const entity of toFetch) {
          nestedLoadInflight.current.delete(`${projName}:${entity}`);
        }
        setLoadingNested(false);
      }
    },
    [
      nestedCounts,
      previewId,
      parsedPhases,
      parsedTasks,
      parsedMilestones,
      pageExcelProjectsPreview,
    ],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".xlsx")) {
      toast.error("Please upload a valid Excel (.xlsx) file.");
      return;
    }

    setFile(selectedFile);
    setPreviewId(null);
    setCounts(null);
    setNestedCounts({});
    setParsedRows([]);
    setProjectsHasMore(false);
    setProjectsTotal(0);
    setParsedPhases({});
    setParsedTasks({});
    setParsedMilestones({});
    setNestedHasMore({});
    setOpenAccordion(null);
    setActiveSubTab({});
    setValidationError(null);
    setIsParsing(true);

    try {
      const result = await previewExcelProjectsImport({ file: selectedFile }).unwrap();

      const projects = result.projects as ParsedProjectRow[];
      setPreviewId(result.previewId);
      setCounts(result.counts);
      setNestedCounts(result.nestedCounts);
      setParsedRows(projects);
      setProjectsHasMore(result.hasMore);
      setProjectsTotal(result.projectsTotal);

      const firstWithNested = projects.find((p) => {
        const nc = result.nestedCounts[p.name];
        return nc && (nc.phases > 0 || nc.tasks > 0 || nc.milestones > 0);
      });
      if (firstWithNested) {
        setOpenAccordion(firstWithNested.name);
        const nc = result.nestedCounts[firstWithNested.name];
        const tab =
          nc.phases > 0 ? "phases" : nc.tasks > 0 ? "tasks" : "milestones";
        setActiveSubTab((prev) => ({ ...prev, [firstWithNested.name]: tab }));

        // Fetch nested first pages for the auto-expanded project
        const toFetch: Array<"phases" | "tasks" | "milestones"> = [];
        if (nc.phases > 0) toFetch.push("phases");
        if (nc.tasks > 0) toFetch.push("tasks");
        if (nc.milestones > 0) toFetch.push("milestones");

        if (toFetch.length > 0) {
          setLoadingNested(true);
          try {
            const nestedResults = await Promise.all(
              toFetch.map(async (entity) => {
                const page = await pageExcelProjectsPreview({
                  previewId: result.previewId,
                  entity,
                  projectName: firstWithNested.name,
                  offset: 0,
                  limit: PAGE_LIMIT,
                }).unwrap();
                return { entity, page };
              }),
            );

            const phases: ParsedPhaseRow[] = [];
            const tasks: ParsedTaskRow[] = [];
            const milestones: ParsedMilestoneRow[] = [];
            const hasMoreFlags: NestedHasMore = {};

            for (const { entity, page } of nestedResults) {
              if (entity === "phases") {
                phases.push(...(page.rows as ParsedPhaseRow[]));
                hasMoreFlags.phases = page.hasMore;
              } else if (entity === "tasks") {
                tasks.push(...(page.rows as ParsedTaskRow[]));
                hasMoreFlags.tasks = page.hasMore;
              } else {
                milestones.push(...(page.rows as ParsedMilestoneRow[]));
                hasMoreFlags.milestones = page.hasMore;
              }
            }

            setParsedPhases({ [firstWithNested.name]: phases });
            setParsedTasks({ [firstWithNested.name]: tasks });
            setParsedMilestones({ [firstWithNested.name]: milestones });
            setNestedHasMore({ [firstWithNested.name]: hasMoreFlags });
          } catch (err) {
            console.error(err);
            toast.error("Failed to load nested preview rows.");
          } finally {
            setLoadingNested(false);
          }
        }
      }

      toast.success(`Loaded ${result.counts.projectsTotal} projects from XLSX`);
    } catch (err) {
      console.error(err);
      const message =
        err && typeof err === "object" && "data" in err
          ? String(
              (err as { data?: { message?: string } }).data?.message ||
                "Failed to preview XLSX file.",
            )
          : err instanceof Error
            ? err.message
            : "Failed to preview XLSX file. Please ensure it is not password-protected or corrupted.";
      setValidationError(message);
      setParsedRows([]);
      setPreviewId(null);
      setCounts(null);
      setNestedCounts({});
    } finally {
      setIsParsing(false);
    }
  };

  const handleLoadMoreProjects = async () => {
    if (!previewId || loadingMoreProjects || !projectsHasMore) return;
    setLoadingMoreProjects(true);
    try {
      const page = await pageExcelProjectsPreview({
        previewId,
        entity: "projects",
        offset: parsedRows.length,
        limit: PAGE_LIMIT,
      }).unwrap();
      setParsedRows((prev) => [...prev, ...(page.rows as ParsedProjectRow[])]);
      setProjectsHasMore(page.hasMore);
      setProjectsTotal(page.total);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load more projects.");
    } finally {
      setLoadingMoreProjects(false);
    }
  };

  const handleToggleAccordion = async (projName: string) => {
    const isExpanded = openAccordion === projName;
    if (isExpanded) {
      setOpenAccordion(null);
      return;
    }
    setOpenAccordion(projName);
    if (!activeSubTab[projName]) {
      setActiveSubTab((prev) => ({
        ...prev,
        [projName]: defaultTabForProject(projName),
      }));
    }
    await ensureNestedLoaded(projName);
  };

  const handleLoadMoreNested = async (projName: string) => {
    const tab = activeSubTab[projName] || defaultTabForProject(projName);
    const hasMore = nestedHasMore[projName]?.[tab];
    if (!hasMore) return;
    await loadNestedPages(projName, [tab]);
  };

  const handleReset = () => {
    setFile(null);
    setPreviewId(null);
    setCounts(null);
    setNestedCounts({});
    setParsedRows([]);
    setProjectsHasMore(false);
    setProjectsTotal(0);
    setParsedPhases({});
    setParsedTasks({});
    setParsedMilestones({});
    setNestedHasMore({});
    setOpenAccordion(null);
    setActiveSubTab({});
    setImportProgress(0);
    setImportStatusText("");
    setIsParsing(false);
    setIsImporting(false);
    setLoadingMoreProjects(false);
    setLoadingNested(false);
    nestedLoadInflight.current.clear();
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (isParsing) return;
    setIsImporting(false);
    handleReset();
    onClose();
  };

  const handleInlineChange = (index: number, field: keyof ParsedProjectRow, value: any) => {
    setParsedRows((prev) => {
      const next = prev.map((row, idx) => {
        if (idx !== index) return row;
        return revalidateProjectRow({ ...row, [field]: value }, prev);
      });

      const updatedRow = next[index];
      if (previewId && updatedRow) {
        void patchExcelProjectsPreviewRow({
          previewId,
          entity: "projects",
          index,
          patch: updatedRow as unknown as Record<string, unknown>,
        });
      }

      return next;
    });
  };

  const handleSubRowChange = (
    projName: string,
    type: "phases" | "tasks" | "milestones",
    rowIndex: number,
    field: string,
    value: any,
  ) => {
    if (type === "phases") {
      setParsedPhases((prev) => {
        const rows = [...(prev[projName] || [])];
        const updated = { ...rows[rowIndex], [field]: value };
        const errors: string[] = [];
        if (!updated.name) errors.push("Phase name is required.");
        if (updated.startDate && isNaN(Date.parse(updated.startDate))) {
          errors.push("Start date must be a valid date.");
        }
        if (updated.endDate && isNaN(Date.parse(updated.endDate))) {
          errors.push("End date must be a valid date.");
        }
        if (
          updated.startDate &&
          updated.endDate &&
          !isNaN(Date.parse(updated.startDate)) &&
          !isNaN(Date.parse(updated.endDate)) &&
          new Date(updated.startDate) > new Date(updated.endDate)
        ) {
          errors.push("End date must be on or after start date.");
        }
        const match = resolvePhaseImportMatch(updated.name, []);
        rows[rowIndex] = {
          ...updated,
          importMode: match.importMode,
          resolvedPhaseId: match.resolvedPhaseId ?? updated.resolvedPhaseId,
          errors,
        };

        if (previewId) {
          void patchExcelProjectsPreviewRow({
            previewId,
            entity: "phases",
            projectName: projName,
            index: rowIndex,
            patch: rows[rowIndex] as unknown as Record<string, unknown>,
          });
        }

        return { ...prev, [projName]: rows };
      });
    } else if (type === "tasks") {
      setParsedTasks((prev) => {
        const rows = [...(prev[projName] || [])];
        const updated = { ...rows[rowIndex], [field]: value };
        const duplicateTitles = new Set(
          rows
            .map((row, idx) =>
              idx === rowIndex
                ? updated.title.trim().toLowerCase()
                : row.title.trim().toLowerCase(),
            )
            .filter((title, titleIndex, all) => title && all.indexOf(title) !== titleIndex),
        );
        rows[rowIndex] = revalidateParsedTaskRow(
          updated,
          [],
          [],
          duplicateTitles,
          undefined,
        );

        if (previewId) {
          void patchExcelProjectsPreviewRow({
            previewId,
            entity: "tasks",
            projectName: projName,
            index: rowIndex,
            patch: rows[rowIndex] as unknown as Record<string, unknown>,
          });
        }

        return { ...prev, [projName]: rows };
      });
    } else if (type === "milestones") {
      setParsedMilestones((prev) => {
        const rows = [...(prev[projName] || [])];
        const updated = { ...rows[rowIndex], [field]: value };
        const errors: string[] = [];
        if (!updated.title) errors.push("Milestone title is required.");
        if (!updated.targetDate) errors.push("Target date is required.");
        else if (isNaN(Date.parse(updated.targetDate))) {
          errors.push("Target date must be valid YYYY-MM-DD.");
        }
        const match = resolveMilestoneImportMatch(updated.title, []);
        rows[rowIndex] = {
          ...updated,
          importMode: match.importMode,
          resolvedMilestoneId: match.resolvedMilestoneId ?? updated.resolvedMilestoneId,
          errors,
        };

        if (previewId) {
          void patchExcelProjectsPreviewRow({
            previewId,
            entity: "milestones",
            projectName: projName,
            index: rowIndex,
            patch: rows[rowIndex] as unknown as Record<string, unknown>,
          });
        }

        return { ...prev, [projName]: rows };
      });
    }
  };

  const handleImport = async () => {
    if (!previewId) {
      toast.error("No preview available to import.");
      return;
    }
    if (!counts || counts.projectsValid <= 0) {
      toast.error("No valid projects to import.");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportStatusText("Queuing projects import…");

    try {
      const enqueue = await confirmExcelProjectsImport({ previewId }).unwrap();

      const trackArgs = {
        label: `Importing ${counts.projectsValid} project${counts.projectsValid === 1 ? "" : "s"}`,
        kind: "excel-projects" as const,
        onComplete: (status: { result: Record<string, unknown> | null }) => {
          const result = status.result ?? {};
          toast.success(
            (result.message as string) ||
              `Import complete: ${result.projectsCreated ?? 0} created, ${result.projectsUpdated ?? 0} updated`,
          );
          if (Number(result.failed) > 0) {
            toast.error(`Failed to import ${result.failed} project(s).`);
          }
          refetch();
        },
        onError: (message: string) => toast.error(message),
      };

      if (enqueue.status === "queued" && enqueue.queueId) {
        trackQueuedImport({
          queueId: enqueue.queueId,
          position: enqueue.position,
          maxPerUser: enqueue.maxPerUser,
          ...trackArgs,
        });
        setIsImporting(false);
        handleReset();
        onClose();
        return;
      }

      if (!enqueue.jobId) {
        throw new Error("Import did not return a job id");
      }

      trackImport({
        jobId: enqueue.jobId,
        ...trackArgs,
      });
      toast.success("Import started — continue working; progress is shown below.");
      setIsImporting(false);
      handleReset();
      onClose();
    } catch (error) {
      setIsImporting(false);
      if (isImportQueueFullError(error)) {
        showQueueFull(importQueueFullMax(error));
      } else {
        toast.error(
          error instanceof Error ? error.message : "Failed to import projects.",
        );
      }
    }
  };

  const phaseSheetCount = Object.values(nestedCounts).filter((c) => c.phases > 0).length;
  const taskSheetCount = Object.values(nestedCounts).filter((c) => c.tasks > 0).length;
  const milestoneSheetCount = Object.values(nestedCounts).filter(
    (c) => c.milestones > 0,
  ).length;

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
              {!isImporting && !isParsing && (
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
              {!isImporting && !isParsing && (
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              )}
              {isImporting && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Continue working — progress stays visible"
                >
                  <Minimize2 className="size-3.5" />
                  Minimize
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
                        {(file.size / 1024).toFixed(1)} KB
                        {isParsing
                          ? " · Parsing…"
                          : !validationError && counts
                            ? ` · ${counts.projectsTotal} projects · ${phaseSheetCount} phase sheets · ${taskSheetCount} task sheets · ${milestoneSheetCount} milestone sheets`
                            : ""}
                      </p>
                    </div>
                  </div>
                  {!isImporting && !isParsing && (
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
                ) : isParsing ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 gap-4 min-h-[300px]">
                    <Loader2 className="size-8 text-primary animate-spin" />
                    <div className="text-center space-y-1">
                      <p className="text-sm font-bold">Parsing spreadsheet…</p>
                      <p className="text-xs text-muted-foreground">
                        Reading project, phase, task, and milestone sheets. Large workbooks can take a minute.
                      </p>
                    </div>
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
                      {projectsHasMore && (
                        <div className="flex justify-center pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={handleLoadMoreProjects}
                            disabled={loadingMoreProjects}
                            className="h-8 gap-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            {loadingMoreProjects ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : null}
                            Load more
                            {projectsTotal > parsedRows.length
                              ? ` (${projectsTotal - parsedRows.length} remaining)`
                              : ""}
                          </Button>
                        </div>
                      )}
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
                            const badge = nestedCounts[proj.name] || {
                              phases: 0,
                              tasks: 0,
                              milestones: 0,
                            };
                            const activeTab =
                              activeSubTab[proj.name] || defaultTabForProject(proj.name);
                            const nestedMore = nestedHasMore[proj.name]?.[activeTab] === true;

                            return (
                              <ProjectAccordionItem
                                key={proj.name}
                                proj={proj}
                                isExpanded={isExpanded}
                                onToggle={() => void handleToggleAccordion(proj.name)}
                                phasesList={phasesList}
                                tasksList={tasksList}
                                milestonesList={milestonesList}
                                activeTab={activeTab}
                                onTabChange={(tab) =>
                                  setActiveSubTab((prev) => ({ ...prev, [proj.name]: tab }))
                                }
                                handleSubRowChange={handleSubRowChange}
                                badgeCounts={badge}
                                hasMore={nestedMore}
                                loadingMore={loadingNested && isExpanded}
                                onLoadMore={() => void handleLoadMoreNested(proj.name)}
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
              {file && !validationError && isParsing && (
                <span>Parsing spreadsheet…</span>
              )}
              {file && !validationError && !isImporting && !isParsing && counts && (
                <span>
                  {counts.projectsValid} of {counts.projectsTotal} projects ready to import.
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
                disabled={isImporting || isParsing}
                className="font-bold h-9 text-xs rounded-xl"
              >
                Cancel
              </Button>
              {file && !isImporting && !isParsing && (
                <Button
                  onClick={handleImport}
                  disabled={!counts || counts.projectsValid <= 0 || !!validationError}
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
