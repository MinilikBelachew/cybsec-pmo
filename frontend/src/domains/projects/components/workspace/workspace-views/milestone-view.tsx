"use client";

import React, { useMemo, useState, useImperativeHandle, forwardRef } from "react";
import { toast } from "react-hot-toast";
import {
  useGetPhasesQuery,
  useGetMilestonesQuery,
  useCreateMilestoneMutation,
  useUpdateMilestoneMutation,
  useDeleteMilestoneMutation,
  useGetProjectByIdQuery,
} from "../../../api/projects.api";
import { useUploadFileMutation } from "../../../api/files.api";
import {
  useCreateProjectDocumentMutation,
  useDeleteProjectDocumentMutation,
  useGetProjectDocumentsQuery,
} from "../../../api/project-documents.api";
import type { WorkspaceDocumentCategory } from "../../../types/project-documents.types";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import { MilestoneForm } from "../../roadmap/milestone-form";
import { MilestoneFormValues } from "../../../schemas/milestone/milestone.schema";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Flag,
  Plus,
  Loader2,
  Milestone,
  Trash2,
  Edit2,
} from "lucide-react";
import { useModulePermissions } from "@/domains/auth/hooks/use-module-permissions";

export interface MilestoneViewRef {
  openAddMilestone: () => void;
}

interface MilestoneViewProps {
  projectId: string;
}

export const MilestoneView = forwardRef<MilestoneViewRef, MilestoneViewProps>(
  function MilestoneView({ projectId }, ref) {
    const { canEditMilestones, canApproveProjects } = useModulePermissions();
    const { data: project } = useGetProjectByIdQuery(projectId);
    const { data: phases = [], isLoading: isPhasesLoading } = useGetPhasesQuery(projectId);
    const { data: milestones = [], isLoading: isMilestonesLoading } =
      useGetMilestonesQuery(projectId);

    const [createMilestone, { isLoading: isCreatingMilestone }] = useCreateMilestoneMutation();
    const [updateMilestone, { isLoading: isUpdatingMilestone }] = useUpdateMilestoneMutation();
    const [deleteMilestone, { isLoading: isDeletingMilestone }] = useDeleteMilestoneMutation();
    const [uploadFile, { isLoading: isUploadingFile }] = useUploadFileMutation();
    const [createDocument, { isLoading: isCreatingDocument }] = useCreateProjectDocumentMutation();
    const [deleteDocument, { isLoading: isDeletingDocument }] = useDeleteProjectDocumentMutation();

    const [activeForm, setActiveForm] = useState<{
      type: "add-milestone" | "edit-milestone" | null;
      id?: string;
      phaseId?: string;
    }>({ type: null });

    const [deleteConfirm, setDeleteConfirm] = useState<{
      isOpen: boolean;
      id: string;
    }>({ isOpen: false, id: "" });

    useImperativeHandle(
      ref,
      () => ({
        openAddMilestone: () => {
          if (!canEditMilestones) return;
          setActiveForm({ type: "add-milestone" });
        },
      }),
      [canEditMilestones],
    );

    const editingMilestoneId =
      activeForm.type === "edit-milestone" && activeForm.id ? activeForm.id : undefined;

    const { data: milestoneDocuments = [], isLoading: isMilestoneDocsLoading } =
      useGetProjectDocumentsQuery(
        { projectId, category: "Milestone", milestoneId: editingMilestoneId },
        { skip: !editingMilestoneId },
      );

    const { data: allDocuments = [] } = useGetProjectDocumentsQuery({ projectId });

    const docCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      for (const doc of allDocuments) {
        if (doc.milestoneId) {
          counts[doc.milestoneId] = (counts[doc.milestoneId] ?? 0) + 1;
        }
      }
      return counts;
    }, [allDocuments]);

    const isUploadingDocument = isUploadingFile || isCreatingDocument;

    const sortedPhases = useMemo(() => {
      return [...phases].sort((a, b) => {
        if (!a.startDate && !b.startDate) return a.name.localeCompare(b.name);
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });
    }, [phases]);

    const sortedMilestones = useMemo(() => {
      return [...milestones].sort((a, b) => {
        const aTime = a.targetDate ? new Date(a.targetDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.targetDate ? new Date(b.targetDate).getTime() : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return a.title.localeCompare(b.title);
      });
    }, [milestones]);

    const milestonesByPhase = useMemo(() => {
      const map: Record<string, typeof milestones> = { unassigned: [] };
      sortedPhases.forEach((p) => {
        map[p.id] = [];
      });
      milestones.forEach((m) => {
        const key = m.phaseId || "unassigned";
        if (!map[key]) map[key] = [];
        map[key].push(m);
      });
      for (const key of Object.keys(map)) {
        map[key].sort((a, b) => {
          const aTime = a.targetDate ? new Date(a.targetDate).getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.targetDate ? new Date(b.targetDate).getTime() : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        });
      }
      return map;
    }, [sortedPhases, milestones]);

    const phaseNameById = useMemo(() => {
      const map: Record<string, string> = {};
      for (const p of phases) map[p.id] = p.name;
      return map;
    }, [phases]);

    const activeMilestone = useMemo(() => {
      if (activeForm.type === "edit-milestone" && activeForm.id) {
        return milestones.find((m) => m.id === activeForm.id);
      }
      return undefined;
    }, [activeForm, milestones]);

    const initialMilestoneValues = useMemo<MilestoneFormValues>(() => {
      if (activeMilestone) {
        return {
          title: activeMilestone.title,
          targetDate: activeMilestone.targetDate
            ? activeMilestone.targetDate.slice(0, 10)
            : "",
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
        phaseId:
          activeForm.type === "add-milestone" && activeForm.phaseId
            ? activeForm.phaseId
            : "unassigned",
      };
    }, [activeMilestone, activeForm]);

    async function uploadEntityDocuments(params: {
      entityId: string;
      category: Extract<WorkspaceDocumentCategory, "Milestone">;
      files: File[];
    }) {
      for (const file of params.files) {
        const uploaded = await uploadFile(file).unwrap();
        await createDocument({
          projectId,
          storageKey: uploaded.storageKey || uploaded.file.path,
          filename: uploaded.filename || file.name,
          mimeType: uploaded.mimeType || file.type,
          sizeBytes: uploaded.sizeBytes || file.size,
          category: params.category,
          milestoneId: params.entityId,
        }).unwrap();
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
        const apiError = err as { data?: { message?: string; errors?: Record<string, string> } };
        toast.error(
          apiError?.data?.message ??
            Object.values(apiError?.data?.errors ?? {})[0] ??
            "Failed to attach file to milestone",
        );
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
          if (!milestoneId) throw new Error("Milestone created without id");
          toast.success("Milestone created successfully");
        } else if (activeForm.type === "edit-milestone" && activeForm.id) {
          await updateMilestone({
            projectId,
            milestoneId: activeForm.id,
            body: payload,
          }).unwrap();
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
        toast.error("Failed to save milestone");
      }
    };

    const handleConfirmDelete = async () => {
      const { id } = deleteConfirm;
      if (!id) return;
      try {
        await deleteMilestone({ projectId, milestoneId: id }).unwrap();
        toast.success("Milestone deleted successfully");
        if (activeForm.type === "edit-milestone" && activeForm.id === id) {
          setActiveForm({ type: null });
        }
        setDeleteConfirm({ isOpen: false, id: "" });
      } catch (err) {
        console.error("Failed to delete milestone", err);
        const apiError = err as { data?: { message?: string; errors?: Record<string, string> } };
        toast.error(
          apiError?.data?.message ||
            (apiError?.data?.errors ? Object.values(apiError.data.errors)[0] : undefined) ||
            "Failed to delete milestone",
        );
      }
    };

    function renderMilestoneCard(m: (typeof milestones)[number], showPhase = false) {
      const phaseLabel = m.phaseId ? phaseNameById[m.phaseId] : null;
      const attachmentCount = docCounts[m.id] ?? 0;

      return (
        <div
          key={m.id}
          className="group relative flex items-start gap-3 rounded-xl border border-border bg-background p-4 pr-16 hover:shadow-xs transition-all"
        >
          {m.status === "Done" ? (
            <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
          ) : (
            <Circle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-foreground truncate">{m.title}</span>
              <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0">
                {m.status.replace("_", " ")}
              </Badge>
              {attachmentCount > 0 && (
                <span className="text-[10px] text-muted-foreground font-medium">
                  {attachmentCount} file{attachmentCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-medium">
              {m.targetDate && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3" />
                  {new Date(m.targetDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
              {showPhase && (
                <span className="inline-flex items-center gap-1">
                  <Flag className="size-3 text-primary" />
                  {phaseLabel || "Unassigned"}
                </span>
              )}
              {m.weight != null && <span>Weight: {String(m.weight)}</span>}
            </div>
          </div>
          {(canEditMilestones || canApproveProjects) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {canEditMilestones && (
                <button
                  onClick={() => setActiveForm({ type: "edit-milestone", id: m.id })}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                  title="Edit Milestone"
                >
                  <Edit2 className="size-3.5" />
                </button>
              )}
              {canApproveProjects && (
                <button
                  onClick={() => setDeleteConfirm({ isOpen: true, id: m.id })}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                  title="Delete Milestone"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    if (isPhasesLoading || isMilestonesLoading) {
      return (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-8">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Milestone className="size-4 text-primary" />
                    All milestones
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Standalone list of every milestone in this project
                  </p>
                </div>
                {canEditMilestones && (
                  <Button
                    size="sm"
                    className="h-8 text-xs rounded-lg"
                    onClick={() => setActiveForm({ type: "add-milestone" })}
                  >
                    <Plus className="mr-1 size-3.5" />
                    Add Milestone
                  </Button>
                )}
              </div>

              {sortedMilestones.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center border-2 border-dashed border-border rounded-2xl bg-muted/20">
                  <Milestone className="size-10 text-muted-foreground mb-3" />
                  <h4 className="text-sm font-bold text-foreground">No milestones yet</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1">
                    Create milestones to track key delivery dates, standalone or under a phase.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedMilestones.map((m) => renderMilestoneCard(m, true))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Flag className="size-4 text-primary" />
                  By phase
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Same milestones grouped under their parent phase
                </p>
              </div>

              {sortedPhases.length === 0 && (milestonesByPhase.unassigned?.length ?? 0) === 0 ? (
                <div className="p-6 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
                  Create a phase to organize milestones by phase.
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedPhases.map((phase) => {
                    const phaseMilestones = milestonesByPhase[phase.id] || [];
                    return (
                      <div
                        key={phase.id}
                        className="rounded-xl border border-border overflow-hidden bg-background"
                      >
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/20">
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-foreground truncate">
                              {phase.name}
                            </h4>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {phaseMilestones.length} milestone
                              {phaseMilestones.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          {canEditMilestones && (
                            <button
                              onClick={() =>
                                setActiveForm({ type: "add-milestone", phaseId: phase.id })
                              }
                              className="flex items-center gap-0.5 text-[10px] font-bold text-primary hover:underline shrink-0"
                            >
                              <Plus className="size-3" /> Add
                            </button>
                          )}
                        </div>
                        <div className="p-3 space-y-2">
                          {phaseMilestones.length === 0 ? (
                            <div className="py-6 text-center text-[11px] text-muted-foreground border border-dashed border-border rounded-lg">
                              No milestones in this phase
                            </div>
                          ) : (
                            phaseMilestones.map((m) => renderMilestoneCard(m))
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {(milestonesByPhase.unassigned?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-border overflow-hidden bg-background">
                      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/20">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">Unassigned</h4>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {milestonesByPhase.unassigned.length} milestone
                            {milestonesByPhase.unassigned.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {canEditMilestones && (
                          <button
                            onClick={() => setActiveForm({ type: "add-milestone" })}
                            className="flex items-center gap-0.5 text-[10px] font-bold text-primary hover:underline shrink-0"
                          >
                            <Plus className="size-3" /> Add
                          </button>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        {milestonesByPhase.unassigned.map((m) => renderMilestoneCard(m))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>

        <DeleteDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, id: "" })}
          onConfirm={handleConfirmDelete}
          title="Delete Milestone"
          description="Are you sure you want to delete this milestone?"
          isDeleting={isDeletingMilestone}
        />

        <DialogPrimitive.Root
          open={activeForm.type === "add-milestone" || activeForm.type === "edit-milestone"}
          onOpenChange={(open) => !open && setActiveForm({ type: null })}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
            <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background shadow-xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                <Milestone className="size-4 text-primary" />
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
  },
);
