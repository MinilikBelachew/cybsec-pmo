"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Flag, Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
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
  existingMilestones?: ProjectMilestone[];
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

function toDateInputValue(date?: Date): string | undefined {
  if (!date) return undefined;
  return date.toISOString().slice(0, 10);
}

export function isMilestoneDateOutOfRange(
  targetDate: string,
  projectStartDate?: Date,
  projectEndDate?: Date,
): string | null {
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) {
    return "Enter a valid target date.";
  }

  if (projectEndDate) {
    const end = new Date(projectEndDate);
    end.setHours(23, 59, 59, 999);
    if (target > end) {
      return "Milestone target date cannot be after the project end date.";
    }
  }

  if (projectStartDate) {
    const start = new Date(projectStartDate);
    start.setHours(0, 0, 0, 0);
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

export const ProjectFormMilestonesSection = forwardRef<
  ProjectFormMilestonesSectionHandle,
  ProjectFormMilestonesSectionProps
>(function ProjectFormMilestonesSection({
  existingMilestones = [],
  drafts,
  onDraftsChange,
  projectStartDate,
  projectEndDate,
  error,
  readOnly = false,
}, ref) {
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [weight, setWeight] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [showFields, setShowFields] = useState(false);

  useImperativeHandle(ref, () => ({
    getUnsavedMilestone: () => {
      if (!showFields) return { title: "", targetDate: "", weight: "" };
      return { title, targetDate, weight };
    },
    clearUnsavedMilestone: () => {
      setTitle("");
      setTargetDate("");
      setWeight("");
      setLocalError(null);
      setShowFields(false);
    },
  }));

  function handleAddDraft() {
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

    setLocalError(null);
    onDraftsChange([
      ...drafts,
      {
        clientId: draftId(),
        title: normalizedTitle,
        targetDate,
        weight: weight ? Number(weight) : null,
        status: "Pending",
      },
    ]);
    setTitle("");
    setTargetDate("");
    setWeight("");
  }

  function removeDraft(clientId: string) {
    onDraftsChange(drafts.filter((draft) => draft.clientId !== clientId));
  }

  const newDrafts = drafts.filter((draft) => !draft.persistedId);

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

      {existingMilestones.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Saved milestones
          </p>
          {existingMilestones.map((milestone) => (
            <div
              key={milestone.id}
              className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{milestone.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {new Date(milestone.targetDate).toLocaleDateString()}
                  {milestone.weight != null ? ` · ${milestone.weight}%` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">{milestone.status}</span>
            </div>
          ))}
        </div>
      )}

      {newDrafts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {existingMilestones.length > 0 ? "New milestones to add" : "Milestones to create"}
          </p>
          {newDrafts.map((draft) => (
            <div
              key={draft.clientId}
              className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{draft.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {new Date(draft.targetDate).toLocaleDateString()}
                  {draft.weight != null ? ` · ${draft.weight}%` : ""}
                </p>
              </div>
              {!readOnly && (
              <button
                type="button"
                onClick={() => removeDraft(draft.clientId)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remove milestone"
              >
                <Trash2 className="size-4" />
              </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (showFields ? (
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
                setTargetDate(date ? date.toISOString().slice(0, 10) : "");
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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTitle("");
                setTargetDate("");
                setWeight("");
                setLocalError(null);
                setShowFields(false);
              }}
              className="w-full lg:w-auto"
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddDraft} className="w-full lg:w-auto">
              <Plus className="mr-1 size-3.5" />
              Add
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
        <p className="text-[11px] font-semibold text-rose-500 mt-2">
          {localError || error}
        </p>
      )}
    </section>
  );
});
