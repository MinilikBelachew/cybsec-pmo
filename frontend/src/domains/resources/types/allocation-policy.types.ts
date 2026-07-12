export type PolicyEnforcementMode = "off" | "warn" | "block";

export type ThresholdMode = "warn" | "block" | "approve";

export type DepartmentStaffingRuleType = "same_department_only" | "allow_list";

export interface DesignationRule {
  projectRole: string;
  allowedDesignations: string[];
}

export interface DepartmentStaffingRules {
  rule: DepartmentStaffingRuleType;
  byProjectDepartmentCode?: Record<string, string[]>;
}

export interface AllocationPolicies {
  thresholdMode: ThresholdMode;
  designationMismatchMode: PolicyEnforcementMode;
  departmentStaffingMode: PolicyEnforcementMode;
  designationRules: DesignationRule[];
  departmentStaffingRules: DepartmentStaffingRules;
  updatedAt?: string;
}

export type UpdateAllocationPoliciesPayload = Partial<
  Omit<AllocationPolicies, "updatedAt">
>;
