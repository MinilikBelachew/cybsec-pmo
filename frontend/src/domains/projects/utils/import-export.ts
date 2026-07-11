import { Department, Customer, ProjectManager, CreateProjectDto, ProjectPhase, ProjectTaskAssignee } from "../types/projects.types";
import { Task } from "../types/tasks.types";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  selectedFields?: string[]
): string {
  const allHeaders = [
    "Name",
    "Objective",
    "Department",
    "Customer",
    "Engagement Type",
    "Billing Model",
    "Priority",
    "Start Date",
    "End Date",
    "Value",
    "Currency",
    "Primary PM",
    "Secondary PM",
    "Status",
  ];
  const headers = selectedFields || allHeaders;

  const escapeCSV = (str: any) => {
    if (str == null) return "";
    const s = String(str);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = projects.map((p) => {
    const deptName = p.department?.name || departments.find((d) => d.id === p.departmentId)?.name || "";
    const custName = p.customer?.displayName || customers.find((c) => c.id === p.customerId)?.displayName || "";
    const primaryPmName = p.primaryPm?.displayName || managers.find((m) => m.id === p.primaryPmId)?.displayName || "";
    const secondaryPmName = p.secondaryPm?.displayName || managers.find((m) => m.id === p.secondaryPmId)?.displayName || "";

    const allData: Record<string, any> = {
      "Name": p.name,
      "Objective": p.objective,
      "Department": deptName,
      "Customer": custName,
      "Engagement Type": p.engagementType,
      "Billing Model": p.billingModel,
      "Priority": p.priority,
      "Start Date": p.startDate ? p.startDate.split("T")[0] : "",
      "End Date": p.endDate ? p.endDate.split("T")[0] : "",
      "Value": p.value,
      "Currency": p.currency,
      "Primary PM": primaryPmName,
      "Secondary PM": secondaryPmName,
      "Status": p.status,
    };

    return headers.map((field) => escapeCSV(allData[field]));
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function exportProjectsToXLSX(
  projects: any[],
  departments: Department[],
  customers: Customer[],
  managers: ProjectManager[],
  selectedFields?: string[],
  tasks?: any[],
  selectedTaskFields?: string[]
): ArrayBuffer {
  const allHeaders = [
    "Name",
    "Objective",
    "Department",
    "Customer",
    "Engagement Type",
    "Billing Model",
    "Priority",
    "Start Date",
    "End Date",
    "Value",
    "Currency",
    "Primary PM",
    "Secondary PM",
    "Status",
  ];
  const headers = selectedFields || allHeaders;

  const data = projects.map((p) => {
    const deptName = p.department?.name || departments.find((d) => d.id === p.departmentId)?.name || "";
    const custName = p.customer?.displayName || customers.find((c) => c.id === p.customerId)?.displayName || "";
    const primaryPmName = p.primaryPm?.displayName || managers.find((m) => m.id === p.primaryPmId)?.displayName || "";
    const secondaryPmName = p.secondaryPm?.displayName || managers.find((m) => m.id === p.secondaryPmId)?.displayName || "";

    const allData: Record<string, any> = {
      "Name": p.name || "",
      "Objective": p.objective || "",
      "Department": deptName,
      "Customer": custName,
      "Engagement Type": p.engagementType || "",
      "Billing Model": p.billingModel || "",
      "Priority": p.priority || "",
      "Start Date": p.startDate ? p.startDate.split("T")[0] : "",
      "End Date": p.endDate ? p.endDate.split("T")[0] : "",
      "Value": p.value || 0,
      "Currency": p.currency || "",
      "Primary PM": primaryPmName,
      "Secondary PM": secondaryPmName,
      "Status": p.status || "",
    };

    const filtered: Record<string, any> = {};
    headers.forEach((field) => {
      filtered[field] = allData[field];
    });
    return filtered;
  });

  const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Projects");

  if (tasks && tasks.length > 0) {
    // Group tasks by project name
    const tasksByProject: Record<string, any[]> = {};
    tasks.forEach((t) => {
      const projName = t.projectName || "Tasks";
      if (!tasksByProject[projName]) {
        tasksByProject[projName] = [];
      }
      tasksByProject[projName].push(t);
    });

    const allTaskHeaders = [
      "Title",
      "Description",
      "Priority",
      "Status",
      "Assignee",
      "Phase",
      "Start Date",
      "End Date",
      "Effort Hours",
    ];
    const taskHeaders = selectedTaskFields || allTaskHeaders;

    Object.entries(tasksByProject).forEach(([projName, projTasks]) => {
      const tasksData = projTasks.map((t) => {
        const assigneeName = t.owner?.displayName || t.assigneeName || "";
        const phaseName = t.phase?.name || t.phaseName || "";

        const allTaskData: Record<string, any> = {
          "Title": t.title || "",
          "Description": t.description || "",
          "Priority": t.priority || "",
          "Status": t.status || "",
          "Assignee": assigneeName,
          "Phase": phaseName,
          "Start Date": t.startDate ? t.startDate.split("T")[0] : "",
          "End Date": t.endDate ? t.endDate.split("T")[0] : "",
          "Effort Hours": t.effortHours != null ? t.effortHours : 0,
        };

        const filtered: Record<string, any> = {};
        taskHeaders.forEach((field) => {
          filtered[field] = allTaskData[field];
        });
        return filtered;
      });

      // Excel sheet names have a limit of 31 chars and cannot contain certain characters
      const cleanProjName = projName.replace(/[\\/?*:[\]]/g, "").trim().slice(0, 25);
      const sheetName = cleanProjName ? `${cleanProjName} Tasks` : "Tasks";
      const finalSheetName = sheetName.slice(0, 31);

      // Resolve duplicate sheet names if any
      let uniqueSheetName = finalSheetName;
      let counter = 1;
      while (workbook.SheetNames.includes(uniqueSheetName)) {
        const suffix = ` (${counter})`;
        uniqueSheetName = finalSheetName.slice(0, 31 - suffix.length) + suffix;
        counter++;
      }

      const tasksWorksheet = XLSX.utils.json_to_sheet(tasksData, { header: taskHeaders });
      XLSX.utils.book_append_sheet(workbook, tasksWorksheet, uniqueSheetName);
    });
  }

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
// XLSX IMPORT UTILITIES

/**
 * Reads a named sheet from an XLSX ArrayBuffer and returns its contents as a
 * 2-D string array (same shape as parseCSV output) so existing row processors
 * can be reused without modification.
 *
 * Falls back to the first sheet when `sheetName` is not found, unless
 * `strict` is true — in which case it returns an empty array.
 */
export function parseXLSXSheet(
  buffer: ArrayBuffer,
  sheetName: string,
  strict = false,
): string[][] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });

  const target =
    workbook.SheetNames.includes(sheetName)
      ? sheetName
      : strict
        ? null
        : workbook.SheetNames[0] ?? null;

  if (!target) return [];

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

export function processRawPhaseRows(rows: string[][]): ParsedPhaseRow[] {
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

    return { name, description, orderIndex, status, startDate, endDate, errors, warnings };
  });
}
// MILESTONE PARSING

export interface ParsedMilestoneRow {
  title: string;
  targetDate: string;
  weight: number;
  status: string; // "Pending" | "Completed" | "Missed"
  phaseName: string;
  errors: string[];
  warnings: string[];
}

function normalizeMilestoneStatus(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (["completed", "done", "achieved"].includes(s)) return "Completed";
  if (["missed", "failed", "overdue"].includes(s)) return "Missed";
  return "Pending";
}

export function processRawMilestoneRows(rows: string[][]): ParsedMilestoneRow[] {
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

    return { title, targetDate, weight, status, phaseName, errors, warnings };
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
  ];
  const taskRows = [
    [
      "Kick-off Meeting",
      "Conduct initial project kick-off meeting with stakeholders.",
      "High", "To_Do", "", "Discovery & Planning", "2026-07-01", "2026-07-02", "4",
    ],
    [
      "Scope Document",
      "Define and document the engagement scope.",
      "High", "To_Do", "", "Discovery & Planning", "2026-07-03", "2026-07-10", "16",
    ],
    [
      "Network Vulnerability Scan",
      "Run automated scans across the internal network.",
      "Critical", "To_Do", "", "Assessment Execution", "2026-08-01", "2026-08-05", "24",
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
    "Title", "Description", "Priority", "Status",
    "Assignee", "Phase", "Start Date", "End Date", "Effort Hours",
  ];
  const rows = [
    [
      "Design Authentication UI",
      "Create wireframes and mockup designs for login/signup screens.",
      "High", "To_Do", defaultAssignee, defaultPhase, "2026-07-01", "2026-07-05", "12",
    ],
    [
      "Setup NestJS Backend API",
      "Initialize backend application and configure base folders.",
      "Critical", "In_Progress", defaultAssignee, defaultPhase, "2026-07-01", "2026-07-10", "24",
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
    const rawValue = getVal(valIdx, "0");
    const currency = getVal(curIdx, "USD");
    const primaryPmName = getVal(pmIdx);
    const secondaryPmName = getVal(pm2Idx);
    const status = getVal(statusIdx, "Draft");

    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic required field validations
    if (!name) errors.push("Project name is required.");
    if (!objective) errors.push("Objective is required.");

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

    // Validate Value
    const value = parseFloat(rawValue.replace(/[^0-9.-]/g, ""));
    if (isNaN(value)) {
      errors.push("Invalid value/budget amount.");
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
    let resolvedProjectId: string | undefined;
    let importMode: "create" | "update" = "create";
    if (existingProjects && name) {
      const match = existingProjects.find(
        (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (match) {
        resolvedProjectId = match.id;
        importMode = "update";
        // For updates, "already exists" is allowed — remove it from errors
        const alreadyExistsIdx = errors.findIndex((e) => e.includes("already exists"));
        if (alreadyExistsIdx !== -1) errors.splice(alreadyExistsIdx, 1);
      }
    }

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
      value: isNaN(value) ? 0 : value,
      currency,
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
  selectedFields?: string[]
): string {
  const allHeaders = [
    "Title",
    "Description",
    "Priority",
    "Status",
    "Assignee",
    "Phase",
    "Start Date",
    "End Date",
    "Effort Hours"
  ];
  const headers = selectedFields || allHeaders;

  const escapeCSV = (str: any) => {
    if (str == null) return "";
    const s = String(str);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = tasks.map((t) => {
    const assigneeName =
      t.owner?.displayName ||
      assignees.find((assignee) => assignee.userId === t.ownerId)?.displayName ||
      "";
    const phaseName = t.phase?.name || phases.find((p) => p.id === t.phaseId)?.name || "";

    const allData: Record<string, any> = {
      "Title": t.title || "",
      "Description": t.description || "",
      "Priority": t.priority || "",
      "Status": t.status || "",
      "Assignee": assigneeName,
      "Phase": phaseName,
      "Start Date": t.startDate ? t.startDate.split("T")[0] : "",
      "End Date": t.endDate ? t.endDate.split("T")[0] : "",
      "Effort Hours": t.effortHours != null ? String(t.effortHours) : "",
    };

    return headers.map((field) => escapeCSV(allData[field]));
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function exportTasksToXLSX(
  tasks: Task[],
  phases: ProjectPhase[],
  assignees: ProjectTaskAssignee[],
  selectedFields?: string[]
): ArrayBuffer {
  const allHeaders = [
    "Title",
    "Description",
    "Priority",
    "Status",
    "Assignee",
    "Phase",
    "Start Date",
    "End Date",
    "Effort Hours",
  ];
  const headers = selectedFields || allHeaders;

  const data = tasks.map((t) => {
    const assigneeName =
      t.owner?.displayName ||
      assignees.find((assignee) => assignee.userId === t.ownerId)?.displayName ||
      "";
    const phaseName = t.phase?.name || phases.find((p) => p.id === t.phaseId)?.name || "";

    const allData: Record<string, any> = {
      "Title": t.title || "",
      "Description": t.description || "",
      "Priority": t.priority || "",
      "Status": t.status || "",
      "Assignee": assigneeName,
      "Phase": phaseName,
      "Start Date": t.startDate ? t.startDate.split("T")[0] : "",
      "End Date": t.endDate ? t.endDate.split("T")[0] : "",
      "Effort Hours": t.effortHours != null ? t.effortHours : 0,
    };

    const filtered: Record<string, any> = {};
    headers.forEach((field) => {
      filtered[field] = allData[field];
    });
    return filtered;
  });

  const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");
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

export function revalidateParsedTaskRow(
  row: ParsedTaskRow,
  phases: ProjectPhase[],
  assignees: ProjectTaskAssignee[],
  duplicateTitles?: Set<string>,
): ParsedTaskRow {
  const updated = {
    ...row,
    priority: normalizeTaskPriority(row.priority),
    status: normalizeTaskStatus(row.status),
  };

  const errors: string[] = [];
  const warnings: string[] = [...(updated.warnings ?? [])];

  if (!updated.title) errors.push("Task title is required.");

  if (updated.title && duplicateTitles?.has(updated.title.toLowerCase())) {
    errors.push(`Duplicate task title "${updated.title}" found in this file.`);
  }

  let isStartValid = false;
  if (updated.startDate) {
    const parsedStart = Date.parse(updated.startDate);
    if (!isNaN(parsedStart)) {
      isStartValid = true;
    } else {
      errors.push("Start date must be a valid date (YYYY-MM-DD).");
    }
  }

  let isEndValid = false;
  if (updated.endDate) {
    const parsedEnd = Date.parse(updated.endDate);
    if (!isNaN(parsedEnd)) {
      isEndValid = true;
    } else {
      errors.push("End date must be a valid date (YYYY-MM-DD).");
    }
  }

  if (isStartValid && isEndValid && updated.startDate && updated.endDate) {
    if (new Date(updated.startDate).getTime() > new Date(updated.endDate).getTime()) {
      errors.push("End date must be on or after start date.");
    }
  }

  if (updated.effortHours != null && isNaN(Number(updated.effortHours))) {
    errors.push("Invalid effort hours.");
  }

  let resolvedAssigneeId = updated.resolvedAssigneeId ?? null;
  if (resolvedAssigneeId) {
    const assigneeExists = assignees.some((assignee) => assignee.userId === resolvedAssigneeId);
    if (!assigneeExists) resolvedAssigneeId = null;
  } else if (updated.assigneeName) {
    const assignee = findProjectTaskAssignee(updated.assigneeName, assignees);
    if (assignee) {
      resolvedAssigneeId = assignee.userId;
    } else {
      errors.push(
        `Assignee "${updated.assigneeName}" is not on the project team. Add them to the team first.`,
      );
    }
  }

  let resolvedPhaseId = updated.resolvedPhaseId ?? null;
  let phaseName = updated.phaseName;
  if (resolvedPhaseId) {
    const phase = phases.find((item) => item.id === resolvedPhaseId);
    if (phase) {
      phaseName = phase.name;
    } else {
      resolvedPhaseId = null;
    }
  }

  if (!resolvedPhaseId && phaseName) {
    const phase = phases.find((item) => item.name.toLowerCase() === phaseName.toLowerCase());
    if (phase) {
      resolvedPhaseId = phase.id;
      phaseName = phase.name;
    } else if (phases.length === 0) {
      warnings.push("No project phases exist yet. Create phases first, then re-select.");
    } else {
      errors.push(`Phase "${phaseName}" not found. Please select one.`);
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

  return {
    ...updated,
    phaseName,
    resolvedAssigneeId,
    resolvedPhaseId,
    errors,
    warnings,
  };
}

export function processRawTaskCSVRows(
  csvData: string[][],
  phases: ProjectPhase[],
  assignees: ProjectTaskAssignee[],
  existingTasks?: { id: string; title: string }[]
): ParsedTaskRow[] {
  const existingTaskMap = new Map<string, string>();
  if (existingTasks) {
    for (const t of existingTasks) {
      existingTaskMap.set(t.title.trim().toLowerCase(), t.id);
    }
  }
  if (csvData.length <= 1) return [];

  const headers = csvData[0].map((h) => h.toLowerCase());
  const rows = csvData.slice(1);

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
  const effortIdx = getIndex(["effort hours", "effort", "hours"]);

  const titleFrequency: Record<string, number> = {};
  for (const row of rows) {
    const t = (titleIdx !== -1 && row[titleIdx] ? row[titleIdx].trim() : "").toLowerCase();
    if (t) titleFrequency[t] = (titleFrequency[t] ?? 0) + 1;
  }
  const duplicateTitles = new Set(
    Object.entries(titleFrequency)
      .filter(([, count]) => count > 1)
      .map(([title]) => title),
  );

  return rows.map((row) => {
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

    const lowerTitle = title.trim().toLowerCase();
    const resolvedTaskId = lowerTitle ? existingTaskMap.get(lowerTitle) : undefined;
    const importMode: "create" | "update" = resolvedTaskId ? "update" : "create";

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
        importMode,
        resolvedTaskId,
        errors: [],
        warnings: [],
      },
      phases,
      assignees,
      duplicateTitles,
    );
  });
}

export function exportTasksToPDF(
  tasks: Task[],
  phases: ProjectPhase[],
  assignees: ProjectTaskAssignee[],
  selectedFields?: string[]
): Blob {
  const doc = new jsPDF({ orientation: "landscape" });

  const allHeaders = [
    "Title",
    "Description",
    "Priority",
    "Status",
    "Assignee",
    "Phase",
    "Start Date",
    "End Date",
    "Effort Hours",
  ];
  const headers = selectedFields || allHeaders;

  const data = tasks.map((t) => {
    const assigneeName =
      t.owner?.displayName ||
      assignees.find((assignee) => assignee.userId === t.ownerId)?.displayName ||
      "";
    const phaseName = t.phase?.name || phases.find((p) => p.id === t.phaseId)?.name || "";

    const allData: Record<string, any> = {
      "Title": t.title || "",
      "Description": t.description || "",
      "Priority": t.priority || "",
      "Status": t.status || "",
      "Assignee": assigneeName,
      "Phase": phaseName,
      "Start Date": t.startDate ? t.startDate.split("T")[0] : "",
      "End Date": t.endDate ? t.endDate.split("T")[0] : "",
      "Effort Hours": t.effortHours != null ? t.effortHours : 0,
    };

    return headers.map((field) => String(allData[field] || ""));
  });

  autoTable(doc, {
    head: [headers],
    body: data,
    styles: { fontSize: 8 },
    theme: "striped",
  });

  return doc.output("blob");
}

export function exportProjectsToPDF(
  projects: any[],
  departments: Department[],
  customers: Customer[],
  managers: ProjectManager[],
  selectedFields?: string[],
  tasks?: any[],
  selectedTaskFields?: string[]
): Blob {
  const doc = new jsPDF({ orientation: "landscape" });

  const allHeaders = [
    "Name",
    "Objective",
    "Department",
    "Customer",
    "Engagement Type",
    "Billing Model",
    "Priority",
    "Start Date",
    "End Date",
    "Value",
    "Currency",
    "Primary PM",
    "Secondary PM",
    "Status",
  ];
  const headers = selectedFields || allHeaders;

  const data = projects.map((p) => {
    const deptName = p.department?.name || departments.find((d) => d.id === p.departmentId)?.name || "";
    const custName = p.customer?.displayName || customers.find((c) => c.id === p.customerId)?.displayName || "";
    const primaryPmName = p.primaryPm?.displayName || managers.find((m) => m.id === p.primaryPmId)?.displayName || "";
    const secondaryPmName = p.secondaryPm?.displayName || managers.find((m) => m.id === p.secondaryPmId)?.displayName || "";

    const allData: Record<string, any> = {
      "Name": p.name || "",
      "Objective": p.objective || "",
      "Department": deptName,
      "Customer": custName,
      "Engagement Type": p.engagementType || "",
      "Billing Model": p.billingModel || "",
      "Priority": p.priority || "",
      "Start Date": p.startDate ? p.startDate.split("T")[0] : "",
      "End Date": p.endDate ? p.endDate.split("T")[0] : "",
      "Value": p.value || 0,
      "Currency": p.currency || "",
      "Primary PM": primaryPmName,
      "Secondary PM": secondaryPmName,
      "Status": p.status || "",
    };

    return headers.map((field) => String(allData[field] || ""));
  });

  doc.setFontSize(14);
  doc.text("Projects", 14, 15);

  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 20,
    styles: { fontSize: 8 },
    theme: "striped",
  });

  if (tasks && tasks.length > 0) {
    const tasksByProject: Record<string, any[]> = {};
    tasks.forEach((t) => {
      const projName = t.projectName || "Tasks";
      if (!tasksByProject[projName]) {
        tasksByProject[projName] = [];
      }
      tasksByProject[projName].push(t);
    });

    const allTaskHeaders = [
      "Title",
      "Description",
      "Priority",
      "Status",
      "Assignee",
      "Phase",
      "Start Date",
      "End Date",
      "Effort Hours",
    ];
    const taskHeaders = selectedTaskFields || allTaskHeaders;

    Object.entries(tasksByProject).forEach(([projName, projTasks]) => {
      const tasksData = projTasks.map((t) => {
        const assigneeName = t.owner?.displayName || t.assigneeName || "";
        const phaseName = t.phase?.name || t.phaseName || "";

        const allTaskData: Record<string, any> = {
          "Title": t.title || "",
          "Description": t.description || "",
          "Priority": t.priority || "",
          "Status": t.status || "",
          "Assignee": assigneeName,
          "Phase": phaseName,
          "Start Date": t.startDate ? t.startDate.split("T")[0] : "",
          "End Date": t.endDate ? t.endDate.split("T")[0] : "",
          "Effort Hours": t.effortHours != null ? t.effortHours : 0,
        };

        return taskHeaders.map((field) => String(allTaskData[field] || ""));
      });

      doc.addPage();
      doc.setFontSize(14);
      doc.text(`${projName} Tasks`, 14, 15);

      autoTable(doc, {
        head: [taskHeaders],
        body: tasksData,
        startY: 20,
        styles: { fontSize: 8 },
        theme: "striped",
      });
    });
  }

  return doc.output("blob");
}

export function exportProjectsToWord(
  projects: any[],
  departments: Department[],
  customers: Customer[],
  managers: ProjectManager[],
  selectedFields?: string[],
  tasks?: any[],
  selectedTaskFields?: string[]
): Blob {
  const allHeaders = [
    "Name",
    "Objective",
    "Department",
    "Customer",
    "Engagement Type",
    "Billing Model",
    "Priority",
    "Start Date",
    "End Date",
    "Value",
    "Currency",
    "Primary PM",
    "Secondary PM",
    "Status",
  ];
  const headers = selectedFields || allHeaders;

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>Project Portfolio Report</title>
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
        table { border-collapse: collapse; width: 100%; table-layout: auto; margin-top: 15px; margin-bottom: 15px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; word-break: break-word; word-wrap: break-word; }
        th { background-color: #f8fafc; font-weight: bold; color: #0f172a; font-size: 9pt; }
        td { font-size: 9pt; }
        .meta { font-size: 9pt; color: #64748b; margin-bottom: 30px; }
      </style>
    </head>
    <body>
      <div class="Section1">
        <h1>Project Portfolio Report</h1>
        <p class="meta">Exported on: ${new Date().toLocaleDateString()}</p>
        
        <h2>Projects Overview</h2>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
  `;

  projects.forEach((p) => {
    const deptName = p.department?.name || departments.find((d) => d.id === p.departmentId)?.name || "";
    const custName = p.customer?.displayName || customers.find((c) => c.id === p.customerId)?.displayName || "";
    const primaryPmName = p.primaryPm?.displayName || managers.find((m) => m.id === p.primaryPmId)?.displayName || "";
    const secondaryPmName = p.secondaryPm?.displayName || managers.find((m) => m.id === p.secondaryPmId)?.displayName || "";

    const allData: Record<string, any> = {
      "Name": p.name || "",
      "Objective": p.objective || "",
      "Department": deptName,
      "Customer": custName,
      "Engagement Type": p.engagementType || "",
      "Billing Model": p.billingModel || "",
      "Priority": p.priority || "",
      "Start Date": p.startDate ? p.startDate.split("T")[0] : "",
      "End Date": p.endDate ? p.endDate.split("T")[0] : "",
      "Value": p.value != null ? p.value : "",
      "Currency": p.currency || "",
      "Primary PM": primaryPmName,
      "Secondary PM": secondaryPmName,
      "Status": p.status || "",
    };

    html += `
      <tr>
        ${headers.map(field => `<td>${allData[field] !== undefined ? allData[field] : ""}</td>`).join("")}
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
  `;

  if (tasks && tasks.length > 0) {
    const tasksByProject: Record<string, any[]> = {};
    tasks.forEach((t) => {
      const projName = t.projectName || "Tasks";
      if (!tasksByProject[projName]) {
        tasksByProject[projName] = [];
      }
      tasksByProject[projName].push(t);
    });

    const allTaskHeaders = [
      "Title",
      "Description",
      "Priority",
      "Status",
      "Assignee",
      "Phase",
      "Start Date",
      "End Date",
      "Effort Hours",
    ];
    const taskHeaders = selectedTaskFields || allTaskHeaders;

    html += `<h2>Project Tasks Breakdown</h2>`;

    Object.entries(tasksByProject).forEach(([projName, projTasks]) => {
      html += `
        <h3>${projName} Tasks</h3>
        <table>
          <thead>
            <tr>
              ${taskHeaders.map(h => `<th>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
      `;

      projTasks.forEach((t) => {
        const assigneeName = t.owner?.displayName || t.assigneeName || "";
        const phaseName = t.phase?.name || t.phaseName || "";

        const allTaskData: Record<string, any> = {
          "Title": t.title || "",
          "Description": t.description || "",
          "Priority": t.priority || "",
          "Status": t.status || "",
          "Assignee": assigneeName,
          "Phase": phaseName,
          "Start Date": t.startDate ? t.startDate.split("T")[0] : "",
          "End Date": t.endDate ? t.endDate.split("T")[0] : "",
          "Effort Hours": t.effortHours != null ? t.effortHours : 0,
        };

        html += `
          <tr>
            ${taskHeaders.map(field => `<td>${allTaskData[field] !== undefined ? allTaskData[field] : ""}</td>`).join("")}
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
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
  selectedFields?: string[]
): Blob {
  const allHeaders = [
    "Title",
    "Description",
    "Priority",
    "Status",
    "Assignee",
    "Phase",
    "Start Date",
    "End Date",
    "Effort Hours",
  ];
  const headers = selectedFields || allHeaders;

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
        table { border-collapse: collapse; width: 100%; table-layout: auto; margin-top: 15px; margin-bottom: 15px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; word-break: break-word; word-wrap: break-word; }
        th { background-color: #f8fafc; font-weight: bold; color: #0f172a; font-size: 9pt; }
        td { font-size: 9pt; }
        .meta { font-size: 9pt; color: #64748b; margin-bottom: 30px; }
      </style>
    </head>
    <body>
      <div class="Section1">
        <h1>Project Tasks Report</h1>
        <p class="meta">Exported on: ${new Date().toLocaleDateString()}</p>
        
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
  `;

  tasks.forEach((t) => {
    const assigneeName =
      t.owner?.displayName ||
      assignees.find((assignee) => assignee.userId === t.ownerId)?.displayName ||
      "";
    const phaseName = t.phase?.name || phases.find((p) => p.id === t.phaseId)?.name || "";

    const allData: Record<string, any> = {
      "Title": t.title || "",
      "Description": t.description || "",
      "Priority": t.priority || "",
      "Status": t.status || "",
      "Assignee": assigneeName,
      "Phase": phaseName,
      "Start Date": t.startDate ? t.startDate.split("T")[0] : "",
      "End Date": t.endDate ? t.endDate.split("T")[0] : "",
      "Effort Hours": t.effortHours != null ? t.effortHours : 0,
    };

    html += `
      <tr>
        ${headers.map(field => `<td>${allData[field] !== undefined ? allData[field] : ""}</td>`).join("")}
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;

  return new Blob([html], { type: "application/msword;charset=utf-8" });
}

export function exportTasksToMPP(
  tasks: any[],
  phases: any[],
  assignees: any[],
  projectName = "Portfolio Export"
): Blob {
  let uid = 1;

  const escXml = (str: string) =>
    String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const mapPriority = (p: string) => {
    const lower = String(p || "").toLowerCase();
    if (lower === "critical") return 1000;
    if (lower === "high") return 700;
    if (lower === "low") return 300;
    return 500;
  };

  const mapPercent = (s: string) => {
    const lower = String(s || "").toLowerCase();
    if (lower === "done" || lower === "approved") return 100;
    if (lower === "in_progress") return 50;
    return 0;
  };

  const phaseList = [...phases];
  const phaseMap = new Map(phaseList.map(p => [p.id || p.name, p]));

  const tasksByPhase: Record<string, any[]> = {};

  const topLevelTasks = tasks.filter(t => !t.parentTaskId);
  const subTasksByParent = tasks.filter(t => t.parentTaskId).reduce((acc, t) => {
    if (!acc[t.parentTaskId]) acc[t.parentTaskId] = [];
    acc[t.parentTaskId].push(t);
    return acc;
  }, {} as Record<string, any[]>);

  topLevelTasks.forEach((t) => {
    const phaseKey = t.phaseId || t.phaseName || "No Phase";
    if (!tasksByPhase[phaseKey]) tasksByPhase[phaseKey] = [];
    tasksByPhase[phaseKey].push(t);
  });

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${escXml(projectName)}</Name>
  <Title>${escXml(projectName)}</Title>
  <Tasks>
`;

  // Root summary task (UID 0 is the project root in MS Project XML)
  xml += `    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <IsNull>0</IsNull>
      <WBS>0</WBS>
      <OutlineNumber>0</OutlineNumber>
      <OutlineLevel>0</OutlineLevel>
      <Type>1</Type>
      <IsSubproject>0</IsSubproject>
      <Name>${escXml(projectName)}</Name>
      <Summary>1</Summary>
    </Task>
`;

  let phaseIndex = 0;
  Object.entries(tasksByPhase).forEach(([phaseKey, phaseTasks]) => {
    phaseIndex++;
    const phaseObj = phaseMap.get(phaseKey);
    const phaseName = phaseObj?.name || phaseKey;

    xml += `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <IsNull>0</IsNull>
      <WBS>${phaseIndex}</WBS>
      <OutlineNumber>${phaseIndex}</OutlineNumber>
      <OutlineLevel>1</OutlineLevel>
      <Type>0</Type>
      <Name>${escXml(phaseName)}</Name>
      <Summary>1</Summary>
    </Task>
`;
    uid++;

    let taskIndex = 0;
    phaseTasks.forEach((t) => {
      taskIndex++;
      const taskStart = t.startDate ? t.startDate.split("T")[0] + "T08:00:00" : "";
      const taskEnd = t.endDate ? t.endDate.split("T")[0] + "T17:00:00" : "";
      const percent = mapPercent(t.status);
      const priority = mapPriority(t.priority);
      const subTasks = subTasksByParent[t.id] || t.subTasks || [];
      const isSummary = subTasks.length > 0 ? 1 : 0;

      xml += `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <IsNull>0</IsNull>
      <WBS>${phaseIndex}.${taskIndex}</WBS>
      <OutlineNumber>${phaseIndex}.${taskIndex}</OutlineNumber>
      <OutlineLevel>2</OutlineLevel>
      <Type>0</Type>
      <Name>${escXml(t.title || "")}</Name>
      <Summary>${isSummary}</Summary>
      ${taskStart ? `<Start>${taskStart}</Start>` : ""}
      ${taskEnd ? `<Finish>${taskEnd}</Finish>` : ""}
      <PercentComplete>${percent}</PercentComplete>
      <Priority>${priority}</Priority>
      <Notes>${escXml(t.description || "")}</Notes>
    </Task>
`;
      uid++;

      let subIndex = 0;
      subTasks.forEach((st: any) => {
        subIndex++;
        const subStart = st.startDate ? st.startDate.split("T")[0] + "T08:00:00" : taskStart;
        const subEnd = st.endDate ? st.endDate.split("T")[0] + "T17:00:00" : taskEnd;
        const subPercent = mapPercent(st.status);
        const subPriority = mapPriority(st.priority);

        xml += `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <IsNull>0</IsNull>
      <WBS>${phaseIndex}.${taskIndex}.${subIndex}</WBS>
      <OutlineNumber>${phaseIndex}.${taskIndex}.${subIndex}</OutlineNumber>
      <OutlineLevel>3</OutlineLevel>
      <Type>0</Type>
      <Name>${escXml(st.title || "")}</Name>
      <Summary>0</Summary>
      ${subStart ? `<Start>${subStart}</Start>` : ""}
      ${subEnd ? `<Finish>${subEnd}</Finish>` : ""}
      <PercentComplete>${subPercent}</PercentComplete>
      <Priority>${subPriority}</Priority>
      <Notes>${escXml(st.description || "")}</Notes>
    </Task>
`;
        uid++;
      });
    });
  });

  xml += `  </Tasks>
</Project>`;

  return new Blob([xml], { type: "application/xml;charset=utf-8" });
}

export function exportProjectsToMPP(
  projects: any[],
  departments: Department[],
  customers: Customer[],
  managers: ProjectManager[],
  tasks?: any[]
): Blob {
  let uid = 1;

  const escXml = (str: string) =>
    String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const mapPriority = (p: string) => {
    const lower = String(p || "").toLowerCase();
    if (lower === "critical") return 1000;
    if (lower === "high") return 700;
    if (lower === "low") return 300;
    return 500;
  };

  const mapPercent = (s: string) => {
    const lower = String(s || "").toLowerCase();
    if (lower === "done" || lower === "approved" || lower === "closed") return 100;
    if (lower === "in_progress") return 50;
    return 0;
  };

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Portfolio Export</Name>
  <Title>Portfolio Export</Title>
  <Tasks>
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <IsNull>0</IsNull>
      <WBS>0</WBS>
      <OutlineNumber>0</OutlineNumber>
      <OutlineLevel>0</OutlineLevel>
      <Type>1</Type>
      <IsSubproject>0</IsSubproject>
      <Name>Portfolio Export</Name>
      <Summary>1</Summary>
    </Task>
`;

  let projIndex = 0;
  projects.forEach((proj) => {
    projIndex++;
    const projStart = proj.startDate ? proj.startDate.split("T")[0] + "T08:00:00" : "";
    const projEnd = proj.endDate ? proj.endDate.split("T")[0] + "T17:00:00" : "";

    xml += `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <IsNull>0</IsNull>
      <WBS>${projIndex}</WBS>
      <OutlineNumber>${projIndex}</OutlineNumber>
      <OutlineLevel>1</OutlineLevel>
      <Type>0</Type>
      <Name>${escXml(proj.name || "")}</Name>
      <Summary>1</Summary>
      ${projStart ? `<Start>${projStart}</Start>` : ""}
      ${projEnd ? `<Finish>${projEnd}</Finish>` : ""}
      <PercentComplete>${mapPercent(proj.status)}</PercentComplete>
      <Notes>${escXml(proj.objective || "")}</Notes>
    </Task>
`;
    uid++;

    const projTasks = tasks
      ? tasks.filter(t => t.projectId === proj.id || t.projectName === proj.name)
      : [];

    const tasksByPhase: Record<string, any[]> = {};
    const topLevelTasks = projTasks.filter(t => !t.parentTaskId);
    const subTasksByParent = projTasks
      .filter(t => t.parentTaskId)
      .reduce((acc, t) => {
        if (!acc[t.parentTaskId]) acc[t.parentTaskId] = [];
        acc[t.parentTaskId].push(t);
        return acc;
      }, {} as Record<string, any[]>);

    topLevelTasks.forEach((t) => {
      const phaseKey = t.phase?.name || t.phaseName || "No Phase";
      if (!tasksByPhase[phaseKey]) tasksByPhase[phaseKey] = [];
      tasksByPhase[phaseKey].push(t);
    });

    let phaseIndex = 0;
    Object.entries(tasksByPhase).forEach(([phaseName, phaseTasks]) => {
      phaseIndex++;

      xml += `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <IsNull>0</IsNull>
      <WBS>${projIndex}.${phaseIndex}</WBS>
      <OutlineNumber>${projIndex}.${phaseIndex}</OutlineNumber>
      <OutlineLevel>2</OutlineLevel>
      <Type>0</Type>
      <Name>${escXml(phaseName)}</Name>
      <Summary>1</Summary>
    </Task>
`;
      uid++;

      let taskIndex = 0;
      phaseTasks.forEach((t) => {
        taskIndex++;
        const taskStart = t.startDate ? t.startDate.split("T")[0] + "T08:00:00" : projStart;
        const taskEnd = t.endDate ? t.endDate.split("T")[0] + "T17:00:00" : projEnd;
        const subTasks = subTasksByParent[t.id] || t.subTasks || [];
        const isSummary = subTasks.length > 0 ? 1 : 0;

        xml += `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <IsNull>0</IsNull>
      <WBS>${projIndex}.${phaseIndex}.${taskIndex}</WBS>
      <OutlineNumber>${projIndex}.${phaseIndex}.${taskIndex}</OutlineNumber>
      <OutlineLevel>3</OutlineLevel>
      <Type>0</Type>
      <Name>${escXml(t.title || "")}</Name>
      <Summary>${isSummary}</Summary>
      ${taskStart ? `<Start>${taskStart}</Start>` : ""}
      ${taskEnd ? `<Finish>${taskEnd}</Finish>` : ""}
      <PercentComplete>${mapPercent(t.status)}</PercentComplete>
      <Priority>${mapPriority(t.priority)}</Priority>
      <Notes>${escXml(t.description || "")}</Notes>
    </Task>
`;
        uid++;

        let subIndex = 0;
        subTasks.forEach((st: any) => {
          subIndex++;
          const subStart = st.startDate ? st.startDate.split("T")[0] + "T08:00:00" : taskStart;
          const subEnd = st.endDate ? st.endDate.split("T")[0] + "T17:00:00" : taskEnd;

          xml += `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <IsNull>0</IsNull>
      <WBS>${projIndex}.${phaseIndex}.${taskIndex}.${subIndex}</WBS>
      <OutlineNumber>${projIndex}.${phaseIndex}.${taskIndex}.${subIndex}</OutlineNumber>
      <OutlineLevel>4</OutlineLevel>
      <Type>0</Type>
      <Name>${escXml(st.title || "")}</Name>
      <Summary>0</Summary>
      ${subStart ? `<Start>${subStart}</Start>` : ""}
      ${subEnd ? `<Finish>${subEnd}</Finish>` : ""}
      <PercentComplete>${mapPercent(st.status)}</PercentComplete>
      <Priority>${mapPriority(st.priority)}</Priority>
      <Notes>${escXml(st.description || "")}</Notes>
    </Task>
`;
          uid++;
        });
      });
    });
  });

  xml += `  </Tasks>
</Project>`;

  return new Blob([xml], { type: "application/xml;charset=utf-8" });
}

