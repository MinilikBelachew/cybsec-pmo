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

export type {
  AllocationPolicies,
  UpdateAllocationPoliciesPayload,
  DesignationRule,
  DepartmentStaffingRules,
  PolicyEnforcementMode,
} from "@/domains/resources/types/allocation-policy.types";
