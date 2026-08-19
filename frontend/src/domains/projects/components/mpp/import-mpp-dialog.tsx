"use client";
import { Spinner } from "@/shared/components/spinner";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "react-hot-toast";
import { AlertTriangle, CheckCircle2, FileUp, Minimize2, Upload, X } from "lucide-react";
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
  useImportMppPortfolioMutation,
  usePreviewMppImportMutation,
} from "../../api/mpp-import.api";
import {
  isImportQueueFullError,
  importQueueFullMax,
  type ImportEnqueueResult,
} from "../../api/imports.api";
import { useImportProgress } from "../import/import-progress-provider";
import type { MppImportPreview } from "../../types/mpp-import.types";
import {
  MppImportPreviewPanel,
  type MppEditableProject,
} from "./mpp-import-preview-panel";

const ACCEPTED_EXTENSIONS = [".mpp", ".mpx", ".xml"];

type ImportMppDialogProps = {
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
  /** When set, tasks are imported into this existing project (task-level). When absent, a NEW project is created (project-level). */
  projectId?: string;
  /** Current project name — used to pick the matching portfolio L1 schedule in preview. */
  projectName?: string;
};

type Step = "select" | "preview" | "done";

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
      if (Array.isArray(message)) {
        return message.map(String).filter(Boolean).join("; ") || fallback;
      }
    }
    if (data && typeof data === "object" && "errors" in data) {
      const errors = (data as { errors?: unknown }).errors;
      if (errors && typeof errors === "object") {
        const parts = Object.values(errors as Record<string, unknown>)
          .flatMap((v) => (Array.isArray(v) ? v : [v]))
          .map(String)
          .filter(Boolean);
        if (parts.length) return parts.join("; ");
      }
    }
    return typeof data === "string" ? data : fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function valueFromParsedCost(cost?: number): string {
  if (cost != null && Number.isFinite(Number(cost)) && Number(cost) > 0) {
    return String(Number(cost));
  }
  return "1";
}

function validateEditableProject(row: MppEditableProject): string[] {
  if (row.importMode === "update") return [];
  const errors: string[] = [];
  if (!row.objective.trim() || row.objective.trim().length < 5) {
    errors.push("Objective is required (min 5 characters).");
  }
  if (!row.departmentId) errors.push("Department is required.");
  if (!row.customerId) errors.push("Customer is required.");
  if (!row.primaryPmId) errors.push("Primary PM is required.");
  const value = Number(row.value);
  if (!Number.isFinite(value) || value < 0) {
    errors.push("Budget/value must be a valid number.");
  }
  return errors;
}

function buildEditableProjects(
  data: MppImportPreview,
  file: File,
  seed: {
    departmentId: string;
    customerId: string;
    primaryPmId: string;
  },
): MppEditableProject[] {
  const objective = `Imported from ${file.name}`;
  if (data.mode === "portfolio" && data.projects?.length) {
    return data.projects.map((project) => {
      const row: MppEditableProject = {
        name: project.name,
        importMode: project.importMode,
        resolvedProjectId: project.resolvedProjectId,
        objective,
        departmentId: seed.departmentId,
        customerId: seed.customerId,
        primaryPmId: seed.primaryPmId,
        engagementType: "ManagedServices",
        billingModel: "TimeAndMaterial",
        priority: "Medium",
        currency: "USD",
        value: valueFromParsedCost(project.cost),
        startDate: project.startDate,
        finishDate: project.finishDate,
        taskCount: project.taskCount,
        phaseCount: project.phaseCount,
        milestoneCount: project.milestoneCount ?? 0,
        dependencyCount: project.dependencyCount,
        tasks: project.tasks ?? [],
        milestones: project.milestones ?? [],
        errors: [],
        warnings: [],
      };
      row.errors = validateEditableProject(row);
      return row;
    });
  }

  const row: MppEditableProject = {
    name: (data.projectName || file.name.replace(/\.[^.]+$/, "")).slice(0, 255),
    importMode: data.importMode === "update" ? "update" : "create",
    resolvedProjectId: data.resolvedProjectId,
    objective,
    departmentId: seed.departmentId,
    customerId: seed.customerId,
    primaryPmId: seed.primaryPmId,
    engagementType: "ManagedServices",
    billingModel: "TimeAndMaterial",
    priority: "Medium",
    currency: "USD",
    value: valueFromParsedCost(data.cost),
    startDate: data.startDate,
    finishDate: data.finishDate,
    taskCount: data.counts.importableTasks,
    phaseCount: data.counts.phasesFromSummaries,
    milestoneCount: data.counts.milestonesFromFile ?? 0,
    dependencyCount: data.counts.dependencies,
    tasks: data.tasks ?? [],
    milestones: data.milestones ?? [],
    errors: [],
    warnings: [],
  };
  row.errors = validateEditableProject(row);
  return [row];
}

export function ImportMppDialog({
  open,
  onClose,
  onCompleted,
  projectId,
  projectName,
}: ImportMppDialogProps) {
  const isNewProject = !projectId;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("select");
  const [preview, setPreview] = useState<MppImportPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editableProjects, setEditableProjects] = useState<MppEditableProject[]>([]);
  const [result, setResult] = useState<{
    tasksCreated: number;
    tasksUpdated: number;
    dependenciesCreated: number;
    dependenciesUpdated: number;
    phasesCreated: number;
    phasesUpdated: number;
    milestonesCreated: number;
    milestonesUpdated: number;
    projectsCreated: number;
    projectsUpdated: number;
    projectCreated: boolean;
  } | null>(null);

  const [previewMpp, { isLoading: isPreviewing }] = usePreviewMppImportMutation();
  const [importMpp, { isLoading: isImporting }] = useImportMppMutation();
  const [importMppPortfolio, { isLoading: isImportingPortfolio }] =
    useImportMppPortfolioMutation();
  const [createProject, { isLoading: isCreatingProject }] = useCreateProjectMutation();
  const { trackImport, trackQueuedImport, showQueueFull } = useImportProgress();

  // Metadata only needed when creating a new project / portfolio creates.
  const { data: departments = [] } = useGetDepartmentsQuery(undefined, { skip: !isNewProject });
  const { data: customers = [] } = useGetCustomersQuery(undefined, { skip: !isNewProject });
  const { data: managers = [] } = useGetProjectManagersQuery(undefined, { skip: !isNewProject });

  useEffect(() => {
    if (!open) return;
    setSelectedFile(null);
    setStep("select");
    setPreview(null);
    setParseError(null);
    setEditableProjects([]);
    setResult(null);
    setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open]);

  // Catalogs often load after parse — fill empty create-row defaults once available.
  useEffect(() => {
    if (!isNewProject || editableProjects.length === 0) return;
    const departmentId = departments[0]?.id ?? "";
    const customerId = customers[0]?.id ?? "";
    const primaryPmId = managers[0]?.id ?? "";
    if (!departmentId && !customerId && !primaryPmId) return;

    setEditableProjects((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (row.importMode === "update") return row;
        const patched = {
          ...row,
          departmentId: row.departmentId || departmentId,
          customerId: row.customerId || customerId,
          primaryPmId: row.primaryPmId || primaryPmId,
        };
        if (
          patched.departmentId === row.departmentId &&
          patched.customerId === row.customerId &&
          patched.primaryPmId === row.primaryPmId
        ) {
          return row;
        }
        changed = true;
        patched.errors = validateEditableProject(patched);
        return patched;
      });
      return changed ? next : prev;
    });
  }, [departments, customers, managers, isNewProject, editableProjects.length]);

  // Fill catalog defaults once departments/customers/PMs load after auto-parse.
  useEffect(() => {
    if (!isNewProject || editableProjects.length === 0) return;
    if (!departments[0]?.id && !customers[0]?.id && !managers[0]?.id) return;
    setEditableProjects((prev) =>
      prev.map((row) => {
        if (row.importMode !== "create") return row;
        const next = {
          ...row,
          departmentId: row.departmentId || departments[0]?.id || "",
          customerId: row.customerId || customers[0]?.id || "",
          primaryPmId: row.primaryPmId || managers[0]?.id || "",
        };
        next.errors = validateEditableProject(next);
        return next;
      }),
    );
  }, [departments, customers, managers, isNewProject]);

  const isPortfolio = preview?.mode === "portfolio";
  const hasRowErrors = editableProjects.some((p) => p.errors.length > 0);
  const isSaving = isImporting || isImportingPortfolio || isCreatingProject;
  const isBusy = isPreviewing || isSaving;

  const previewTitle = useMemo(() => {
    if (preview?.projectName) return preview.projectName;
    return selectedFile?.name?.replace(/\.[^.]+$/, "") ?? "Imported schedule";
  }, [preview?.projectName, selectedFile?.name]);

  const resetUploadState = () => {
    setSelectedFile(null);
    setStep("select");
    setPreview(null);
    setParseError(null);
    setEditableProjects([]);
    setResult(null);
    setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isAcceptedFile = (file: File): boolean => {
    const extension = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? "";
    return ACCEPTED_EXTENSIONS.includes(extension);
  };

  const parseSelectedFile = async (file: File) => {
    setSelectedFile(file);
    setPreview(null);
    setParseError(null);
    setResult(null);
    setEditableProjects([]);
    setStep("select");

    try {
      const data = await previewMpp({ projectId, file }).unwrap();
      setPreview(data);
      if (isNewProject) {
        setEditableProjects(
          buildEditableProjects(data, file, {
            departmentId: departments[0]?.id || "",
            customerId: customers[0]?.id || "",
            primaryPmId: managers[0]?.id || "",
          }),
        );
      } else {
        // Workspace: import into the open project. Prefer the matching portfolio L1
        // (by id/name); if the file has a single L1 project, use that schedule.
        const matched =
          data.mode === "portfolio" && data.projects?.length
            ? data.projects.find(
                (p) =>
                  (projectId && p.resolvedProjectId === projectId) ||
                  (projectName && p.name.trim() === projectName.trim()),
              ) ??
              (data.projects.length === 1 ? data.projects[0] : undefined)
            : undefined;

        const scheduleName =
          matched?.name ||
          projectName ||
          data.projectName ||
          file.name.replace(/\.[^.]+$/, "");

        setEditableProjects([
          {
            name: scheduleName.slice(0, 255),
            importMode: "update",
            resolvedProjectId: projectId,
            objective: "",
            departmentId: "",
            customerId: "",
            primaryPmId: "",
            engagementType: "ManagedServices",
            billingModel: "TimeAndMaterial",
            priority: "Medium",
            currency: "USD",
            value: "1",
            startDate: matched?.startDate ?? data.startDate,
            finishDate: matched?.finishDate ?? data.finishDate,
            taskCount: matched?.taskCount ?? data.counts.importableTasks,
            phaseCount: matched?.phaseCount ?? data.counts.phasesFromSummaries,
            milestoneCount:
              matched?.milestoneCount ?? data.counts.milestonesFromFile ?? 0,
            dependencyCount:
              matched?.dependencyCount ?? data.counts.dependencies,
            tasks: matched?.tasks ?? data.tasks ?? [],
            milestones: matched?.milestones ?? data.milestones ?? [],
            errors: [],
            warnings:
              data.mode === "portfolio" &&
              data.projects &&
              data.projects.length > 1 &&
              !matched
                ? [
                    `This portfolio has ${data.projects.length} projects and none match "${projectName || "this project"}". Import may fail — use Projects → Import MPP for multi-project files, or rename to match.`,
                  ]
                : matched &&
                    projectName &&
                    matched.name.trim() !== projectName.trim()
                  ? [
                      `File schedule "${matched.name}" will be imported into "${projectName}" (single schedule in file).`,
                    ]
                  : [],
          },
        ]);
      }
      setStep("preview");
    } catch (error) {
      const message = extractError(error, "Failed to read MPP file");
      setParseError(message);
      toast.error(message);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isAcceptedFile(file)) {
      toast.error("Use a .mpp, .mpx, or MSPDI .xml file");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    void parseSelectedFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (isBusy) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (!isAcceptedFile(file)) {
      toast.error("Use a .mpp, .mpx, or MSPDI .xml file");
      return;
    }
    void parseSelectedFile(file);
  };

  const handleProjectChange = (
    index: number,
    field: keyof MppEditableProject,
    value: string,
  ) => {
    setEditableProjects((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [field]: value };
        next.errors = validateEditableProject(next);
        return next;
      }),
    );
  };

  const finishInBackground = (
    enqueue: ImportEnqueueResult,
    kind: "mpp" | "mpp-portfolio",
    label: string,
    onComplete: (summary: Record<string, unknown>) => void,
  ) => {
    const trackArgs = {
      label,
      kind,
      onComplete: (status: { result: Record<string, unknown> | null }) => {
        onComplete((status.result ?? {}) as Record<string, unknown>);
        onCompleted?.();
      },
      onError: (message: string) => {
        toast.error(message);
      },
    };

    if (enqueue.status === "queued" && enqueue.queueId) {
      trackQueuedImport({
        queueId: enqueue.queueId,
        position: enqueue.position,
        maxPerUser: enqueue.maxPerUser,
        ...trackArgs,
      });
      onClose();
      return;
    }

    if (!enqueue.jobId) {
      toast.error("Import did not return a job id");
      return;
    }

    trackImport({
      jobId: enqueue.jobId,
      ...trackArgs,
    });
    toast.success("Import started — continue working; progress is shown below.");
    onClose();
  };

  const handleConfirm = async () => {
    const file = selectedFile;
    if (!file) return;

    try {
      if (isNewProject && isPortfolio) {
        if (hasRowErrors) {
          return toast.error("Fix validation errors on new project rows first");
        }

        const createRows = editableProjects.filter((p) => p.importMode === "create");
        const first = createRows[0];
        const enqueue = await importMppPortfolio({
          file,
          defaults: {
            objective: first?.objective.trim(),
            departmentId: first?.departmentId,
            customerId: first?.customerId,
            engagementType: first?.engagementType,
            billingModel: first?.billingModel,
            priority: first?.priority,
            value: first
              ? (() => {
                  const parsed = Number(first.value);
                  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
                })()
              : undefined,
            currency: first?.currency,
            primaryPmId: first?.primaryPmId,
            projects: createRows.map((row) => ({
              name: row.name,
              objective: row.objective.trim(),
              departmentId: row.departmentId,
              customerId: row.customerId,
              engagementType: row.engagementType,
              billingModel: row.billingModel,
              priority: row.priority,
              value: (() => {
                const parsed = Number(row.value);
                return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
              })(),
              currency: row.currency,
              primaryPmId: row.primaryPmId,
            })),
          },
        }).unwrap();

        finishInBackground(
          enqueue,
          "mpp-portfolio",
          `Importing ${editableProjects.length || createRows.length} projects from MPP`,
          (summary) => {
            const projectsCreated = Number(summary.projectsCreated ?? 0);
            const projectsUpdated = Number(summary.projectsUpdated ?? 0);
            setResult({
              tasksCreated: Number(summary.tasksCreated ?? 0),
              tasksUpdated: Number(summary.tasksUpdated ?? 0),
              dependenciesCreated: Number(summary.dependenciesCreated ?? 0),
              dependenciesUpdated: Number(summary.dependenciesUpdated ?? 0),
              phasesCreated: Number(summary.phasesCreated ?? 0),
              phasesUpdated: Number(summary.phasesUpdated ?? 0),
              milestonesCreated: Number(summary.milestonesCreated ?? 0),
              milestonesUpdated: Number(summary.milestonesUpdated ?? 0),
              projectsCreated,
              projectsUpdated,
              projectCreated: projectsCreated > 0,
            });
            toast.success(
              `Portfolio import — created ${projectsCreated} project(s), updated ${projectsUpdated}`,
            );
          },
        );
        return;
      }

      let targetProjectId = projectId;
      let createdNewProject = false;

      if (isNewProject) {
        const row = editableProjects[0];
        if (!row) return toast.error("No project preview available");

        if (row.importMode === "update" && row.resolvedProjectId) {
          targetProjectId = row.resolvedProjectId;
        } else {
          if (row.errors.length > 0) {
            return toast.error(row.errors[0] || "Fix project validation errors first");
          }

          const start = new Date(toIso(row.startDate ?? preview?.startDate, new Date()));
          const fallbackEnd = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
          let end = new Date(toIso(row.finishDate ?? preview?.finishDate, fallbackEnd));
          if (end.getTime() < start.getTime()) end = fallbackEnd;

          const payload: CreateProjectDto = {
            name: row.name.trim(),
            objective: row.objective.trim(),
            departmentId: row.departmentId,
            customerId: row.customerId,
            engagementType: row.engagementType as CreateProjectDto["engagementType"],
            billingModel: row.billingModel as CreateProjectDto["billingModel"],
            priority: row.priority as CreateProjectDto["priority"],
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            value: (() => {
              const parsed = Number(row.value);
              return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
            })(),
            currency: row.currency as CreateProjectDto["currency"],
            primaryPmId: row.primaryPmId,
          };

          const created = await createProject(payload).unwrap();
          targetProjectId = created.id;
          createdNewProject = true;
        }
      }

      if (!targetProjectId) return;

      const enqueue = await importMpp({ projectId: targetProjectId, file }).unwrap();
      finishInBackground(
        enqueue,
        "mpp",
        createdNewProject
          ? "Importing schedule into new project"
          : "Importing MS Project schedule",
        (summary) => {
          setResult({
            tasksCreated: Number(summary.tasksCreated ?? 0),
            tasksUpdated: Number(summary.tasksUpdated ?? 0),
            dependenciesCreated: Number(summary.dependenciesCreated ?? 0),
            dependenciesUpdated: Number(summary.dependenciesUpdated ?? 0),
            phasesCreated: Number(summary.phasesCreated ?? 0),
            phasesUpdated: Number(summary.phasesUpdated ?? 0),
            milestonesCreated: Number(summary.milestonesCreated ?? 0),
            milestonesUpdated: Number(summary.milestonesUpdated ?? 0),
            projectsCreated: createdNewProject ? 1 : 0,
            projectsUpdated: createdNewProject ? 0 : 1,
            projectCreated: createdNewProject,
          });
          const createdBits = [
            summary.phasesCreated ? `${summary.phasesCreated} phases` : null,
            summary.milestonesCreated ? `${summary.milestonesCreated} milestones` : null,
            summary.tasksCreated ? `${summary.tasksCreated} tasks` : null,
            summary.dependenciesCreated
              ? `${summary.dependenciesCreated} dependencies`
              : null,
          ].filter(Boolean);
          const updatedBits = [
            summary.phasesUpdated ? `${summary.phasesUpdated} phases` : null,
            summary.tasksUpdated ? `${summary.tasksUpdated} tasks` : null,
            summary.dependenciesUpdated
              ? `${summary.dependenciesUpdated} dependencies`
              : null,
          ].filter(Boolean);
          const toastParts = [
            createdBits.length ? `created ${createdBits.join(", ")}` : null,
            updatedBits.length ? `updated ${updatedBits.join(", ")}` : null,
          ].filter(Boolean);
          toast.success(
            createdNewProject
              ? `Created project${toastParts.length ? ` — ${toastParts.join("; ")}` : ""}`
              : toastParts.length
                ? `Updated existing project — ${toastParts.join("; ")}`
                : "Import complete",
          );
        },
      );
    } catch (error) {
      if (isImportQueueFullError(error)) {
        showQueueFull(importQueueFullMax(error));
      } else {
        toast.error(extractError(error, "Failed to import MPP file"));
      }
    }
  };

  const handleClose = () => {
    if (isPreviewing) return;
    // Allow leave while enqueue/create is in flight once user chooses minimize,
    // and always allow leave after background hand-off.
    if (isCreatingProject) return;
    onClose();
  };

  const updatingExisting =
    isNewProject && editableProjects[0]?.importMode === "update";

  const confirmLabel = !isNewProject || updatingExisting
    ? `Confirm & save ${editableProjects[0]?.taskCount ?? preview?.counts.importableTasks ?? 0} tasks`
    : isPortfolio
      ? `Import ${editableProjects.length || preview?.counts.projects || 0} projects`
      : `Create project & import ${preview?.counts.importableTasks ?? 0} tasks`;

  const footerHint = (() => {
    if (parseError) return "File cannot be imported until a valid MS Project file is selected.";
    if (isPreviewing) return "Parsing schedule…";
    if (isSaving) return "Starting import…";
    if (step === "preview" && preview) {
      if (hasRowErrors) {
        return `${editableProjects.filter((p) => p.errors.length > 0).length} project row(s) need fixes before import.`;
      }
      if (!isNewProject || updatingExisting) {
        const row = editableProjects[0];
        return `${updatingExisting ? "Update existing project" : "Into this project"} · ${row?.taskCount ?? preview.counts.importableTasks} tasks · ${row?.phaseCount ?? preview.counts.phasesFromSummaries} phases · ${row?.milestoneCount ?? preview.counts.milestonesFromFile ?? 0} milestones · ${row?.dependencyCount ?? preview.counts.dependencies} dependencies`;
      }
      if (isPortfolio) {
        const createCount = editableProjects.filter((p) => p.importMode === "create").length;
        const updateCount = editableProjects.filter((p) => p.importMode === "update").length;
        return `${editableProjects.length} projects ready · ${createCount} create · ${updateCount} update`;
      }
      return `${preview.counts.importableTasks} tasks · ${preview.counts.phasesFromSummaries} phases · ${preview.counts.milestonesFromFile ?? 0} milestones · ${preview.counts.dependencies} dependencies`;
    }
    return null;
  })();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-7xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl",
            "transition duration-200 ease-in-out data-ending-style:scale-95 data-starting-style:scale-95 data-ending-style:opacity-0 data-starting-style:opacity-0",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <FileUp className="size-5 text-primary" />
              <DialogPrimitive.Title className="text-sm font-bold text-foreground">
                {isNewProject ? "Import MPP / MSPDI" : "Import MPP into project"}
              </DialogPrimitive.Title>
            </div>
            {!isBusy ? (
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : (
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

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
            {!selectedFile ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={handleDrop}
                className={cn(
                  "flex min-h-[300px] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 transition-all",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border/80 hover:border-primary/50 hover:bg-muted/10",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mpp,.mpx,.xml"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isBusy}
                />
                <div className="flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary">
                  <Upload className="size-6" />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-sm font-bold text-foreground">
                    Click to select or drag MS Project file
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: .mpp, .mpx, MSPDI .xml (max 50 MB)
                  </p>
                </div>
                <div className="mt-4 max-w-2xl space-y-2 rounded-xl border border-border/50 bg-muted/40 p-4 text-[11px] font-medium leading-relaxed text-muted-foreground">
                  <p className="mb-1 font-bold uppercase tracking-wider text-foreground">
                    Import guidelines
                  </p>
                  <p>
                    • <strong>Single project:</strong> L1 summaries become phases; leaf rows become tasks.
                  </p>
                  <p>
                    • <strong>Portfolio (multi-project):</strong> L1 summaries = projects, L2 = phases, L3 = tasks — same idea as Excel multi-project import.
                  </p>
                  <p>
                    • Existing project names are <strong>updated</strong> (no duplicates). Edit department, priority, and other fields per project in the preview table.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-6">
                <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileUp className="size-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] font-medium text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                        {preview && !parseError
                          ? isPortfolio
                            ? ` · ${preview.counts.projects ?? editableProjects.length} projects · ${preview.counts.importableTasks} tasks · ${preview.counts.phasesFromSummaries} phases · ${preview.counts.milestonesFromFile ?? 0} milestones`
                            : ` · ${preview.counts.importableTasks} tasks · ${preview.counts.phasesFromSummaries} phases · ${preview.counts.milestonesFromFile ?? 0} milestones`
                          : isPreviewing
                            ? " · Parsing…"
                            : ""}
                      </p>
                    </div>
                  </div>
                  {!isBusy && (
                    <Button type="button" variant="outline" size="xs" onClick={resetUploadState}>
                      Change File
                    </Button>
                  )}
                </div>

                {parseError ? (
                  <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-12">
                    <AlertTriangle className="size-12 animate-bounce text-rose-500" />
                    <div className="max-w-md space-y-1 text-center">
                      <p className="text-sm font-bold text-rose-500">Could not parse file</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{parseError}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={resetUploadState}
                      className="mt-2 cursor-pointer border-rose-500/20 text-rose-600 hover:bg-rose-500/10"
                    >
                      Select Another File
                    </Button>
                  </div>
                ) : isPreviewing || (step === "select" && !preview) ? (
                  <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-4 p-12">
                    <Spinner size="lg" />
                    <div className="space-y-1 text-center">
                      <p className="text-sm font-bold">Parsing MS Project file…</p>
                      <p className="text-xs text-muted-foreground">
                        Please wait while the schedule is read. Do not close this dialog.
                      </p>
                    </div>
                  </div>
                ) : step === "done" && result ? (
                  <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 py-8 text-center">
                    <CheckCircle2 className="size-8 text-emerald-500" />
                    <p className="text-sm font-semibold text-foreground">
                      {result.projectsCreated + result.projectsUpdated > 1
                        ? "Portfolio import complete"
                        : result.projectCreated
                          ? "Project created"
                          : "Import complete"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[
                        result.projectsCreated || result.projectsUpdated
                          ? `Projects: ${[
                              result.projectsCreated ? `${result.projectsCreated} created` : null,
                              result.projectsUpdated ? `${result.projectsUpdated} updated` : null,
                            ]
                              .filter(Boolean)
                              .join(", ")}`
                          : null,
                        result.phasesCreated || result.milestonesCreated || result.tasksCreated || result.dependenciesCreated
                          ? `Created: ${[
                              result.phasesCreated ? `${result.phasesCreated} phases` : null,
                              result.milestonesCreated ? `${result.milestonesCreated} milestones` : null,
                              result.tasksCreated ? `${result.tasksCreated} tasks` : null,
                              result.dependenciesCreated
                                ? `${result.dependenciesCreated} deps`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(", ")}`
                          : null,
                        result.phasesUpdated || result.milestonesUpdated || result.tasksUpdated || result.dependenciesUpdated
                          ? `Updated: ${[
                              result.phasesUpdated ? `${result.phasesUpdated} phases` : null,
                              result.milestonesUpdated ? `${result.milestonesUpdated} milestones` : null,
                              result.tasksUpdated ? `${result.tasksUpdated} tasks` : null,
                              result.dependenciesUpdated
                                ? `${result.dependenciesUpdated} deps`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(", ")}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No schedule changes were needed."}
                    </p>
                  </div>
                ) : step === "preview" && preview ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{previewTitle}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(preview.startDate)} – {formatDate(preview.finishDate)}
                          {!isNewProject
                            ? " · Into this project"
                            : isPortfolio
                              ? " · Portfolio file"
                              : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-muted-foreground">
                        {isPortfolio && isNewProject && (
                          <span className="rounded-lg border border-border/60 bg-background px-2 py-1">
                            {editableProjects.length} projects
                          </span>
                        )}
                        <span className="rounded-lg border border-border/60 bg-background px-2 py-1">
                          {editableProjects[0]?.taskCount ??
                            preview.counts.importableTasks}{" "}
                          tasks
                        </span>
                        <span className="rounded-lg border border-border/60 bg-background px-2 py-1">
                          {editableProjects[0]?.phaseCount ??
                            preview.counts.phasesFromSummaries}{" "}
                          phases
                        </span>
                        <span className="rounded-lg border border-border/60 bg-background px-2 py-1">
                          {preview.counts.milestonesFromFile ?? 0} milestones
                        </span>
                        <span className="rounded-lg border border-border/60 bg-background px-2 py-1">
                          {editableProjects[0]?.dependencyCount ??
                            preview.counts.dependencies}{" "}
                          deps
                        </span>
                      </div>
                    </div>

                    {(preview.warnings.length > 0 ||
                      editableProjects.some((p) => p.warnings.length > 0)) && (
                      <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        <p className="mb-1 font-semibold">Notes</p>
                        <ul className="list-disc space-y-0.5 pl-4">
                          {[
                            ...editableProjects.flatMap((p) => p.warnings),
                            ...preview.warnings,
                          ]
                            .slice(0, 8)
                            .map((warning, index) => (
                              <li key={index}>{warning}</li>
                            ))}
                          {preview.warnings.length +
                            editableProjects.reduce(
                              (n, p) => n + p.warnings.length,
                              0,
                            ) >
                            8 && (
                            <li>
                              +
                              {preview.warnings.length +
                                editableProjects.reduce(
                                  (n, p) => n + p.warnings.length,
                                  0,
                                ) -
                                8}{" "}
                              more…
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    <MppImportPreviewPanel
                      projects={editableProjects}
                      departments={departments}
                      customers={customers}
                      managers={managers}
                      onProjectChange={handleProjectChange}
                      hideProjectEditors={!isNewProject}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border bg-muted/15 px-6 py-4">
            <div className="text-xs font-semibold text-muted-foreground">
              {parseError ? (
                <span className="font-medium text-rose-500">{footerHint}</span>
              ) : (
                footerHint
              )}
            </div>
            <div className="flex items-center gap-2">
              {step === "done" ? (
                <Button type="button" onClick={handleClose}>
                  Close
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isBusy}>
                    Cancel
                  </Button>
                  {step === "preview" && preview && !parseError && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleConfirm}
                      disabled={
                        isBusy ||
                        (editableProjects[0]?.taskCount ??
                          preview.counts.importableTasks) === 0 ||
                        (isNewProject && hasRowErrors) ||
                        (!isNewProject &&
                          Boolean(
                            editableProjects[0]?.warnings.some((w) =>
                              w.includes("Import may fail"),
                            ),
                          ))
                      }
                    >
                      {isSaving ? (
                        <>
                          <Spinner size="sm" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <FileUp className="size-4" />
                          {confirmLabel}
                        </>
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
