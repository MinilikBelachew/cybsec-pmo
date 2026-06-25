import { api } from "@/core/api/api";

export type AuditLogEntry = {
  id: string;
  actorId: string | null;
  action: string;
  objectType: string;
  objectId: string | null;
  breakGlassAction: boolean;
  ipAddress: string | null;
  createdAt: string;
  user?: {
    id: string;
    displayName: string;
    email: string;
    roleCode: string;
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

export type AuditLogsQuery = {
  page?: number;
  limit?: number;
  breakGlassOnly?: boolean;
  action?: string;
  objectType?: string;
  search?: string;
  sortBy?: AuditSortField;
  sortOrder?: "asc" | "desc";
};

function buildAuditParams(params: AuditLogsQuery) {
  const query: Record<string, string | number | boolean> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };

  if (params.breakGlassOnly) query.breakGlassOnly = true;
  if (params.action) query.action = params.action;
  if (params.objectType) query.objectType = params.objectType;
  if (params.search?.trim()) query.search = params.search.trim();
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;

  return query;
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
  }),
});

export const { useGetAuditEventsQuery } = auditApi;
