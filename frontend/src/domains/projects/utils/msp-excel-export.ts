import * as XLSX from "xlsx";
import {
  comparePlanOrderAsc,
  formatResourceName,
  inclusiveDurationDays,
  resolveTaskDurationDays,
  type TaskExportDependency,
} from "./task-export-fields";
import type { ProjectPhase, ProjectMilestone } from "../types/projects.types";

/** Column names MS Project / Project Viewer Excel import wizard auto-maps. */
export const MSP_EXCEL_HEADERS = [
  "ID",
  "Name",
  "Outline Level",
  "Duration",
  "Start",
  "Finish",
  "Predecessors",
  "Resource Names",
  "% Complete",
  "Baseline Start",
  "Baseline Finish",
  "Baseline Duration",
  "Milestone",
  "Notes",
] as const;

export type MspExcelRow = Record<(typeof MSP_EXCEL_HEADERS)[number], string | number>;

type OutlineKind = "project" | "phase" | "task" | "milestone";

type OutlineNode = {
  kind: OutlineKind;
  sourceId: string;
  name: string;
  outlineLevel: number;
  start?: string;
  finish?: string;
  durationDays?: number | "";
  baselineStart?: string;
  baselineFinish?: string;
  baselineDurationDays?: number | "";
  percentComplete?: number;
  resourceNames?: string;
  notes?: string;
  milestone?: boolean;
  taskId?: string;
};

type BuildMspExcelOptions = {
  tasks: any[];
  phases?: ProjectPhase[];
  milestones?: ProjectMilestone[];
  dependencies?: TaskExportDependency[];
  projectOrganization?: string | null;
  /** When set, emit a project summary row at outline level 1. */
  project?: {
    id: string;
    name: string;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    baselineStartDate?: string | Date | null;
    baselineEndDate?: string | Date | null;
    durationDays?: number | null;
    baselineDurationDays?: number | null;
    percentComplete?: number | null;
    objective?: string | null;
    primaryPmName?: string | null;
    secondaryPmName?: string | null;
  };
};

function toDay(value?: string | Date | null): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).split("T")[0];
}

function formatDuration(days?: number | "" | null, milestone = false): string {
  if (milestone) return "0 days";
  if (days === "" || days == null || !Number.isFinite(Number(days))) return "";
  const n = Math.round(Number(days) * 10) / 10;
  return n === 1 ? "1 day" : `${n} days`;
}

function personOrg(
  person: any,
  projectOrganization?: string | null,
): string | null {
  if (person?.organization?.trim()) return person.organization.trim();
  const dept =
    person?.employees?.department?.name || person?.department?.name || "";
  if (person?.isExternal && projectOrganization?.trim()) {
    return projectOrganization.trim();
  }
  return dept.trim() || projectOrganization?.trim() || null;
}

function taskResourceNames(task: any, projectOrganization?: string | null): string {
  const owner = formatResourceName(
    task.owner?.displayName || task.assigneeName,
    personOrg(task.owner, projectOrganization),
  );
  const backup = formatResourceName(
    task.backupOwner?.displayName,
    personOrg(task.backupOwner, projectOrganization),
  );
  return [owner, backup].filter(Boolean).join(", ");
}

function childTasks(tasks: any[], parentId: string): any[] {
  return tasks
    .filter((t) => t.parentTaskId === parentId)
    .sort(comparePlanOrderAsc);
}

function pushTaskTree(
  nodes: OutlineNode[],
  task: any,
  outlineLevel: number,
  tasks: any[],
  projectOrganization?: string | null,
) {
  const duration = resolveTaskDurationDays(task);
  const start = toDay(task.startDate);
  const finish = toDay(task.endDate);
  const baselineStart = toDay(task.baselineStart);
  const baselineFinish = toDay(task.baselineEnd);
  const children = childTasks(tasks, task.id);
  const isMilestone =
    Number(duration) === 0 || (Boolean(start) && start === finish && children.length === 0);

  nodes.push({
    kind: "task",
    sourceId: task.id,
    taskId: task.id,
    name: String(task.title || "Task"),
    outlineLevel,
    start,
    finish,
    durationDays: duration,
    baselineStart,
    baselineFinish,
    baselineDurationDays:
      task.baselineDurationDays != null &&
      Number.isFinite(Number(task.baselineDurationDays)) &&
      Number(task.baselineDurationDays) > 0
        ? Math.round(Number(task.baselineDurationDays) * 10) / 10
        : inclusiveDurationDays(baselineStart, baselineFinish),
    percentComplete:
      typeof task.progressApproved === "number"
        ? Math.max(0, Math.min(100, Math.round(task.progressApproved)))
        : 0,
    resourceNames: taskResourceNames(task, projectOrganization),
    notes: task.description || "",
    milestone: isMilestone && children.length === 0,
  });

  for (const child of children) {
    pushTaskTree(nodes, child, outlineLevel + 1, tasks, projectOrganization);
  }
}

function pushMilestone(
  nodes: OutlineNode[],
  milestone: ProjectMilestone,
  outlineLevel: number,
) {
  const day = toDay(milestone.targetDate);
  nodes.push({
    kind: "milestone",
    sourceId: `ms:${milestone.id}`,
    name: String(milestone.title || "Milestone"),
    outlineLevel,
    start: day,
    finish: day,
    durationDays: 0,
    percentComplete: String(milestone.status).toLowerCase() === "completed" ? 100 : 0,
    notes: "",
    milestone: true,
  });
}

function rollup(nodes: OutlineNode[]): {
  start: string;
  finish: string;
  percentComplete: number;
} {
  const starts = nodes.map((n) => n.start).filter(Boolean).sort();
  const finishes = nodes.map((n) => n.finish).filter(Boolean).sort();
  const percents = nodes
    .map((n) => n.percentComplete)
    .filter((p): p is number => typeof p === "number");
  return {
    start: starts[0] ?? "",
    finish: finishes[finishes.length - 1] ?? "",
    percentComplete: percents.length
      ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
      : 0,
  };
}

function emitPhaseBlock(
  nodes: OutlineNode[],
  phase: ProjectPhase | { id: string; name: string; description?: string | null; startDate?: string | Date | null; endDate?: string | Date | null },
  outlineLevel: number,
  tasks: any[],
  milestones: ProjectMilestone[],
  projectOrganization?: string | null,
) {
  const phaseStartIndex = nodes.length;
  const top = tasks
    .filter((t) => !t.parentTaskId && t.phaseId === phase.id)
    .sort(comparePlanOrderAsc);
  const phaseMilestones = milestones.filter((m) => m.phaseId === phase.id);

  nodes.push({
    kind: "phase",
    sourceId: `phase:${phase.id}`,
    name: String(phase.name || "Phase"),
    outlineLevel,
    start: toDay(phase.startDate),
    finish: toDay(phase.endDate),
    durationDays: inclusiveDurationDays(phase.startDate, phase.endDate),
    notes: ("description" in phase ? phase.description : "") || "",
    percentComplete: 0,
  });

  for (const task of top) {
    pushTaskTree(nodes, task, outlineLevel + 1, tasks, projectOrganization);
  }
  for (const ms of phaseMilestones) {
    pushMilestone(nodes, ms, outlineLevel + 1);
  }

  const children = nodes.slice(phaseStartIndex + 1);
  const rolled = rollup(children);
  if (!nodes[phaseStartIndex].start) nodes[phaseStartIndex].start = rolled.start;
  if (!nodes[phaseStartIndex].finish) nodes[phaseStartIndex].finish = rolled.finish;
  nodes[phaseStartIndex].percentComplete = rolled.percentComplete;
  if (!nodes[phaseStartIndex].durationDays) {
    nodes[phaseStartIndex].durationDays = inclusiveDurationDays(
      nodes[phaseStartIndex].start,
      nodes[phaseStartIndex].finish,
    );
  }
}

function emitKnownAndOrphanPhases(
  nodes: OutlineNode[],
  outlineLevel: number,
  phases: ProjectPhase[],
  tasks: any[],
  milestones: ProjectMilestone[],
  org: string | null,
) {
  const knownPhaseIds = new Set(phases.map((p) => p.id));
  for (const phase of phases) {
    emitPhaseBlock(nodes, phase, outlineLevel, tasks, milestones, org);
  }
  const taskPhaseIds = tasks
    .map((t) => t.phaseId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const orphanPhaseIds = [...new Set(taskPhaseIds)].filter(
    (id) => !knownPhaseIds.has(id),
  );
  for (const phaseId of orphanPhaseIds) {
    const sample = tasks.find((t) => t.phaseId === phaseId);
    emitPhaseBlock(
      nodes,
      {
        id: phaseId,
        name: sample?.phase?.name || sample?.phaseName || "Phase",
      },
      outlineLevel,
      tasks,
      milestones,
      org,
    );
  }
  emitUnphased(nodes, outlineLevel, tasks, milestones, org);
}

function emitUnphased(
  nodes: OutlineNode[],
  outlineLevel: number,
  tasks: any[],
  milestones: ProjectMilestone[],
  projectOrganization?: string | null,
) {
  const top = tasks
    .filter((t) => !t.parentTaskId && !t.phaseId)
    .sort(comparePlanOrderAsc);
  const looseMilestones = milestones.filter((m) => !m.phaseId);
  if (top.length === 0 && looseMilestones.length === 0) return;

  const startIndex = nodes.length;
  nodes.push({
    kind: "phase",
    sourceId: "phase:__unphased__",
    name: "Unphased",
    outlineLevel,
    percentComplete: 0,
  });
  for (const task of top) {
    pushTaskTree(nodes, task, outlineLevel + 1, tasks, projectOrganization);
  }
  for (const ms of looseMilestones) {
    pushMilestone(nodes, ms, outlineLevel + 1);
  }
  const rolled = rollup(nodes.slice(startIndex + 1));
  nodes[startIndex].start = rolled.start;
  nodes[startIndex].finish = rolled.finish;
  nodes[startIndex].percentComplete = rolled.percentComplete;
  nodes[startIndex].durationDays = inclusiveDurationDays(rolled.start, rolled.finish);
}

function buildOutline(options: BuildMspExcelOptions): OutlineNode[] {
  const tasks = options.tasks ?? [];
  const phases = [...(options.phases ?? [])].sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0),
  );
  const milestones = options.milestones ?? [];
  const nodes: OutlineNode[] = [];
  const org = options.projectOrganization ?? null;
  const baseLevel = options.project ? 2 : 1;

  if (options.project) {
    const startIndex = 0;
    nodes.push({
      kind: "project",
      sourceId: `project:${options.project.id}`,
      name: options.project.name,
      outlineLevel: 1,
      start: toDay(options.project.startDate),
      finish: toDay(options.project.endDate),
      durationDays:
        options.project.durationDays != null
          ? Number(options.project.durationDays)
          : inclusiveDurationDays(options.project.startDate, options.project.endDate),
      baselineStart: toDay(options.project.baselineStartDate),
      baselineFinish: toDay(options.project.baselineEndDate),
      baselineDurationDays:
        options.project.baselineDurationDays != null
          ? Number(options.project.baselineDurationDays)
          : inclusiveDurationDays(
              options.project.baselineStartDate,
              options.project.baselineEndDate,
            ),
      percentComplete:
        typeof options.project.percentComplete === "number"
          ? Math.max(0, Math.min(100, Math.round(options.project.percentComplete)))
          : 0,
      resourceNames: [
        formatResourceName(options.project.primaryPmName, org),
        formatResourceName(options.project.secondaryPmName, org),
      ]
        .filter(Boolean)
        .join(", "),
      notes: options.project.objective || "",
    });

    emitKnownAndOrphanPhases(nodes, baseLevel, phases, tasks, milestones, org);

    const rolled = rollup(nodes.slice(startIndex + 1));
    if (!nodes[0].start) nodes[0].start = rolled.start;
    if (!nodes[0].finish) nodes[0].finish = rolled.finish;
    if (!nodes[0].percentComplete) nodes[0].percentComplete = rolled.percentComplete;
    return nodes;
  }

  emitKnownAndOrphanPhases(nodes, 1, phases, tasks, milestones, org);

  if (nodes.length === 0) {
    for (const task of [...tasks].filter((t) => !t.parentTaskId).sort(comparePlanOrderAsc)) {
      pushTaskTree(nodes, task, 1, tasks, org);
    }
  }

  return nodes;
}

function formatPredecessorCell(
  taskId: string,
  dependencies: TaskExportDependency[],
  idByTaskId: Map<string, number>,
): string {
  const links = dependencies.filter((d) => d.successorId === taskId);
  if (!links.length) return "";

  return links
    .map((dep) => {
      const predId = idByTaskId.get(dep.predecessorId);
      if (!predId) return "";
      const type = String(dep.depType || "FS").toUpperCase();
      const lag = Number(dep.lagDays) || 0;
      if (type === "FS" && lag === 0) return String(predId);
      if (lag === 0) return `${predId}${type}`;
      const sign = lag > 0 ? "+" : "";
      return `${predId}${type}${sign}${lag} days`;
    })
    .filter(Boolean)
    .join(",");
}

export function buildMspExcelRows(options: BuildMspExcelOptions): MspExcelRow[] {
  return nodesToMspRows(buildOutline(options), options.dependencies ?? []);
}

export function buildMspExcelRowsFromProjects(
  projects: BuildMspExcelOptions[],
): MspExcelRow[] {
  const nodes = projects.flatMap((project) => buildOutline(project));
  const dependencies = projects.flatMap((project) => project.dependencies ?? []);
  return nodesToMspRows(nodes, dependencies);
}

function nodesToMspRows(
  nodes: OutlineNode[],
  dependencies: TaskExportDependency[],
): MspExcelRow[] {
  const idByTaskId = new Map<string, number>();
  nodes.forEach((node, index) => {
    if (node.taskId) idByTaskId.set(node.taskId, index + 1);
  });

  return nodes.map((node, index) => ({
    ID: index + 1,
    Name: node.name,
    "Outline Level": node.outlineLevel,
    Duration: formatDuration(node.durationDays, node.milestone === true),
    Start: node.start ?? "",
    Finish: node.finish ?? "",
    Predecessors: node.taskId
      ? formatPredecessorCell(node.taskId, dependencies, idByTaskId)
      : "",
    "Resource Names": node.resourceNames ?? "",
    "% Complete": node.percentComplete ?? 0,
    "Baseline Start": node.baselineStart ?? "",
    "Baseline Finish": node.baselineFinish ?? "",
    "Baseline Duration": formatDuration(node.baselineDurationDays),
    Milestone: node.milestone ? "Yes" : "No",
    Notes: node.notes ?? "",
  }));
}

export function createMspExcelSheet(rows: MspExcelRow[]): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [...MSP_EXCEL_HEADERS],
  });
  ws["!cols"] = MSP_EXCEL_HEADERS.map((header) => {
    if (header === "Name" || header === "Notes" || header === "Resource Names") {
      return { wch: 28 };
    }
    if (header === "Predecessors") return { wch: 18 };
    return { wch: Math.max(12, header.length + 2) };
  });
  return ws;
}

/** Inserts the MS Project sheet as the first worksheet (Project Viewer opens this). */
export function prependMspExcelSheet(
  workbook: XLSX.WorkBook,
  rows: MspExcelRow[],
  sheetName = "MS Project",
): void {
  const ws = createMspExcelSheet(rows);
  const name = sheetName.slice(0, 31);
  workbook.Sheets[name] = ws;
  workbook.SheetNames = [name, ...workbook.SheetNames.filter((n) => n !== name)];
}
