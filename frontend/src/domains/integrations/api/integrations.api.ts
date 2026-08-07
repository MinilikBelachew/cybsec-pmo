import { api } from "@/core/api/api";
import type {
  FailedSyncRecordsQuery,
  FailedSyncRecordsResponse,
  KekaConnectionResponse,
  KekaConnectionSecrets,
  KekaConnectionTestResult,
  KekaSyncJobStatusResponse,
  KekaSyncLogsQuery,
  KekaSyncLogsResponse,
  KekaSyncStatusResponse,
  RetryKekaSyncResult,
  TimesheetReconcileResponse,
  UpdateKekaConnectionBody,
} from "../types/integrations.types";


export const integrationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getKekaConnection: builder.query<KekaConnectionResponse, void>({
      query: () => ({
        url: "/audit/integrations/keka/connection",
      }),
      providesTags: ["KekaConnection"],
    }),

    getKekaConnectionSecrets: builder.query<KekaConnectionSecrets, void>({
      query: () => ({
        url: "/audit/integrations/keka/connection/secrets",
      }),
    }),

    updateKekaConnection: builder.mutation<
      KekaConnectionResponse,
      UpdateKekaConnectionBody
    >({
      query: (body) => ({
        url: "/audit/integrations/keka/connection",
        method: "PUT",
        body,
      }),
      invalidatesTags: ["KekaConnection"],
    }),

    testKekaConnection: builder.mutation<
      KekaConnectionTestResult,
      UpdateKekaConnectionBody | void
    >({
      query: (body) => ({
        url: "/audit/integrations/keka/connection/test",
        method: "POST",
        body: body ?? {},
      }),
      invalidatesTags: ["KekaConnection"],
    }),

    getKekaSyncStatus: builder.query<KekaSyncStatusResponse, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync-status",
      }),
      providesTags: ["KekaSyncStatus"],
    }),

    getKekaSyncJobStatus: builder.query<KekaSyncJobStatusResponse, string>({
      query: (jobId) => ({
        url: `/audit/integrations/keka/sync-jobs/${encodeURIComponent(jobId)}`,
      }),
    }),

    getKekaTimesheetReconcile: builder.query<TimesheetReconcileResponse, void>({
      query: () => ({
        url: "/audit/integrations/keka/timesheet-reconcile",
      }),
      providesTags: ["KekaTimesheetReconcile"],
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
        params: {
          page: params.page,
          limit: params.limit,
          integration: params.integration,
          entityType: params.entityType,
          search: params.search,
          disposition: params.disposition,
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
      invalidatesTags: [
        "KekaSyncLogs",
        "FailedSyncRecords",
        "KekaSyncStatus",
        "TimesheetApprovals",
      ],
    }),

    triggerKekaEmployeeSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/employees",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords", "KekaSyncStatus"],
    }),

    triggerKekaLeaveSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/leave",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords", "KekaSyncStatus"],
    }),

    triggerKekaAttendanceSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/attendance",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords", "KekaSyncStatus"],
    }),

    triggerKekaHolidaysSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/holidays",
        method: "POST",
      }),
      invalidatesTags: [
        "KekaSyncLogs",
        "FailedSyncRecords",
        "KekaSyncStatus",
        "HolidayCalendars",
      ],
    }),

    triggerKekaSalarySync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/salary",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords", "KekaSyncStatus"],
    }),

    triggerKekaClientsSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/clients",
        method: "POST",
      }),
      invalidatesTags: [
        "KekaSyncLogs",
        "FailedSyncRecords",
        "KekaSyncStatus",
        "Customers",
      ],
    }),

    triggerKekaProjectsSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/projects",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords", "KekaSyncStatus"],
    }),

    triggerKekaFullSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/all",
        method: "POST",
      }),
      invalidatesTags: [
        "KekaSyncLogs",
        "FailedSyncRecords",
        "KekaSyncStatus",
        "HolidayCalendars",
      ],
    }),

    reconcileKekaTimesheets: builder.mutation<
      TimesheetReconcileResponse,
      { startDate?: string; endDate?: string; notifyAdmins?: boolean } | void
    >({
      query: (body) => ({
        url: "/audit/integrations/keka/timesheet-reconcile",
        method: "POST",
        body: {
          notifyAdmins: true,
          ...(body ?? {}),
        },
      }),
      invalidatesTags: [
        "KekaSyncLogs",
        "FailedSyncRecords",
        "KekaSyncStatus",
        "UtilisationReport",
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            integrationsApi.util.updateQueryData(
              "getKekaTimesheetReconcile",
              undefined,
              () => data,
            ),
          );
        } catch {
          // Leave cached reconcile snapshot unchanged on failure.
        }
      },
    }),
  }),
  overrideExisting: process.env.NODE_ENV === "development",
});

export const {
  useGetKekaConnectionQuery,
  useLazyGetKekaConnectionSecretsQuery,
  useUpdateKekaConnectionMutation,
  useTestKekaConnectionMutation,
  useGetKekaSyncStatusQuery,
  useGetKekaSyncJobStatusQuery,
  useGetKekaTimesheetReconcileQuery,
  useGetKekaSyncLogsQuery,
  useGetFailedSyncRecordsQuery,
  useRetryKekaSyncMutation,
  useTriggerKekaEmployeeSyncMutation,
  useTriggerKekaLeaveSyncMutation,
  useTriggerKekaAttendanceSyncMutation,
  useTriggerKekaHolidaysSyncMutation,
  useTriggerKekaSalarySyncMutation,
  useTriggerKekaClientsSyncMutation,
  useTriggerKekaProjectsSyncMutation,
  useTriggerKekaFullSyncMutation,
  useReconcileKekaTimesheetsMutation,
} = integrationsApi;
