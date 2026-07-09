export type PolicyEnforcementMode = 'off' | 'warn' | 'block';

export type ThresholdMode = 'warn' | 'block' | 'approve';

export type DesignationRule = {
  projectRole: string;
  allowedDesignations: string[];
};

export type DepartmentStaffingRuleType = 'same_department_only' | 'allow_list';

export type DepartmentStaffingRules = {
  rule: DepartmentStaffingRuleType;
  byProjectDepartmentCode?: Record<string, string[]>;
};

export type AllocationRuntimePolicies = {
  thresholdMode: ThresholdMode;
  designationMismatchMode: PolicyEnforcementMode;
  departmentStaffingMode: PolicyEnforcementMode;
  designationRules: DesignationRule[];
  departmentStaffingRules: DepartmentStaffingRules;
  updatedAt: Date;
};
