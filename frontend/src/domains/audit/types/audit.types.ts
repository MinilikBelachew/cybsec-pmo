export type AuditJsonValue =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

export type AuditLogEntry = {
  id: string;
  actorId: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  description?: string | null;
  oldValue: AuditJsonValue;
  newValue: AuditJsonValue;
  source: string | null;
  breakGlassAction: boolean;
  isExternal: boolean;
  ipAddress: string | null;
  createdAt: string;
  user?: {
    id: string;
    displayName: string;
    email: string;
    roleCode?: string;
    role?: { code: string };
  } | null;
};

export type AuditLogsResponse = {
  data: AuditLogEntry[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

export type AuditSortField = "createdAt" | "action" | "objectType" | "breakGlassAction";

export type AuditExportFormat = "json" | "csv" | "xlsx" | "pdf";

export type AuditLogsQuery = {
  page?: number;
  limit?: number;
  eventId?: string;
  eventIds?: string[];
  breakGlassOnly?: boolean;
  externalOnly?: boolean;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  action?: string;
  objectType?: string;
  search?: string;
  sortBy?: AuditSortField;
  sortOrder?: "asc" | "desc";
};

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
