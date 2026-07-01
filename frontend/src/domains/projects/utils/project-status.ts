import type { ProjectStatus } from "../types/projects.types";

export const PROJECT_STATUSES = [
  "Draft",
  "Active",
  "OnHold",
  "AtRisk",
  "PendingClosure",
  "Closed",
  "Cancelled",
] as const satisfies readonly ProjectStatus[];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  Draft: "Draft",
  Active: "Active",
  OnHold: "On Hold",
  AtRisk: "At Risk",
  PendingClosure: "Pending Closure",
  Closed: "Closed",
  Cancelled: "Cancelled",
};

export const PROJECT_CLOSURE_APPROVER_ROLES = ["super_admin", "pmo_lead"];

export const PROJECT_STATUS_TRANSITIONS: Record<
  ProjectStatus,
  ProjectStatus[]
> = {
  Draft: ["Active", "Cancelled"],
  Active: ["OnHold", "AtRisk", "PendingClosure", "Cancelled"],
  OnHold: ["Active", "Cancelled"],
  AtRisk: ["Active", "OnHold", "PendingClosure", "Cancelled"],
  PendingClosure: ["Closed", "Active"],
  Closed: [],
  Cancelled: [],
};

export const PROJECT_CREATE_ALLOWED_STATUSES: ProjectStatus[] = ["Draft"];

export function getProjectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_LABELS[status] ?? status;
}

export function getAllowedProjectStatusTransitions(
  from: ProjectStatus,
  roleCode?: string,
): ProjectStatus[] {
  const base = PROJECT_STATUS_TRANSITIONS[from] ?? [];

  if (from === "PendingClosure") {
    const canClose =
      roleCode && PROJECT_CLOSURE_APPROVER_ROLES.includes(roleCode);
    return base.filter(
      (status) => status !== "Closed" || Boolean(canClose),
    );
  }

  return base;
}

export function getSelectableProjectStatuses(
  current: ProjectStatus | undefined,
  roleCode?: string,
  isCreate = false,
): ProjectStatus[] {
  if (isCreate || !current) {
    return PROJECT_CREATE_ALLOWED_STATUSES;
  }

  return [current, ...getAllowedProjectStatusTransitions(current, roleCode)];
}

export const PROJECT_STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  Active: {
    label: "Active",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  OnHold: {
    label: "On Hold",
    dot: "bg-amber-400",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
  },
  AtRisk: {
    label: "At Risk",
    dot: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    border: "border-orange-200 dark:border-orange-800",
  },
  PendingClosure: {
    label: "Pending Closure",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-rose-200 dark:border-rose-800",
  },
  Closed: {
    label: "Closed",
    dot: "bg-primary",
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
  },
  Cancelled: {
    label: "Cancelled",
    dot: "bg-slate-500",
    text: "text-slate-700 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-900/20",
    border: "border-slate-200 dark:border-slate-800",
  },
  Draft: {
    label: "Draft",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    bg: "bg-muted/40",
    border: "border-border",
  },
};

export function getProjectStatusConfig(status: string) {
  if (PROJECT_STATUSES.includes(status as ProjectStatus)) {
    return PROJECT_STATUS_CONFIG[status as ProjectStatus];
  }
  return PROJECT_STATUS_CONFIG.Draft;
}

export const PROJECT_STATUS_FILTER_OPTIONS: {
  value: ProjectStatus | "all";
  label: string;
  description: string;
  dot: string;
}[] = [
  { value: "all", label: "All statuses", description: "Every project in your portfolio", dot: "bg-muted-foreground" },
  { value: "Active", label: "Active", description: "Currently in delivery", dot: "bg-emerald-500" },
  { value: "AtRisk", label: "At risk", description: "Delivery health concerns", dot: "bg-orange-500" },
  { value: "PendingClosure", label: "Pending closure", description: "Closure review in progress", dot: "bg-rose-500" },
  { value: "OnHold", label: "On hold", description: "Paused or delayed", dot: "bg-amber-400" },
  { value: "Closed", label: "Closed", description: "Successfully closed", dot: "bg-primary" },
  { value: "Cancelled", label: "Cancelled", description: "Stopped before completion", dot: "bg-slate-500" },
  { value: "Draft", label: "Draft", description: "Not yet started", dot: "bg-muted-foreground" },
];
