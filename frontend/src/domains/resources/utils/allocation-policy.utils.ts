import type {
  AllocationPolicies,
  DepartmentStaffingRules,
  DesignationRule,
  PolicyEnforcementMode,
} from "../types/allocation-policy.types";

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

export function isDesignationAllowed(
  projectRole: string,
  employeeDesignation: string,
  rules: DesignationRule[],
): boolean {
  const roleNorm = normalizeToken(projectRole);
  const designationNorm = normalizeToken(employeeDesignation);

  if (!roleNorm || !designationNorm) {
    return false;
  }

  const rule = rules.find(
    (row) => normalizeToken(row.projectRole) === roleNorm,
  );

  if (rule) {
    return rule.allowedDesignations.some(
      (designation) => normalizeToken(designation) === designationNorm,
    );
  }

  return roleNorm === designationNorm;
}

export function isDepartmentStaffingAllowed(
  projectDepartmentCode: string,
  employeeDepartmentCode: string,
  rules: DepartmentStaffingRules,
): boolean {
  const projectCode = projectDepartmentCode.trim().toUpperCase();
  const employeeCode = employeeDepartmentCode.trim().toUpperCase();

  if (!projectCode || !employeeCode) {
    return true;
  }

  if (rules.rule === "same_department_only") {
    return projectCode === employeeCode;
  }

  const allowed = getAllowedEmployeeDepartmentCodes(projectCode, rules);
  return allowed.some((code) => code === employeeCode);
}

/** Employee department codes allowed to staff a project department under the current rules. */
export function getAllowedEmployeeDepartmentCodes(
  projectDepartmentCode: string,
  rules: DepartmentStaffingRules,
): string[] {
  const projectCode = projectDepartmentCode.trim().toUpperCase();
  if (!projectCode) {
    return [];
  }

  if (rules.rule === "same_department_only") {
    return [projectCode];
  }

  const listed = rules.byProjectDepartmentCode?.[projectCode] ?? [];
  return [
    ...new Set(
      [projectCode, ...listed]
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

export function hasDesignationMismatch(
  policies: AllocationPolicies,
  projectRole: string,
  employeeDesignation: string,
): boolean {
  if (policies.designationMismatchMode === "off") {
    return false;
  }

  return !isDesignationAllowed(
    projectRole,
    employeeDesignation,
    policies.designationRules,
  );
}

export function getDesignationMismatchMessage(
  policies: AllocationPolicies,
  employeeName: string,
  projectRole: string,
  employeeDesignation: string,
): string | null {
  if (policies.designationMismatchMode === "off") {
    return null;
  }

  if (
    isDesignationAllowed(
      projectRole,
      employeeDesignation,
      policies.designationRules,
    )
  ) {
    return null;
  }

  const rule = policies.designationRules.find(
    (row) => normalizeToken(row.projectRole) === normalizeToken(projectRole),
  );

  if (rule) {
    const allowed = rule.allowedDesignations.join(", ");
    return `${employeeName} has designation "${employeeDesignation}" which is not allowed for project role "${projectRole}". Allowed: ${allowed}.`;
  }

  return `${employeeName} is designated as "${employeeDesignation}" but assigned project role "${projectRole}".`;
}

export function hasDepartmentStaffingMismatch(
  policies: AllocationPolicies,
  projectDepartmentCode: string | undefined,
  employeeDepartmentCode: string,
): boolean {
  if (
    policies.departmentStaffingMode === "off" ||
    !projectDepartmentCode?.trim()
  ) {
    return false;
  }

  return !isDepartmentStaffingAllowed(
    projectDepartmentCode,
    employeeDepartmentCode,
    policies.departmentStaffingRules,
  );
}

export function isPolicyBlocked(
  mode: PolicyEnforcementMode,
  violated: boolean,
): boolean {
  return mode === "block" && violated;
}
