import { HttpStatus, UnprocessableEntityException } from '@nestjs/common';
import {
  AllocationRuntimePolicies,
  DepartmentStaffingRules,
  DesignationRule,
  PolicyEnforcementMode,
} from '../allocation-policy.types';

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

export function parseDesignationRules(value: unknown): DesignationRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
    .map((row) => ({
      projectRole: String(row.projectRole ?? '').trim(),
      allowedDesignations: Array.isArray(row.allowedDesignations)
        ? row.allowedDesignations
            .map((item) => String(item).trim())
            .filter(Boolean)
        : [],
    }))
    .filter((row) => row.projectRole.length > 0 && row.allowedDesignations.length > 0);
}

export function parseDepartmentStaffingRules(value: unknown): DepartmentStaffingRules {
  if (value == null || typeof value !== 'object') {
    return { rule: 'same_department_only' };
  }

  const row = value as Record<string, unknown>;
  const rule =
    row.rule === 'allow_list' ? 'allow_list' : 'same_department_only';

  const byProjectDepartmentCode: Record<string, string[]> = {};
  if (row.byProjectDepartmentCode && typeof row.byProjectDepartmentCode === 'object') {
    for (const [key, codes] of Object.entries(
      row.byProjectDepartmentCode as Record<string, unknown>,
    )) {
      if (!Array.isArray(codes)) {
        continue;
      }
      byProjectDepartmentCode[key.trim().toUpperCase()] = codes
        .map((code) => String(code).trim().toUpperCase())
        .filter(Boolean);
    }
  }

  return {
    rule,
    ...(Object.keys(byProjectDepartmentCode).length > 0
      ? { byProjectDepartmentCode }
      : {}),
  };
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

  if (rules.rule === 'same_department_only') {
    return projectCode === employeeCode;
  }

  const allowed =
    rules.byProjectDepartmentCode?.[projectCode] ?? [projectCode];
  return allowed.some((code) => code.toUpperCase() === employeeCode);
}

export function buildDesignationMismatchMessage(
  employeeName: string,
  projectRole: string,
  employeeDesignation: string,
  rules: DesignationRule[] = [],
): string {
  const rule = rules.find(
    (row) => normalizeToken(row.projectRole) === normalizeToken(projectRole),
  );

  if (rule) {
    const allowed = rule.allowedDesignations.join(', ');
    return `${employeeName} has designation "${employeeDesignation}" which is not allowed for project role "${projectRole}". Allowed designations: ${allowed}.`;
  }

  return `${employeeName} is designated as "${employeeDesignation}" but assigned project role "${projectRole}".`;
}

export function buildDepartmentStaffingMessage(
  employeeName: string,
  employeeDepartmentCode: string,
  projectDepartmentCode: string,
): string {
  return `${employeeName} belongs to ${employeeDepartmentCode} but this project is owned by ${projectDepartmentCode}.`;
}

export function applyPolicyViolation(
  mode: PolicyEnforcementMode,
  message: string,
  warnings: string[],
  errorField = 'allocation',
): void {
  if (mode === 'off') {
    return;
  }

  if (mode === 'block') {
    throw new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { [errorField]: message },
    });
  }

  warnings.push(message);
}

export function evaluateStaffingPolicies(params: {
  policies: AllocationRuntimePolicies;
  projectRole: string;
  employeeName: string;
  employeeDesignation: string;
  employeeDepartmentCode: string;
  projectDepartmentCode: string;
  warnings: string[];
}): {
  designationMismatch: boolean;
  departmentStaffingMismatch: boolean;
} {
  const designationMismatch = !isDesignationAllowed(
    params.projectRole,
    params.employeeDesignation,
    params.policies.designationRules,
  );

  if (designationMismatch) {
    applyPolicyViolation(
      params.policies.designationMismatchMode,
      buildDesignationMismatchMessage(
        params.employeeName,
        params.projectRole,
        params.employeeDesignation,
        params.policies.designationRules,
      ),
      params.warnings,
    );
  }

  const departmentStaffingMismatch =
    params.policies.departmentStaffingMode !== 'off' &&
    !isDepartmentStaffingAllowed(
      params.projectDepartmentCode,
      params.employeeDepartmentCode,
      params.policies.departmentStaffingRules,
    );

  if (departmentStaffingMismatch) {
    applyPolicyViolation(
      params.policies.departmentStaffingMode,
      buildDepartmentStaffingMessage(
        params.employeeName,
        params.employeeDepartmentCode,
        params.projectDepartmentCode,
      ),
      params.warnings,
    );
  }

  return { designationMismatch, departmentStaffingMismatch };
}

export function previewDepartmentStaffingAllowed(
  policies: AllocationRuntimePolicies,
  projectDepartmentCode: string,
  employeeDepartmentCode: string,
): boolean {
  if (policies.departmentStaffingMode === 'off') {
    return true;
  }

  return isDepartmentStaffingAllowed(
    projectDepartmentCode,
    employeeDepartmentCode,
    policies.departmentStaffingRules,
  );
}

export function previewDesignationMismatch(
  policies: AllocationRuntimePolicies,
  projectRole: string,
  employeeDesignation: string,
): boolean {
  if (policies.designationMismatchMode === 'off') {
    return false;
  }

  return !isDesignationAllowed(
    projectRole,
    employeeDesignation,
    policies.designationRules,
  );
}
