export type KekaSyncLogEntry = {
  id: string;
  entityType: string;
  entityId: string;
  direction: string;
  status: string;
  errorMsg: string | null;
  retryCount: number;
  createdAt: string;
};

export type KekaSyncLogsResponse = {
  data: KekaSyncLogEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type KekaSyncLogsQuery = {
  page?: number;
  limit?: number;
  status?: string;
  entityType?: string;
  direction?: "inbound" | "outbound";
  search?: string;
};

export type FailedSyncRecordEntry = {
  id: string;
  integration: string;
  entityType: string;
  entityId: string | null;
  direction: string;
  errorMsg: string;
  retryCount: number;
  isResolved: boolean;
  resolvedByName: string | null;
  resolvedAt: string | null;
  lastAttempted: string;
  createdAt: string;
};

export type FailedSyncRecordsResponse = {
  data: FailedSyncRecordEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unresolvedCount: number;
};

export type FailedSyncRecordsQuery = {
  page?: number;
  limit?: number;
  integration?: string;
  entityType?: string;
  isResolved?: boolean;
  search?: string;
};

export type RetryKekaSyncResult = {
  success: boolean;
  message: string | null;
  ref: string | null;
};

export type KekaEntitySyncStatus = {
  key: string;
  label: string;
  entityTypes: string[];
  lastSuccessfulAt: string | null;
  lastFailedAt: string | null;
  lastRunAt: string | null;
  lastRunSucceeded: number;
  lastRunFailed: number;
  unresolvedFailures: number;
  linkedRecordCount: number;
};

export type KekaSyncStatusResponse = {
  lastSuccessfulAt: string | null;
  lastFailedAt: string | null;
  unresolvedFailures: number;
  entities: KekaEntitySyncStatus[];
};

export type TimesheetReconcileMismatch = {
  employeeId: string;
  name: string;
  departmentName: string;
  kekaEmployeeId: string | null;
  localApprovedHours: number;
  kekaRemoteHours: number;
  kekaSyncedHours: number;
  deltaHours: number;
  status: "matched" | "pending" | "mismatch" | "unavailable";
};

export type TimesheetReconcileResponse = {
  startDate: string;
  endDate: string;
  source: "keka-live" | "local-push-ack";
  pulledEntryCount: number;
  matchedCount: number;
  pendingCount: number;
  mismatchCount: number;
  unavailableCount: number;
  notifiedAdminCount: number;
  mismatches: TimesheetReconcileMismatch[];
};
