"use client";

import React, { useMemo, useState, useImperativeHandle, forwardRef } from "react";
import { toast } from "react-hot-toast";
import {
  useGetPhasesQuery,
  useCreatePhaseMutation,
  useUpdatePhaseMutation,
  useDeletePhaseMutation,
  useGetMilestonesQuery,
  useCreateMilestoneMutation,
  useUpdateMilestoneMutation,
  useDeleteMilestoneMutation,
  useGetProjectByIdQuery,
} from "../../../api/projects.api";
import { useGetTasksQuery, useUpdateTaskMutation } from "../../../api/tasks.api";
import { useUploadFileMutation } from "../../../api/files.api";
import { formatFileUploadError } from "../../../utils/attachment-limits";
import { formatMilestoneWeightApiError } from "../../../utils/milestone-weight";
import { formatTaskApiError } from "../../../utils/task-status-permissions";
import {
  useCreateProjectDocumentMutation,
  useDeleteProjectDocumentMutation,
  useGetProjectDocumentsQuery,
} from "../../../api/project-documents.api";
import type { WorkspaceDocumentCategory } from "../../../types/project-documents.types";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { FilterSelect } from "@/shared/components/filter-select";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import { PhaseForm } from "../../roadmap/phase-form";
import { MilestoneForm } from "../../roadmap/milestone-form";
import { DocumentAttachmentList } from "../../documents/document-attachment-list";
import { PhaseFormValues } from "../../../schemas/phase/phase.schema";
import { MilestoneFormValues } from "../../../schemas/milestone/milestone.schema";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Flag,
  ListTodo,
  Plus,
  Loader2,
  FolderOpen,
  User,
  AlertTriangle,
  Trash2,
  Edit2,
  Paperclip,
  ShieldCheck,
} from "lucide-react";
import { PhaseStatus } from "../../../types/projects.types";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";

import type { GetTasksParams } from "../../../types/tasks.types";
import { getPriorityColors } from "./task-cell-pickers";

export interface PhaseViewRef {
  openAddPhase: () => void;
}

interface PhaseViewProps {
  projectId: string;
  taskQueryParams?: GetTasksParams;
  onTaskClick: (taskId: string) => void;
  onAddTask?: (phaseId: string) => void;
}

export const PhaseView = forwardRef<PhaseViewRef, PhaseViewProps>(
  function PhaseView({ projectId, taskQueryParams, onTaskClick, onAddTask }, ref) {
  const { canCreatePhases, canEditPhases, canEditMilestones, canApproveProjects } = useModulePermissions();
  const { data: project } = useGetProjectByIdQuery(projectId);
  const { data: phases = [], isLoading: isPhasesLoading } = useGetPhasesQuery(projectId);
  const { data: milestones = [], isLoading: isMilestonesLoading } = useGetMilestonesQuery(projectId);
  const { data: tasksResponse, isLoading: isTasksLoading } = useGetTasksQuery(
    taskQueryParams ?? { projectId, limit: 100 }
  );

  useImperativeHandle(ref, () => ({
    openAddPhase: () => {
      if (!canCreatePhases) return;
      setActiveForm({ type: "add-phase" });
    },
  }), [canCreatePhases]);

  const [createPhase, { isLoading: isCreatingPhase }] = useCreatePhaseMutation();
  const [updatePhase, { isLoading: isUpdatingPhase }] = useUpdatePhaseMutation();
  const [deletePhase, { isLoading: isDeletingPhase }] = useDeletePhaseMutation();

  const [createMilestone, { isLoading: isCreatingMilestone }] = useCreateMilestoneMutation();
  const [updateMilestone, { isLoading: isUpdatingMilestone }] = useUpdateMilestoneMutation();
  const [deleteMilestone, { isLoading: isDeletingMilestone }] = useDeleteMilestoneMutation();
  const [updateTask, { isLoading: isUpdatingGate }] = useUpdateTaskMutation();
  const [uploadFile, { isLoading: isUploadingFile }] = useUploadFileMutation();
  const [createDocument, { isLoading: isCreatingDocument }] = useCreateProjectDocumentMutation();
  const [deleteDocument, { isLoading: isDeletingDocument }] = useDeleteProjectDocumentMutation();

  const [activeForm, setActiveForm] = useState<{
    type: "add-phase" | "edit-phase" | "add-milestone" | "edit-milestone" | null;
    id?: string;
    phaseId?: string;
  }>({ type: null });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "phase" | "milestone" | null;
    id: string;
  }>({
    isOpen: false,
    type: null,
    id: "",
  });

  const editingPhaseId =
    activeForm.type === "edit-phase" && activeForm.id ? activeForm.id : undefined;
  const editingMilestoneId =
    activeForm.type === "edit-milestone" && activeForm.id ? activeForm.id : undefined;

  const { data: phaseDocuments = [], isLoading: isPhaseDocsLoading } = useGetProjectDocumentsQuery(
    { projectId, category: "Phase", phaseId: editingPhaseId },
    { skip: !editingPhaseId },
  );
  const { data: milestoneDocuments = [], isLoading: isMilestoneDocsLoading } =
    useGetProjectDocumentsQuery(
      { projectId, category: "Milestone", milestoneId: editingMilestoneId },
      { skip: !editingMilestoneId },
    );
  const { data: allDocuments = [] } = useGetProjectDocumentsQuery({ projectId });

  const documentsByPhase = useMemo(() => {
    const map: Record<string, typeof allDocuments> = {};
    for (const doc of allDocuments) {
      if (!doc.phaseId) continue;
      if (!map[doc.phaseId]) map[doc.phaseId] = [];
      map[doc.phaseId].push(doc);
    }
    return map;
  }, [allDocuments]);

  const documentsByMilestone = useMemo(() => {
    const map: Record<string, typeof allDocuments> = {};
    for (const doc of allDocuments) {
      if (!doc.milestoneId) continue;
      if (!map[doc.milestoneId]) map[doc.milestoneId] = [];
      map[doc.milestoneId].push(doc);
    }
    return map;
  }, [allDocuments]);

  const isUploadingDocument = isUploadingFile || isCreatingDocument;

  async function uploadEntityDocuments(params: {
    entityId: string;
    category: Extract<WorkspaceDocumentCategory, "Phase" | "Milestone">;
    files: File[];
  }) {
    if (!params.entityId) {
      throw new Error("Missing entity id for document upload");
    }
    for (const file of params.files) {
      const uploaded = await uploadFile(file).unwrap();
      await createDocument({
        projectId,
        storageKey: uploaded.storageKey || uploaded.file.path,
        filename: uploaded.filename || file.name,
        mimeType: uploaded.mimeType || file.type,
        sizeBytes: uploaded.sizeBytes || file.size,
        category: params.category,
        phaseId: params.category === "Phase" ? params.entityId : undefined,
        milestoneId: params.category === "Milestone" ? params.entityId : undefined,
      }).unwrap();
    }
  }

  async function handleImmediatePhaseUpload(files: File[]) {
    if (!editingPhaseId) return;
    try {
      await uploadEntityDocuments({
        entityId: editingPhaseId,
        category: "Phase",
        files,
      });
      toast.success(files.length === 1 ? "File attached to phase" : `${files.length} files attached`);
    } catch (err) {
      console.error(err);
      toast.error(formatFileUploadError(err, "Failed to attach file to phase"));
    }
  }

  async function handleImmediateMilestoneUpload(files: File[]) {
    if (!editingMilestoneId) return;
    try {
      await uploadEntityDocuments({
        entityId: editingMilestoneId,
        category: "Milestone",
        files,
      });
      toast.success(
        files.length === 1 ? "File attached to milestone" : `${files.length} files attached`,
      );
    } catch (err) {
      console.error(err);
      toast.error(formatFileUploadError(err, "Failed to attach file to milestone"));
    }
  }

  async function handleDeleteEntityDocument(documentId: string) {
    try {
      await deleteDocument({ projectId, documentId }).unwrap();
      toast.success("Attachment removed");
    } catch {
      toast.error("Failed to remove attachment");
    }
  }

  const activePhase = useMemo(() => {
    if (activeForm.type === "edit-phase" && activeForm.id) {
      return phases.find((p) => p.id === activeForm.id);
    }
    return undefined;
  }, [activeForm, phases]);

  const activeMilestone = useMemo(() => {
    if (activeForm.type === "edit-milestone" && activeForm.id) {
      return milestones.find((m) => m.id === activeForm.id);
    }
    return undefined;
  }, [activeForm, milestones]);

  const initialPhaseValues = useMemo<PhaseFormValues>(() => {
    if (activePhase) {
      return {
        name: activePhase.name,
        description: activePhase.description || "",
        startDate: activePhase.startDate ? activePhase.startDate.slice(0, 10) : "",
        endDate: activePhase.endDate ? activePhase.endDate.slice(0, 10) : "",
        status: activePhase.status,
      };
    }
    return {
      name: "",
      description: "",
      startDate: "",
      endDate: "",
      status: "Planned",
    };
  }, [activePhase]);

  const initialMilestoneValues = useMemo<MilestoneFormValues>(() => {
    if (activeMilestone) {
      return {
        title: activeMilestone.title,
        targetDate: activeMilestone.targetDate ? activeMilestone.targetDate.slice(0, 10) : "",
        weight: activeMilestone.weight ?? null,
        status: activeMilestone.status,
        phaseId: activeMilestone.phaseId || "unassigned",
      };
    }
    return {
      title: "",
      targetDate: "",
      weight: null,
      status: "Pending",
      phaseId: activeForm.type === "add-milestone" && activeForm.phaseId ? activeForm.phaseId : "unassigned",
    };
  }, [activeMilestone, activeForm]);

  const handleSavePhase = async (values: PhaseFormValues, draftFiles: File[] = []) => {
    const otherPhases = phases.filter(
      (p) => (activeForm.type === "add-phase" ? true : p.id !== activeForm.id)
    );
    const sortedPhases = [...otherPhases].map((p) => ({
      id: p.id, 
      startDate: p.startDate || null,
      endDate: p.endDate || null,
      name: p.name,
    }));

    sortedPhases.push({
      id: activeForm.type === "edit-phase" && activeForm.id ? activeForm.id : "temp-new-id",
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      name: values.name,
    });

    sortedPhases.sort((a, b) => {
      if (!a.startDate && !b.startDate) return a.name.localeCompare(b.name);
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      
      const diff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      if (diff !== 0) return diff;
      
      if (!a.endDate && !b.endDate) return a.name.localeCompare(b.name);
      if (!a.endDate) return 1;
      if (!b.endDate) return -1;
      
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    });

    const computedOrderIndex = sortedPhases.findIndex(
      (p) => (activeForm.type === "edit-phase" ? p.id === activeForm.id : p.id === "temp-new-id")
    );

    const payload = {
      name: values.name,
      description: values.description || null,
      orderIndex: computedOrderIndex === -1 ? 0 : computedOrderIndex,
      startDate: new Date(values.startDate).toISOString(),
      endDate: new Date(values.endDate).toISOString(),
      status: values.status,
    };

    try {
      let phaseId = activeForm.id;
      if (activeForm.type === "add-phase") {
        const created = await createPhase({ projectId, body: payload }).unwrap();
        phaseId = created?.id;
        if (!phaseId) {
          throw new Error("Phase created without id");
        }
        toast.success("Phase created successfully");
      } else if (activeForm.type === "edit-phase" && activeForm.id) {
        await updatePhase({ projectId, phaseId: activeForm.id, body: payload }).unwrap();
        toast.success("Phase updated successfully");
      }

      if (phaseId && draftFiles.length > 0) {
        try {
          await uploadEntityDocuments({
            entityId: phaseId,
            category: "Phase",
            files: draftFiles,
          });
          toast.success(
            draftFiles.length === 1
              ? "Phase file attached"
              : `${draftFiles.length} phase files attached`,
          );
        } catch (uploadErr) {
          console.error(uploadErr);
          toast.error("Phase saved, but attaching files failed. Re-open the phase to retry.");
        }
      }
      setActiveForm({ type: null });
    } catch (err) {
      console.error("Failed to save phase", err);
      toast.error(formatTaskApiError(err, "Failed to save phase"));
    }
  };

  const handleSetPhaseGate = async (taskId: string, isPhaseGate: boolean) => {
    try {
      await updateTask({ id: taskId, body: { isPhaseGate } }).unwrap();
      toast.success(
        isPhaseGate
          ? "Phase sign-off task set."
          : "Phase sign-off cleared.",
      );
    } catch (err) {
      console.error("Failed to update phase sign-off", err);
      toast.error(formatTaskApiError(err, "Failed to update phase sign-off"));
    }
  };

  const handleSaveMilestone = async (
    values: MilestoneFormValues,
    draftFiles: File[] = [],
  ) => {
    const payload = {
      title: values.title,
      targetDate: new Date(values.targetDate).toISOString(),
      weight: values.weight ? Number(values.weight) : null,
      status: values.status,
      phaseId: values.phaseId === "unassigned" ? null : values.phaseId,
    };

    try {
      let milestoneId = activeForm.id;
      if (activeForm.type === "add-milestone") {
        const created = await createMilestone({ projectId, body: payload }).unwrap();
        milestoneId = created?.id;
        if (!milestoneId) {
          throw new Error("Milestone created without id");
        }
        toast.success("Milestone created successfully");
      } else if (activeForm.type === "edit-milestone" && activeForm.id) {
        await updateMilestone({ projectId, milestoneId: activeForm.id, body: payload }).unwrap();
        toast.success("Milestone updated successfully");
      }

      if (milestoneId && draftFiles.length > 0) {
        try {
          await uploadEntityDocuments({
            entityId: milestoneId,
            category: "Milestone",
            files: draftFiles,
          });
          toast.success(
            draftFiles.length === 1
              ? "Milestone file attached"
              : `${draftFiles.length} milestone files attached`,
          );
        } catch (uploadErr) {
          console.error(uploadErr);
          toast.error("Milestone saved, but attaching files failed. Re-open to retry.");
        }
      }
      setActiveForm({ type: null });
    } catch (err) {
      console.error("Failed to save milestone", err);
      toast.error(formatMilestoneWeightApiError(err));
    }
  };

  const handleConfirmDelete = async () => {
    const { type, id } = deleteConfirm;
    if (!type || !id) return;

    try {
      if (type === "phase") {
        await deletePhase({ projectId, phaseId: id }).unwrap();
        toast.success("Phase deleted successfully");
        if (activeForm.type === "edit-phase" && activeForm.id === id) {
          setActiveForm({ type: null });
        }
      } else if (type === "milestone") {
        await deleteMilestone({ projectId, milestoneId: id }).unwrap();
        toast.success("Milestone deleted successfully");
        if (activeForm.type === "edit-milestone" && activeForm.id === id) {
          setActiveForm({ type: null });
        }
      }
      setDeleteConfirm({ isOpen: false, type: null, id: "" });
    } catch (err) {
      console.error(`Failed to delete ${type}`, err);
      const apiError = err as { data?: { message?: string; errors?: Record<string, string> } };
      const message =
        apiError?.data?.message ||
        (apiError?.data?.errors ? Object.values(apiError.data.errors)[0] : undefined) ||
        `Failed to delete ${type}`;
      toast.error(message);
    }
  };

  const tasks = useMemo(() => tasksResponse?.data || [], [tasksResponse]);

  // Sort phases by startDate (earliest first, nulls at the end)
  const sortedPhases = useMemo(() => {
    return [...phases].sort((a, b) => {
      if (!a.startDate && !b.startDate) return a.name.localeCompare(b.name);
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      
      const diff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      if (diff !== 0) return diff;
      
      if (!a.endDate && !b.endDate) return a.name.localeCompare(b.name);
      if (!a.endDate) return 1;
      if (!b.endDate) return -1;
      
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    });
  }, [phases]);

  // Group tasks by Phase
  const tasksByPhase = useMemo(() => {
    const map: Record<string, typeof tasks> = { unassigned: [] };
    sortedPhases.forEach((p) => {
      map[p.id] = [];
    });

    tasks.forEach((t) => {
      const key = t.phaseId || "unassigned";
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(t);
    });

    return map;
  }, [sortedPhases, tasks]);

  // Group milestones by Phase
  const milestonesByPhase = useMemo(() => {
    const map: Record<string, typeof milestones> = { unassigned: [] };
    sortedPhases.forEach((p) => {
      map[p.id] = [];
    });

    milestones.forEach((m) => {
      const key = m.phaseId || "unassigned";
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(m);
    });

    return map;
  }, [sortedPhases, milestones]);

  const getStatusBadgeClass = (status: PhaseStatus) => {
    switch (status) {
      case "Planned":
        return "bg-secondary text-secondary-foreground";
      case "Active":
        return "bg-primary/10 text-primary";
      case "Completed":
        return "bg-accent text-accent-foreground";
      case "On_Hold":
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (prio: string) => {
    return getPriorityColors(prio).bg;
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case "To_Do":
        return "bg-muted text-muted-foreground border border-border/60";
      case "In_Progress":
        return "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
      case "Submitted_for_Review":
        return "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800";
      case "Approved":
        return "bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800";
      case "Rework":
        return "bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800";
      case "Done":
        return "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  if (isPhasesLoading || isTasksLoading || isMilestonesLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-2xl m-6 bg-muted/20">
          <FolderOpen className="size-12 text-muted-foreground mb-4" />
          <h3 className="text-base font-bold text-foreground">No Phases Defined</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
            Phases help organize your project roadmap and group tasks. Create your first phase to get started.
          </p>
          {canCreatePhases && (
            <Button
              onClick={() => setActiveForm({ type: "add-phase" })}
              className="font-bold h-9 text-xs rounded-xl"
            >
              <Plus className="mr-1.5 size-4" /> Create Your First Phase
            </Button>
          )}
        </div>
        <DeleteDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, type: null, id: "" })}
          onConfirm={handleConfirmDelete}
          title={deleteConfirm.type === "phase" ? "Delete Phase" : "Delete Milestone"}
          description={
            deleteConfirm.type === "phase"
              ? "Are you sure you want to delete this phase? Phases that still have tasks assigned cannot be deleted."
              : "Are you sure you want to delete this milestone?"
          }
          isDeleting={isDeletingPhase || isDeletingMilestone}
        />

        <DialogPrimitive.Root
          open={activeForm.type === "add-phase" || activeForm.type === "edit-phase"}
          onOpenChange={(open) => !open && setActiveForm({ type: null })}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
            <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background shadow-xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                <Flag className="size-4 text-primary" />
                <DialogPrimitive.Title className="text-sm font-bold">
                  {activeForm.type === "edit-phase" ? "Edit Phase" : "Create New Phase"}
                </DialogPrimitive.Title>
              </div>
              <PhaseForm
                key={`phase-${activeForm.type}-${activeForm.id ?? "new"}`}
                initialValues={initialPhaseValues}
                onSubmit={handleSavePhase}
                onCancel={() => setActiveForm({ type: null })}
                isSaving={isCreatingPhase || isUpdatingPhase}
                existingPhases={phases}
                phaseId={activeForm.type === "edit-phase" ? activeForm.id : undefined}
                projectStartDate={project?.startDate}
                projectEndDate={project?.endDate}
                documents={phaseDocuments}
                isDocumentsLoading={isPhaseDocsLoading}
                onDeleteDocument={handleDeleteEntityDocument}
                onImmediateUpload={editingPhaseId ? handleImmediatePhaseUpload : undefined}
                isUploadingDocument={isUploadingDocument}
                isDeletingDocument={isDeletingDocument}
                canAttach={canEditPhases || canCreatePhases}
              />
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <DialogPrimitive.Root
          open={activeForm.type === "add-milestone" || activeForm.type === "edit-milestone"}
          onOpenChange={(open) => !open && setActiveForm({ type: null })}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
            <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background shadow-xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                <Flag className="size-4 text-primary" />
                <DialogPrimitive.Title className="text-sm font-bold">
                  {activeForm.type === "edit-milestone" ? "Edit Milestone" : "Create New Milestone"}
                </DialogPrimitive.Title>
              </div>
              <MilestoneForm
                key={`milestone-${activeForm.type}-${activeForm.id ?? "new"}`}
                initialValues={initialMilestoneValues}
                phases={phases}
                onSubmit={handleSaveMilestone}
                onCancel={() => setActiveForm({ type: null })}
                isSaving={isCreatingMilestone || isUpdatingMilestone}
                projectStartDate={project?.startDate}
                projectEndDate={project?.endDate}
                otherMilestoneWeights={milestones
                  .filter((m) => m.id !== activeForm.id)
                  .map((m) => m.weight)}
                documents={milestoneDocuments}
                isDocumentsLoading={isMilestoneDocsLoading}
                onDeleteDocument={handleDeleteEntityDocument}
                onImmediateUpload={
                  editingMilestoneId ? handleImmediateMilestoneUpload : undefined
                }
                isUploadingDocument={isUploadingDocument}
                isDeletingDocument={isDeletingDocument}
                canAttach={canEditMilestones}
              />
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {sortedPhases.map((phase) => {
            const phaseTasks = tasksByPhase[phase.id] || [];
            const gateTask = phaseTasks.find((t) => t.isPhaseGate) ?? null;
            const phaseMilestones = milestonesByPhase[phase.id] || [];
            const phaseAttachments = documentsByPhase[phase.id] || [];
            const completedTasksCount = phaseTasks.filter((t) => t.status === "Done" || t.status === "Approved").length;

            const dateStr = [
              phase.startDate ? new Date(phase.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
              phase.endDate ? new Date(phase.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
            ].filter(Boolean).join(" - ");

            return (
              <div
                key={phase.id}
                className="flex flex-col lg:flex-row gap-4 border border-border rounded-xl overflow-hidden bg-background hover:shadow-xs transition-all"
              >
                {/* Phase Column */}
                <div
                  className="w-full lg:w-80 shrink-0 p-5 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-l-4 border-l-primary border-border"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-foreground leading-snug truncate">
                          {phase.name}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge className={`text-[9px] font-bold px-1.5 py-0 border-none shrink-0 ${getStatusBadgeClass(phase.status)}`}>
                            {phase.status.replace("_", " ")}
                          </Badge>
                          {phaseAttachments.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                              <Paperclip className="size-3" />
                              {phaseAttachments.length} file
                              {phaseAttachments.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      </div>
                      {(canEditPhases || canApproveProjects) && (
                      <div className="flex items-center gap-1 shrink-0">
                        {canEditPhases && (
                        <button
                          onClick={() => setActiveForm({ type: "edit-phase", id: phase.id })}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                          title="Edit Phase"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        )}
                        {canApproveProjects && (
                        <button
                          onClick={() => setDeleteConfirm({ isOpen: true, type: "phase", id: phase.id })}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                          title="Delete Phase"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                        )}
                      </div>
                      )}
                    </div>

                    {phase.description && (
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {phase.description}
                      </p>
                    )}

                    {dateStr && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                        <Calendar className="size-3.5" />
                        {dateStr}
                      </span>
                    )}

                    {phaseAttachments.length > 0 && (
                      <div className="rounded-lg border border-border/70 bg-muted/20 p-2 space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          Attachments
                        </p>
                        <DocumentAttachmentList documents={phaseAttachments} maxVisible={4} dense />
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-border space-y-3">
                    {/* Task Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                        <span>Tasks Progress</span>
                        <span>
                          {completedTasksCount} / {phaseTasks.length} Done
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{
                            width: `${phaseTasks.length > 0 ? (completedTasksCount / phaseTasks.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    {onAddTask && (
                      <Button
                        onClick={() => onAddTask(phase.id)}
                        size="xs"
                        className="w-full gap-1 h-8 rounded-lg text-xs font-bold"
                      >
                        <Plus className="size-3.5" /> Add Task to Phase
                      </Button>
                    )}
                  </div>
                </div>

                {/* Tasks & Milestones Columns */}
                <div className="flex-1 p-5 flex flex-col md:flex-row gap-6 min-w-0">
                  {/* Milestones subsection */}
                  <div className="w-full md:w-1/3 flex flex-col border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 pr-0 md:pr-4 min-w-0">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Flag className="size-3.5 text-primary" />
                        Milestones ({phaseMilestones.length})
                      </h4>
                      {canEditMilestones && (
                      <button
                        onClick={() => setActiveForm({ type: "add-milestone", phaseId: phase.id })}
                        className="flex items-center gap-0.5 text-[10px] font-bold text-primary hover:underline"
                      >
                        <Plus className="size-3" /> Add
                      </button>
                      )}
                    </div>

                    {phaseMilestones.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center p-4 border border-dashed border-border rounded-lg bg-muted/10">
                        <span className="text-[10px] text-muted-foreground">No milestones defined</span>
                      </div>
                    ) : (
                      <div className="space-y-2 overflow-y-auto max-h-56 pr-1">
                        {phaseMilestones.map((m) => {
                          const milestoneAttachments = documentsByMilestone[m.id] || [];
                          return (
                          <div
                            key={m.id}
                            className="group/milestone relative p-2.5 rounded-lg border border-border bg-muted/10 flex items-start gap-2 pr-14"
                          >
                            {m.status === "Done" ? (
                              <CheckCircle2 className="size-3.5 text-primary mt-0.5 shrink-0" />
                            ) : (
                              <Circle className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-foreground truncate block">
                                {m.title}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-medium block mt-0.5">
                                Target: {new Date(m.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                              {milestoneAttachments.length > 0 && (
                                <div className="mt-1.5 space-y-1">
                                  <span className="inline-flex items-center gap-1 text-[9px] font-medium text-muted-foreground">
                                    <Paperclip className="size-2.5" />
                                    {milestoneAttachments.length} file
                                    {milestoneAttachments.length === 1 ? "" : "s"}
                                  </span>
                                  <DocumentAttachmentList
                                    documents={milestoneAttachments}
                                    maxVisible={2}
                                    dense
                                  />
                                </div>
                              )}
                            </div>
                            {(canEditMilestones || canApproveProjects) && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/milestone:opacity-100 transition-opacity">
                              {canEditMilestones && (
                              <button
                                onClick={() => setActiveForm({ type: "edit-milestone", id: m.id })}
                                className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                                title="Edit Milestone"
                              >
                                <Edit2 className="size-3" />
                              </button>
                              )}
                              {canApproveProjects && (
                              <button
                                onClick={() => setDeleteConfirm({ isOpen: true, type: "milestone", id: m.id })}
                                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                                title="Delete Milestone"
                              >
                                <Trash2 className="size-3" />
                              </button>
                              )}
                            </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Tasks subsection */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <ListTodo className="size-3.5 text-primary" />
                      Tasks ({phaseTasks.length})
                    </h4>

                    <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          Phase sign-off
                        </span>
                      </div>
                      {gateTask ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onTaskClick(gateTask.id)}
                            className="min-w-0 flex-1 text-left rounded-md border border-border bg-card px-2.5 py-1.5 hover:bg-muted/40 transition-colors"
                          >
                            <span className="text-xs font-bold text-foreground truncate block">
                              {gateTask.title}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-medium">
                              {gateTask.status.replace(/_/g, " ")}
                            </span>
                          </button>
                          {canEditPhases && (
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              className="shrink-0 h-7 text-[10px]"
                              disabled={isUpdatingGate}
                              onClick={() => void handleSetPhaseGate(gateTask.id, false)}
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      ) : canEditPhases && phaseTasks.length > 0 ? (
                        <FilterSelect
                          value={null}
                          onValueChange={(taskId) => {
                            if (taskId) void handleSetPhaseGate(taskId, true);
                          }}
                          disabled={isUpdatingGate}
                          searchable
                          allowNone={false}
                          noneLabel="Select sign-off task…"
                          searchPlaceholder="Search tasks…"
                          className="h-8 w-full min-w-0 text-xs"
                          triggerClassName="h-8 w-full min-w-0 text-xs"
                          options={phaseTasks.map((t) => ({
                            id: t.id,
                            label: t.title,
                            subtitle: t.status.replace(/_/g, " "),
                          }))}
                        />
                      ) : (
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          {phaseTasks.length === 0
                            ? "Add a task to this phase, then set it as the sign-off."
                            : "No sign-off task set for this phase."}
                        </p>
                      )}
                    </div>

                    {phaseTasks.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center p-4 border border-dashed border-border rounded-lg bg-muted/10">
                        <span className="text-[10px] text-muted-foreground">No tasks in this phase</span>
                      </div>
                    ) : (
                      <div className="space-y-2 overflow-y-auto max-h-56 pr-1">
                        {phaseTasks.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => onTaskClick(t.id)}
                            className="p-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-foreground truncate block">
                                {t.title}
                              </span>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge className={`text-[8px] font-bold px-1.5 py-0 border shrink-0 ${getPriorityColor(t.priority)}`}>
                                  {t.priority}
                                </Badge>
                                <Badge className={`text-[8px] font-bold px-1.5 py-0 border-none shrink-0 ${getTaskStatusColor(t.status)}`}>
                                  {t.status.replace("_", " ")}
                                </Badge>
                                {t.isPhaseGate && (
                                  <Badge className="text-[8px] font-bold px-1.5 py-0 border-none shrink-0 bg-amber-500/15 text-amber-700 dark:text-amber-400">
                                    Sign-off
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {t.owner ? (
                                <div
                                  className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary border border-primary/20"
                                  title={t.owner.displayName}
                                >
                                  {t.owner.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                                </div>
                              ) : (
                                <span title="Unassigned">
                                  <User className="size-4 text-muted-foreground" />
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* UNASSIGNED TASKS SECTION (for safety / existing data) */}
          {tasksByPhase.unassigned.length > 0 && (
            <div className="flex flex-col border border-dashed border-border rounded-xl overflow-hidden bg-muted/10 p-5 space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="size-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Unassigned Tasks ({tasksByPhase.unassigned.length})
                </h3>
              </div>
              <p className="text-[11px] text-muted-foreground max-w-lg leading-relaxed">
                These tasks are not associated with any phase. Please click on them to edit and select a phase.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {tasksByPhase.unassigned.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => onTaskClick(t.id)}
                    className="p-3 rounded-lg border border-border bg-card hover:bg-muted/30 cursor-pointer flex items-center justify-between gap-3 transition-colors shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-foreground truncate block">
                        {t.title}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-medium block mt-1">
                        Priority: {t.priority} · Status: {t.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <DeleteDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, type: null, id: "" })}
        onConfirm={handleConfirmDelete}
        title={deleteConfirm.type === "phase" ? "Delete Phase" : "Delete Milestone"}
        description={
          deleteConfirm.type === "phase"
            ? "Are you sure you want to delete this phase? Phases that still have tasks assigned cannot be deleted."
            : "Are you sure you want to delete this milestone?"
        }
        isDeleting={isDeletingPhase || isDeletingMilestone}
      />

      <DialogPrimitive.Root
        open={activeForm.type === "add-phase" || activeForm.type === "edit-phase"}
        onOpenChange={(open) => !open && setActiveForm({ type: null })}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background shadow-xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-6 py-4">
              <Flag className="size-4 text-primary" />
              <DialogPrimitive.Title className="text-sm font-bold">
                {activeForm.type === "edit-phase" ? "Edit Phase" : "Create New Phase"}
              </DialogPrimitive.Title>
            </div>
            <PhaseForm
              key={`phase-${activeForm.type}-${activeForm.id ?? "new"}`}
              initialValues={initialPhaseValues}
              onSubmit={handleSavePhase}
              onCancel={() => setActiveForm({ type: null })}
              isSaving={isCreatingPhase || isUpdatingPhase}
              existingPhases={phases}
              phaseId={activeForm.type === "edit-phase" ? activeForm.id : undefined}
              projectStartDate={project?.startDate}
              projectEndDate={project?.endDate}
              documents={phaseDocuments}
              isDocumentsLoading={isPhaseDocsLoading}
              onDeleteDocument={handleDeleteEntityDocument}
              onImmediateUpload={editingPhaseId ? handleImmediatePhaseUpload : undefined}
              isUploadingDocument={isUploadingDocument}
              isDeletingDocument={isDeletingDocument}
              canAttach={canEditPhases || canCreatePhases}
            />
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root
        open={activeForm.type === "add-milestone" || activeForm.type === "edit-milestone"}
        onOpenChange={(open) => !open && setActiveForm({ type: null })}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background shadow-xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-6 py-4">
              <Flag className="size-4 text-primary" />
              <DialogPrimitive.Title className="text-sm font-bold">
                {activeForm.type === "edit-milestone" ? "Edit Milestone" : "Create New Milestone"}
              </DialogPrimitive.Title>
            </div>
            <MilestoneForm
              key={`milestone-${activeForm.type}-${activeForm.id ?? "new"}`}
              initialValues={initialMilestoneValues}
              phases={phases}
              onSubmit={handleSaveMilestone}
              onCancel={() => setActiveForm({ type: null })}
              isSaving={isCreatingMilestone || isUpdatingMilestone}
              projectStartDate={project?.startDate}
              projectEndDate={project?.endDate}
              otherMilestoneWeights={milestones
                .filter((m) => m.id !== activeForm.id)
                .map((m) => m.weight)}
              documents={milestoneDocuments}
              isDocumentsLoading={isMilestoneDocsLoading}
              onDeleteDocument={handleDeleteEntityDocument}
              onImmediateUpload={
                editingMilestoneId ? handleImmediateMilestoneUpload : undefined
              }
              isUploadingDocument={isUploadingDocument}
              isDeletingDocument={isDeletingDocument}
              canAttach={canEditMilestones}
            />
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
});
