import { Department, Customer, ProjectManager, CreateProjectDto, ProjectPhase, ProjectTaskAssignee } from "../types/projects.types";
import { Task } from "../types/tasks.types";
import * as XLSX from "xlsx";

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
  managers: ProjectManager[]
): string {
  const headers = [
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

    return [
      p.name,
      p.objective,
      deptName,
      custName,
      p.engagementType,
      p.billingModel,
      p.priority,
      p.startDate ? p.startDate.split("T")[0] : "",
      p.endDate ? p.endDate.split("T")[0] : "",
      p.value,
      p.currency,
      primaryPmName,
      secondaryPmName,
      p.status,
    ].map(escapeCSV);
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function exportProjectsToXLSX(
  projects: any[],
  departments: Department[],
  customers: Customer[],
  managers: ProjectManager[]
): ArrayBuffer {
  const headers = [
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

  const data = projects.map((p) => {
    const deptName = p.department?.name || departments.find((d) => d.id === p.departmentId)?.name || "";
    const custName = p.customer?.displayName || customers.find((c) => c.id === p.customerId)?.displayName || "";
    const primaryPmName = p.primaryPm?.displayName || managers.find((m) => m.id === p.primaryPmId)?.displayName || "";
    const secondaryPmName = p.secondaryPm?.displayName || managers.find((m) => m.id === p.secondaryPmId)?.displayName || "";

    return {
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
  });

  const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Projects");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
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
  managers: ProjectManager[]
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
    const status = getVal(statusIdx, "Planned");

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
    } else if (["pending closure", "pending_closure", "pendingclosure", "at risk", "atrisk", "at_risk"].includes(lowerStatus)) {
      normalizedStatus = "PendingClosure";
    } else if (["on hold", "on_hold", "onhold"].includes(lowerStatus)) {
      normalizedStatus = "OnHold";
    } else if (["closed", "completed"].includes(lowerStatus)) {
      normalizedStatus = "Closed";
    } else if (["planned", "draft"].includes(lowerStatus)) {
      normalizedStatus = "Draft"; // Map Planned/Draft to Draft
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
    if (!["Draft", "Active", "OnHold", "PendingClosure", "Closed"].includes(normalizedStatus)) {
      errors.push(`Status "${status}" is invalid. Please select one.`);
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
  assignees: ProjectTaskAssignee[]
): string {
  const headers = [
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

    return [
      t.title || "",
      t.description || "",
      t.priority || "",
      t.status || "",
      assigneeName,
      phaseName,
      t.startDate ? t.startDate.split("T")[0] : "",
      t.endDate ? t.endDate.split("T")[0] : "",
      t.effortHours != null ? String(t.effortHours) : "",
    ].map(escapeCSV);
  });

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export function exportTasksToXLSX(
  tasks: Task[],
  phases: ProjectPhase[],
  assignees: ProjectTaskAssignee[]
): ArrayBuffer {
  const headers = [
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

  const data = tasks.map((t) => {
    const assigneeName =
      t.owner?.displayName ||
      assignees.find((assignee) => assignee.userId === t.ownerId)?.displayName ||
      "";
    const phaseName = t.phase?.name || phases.find((p) => p.id === t.phaseId)?.name || "";

    return {
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

  errors: string[];
  warnings: string[];
  isSummary?: boolean;
  isMilestone?: boolean;
}

export function processRawTaskCSVRows(
  csvData: string[][],
  phases: ProjectPhase[],
  assignees: ProjectTaskAssignee[]
): ParsedTaskRow[] {
  if (csvData.length <= 1) return [];

  const headers = csvData[0].map((h) => h.toLowerCase());
  const rows = csvData.slice(1);

  const getIndex = (aliases: string[]) => {
    return headers.findIndex((h) => aliases.includes(h.trim()));
  };

  const titleIdx = getIndex(["title", "task title", "name", "task name"]);
  const descIdx = getIndex(["description", "desc", "details"]);
  const prioIdx = getIndex(["priority", "priority level"]);
  const statusIdx = getIndex(["status", "task status"]);
  const assigneeIdx = getIndex(["assignee", "owner", "pm"]);
  const phaseIdx = getIndex(["phase", "project phase", "stage"]);
  const startIdx = getIndex(["start date", "start"]);
  const endIdx = getIndex(["end date", "end"]);
  const effortIdx = getIndex(["effort hours", "effort", "hours"]);

  // Pre-scan titles to detect duplicates within the CSV
  const titleFrequency: Record<string, number> = {};
  for (const row of rows) {
    const t = (titleIdx !== -1 && row[titleIdx] ? row[titleIdx].trim() : "").toLowerCase();
    if (t) titleFrequency[t] = (titleFrequency[t] ?? 0) + 1;
  }

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

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!title) errors.push("Task title is required.");

    // Duplicate detection within the CSV
    if (title && (titleFrequency[title.toLowerCase()] ?? 0) > 1) {
      errors.push(`Duplicate task title "${title}" found in this file.`);
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
    }

    // Validate Range
    if (isStartValid && isEndValid && startDate && endDate) {
      if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
        errors.push("End date must be on or after start date.");
      }
    }

    // Validate Effort Hours
    let effortHours = 0;
    if (rawEffort) {
      const parsedEffort = parseFloat(rawEffort.replace(/[^0-9.-]/g, ""));
      if (isNaN(parsedEffort)) {
        errors.push("Invalid effort hours.");
      } else {
        effortHours = parsedEffort;
      }
    }

    // Resolve Assignee
    let resolvedAssigneeId: string | null = null;
    if (assigneeName) {
      const assignee = findProjectTaskAssignee(assigneeName, assignees);
      if (assignee) {
        resolvedAssigneeId = assignee.userId;
      } else {
        errors.push(
          `Assignee "${assigneeName}" is not on the project team. Add them to the team first.`,
        );
      }
    }

    // Resolve Phase
    let resolvedPhaseId: string | null = null;
    if (phaseName) {
      const phase = phases.find(
        (p) => p.name.toLowerCase() === phaseName.toLowerCase()
      );
      if (phase) {
        resolvedPhaseId = phase.id;
      } else {
        errors.push(`Phase "${phaseName}" not found. Please select one.`);
      }
    }

    // Normalize select dropdown fields to standard backend API enum values
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
    const lowerStatus = status.toLowerCase().trim().replace(/[\s-]/g, "_");
    if (["to_do", "todo", "to do"].includes(lowerStatus)) {
      normalizedStatus = "To_Do";
    } else if (["in_progress", "inprogress", "in progress"].includes(lowerStatus)) {
      normalizedStatus = "In_Progress";
    } else if (["submitted_for_review", "submittedforreview", "submitted for review"].includes(lowerStatus)) {
      normalizedStatus = "Submitted_for_Review";
    } else if (["approved"].includes(lowerStatus)) {
      normalizedStatus = "Approved";
    } else if (["rework"].includes(lowerStatus)) {
      normalizedStatus = "Rework";
    } else if (["done"].includes(lowerStatus)) {
      normalizedStatus = "Done";
    }

    // Add validation errors for invalid enum values
    if (!["Low", "Medium", "High", "Critical"].includes(normalizedPriority)) {
      errors.push(`Priority "${priority}" is invalid. Please select one.`);
    }
    if (!["To_Do", "In_Progress", "Submitted_for_Review", "Approved", "Rework", "Done"].includes(normalizedStatus)) {
      errors.push(`Status "${status}" is invalid. Please select one.`);
    }

    return {
      title,
      description,
      priority: normalizedPriority,
      status: normalizedStatus,
      assigneeName,
      phaseName,
      startDate,
      endDate,
      effortHours,
      resolvedAssigneeId,
      resolvedPhaseId,
      errors,
      warnings,
    };
  });
}

export interface MSPDIResource {
  uid: string;
  name: string;
}

export interface MSPDITask {
  uid: string;
  name: string;
  start: string;
  finish: string;
  duration: string;
  priority: number;
  percentComplete: number;
  notes: string;
  isSummary: boolean;
  isMilestone: boolean;
  outlineLevel: number;
  resourceNames: string[];
}

function getChildText(element: Element, localName: string): string {
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i];
    if (child.localName.toLowerCase() === localName.toLowerCase()) {
      return child.textContent || "";
    }
  }
  return "";
}

function parseMSDurationToHours(duration: string): number {
  if (!duration) return 0;
  const daysMatch = duration.match(/(\d+)D/);
  const hoursMatch = duration.match(/(\d+)H/);
  const minutesMatch = duration.match(/(\d+)M/);
  const secondsMatch = duration.match(/(\d+)S/);

  let hours = 0;
  if (daysMatch) {
    hours += parseInt(daysMatch[1], 10) * 8; // 8 hours per working day
  }
  if (hoursMatch) {
    hours += parseInt(hoursMatch[1], 10);
  }
  if (minutesMatch) {
    hours += parseInt(minutesMatch[1], 10) / 60;
  }
  if (secondsMatch) {
    hours += parseInt(secondsMatch[1], 10) / 3600;
  }
  return parseFloat(hours.toFixed(2));
}

export function parseMSPDIXML(xmlText: string): { tasks: MSPDITask[]; resources: MSPDIResource[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  const resources: MSPDIResource[] = [];
  const resourceElements = doc.getElementsByTagNameNS ? doc.getElementsByTagNameNS("*", "Resource") : doc.getElementsByTagName("Resource");
  for (let i = 0; i < resourceElements.length; i++) {
    const el = resourceElements[i];
    const uid = getChildText(el, "UID");
    const name = getChildText(el, "Name");
    if (uid && name) {
      resources.push({ uid, name });
    }
  }

  const assignmentsMap: Record<string, string[]> = {};
  const assignmentElements = doc.getElementsByTagNameNS ? doc.getElementsByTagNameNS("*", "Assignment") : doc.getElementsByTagName("Assignment");
  for (let i = 0; i < assignmentElements.length; i++) {
    const el = assignmentElements[i];
    const taskUid = getChildText(el, "TaskUID");
    const resourceUid = getChildText(el, "ResourceUID");
    if (taskUid && resourceUid) {
      if (resourceUid !== "-1") {
        if (!assignmentsMap[taskUid]) {
          assignmentsMap[taskUid] = [];
        }
        assignmentsMap[taskUid].push(resourceUid);
      }
    }
  }

  const resourceLookup = new Map(resources.map((r) => [r.uid, r.name]));

  const tasks: MSPDITask[] = [];
  const taskElements = doc.getElementsByTagNameNS ? doc.getElementsByTagNameNS("*", "Task") : doc.getElementsByTagName("Task");
  for (let i = 0; i < taskElements.length; i++) {
    const el = taskElements[i];
    const uid = getChildText(el, "UID");
    if (uid === "0" || !uid) {
      continue;
    }

    const name = getChildText(el, "Name");
    const start = getChildText(el, "Start");
    const finish = getChildText(el, "Finish");
    const duration = getChildText(el, "Duration");
    const priorityVal = getChildText(el, "Priority");
    const priority = priorityVal ? parseInt(priorityVal, 10) : 500;
    const percentCompleteVal = getChildText(el, "PercentComplete");
    const percentComplete = percentCompleteVal ? parseInt(percentCompleteVal, 10) : 0;
    const notes = getChildText(el, "Notes");
    const summaryVal = getChildText(el, "Summary");
    const isSummary = summaryVal === "1" || summaryVal.toLowerCase() === "true";
    const milestoneVal = getChildText(el, "Milestone");
    const isMilestone = milestoneVal === "1" || milestoneVal.toLowerCase() === "true";
    const outlineLevelVal = getChildText(el, "OutlineLevel");
    const outlineLevel = outlineLevelVal ? parseInt(outlineLevelVal, 10) : 1;

    const assignedResourceUids = assignmentsMap[uid] || [];
    const resourceNames = assignedResourceUids
      .map((rUid) => resourceLookup.get(rUid))
      .filter((name): name is string => !!name);

    tasks.push({
      uid,
      name,
      start,
      finish,
      duration,
      priority,
      percentComplete,
      notes,
      isSummary,
      isMilestone,
      outlineLevel,
      resourceNames,
    });
  }

  return { tasks, resources };
}

export function processMSPDITasks(
  parsedData: { tasks: MSPDITask[]; resources: MSPDIResource[] },
  phases: ProjectPhase[],
  assignees: ProjectTaskAssignee[]
): ParsedTaskRow[] {
  const { tasks } = parsedData;
  if (tasks.length === 0) return [];

  const titleFrequency: Record<string, number> = {};
  for (const t of tasks) {
    const nameLower = (t.name || "").trim().toLowerCase();
    if (nameLower) {
      titleFrequency[nameLower] = (titleFrequency[nameLower] ?? 0) + 1;
    }
  }

  let currentLevel1TaskName = "";

  return tasks.map((t) => {
    const title = (t.name || "").trim();
    const description = (t.notes || "").trim();
    const assigneeName = t.resourceNames.length > 0 ? t.resourceNames[0] : "";

    if (t.outlineLevel === 1) {
      currentLevel1TaskName = title;
    }

    const phaseName = currentLevel1TaskName;

    const formatDate = (isoStr: string) => {
      if (!isoStr) return "";
      const idx = isoStr.indexOf("T");
      return idx !== -1 ? isoStr.substring(0, idx) : isoStr;
    };

    const startDate = formatDate(t.start);
    const endDate = formatDate(t.finish);

    const effortHours = parseMSDurationToHours(t.duration);

    let priority = "Medium";
    if (t.priority <= 200) {
      priority = "Low";
    } else if (t.priority <= 500) {
      priority = "Medium";
    } else if (t.priority <= 750) {
      priority = "High";
    } else {
      priority = "Critical";
    }

    let status = "To_Do";
    if (t.percentComplete === 100) {
      status = "Done";
    } else if (t.percentComplete > 0) {
      status = "In_Progress";
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!title) {
      errors.push("Task title is required.");
    }

    if (title && (titleFrequency[title.toLowerCase()] ?? 0) > 1) {
      errors.push(`Duplicate task title "${title}" found in this file.`);
    }

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

    if (isStartValid && isEndValid && startDate && endDate) {
      if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
        errors.push("End date must be on or after start date.");
      }
    }

    let resolvedAssigneeId: string | null = null;
    if (assigneeName) {
      const assignee = findProjectTaskAssignee(assigneeName, assignees);
      if (assignee) {
        resolvedAssigneeId = assignee.userId;
      } else {
        errors.push(
          `Assignee "${assigneeName}" is not on the project team. Add them to the team first.`,
        );
      }
    }

    let resolvedPhaseId: string | null = null;
    if (phaseName) {
      const phase = phases.find(
        (p) => p.name.toLowerCase() === phaseName.toLowerCase()
      );
      if (phase) {
        resolvedPhaseId = phase.id;
      } else {
        warnings.push(`Phase "${phaseName}" not found. Please select one.`);
      }
    }

    if (t.isSummary) {
      warnings.push("Summary/parent task: will be skipped upon import.");
    }

    if (t.isMilestone) {
      warnings.push("Milestone task: will import with Duration = 0.");
    }

    if (t.duration && isNaN(effortHours)) {
      warnings.push("Could not parse effort hours from duration.");
    }

    return {
      title,
      description,
      priority,
      status,
      assigneeName,
      phaseName,
      startDate,
      endDate,
      effortHours: isNaN(effortHours) ? 0 : effortHours,
      resolvedAssigneeId,
      resolvedPhaseId,
      errors,
      warnings,
      isSummary: t.isSummary,
      isMilestone: t.isMilestone,
    };
  });
}

