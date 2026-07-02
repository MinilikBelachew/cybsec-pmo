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
  assignees: ProjectTaskAssignee[]
): ParsedTaskRow[] {
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
        errors: [],
        warnings: [],
      },
      phases,
      assignees,
      duplicateTitles,
    );
  });
}

