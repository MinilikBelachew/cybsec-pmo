import { api } from "@/core/api/api";
import type {
  FailedSyncRecordsQuery,
  FailedSyncRecordsResponse,
  KekaSyncLogsQuery,
  KekaSyncLogsResponse,
  RetryKekaSyncResult,
} from "../types/integrations.types";


export const integrationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
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
        params: {
          page: params.page,
          limit: params.limit,
          integration: params.integration,
          entityType: params.entityType,
          search: params.search,
          // Explicit string keeps `false` in the query string for unresolved.
          ...(params.isResolved === undefined
            ? {}
            : { isResolved: params.isResolved ? "true" : "false" }),
        },
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

    triggerKekaAttendanceSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/attendance",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords"],
    }),

    triggerKekaHolidaysSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/holidays",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords"],
    }),

    triggerKekaSalarySync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/salary",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords"],
    }),

    triggerKekaProjectsSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/projects",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords"],
    }),

    triggerKekaFullSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/all",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords"],
    }),
  }),
  overrideExisting: process.env.NODE_ENV === "development",
});

export const {
  useGetKekaSyncLogsQuery,
  useGetFailedSyncRecordsQuery,
  useRetryKekaSyncMutation,
  useTriggerKekaEmployeeSyncMutation,
  useTriggerKekaLeaveSyncMutation,
  useTriggerKekaAttendanceSyncMutation,
  useTriggerKekaHolidaysSyncMutation,
  useTriggerKekaSalarySyncMutation,
  useTriggerKekaProjectsSyncMutation,
  useTriggerKekaFullSyncMutation,
} = integrationsApi;
