/**
 * Port of frontend Import Projects sheet processors
 * (processRawCSVRows / processRawPhaseRows / processRawMilestoneRows).
 */

export type CatalogDepartment = { id: string; name: string; code: string };
export type CatalogCustomer = { id: string; displayName: string };
export type CatalogManager = { id: string; displayName: string; email: string };
export type CatalogProject = { id: string; name: string };

export type ParsedProjectPreviewRow = {
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
  importMode: 'create' | 'update';
  resolvedProjectId?: string;
  resolvedDepartmentId?: string;
  resolvedCustomerId?: string;
  resolvedPrimaryPmId?: string;
  resolvedSecondaryPmId?: string | null;
  errors: string[];
  warnings: string[];
};

export type ParsedPhasePreviewRow = {
  name: string;
  description: string;
  orderIndex: number;
  status: string;
  startDate: string;
  endDate: string;
  importMode: 'create' | 'update';
  resolvedPhaseId?: string;
  errors: string[];
  warnings: string[];
};

export type ParsedMilestonePreviewRow = {
  title: string;
  targetDate: string;
  weight: number;
  status: string;
  phaseName: string;
  importMode: 'create' | 'update';
  resolvedMilestoneId?: string;
  errors: string[];
  warnings: string[];
};

export function processRawProjectRows(
  csvData: string[][],
  departments: CatalogDepartment[],
  customers: CatalogCustomer[],
  managers: CatalogManager[],
  existingProjects?: CatalogProject[],
): ParsedProjectPreviewRow[] {
  if (csvData.length <= 1) return [];

  const headers = csvData[0].map((h) => h.toLowerCase());
  const rows = csvData.slice(1);
  const getIndex = (aliases: string[]) =>
    headers.findIndex((h) => aliases.includes(h.trim()));

  const nameIdx = getIndex(['name', 'project name', 'title']);
  const objIdx = getIndex(['objective', 'description', 'details']);
  const deptIdx = getIndex(['department', 'dept']);
  const custIdx = getIndex(['customer', 'client']);
  const engIdx = getIndex(['engagement type', 'engagement']);
  const methIdx = getIndex(['methodology', 'method']);
  const billIdx = getIndex(['billing model', 'billing']);
  const prioIdx = getIndex(['priority', 'priority level']);
  const startIdx = getIndex(['start date', 'start']);
  const endIdx = getIndex(['end date', 'end']);
  const valIdx = getIndex(['value', 'budget', 'amount']);
  const curIdx = getIndex(['currency', 'currency code']);
  const pmIdx = getIndex(['primary pm', 'pm', 'project manager']);
  const pm2Idx = getIndex(['secondary pm', 'backup pm']);
  const statusIdx = getIndex(['status', 'project status']);

  const nameFrequency: Record<string, number> = {};
  for (const row of rows) {
    const n = (
      nameIdx !== -1 && row[nameIdx] ? row[nameIdx].trim() : ''
    ).toLowerCase();
    if (n) nameFrequency[n] = (nameFrequency[n] ?? 0) + 1;
  }
  const duplicateNames = new Set(
    Object.entries(nameFrequency)
      .filter(([, count]) => count > 1)
      .map(([name]) => name),
  );

  return rows.map((row) => {
    const getVal = (idx: number, fallback = '') =>
      idx !== -1 && row[idx] ? row[idx].trim() : fallback;

    const name = getVal(nameIdx);
    const objective = getVal(objIdx);
    const departmentName = getVal(deptIdx);
    const customerName = getVal(custIdx);
    const engagementType = getVal(engIdx, 'FixedPrice');
    getVal(methIdx);
    const billingModel = getVal(billIdx, 'FixedPrice');
    const priority = getVal(prioIdx, 'Medium');
    const startDate = getVal(startIdx);
    const endDate = getVal(endIdx);
    const rawValue = getVal(valIdx, '');
    const currency = getVal(curIdx, 'USD');
    const primaryPmName = getVal(pmIdx);
    const secondaryPmName = getVal(pm2Idx);
    const status = getVal(statusIdx, 'Draft');

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!name) errors.push('Project name is required.');
    if (!objective) errors.push('Objective is required.');
    if (name && duplicateNames.has(name.trim().toLowerCase())) {
      errors.push(`Duplicate project name "${name}" found in this file.`);
    }

    let isStartValid = false;
    if (startDate) {
      if (!Number.isNaN(Date.parse(startDate))) isStartValid = true;
      else errors.push('Start date must be a valid date (YYYY-MM-DD).');
    } else {
      errors.push('Start date is required.');
    }

    let isEndValid = false;
    if (endDate) {
      if (!Number.isNaN(Date.parse(endDate))) isEndValid = true;
      else errors.push('End date must be a valid date (YYYY-MM-DD).');
    } else {
      errors.push('End date is required.');
    }

    if (isStartValid && isEndValid) {
      if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
        errors.push('End date must be on or after start date.');
      }
    }

    let value = parseFloat(rawValue.replace(/[^0-9.-]/g, ''));
    if (rawValue.trim() && Number.isNaN(value)) {
      errors.push('Invalid value/budget amount.');
      value = 1;
    } else if (!rawValue.trim() || Number.isNaN(value) || value <= 0) {
      warnings.push('Value/budget missing or zero; defaulted to 1.');
      value = 1;
    }

    let resolvedDepartmentId = '';
    if (departmentName) {
      const dept = departments.find(
        (d) =>
          d.name.toLowerCase() === departmentName.toLowerCase() ||
          d.code.toLowerCase() === departmentName.toLowerCase(),
      );
      if (dept) resolvedDepartmentId = dept.id;
      else
        errors.push(
          `Department "${departmentName}" not found. Please select one.`,
        );
    } else {
      errors.push('Department is required.');
    }

    let resolvedCustomerId = '';
    if (customerName) {
      const cust = customers.find(
        (c) => c.displayName.toLowerCase() === customerName.toLowerCase(),
      );
      if (cust) resolvedCustomerId = cust.id;
      else
        errors.push(`Customer "${customerName}" not found. Please select one.`);
    } else {
      errors.push('Customer is required.');
    }

    let resolvedPrimaryPmId = '';
    if (primaryPmName) {
      const pm = managers.find(
        (m) =>
          m.displayName.toLowerCase() === primaryPmName.toLowerCase() ||
          m.email.toLowerCase() === primaryPmName.toLowerCase(),
      );
      if (pm) resolvedPrimaryPmId = pm.id;
      else
        errors.push(
          `Primary PM "${primaryPmName}" not found. Please select one.`,
        );
    } else {
      errors.push('Primary PM is required.');
    }

    let resolvedSecondaryPmId: string | null = null;
    if (secondaryPmName) {
      const pm = managers.find(
        (m) =>
          m.displayName.toLowerCase() === secondaryPmName.toLowerCase() ||
          m.email.toLowerCase() === secondaryPmName.toLowerCase(),
      );
      if (pm) resolvedSecondaryPmId = pm.id;
      else warnings.push(`Secondary PM "${secondaryPmName}" not found.`);
    }

    const normalizedEngagement = normalizeEngagement(engagementType);
    const normalizedBilling = normalizeBilling(billingModel);
    const normalizedPriority = normalizePriority(priority);
    const normalizedStatus = normalizeProjectStatus(status);
    const normalizedCurrency = normalizeCurrency(currency);

    if (
      !['ManagedServices', 'StaffAugmentation', 'FixedPrice'].includes(
        normalizedEngagement,
      )
    ) {
      errors.push(
        `Engagement Type "${engagementType}" is invalid. Please select one.`,
      );
    }
    if (
      !['TimeAndMaterial', 'FixedPrice', 'Retainer'].includes(normalizedBilling)
    ) {
      errors.push(
        `Billing Model "${billingModel}" is invalid. Please select one.`,
      );
    }
    if (!['Low', 'Medium', 'High', 'Critical'].includes(normalizedPriority)) {
      errors.push(`Priority "${priority}" is invalid. Please select one.`);
    }
    if (!['USD', 'EUR', 'AED', 'SAR'].includes(normalizedCurrency)) {
      errors.push(`Currency "${currency}" is invalid. Please select one.`);
    }
    if (
      ![
        'Draft',
        'Active',
        'OnHold',
        'AtRisk',
        'PendingClosure',
        'Closed',
        'Cancelled',
      ].includes(normalizedStatus)
    ) {
      errors.push(`Status "${status}" is invalid. Please select one.`);
    }

    const { importMode, resolvedProjectId } = resolveProjectImportMatch(
      name,
      existingProjects,
    );

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

export function processRawPhaseRows(
  rows: string[][],
  existingPhases?: { id: string; name: string }[],
): ParsedPhasePreviewRow[] {
  if (rows.length <= 1) return [];

  const headers = rows[0].map((h) => String(h).toLowerCase().trim());
  const dataRows = rows.slice(1);
  const getIdx = (aliases: string[]) =>
    headers.findIndex((h) => aliases.includes(h));

  const nameIdx = getIdx(['name', 'phase name', 'phase']);
  const descIdx = getIdx(['description', 'desc', 'details']);
  const orderIdx = getIdx(['order', 'order index', 'orderindex', 'sequence']);
  const statusIdx = getIdx(['status', 'phase status']);
  const startIdx = getIdx(['start date', 'start']);
  const endIdx = getIdx(['end date', 'end']);

  return dataRows.map((row, i) => {
    const getVal = (idx: number, fallback = '') =>
      idx !== -1 && row[idx] ? String(row[idx]).trim() : fallback;

    const name = getVal(nameIdx);
    const description = getVal(descIdx);
    const orderIndex = parseInt(getVal(orderIdx, String(i + 1)), 10) || i + 1;
    const status = normalizePhaseStatus(getVal(statusIdx, 'Planned'));
    const startDate = getVal(startIdx);
    const endDate = getVal(endIdx);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!name) errors.push('Phase name is required.');
    if (startDate && Number.isNaN(Date.parse(startDate))) {
      errors.push('Start date must be a valid date (YYYY-MM-DD).');
    }
    if (endDate && Number.isNaN(Date.parse(endDate))) {
      errors.push('End date must be a valid date (YYYY-MM-DD).');
    }
    if (
      startDate &&
      endDate &&
      !Number.isNaN(Date.parse(startDate)) &&
      !Number.isNaN(Date.parse(endDate)) &&
      new Date(startDate) > new Date(endDate)
    ) {
      errors.push('End date must be on or after start date.');
    }

    const { importMode, resolvedPhaseId } = resolvePhaseImportMatch(
      name,
      existingPhases,
    );

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

export function processRawMilestoneRows(
  rows: string[][],
  existingMilestones?: { id: string; title: string }[],
): ParsedMilestonePreviewRow[] {
  if (rows.length <= 1) return [];

  const headers = rows[0].map((h) => String(h).toLowerCase().trim());
  const dataRows = rows.slice(1);
  const getIdx = (aliases: string[]) =>
    headers.findIndex((h) => aliases.includes(h));

  const titleIdx = getIdx(['title', 'milestone', 'milestone name']);
  const targetDateIdx = getIdx(['target date', 'due date', 'date']);
  const weightIdx = getIdx(['weight', 'weight (%)', 'percent']);
  const statusIdx = getIdx(['status', 'milestone status']);
  const phaseIdx = getIdx(['phase', 'phase name']);

  return dataRows.map((row) => {
    const getVal = (idx: number, fallback = '') =>
      idx !== -1 && row[idx] ? String(row[idx]).trim() : fallback;

    const title = getVal(titleIdx);
    const targetDate = getVal(targetDateIdx);
    const weight =
      parseFloat(getVal(weightIdx, '0').replace(/[^0-9.-]/g, '')) || 0;
    const status = normalizeMilestoneStatus(getVal(statusIdx, 'Pending'));
    const phaseName = getVal(phaseIdx);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!title) errors.push('Milestone title is required.');
    if (!targetDate) {
      errors.push('Target date is required.');
    } else if (Number.isNaN(Date.parse(targetDate))) {
      errors.push('Target date must be a valid date (YYYY-MM-DD).');
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

function resolveProjectImportMatch(
  name: string,
  existingProjects?: CatalogProject[],
): { importMode: 'create' | 'update'; resolvedProjectId?: string } {
  const lower = name.trim().toLowerCase();
  if (!lower || !existingProjects?.length) return { importMode: 'create' };
  const match = existingProjects.find(
    (p) => p.name.trim().toLowerCase() === lower,
  );
  return match
    ? { importMode: 'update', resolvedProjectId: match.id }
    : { importMode: 'create' };
}

function resolvePhaseImportMatch(
  name: string,
  existingPhases?: { id: string; name: string }[],
): { importMode: 'create' | 'update'; resolvedPhaseId?: string } {
  const lower = name.trim().toLowerCase();
  if (!lower || !existingPhases?.length) return { importMode: 'create' };
  const match = existingPhases.find(
    (p) => p.name.trim().toLowerCase() === lower,
  );
  return match
    ? { importMode: 'update', resolvedPhaseId: match.id }
    : { importMode: 'create' };
}

function resolveMilestoneImportMatch(
  title: string,
  existingMilestones?: { id: string; title: string }[],
): { importMode: 'create' | 'update'; resolvedMilestoneId?: string } {
  const lower = title.trim().toLowerCase();
  if (!lower || !existingMilestones?.length) return { importMode: 'create' };
  const match = existingMilestones.find(
    (m) => m.title.trim().toLowerCase() === lower,
  );
  return match
    ? { importMode: 'update', resolvedMilestoneId: match.id }
    : { importMode: 'create' };
}

function normalizeEngagement(engagementType: string): string {
  const lower = engagementType.toLowerCase().trim();
  if (
    ['staff augmentation', 'staff_augmentation', 'staffaugmentation'].includes(
      lower,
    )
  ) {
    return 'StaffAugmentation';
  }
  if (
    [
      'milestone based',
      'milestone_based',
      'milestonebased',
      'time and materials',
      'time_and_materials',
      'timeandmaterials',
      'time and material',
      'time_and_material',
      'timeandmaterial',
      't&m',
      'retainer',
      'fixed price',
      'fixed_price',
      'fixedprice',
      'fixed',
      'implementation',
    ].includes(lower)
  ) {
    return 'FixedPrice';
  }
  if (
    [
      'managed services',
      'managed_services',
      'managedservices',
      'managed service',
      'managed_service',
      'managedservice',
      'advisory',
      'assessment',
      'training',
    ].includes(lower)
  ) {
    return 'ManagedServices';
  }
  return engagementType;
}

function normalizeBilling(billingModel: string): string {
  const lower = billingModel.toLowerCase().trim();
  if (['fixed price', 'fixed_price', 'fixedprice', 'fixed'].includes(lower)) {
    return 'FixedPrice';
  }
  if (
    [
      'time and materials',
      'time_and_materials',
      'timeandmaterials',
      'time and material',
      'time_and_material',
      'timeandmaterial',
      't&m',
      'time & materials',
    ].includes(lower)
  ) {
    return 'TimeAndMaterial';
  }
  if (
    ['milestone', 'milestone based', 'milestone_based', 'milestonebased'].includes(
      lower,
    )
  ) {
    return 'FixedPrice';
  }
  if (['retainer'].includes(lower)) return 'Retainer';
  return billingModel;
}

function normalizePriority(priority: string): string {
  const lower = priority.toLowerCase().trim();
  if (lower === 'critical') return 'Critical';
  if (lower === 'high') return 'High';
  if (lower === 'medium') return 'Medium';
  if (lower === 'low') return 'Low';
  return priority;
}

function normalizeProjectStatus(status: string): string {
  const lower = status.toLowerCase().trim();
  if (lower === 'active') return 'Active';
  if (['pending closure', 'pending_closure', 'pendingclosure'].includes(lower)) {
    return 'PendingClosure';
  }
  if (['at risk', 'atrisk', 'at_risk'].includes(lower)) return 'AtRisk';
  if (['on hold', 'on_hold', 'onhold'].includes(lower)) return 'OnHold';
  if (['closed', 'completed'].includes(lower)) return 'Closed';
  if (['cancelled', 'canceled'].includes(lower)) return 'Cancelled';
  if (['planned', 'draft'].includes(lower)) return 'Draft';
  return status;
}

function normalizeCurrency(currency: string): string {
  const lower = currency.toLowerCase().trim();
  if (lower === 'usd') return 'USD';
  if (lower === 'eur') return 'EUR';
  if (lower === 'aed') return 'AED';
  if (lower === 'sar') return 'SAR';
  return currency;
}

function normalizePhaseStatus(raw: string): string {
  const s = raw.toLowerCase().trim().replace(/[\s-]/g, '_');
  if (s === 'active') return 'Active';
  if (['completed', 'done', 'closed'].includes(s)) return 'Completed';
  if (['on_hold', 'onhold'].includes(s)) return 'On_Hold';
  return 'Planned';
}

function normalizeMilestoneStatus(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (['completed', 'done', 'achieved'].includes(s)) return 'Completed';
  if (['missed', 'failed', 'overdue'].includes(s)) return 'Missed';
  return 'Pending';
}
