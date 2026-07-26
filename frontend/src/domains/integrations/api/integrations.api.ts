import { api } from "@/core/api/api";
import type {
  FailedSyncRecordsQuery,
  FailedSyncRecordsResponse,
  KekaSyncLogsQuery,
  KekaSyncLogsResponse,
  KekaSyncStatusResponse,
  RetryKekaSyncResult,
  TimesheetReconcileResponse,
} from "../types/integrations.types";


export const integrationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getKekaSyncStatus: builder.query<KekaSyncStatusResponse, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync-status",
      }),
      providesTags: ["KekaSyncLogs", "FailedSyncRecords"],
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
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords", "HolidayCalendars"],
    }),

    triggerKekaSalarySync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/salary",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords"],
    }),

    triggerKekaClientsSync: builder.mutation<{ jobId: string | number }, void>({
      query: () => ({
        url: "/audit/integrations/keka/sync/clients",
        method: "POST",
      }),
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords", "Customers"],
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
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords", "HolidayCalendars"],
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
      invalidatesTags: ["KekaSyncLogs", "FailedSyncRecords", "UtilisationReport"],
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
  useGetKekaSyncStatusQuery,
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
