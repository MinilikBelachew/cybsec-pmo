export const PROJECT_DEPT_COLOR: Record<string, string> = {
  Engineering: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
  Delivery: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  Finance: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  HR: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  Product: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  SOC: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
  GRC: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  Cloud: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  AppSec: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
};

export const DEFAULT_PROJECT_DEPT_COLOR =
  "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary";

export function formatProjectCardDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
}

export function formatProjectTimeline(startDate?: string, endDate?: string) {
  return `${formatProjectCardDate(startDate)} → ${formatProjectCardDate(endDate)}`;
}
