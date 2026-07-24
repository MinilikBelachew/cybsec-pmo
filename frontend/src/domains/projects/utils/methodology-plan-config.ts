import type { ProjectMethodology } from "@/domains/projects/types/projects.types";

/** Plan views that methodology can reorder / default. Shared ops tabs stay after these. */
export type MethodologyPlanView =
  | "list"
  | "board"
  | "calendar"
  | "gantt"
  | "table"
  | "phases"
  | "milestones";

export type MethodologyPlanProfile = {
  defaultView: MethodologyPlanView;
  primaryViews: readonly MethodologyPlanView[];
  planViewOrder: readonly MethodologyPlanView[];
};

/**
 * DEF-P1-038 — methodology drives plan UX (default view + tab order),
 * not a separate data model / sprint engine.
 */
export const METHODOLOGY_PLAN: Record<ProjectMethodology, MethodologyPlanProfile> = {
  Agile: {
    defaultView: "board",
    primaryViews: ["board", "list", "calendar"],
    planViewOrder: ["board", "list", "calendar", "table", "gantt", "phases", "milestones"],
  },
  Waterfall: {
    defaultView: "gantt",
    primaryViews: ["gantt", "phases", "milestones", "list"],
    planViewOrder: ["gantt", "phases", "milestones", "list", "table", "board", "calendar"],
  },
  Hybrid: {
    defaultView: "list",
    primaryViews: ["list", "board", "gantt", "phases", "milestones"],
    planViewOrder: ["list", "board", "gantt", "phases", "milestones", "calendar", "table"],
  },
};

const SHARED_VIEWS = ["team", "docs", "actions", "audit"] as const;

export function resolveMethodology(
  value: string | null | undefined,
): ProjectMethodology {
  if (value === "Waterfall" || value === "Hybrid" || value === "Agile") {
    return value;
  }
  return "Agile";
}

export function getMethodologyPlanProfile(
  methodology: string | null | undefined,
): MethodologyPlanProfile {
  return METHODOLOGY_PLAN[resolveMethodology(methodology)];
}

export function orderViewsForMethodology<T extends { id: string }>(
  views: T[],
  methodology: string | null | undefined,
): T[] {
  const profile = getMethodologyPlanProfile(methodology);
  const byId = new Map(views.map((view) => [view.id, view]));
  const ordered: T[] = [];

  for (const id of profile.planViewOrder) {
    const view = byId.get(id);
    if (view) ordered.push(view);
  }

  for (const id of SHARED_VIEWS) {
    const view = byId.get(id);
    if (view) ordered.push(view);
  }

  // Any unexpected views stay at the end
  for (const view of views) {
    if (!ordered.includes(view)) ordered.push(view);
  }

  return ordered;
}

export function getMethodologyDefaultView(
  methodology: string | null | undefined,
): MethodologyPlanView {
  return getMethodologyPlanProfile(methodology).defaultView;
}

export function isPrimaryMethodologyView(
  methodology: string | null | undefined,
  viewId: string,
): boolean {
  return (getMethodologyPlanProfile(methodology).primaryViews as readonly string[]).includes(
    viewId,
  );
}
