"use client";

import React, { useState, useMemo } from "react";
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
} from "../api/projects.api";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Plus,
  Trash2,
  Edit2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Flag,
  FolderKanban,
  CheckCircle2,
  Circle,
  HelpCircle,
  FolderGit2,
} from "lucide-react";
import { PhaseStatus } from "../types/projects.types";
import { PhaseForm } from "./phase-form";
import { MilestoneForm } from "./milestone-form";
import { PhaseFormValues } from "../schemas/phase.schema";
import { MilestoneFormValues } from "../schemas/milestone.schema";
import { DeleteDialog } from "@/shared/ui/delete-dialog";

function formatWeight(weight: any): string {
  if (weight == null) return "";
  if (typeof weight === "object") {
    if (Array.isArray(weight.d)) {
      const digits = weight.d.join("");
      const exponent = weight.e ?? 0;
      const sign = weight.s === -1 ? "-" : "";
      if (exponent >= 0) {
        const intPart = digits.slice(0, exponent + 1).padEnd(exponent + 1, "0");
        const fracPart = digits.slice(exponent + 1);
        return `${sign}${intPart}${fracPart ? "." + fracPart : ""}`;
      } else {
        return `${sign}0.${"0".repeat(Math.abs(exponent) - 1)}${digits}`;
      }
    }
    return JSON.stringify(weight);
  }
  return String(weight);
}

interface PhaseMilestonePanelProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PhaseMilestonePanel({ projectId, isOpen, onClose }: PhaseMilestonePanelProps) {
  const { data: phases = [] } = useGetPhasesQuery(projectId);
  const { data: milestones = [] } = useGetMilestonesQuery(projectId);

  const [createPhase, { isLoading: isCreatingPhase }] = useCreatePhaseMutation();
  const [updatePhase, { isLoading: isUpdatingPhase }] = useUpdatePhaseMutation();
  const [deletePhase, { isLoading: isDeletingPhase }] = useDeletePhaseMutation();

  const [createMilestone, { isLoading: isCreatingMilestone }] = useCreateMilestoneMutation();
  const [updateMilestone, { isLoading: isUpdatingMilestone }] = useUpdateMilestoneMutation();
  const [deleteMilestone, { isLoading: isDeletingMilestone }] = useDeleteMilestoneMutation();

  const isPhaseSaving = isCreatingPhase || isUpdatingPhase;
  const isMilestoneSaving = isCreatingMilestone || isUpdatingMilestone;

  const [activeForm, setActiveForm] = useState<{
    type: "add-phase" | "edit-phase" | "add-milestone" | "edit-milestone" | null;
    id?: string;
  }>({ type: null });

  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "phase" | "milestone" | null;
    id: string;
  }>({
    isOpen: false,
    type: null,
    id: "",
  });

  const togglePhaseExpand = (phaseId: string) => {
    setExpandedPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

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

  // Form Initial Values
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
      phaseId: activeForm.type === "add-milestone" && activeForm.id ? activeForm.id : "unassigned",
    };
  }, [activeMilestone, activeForm]);

  // Save Handlers
  const handleSavePhase = async (values: PhaseFormValues) => {
    // Sort other phases to find the rank index of the current phase
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
      if (activeForm.type === "add-phase") {
        await createPhase({ projectId, body: payload }).unwrap();
        toast.success("Phase created successfully");
      } else if (activeForm.type === "edit-phase" && activeForm.id) {
        await updatePhase({ projectId, phaseId: activeForm.id, body: payload }).unwrap();
        toast.success("Phase updated successfully");
      }
      setActiveForm({ type: null });
    } catch (err) {
      console.error("Failed to save phase", err);
      toast.error("Failed to save phase");
    }
  };

  const handleSaveMilestone = async (values: MilestoneFormValues) => {
    const payload = {
      title: values.title,
      targetDate: new Date(values.targetDate).toISOString(),
      weight: values.weight ?? null,
      status: values.status,
      phaseId: values.phaseId === "unassigned" ? null : values.phaseId,
    };

    try {
      if (activeForm.type === "add-milestone") {
        await createMilestone({ projectId, body: payload }).unwrap();
        toast.success("Milestone created successfully");
      } else if (activeForm.type === "edit-milestone" && activeForm.id) {
        await updateMilestone({ projectId, milestoneId: activeForm.id, body: payload }).unwrap();
        toast.success("Milestone updated successfully");
      }
      setActiveForm({ type: null });
    } catch (err) {
      console.error("Failed to save milestone", err);
      toast.error("Failed to save milestone");
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
      toast.error(`Failed to delete ${type}`);
    }
  };

  const getStatusColor = (status: PhaseStatus) => {
    switch (status) {
      case "Planned":
        return "bg-muted text-muted-foreground border-border";
      case "Active":
        return "bg-primary/10 text-primary border-primary/20";
      case "Completed":
        return "bg-primary/20 text-primary border-primary/30";
      case "On_Hold":
        return "bg-destructive/10 text-destructive border-destructive/20";
    }
  };

  const deleteTitle = deleteConfirm.type === "phase" ? "Delete Phase" : "Delete Milestone";
  const deleteDescription =
    deleteConfirm.type === "phase"
      ? "Are you sure you want to delete this phase? Associated tasks and milestones will be unassigned."
      : "Are you sure you want to delete this milestone?";

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full !max-w-[700px] flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-foreground">
              <FolderGit2 className="size-5 text-primary" />
              Phases & Milestones
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Define project phases, checkpoints, and key milestones to structure your roadmap.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 flex flex-col overflow-hidden">
            {activeForm.type ? (
              activeForm.type.includes("phase") ? (
                <PhaseForm
                  initialValues={initialPhaseValues}
                  onSubmit={handleSavePhase}
                  onCancel={() => setActiveForm({ type: null })}
                  isSaving={isPhaseSaving}
                  existingPhases={phases}
                  phaseId={activeForm.id}
                />
              ) : (
                <MilestoneForm
                  initialValues={initialMilestoneValues}
                  phases={phases}
                  onSubmit={handleSaveMilestone}
                  onCancel={() => setActiveForm({ type: null })}
                  isSaving={isMilestoneSaving}
                />
              )
            ) : (
              // LIST VIEW OF PHASES & MILESTONES
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 bg-muted/30 flex gap-2 border-b border-border shrink-0">
                  <Button onClick={() => setActiveForm({ type: "add-phase" })} size="lg" variant="outline" className="flex-1 gap-1 text-xs font-semibold">
                    <Plus className="size-3.5" /> New Phase
                  </Button>
                  <Button onClick={() => setActiveForm({ type: "add-milestone" })} size="lg" className="flex-1 gap-1 text-xs font-semibold">
                    <Plus className="size-3.5" /> New Milestone
                  </Button>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                    {/* PHASES & THEIR MILESTONES */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1">
                        <FolderKanban className="size-3 text-primary" />
                        Project Phases ({phases.length})
                      </h4>

                      {phases.length === 0 ? (
                        <div className="text-center p-6 border border-dashed border-border rounded-lg">
                          <p className="text-xs text-muted-foreground">No phases defined yet.</p>
                          <Button variant="link" size="xs" onClick={() => setActiveForm({ type: "add-phase" })} className="text-primary font-semibold p-0 mt-1 h-auto">
                            Create one now
                          </Button>
                        </div>
                      ) : (
                        sortedPhases.map((phase) => {
                          const isExpanded = !!expandedPhases[phase.id];
                          const phaseMilestones = milestonesByPhase[phase.id] || [];
                          const dateStr = [
                            phase.startDate ? new Date(phase.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
                            phase.endDate ? new Date(phase.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
                          ].filter(Boolean).join(" - ");

                          return (
                            <div
                              key={phase.id}
                              className="border border-border rounded-lg overflow-hidden transition-all bg-card hover:border-border/80"
                            >
                              {/* Phase Accordion Trigger Header */}
                              <div className="flex items-center justify-between p-3 select-none">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => togglePhaseExpand(phase.id)}
                                    className="text-muted-foreground hover:text-foreground shrink-0"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="size-4" />
                                    ) : (
                                      <ChevronRight className="size-4" />
                                    )}
                                  </button>

                                  <div
                                    className="size-3 rounded-full shrink-0 bg-primary/40 border border-primary/20"
                                  />

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-foreground truncate">
                                        {phase.name}
                                      </span>
                                      <Badge className={`text-[9px] px-1.5 py-0 h-4 border ${getStatusColor(phase.status)}`}>
                                        {phase.status.replace("_", " ")}
                                      </Badge>
                                    </div>
                                    {dateStr && (
                                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                        <Calendar className="size-2.5" />
                                        {dateStr}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 ml-2">
                                  <button
                                    type="button"
                                    onClick={() => setActiveForm({ type: "add-milestone", id: phase.id })}
                                    title="Add milestone to phase"
                                    className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                  >
                                    <Plus className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActiveForm({ type: "edit-phase", id: phase.id })}
                                    title="Edit phase"
                                    className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                  >
                                    <Edit2 className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirm({ isOpen: true, type: "phase", id: phase.id })}
                                    title="Delete phase"
                                    className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Phase description if expanded */}
                              {isExpanded && phase.description && (
                                <div className="px-4 pb-2 text-[11px] text-muted-foreground italic">
                                  {phase.description}
                                </div>
                              )}

                              {/* Collapsible Milestones list inside phase */}
                              {isExpanded && (
                                <div className="bg-muted/20 border-t border-border p-2 space-y-1">
                                  <div className="text-[9px] font-bold text-muted-foreground px-2 pb-1 uppercase tracking-wider">
                                    Milestones ({phaseMilestones.length})
                                  </div>

                                  {phaseMilestones.length === 0 ? (
                                    <div className="text-center p-3 text-[10px] text-muted-foreground">
                                      No milestones in this phase.
                                      <button
                                        onClick={() => setActiveForm({ type: "add-milestone", id: phase.id })}
                                        className="text-primary font-bold ml-1 hover:underline"
                                      >
                                        Add Milestone
                                      </button>
                                    </div>
                                  ) : (
                                    phaseMilestones.map((m) => (
                                      <div
                                        key={m.id}
                                        className="flex items-center justify-between p-2 rounded border border-border bg-card"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {m.status === "Done" ? (
                                            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                          ) : (
                                            <Circle className="size-3.5 text-muted-foreground/60 shrink-0" />
                                          )}
                                          <div className="min-w-0">
                                            <span className="text-xs font-medium text-foreground truncate block">
                                              {m.title}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                              <Calendar className="size-2.5" />
                                              {new Date(m.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                              {m.weight != null && (
                                                <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 rounded ml-1">
                                                  Weight: {formatWeight(m.weight)}%
                                                </span>
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 ml-2">
                                          <button
                                            type="button"
                                            onClick={() => setActiveForm({ type: "edit-milestone", id: m.id })}
                                            className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                          >
                                            <Edit2 className="size-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setDeleteConfirm({ isOpen: true, type: "milestone", id: m.id })}
                                            className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                          >
                                            <Trash2 className="size-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* UNASSIGNED MILESTONES SECTION */}
                    {milestonesByPhase.unassigned.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1">
                          <HelpCircle className="size-3 text-muted-foreground" />
                          Unassigned Milestones ({milestonesByPhase.unassigned.length})
                        </h4>

                        <div className="space-y-1.5">
                          {milestonesByPhase.unassigned.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between p-2 rounded-lg border border-border bg-card"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {m.status === "Done" ? (
                                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                ) : (
                                  <Circle className="size-3.5 text-muted-foreground/60 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <span className="text-xs font-semibold text-foreground truncate block">
                                    {m.title}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Calendar className="size-2.5" />
                                    {new Date(m.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                <button
                                  type="button"
                                  onClick={() => setActiveForm({ type: "edit-milestone", id: m.id })}
                                  className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                >
                                  <Edit2 className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm({ isOpen: true, type: "milestone", id: m.id })}
                                  className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <DeleteDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, type: null, id: "" })}
        onConfirm={handleConfirmDelete}
        title={deleteTitle}
        description={deleteDescription}
        isDeleting={deleteConfirm.type === "phase" ? isDeletingPhase : isDeletingMilestone}
      />
    </>
  );
}
