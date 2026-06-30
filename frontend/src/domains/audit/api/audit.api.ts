import { api } from "@/core/api/api";

export type AuditJsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

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

export type AuditExportFormat = "json" | "xlsx" | "pdf";

export type AuditLogsQuery = {
  page?: number;
  limit?: number;
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

function buildAuditFilterParams(
  params: AuditLogsQuery,
): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};

  if (params.breakGlassOnly) query.breakGlassOnly = true;
  if (params.externalOnly) query.externalOnly = true;
  if (params.actorId) query.actorId = params.actorId;
  if (params.dateFrom) query.dateFrom = params.dateFrom;
  if (params.dateTo) query.dateTo = params.dateTo;
  if (params.action) query.action = params.action;
  if (params.objectType) query.objectType = params.objectType;
  if (params.search?.trim()) {
    query.search = params.search.trim().slice(0, 200);
  }
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;

  return query;
}

function buildAuditParams(params: AuditLogsQuery) {
  return {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    ...buildAuditFilterParams(params),
  };
}

export const auditApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAuditEvents: builder.query<AuditLogsResponse, AuditLogsQuery>({
      query: (params) => ({
        url: "/audit/events",
        params: buildAuditParams(params),
      }),
      serializeQueryArgs: ({ queryArgs }) => JSON.stringify(queryArgs),
      providesTags: ["Audit"],
    }),

    exportAuditEvents: builder.query<AuditLogEntry[], AuditLogsQuery>({
      query: (params) => ({
        url: "/audit/export",
        params: { ...buildAuditFilterParams(params), format: "json" },
      }),
    }),

    exportAuditFile: builder.query<
      Blob,
      { params: AuditLogsQuery; format: AuditExportFormat }
    >({
      query: ({ params, format }) => ({
        url: "/audit/export",
        params: { ...buildAuditFilterParams(params), format },
        responseHandler: async (response) => response.blob(),
      }),
    }),
  }),
});

export const {
  useGetAuditEventsQuery,
  useLazyExportAuditEventsQuery,
  useLazyExportAuditFileQuery,
} = auditApi;

export function downloadAuditBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadAuditJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
