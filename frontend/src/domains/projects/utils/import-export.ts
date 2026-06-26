import { Department, Customer, ProjectManager, CreateProjectDto } from "../types/projects.types";

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
    "Methodology",
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
      p.methodology,
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

export interface ParsedProjectRow {
  name: string;
  objective: string;
  departmentName: string;
  customerName: string;
  engagementType: string;
  methodology: string;
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
    const methodology = getVal(methIdx, "Agile");
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

    let normalizedMethodology = methodology;
    const lowerMethodology = methodology.toLowerCase().trim();
    if (["agile"].includes(lowerMethodology)) {
      normalizedMethodology = "Agile";
    } else if (["waterfall"].includes(lowerMethodology)) {
      normalizedMethodology = "Waterfall";
    } else if (["hybrid"].includes(lowerMethodology)) {
      normalizedMethodology = "Hybrid";
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
    if (!["Agile", "Waterfall", "Hybrid"].includes(normalizedMethodology)) {
      errors.push(`Methodology "${methodology}" is invalid. Please select one.`);
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
      methodology: normalizedMethodology,
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
