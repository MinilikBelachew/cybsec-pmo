"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Flag, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { toDateString } from "@/shared/utils/date";
import { ProjectDatePicker, startOfToday } from "../shared/project-date-picker";
import type { ProjectMilestone } from "../../types/projects.types";

export type DraftProjectMilestone = {
  clientId: string;
  title: string;
  targetDate: string;
  weight?: number | null;
  status: string;
  persistedId?: string;
};

export interface ProjectFormMilestonesSectionHandle {
  getUnsavedMilestone: () => { title: string; targetDate: string; weight: string };
  clearUnsavedMilestone: () => void;
}

type ProjectFormMilestonesSectionProps = {
  drafts: DraftProjectMilestone[];
  onDraftsChange: (drafts: DraftProjectMilestone[]) => void;
  projectStartDate?: Date;
  projectEndDate?: Date;
  error?: string;
  readOnly?: boolean;
};

const MILESTONE_TITLE_MAX = 255;

function draftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Calendar YYYY-MM-DD from Date or ISO string without UTC day-shift. */
export function toMilestoneDateOnly(value?: string | Date | null): string {
  if (!value) return "";
  if (value instanceof Date) return toDateString(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : toDateString(parsed);
}

export function formatMilestoneDateLabel(value?: string | Date | null): string {
  const ymd = toMilestoneDateOnly(value);
  if (!ymd) return "";
  const [year, month, day] = ymd.split("-").map(Number);
  const local = new Date(year, month - 1, day);
  return local.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Stable API date — noon UTC so @db.Date does not shift by timezone. */
export function toMilestoneApiDate(dateOnly: string): string {
  const ymd = toMilestoneDateOnly(dateOnly);
  return `${ymd}T12:00:00.000Z`;
}

export function existingMilestonesToDrafts(
  milestones: ProjectMilestone[],
): DraftProjectMilestone[] {
  return milestones.map((milestone) => ({
    clientId: milestone.id,
    persistedId: milestone.id,
    title: milestone.title,
    targetDate: toMilestoneDateOnly(milestone.targetDate),
    weight: milestone.weight ?? null,
    status: milestone.status || "Pending",
  }));
}

export function isMilestoneDateOutOfRange(
  targetDate: string,
  projectStartDate?: Date,
  projectEndDate?: Date,
): string | null {
  const target = toMilestoneDateOnly(targetDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    return "Enter a valid target date.";
  }

  if (projectEndDate) {
    const end = toMilestoneDateOnly(projectEndDate);
    if (target > end) {
      return "Milestone target date cannot be after the project end date.";
    }
  }

  if (projectStartDate) {
    const start = toMilestoneDateOnly(projectStartDate);
    if (target < start) {
      return "Milestone target date cannot be before the project start date.";
    }
  }

  return null;
}

export function toDraftMilestonePayload(drafts: DraftProjectMilestone[]) {
  return drafts
    .filter((draft) => !draft.persistedId && draft.title.trim() && draft.targetDate)
    .map((draft) => ({
      title: draft.title.trim(),
      targetDate: draft.targetDate,
      weight: draft.weight ?? undefined,
      status: draft.status || "Pending",
    }));
}

export function toPersistedMilestonePayload(drafts: DraftProjectMilestone[]) {
  return drafts
    .filter((draft) => draft.persistedId && draft.title.trim() && draft.targetDate)
    .map((draft) => ({
      id: draft.persistedId as string,
      title: draft.title.trim(),
      targetDate: draft.targetDate,
      weight: draft.weight ?? undefined,
      status: draft.status || "Pending",
    }));
}

export const ProjectFormMilestonesSection = forwardRef<
  ProjectFormMilestonesSectionHandle,
  ProjectFormMilestonesSectionProps
>(function ProjectFormMilestonesSection(
  {
    drafts,
    onDraftsChange,
    projectStartDate,
    projectEndDate,
    error,
    readOnly = false,
  },
  ref,
) {
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [weight, setWeight] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [showFields, setShowFields] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setTargetDate("");
    setWeight("");
    setLocalError(null);
    setShowFields(false);
    setEditingClientId(null);
  }

  useImperativeHandle(ref, () => ({
    getUnsavedMilestone: () => {
      if (!showFields || editingClientId) {
        return { title: "", targetDate: "", weight: "" };
      }
      return { title, targetDate, weight };
    },
    clearUnsavedMilestone: () => {
      resetForm();
    },
  }));

  function startEdit(draft: DraftProjectMilestone) {
    setEditingClientId(draft.clientId);
    setTitle(draft.title);
    setTargetDate(draft.targetDate);
    setWeight(draft.weight != null ? String(draft.weight) : "");
    setLocalError(null);
    setShowFields(true);
  }

  function handleSaveDraft() {
    const normalizedTitle = title.trim().replace(/\s+/g, " ");
    if (!normalizedTitle) {
      setLocalError("Milestone title is required.");
      return;
    }
    if (normalizedTitle.length > MILESTONE_TITLE_MAX) {
      setLocalError(`Milestone title must be ${MILESTONE_TITLE_MAX} characters or fewer.`);
      return;
    }
    if (!targetDate) {
      setLocalError("Milestone target date is required.");
      return;
    }

    const dateError = isMilestoneDateOutOfRange(
      targetDate,
      projectStartDate,
      projectEndDate,
    );
    if (dateError) {
      setLocalError(dateError);
      return;
    }

    if (weight) {
      const wVal = Number(weight);
      if (Number.isNaN(wVal) || wVal < 0 || wVal > 100) {
        setLocalError("Milestone weight % must be between 0 and 100.");
        return;
      }
    }

    const nextWeight = weight ? Number(weight) : null;
    setLocalError(null);

    if (editingClientId) {
      onDraftsChange(
        drafts.map((draft) =>
          draft.clientId === editingClientId
            ? {
                ...draft,
                title: normalizedTitle,
                targetDate,
                weight: nextWeight,
              }
            : draft,
        ),
      );
    } else {
      onDraftsChange([
        ...drafts,
        {
          clientId: draftId(),
          title: normalizedTitle,
          targetDate,
          weight: nextWeight,
          status: "Pending",
        },
      ]);
    }

    resetForm();
  }

  function removeDraft(clientId: string) {
    if (editingClientId === clientId) {
      resetForm();
    }
    onDraftsChange(drafts.filter((draft) => draft.clientId !== clientId));
  }

  return (
    <section
      id="project-milestones-section"
      className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.02]"
    >
      <div className="flex items-center gap-2">
        <Flag className="size-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Milestones <span className="font-normal text-muted-foreground">(optional)</span>
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Add key checkpoints now or manage them later in the project workspace.
          </p>
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {drafts.some((d) => d.persistedId) ? "Milestones" : "Milestones to create"}
          </p>
          {drafts.map((draft) => (
            <div
              key={draft.clientId}
              className={`flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                draft.persistedId
                  ? "border-border/60 bg-background"
                  : "border-dashed border-primary/30 bg-primary/5"
              } ${editingClientId === draft.clientId ? "ring-2 ring-primary/30" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{draft.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {formatMilestoneDateLabel(draft.targetDate)}
                  {draft.weight != null ? ` · ${draft.weight}%` : ""}
                  {draft.persistedId ? "" : " · new"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{draft.status}</span>
                {!readOnly && (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(draft)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Edit milestone"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    {!draft.persistedId && (
                      <button
                        type="button"
                        onClick={() => removeDraft(draft.clientId)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                        aria-label="Remove milestone"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!readOnly &&
        (showFields ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <Label className="text-[11px] text-muted-foreground">Title</Label>
              <Input
                value={title}
                maxLength={MILESTONE_TITLE_MAX}
                onChange={(event) => {
                  setTitle(event.target.value.replace(/[\r\n]+/g, " "));
                  setLocalError(null);
                }}
                placeholder="e.g. Phase 1 sign-off"
                className="min-w-0 h-8"
              />
            </div>
            <div className="w-full shrink-0 space-y-1 lg:w-[180px]">
              <Label className="text-[11px] text-muted-foreground">Target date</Label>
              <ProjectDatePicker
                value={targetDate || undefined}
                onChange={(date) => {
                  setTargetDate(date ? toDateString(date) : "");
                  setLocalError(null);
                }}
                minDate={projectStartDate ?? startOfToday()}
                maxDate={projectEndDate}
                placeholder="Pick a date"
                className="h-8"
              />
            </div>
            <div className="w-full shrink-0 space-y-1 lg:w-[100px]">
              <Label className="text-[11px] text-muted-foreground">Weight %</Label>
              <Input
                type="number"
                value={weight}
                onChange={(event) => {
                  setWeight(event.target.value);
                  setLocalError(null);
                }}
                placeholder="Optional"
                className="h-8"
              />
            </div>
            <div className="flex shrink-0 items-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm} className="w-full lg:w-auto">
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveDraft} className="w-full lg:w-auto">
                {editingClientId ? (
                  "Update"
                ) : (
                  <>
                    <Plus className="mr-1 size-3.5" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowFields(true);
              setLocalError(null);
            }}
            className="w-full lg:w-auto"
          >
            <Plus className="mr-1 size-3.5" />
            Add Milestones
          </Button>
        ))}

      {(localError || error) && (
        <p className="mt-2 text-[11px] font-semibold text-rose-500">{localError || error}</p>
      )}
    </section>
  );
});
