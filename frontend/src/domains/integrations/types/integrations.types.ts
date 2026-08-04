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
  failureClass: "transient" | "permanent" | string;
  deadLetteredAt: string | null;
  isDeadLetter: boolean;
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
  disposition?: "all" | "pending" | "dead_letter";
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

export type KekaSyncJobStatus =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "paused"
  | "unknown";

export type KekaSyncJobStatusResponse = {
  jobId: string;
  status: KekaSyncJobStatus;
  progress: number;
  step: string | null;
  result: { synced: number; failed: number } | null;
  failedReason: string | null;
};

export type KekaConnectionResponse = {
  companySubdomain: string | null;
  sandbox: boolean;
  authUrl: string | null;
  apiBaseUrl: string | null;
  clientIdMasked: string | null;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasApiKey: boolean;
  source: "database" | "env" | "mixed";
  configured: boolean;
  lastTestedAt: string | null;
  lastTestStatus: "ok" | "failed" | null;
  lastTestError: string | null;
  updatedAt: string | null;
  effectiveAuthUrl: string;
  effectiveApiBaseUrl: string;
};

export type KekaConnectionSecrets = {
  clientId: string | null;
  clientSecret: string | null;
  apiKey: string | null;
};

export type UpdateKekaConnectionBody = {
  companySubdomain?: string;
  sandbox?: boolean;
  authUrl?: string | null;
  apiBaseUrl?: string | null;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
};

export type KekaConnectionTestResult = {
  success: boolean;
  message: string;
  testedAt: string;
};
