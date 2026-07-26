import type { ReconcileStatus, UtilisationStatus } from "../types/reports.types";

export const UTILISATION_STATUS_CONFIG: Record<
  UtilisationStatus,
  { label: string; text: string; bar: string; bg: string }
> = {
  over: {
    label: "Overloaded",
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    bg: "bg-rose-50 dark:bg-rose-900/20",
  },
  optimal: {
    label: "Optimal",
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  under: {
    label: "Under",
    text: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
};

export const RECONCILE_STATUS_CONFIG: Record<
  ReconcileStatus,
  { label: string; text: string }
> = {
  matched: {
    label: "Matched",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  pending: {
    label: "Pending sync",
    text: "text-amber-600 dark:text-amber-400",
  },
  mismatch: {
    label: "Mismatch",
    text: "text-rose-600 dark:text-rose-400",
  },
  unavailable: {
    label: "No Keka link",
    text: "text-muted-foreground",
  },
};

export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatPeriodLabel(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();

  if (sameMonth) {
    return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}
