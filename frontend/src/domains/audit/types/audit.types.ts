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
