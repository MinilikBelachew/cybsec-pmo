"use client";

import { useState } from "react";
import { Flag, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { ProjectMilestone } from "../../types/projects.types";

export type DraftProjectMilestone = {
  clientId: string;
  title: string;
  targetDate: string;
  weight?: number | null;
  status: string;
  persistedId?: string;
};

type ProjectFormMilestonesSectionProps = {
  existingMilestones?: ProjectMilestone[];
  drafts: DraftProjectMilestone[];
  onDraftsChange: (drafts: DraftProjectMilestone[]) => void;
};

function draftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

export function ProjectFormMilestonesSection({
  existingMilestones = [],
  drafts,
  onDraftsChange,
}: ProjectFormMilestonesSectionProps) {
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [weight, setWeight] = useState("");

  function handleAddDraft() {
    if (!title.trim() || !targetDate) return;

    onDraftsChange([
      ...drafts,
      {
        clientId: draftId(),
        title: title.trim(),
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
    <section className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
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
              className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{milestone.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(milestone.targetDate).toLocaleDateString()}
                  {milestone.weight != null ? ` · ${milestone.weight}%` : ""}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground">{milestone.status}</span>
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
              className="flex items-center justify-between rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{draft.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(draft.targetDate).toLocaleDateString()}
                  {draft.weight != null ? ` · ${draft.weight}%` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeDraft(draft.clientId)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove milestone"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_160px_100px_auto]">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Phase 1 sign-off"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Target date</Label>
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Weight %</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" onClick={handleAddDraft} className="w-full">
            <Plus className="mr-1 size-3.5" />
            Add
          </Button>
        </div>
      </div>
    </section>
  );
}
