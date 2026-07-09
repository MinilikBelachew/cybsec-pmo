import { api } from "@/core/api/api";

export type {
  AuditJsonValue,
  AuditLogEntry,
  AuditLogsResponse,
  AuditSortField,
  AuditExportFormat,
  AuditLogsQuery,
} from "../types/audit.types";

import type {
  AuditLogEntry,
  AuditLogsResponse,
  AuditExportFormat,
  AuditLogsQuery,
  KekaSyncLogsResponse,
  KekaSyncLogsQuery,
  FailedSyncRecordsResponse,
  FailedSyncRecordsQuery,
  RetryKekaSyncResult,
} from "../types/audit.types";

function buildAuditFilterParams(
  params: AuditLogsQuery,
): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};

  if (params.breakGlassOnly) query.breakGlassOnly = true;
  if (params.externalOnly) query.externalOnly = true;
  if (params.eventId) query.eventId = params.eventId;
  if (params.eventIds?.length) query.eventIds = params.eventIds.join(",");
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

    exportAuditEventFile: builder.mutation<
      Blob,
      { eventId: string; format: Exclude<AuditExportFormat, "csv"> }
    >({
      query: ({ eventId, format }) => ({
        url: `/audit/events/${eventId}/export`,
        params: { format },
        responseHandler: async (response) => response.blob(),
      }),
    }),

    getKekaSyncLogs: builder.query<KekaSyncLogsResponse, KekaSyncLogsQuery>({
      query: (params) => ({
        url: "/audit/integrations/keka/sync-logs",
        params,
      }),
      providesTags: ["KekaSyncLogs"],
    }),

    getFailedSyncRecords: builder.query<
      FailedSyncRecordsResponse,
      FailedSyncRecordsQuery
    >({
      query: (params) => ({
        url: "/audit/integrations/keka/failed-syncs",
        params,
      }),
      providesTags: ["FailedSyncRecords"],
    }),

    retryKekaSync: builder.mutation<
      RetryKekaSyncResult,
      { failedSyncRecordId?: string; entityType?: string; entityId?: string }
    >({
      query: (body) => ({
        url: "/audit/integrations/keka/retry",
        method: "POST",
        body,
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords", "TimesheetApprovals"],
    }),

    triggerKekaEmployeeSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/employees",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords"],
    }),

    triggerKekaLeaveSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/leave",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords"],
    }),
  }),
});

export const {
  useGetAuditEventsQuery,
  useLazyExportAuditEventsQuery,
  useLazyExportAuditFileQuery,
  useExportAuditEventFileMutation,
  useGetKekaSyncLogsQuery,
  useGetFailedSyncRecordsQuery,
  useRetryKekaSyncMutation,
  useTriggerKekaEmployeeSyncMutation,
  useTriggerKekaLeaveSyncMutation,
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

/**
 * Takes a raw JSON Blob (possibly compact/minified from the backend) and
 * re-downloads it as pretty-printed JSON with 2-space indentation — matching
 * the single-entry export format used in the detail sheet.
 */
export async function downloadAuditBlobAsJson(filename: string, blob: Blob) {
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text);
    downloadAuditJson(filename, parsed);
  } catch {
    // Fallback: download the blob as-is if it cannot be parsed
    downloadAuditBlob(filename, blob);
  }
}

const CSV_AUDIT_HEADERS = [
  "Time",
  "Actor",
  "Email",
  "Action",
  "Object Type",
  "Object ID",
  "Source",
  "IP Address",
  "Break-glass",
  "External",
  "Old Value",
  "New Value",
] as const;

function escapeAuditCsvCell(value: unknown): string {
  if (value == null) return "";
  const str =
    typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
  // Wrap in quotes if the value contains commas, quotes, or newlines
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of AuditLogEntry objects into a CSV string.
 * Old/New values are serialised as compact JSON strings inside CSV cells.
 */
export function convertAuditToCsv(entries: AuditLogEntry[]): string {
  const rows = entries.map((e) => [
    new Date(e.createdAt).toLocaleString(),
    e.user?.displayName ?? "System",
    e.user?.email ?? "",
    e.action,
    e.objectType,
    e.objectId ?? "",
    e.source ?? "",
    e.ipAddress ?? "",
    e.breakGlassAction ? "Yes" : "No",
    e.isExternal ? "Yes" : "No",
    e.oldValue != null ? JSON.stringify(e.oldValue) : "",
    e.newValue != null ? JSON.stringify(e.newValue) : "",
  ].map(escapeAuditCsvCell));

  return [
    CSV_AUDIT_HEADERS.map(escapeAuditCsvCell).join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n");
}

export function downloadAuditCsv(filename: string, entries: AuditLogEntry[]) {
  const csv = convertAuditToCsv(entries);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadAuditBlob(filename, blob);
}
