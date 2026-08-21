import { Department, Customer, ProjectManager, CreateProjectDto, ProjectPhase, ProjectMilestone, ProjectTaskAssignee } from "../types/projects.types";
import { Task } from "../types/tasks.types";
import { taskDatesOutsidePhaseErrors, toTaskDayKey } from "../schemas/task/task-date-fields";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DEFAULT_TASK_EXPORT_FIELDS,
  comparePlanOrderAsc,
  mapTasksToExportRows,
  pickExportFields,
  inclusiveDurationDays,
  signedDayDelta,
  parsePredecessorsCell,
  formatResourceName,
  mergeExportResourceNames,
  splitResourceNames,
  type TaskExportDependency,
  type ParsedExcelPredecessor,
} from "./task-export-fields";
import {
  PROJECT_NAME_MAX,
  PROJECT_OBJECTIVE_MAX,
} from "../schemas/project/create-project.schema";
import {
  drawPdfReportHeader,
  drawPdfSectionTitle,
  drawPdfKeyValueGrid,
  drawPdfScheduleTable,
  resolveTaskPdfHeaders,
} from "./pdf-export-layout";
import { renderWordTaskScheduleSection } from "./word-export-layout";
import {
  buildMspExcelRows,
  buildMspExcelRowsFromProjects,
  prependMspExcelSheet,
} from "./msp-excel-export";

export {
  TASK_EXPORT_FIELD_OPTIONS,
  DEFAULT_TASK_EXPORT_FIELDS,
  comparePlanOrderAsc,
  parsePredecessorsCell,
  planExcelDependencies,
} from "./task-export-fields";
export type {
  TaskExportDependency,
  ParsedExcelPredecessor,
  ExcelDependencyPlan,
} from "./task-export-fields";

/** Default project columns for XLSX / CSV / PDF / Word (schedule + commercial). */
export const DEFAULT_PROJECT_EXPORT_FIELDS = [
  "Name",
  "Objective",
  "Department",
  "Customer",
  "Engagement Type",
  "Billing Model",
  "Priority",
  "Start Date",
  "End Date",
  "Duration Days",
  "Baseline Start",
  "Baseline End",
  "Baseline Duration Days",
  "% Complete",
  "Duration Variance Days",
  "Actual Start",
  "Actual End",
  "Resource Names",
  "Value",
  "Currency",
  "Primary PM",
  "Secondary PM",
  "Status",
] as const;

/** Schedule columns that must appear on project export even if dialog state is stale. */
const REQUIRED_PROJECT_SCHEDULE_FIELDS = [
  "Duration Days",
  "Baseline Start",
  "Baseline End",
  "Baseline Duration Days",
  "% Complete",
  "Duration Variance Days",
  "Actual Start",
  "Actual End",
] as const;

/** Always include Resource Names even if dialog selection is stale. */
const REQUIRED_PROJECT_RESOURCE_FIELD = "Resource Names";

/**
 * Resolve export headers: honor user selection, but always insert schedule
 * columns after End Date (fixes stale dialog state after field list updates).
 */
export function resolveProjectExportHeaders(selectedFields?: string[]): string[] {
  const base =
    selectedFields && selectedFields.length > 0
      ? [...selectedFields]
      : [...DEFAULT_PROJECT_EXPORT_FIELDS];

  const have = new Set(base);
  const missing = REQUIRED_PROJECT_SCHEDULE_FIELDS.filter((f) => !have.has(f));
  let result = base;
  if (missing.length > 0) {
    const endIdx = base.indexOf("End Date");
    if (endIdx >= 0) {
      result = [
        ...base.slice(0, endIdx + 1),
        ...missing,
        ...base.slice(endIdx + 1),
      ];
    } else {
      result = [...base, ...missing];
    }
  }

  if (!result.includes(REQUIRED_PROJECT_RESOURCE_FIELD)) {
    const actualEndIdx = result.indexOf("Actual End");
    if (actualEndIdx >= 0) {
      result = [
        ...result.slice(0, actualEndIdx + 1),
        REQUIRED_PROJECT_RESOURCE_FIELD,
        ...result.slice(actualEndIdx + 1),
      ];
    } else {
      result = [...result, REQUIRED_PROJECT_RESOURCE_FIELD];
    }
  }

  return result;
}

function toExportDay(value?: string | Date | null): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).split("T")[0] || "";
}

function toExportNumber(value: unknown): string {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 10) / 10);
}

/** Flat project row used by all portfolio exporters. */
export function mapProjectToExportRow(
  p: any,
  departments: Department[],
  customers: Customer[],
  managers: ProjectManager[],
): Record<string, string | number> {
  const deptName =
    p.department?.name ||
    departments.find((d) => d.id === p.departmentId)?.name ||
    "";
  const custName =
    p.customer?.displayName ||
    customers.find((c) => c.id === p.customerId)?.displayName ||
    "";
  const primaryPmName =
    p.primaryPm?.displayName ||
    managers.find((m) => m.id === p.primaryPmId)?.displayName ||
    "";
  const secondaryPmName =
    p.secondaryPm?.displayName ||
    managers.find((m) => m.id === p.secondaryPmId)?.displayName ||
    "";

  // MSP Resource Names: PMs + active team, formatted Name (Organization).
  const orgForInternal = deptName || custName;
  const resourceParts: string[] = [];
  if (primaryPmName) {
    resourceParts.push(formatResourceName(primaryPmName, orgForInternal));
  }
  if (secondaryPmName) {
    resourceParts.push(formatResourceName(secondaryPmName, orgForInternal));
  }
  const team = Array.isArray(p.allocations)
    ? p.allocations
    : Array.isArray(p.team)
      ? p.team
      : [];
  for (const member of team) {
    const memberName =
      member?.employee?.displayName ||
      member?.employee?.name ||
      member?.displayName ||
      member?.name ||
      "";
    const memberOrg =
      member?.employee?.department?.name ||
      member?.department?.name ||
      orgForInternal;
    const formatted = formatResourceName(memberName, memberOrg);
    if (formatted && !resourceParts.includes(formatted)) {
      resourceParts.push(formatted);
    }
  }

  const startDate = toExportDay(p.startDate);
  const endDate = toExportDay(p.endDate);
  const baselineStart = toExportDay(p.baselineStartDate);
  const baselineEnd = toExportDay(p.baselineEndDate);
  const durationDays = toExportNumber(p.durationDays);
  const baselineDurationDays = toExportNumber(p.baselineDurationDays);
  const durationVariance =
    p.durationVarianceDays != null
      ? toExportNumber(p.durationVarianceDays)
      : durationDays !== "" && baselineDurationDays !== ""
        ? toExportNumber(Number(durationDays) - Number(baselineDurationDays))
        : "";

  return {
    Name: p.name || "",
    Objective: p.objective || "",
    Department: deptName,
    Customer: custName,
    "Engagement Type": p.engagementType || "",
    "Billing Model": p.billingModel || "",
    Priority: p.priority || "",
    "Start Date": startDate,
    "End Date": endDate,
    "Duration Days": durationDays,
    "Baseline Start": baselineStart,
    "Baseline End": baselineEnd,
    "Baseline Duration Days": baselineDurationDays,
    "% Complete":
      p.percentComplete != null && Number.isFinite(Number(p.percentComplete))
        ? String(Math.round(Number(p.percentComplete)))
        : "",
    "Duration Variance Days": durationVariance,
    "Actual Start": toExportDay(p.actualStartDate),
    "Actual End": toExportDay(p.actualEndDate),
    "Resource Names": resourceParts.join(", "),
    Value: p.value != null ? p.value : "",
    Currency: p.currency || "",
    "Primary PM": primaryPmName,
    "Secondary PM": secondaryPmName,
    Status: p.status || "",
  };
}

/** Build a local calendar Date from an import day string (avoids UTC day-shift). */
function importDayToLocalDate(value?: string | null): Date | null {
  const key = toTaskDayKey(value);
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function findProjectTaskAssignee(
  assigneeName: string,
  assignees: ProjectTaskAssignee[],
): ProjectTaskAssignee | undefined {
  const normalized = assigneeName.toLowerCase().trim();
  return assignees.find(
    (assignee) =>
      assignee.displayName.toLowerCase() === normalized ||
      assignee.email.toLowerCase() === normalized ||
      assignee.name.toLowerCase() === normalized,
  );
}

/**
 * Parses a standard CSV string into a 2D array of string cells,
 * properly handling quoted fields containing commas, double quotes, and newlines.
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++; // skip the escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      row.push(cell.trim());
      lines.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.trim());
    lines.push(row);
  }

  // Filter out completely empty rows
  return lines.filter((r) => r.length > 0 && r.some((c) => c !== ""));
}

/**
 * Converts a list of projects into a CSV string.
 */
export function convertToCSV(
  projects: any[],
  departments: Department[],
  customers: Customer[],
  managers: ProjectManager[],
  selectedFields?: string[],
  tasks?: any[],
  selectedTaskFields?: string[],
  dependencies: TaskExportDependency[] = [],
): string {
  const headers = resolveProjectExportHeaders(selectedFields);

  const escapeCSV = (str: any) => {
    if (str == null) return "";
    const s = String(str);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = projects.map((p) => {
    const allData = mapProjectToExportRow(p, departments, customers, managers);
    return headers.map((field) => escapeCSV(allData[field]));
  });

  const sections = [
    [headers.join(","), ...rows.map((r) => r.join(","))].join("\n"),
  ];

  if (tasks && tasks.length > 0) {
    const taskHeaders = [
      "Project Name",
      ...(selectedTaskFields?.length ? selectedTaskFields : DEFAULT_TASK_EXPORT_FIELDS),
    ];
    const taskRows = mapTasksToExportRows(tasks, {
      dependencies,
      projectName: (t) => t.projectName,
      projectOrganization: (t) =>
        t.project?.customer?.displayName ||
        t.customerName ||
        t.projectOrganization ||
        null,
    }).map((row) =>
      taskHeaders.map((field) => escapeCSV(row[field] ?? "")),
    );
    sections.push(
      ["", "Tasks", taskHeaders.join(","), ...taskRows.map((r) => r.join(","))].join(
        "\n",
      ),
    );
  }

  return sections.join("\n");
}

/** Excel worksheet names are capped at 31 characters. */
const EXCEL_SHEET_NAME_MAX = 31;

const ROUND_TRIP_TASK_FIELDS = ["Phase", "Predecessors"] as const;

/**
 * Builds a unique Excel sheet name for `{projectName}{suffix}` (e.g. " Phases"),
 * matching the import convention while respecting the 31-char Excel limit.
 */
export function buildUniqueProjectSheetName(
  existingSheetNames: string[],
  projectName: string,
  suffix: " Tasks" | " Phases" | " Milestones",
): string {
  const clean = projectName.replace(/[\\/?*:[\]]/g, "").trim();
  const maxPrefix = Math.max(1, EXCEL_SHEET_NAME_MAX - suffix.length);
  const base = `${(clean || "Project").slice(0, maxPrefix)}${suffix}`.slice(
    0,
    EXCEL_SHEET_NAME_MAX,
  );

  let unique = base;
  let counter = 1;
  while (existingSheetNames.includes(unique)) {
    const disambig = ` (${counter})`;
    unique =
      `${(clean || "Project").slice(0, Math.max(1, maxPrefix - disambig.length))}${suffix}`
        .slice(0, EXCEL_SHEET_NAME_MAX - disambig.length) + disambig;
    counter++;
  }
  return unique;
}

/** Ensures Phase + Predecessors columns are present for XLSX re-import fidelity. */
function mergeRoundTripTaskHeaders(selectedTaskFields?: string[]): string[] {
  const headers = selectedTaskFields?.length
    ? [...selectedTaskFields]
    : [...DEFAULT_TASK_EXPORT_FIELDS];
  for (const field of ROUND_TRIP_TASK_FIELDS) {
    if (!headers.includes(field)) headers.push(field);
  }
  return headers;
}

export function exportProjectsToXLSX(
  projects: any[],
  departments: Department[],
  customers: Customer[],
  managers: ProjectManager[],
  selectedFields?: string[],
  tasks?: any[],
  selectedTaskFields?: string[],
  dependencies: TaskExportDependency[] = [],
  phasesByProjectId: Record<string, ProjectPhase[]> = {},
  milestonesByProjectId: Record<string, ProjectMilestone[]> = {},
): ArrayBuffer {
  const headers = resolveProjectExportHeaders(selectedFields);

  const data = projects.map((p) => {
    const allData = mapProjectToExportRow(p, departments, customers, managers);
    const filtered: Record<string, any> = {};
    headers.forEach((field) => {
      filtered[field] = allData[field];
    });
    return filtered;
  });

  const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Projects");

  const phaseHeaders = [
    "Name",
    "Description",
    "Order",
    "Status",
    "Start Date",
    "End Date",
  ];
  const milestoneHeaders = [
    "Title",
    "Target Date",
    "Weight (%)",
    "Status",
    "Phase",
  ];

  for (const project of projects) {
    const projectId = String(project.id ?? "");
    const projectName = String(project.name ?? "").trim();
    if (!projectId || !projectName) continue;

    const phases = phasesByProjectId[projectId] ?? [];
    if (phases.length > 0) {
      const phaseRows = phases
        .slice()
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        .map((phase) => ({
          Name: phase.name ?? "",
          Description: phase.description ?? "",
          Order: phase.orderIndex ?? "",
          Status: phase.status ?? "Planned",
          "Start Date": toExportDay(phase.startDate),
          "End Date": toExportDay(phase.endDate),
        }));
      const phaseSheetName = buildUniqueProjectSheetName(
        workbook.SheetNames,
        projectName,
        " Phases",
      );
      const phaseWs = XLSX.utils.json_to_sheet(phaseRows, { header: phaseHeaders });
      XLSX.utils.book_append_sheet(workbook, phaseWs, phaseSheetName);
    }

    const milestones = milestonesByProjectId[projectId] ?? [];
    if (milestones.length > 0) {
      const phaseNameById = new Map(
        (phasesByProjectId[projectId] ?? []).map((p) => [p.id, p.name]),
      );
      const milestoneRows = milestones.map((ms) => ({
        Title: ms.title ?? "",
        "Target Date": toExportDay(ms.targetDate),
        "Weight (%)": ms.weight ?? "",
        Status: ms.status ?? "Pending",
        Phase:
          ms.phase?.name ||
          (ms.phaseId ? phaseNameById.get(ms.phaseId) ?? "" : "") ||
          "",
      }));
      const msSheetName = buildUniqueProjectSheetName(
        workbook.SheetNames,
        projectName,
        " Milestones",
      );
      const msWs = XLSX.utils.json_to_sheet(milestoneRows, {
        header: milestoneHeaders,
      });
      XLSX.utils.book_append_sheet(workbook, msWs, msSheetName);
    }
  }

  if (tasks && tasks.length > 0) {
    const tasksByProject: Record<string, any[]> = {};
    tasks.forEach((t) => {
      const projName = t.projectName || "Tasks";
      if (!tasksByProject[projName]) {
        tasksByProject[projName] = [];
      }
      tasksByProject[projName].push(t);
    });

    const taskHeaders = mergeRoundTripTaskHeaders(selectedTaskFields);

    Object.entries(tasksByProject).forEach(([projName, projTasks]) => {
      const tasksData = mapTasksToExportRows(projTasks, {
        dependencies,
        projectName: projName,
        projectOrganization: (t) =>
          t.project?.customer?.displayName ||
          t.customerName ||
          t.projectOrganization ||
          null,
      }).map((row) => pickExportFields(row, taskHeaders));

      const uniqueSheetName = buildUniqueProjectSheetName(
        workbook.SheetNames,
        projName,
        " Tasks",
      );

      const tasksWorksheet = XLSX.utils.json_to_sheet(tasksData, { header: taskHeaders });
      XLSX.utils.book_append_sheet(workbook, tasksWorksheet, uniqueSheetName);
    });
  }

  const mspRows = buildMspExcelRowsFromProjects(
    projects.map((p) => {
      const projectId = String(p.id ?? "");
      const projectTasks = (tasks ?? []).filter(
        (t) =>
          t.projectId === projectId ||
          t.projectName === p.name,
      );
      const deptName =
        p.department?.name ||
        departments.find((d) => d.id === p.departmentId)?.name ||
        "";
      const custName =
        p.customer?.displayName ||
        customers.find((c) => c.id === p.customerId)?.displayName ||
        "";
      return {
        tasks: projectTasks,
        phases: phasesByProjectId[projectId] ?? [],
        milestones: milestonesByProjectId[projectId] ?? [],
        dependencies,
        projectOrganization: custName || deptName || null,
        project: {
          id: projectId || p.name,
          name: String(p.name ?? "Project"),
          startDate: p.startDate,
          endDate: p.endDate,
          baselineStartDate: p.baselineStartDate,
          baselineEndDate: p.baselineEndDate,
          durationDays: p.durationDays,
          baselineDurationDays: p.baselineDurationDays,
          percentComplete: p.percentComplete,
          objective: p.objective,
          primaryPmName:
            p.primaryPm?.displayName ||
            managers.find((m) => m.id === p.primaryPmId)?.displayName ||
            null,
          secondaryPmName:
            p.secondaryPm?.displayName ||
            managers.find((m) => m.id === p.secondaryPmId)?.displayName ||
            null,
        },
      };
    }),
  );
  if (mspRows.length > 0) {
    prependMspExcelSheet(workbook, mspRows);
  }

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
// XLSX IMPORT UTILITIES

/**
 * Reads a named sheet from an XLSX ArrayBuffer and returns its contents as a
 * 2-D string array (same shape as parseCSV output) so existing row processors
 * can be reused without modification.
 *
 * Prefer `Tasks` / `{project} Tasks`. Never fall back to the MS Project sheet.
 */
export function parseXLSXSheet(
  buffer: ArrayBuffer,
  sheetName: string,
  strict = false,
): string[][] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const skip = new Set(["MS Project", "Projects"]);

  let target: string | null = workbook.SheetNames.includes(sheetName) ? sheetName : null;
  if (!target && !strict) {
    if (workbook.SheetNames.includes("Tasks")) {
      target = "Tasks";
    } else {
      target =
        workbook.SheetNames.find((n) => n.endsWith(" Tasks") && !skip.has(n)) ??
        workbook.SheetNames.find((n) => !skip.has(n)) ??
        null;
    }
  }

  if (!target || skip.has(target)) return [];

  const sheet = workbook.Sheets[target];
  if (!sheet) return [];

  // header:1 → returns each row as a plain array; defval → empty string for blank cells
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false, // always stringify so date serials come out as formatted strings
  });

  // Strip fully empty rows
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

/**
 * Returns all sheet names present in an XLSX ArrayBuffer.
 */
export function getXLSXSheetNames(buffer: ArrayBuffer): string[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  return workbook.SheetNames;
}

/**
 * From a list of sheet names, returns those whose name ends with the given
 * suffix (e.g. " Tasks", " Phases", " Milestones"), along with the derived
 * project name (sheet name minus the suffix).
 */
export function getProjectSheetsByType(
  sheetNames: string[],
  suffix: " Tasks" | " Phases" | " Milestones",
): { projectName: string; sheetName: string }[] {
  return sheetNames
    .filter((n) => n.endsWith(suffix))
    .map((n) => ({
      projectName: n.slice(0, n.length - suffix.length).trim(),
      sheetName: n,
    }));
}
// PHASE PARSING

export interface ParsedPhaseRow {
  name: string;
  description: string;
  orderIndex: number;
  status: string; // "Planned" | "Active" | "Completed" | "On_Hold"
  startDate: string;
  endDate: string;
  importMode: "create" | "update";
  resolvedPhaseId?: string;
  errors: string[];
  warnings: string[];
}

function normalizePhaseStatus(raw: string): string {
  const s = raw.toLowerCase().trim().replace(/[\s-]/g, "_");
  if (["active"].includes(s)) return "Active";
  if (["completed", "done", "closed"].includes(s)) return "Completed";
  if (["on_hold", "onhold", "on_hold"].includes(s)) return "On_Hold";
  return "Planned";
}

export function resolvePhaseImportMatch(
  name: string,
  existingPhases?: { id: string; name: string }[],
): { importMode: "create" | "update"; resolvedPhaseId?: string } {
  const lower = name.trim().toLowerCase();
  if (!lower || !existingPhases?.length) return { importMode: "create" };
  const match = existingPhases.find((p) => p.name.trim().toLowerCase() === lower);
  return match
    ? { importMode: "update", resolvedPhaseId: match.id }
    : { importMode: "create" };
}

export function processRawPhaseRows(
  rows: string[][],
  existingPhases?: { id: string; name: string }[],
): ParsedPhaseRow[] {
  if (rows.length <= 1) return [];

  const headers = rows[0].map((h) => String(h).toLowerCase().trim());
  const dataRows = rows.slice(1);

  const getIdx = (aliases: string[]) =>
    headers.findIndex((h) => aliases.includes(h));

  const nameIdx   = getIdx(["name", "phase name", "phase"]);
  const descIdx   = getIdx(["description", "desc", "details"]);
  const orderIdx  = getIdx(["order", "order index", "orderindex", "sequence"]);
  const statusIdx = getIdx(["status", "phase status"]);
  const startIdx  = getIdx(["start date", "start"]);
  const endIdx    = getIdx(["end date", "end"]);

  return dataRows.map((row, i) => {
    const getVal = (idx: number, fallback = "") =>
      idx !== -1 && row[idx] ? String(row[idx]).trim() : fallback;

    const name        = getVal(nameIdx);
    const description = getVal(descIdx);
    const rawOrder    = getVal(orderIdx, String(i + 1));
    const orderIndex  = parseInt(rawOrder, 10) || i + 1;
    const rawStatus   = getVal(statusIdx, "Planned");
    const status      = normalizePhaseStatus(rawStatus);
    const startDate   = getVal(startIdx);
    const endDate     = getVal(endIdx);

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!name) errors.push("Phase name is required.");

    if (startDate && isNaN(Date.parse(startDate))) {
      errors.push("Start date must be a valid date (YYYY-MM-DD).");
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      errors.push("End date must be a valid date (YYYY-MM-DD).");
    }
    if (
      startDate &&
      endDate &&
      !isNaN(Date.parse(startDate)) &&
      !isNaN(Date.parse(endDate))
    ) {
      if (new Date(startDate) > new Date(endDate)) {
        errors.push("End date must be on or after start date.");
      }
    }

    const { importMode, resolvedPhaseId } = resolvePhaseImportMatch(name, existingPhases);

    return {
      name,
      description,
      orderIndex,
      status,
      startDate,
      endDate,
      importMode,
      resolvedPhaseId,
      errors,
      warnings,
    };
  });
}
// MILESTONE PARSING

export interface ParsedMilestoneRow {
  title: string;
  targetDate: string;
  weight: number;
  status: string; // "Pending" | "Completed" | "Missed"
  phaseName: string;
  importMode: "create" | "update";
  resolvedMilestoneId?: string;
  errors: string[];
  warnings: string[];
}

function normalizeMilestoneStatus(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (["completed", "done", "achieved"].includes(s)) return "Completed";
  if (["missed", "failed", "overdue"].includes(s)) return "Missed";
  return "Pending";
}

export function resolveMilestoneImportMatch(
  title: string,
  existingMilestones?: { id: string; title: string }[],
): { importMode: "create" | "update"; resolvedMilestoneId?: string } {
  const lower = title.trim().toLowerCase();
  if (!lower || !existingMilestones?.length) return { importMode: "create" };
  const match = existingMilestones.find((m) => m.title.trim().toLowerCase() === lower);
  return match
    ? { importMode: "update", resolvedMilestoneId: match.id }
    : { importMode: "create" };
}

export function processRawMilestoneRows(
  rows: string[][],
  existingMilestones?: { id: string; title: string }[],
): ParsedMilestoneRow[] {
  if (rows.length <= 1) return [];

  const headers = rows[0].map((h) => String(h).toLowerCase().trim());
  const dataRows = rows.slice(1);

  const getIdx = (aliases: string[]) =>
    headers.findIndex((h) => aliases.includes(h));

  const titleIdx      = getIdx(["title", "milestone", "milestone name"]);
  const targetDateIdx = getIdx(["target date", "due date", "date"]);
  const weightIdx     = getIdx(["weight", "weight (%)", "percent"]);
  const statusIdx     = getIdx(["status", "milestone status"]);
  const phaseIdx      = getIdx(["phase", "phase name"]);

  return dataRows.map((row) => {
    const getVal = (idx: number, fallback = "") =>
      idx !== -1 && row[idx] ? String(row[idx]).trim() : fallback;

    const title      = getVal(titleIdx);
    const targetDate = getVal(targetDateIdx);
    const rawWeight  = getVal(weightIdx, "0");
    const weight     = parseFloat(rawWeight.replace(/[^0-9.-]/g, "")) || 0;
    const rawStatus  = getVal(statusIdx, "Pending");
    const status     = normalizeMilestoneStatus(rawStatus);
    const phaseName  = getVal(phaseIdx);

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!title) errors.push("Milestone title is required.");
    if (!targetDate) {
      errors.push("Target date is required.");
    } else if (isNaN(Date.parse(targetDate))) {
      errors.push("Target date must be a valid date (YYYY-MM-DD).");
    }

    const { importMode, resolvedMilestoneId } = resolveMilestoneImportMatch(
      title,
      existingMilestones,
    );

    return {
      title,
      targetDate,
      weight,
      status,
      phaseName,
      importMode,
      resolvedMilestoneId,
      errors,
      warnings,
    };
  });
}
// SAMPLE TEMPLATE GENERATORS

/**
 * Generates a 4-sheet sample XLSX workbook for the Import Projects dialog.
 *
 * Sheets:
 *   1. "Projects"
 *   2. "Cyber Security Assessment Phases"
 *   3. "Cyber Security Assessment Tasks"
 *   4. "Cyber Security Assessment Milestones"
 */
export function generateProjectsXLSXTemplate(
  departments: Department[],
  customers: Customer[],
  managers: ProjectManager[],
): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  const deptName = departments[0]?.name            || "Security";
  const custName = customers[0]?.displayName        || "Acme Corp";
  const pm1Name  = managers[0]?.displayName         || "John Doe";
  const pm2Name  = managers[1]?.displayName         || "";
  const projectHeaders = [
    "Name", "Objective", "Department", "Customer",
    "Engagement Type", "Billing Model", "Priority",
    "Start Date", "End Date", "Value", "Currency",
    "Primary PM", "Secondary PM",
  ];
  const projectRows = [
    [
      "Security Assessment",
      "Perform vulnerability assessments and compliance audits.",
      deptName, custName,
      "FixedPrice", "FixedPrice", "High",
      "2026-07-01", "2026-09-30", "45000", "USD",
      pm1Name, pm2Name,
    ],
    [
      "Cloud Infrastructure Migration",
      "Migrate legacy servers to AWS cloud environments.",
      deptName, custName,
      "ManagedServices", "TimeAndMaterial", "Medium",
      "2026-08-15", "2027-02-15", "120000", "USD",
      pm1Name, "",
    ],
  ];
  const projectWS = XLSX.utils.aoa_to_sheet([projectHeaders, ...projectRows]);
  XLSX.utils.book_append_sheet(wb, projectWS, "Projects");
  const phaseHeaders = [
    "Name", "Description", "Order", "Status", "Start Date", "End Date",
  ];
  const phaseRows = [
    ["Discovery & Planning", "Kick-off, scoping and requirement gathering.", "1", "Active",  "2026-07-01", "2026-07-31"],
    ["Assessment Execution", "Run vulnerability scans and penetration tests.", "2", "Planned", "2026-08-01", "2026-09-15"],
    ["Reporting & Closure",  "Compile findings and present final report.",     "3", "Planned", "2026-09-16", "2026-09-30"],
  ];
  const phaseWS = XLSX.utils.aoa_to_sheet([phaseHeaders, ...phaseRows]);
  XLSX.utils.book_append_sheet(wb, phaseWS, "Security Assessment Phases");
  const taskHeaders = [
    "Title", "Description", "Priority", "Status",
    "Assignee", "Phase", "Start Date", "End Date", "Effort Hours",
    "Parent Task",
  ];
  const taskRows = [
    [
      "Kick-off Meeting",
      "Conduct initial project kick-off meeting with stakeholders.",
      "High", "To_Do", "", "Discovery & Planning", "2026-07-01", "2026-07-02", "4",
      "",
    ],
    [
      "Prepare agenda",
      "Draft kick-off agenda as a sub-task of Kick-off Meeting.",
      "Medium", "To_Do", "", "Discovery & Planning", "2026-07-01", "2026-07-02", "2",
      "Kick-off Meeting",
    ],
    [
      "Scope Document",
      "Define and document the engagement scope.",
      "High", "To_Do", "", "Discovery & Planning", "2026-07-03", "2026-07-10", "16",
      "",
    ],
    [
      "Network Vulnerability Scan",
      "Run automated scans across the internal network.",
      "Critical", "To_Do", "", "Assessment Execution", "2026-08-01", "2026-08-05", "24",
      "",
    ],
  ];
  const taskWS = XLSX.utils.aoa_to_sheet([taskHeaders, ...taskRows]);
  XLSX.utils.book_append_sheet(wb, taskWS, "Security Assessment Tasks");
  const milestoneHeaders = [
    "Title", "Target Date", "Weight (%)", "Status", "Phase",
  ];
  const milestoneRows = [
    ["Scope Document Approved", "2026-07-10", "20", "Pending", "Discovery & Planning"],
    ["Assessment Complete",     "2026-09-15", "50", "Pending", "Assessment Execution"],
    ["Final Report Delivered",  "2026-09-30", "30", "Pending", "Reporting & Closure"],
  ];
  const milestoneWS = XLSX.utils.aoa_to_sheet([milestoneHeaders, ...milestoneRows]);
  XLSX.utils.book_append_sheet(wb, milestoneWS, "Security Assessment Milestones");

  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

/**
 * Generates a single-sheet sample XLSX workbook for the Import Tasks dialog.
 */
export function generateTasksXLSXTemplate(
  assignees: ProjectTaskAssignee[],
  phases: ProjectPhase[],
): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  const defaultAssignee = assignees[0]?.displayName || "Team Member";
  const defaultPhase    = phases[0]?.name            || "Phase 1";

  const headers = [
    "Title",
    "Description",
    "Priority",
    "Status",
    "Assignee",
    "Phase",
    "Start Date",
    "End Date",
    "Duration Days",
    "Effort Hours",
    "% Complete",
    "Baseline Start",
    "Baseline End",
    "Baseline Duration Days",
    "Predecessors",
    "Parent Task",
  ];
  const rows = [
    [
      "Design Authentication UI",
      "Create wireframes and mockup designs for login/signup screens.",
      "High",
      "To_Do",
      defaultAssignee,
      defaultPhase,
      "2026-07-01",
      "2026-07-05",
      "5",
      "12",
      "0",
      "2026-07-01",
      "2026-07-05",
      "5",
      "",
      "",
    ],
    [
      "Login screen mockups",
      "Sub-task nested under Design Authentication UI via Parent Task.",
      "High",
      "To_Do",
      defaultAssignee,
      defaultPhase,
      "2026-07-01",
      "2026-07-03",
      "3",
      "8",
      "0",
      "2026-07-01",
      "2026-07-03",
      "3",
      "",
      "Design Authentication UI",
    ],
    [
      "Setup NestJS Backend API",
      "Initialize backend application and configure base folders.",
      "Critical",
      "In_Progress",
      defaultAssignee,
      defaultPhase,
      "2026-07-01",
      "2026-07-10",
      "8",
      "24",
      "40",
      "2026-07-01",
      "2026-07-10",
      "8",
      "Design Authentication UI (FS)",
      "",
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Tasks");

  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
export interface ParsedProjectRow {
  name: string;
  objective: string;
  departmentName: string;
  customerName: string;
  engagementType: string;
  billingModel: string;
  priority: string;
  startDate: string;
  endDate: string;
  value: number;
  currency: string;
  primaryPmName: string;
  secondaryPmName: string;
  status: string;

  // Import mode: 'create' for new, 'update' for updating an existing project
  importMode: "create" | "update";
  // The existing project ID when importMode === 'update'
  resolvedProjectId?: string;

  // Validation & Resolution details
  resolvedDepartmentId?: string;
  resolvedCustomerId?: string;
  resolvedPrimaryPmId?: string;
  resolvedSecondaryPmId?: string | null;
  
  errors: string[];
  warnings: string[];
}

/**
 * Validates and maps raw CSV rows into resolved project templates.
 */
export function processRawCSVRows(
  csvData: string[][],
  departments: Department[],
  customers: Customer[],
  managers: ProjectManager[],
  existingProjects?: { id: string; name: string }[]
): ParsedProjectRow[] {
  if (csvData.length <= 1) return [];

  const headers = csvData[0].map((h) => h.toLowerCase());
  const rows = csvData.slice(1);

  // Helper to find column index by header name alias
  const getIndex = (aliases: string[]) => {
    return headers.findIndex((h) => aliases.includes(h.trim()));
  };

  const nameIdx = getIndex(["name", "project name", "title"]);
  const objIdx = getIndex(["objective", "description", "details"]);
  const deptIdx = getIndex(["department", "dept"]);
  const custIdx = getIndex(["customer", "client"]);
  const engIdx = getIndex(["engagement type", "engagement"]);
  const methIdx = getIndex(["methodology", "method"]);
  const billIdx = getIndex(["billing model", "billing"]);
  const prioIdx = getIndex(["priority", "priority level"]);
  const startIdx = getIndex(["start date", "start"]);
  const endIdx = getIndex(["end date", "end"]);
  const valIdx = getIndex(["value", "budget", "amount"]);
  const curIdx = getIndex(["currency", "currency code"]);
  const pmIdx = getIndex(["primary pm", "pm", "project manager"]);
  const pm2Idx = getIndex(["secondary pm", "backup pm"]);
  const statusIdx = getIndex(["status", "project status"]);

  const nameFrequency: Record<string, number> = {};
  for (const row of rows) {
    const n = nameIdx !== -1 && row[nameIdx] ? row[nameIdx].trim() : "";
    if (n) nameFrequency[n] = (nameFrequency[n] ?? 0) + 1;
  }
  const duplicateNames = new Set(
    Object.entries(nameFrequency)
      .filter(([, count]) => count > 1)
      .map(([name]) => name),
  );

  return rows.map((row) => {
    const getVal = (idx: number, fallback = "") => (idx !== -1 && row[idx] ? row[idx].trim() : fallback);

    const name = getVal(nameIdx);
    const objective = getVal(objIdx);
    const departmentName = getVal(deptIdx);
    const customerName = getVal(custIdx);
    const engagementType = getVal(engIdx, "FixedPrice");
    // Legacy CSVs may include a methodology column; ignore it when present.
    getVal(methIdx);
    const billingModel = getVal(billIdx, "FixedPrice");
    const priority = getVal(prioIdx, "Medium");
    const startDate = getVal(startIdx);
    const endDate = getVal(endIdx);
    const rawValue = getVal(valIdx, "");
    const currency = getVal(curIdx, "USD");
    const primaryPmName = getVal(pmIdx);
    const secondaryPmName = getVal(pm2Idx);
    const status = getVal(statusIdx, "Draft");

    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic required field validations
    if (!name) errors.push("Project name is required.");
    if (name && name.length > PROJECT_NAME_MAX) {
      errors.push(`Project name must be ${PROJECT_NAME_MAX} characters or fewer (Keka limit).`);
    }
    if (!objective) errors.push("Objective is required.");
    if (objective && objective.length > PROJECT_OBJECTIVE_MAX) {
      errors.push(`Description must be ${PROJECT_OBJECTIVE_MAX} characters or fewer.`);
    }
    if (name && duplicateNames.has(name.trim())) {
      errors.push(`Duplicate project name "${name}" found in this file.`);
    }

    // Validate Start Date
    let isStartValid = false;
    if (startDate) {
      const parsedStart = Date.parse(startDate);
      if (!isNaN(parsedStart)) {
        isStartValid = true;
      } else {
        errors.push("Start date must be a valid date (YYYY-MM-DD).");
      }
    } else {
      errors.push("Start date is required.");
    }

    // Validate End Date
    let isEndValid = false;
    if (endDate) {
      const parsedEnd = Date.parse(endDate);
      if (!isNaN(parsedEnd)) {
        isEndValid = true;
      } else {
        errors.push("End date must be a valid date (YYYY-MM-DD).");
      }
    } else {
      errors.push("End date is required.");
    }

    // Validate Range
    if (isStartValid && isEndValid) {
      if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
        errors.push("End date must be on or after start date.");
      }
    }

    // Budget/value: missing or <= 0 defaults to 1 (API requires a positive amount).
    let value = parseFloat(rawValue.replace(/[^0-9.-]/g, ""));
    if (rawValue.trim() && Number.isNaN(value)) {
      errors.push("Invalid value/budget amount.");
      value = 1;
    } else if (!rawValue.trim() || Number.isNaN(value) || value <= 0) {
      warnings.push("Value/budget missing or zero; defaulted to 1.");
      value = 1;
    }

    // Resolve Department
    let resolvedDepartmentId = "";
    if (departmentName) {
      const dept = departments.find(
        (d) =>
          d.name.toLowerCase() === departmentName.toLowerCase() ||
          d.code.toLowerCase() === departmentName.toLowerCase()
      );
      if (dept) {
        resolvedDepartmentId = dept.id;
      } else {
        errors.push(`Department "${departmentName}" not found. Please select one.`);
      }
    } else {
      errors.push("Department is required.");
    }

    // Resolve Customer
    let resolvedCustomerId = "";
    if (customerName) {
      const cust = customers.find(
        (c) => c.displayName.toLowerCase() === customerName.toLowerCase()
      );
      if (cust) {
        resolvedCustomerId = cust.id;
      } else {
        errors.push(`Customer "${customerName}" not found. Please select one.`);
      }
    } else {
      errors.push("Customer is required.");
    }

    // Resolve Primary PM
    let resolvedPrimaryPmId = "";
    if (primaryPmName) {
      const pm = managers.find(
        (m) =>
          m.displayName.toLowerCase() === primaryPmName.toLowerCase() ||
          m.email.toLowerCase() === primaryPmName.toLowerCase()
      );
      if (pm) {
        resolvedPrimaryPmId = pm.id;
      } else {
        errors.push(`Primary PM "${primaryPmName}" not found. Please select one.`);
      }
    } else {
      errors.push("Primary PM is required.");
    }

    // Resolve Secondary PM
    let resolvedSecondaryPmId: string | null = null;
    if (secondaryPmName) {
      const pm = managers.find(
        (m) =>
          m.displayName.toLowerCase() === secondaryPmName.toLowerCase() ||
          m.email.toLowerCase() === secondaryPmName.toLowerCase()
      );
      if (pm) {
        resolvedSecondaryPmId = pm.id;
      } else {
        warnings.push(`Secondary PM "${secondaryPmName}" not found.`);
      }
    }

    // Normalize select dropdown fields to standard backend API enum values
    let normalizedEngagement = engagementType;
    const lowerEngagement = engagementType.toLowerCase().trim();
    if (["staff augmentation", "staff_augmentation", "staffaugmentation"].includes(lowerEngagement)) {
      normalizedEngagement = "StaffAugmentation";
    } else if (["milestone based", "milestone_based", "milestonebased"].includes(lowerEngagement)) {
      normalizedEngagement = "FixedPrice"; // Map MilestoneBased to FixedPrice
    } else if (["time and materials", "time_and_materials", "timeandmaterials", "time and material", "time_and_material", "timeandmaterial", "t&m"].includes(lowerEngagement)) {
      normalizedEngagement = "FixedPrice"; // Map T&M to FixedPrice as engagement type
    } else if (["retainer"].includes(lowerEngagement)) {
      normalizedEngagement = "FixedPrice"; // Map Retainer to FixedPrice as engagement type
    } else if (["fixed price", "fixed_price", "fixedprice", "fixed", "implementation"].includes(lowerEngagement)) {
      normalizedEngagement = "FixedPrice";
    } else if (["managed services", "managed_services", "managedservices", "managed service", "managed_service", "managedservice", "advisory", "assessment", "training"].includes(lowerEngagement)) {
      normalizedEngagement = "ManagedServices";
    }

    let normalizedBilling = billingModel;
    const lowerBilling = billingModel.toLowerCase().trim();
    if (["fixed price", "fixed_price", "fixedprice", "fixed"].includes(lowerBilling)) {
      normalizedBilling = "FixedPrice";
    } else if (["time and materials", "time_and_materials", "timeandmaterials", "time and material", "time_and_material", "timeandmaterial", "t&m", "time & materials"].includes(lowerBilling)) {
      normalizedBilling = "TimeAndMaterial";
    } else if (["milestone", "milestone based", "milestone_based", "milestonebased"].includes(lowerBilling)) {
      normalizedBilling = "FixedPrice"; // Map Milestone to FixedPrice
    } else if (["retainer"].includes(lowerBilling)) {
      normalizedBilling = "Retainer";
    }

    let normalizedPriority = priority;
    const lowerPriority = priority.toLowerCase().trim();
    if (["critical"].includes(lowerPriority)) {
      normalizedPriority = "Critical";
    } else if (["high"].includes(lowerPriority)) {
      normalizedPriority = "High";
    } else if (["medium"].includes(lowerPriority)) {
      normalizedPriority = "Medium";
    } else if (["low"].includes(lowerPriority)) {
      normalizedPriority = "Low";
    }

    let normalizedStatus = status;
    const lowerStatus = status.toLowerCase().trim();
    if (["active"].includes(lowerStatus)) {
      normalizedStatus = "Active";
    } else if (
      ["pending closure", "pending_closure", "pendingclosure"].includes(lowerStatus)
    ) {
      normalizedStatus = "PendingClosure";
    } else if (["at risk", "atrisk", "at_risk"].includes(lowerStatus)) {
      normalizedStatus = "AtRisk";
    } else if (["on hold", "on_hold", "onhold"].includes(lowerStatus)) {
      normalizedStatus = "OnHold";
    } else if (["closed", "completed"].includes(lowerStatus)) {
      normalizedStatus = "Closed";
    } else if (["cancelled", "canceled"].includes(lowerStatus)) {
      normalizedStatus = "Cancelled";
    } else if (["planned", "draft"].includes(lowerStatus)) {
      normalizedStatus = "Draft";
    }

    let normalizedCurrency = currency;
    const lowerCurrency = currency.toLowerCase().trim();
    if (["usd"].includes(lowerCurrency)) {
      normalizedCurrency = "USD";
    } else if (["eur"].includes(lowerCurrency)) {
      normalizedCurrency = "EUR";
    } else if (["aed"].includes(lowerCurrency)) {
      normalizedCurrency = "AED";
    } else if (["sar"].includes(lowerCurrency)) {
      normalizedCurrency = "SAR";
    }

    // Add validation errors for invalid enum values
    if (!["ManagedServices", "StaffAugmentation", "FixedPrice"].includes(normalizedEngagement)) {
      errors.push(`Engagement Type "${engagementType}" is invalid. Please select one.`);
    }
    if (!["TimeAndMaterial", "FixedPrice", "Retainer"].includes(normalizedBilling)) {
      errors.push(`Billing Model "${billingModel}" is invalid. Please select one.`);
    }
    if (!["Low", "Medium", "High", "Critical"].includes(normalizedPriority)) {
      errors.push(`Priority "${priority}" is invalid. Please select one.`);
    }
    if (!["USD", "EUR", "AED", "SAR"].includes(normalizedCurrency)) {
      errors.push(`Currency "${currency}" is invalid. Please select one.`);
    }
    if (
      ![
        "Draft",
        "Active",
        "OnHold",
        "AtRisk",
        "PendingClosure",
        "Closed",
        "Cancelled",
      ].includes(normalizedStatus)
    ) {
      errors.push(`Status "${status}" is invalid. Please select one.`);
    }

    // Resolve existing project for update mode
    const { importMode, resolvedProjectId } = resolveProjectImportMatch(name, existingProjects);

    return {
      name,
      objective,
      departmentName,
      customerName,
      engagementType: normalizedEngagement,
      billingModel: normalizedBilling,
      priority: normalizedPriority,
      startDate,
      endDate,
      value: Number.isNaN(value) || value <= 0 ? 1 : value,
      currency: normalizedCurrency,
      primaryPmName,
      secondaryPmName,
      status: normalizedStatus,
      importMode,
      resolvedProjectId,
      resolvedDepartmentId,
      resolvedCustomerId,
      resolvedPrimaryPmId,
      resolvedSecondaryPmId,
      errors,
      warnings,
    };
  });
}

export function convertTasksToCSV(
  tasks: Task[],
  phases: ProjectPhase[],
  assignees: ProjectTaskAssignee[],
  selectedFields?: string[],
  dependencies: TaskExportDependency[] = [],
  projectOrganization?: string | null,
): string {
  const headers = selectedFields?.length ? selectedFields : DEFAULT_TASK_EXPORT_FIELDS;

  const escapeCSV = (str: any) => {
    if (str == null) return "";
    const s = String(str);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = mapTasksToExportRows(tasks, {
    dependencies,
    phases,
    assignees,
    projectOrganization,
  }).map((row) => headers.map((field) => escapeCSV(row[field] ?? "")));

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function exportTasksToXLSX(
  tasks: Task[],
  phases: ProjectPhase[],
  assignees: ProjectTaskAssignee[],
  selectedFields?: string[],
  dependencies: TaskExportDependency[] = [],
  projectOrganization?: string | null,
  milestones: ProjectMilestone[] = [],
): ArrayBuffer {
  const headers = selectedFields?.length ? selectedFields : DEFAULT_TASK_EXPORT_FIELDS;

  const data = mapTasksToExportRows(tasks, {
    dependencies,
    phases,
    assignees,
    projectOrganization,
  }).map((row) => pickExportFields(row, headers));

  const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");

  const mspRows = buildMspExcelRows({
    tasks,
    phases,
    milestones,
    dependencies,
    projectOrganization,
  });
  if (mspRows.length > 0) {
    prependMspExcelSheet(workbook, mspRows);
  }

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export interface ParsedTaskRow {
  title: string;
  description: string;
  priority: string;
  status: string;
  assigneeName: string;
  phaseName: string;
  startDate: string;
  endDate: string;
  effortHours: number;
  /** Optional schedule columns (Excel export round-trip). */
  durationDays?: number;
  baselineStart?: string;
  baselineEnd?: string;
  baselineDurationDays?: number;
  actualStart?: string;
  actualEnd?: string;
  progressApproved?: number;
  /** Parsed from Excel "Predecessors" column (applied after all tasks exist). */
  predecessors?: ParsedExcelPredecessor[];
  /** Excel "Parent Task" title. Undefined when the column is absent. */
  parentTaskTitle?: string;

  resolvedAssigneeId?: string | null;
  resolvedPhaseId?: string | null;

  /** Resolved at parse-time based on title matching against existing tasks */
  importMode: "create" | "update";
  resolvedTaskId?: string;

  errors: string[];
  warnings: string[];
  isSummary?: boolean;
  isMilestone?: boolean;
}

export type TaskCsvImportKind = "tasks" | "projects" | "unknown";

export function detectTaskCsvImportKind(csvData: string[][]): TaskCsvImportKind {
  if (csvData.length === 0) return "unknown";

  const headers = csvData[0].map((h) => h.toLowerCase().trim());
  const has = (aliases: string[]) =>
    aliases.some((alias) => headers.some((header) => header === alias || header.includes(alias)));

  const looksLikeProjects =
    has(["department", "dept"]) &&
    has(["customer", "client"]) &&
    (has(["objective"]) || has(["engagement type", "engagement"]));

  const looksLikeTasks =
    has(["title", "task title", "task name"]) ||
    (has(["effort hours", "effort", "hours"]) &&
      (has(["assignee", "owner"]) || has(["phase", "project phase", "stage"])));

  if (looksLikeProjects && !looksLikeTasks) return "projects";
  if (looksLikeTasks) return "tasks";
  return "unknown";
}

function normalizeTaskPriority(priority: string) {
  const lowerPriority = priority.toLowerCase().trim();
  if (["critical"].includes(lowerPriority)) return "Critical";
  if (["high"].includes(lowerPriority)) return "High";
  if (["medium"].includes(lowerPriority)) return "Medium";
  if (["low"].includes(lowerPriority)) return "Low";
  return priority;
}

function normalizeTaskStatus(status: string) {
  const lowerStatus = status.toLowerCase().trim().replace(/[\s-]/g, "_");
  if (["to_do", "todo", "to do"].includes(lowerStatus)) return "To_Do";
  if (["in_progress", "inprogress", "in progress"].includes(lowerStatus)) return "In_Progress";
  if (["submitted_for_review", "submittedforreview", "submitted for review"].includes(lowerStatus)) {
    return "Submitted_for_Review";
  }
  if (["approved"].includes(lowerStatus)) return "Approved";
  if (["rework"].includes(lowerStatus)) return "Rework";
  if (["done", "completed", "closed"].includes(lowerStatus)) return "Done";
  return status;
}

export function resolveProjectImportMatch(
  name: string,
  existingProjects?: { id: string; name: string }[],
): { importMode: "create" | "update"; resolvedProjectId?: string } {
  const key = name.trim();
  if (!key || !existingProjects?.length) return { importMode: "create" };
  const match = existingProjects.find((p) => p.name.trim() === key);
  return match
    ? { importMode: "update", resolvedProjectId: match.id }
    : { importMode: "create" };
}

export function resolveTaskImportMatch(
  title: string,
  parentTitle?: string | null,
  existingTasks?: { id: string; title: string; parentTitle?: string | null }[],
  claimedIds?: Set<string>,
): { importMode: "create" | "update"; resolvedTaskId?: string } {
  const lower = title.trim().toLowerCase();
  if (!lower || !existingTasks?.length) return { importMode: "create" };
  const parentKey = (parentTitle ?? "").trim().toLowerCase();
  const sameParent = existingTasks.filter(
    (t) =>
      t.title.trim().toLowerCase() === lower &&
      (t.parentTitle ?? "").trim().toLowerCase() === parentKey,
  );
  const unusedSameParent = sameParent.find((t) => !claimedIds?.has(t.id));
  if (unusedSameParent) {
    claimedIds?.add(unusedSameParent.id);
    return { importMode: "update", resolvedTaskId: unusedSameParent.id };
  }
  if (parentTitle === undefined) {
    const byTitle = existingTasks.filter(
      (t) => t.title.trim().toLowerCase() === lower && !claimedIds?.has(t.id),
    );
    if (byTitle.length === 1) {
      claimedIds?.add(byTitle[0].id);
      return { importMode: "update", resolvedTaskId: byTitle[0].id };
    }
  }
  return { importMode: "create" };
}

export function revalidateParsedTaskRow(
  row: ParsedTaskRow,
  phases: ProjectPhase[],
  assignees: ProjectTaskAssignee[],
  _duplicateTitles?: Set<string>,
  existingTasks?: { id: string; title: string; parentTitle?: string | null }[],
  claimedExistingIds?: Set<string>,
): ParsedTaskRow {
  const updated = {
    ...row,
    priority: normalizeTaskPriority(row.priority),
    status: normalizeTaskStatus(row.status),
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!updated.title) errors.push("Task title is required.");

  const { importMode, resolvedTaskId } = existingTasks
    ? resolveTaskImportMatch(
        updated.title,
        updated.parentTaskTitle,
        existingTasks,
        claimedExistingIds,
      )
    : { importMode: updated.importMode, resolvedTaskId: updated.resolvedTaskId };

  let isStartValid = false;
  let normalizedStart = "";
  if (updated.startDate) {
    const startKey = toTaskDayKey(updated.startDate);
    if (startKey) {
      isStartValid = true;
      normalizedStart = startKey;
    } else {
      errors.push("Start date must be a valid date (YYYY-MM-DD).");
    }
  }

  let isEndValid = false;
  let normalizedEnd = "";
  if (updated.endDate) {
    const endKey = toTaskDayKey(updated.endDate);
    if (endKey) {
      isEndValid = true;
      normalizedEnd = endKey;
    } else {
      errors.push("End date must be a valid date (YYYY-MM-DD).");
    }
  }

  if (isStartValid && isEndValid && normalizedStart && normalizedEnd) {
    if (normalizedStart > normalizedEnd) {
      errors.push("End date must be on or after start date.");
    }
  }

  if (updated.effortHours != null && isNaN(Number(updated.effortHours))) {
    errors.push("Invalid effort hours.");
  }

  if (
    updated.durationDays != null &&
    (!Number.isFinite(Number(updated.durationDays)) || Number(updated.durationDays) <= 0)
  ) {
    errors.push("Invalid duration days.");
  }

  if (
    updated.baselineDurationDays != null &&
    (!Number.isFinite(Number(updated.baselineDurationDays)) ||
      Number(updated.baselineDurationDays) <= 0)
  ) {
    errors.push("Invalid baseline duration days.");
  }

  if (
    updated.progressApproved != null &&
    (!Number.isFinite(Number(updated.progressApproved)) ||
      Number(updated.progressApproved) < 0 ||
      Number(updated.progressApproved) > 100)
  ) {
    errors.push("% Complete must be between 0 and 100.");
  }

  let normalizedBaselineStart = updated.baselineStart || "";
  if (updated.baselineStart) {
    const key = toTaskDayKey(updated.baselineStart);
    if (key) {
      normalizedBaselineStart = key;
    } else {
      errors.push("Baseline start must be a valid date (YYYY-MM-DD).");
    }
  }

  let normalizedBaselineEnd = updated.baselineEnd || "";
  if (updated.baselineEnd) {
    const key = toTaskDayKey(updated.baselineEnd);
    if (key) {
      normalizedBaselineEnd = key;
    } else {
      errors.push("Baseline end must be a valid date (YYYY-MM-DD).");
    }
  }

  let normalizedActualStart = updated.actualStart || "";
  if (updated.actualStart) {
    const key = toTaskDayKey(updated.actualStart);
    if (key) {
      normalizedActualStart = key;
    } else {
      errors.push("Actual start must be a valid date (YYYY-MM-DD).");
    }
  }

  let normalizedActualEnd = updated.actualEnd || "";
  if (updated.actualEnd) {
    const key = toTaskDayKey(updated.actualEnd);
    if (key) {
      normalizedActualEnd = key;
    } else {
      errors.push("Actual end must be a valid date (YYYY-MM-DD).");
    }
  }

  if (
    normalizedBaselineStart &&
    normalizedBaselineEnd &&
    normalizedBaselineStart > normalizedBaselineEnd
  ) {
    errors.push("Baseline end must be on or after baseline start.");
  }

  if (
    normalizedActualStart &&
    normalizedActualEnd &&
    normalizedActualStart > normalizedActualEnd
  ) {
    errors.push("Actual end must be on or after actual start.");
  }

  let resolvedAssigneeId = updated.resolvedAssigneeId ?? null;
  if (resolvedAssigneeId) {
    const assigneeExists = assignees.some((assignee) => assignee.userId === resolvedAssigneeId);
    if (!assigneeExists) resolvedAssigneeId = null;
  } else if (updated.assigneeName) {
    const assignee = findProjectTaskAssignee(updated.assigneeName, assignees);
    if (assignee) {
      resolvedAssigneeId = assignee.userId;
    } else if (assignees.length === 0) {
      warnings.push(
        `Assignee "${updated.assigneeName}" will be skipped until they are on the project team.`,
      );
    } else {
      errors.push(
        `Assignee "${updated.assigneeName}" is not on the project team. Add them to the team first.`,
      );
    }
  }

  let resolvedPhaseId = updated.resolvedPhaseId ?? null;
  let phaseName = updated.phaseName;
  let resolvedPhase: ProjectPhase | undefined;
  if (resolvedPhaseId) {
    resolvedPhase = phases.find((item) => item.id === resolvedPhaseId);
    if (resolvedPhase) {
      phaseName = resolvedPhase.name;
    } else {
      resolvedPhaseId = null;
    }
  }

  if (!resolvedPhaseId && phaseName) {
    resolvedPhase = phases.find((item) => item.name.toLowerCase() === phaseName.toLowerCase());
    if (resolvedPhase) {
      resolvedPhaseId = resolvedPhase.id;
      phaseName = resolvedPhase.name;
    } else {
      warnings.push(`Phase "${phaseName}" was not found. It will be created on import.`);
    }
  } else if (!resolvedPhaseId && !phaseName) {
    errors.push("Phase is required. This row will not be assigned to the first phase.");
  }

  // Import no longer dumps unmatched/blank rows onto the first phase.
  const effectivePhase = resolvedPhase;

  if (effectivePhase && (isStartValid || isEndValid)) {
    const phaseStartKey = toTaskDayKey(effectivePhase.startDate);
    const phaseEndKey = toTaskDayKey(effectivePhase.endDate);
    if (!phaseStartKey && !phaseEndKey) {
      errors.push(
        `Phase "${effectivePhase.name}" has no start/end dates. Update the phase dates first.`,
      );
    } else {
      const phaseDateErrors = taskDatesOutsidePhaseErrors({
        start: isStartValid ? importDayToLocalDate(normalizedStart) : null,
        end: isEndValid ? importDayToLocalDate(normalizedEnd) : null,
        phaseStart: effectivePhase.startDate,
        phaseEnd: effectivePhase.endDate,
      });
      if (phaseDateErrors.startDate) errors.push(phaseDateErrors.startDate);
      if (phaseDateErrors.endDate) errors.push(phaseDateErrors.endDate);
    }
  }

  if (!["Low", "Medium", "High", "Critical"].includes(updated.priority)) {
    errors.push(`Priority "${row.priority}" is invalid. Please select one.`);
  }

  if (
    !["To_Do", "In_Progress", "Submitted_for_Review", "Approved", "Rework", "Done"].includes(
      updated.status,
    )
  ) {
    errors.push(`Status "${row.status}" is invalid. Please select one.`);
  }

  let parentTaskTitle = updated.parentTaskTitle;
  if (parentTaskTitle?.trim()) {
    if (parentTaskTitle.trim().toLowerCase() === updated.title.trim().toLowerCase()) {
      warnings.push(
        "Parent Task cannot be the same as the task title. This row will import as a top-level task.",
      );
      parentTaskTitle = "";
    }
  }

  return {
    ...updated,
    parentTaskTitle,
    startDate: isStartValid ? normalizedStart : updated.startDate,
    endDate: isEndValid ? normalizedEnd : updated.endDate,
    baselineStart: normalizedBaselineStart || undefined,
    baselineEnd: normalizedBaselineEnd || undefined,
    actualStart: normalizedActualStart || undefined,
    actualEnd: normalizedActualEnd || undefined,
    durationDays:
      updated.durationDays != null && Number.isFinite(Number(updated.durationDays))
        ? Math.round(Number(updated.durationDays) * 10) / 10
        : undefined,
    baselineDurationDays:
      updated.baselineDurationDays != null &&
      Number.isFinite(Number(updated.baselineDurationDays))
        ? Math.round(Number(updated.baselineDurationDays) * 10) / 10
        : undefined,
    progressApproved:
      updated.progressApproved != null && Number.isFinite(Number(updated.progressApproved))
        ? Math.max(0, Math.min(100, Math.round(Number(updated.progressApproved))))
        : undefined,
    phaseName,
    resolvedAssigneeId,
    resolvedPhaseId,
    importMode,
    resolvedTaskId,
    errors,
    warnings,
  };
}

function isSameParentDuplicateError(message: string): boolean {
  return (
    message.startsWith("Duplicate task title \"") &&
    (message.includes("under the same parent") || message.includes("found in this file"))
  );
}

/** Duplicate titles under the same parent are kept (same as MPP import). */
export function markExtraSameParentTitleRows(rows: ParsedTaskRow[]): ParsedTaskRow[] {
  return rows.map((row) => ({
    ...row,
    errors: row.errors.filter((e) => !isSameParentDuplicateError(e)),
  }));
}

export function processRawTaskCSVRows(
  csvData: string[][],
  phases: ProjectPhase[],
  assignees: ProjectTaskAssignee[],
  existingTasks?: { id: string; title: string; parentTitle?: string | null }[]
): ParsedTaskRow[] {
  if (csvData.length <= 1) return [];

  const headers = csvData[0].map((h) => h.toLowerCase());
  const rows = csvData.slice(1);
  const claimedExistingIds = new Set<string>();

  const getIndex = (aliases: string[]) => {
    return headers.findIndex((h) => aliases.includes(h.trim()));
  };

  const titleIdx = getIndex(["title", "task title", "task name"]);
  const descIdx = getIndex(["description", "desc", "details", "objective"]);
  const prioIdx = getIndex(["priority", "priority level"]);
  const statusIdx = getIndex(["status", "task status"]);
  const assigneeIdx = getIndex(["assignee", "owner", "pm"]);
  const phaseIdx = getIndex(["phase", "project phase", "stage"]);
  const startIdx = getIndex(["start date", "start"]);
  const endIdx = getIndex(["end date", "end"]);
  const effortIdx = getIndex(["effort hours", "effort", "hours", "working hours", "work hours"]);
  const durationIdx = getIndex(["duration days"]);
  const baselineStartIdx = getIndex(["baseline start", "baseline start date"]);
  const baselineEndIdx = getIndex(["baseline end", "baseline finish", "baseline end date"]);
  const baselineDurationIdx = getIndex([
    "baseline duration days",
    "baseline duration",
  ]);
  const actualStartIdx = getIndex(["actual start", "actual start date"]);
  const actualEndIdx = getIndex([
    "actual end",
    "actual finish",
    "actual end date",
    "actual finish date",
  ]);
  const progressIdx = getIndex([
    "% complete",
    "percent complete",
    "%complete",
    "progress",
    "progress approved",
  ]);
  const predecessorsIdx = getIndex(["predecessors", "predecessor", "preds"]);
  const parentIdx = getIndex([
    "parent task",
    "parent task title",
    "parent title",
    "parent",
  ]);

  const parseOptionalNumber = (raw: string): number | undefined => {
    if (!raw) return undefined;
    const parsed = parseFloat(raw.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const parsed = rows.map((row) => {
    const getVal = (idx: number, fallback = "") => (idx !== -1 && row[idx] ? row[idx].trim() : fallback);

    const title = getVal(titleIdx);
    const description = getVal(descIdx);
    const priority = getVal(prioIdx, "Medium");
    const status = getVal(statusIdx, "To_Do");
    const assigneeName = getVal(assigneeIdx);
    const phaseName = getVal(phaseIdx);
    const startDate = getVal(startIdx);
    const endDate = getVal(endIdx);
    const rawEffort = getVal(effortIdx, "0");

    let effortHours = 0;
    if (rawEffort) {
      const parsedEffort = parseFloat(rawEffort.replace(/[^0-9.-]/g, ""));
      effortHours = isNaN(parsedEffort) ? NaN : parsedEffort;
    }

    const durationDays = parseOptionalNumber(getVal(durationIdx));
    const baselineDurationDays = parseOptionalNumber(getVal(baselineDurationIdx));
    const progressApproved = parseOptionalNumber(getVal(progressIdx));
    const baselineStart = getVal(baselineStartIdx) || undefined;
    const baselineEnd = getVal(baselineEndIdx) || undefined;
    const actualStart = getVal(actualStartIdx) || undefined;
    const actualEnd = getVal(actualEndIdx) || undefined;
    const predecessors = parsePredecessorsCell(getVal(predecessorsIdx));
    const parentTaskTitle = parentIdx === -1 ? undefined : getVal(parentIdx);

    return revalidateParsedTaskRow(
      {
        title,
        description,
        priority,
        status,
        assigneeName,
        phaseName,
        startDate,
        endDate,
        effortHours,
        durationDays,
        baselineStart,
        baselineEnd,
        baselineDurationDays,
        actualStart,
        actualEnd,
        progressApproved,
        predecessors,
        parentTaskTitle,
        importMode: "create",
        errors: [],
        warnings: [],
      },
      phases,
      assignees,
      undefined,
      existingTasks,
      claimedExistingIds,
    );
  });

  return markExtraSameParentTitleRows(parsed);
}

/** Schedule fields for create/update task API (Excel export round-trip). */
export function scheduleFieldsFromParsedTask(row: ParsedTaskRow): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (row.durationDays != null && Number.isFinite(row.durationDays) && row.durationDays > 0) {
    body.durationDays = row.durationDays;
  }
  if (
    row.baselineDurationDays != null &&
    Number.isFinite(row.baselineDurationDays) &&
    row.baselineDurationDays > 0
  ) {
    body.baselineDurationDays = row.baselineDurationDays;
  }
  // Send calendar day (YYYY-MM-DD) so Prisma @db.Date does not shift by timezone.
  if (row.baselineStart) {
    body.baselineStart = row.baselineStart;
  }
  if (row.baselineEnd) {
    body.baselineEnd = row.baselineEnd;
  }
  if (row.actualStart) {
    body.actualStart = row.actualStart;
  }
  if (row.actualEnd) {
    body.actualEnd = row.actualEnd;
  }
  if (row.progressApproved != null && Number.isFinite(row.progressApproved)) {
    body.progressApproved = row.progressApproved;
  }
  return body;
}

export function exportTasksToPDF(
  tasks: Task[],
  phases: ProjectPhase[],
  assignees: ProjectTaskAssignee[],
  selectedFields?: string[],
  dependencies: TaskExportDependency[] = [],
  projectOrganization?: string | null,
): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const headers = resolveTaskPdfHeaders(selectedFields);
  const rows = mapTasksToExportRows(tasks, {
    dependencies,
    phases,
    assignees,
    projectOrganization,
  });

  drawPdfReportHeader(doc, "Task Schedule Export");
  drawPdfScheduleTable(doc, headers, rows, 28);

  return doc.output("blob");
}

export function exportProjectsToPDF(
  projects: any[],
  departments: Department[],
  customers: Customer[],
  managers: ProjectManager[],
  selectedFields?: string[],
  tasks?: any[],
  selectedTaskFields?: string[],
  dependencies: TaskExportDependency[] = [],
  phasesByProjectId: Record<string, ProjectPhase[]> = {},
  milestonesByProjectId: Record<string, ProjectMilestone[]> = {},
): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const headers = resolveProjectExportHeaders(selectedFields);

  const reportTitle =
    projects.length === 1 && projects[0]?.name
      ? `Project Schedule — ${projects[0].name}`
      : "Project Schedule Export";

  projects.forEach((project, index) => {
    if (index > 0) doc.addPage("a4", "portrait");
    drawPdfReportHeader(doc, reportTitle);

    const row = mapProjectToExportRow(
      project,
      departments,
      customers,
      managers,
    );
    let y = 30;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(String(row.Name || "Project"), 14, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Status: ${row.Status || "—"}  ·  Priority: ${row.Priority || "—"}`,
      14,
      y,
    );
    y += 6;

    const identityFields = [
      "Objective",
      "Department",
      "Customer",
      "Engagement Type",
      "Billing Model",
      "Primary PM",
      "Secondary PM",
      "Value",
      "Currency",
    ].filter((f) => headers.includes(f));

    const scheduleFields = [
      "Start Date",
      "End Date",
      "Duration Days",
      "Baseline Start",
      "Baseline End",
      "Baseline Duration Days",
      "% Complete",
      "Duration Variance Days",
      "Actual Start",
      "Actual End",
    ].filter((f) => headers.includes(f));

    y = drawPdfSectionTitle(doc, "Overview", y);
    y = drawPdfKeyValueGrid(
      doc,
      identityFields.map((f) => [f, String(row[f] ?? "—")]),
      y,
    );

    y = drawPdfSectionTitle(doc, "Schedule", y + 4);
    y = drawPdfKeyValueGrid(
      doc,
      scheduleFields.map((f) => [f, String(row[f] ?? "—")]),
      y,
    );

    const shown = new Set([
      "Name",
      "Status",
      "Priority",
      ...identityFields,
      ...scheduleFields,
    ]);
    const extra = headers.filter((f) => !shown.has(f));
    if (extra.length > 0) {
      y = drawPdfSectionTitle(doc, "Additional fields", y + 4);
      y = drawPdfKeyValueGrid(
        doc,
        extra.map((f) => [f, String(row[f] ?? "—")]),
        y,
      );
    }

    const projectId = String(project.id ?? "");
    const phases = phasesByProjectId[projectId] ?? [];
    if (phases.length > 0) {
      doc.addPage("a4", "portrait");
      drawPdfReportHeader(doc, `Phases — ${String(row.Name || project.name || "Project")}`);
      drawPdfScheduleTable(
        doc,
        ["Name", "Description", "Order", "Status", "Start Date", "End Date"],
        phases
          .slice()
          .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
          .map((phase) => ({
            Name: phase.name ?? "",
            Description: phase.description ?? "",
            Order: phase.orderIndex ?? "",
            Status: phase.status ?? "",
            "Start Date": toExportDay(phase.startDate),
            "End Date": toExportDay(phase.endDate),
          })),
        28,
      );
    }

    const milestones = milestonesByProjectId[projectId] ?? [];
    if (milestones.length > 0) {
      const phaseNameById = new Map(
        phases.map((ph) => [ph.id, ph.name]),
      );
      doc.addPage("a4", "portrait");
      drawPdfReportHeader(
        doc,
        `Milestones — ${String(row.Name || project.name || "Project")}`,
      );
      drawPdfScheduleTable(
        doc,
        ["Title", "Target Date", "Weight (%)", "Status", "Phase"],
        milestones.map((ms) => ({
          Title: ms.title ?? "",
          "Target Date": toExportDay(ms.targetDate),
          "Weight (%)": ms.weight ?? "",
          Status: ms.status ?? "",
          Phase:
            ms.phase?.name ||
            (ms.phaseId ? phaseNameById.get(ms.phaseId) ?? "" : "") ||
            "",
        })),
        28,
      );
    }
  });

  if (tasks && tasks.length > 0) {
    const tasksByProject: Record<string, any[]> = {};
    tasks.forEach((t) => {
      const projName = t.projectName || "Tasks";
      if (!tasksByProject[projName]) tasksByProject[projName] = [];
      tasksByProject[projName].push(t);
    });

    const taskHeaders = resolveTaskPdfHeaders(selectedTaskFields);

    Object.entries(tasksByProject).forEach(([projName, projTasks]) => {
      doc.addPage("a4", "landscape");
      drawPdfReportHeader(doc, `Task Schedule — ${projName}`);
      const mapped = mapTasksToExportRows(projTasks, {
        dependencies,
        projectName: projName,
        projectOrganization: (t) =>
          t.project?.customer?.displayName ||
          t.customerName ||
          t.projectOrganization ||
          null,
      });
      drawPdfScheduleTable(doc, taskHeaders, mapped, 28);
    });
  }

  return doc.output("blob");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared Word/HTML table CSS — avoids Google Docs one-letter-per-line header wrap. */
const WORD_EXPORT_TABLE_CSS = `
  table.data { border-collapse: collapse; width: auto; max-width: none; table-layout: auto; margin-top: 12px; margin-bottom: 16px; }
  table.data th, table.data td {
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
    word-break: normal;
    overflow-wrap: break-word;
    white-space: normal;
  }
  table.data th {
    background-color: #f8fafc;
    font-weight: bold;
    color: #0f172a;
    font-size: 9pt;
    white-space: nowrap;
  }
  table.data td { font-size: 9pt; }
  table.kv { border-collapse: collapse; width: 100%; max-width: 7.5in; margin-top: 8px; margin-bottom: 16px; table-layout: fixed; }
  table.kv th, table.kv td {
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
    word-break: normal;
    overflow-wrap: break-word;
  }
  table.kv th {
    width: 2.2in;
    background-color: #f8fafc;
    font-weight: bold;
    color: #0f172a;
    font-size: 9pt;
    white-space: nowrap;
  }
  table.kv td { font-size: 9pt; }
`;

export function exportProjectsToWord(
  projects: any[],
  departments: Department[],
  customers: Customer[],
  managers: ProjectManager[],
  selectedFields?: string[],
  tasks?: any[],
  selectedTaskFields?: string[],
  dependencies: TaskExportDependency[] = [],
  phasesByProjectId: Record<string, ProjectPhase[]> = {},
  milestonesByProjectId: Record<string, ProjectMilestone[]> = {},
): Blob {
  const headers = resolveProjectExportHeaders(selectedFields);
  const reportTitle =
    projects.length === 1 && projects[0]?.name
      ? `Project Schedule — ${projects[0].name}`
      : "Project Schedule Export";

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(reportTitle)}</title>
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
      <style>
        @page Section1 {
          size: 11in 8.5in;
          margin: 0.5in 0.5in 0.5in 0.5in;
          mso-page-orientation: landscape;
        }
        div.Section1 {
          page: Section1;
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #333333; line-height: 1.4; }
        h1 { font-size: 20pt; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; margin-bottom: 20px; }
        h2 { font-size: 14pt; color: #2563eb; margin-top: 30px; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; }
        h3 { font-size: 11pt; color: #4b5563; margin-top: 20px; }
        h4 { font-size: 10pt; color: #64748b; margin-top: 14px; margin-bottom: 6px; font-weight: bold; }
        .meta { font-size: 9pt; color: #64748b; margin-bottom: 30px; }
        ${WORD_EXPORT_TABLE_CSS}
      </style>
    </head>
    <body>
      <div class="Section1">
        <h1>${escapeHtml(reportTitle)}</h1>
        <p class="meta">Exported on: ${escapeHtml(new Date().toLocaleDateString())}</p>
        
        <h2>Projects Overview</h2>
  `;

  // Key-value layout avoids ultra-wide tables that Google Docs squeezes into
  // one-character-per-line headers.
  projects.forEach((p) => {
    const allData = mapProjectToExportRow(p, departments, customers, managers);
    const title = String(allData.Name ?? p.name ?? "Project");
    html += `
      <h3>${escapeHtml(title)}</h3>
      <table class="kv">
        <tbody>
          ${headers
            .map(
              (field) => `
            <tr>
              <th>${escapeHtml(field)}</th>
              <td>${escapeHtml(allData[field] !== undefined ? allData[field] : "")}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `;
  });

  for (const project of projects) {
    const projectId = String(project.id ?? "");
    const projectName = String(project.name ?? "Project");
    const phases = phasesByProjectId[projectId] ?? [];
    if (phases.length > 0) {
      html += `
        <h3>Phases — ${escapeHtml(projectName)}</h3>
        <table class="data">
          <thead>
            <tr>
              <th>Name</th><th>Description</th><th>Order</th><th>Status</th><th>Start Date</th><th>End Date</th>
            </tr>
          </thead>
          <tbody>
            ${phases
              .slice()
              .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
              .map(
                (phase) => `
              <tr>
                <td>${escapeHtml(phase.name)}</td>
                <td>${escapeHtml(phase.description ?? "")}</td>
                <td>${escapeHtml(phase.orderIndex ?? "")}</td>
                <td>${escapeHtml(phase.status ?? "")}</td>
                <td>${escapeHtml(toExportDay(phase.startDate))}</td>
                <td>${escapeHtml(toExportDay(phase.endDate))}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      `;
    }

    const milestones = milestonesByProjectId[projectId] ?? [];
    if (milestones.length > 0) {
      const phaseNameById = new Map(
        (phasesByProjectId[projectId] ?? []).map((ph) => [ph.id, ph.name]),
      );
      html += `
        <h3>Milestones — ${escapeHtml(projectName)}</h3>
        <table class="data">
          <thead>
            <tr>
              <th>Title</th><th>Target Date</th><th>Weight (%)</th><th>Status</th><th>Phase</th>
            </tr>
          </thead>
          <tbody>
            ${milestones
              .map((ms) => {
                const phaseLabel =
                  ms.phase?.name ||
                  (ms.phaseId ? phaseNameById.get(ms.phaseId) ?? "" : "") ||
                  "";
                return `
              <tr>
                <td>${escapeHtml(ms.title)}</td>
                <td>${escapeHtml(toExportDay(ms.targetDate))}</td>
                <td>${escapeHtml(ms.weight ?? "")}</td>
                <td>${escapeHtml(ms.status ?? "")}</td>
                <td>${escapeHtml(phaseLabel)}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      `;
    }
  }

  if (tasks && tasks.length > 0) {
    const tasksByProject: Record<string, any[]> = {};
    tasks.forEach((t) => {
      const projName = t.projectName || "Tasks";
      if (!tasksByProject[projName]) {
        tasksByProject[projName] = [];
      }
      tasksByProject[projName].push(t);
    });

    const taskHeaders = selectedTaskFields?.length
      ? selectedTaskFields
      : DEFAULT_TASK_EXPORT_FIELDS;

    html += `<h2>Task Schedule</h2>`;

    Object.entries(tasksByProject).forEach(([projName, projTasks]) => {
      const mapped = mapTasksToExportRows(projTasks, {
        dependencies,
        projectName: projName,
        projectOrganization: (t) =>
          t.project?.customer?.displayName ||
          t.customerName ||
          t.projectOrganization ||
          null,
      });

      html += renderWordTaskScheduleSection(
        projName,
        mapped,
        taskHeaders,
        escapeHtml,
      );
    });
  }

  html += `
      </div>
    </body>
    </html>
  `;

  return new Blob([html], { type: "application/msword;charset=utf-8" });
}

export function exportTasksToWord(
  tasks: Task[],
  phases: ProjectPhase[],
  assignees: ProjectTaskAssignee[],
  selectedFields?: string[],
  dependencies: TaskExportDependency[] = [],
  projectOrganization?: string | null,
): Blob {
  const headers = selectedFields?.length ? selectedFields : DEFAULT_TASK_EXPORT_FIELDS;
  const projectName = tasks[0]?.project?.name || "Tasks";
  const mapped = mapTasksToExportRows(tasks, {
    dependencies,
    phases,
    assignees,
    projectOrganization,
  });

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>Project Tasks Report</title>
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
      <style>
        @page Section1 {
          size: 11in 8.5in;
          margin: 0.5in 0.5in 0.5in 0.5in;
          mso-page-orientation: landscape;
        }
        div.Section1 {
          page: Section1;
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #333333; line-height: 1.4; }
        h1 { font-size: 20pt; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; margin-bottom: 20px; }
        h3 { font-size: 11pt; color: #4b5563; margin-top: 20px; }
        h4 { font-size: 10pt; color: #64748b; margin-top: 14px; margin-bottom: 6px; font-weight: bold; }
        .meta { font-size: 9pt; color: #64748b; margin-bottom: 30px; }
        ${WORD_EXPORT_TABLE_CSS}
      </style>
    </head>
    <body>
      <div class="Section1">
        <h1>Project Tasks Report</h1>
        <p class="meta">Exported on: ${new Date().toLocaleDateString()}</p>
        ${renderWordTaskScheduleSection(projectName, mapped, headers, escapeHtml)}
      </div>
    </body>
    </html>
  `;

  return new Blob([html], { type: "application/msword;charset=utf-8" });
}

type MspdiExportDependency = {
  predecessorId: string;
  successorId: string;
  depType?: string;
  lagDays?: number;
};

function decodeXmlEntities(str: string): string {
  return String(str || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function escMppXml(str: string) {
  // Decode first to avoid double-encoding (&apos; → &amp;apos;).
  // Apostrophes/quotes are fine unescaped in XML text nodes.
  return decodeXmlEntities(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toMppDateTime(value?: string | null, endOfDay = false): string {
  if (!value) return "";
  const day = String(value).split("T")[0];
  return `${day}T${endOfDay ? "17:00:00" : "08:00:00"}`;
}

function mapMppPriority(p: string) {
  const lower = String(p || "").toLowerCase();
  if (lower === "critical") return 1000;
  if (lower === "high") return 700;
  if (lower === "low") return 300;
  return 500;
}

function mapMppPercent(task: any): number {
  if (typeof task.progressApproved === "number") {
    return Math.max(0, Math.min(100, Math.round(task.progressApproved)));
  }
  const lower = String(task.status || "").toLowerCase();
  if (lower === "done" || lower === "approved") return 100;
  if (lower === "in_progress") return 50;
  return 0;
}

/** MSPDI PredecessorLink Type: 0=FF, 1=FS, 2=SF, 3=SS */
function mapMppDepType(depType?: string): number {
  switch (String(depType || "FS").toUpperCase()) {
    case "FF":
      return 0;
    case "SF":
      return 2;
    case "SS":
      return 3;
    case "FS":
    default:
      return 1;
  }
}

function isMspdiMilestone(task: any): boolean {
  return Boolean(task?._milestoneExport || task?.milestone);
}

function toMilestoneExportTask(ms: {
  id: string;
  title: string;
  targetDate: string;
  status?: string;
}): any {
  const day = String(ms.targetDate).split("T")[0];
  const completed = String(ms.status || "").toLowerCase() === "completed";
  return {
    id: `milestone:${ms.id}`,
    title: ms.title,
    startDate: day,
    endDate: day,
    _milestoneExport: true,
    progressApproved: completed ? 100 : 0,
    priority: "Medium",
  };
}

function compareMilestoneOrder(a: any, b: any): number {
  const dateCmp = String(a.targetDate || "").localeCompare(String(b.targetDate || ""));
  if (dateCmp !== 0) return dateCmp;
  return String(a.title || "").localeCompare(String(b.title || ""));
}

function mspdiDurationXml(task: any): string {
  if (isMspdiMilestone(task)) {
    return `<Duration>PT0H0M0S</Duration>`;
  }
  if (task.effortHours != null && Number(task.effortHours) > 0) {
    const hours = Math.round(Number(task.effortHours));
    return `<Duration>PT${hours}H0M0S</Duration>`;
  }
  if (task.startDate && task.endDate) {
    const start = new Date(`${String(task.startDate).split("T")[0]}T00:00:00Z`);
    const end = new Date(`${String(task.endDate).split("T")[0]}T00:00:00Z`);
    const days = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
    );
    return `<Duration>PT${days * 8}H0M0S</Duration>`;
  }
  return "";
}

function comparePlanOrder(a: any, b: any): number {
  return comparePlanOrderAsc(a, b);
}

function avgTopLevelProgress(tasks: any[]): number {
  if (!tasks.length) return 0;
  const sum = tasks.reduce(
    (acc, t) => acc + Math.max(0, Math.min(100, t.progressApproved ?? 0)),
    0,
  );
  return Math.round(sum / tasks.length);
}

/** Emit a task and all descendants (nested summaries) in plan order. */
function pushTaskTreeToPlan(
  emitPlan: Array<{
    kind: "task";
    task: any;
    wbs: string;
    outlineLevel: number;
  } | Record<string, unknown>>,
  task: any,
  wbs: string,
  outlineLevel: number,
  childrenByParent: Record<string, any[]>,
) {
  emitPlan.push({ kind: "task", task, wbs, outlineLevel });
  const children = childrenByParent[task.id] || [];
  children.forEach((child, index) => {
    pushTaskTreeToPlan(
      emitPlan,
      child,
      `${wbs}.${index + 1}`,
      outlineLevel + 1,
      childrenByParent,
    );
  });
}

function buildPredecessorLinksXml(
  taskId: string,
  deps: MspdiExportDependency[],
  idToUid: Map<string, number>,
): string {
  const links = deps.filter((d) => d.successorId === taskId);
  if (links.length === 0) return "";

  return links
    .map((dep) => {
      const predUid = idToUid.get(dep.predecessorId);
      if (predUid == null) return "";
      const lagDays = Number(dep.lagDays) || 0;
      // LinkLag is in tenths of a minute; 1 day = 8h * 60 * 10 = 4800
      const linkLag = lagDays * 4800;
      return `      <PredecessorLink>
        <PredecessorUID>${predUid}</PredecessorUID>
        <Type>${mapMppDepType(dep.depType)}</Type>
        <CrossProject>0</CrossProject>
        <LinkLag>${linkLag}</LinkLag>
        <LagFormat>7</LagFormat>
      </PredecessorLink>
`;
    })
    .join("");
}

function mspdiBaselineDurationHours(task: any): number | null {
  if (
    task.baselineDurationDays != null &&
    Number.isFinite(Number(task.baselineDurationDays)) &&
    Number(task.baselineDurationDays) > 0
  ) {
    return Math.round(Number(task.baselineDurationDays) * 8);
  }
  const days = inclusiveDurationDays(
    task.baselineStart || task.baselineStartDate,
    task.baselineEnd || task.baselineFinish || task.baselineFinishDate,
  );
  if (days === "") return null;
  return Number(days) * 8;
}

function mspdiVarianceXml(task: any): string {
  const startVar = signedDayDelta(
    task.startDate,
    task.baselineStart || task.baselineStartDate,
  );
  const finishVar = signedDayDelta(
    task.endDate,
    task.baselineEnd || task.baselineFinish || task.baselineFinishDate,
  );
  let xml = "";
  if (startVar !== "") {
    // StartVariance in tenths of a minute
    xml += `      <StartVariance>${Number(startVar) * 4800}</StartVariance>\n`;
  }
  if (finishVar !== "") {
    xml += `      <FinishVariance>${Number(finishVar) * 4800}</FinishVariance>\n`;
  }
  return xml;
}

function renderMppHolidayExceptions(
  holidays: { date: string; name?: string }[],
): string {
  if (!holidays.length) return "";
  return holidays
    .map((h, index) => {
      const day = String(h.date).slice(0, 10);
      return `      <Exception>
        <EnteredByOccurrences>0</EnteredByOccurrences>
        <TimePeriod>
          <FromDate>${day}T00:00:00</FromDate>
          <ToDate>${day}T23:59:00</ToDate>
        </TimePeriod>
        <Occurrences>1</Occurrences>
        <Name>${escMppXml(h.name || `Holiday ${index + 1}`)}</Name>
        <Type>1</Type>
        <DayWorking>0</DayWorking>
      </Exception>`;
    })
    .join("\n");
}

function renderMppCalendarsXml(
  holidays: { date: string; name?: string }[] = [],
): string {
  const exceptions = renderMppHolidayExceptions(holidays);
  return `  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Standard</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <BaseCalendarUID>-1</BaseCalendarUID>
${exceptions ? `      <Exceptions>\n${exceptions}\n      </Exceptions>` : ""}
    </Calendar>
  </Calendars>`;
}

function renderMppTaskXml(opts: {
  uid: number;
  wbs: string;
  outlineLevel: number;
  name: string;
  summary: boolean;
  task?: any;
  predecessorXml?: string;
}): string {
  const { uid, wbs, outlineLevel, name, summary, task, predecessorXml = "" } = opts;
  const milestone = task ? isMspdiMilestone(task) : false;
  const start = task ? toMppDateTime(task.startDate) : "";
  const finish = task
    ? toMppDateTime(milestone ? task.startDate || task.endDate : task.endDate, true)
    : "";
  const baselineStart = task
    ? toMppDateTime(
        task.baselineStart || task.baselineStartDate || task.startDate,
      )
    : "";
  const baselineFinish = task
    ? toMppDateTime(
        task.baselineEnd ||
          task.baselineFinish ||
          task.baselineFinishDate ||
          task.endDate,
        true,
      )
    : "";
  const percent = task ? mapMppPercent(task) : 0;
  const durationXml = task ? mspdiDurationXml(task) : "";
  const workXml = durationXml
    ? durationXml.replace("<Duration>", "<Work>").replace("</Duration>", "</Work>")
    : "";
  const baselineHours = task ? mspdiBaselineDurationHours(task) : null;
  const actualStart =
    task && percent > 0
      ? toMppDateTime(task.actualStart || task.startDate)
      : "";
  const actualFinish =
    task && percent >= 100
      ? toMppDateTime(task.actualEnd || task.endDate, true)
      : "";

  // Flat Baseline* fields + nested <Baseline> so Project populates Baseline / Tracking tables.
  let baselineBlock = "";
  if (baselineStart || baselineFinish || baselineHours != null) {
    baselineBlock = `      <Baseline>
${baselineStart ? `        <Start>${baselineStart}</Start>\n` : ""}${baselineFinish ? `        <Finish>${baselineFinish}</Finish>\n` : ""}${baselineHours != null ? `        <Duration>PT${baselineHours}H0M0S</Duration>\n` : ""}      </Baseline>
`;
  }

  return `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <IsNull>0</IsNull>
      <WBS>${wbs}</WBS>
      <OutlineNumber>${wbs}</OutlineNumber>
      <OutlineLevel>${outlineLevel}</OutlineLevel>
      <Type>${summary ? 1 : 0}</Type>
      <Name>${escMppXml(name)}</Name>
      <Summary>${summary ? 1 : 0}</Summary>
      <Manual>0</Manual>
      <Milestone>${milestone ? 1 : 0}</Milestone>
      ${start ? `<Start>${start}</Start>` : ""}
      ${finish ? `<Finish>${finish}</Finish>` : ""}
      ${durationXml}
      ${workXml}
      ${baselineStart ? `<BaselineStart>${baselineStart}</BaselineStart>` : ""}
      ${baselineFinish ? `<BaselineFinish>${baselineFinish}</BaselineFinish>` : ""}
      ${baselineHours != null ? `<BaselineDuration>PT${baselineHours}H0M0S</BaselineDuration>` : ""}
${baselineBlock}${task ? mspdiVarianceXml(task) : ""}      <PercentComplete>${percent}</PercentComplete>
      <PercentWorkComplete>${percent}</PercentWorkComplete>
      ${actualStart ? `<ActualStart>${actualStart}</ActualStart>` : ""}
      ${actualFinish ? `<ActualFinish>${actualFinish}</ActualFinish>` : ""}
      <Priority>${task ? mapMppPriority(task.priority) : 500}</Priority>
      <Notes>${escMppXml(task?.description || "")}</Notes>
${predecessorXml}    </Task>
`;
}

/** Close Tasks and append Resources + Assignments so Project shows Resource Names. */
function appendMspdiResourcesAndAssignments(
  tasks: any[],
  idToUid: Map<string, number>,
  projectOrganization?: string | null,
): string {
  const resourcesByKey = new Map<string, { uid: number; name: string }>();
  const assignmentRows: { taskUid: number; resourceUid: number; task: any }[] =
    [];
  let nextResUid = 1;

  const ensureResource = (name: string): number => {
    const key = name.trim().toLowerCase();
    const existing = resourcesByKey.get(key);
    if (existing) return existing.uid;
    const uid = nextResUid++;
    resourcesByKey.set(key, { uid, name: name.trim() });
    return uid;
  };

  const isPlaceholderResource = (name: string) => {
    const n = name.trim().toLowerCase();
    return (
      !n ||
      n === "unassigned" ||
      n === "none" ||
      n === "n/a" ||
      n === "na" ||
      n === "demo"
    );
  };

  const personOrg = (person: any): string => {
    if (person?.organization?.trim()) return person.organization.trim();
    const dept =
      person?.employees?.[0]?.department?.name ||
      person?.employees?.department?.name ||
      person?.department?.name ||
      "";
    if (person?.isExternal && projectOrganization?.trim()) {
      return projectOrganization.trim();
    }
    return dept.trim() || projectOrganization?.trim() || "";
  };

  for (const task of tasks) {
    const taskUid = idToUid.get(task.id);
    if (taskUid == null) continue;
    const ownerName = task.owner?.displayName?.trim() || "";
    const backupName = task.backupOwner?.displayName?.trim() || "";
    const merged = mergeExportResourceNames(
      ownerName && !isPlaceholderResource(ownerName)
        ? formatResourceName(ownerName, personOrg(task.owner)) || ownerName
        : "",
      backupName && !isPlaceholderResource(backupName)
        ? formatResourceName(backupName, personOrg(task.backupOwner)) ||
          backupName
        : "",
      task.resourceNames,
    );
    for (const name of splitResourceNames(merged)) {
      if (isPlaceholderResource(name)) continue;
      assignmentRows.push({
        taskUid,
        resourceUid: ensureResource(name),
        task,
      });
    }
  }

  let xml = `  </Tasks>
  <Resources>
    <Resource>
      <UID>0</UID>
      <ID>0</ID>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <MaxUnits>1.00</MaxUnits>
      <CalendarUID>1</CalendarUID>
    </Resource>
`;
  for (const resource of [...resourcesByKey.values()].sort(
    (a, b) => a.uid - b.uid,
  )) {
    xml += `    <Resource>
      <UID>${resource.uid}</UID>
      <ID>${resource.uid}</ID>
      <Name>${escMppXml(resource.name)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <MaxUnits>1.00</MaxUnits>
      <CalendarUID>1</CalendarUID>
    </Resource>
`;
  }
  xml += `  </Resources>
  <Assignments>
`;
  let assignmentUid = 1_048_577;
  for (const row of assignmentRows) {
    const start = toMppDateTime(row.task.startDate);
    const finish = toMppDateTime(row.task.endDate, true);
    xml += `    <Assignment>
      <UID>${assignmentUid++}</UID>
      <ResourceUID>${row.resourceUid}</ResourceUID>
      <TaskUID>${row.taskUid}</TaskUID>
      <Units>1</Units>
      <Work>PT8H0M0S</Work>
      <RegularWork>PT8H0M0S</RegularWork>
      <RemainingWork>PT8H0M0S</RemainingWork>
      ${start ? `<Start>${start}</Start>` : ""}
      ${finish ? `<Finish>${finish}</Finish>` : ""}
    </Assignment>
`;
  }
  xml += `  </Assignments>
</Project>`;
  return xml;
}

/**
 * Export project schedule as MSPDI XML (opens in MS Project).
 * Phases → outline L1 summaries; tasks keep plan order, % complete, baselines, predecessors.
 */
export function exportTasksToMspdi(
  tasks: any[],
  phases: any[],
  _assignees: any[],
  projectName = "Portfolio Export",
  dependencies: MspdiExportDependency[] = [],
  holidays: { date: string; name?: string }[] = [],
  milestones: any[] = [],
): Blob {
  const idToUid = new Map<string, number>();

  const phaseList = [...(phases || [])].sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0),
  );

  const topLevelTasks = tasks.filter((t) => !t.parentTaskId);
  const subTasksByParent: Record<string, any[]> = {};
  for (const t of tasks) {
    if (!t.parentTaskId) continue;
    if (!subTasksByParent[t.parentTaskId]) subTasksByParent[t.parentTaskId] = [];
    subTasksByParent[t.parentTaskId].push(t);
  }
  for (const list of Object.values(subTasksByParent)) {
    list.sort(comparePlanOrder);
  }

  const tasksByPhaseId = new Map<string, any[]>();
  const unphased: any[] = [];

  topLevelTasks.forEach((t) => {
    const phaseId = t.phaseId || t.phase?.id;
    if (phaseId) {
      if (!tasksByPhaseId.has(phaseId)) tasksByPhaseId.set(phaseId, []);
      tasksByPhaseId.get(phaseId)!.push(t);
    } else {
      unphased.push(t);
    }
  });

  tasksByPhaseId.forEach((list) => list.sort(comparePlanOrder));
  unphased.sort(comparePlanOrder);

  const milestonesByPhaseId = new Map<string, any[]>();
  const unphasedMilestones: any[] = [];
  for (const ms of milestones || []) {
    const phaseId = ms.phaseId || ms.phase?.id;
    if (phaseId) {
      if (!milestonesByPhaseId.has(phaseId)) milestonesByPhaseId.set(phaseId, []);
      milestonesByPhaseId.get(phaseId)!.push(ms);
    } else {
      unphasedMilestones.push(ms);
    }
  }
  milestonesByPhaseId.forEach((list) => list.sort(compareMilestoneOrder));
  unphasedMilestones.sort(compareMilestoneOrder);

  const orderedPhases: { id: string; name: string; phase?: any }[] = phaseList.map(
    (p) => ({ id: p.id, name: p.name, phase: p }),
  );
  for (const phaseId of tasksByPhaseId.keys()) {
    if (!orderedPhases.some((p) => p.id === phaseId)) {
      const sample = tasksByPhaseId.get(phaseId)?.[0];
      orderedPhases.push({
        id: phaseId,
        name: sample?.phase?.name || sample?.phaseName || "Phase",
      });
    }
  }
  if (unphased.length > 0 || unphasedMilestones.length > 0) {
    orderedPhases.push({ id: "__unphased__", name: "Imported Schedule" });
  }

  const projectStart =
    [
      ...tasks.map((t) => t.startDate),
      ...(milestones || []).map((m) => m.targetDate),
    ]
      .filter(Boolean)
      .sort()[0] || phaseList[0]?.startDate;
  const projectFinish =
    [
      ...tasks.map((t) => t.endDate),
      ...(milestones || []).map((m) => m.targetDate),
    ]
      .filter(Boolean)
      .sort()
      .reverse()[0] || phaseList[phaseList.length - 1]?.endDate;

  type EmitItem =
    | { kind: "phase"; phaseEntry: (typeof orderedPhases)[0]; phaseIndex: number }
    | {
        kind: "task";
        task: any;
        wbs: string;
        outlineLevel: number;
      };

  const emitPlan: EmitItem[] = [];
  let phaseIndex = 0;

  for (const phaseEntry of orderedPhases) {
    const phaseTasks =
      phaseEntry.id === "__unphased__"
        ? unphased
        : tasksByPhaseId.get(phaseEntry.id) || [];
    const phaseMilestones =
      phaseEntry.id === "__unphased__"
        ? unphasedMilestones
        : milestonesByPhaseId.get(phaseEntry.id) || [];

    // Keep empty phases from the project phase list; skip empty synthetic unphased.
    if (
      phaseTasks.length === 0 &&
      phaseMilestones.length === 0 &&
      phaseEntry.id === "__unphased__"
    ) {
      continue;
    }
    if (
      phaseTasks.length === 0 &&
      phaseMilestones.length === 0 &&
      !phaseList.some((p) => p.id === phaseEntry.id)
    ) {
      continue;
    }

    phaseIndex += 1;
    emitPlan.push({ kind: "phase", phaseEntry, phaseIndex });

    let taskIndex = 0;
    for (const t of phaseTasks) {
      taskIndex += 1;
      pushTaskTreeToPlan(
        emitPlan,
        t,
        `${phaseIndex}.${taskIndex}`,
        2,
        subTasksByParent,
      );
    }
    for (const ms of phaseMilestones) {
      taskIndex += 1;
      emitPlan.push({
        kind: "task",
        task: toMilestoneExportTask(ms),
        wbs: `${phaseIndex}.${taskIndex}`,
        outlineLevel: 2,
      });
    }
  }

  // Assign UIDs in outline order first so PredecessorLink can resolve any direction.
  let uid = 1;
  for (const item of emitPlan) {
    if (item.kind === "task") {
      idToUid.set(item.task.id, uid);
    }
    uid += 1;
  }

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <SaveVersion>12</SaveVersion>
  <Name>${escMppXml(projectName)}</Name>
  <Title>${escMppXml(projectName)}</Title>
  <ScheduleFromStart>1</ScheduleFromStart>
  <NewTasksAreManual>0</NewTasksAreManual>
  ${projectStart ? `<StartDate>${toMppDateTime(projectStart)}</StartDate>` : ""}
  ${projectFinish ? `<FinishDate>${toMppDateTime(projectFinish, true)}</FinishDate>` : ""}
  <CalendarUID>1</CalendarUID>
  <DefaultStartTime>08:00:00</DefaultStartTime>
  <DefaultFinishTime>17:00:00</DefaultFinishTime>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <DurationFormat>7</DurationFormat>
  <WorkFormat>2</WorkFormat>
  <TaskUpdatesResource>1</TaskUpdatesResource>
${renderMppCalendarsXml(holidays)}
  <Tasks>
`;

  xml += renderMppTaskXml({
    uid: 0,
    wbs: "0",
    outlineLevel: 0,
    name: projectName,
    summary: true,
  });

  uid = 1;
  for (const item of emitPlan) {
    if (item.kind === "phase") {
      const phaseUid = uid++;
      const phaseObj = item.phaseEntry.phase;
      const phaseTasks =
        item.phaseEntry.id === "__unphased__"
          ? unphased
          : tasksByPhaseId.get(item.phaseEntry.id) || [];
      xml += renderMppTaskXml({
        uid: phaseUid,
        wbs: String(item.phaseIndex),
        outlineLevel: 1,
        name: item.phaseEntry.name,
        summary: true,
        task: phaseObj
          ? {
              startDate: phaseObj.startDate,
              endDate: phaseObj.endDate,
              baselineStart: phaseObj.startDate,
              baselineEnd: phaseObj.endDate,
              progressApproved: avgTopLevelProgress(phaseTasks),
              priority: "Medium",
              description: phaseObj.description,
            }
          : {
              progressApproved: avgTopLevelProgress(phaseTasks),
            },
      });
      continue;
    }

    const currentUid = idToUid.get(item.task.id)!;
    uid = Math.max(uid, currentUid + 1);
    const subTasks = subTasksByParent[item.task.id] || [];

    xml += renderMppTaskXml({
      uid: currentUid,
      wbs: item.wbs,
      outlineLevel: item.outlineLevel,
      name: item.task.title || "",
      summary: subTasks.length > 0,
      task: item.task,
      predecessorXml: buildPredecessorLinksXml(
        item.task.id,
        dependencies,
        idToUid,
      ),
    });
  }

  xml += appendMspdiResourcesAndAssignments(
    emitPlan
      .filter(
        (item): item is { kind: "task"; task: any; wbs: string; outlineLevel: number } =>
          item.kind === "task",
      )
      .map((item) => item.task),
    idToUid,
  );

  return new Blob([xml], { type: "application/xml;charset=utf-8" });
}

export function exportProjectsToMspdi(
  projects: any[],
  departments: Department[],
  customers: Customer[],
  managers: ProjectManager[],
  tasks?: any[],
  dependencies: MspdiExportDependency[] = [],
  holidays: { date: string; name?: string }[] = [],
  phasesByProjectId: Record<string, any[]> = {},
  milestonesByProjectId: Record<string, any[]> = {},
): Blob {
  // Multi-project portfolio: one MSPDI file with each project as an L1 summary.
  // Prefer per-project export from the workspace for full fidelity.
  let uid = 1;
  const idToUid = new Map<string, number>();

  const projectStart = projects
    .map((p) => p.startDate)
    .filter(Boolean)
    .sort()[0];
  const projectFinish = projects
    .map((p) => p.endDate)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <SaveVersion>12</SaveVersion>
  <Name>Portfolio Export</Name>
  <Title>Portfolio Export</Title>
  <ScheduleFromStart>1</ScheduleFromStart>
  <NewTasksAreManual>0</NewTasksAreManual>
  ${projectStart ? `<StartDate>${toMppDateTime(projectStart)}</StartDate>` : ""}
  ${projectFinish ? `<FinishDate>${toMppDateTime(projectFinish, true)}</FinishDate>` : ""}
  <CalendarUID>1</CalendarUID>
  <DefaultStartTime>08:00:00</DefaultStartTime>
  <DefaultFinishTime>17:00:00</DefaultFinishTime>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <DurationFormat>7</DurationFormat>
  <WorkFormat>2</WorkFormat>
  <TaskUpdatesResource>1</TaskUpdatesResource>
${renderMppCalendarsXml(holidays)}
  <Tasks>
`;

  xml += renderMppTaskXml({
    uid: 0,
    wbs: "0",
    outlineLevel: 0,
    name: "Portfolio Export",
    summary: true,
  });

  // Pre-assign task UIDs across the whole portfolio for dependency links.
  const emitPlan: Array<
    | { kind: "project"; project: any; projIndex: number }
    | {
        kind: "phase";
        name: string;
        wbs: string;
        phase?: any;
        phaseTasks: any[];
      }
    | { kind: "task"; task: any; wbs: string; outlineLevel: number }
  > = [];

  // Build children map once; reused when emitting nested summaries.
  const childrenByParentAll: Record<string, any[]> = {};
  for (const t of tasks || []) {
    if (!t.parentTaskId) continue;
    if (!childrenByParentAll[t.parentTaskId]) childrenByParentAll[t.parentTaskId] = [];
    childrenByParentAll[t.parentTaskId].push(t);
  }
  for (const list of Object.values(childrenByParentAll)) {
    list.sort(comparePlanOrder);
  }

  let projIndex = 0;
  for (const proj of projects) {
    projIndex += 1;
    emitPlan.push({ kind: "project", project: proj, projIndex });

    const projTasks = (tasks || []).filter(
      (t) => t.projectId === proj.id || t.projectName === proj.name,
    );
    const topLevel = projTasks
      .filter((t) => !t.parentTaskId)
      .sort(comparePlanOrder);

    const projectPhases = [...(phasesByProjectId[proj.id] ?? [])].sort(
      (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0),
    );
    const projectMilestones = [...(milestonesByProjectId[proj.id] ?? [])].sort(
      compareMilestoneOrder,
    );

    const tasksByPhaseId = new Map<string, any[]>();
    const unphasedTasks: any[] = [];
    for (const t of topLevel) {
      const phaseId = t.phaseId || t.phase?.id;
      if (phaseId) {
        if (!tasksByPhaseId.has(phaseId)) tasksByPhaseId.set(phaseId, []);
        tasksByPhaseId.get(phaseId)!.push(t);
      } else {
        unphasedTasks.push(t);
      }
    }

    const milestonesByPhaseId = new Map<string, any[]>();
    const unphasedMilestones: any[] = [];
    for (const ms of projectMilestones) {
      const phaseId = ms.phaseId || ms.phase?.id;
      if (phaseId) {
        if (!milestonesByPhaseId.has(phaseId)) milestonesByPhaseId.set(phaseId, []);
        milestonesByPhaseId.get(phaseId)!.push(ms);
      } else {
        unphasedMilestones.push(ms);
      }
    }

    type PhaseGroup = {
      id: string;
      name: string;
      phase?: any;
      phaseTasks: any[];
      phaseMilestones: any[];
    };

    const phaseGroups: PhaseGroup[] = [];

    if (projectPhases.length > 0) {
      for (const phase of projectPhases) {
        phaseGroups.push({
          id: phase.id,
          name: phase.name,
          phase,
          phaseTasks: tasksByPhaseId.get(phase.id) || [],
          phaseMilestones: milestonesByPhaseId.get(phase.id) || [],
        });
      }
      for (const phaseId of tasksByPhaseId.keys()) {
        if (phaseGroups.some((g) => g.id === phaseId)) continue;
        const sample = tasksByPhaseId.get(phaseId)?.[0];
        phaseGroups.push({
          id: phaseId,
          name: sample?.phase?.name || sample?.phaseName || "Phase",
          phase: sample?.phase,
          phaseTasks: tasksByPhaseId.get(phaseId) || [],
          phaseMilestones: milestonesByPhaseId.get(phaseId) || [],
        });
      }
      for (const phaseId of milestonesByPhaseId.keys()) {
        if (phaseGroups.some((g) => g.id === phaseId)) continue;
        const sample = milestonesByPhaseId.get(phaseId)?.[0];
        phaseGroups.push({
          id: phaseId,
          name: sample?.phase?.name || "Phase",
          phase: sample?.phase,
          phaseTasks: [],
          phaseMilestones: milestonesByPhaseId.get(phaseId) || [],
        });
      }
    } else {
      const byPhaseName = new Map<string, any[]>();
      for (const t of topLevel) {
        const key = t.phase?.name || t.phaseName || "No Phase";
        if (!byPhaseName.has(key)) byPhaseName.set(key, []);
        byPhaseName.get(key)!.push(t);
      }
      const inferredGroups = [...byPhaseName.entries()].sort((a, b) => {
        const aIdx = a[1][0]?.phase?.orderIndex;
        const bIdx = b[1][0]?.phase?.orderIndex;
        const aNum = typeof aIdx === "number" ? aIdx : Number.MAX_SAFE_INTEGER;
        const bNum = typeof bIdx === "number" ? bIdx : Number.MAX_SAFE_INTEGER;
        if (aNum !== bNum) return aNum - bNum;
        return a[0].localeCompare(b[0]);
      });
      for (const [phaseName, phaseTasks] of inferredGroups) {
        phaseGroups.push({
          id: phaseTasks[0]?.phaseId || phaseTasks[0]?.phase?.id || phaseName,
          name: phaseName,
          phase: phaseTasks[0]?.phase,
          phaseTasks,
          phaseMilestones: [],
        });
      }
      for (const ms of projectMilestones) {
        const phaseId = ms.phaseId || ms.phase?.id;
        if (!phaseId) {
          continue;
        }
        const group = phaseGroups.find((g) => g.id === phaseId);
        if (group) {
          group.phaseMilestones.push(ms);
        } else {
          phaseGroups.push({
            id: phaseId,
            name: ms.phase?.name || "Phase",
            phase: ms.phase,
            phaseTasks: [],
            phaseMilestones: [ms],
          });
        }
      }
    }

    if (unphasedTasks.length > 0 || unphasedMilestones.length > 0) {
      phaseGroups.push({
        id: "__unphased__",
        name: "Imported Schedule",
        phaseTasks: unphasedTasks,
        phaseMilestones: unphasedMilestones,
      });
    }

    let phaseIndex = 0;
    for (const group of phaseGroups) {
      // Keep real empty phases (completeness); skip empty synthetic unphased.
      if (
        group.phaseTasks.length === 0 &&
        group.phaseMilestones.length === 0 &&
        group.id === "__unphased__"
      ) {
        continue;
      }

      phaseIndex += 1;
      emitPlan.push({
        kind: "phase",
        name: group.name,
        wbs: `${projIndex}.${phaseIndex}`,
        phase: group.phase,
        phaseTasks: group.phaseTasks,
      });

      let taskIndex = 0;
      const childrenByParent: Record<string, any[]> = {};
      for (const t of projTasks) {
        if (!t.parentTaskId) continue;
        if (!childrenByParent[t.parentTaskId]) childrenByParent[t.parentTaskId] = [];
        childrenByParent[t.parentTaskId].push(t);
      }
      for (const list of Object.values(childrenByParent)) {
        list.sort(comparePlanOrder);
      }

      for (const t of group.phaseTasks) {
        taskIndex += 1;
        pushTaskTreeToPlan(
          emitPlan,
          t,
          `${projIndex}.${phaseIndex}.${taskIndex}`,
          3,
          childrenByParent,
        );
      }
      for (const ms of group.phaseMilestones) {
        taskIndex += 1;
        emitPlan.push({
          kind: "task",
          task: toMilestoneExportTask(ms),
          wbs: `${projIndex}.${phaseIndex}.${taskIndex}`,
          outlineLevel: 3,
        });
      }
    }
  }

  for (const item of emitPlan) {
    if (item.kind === "task") idToUid.set(item.task.id, uid);
    uid += 1;
  }

  uid = 1;
  for (const item of emitPlan) {
    if (item.kind === "project") {
      xml += renderMppTaskXml({
        uid: uid++,
        wbs: String(item.projIndex),
        outlineLevel: 1,
        name: item.project.name || "",
        summary: true,
        task: {
          startDate: item.project.startDate,
          endDate: item.project.endDate,
          progressApproved: 0,
          description: item.project.objective,
        },
      });
      continue;
    }
    if (item.kind === "phase") {
      xml += renderMppTaskXml({
        uid: uid++,
        wbs: item.wbs,
        outlineLevel: 2,
        name: item.name,
        summary: true,
        task: item.phase
          ? {
              startDate: item.phase.startDate,
              endDate: item.phase.endDate,
              baselineStart: item.phase.startDate,
              baselineEnd: item.phase.endDate,
              progressApproved: avgTopLevelProgress(item.phaseTasks),
            }
          : {
              progressApproved: avgTopLevelProgress(item.phaseTasks),
            },
      });
      continue;
    }

    const currentUid = idToUid.get(item.task.id)!;
    uid = Math.max(uid, currentUid + 1);
    const hasChildren = (childrenByParentAll[item.task.id] || []).length > 0;
    xml += renderMppTaskXml({
      uid: currentUid,
      wbs: item.wbs,
      outlineLevel: item.outlineLevel,
      name: item.task.title || "",
      summary: hasChildren,
      task: item.task,
      predecessorXml: buildPredecessorLinksXml(
        item.task.id,
        dependencies,
        idToUid,
      ),
    });
  }

  xml += appendMspdiResourcesAndAssignments(
    emitPlan
      .filter(
        (item): item is { kind: "task"; task: any; wbs: string; outlineLevel: number } =>
          item.kind === "task",
      )
      .map((item) => item.task),
    idToUid,
  );

  return new Blob([xml], { type: "application/xml;charset=utf-8" });
}

