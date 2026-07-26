export type UtilisationStatus = "over" | "optimal" | "under";

export type ReconcileStatus = "matched" | "pending" | "mismatch" | "unavailable";

export type ReconcileSource = "keka-live" | "local-push-ack";

export interface UtilisationReconcile {
  approvedHours: number;
  kekaSyncedHours: number;
  kekaRemoteHours: number;
  deltaHours: number;
  status: ReconcileStatus;
  source: ReconcileSource;
}

export interface UtilisationEmployeeRow {
  employeeId: string;
  userId: string | null;
  name: string;
  designation: string;
  departmentId: string;
  departmentName: string;
  plannedHours: number;
  submittedHours: number;
  approvedHours: number;
  billableHours: number;
  nonBillableHours: number;
  availableHours: number;
  billableUtilisationPercent: number;
  totalUtilisationPercent: number;
  status: UtilisationStatus;
  reconcile: UtilisationReconcile;
}

export interface UtilisationDepartmentBreakdown {
  departmentId: string;
  departmentName: string;
  plannedHours: number;
  submittedHours: number;
  approvedHours: number;
  billableHours: number;
  nonBillableHours: number;
  availableHours: number;
}

export interface UtilisationSummary {
  employeeCount: number;
  avgBillableUtilisation: number;
  totalPlannedHours: number;
  totalSubmittedHours: number;
  totalApprovedHours: number;
  totalBillableHours: number;
  totalNonBillableHours: number;
  totalAvailableHours: number;
  overCount: number;
  underCount: number;
}

export interface UtilisationReportResponse {
  startDate: string;
  endDate: string;
  formulaVersion: string;
  summary: UtilisationSummary;
  rows: UtilisationEmployeeRow[];
  departments: UtilisationDepartmentBreakdown[];
  page: number;
  limit: number;
  total: number;
  reconcileSource?: ReconcileSource;
}

export type UtilisationSortField = "name" | "billableUtilisation" | "approvedHours";

export type ReportType = "WSR" | "MSR";

export interface HealthRule {
  id: string;
  dimension: string;
  greenThreshold: number;
  amberThreshold: number;
  redThreshold: number | null;
  unit: string | null;
  version: string;
  isActive: boolean;
  updatedAt?: string;
}

export type UpdateHealthRule = Pick<
  HealthRule,
  "dimension" | "greenThreshold" | "amberThreshold"
> & { redThreshold?: number; unit?: string; isActive?: boolean };

export interface ProjectHealthReport {
  projectId: string;
  projectName: string;
  overallRag: string;
  dimensions: Array<{
    dimension: string;
    score: number;
    ragStatus: string;
    value: Record<string, unknown>;
    ruleVersion: string;
  }>;
  evaluatedAt: string;
  source: "live" | "snapshot";
}

export interface DataQualityFlag {
  id: string;
  flagType: string;
  objectType: string;
  objectId: string;
  projectId: string | null;
  severity: "low" | "medium" | "high" | "critical" | string;
  description: string;
  isResolved: boolean;
  flaggedAt: string;
  resolvedAt: string | null;
  project?: { id: string; name: string } | null;
}

export interface StatusReport {
  id: string;
  reportType: ReportType;
  projectId: string;
  status: "Draft" | "Approved" | string;
  dataSnapshot?: Record<string, unknown> | null;
  generatedAt: string;
  approvedAt?: string | null;
  project?: { id: string; name: string } | null;
}

export interface ReportSchedule {
  id: string;
  reportType: ReportType;
  cronExpression: string;
  projectId: string | null;
  isActive: boolean;
  lastRun: string | null;
  nextRun: string | null;
  lastError?: string | null;
  createdAt: string;
  project?: { id: string; name: string } | null;
}

export interface ReportScheduleInput {
  reportType: ReportType;
  cronExpression: string;
  projectId?: string | null;
  isActive: boolean;
}
