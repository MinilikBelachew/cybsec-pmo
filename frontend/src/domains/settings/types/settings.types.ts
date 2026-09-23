export type AuditSettings = {
  auditRetentionMonths: number;
  auditExportMaxRows: number;
  auditExportExcelJsonCellLimit: number;
  auditExportPdfJsonLimit: number;
  auditArchiveEnabled: boolean;
  lastAuditArchiveAt: string | null;
  lastAuditArchiveCount: number;
  updatedAt: string;
};

export type UpdateAuditSettingsPayload = {
  auditRetentionMonths?: number;
  auditExportMaxRows?: number;
  auditExportExcelJsonCellLimit?: number;
  auditExportPdfJsonLimit?: number;
  auditArchiveEnabled?: boolean;
};

export type SessionSecuritySettings = {
  idleTimeoutSec: number;
  warningBeforeSec: number;
  updatedAt: string;
};

export type UpdateSessionSecurityPayload = {
  idleTimeoutSec?: number;
  warningBeforeSec?: number;
};

export type TimesheetEscalationSettings = {
  escalationDays: number;
  updatedAt: string;
};

export type UpdateTimesheetEscalationPayload = {
  escalationDays?: number;
};

export type CostFormulaSettings = {
  basis: "ctc" | "gross";
  hoursPerWeek: number;
  weeksPerYear: number;
  otMultiplier: number;
  leaveMode: "ignore" | "exclude_unpaid" | "prorate";
  monthlyRemunerationType: number;
  version: number;
  approvedBy: string | null;
  approvedAt: string | null;
  updatedAt: string;
};

export type UpdateCostFormulaPayload = {
  basis?: "ctc" | "gross";
  hoursPerWeek?: number;
  weeksPerYear?: number;
  otMultiplier?: number;
  leaveMode?: "ignore" | "exclude_unpaid" | "prorate";
  monthlyRemunerationType?: number;
};

export type {
  AllocationPolicies,
  UpdateAllocationPoliciesPayload,
  DesignationRule,
  DepartmentStaffingRules,
  PolicyEnforcementMode,
} from "@/domains/resources/types/allocation-policy.types";
