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
