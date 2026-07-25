import type { TaskDependency } from "../types/tasks.types";

/** Columns for task schedule export (DEF-P1-028 fidelity fields included). */
export const TASK_EXPORT_FIELD_OPTIONS = [
  { id: "Title", label: "Title", desc: "The name/summary of the task" },
  { id: "Description", label: "Description", desc: "Detailed description of requirements" },
  { id: "Priority", label: "Priority", desc: "Urgency (Critical, High, Medium, Low)" },
  { id: "Status", label: "Status", desc: "Current state (To Do, In Progress, Done, etc.)" },
  { id: "Assignee", label: "Assignee", desc: "Team member currently owning the task" },
  {
    id: "Resource Names",
    label: "Resource Names",
    desc: "MSP-style Name (Organization), comma-separated for owner and backup",
  },
  { id: "Phase", label: "Phase", desc: "Project phase or roadmap stage" },
  { id: "Parent Task", label: "Parent Task", desc: "Parent task title when nested (hierarchy)" },
  { id: "Is Summary", label: "Is Summary", desc: "Yes when the row has child tasks" },
  { id: "Order", label: "Order", desc: "Plan order index within the export" },
  { id: "Start Date", label: "Start Date", desc: "Scheduled start date" },
  { id: "End Date", label: "End Date", desc: "Scheduled due date" },
  { id: "Duration Days", label: "Duration Days", desc: "Working duration in days" },
  { id: "Effort Hours", label: "Effort Hours", desc: "Hours allocated or logged for this task" },
  { id: "% Complete", label: "% Complete", desc: "Approved percent complete" },
  { id: "Baseline Start", label: "Baseline Start", desc: "Baseline start date" },
  { id: "Baseline End", label: "Baseline End", desc: "Baseline finish date" },
  { id: "Baseline Duration Days", label: "Baseline Duration Days", desc: "Baseline duration in days" },
  { id: "Actual Start", label: "Actual Start", desc: "Actual start date from schedule" },
  { id: "Actual End", label: "Actual End", desc: "Actual finish date from schedule" },
  { id: "Start Variance Days", label: "Start Variance Days", desc: "Start minus baseline start (days)" },
  { id: "Finish Variance Days", label: "Finish Variance Days", desc: "Finish minus baseline finish (days)" },
  { id: "Predecessors", label: "Predecessors", desc: "Predecessor titles with dependency type" },
] as const;

export type TaskExportFieldId = (typeof TASK_EXPORT_FIELD_OPTIONS)[number]["id"];

export const DEFAULT_TASK_EXPORT_FIELDS: string[] = TASK_EXPORT_FIELD_OPTIONS.map(
  (f) => f.id,
);

export type TaskExportDependency = Pick<
  TaskDependency,
  "predecessorId" | "successorId" | "depType" | "lagDays"
> & {
  predecessor?: { id: string; title?: string } | null;
};

function toDay(value?: string | Date | null): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).split("T")[0];
}

/** Inclusive calendar-day span (start→end). */
export function inclusiveDurationDays(
  start?: string | Date | null,
  end?: string | Date | null,
): number | "" {
  const s = toDay(start);
  const e = toDay(end);
  if (!s || !e) return "";
  const startMs = Date.parse(`${s}T00:00:00Z`);
  const endMs = Date.parse(`${e}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return "";
  return Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1);
}

/** Signed day difference: later − earlier (finish variance style). */
export function signedDayDelta(
  actual?: string | Date | null,
  baseline?: string | Date | null,
): number | "" {
  const a = toDay(actual);
  const b = toDay(baseline);
  if (!a || !b) return "";
  const aMs = Date.parse(`${a}T00:00:00Z`);
  const bMs = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return "";
  return Math.round((aMs - bMs) / 86_400_000);
}

export function resolveTaskDurationDays(task: {
  durationDays?: number | null;
  effortHours?: number | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
}): number | "" {
  if (
    task.durationDays != null &&
    Number.isFinite(Number(task.durationDays)) &&
    Number(task.durationDays) > 0
  ) {
    return Math.round(Number(task.durationDays) * 10) / 10;
  }
  if (task.effortHours != null && Number.isFinite(Number(task.effortHours)) && Number(task.effortHours) > 0) {
    return Math.max(1, Math.round(Number(task.effortHours) / 8));
  }
  return inclusiveDurationDays(task.startDate, task.endDate);
}

/** Plan order matching MPP import: tasks are created reverse-plan so newest createdAt = first in schedule. */
export function comparePlanOrderAsc(a: any, b: any): number {
  const aTime = new Date(a.createdAt || 0).getTime();
  const bTime = new Date(b.createdAt || 0).getTime();
  if (aTime !== bTime) return bTime - aTime;
  const aStart = a.startDate ? String(a.startDate) : "";
  const bStart = b.startDate ? String(b.startDate) : "";
  if (aStart !== bStart) return aStart.localeCompare(bStart);
  return String(a.title || a.name || "").localeCompare(String(b.title || b.name || ""));
}

export function formatPredecessorsForExport(
  taskId: string,
  dependencies: TaskExportDependency[],
  titleById?: Map<string, string>,
): string {
  const links = dependencies.filter((d) => d.successorId === taskId);
  if (links.length === 0) return "";

  return links
    .map((dep) => {
      const title =
        dep.predecessor?.title ||
        titleById?.get(dep.predecessorId) ||
        dep.predecessorId.slice(0, 8);
      const type = (dep.depType || "FS").toUpperCase();
      const lag = Number(dep.lagDays) || 0;
      return lag ? `${title} (${type}+${lag}d)` : `${title} (${type})`;
    })
    .join("; ");
}

export type ParsedExcelPredecessor = {
  title: string;
  depType: "FS" | "SS" | "FF" | "SF";
  lagDays: number;
};

/**
 * Parse Excel "Predecessors" cell written by formatPredecessorsForExport.
 * Examples: `Kickoff (FS)`, `Kickoff (FS+2d); Design (SS-1d)`, bare `Kickoff`.
 */
export function parsePredecessorsCell(raw?: string | null): ParsedExcelPredecessor[] {
  if (!raw || !String(raw).trim()) return [];

  const parts = String(raw)
    .split(/[;\n|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const results: ParsedExcelPredecessor[] = [];
  for (const part of parts) {
    const withLag = part.match(
      /^(.*?)\s*\(\s*(FS|SS|FF|SF)\s*([+-]\s*\d+)\s*d?\s*\)\s*$/i,
    );
    if (withLag) {
      const lag = Number.parseInt(withLag[3].replace(/\s/g, ""), 10);
      results.push({
        title: withLag[1].trim(),
        depType: withLag[2].toUpperCase() as ParsedExcelPredecessor["depType"],
        lagDays: Number.isFinite(lag) ? lag : 0,
      });
      continue;
    }

    const withType = part.match(/^(.*?)\s*\(\s*(FS|SS|FF|SF)\s*\)\s*$/i);
    if (withType) {
      results.push({
        title: withType[1].trim(),
        depType: withType[2].toUpperCase() as ParsedExcelPredecessor["depType"],
        lagDays: 0,
      });
      continue;
    }

    const bare = part.replace(/\s*\([^)]*\)\s*$/, "").trim() || part;
    if (bare) {
      results.push({ title: bare, depType: "FS", lagDays: 0 });
    }
  }

  return results.filter((p) => p.title.length > 0);
}

export type ExcelDependencyPlan = {
  successorTitle: string;
  predecessorTitle: string;
  predecessorId: string;
  successorId: string;
  depType: ParsedExcelPredecessor["depType"];
  lagDays: number;
};

/** Resolve parsed predecessor links against a title→id map (second import pass). */
export function planExcelDependencies(
  rows: { title: string; predecessors?: ParsedExcelPredecessor[] }[],
  titleToId: Map<string, string>,
): { plans: ExcelDependencyPlan[]; warnings: string[] } {
  const plans: ExcelDependencyPlan[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const successorId = titleToId.get(row.title.trim().toLowerCase());
    if (!successorId || !row.predecessors?.length) continue;

    for (const pred of row.predecessors) {
      const predKey = pred.title.trim().toLowerCase();
      const predecessorId = titleToId.get(predKey);
      if (!predecessorId) {
        warnings.push(
          `Skipped predecessor "${pred.title}" for "${row.title}" (task not found).`,
        );
        continue;
      }
      if (predecessorId === successorId) {
        warnings.push(`Skipped self-link on "${row.title}".`);
        continue;
      }
      const pairKey = `${predecessorId}|${successorId}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      plans.push({
        successorTitle: row.title,
        predecessorTitle: pred.title,
        predecessorId,
        successorId,
        depType: pred.depType,
        lagDays: pred.lagDays,
      });
    }
  }

  return { plans, warnings };
}

export type BuildTaskExportRowOptions = {
  order?: number;
  dependencies?: TaskExportDependency[];
  titleById?: Map<string, string>;
  phases?: { id: string; name: string }[];
  assignees?: {
    userId: string;
    displayName: string;
    department?: { name?: string } | null;
    organization?: string | null;
  }[];
  /** Project customer / company used for external resources. */
  projectOrganization?: string | null;
  /** When exporting a multi-project CSV/sheet. */
  projectName?: string;
};

/** MSP template style: "J. Smith (PartnerCo)". Avoids double-wrapping. */
export function formatResourceName(
  name?: string | null,
  organization?: string | null,
): string {
  const n = String(name || "").trim();
  if (!n) return "";
  if (/\([^)]+\)\s*$/.test(n)) return n;
  const org = String(organization || "").trim();
  if (!org) return n;
  return `${n} (${org})`;
}

function resolvePersonOrganization(
  person: {
    isExternal?: boolean | null;
    employees?: { department?: { name?: string } | null } | null;
    department?: { name?: string } | null;
    organization?: string | null;
  } | null | undefined,
  projectOrganization?: string | null,
  assigneeOrg?: string | null,
): string {
  if (assigneeOrg?.trim()) return assigneeOrg.trim();
  if (person?.organization?.trim()) return person.organization.trim();
  const dept =
    person?.employees?.department?.name || person?.department?.name || "";
  if (person?.isExternal && projectOrganization?.trim()) {
    return projectOrganization.trim();
  }
  if (dept.trim()) return dept.trim();
  // Fallback so exports still show Name (Org) when dept is missing.
  return projectOrganization?.trim() || "";
}

/**
 * Flat row used by XLSX / CSV / PDF / Word exporters.
 */
export function buildTaskExportRow(
  task: any,
  options: BuildTaskExportRowOptions = {},
): Record<string, string | number> {
  const assigneeFromList = options.assignees?.find(
    (a) => a.userId === task.ownerId,
  );
  const assigneeName =
    task.owner?.displayName ||
    task.assigneeName ||
    assigneeFromList?.displayName ||
    "";
  const backupName =
    task.backupOwner?.displayName ||
    options.assignees?.find((a) => a.userId === task.backupOwnerId)
      ?.displayName ||
    "";

  const ownerOrg = resolvePersonOrganization(
    task.owner,
    options.projectOrganization,
    assigneeFromList?.department?.name || assigneeFromList?.organization,
  );
  const backupFromList = options.assignees?.find(
    (a) => a.userId === task.backupOwnerId,
  );
  const backupOrg = resolvePersonOrganization(
    task.backupOwner,
    options.projectOrganization,
    backupFromList?.department?.name || backupFromList?.organization,
  );

  const resourceParts = [
    formatResourceName(assigneeName, ownerOrg),
    formatResourceName(backupName, backupOrg),
  ].filter(Boolean);
  const resourceNames = resourceParts.join(", ");

  const phaseName =
    task.phase?.name ||
    task.phaseName ||
    options.phases?.find((p) => p.id === task.phaseId)?.name ||
    "";
  const parentTitle =
    task.parentTask?.title ||
    (task.parentTaskId && options.titleById?.get(task.parentTaskId)) ||
    "";
  const isSummary =
    task.isSummary === true ||
    (Array.isArray(task.subTasks) && task.subTasks.length > 0);

  const baselineStart = toDay(task.baselineStart);
  const baselineEnd = toDay(task.baselineEnd);
  const start = toDay(task.startDate);
  const end = toDay(task.endDate);

  const row: Record<string, string | number> = {
    Title: task.title || "",
    Description: task.description || "",
    Priority: task.priority || "",
    Status: task.status || "",
    Assignee: assigneeName,
    "Resource Names": resourceNames,
    Phase: phaseName,
    "Parent Task": parentTitle,
    "Is Summary": isSummary ? "Yes" : "No",
    Order: options.order ?? "",
    "Start Date": start,
    "End Date": end,
    "Duration Days": resolveTaskDurationDays(task),
    "Effort Hours": task.effortHours != null ? Number(task.effortHours) : 0,
    "% Complete":
      typeof task.progressApproved === "number"
        ? Math.max(0, Math.min(100, Math.round(task.progressApproved)))
        : 0,
    "Baseline Start": baselineStart,
    "Baseline End": baselineEnd,
    "Baseline Duration Days":
      task.baselineDurationDays != null &&
      Number.isFinite(Number(task.baselineDurationDays)) &&
      Number(task.baselineDurationDays) > 0
        ? Math.round(Number(task.baselineDurationDays) * 10) / 10
        : inclusiveDurationDays(baselineStart, baselineEnd),
    "Actual Start": toDay(task.actualStart),
    "Actual End": toDay(task.actualEnd),
    "Start Variance Days": signedDayDelta(start, baselineStart),
    "Finish Variance Days": signedDayDelta(end, baselineEnd),
    Predecessors: formatPredecessorsForExport(
      task.id,
      options.dependencies ?? [],
      options.titleById,
    ),
  };

  if (options.projectName != null) {
    row["Project Name"] = options.projectName;
  }

  return row;
}

export function mapTasksToExportRows(
  tasks: any[],
  options: Omit<BuildTaskExportRowOptions, "order" | "projectName" | "projectOrganization"> & {
    projectName?: string | ((task: any) => string | undefined);
    projectOrganization?: string | null | ((task: any) => string | null | undefined);
  } = {},
): Record<string, string | number>[] {
  const titleById =
    options.titleById ??
    new Map(tasks.map((t) => [t.id, String(t.title || "")]));

  const childParentIds = new Set(
    tasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId as string),
  );

  const sorted = [...tasks].sort(comparePlanOrderAsc);

  return sorted.map((task, index) =>
    buildTaskExportRow(
      {
        ...task,
        isSummary: task.isSummary === true || childParentIds.has(task.id),
      },
      {
        ...options,
        titleById,
        order: index + 1,
        projectName:
          typeof options.projectName === "function"
            ? options.projectName(task)
            : options.projectName ?? task.projectName,
        projectOrganization:
          typeof options.projectOrganization === "function"
            ? options.projectOrganization(task)
            : options.projectOrganization,
      },
    ),
  );
}

export function pickExportFields(
  row: Record<string, string | number>,
  fields: string[],
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const field of fields) {
    out[field] = row[field] ?? "";
  }
  return out;
}
