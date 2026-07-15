import { api } from "@/core/api/api";
import type {
  AllocationPolicy,
  AllocationApprovalListResponse,
  DesignationOptionsResponse,
  EmployeeAttendanceListResponse,
  EmployeeAttendanceSortField,
  TeamDirectoryResponse,
  TeamDirectorySortField,
  TeamLeaveListResponse,
  TeamLeaveSortField,
  TimesheetContext,
  TimesheetWeekEntry,
  TimesheetWeekResponse,
  TimesheetApprovalListResponse,
  TimesheetApprovalDecision,
  TimesheetSyncFailure,
  UtilizationStatus,
  HolidayCalendarResponse,
} from "../types/resources.types";

export type QueryTeamDirectoryParams = {
  departmentId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  utilizationStatus?: UtilizationStatus | "all";
  sortBy?: TeamDirectorySortField;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
};

export type QueryTeamLeaveParams = {
  search?: string;
  sortBy?: TeamLeaveSortField;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
};

export type QueryEmployeeAttendanceParams = {
  employeeId: string;
  search?: string;
  dayType?: number;
  fromDate?: string;
  toDate?: string;
  sortBy?: EmployeeAttendanceSortField;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
};

function appendQueryParams(
  queryParams: URLSearchParams,
  params: Record<string, string | number | undefined>,
) {
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      queryParams.append(key, String(value));
    }
  }
}

export const resourcesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTeamDirectory: builder.query<TeamDirectoryResponse, QueryTeamDirectoryParams | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        const p = params ?? {};
        appendQueryParams(queryParams, {
          departmentId: p.departmentId,
          startDate: p.startDate,
          endDate: p.endDate,
          search: p.search,
          utilizationStatus: p.utilizationStatus,
          sortBy: p.sortBy,
          sortOrder: p.sortOrder,
          page: p.page,
          limit: p.limit,
        });
        const qs = queryParams.toString();
        return `/resources/team${qs ? `?${qs}` : ""}`;
      },
      providesTags: [{ type: "TeamDirectory", id: "LIST" }],
    }),

    getTeamLeave: builder.query<TeamLeaveListResponse, QueryTeamLeaveParams | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        const p = params ?? {};
        appendQueryParams(queryParams, {
          search: p.search,
          sortBy: p.sortBy,
          sortOrder: p.sortOrder,
          page: p.page,
          limit: p.limit,
        });
        const qs = queryParams.toString();
        return `/resources/team/leave${qs ? `?${qs}` : ""}`;
      },
      providesTags: [{ type: "TeamDirectory", id: "LEAVE" }],
    }),

    getEmployeeAttendance: builder.query<
      EmployeeAttendanceListResponse,
      QueryEmployeeAttendanceParams
    >({
      query: ({ employeeId, ...params }) => {
        const queryParams = new URLSearchParams();
        appendQueryParams(queryParams, {
          search: params.search,
          dayType: params.dayType,
          fromDate: params.fromDate,
          toDate: params.toDate,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          page: params.page,
          limit: params.limit,
        });
        const qs = queryParams.toString();
        return `/resources/team/${employeeId}/attendance${qs ? `?${qs}` : ""}`;
      },
      providesTags: (_result, _error, arg) => [
        { type: "TeamDirectory", id: `ATTENDANCE-${arg.employeeId}` },
      ],
    }),

    getAllocationPolicy: builder.query<AllocationPolicy, void>({
      query: () => "/resources/allocation-policy",
    }),

    getDesignationOptions: builder.query<DesignationOptionsResponse, void>({
      query: () => "/resources/meta/designations",
    }),

    getAllocationApprovals: builder.query<
      AllocationApprovalListResponse,
      { search?: string; page?: number; limit?: number; sortBy?: string; sortOrder?: string } | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        const p = params ?? {};
        appendQueryParams(queryParams, {
          search: p.search,
          page: p.page,
          limit: p.limit,
          sortBy: p.sortBy,
          sortOrder: p.sortOrder,
        });
        const qs = queryParams.toString();
        return `/resources/allocation-approvals${qs ? `?${qs}` : ""}`;
      },
      providesTags: [{ type: "AllocationApprovals", id: "LIST" }],
    }),

    approveAllocation: builder.mutation<
      { allocation: AllocationApprovalListResponse["rows"][number]; kekaSyncRef?: string | null },
      string
    >({
      query: (id) => ({
        url: `/resources/allocation-approvals/${id}/approve`,
        method: "PATCH",
      }),
      invalidatesTags: [
        { type: "AllocationApprovals", id: "LIST" },
        { type: "ProjectTeam", id: "LIST" },
        { type: "TeamDirectory", id: "LIST" },
      ],
    }),

    rejectAllocation: builder.mutation<
      { allocation: AllocationApprovalListResponse["rows"][number]; kekaSyncRef?: string | null },
      { id: string; comment?: string }
    >({
      query: ({ id, comment }) => ({
        url: `/resources/allocation-approvals/${id}/reject`,
        method: "PATCH",
        body: { comment },
      }),
      invalidatesTags: [
        { type: "AllocationApprovals", id: "LIST" },
        { type: "ProjectTeam", id: "LIST" },
        { type: "TeamDirectory", id: "LIST" },
      ],
    }),

    getTimesheetContext: builder.query<
      TimesheetContext,
      { asOf?: string } | void
    >({
      query: (params) => {
        const asOf = params && "asOf" in params ? params.asOf : undefined;
        const queryParams = new URLSearchParams();
        if (asOf) {
          queryParams.append("asOf", asOf);
        }
        const qs = queryParams.toString();
        return `/timesheets/context${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Timesheets"],
    }),

    getTimesheetWeek: builder.query<TimesheetWeekResponse, { weekStart?: string } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        const weekStart = params?.weekStart;
        if (weekStart) {
          queryParams.append("weekStart", weekStart);
        }
        const qs = queryParams.toString();
        return `/timesheets/week${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Timesheets"],
    }),

    createTimesheetEntry: builder.mutation<
      TimesheetWeekEntry,
      {
        projectId: string;
        taskId: string;
        workDate: string;
        regularHours: number;
        overtimeHours?: number;
        notes?: string;
        isBillable?: boolean;
      }
    >({
      query: (body) => ({
        url: "/timesheets",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Timesheets"],
    }),

    deleteTimesheetEntry: builder.mutation<void, string>({
      query: (id) => ({
        url: `/timesheets/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Timesheets"],
    }),

    submitTimesheetWeek: builder.mutation<
      { submittedCount: number; entries: TimesheetWeekEntry[] },
      { weekStart: string }
    >({
      query: (body) => ({
        url: "/timesheets/submit-week",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Timesheets", "TimesheetApprovals"],
    }),

    resubmitTimesheetWeek: builder.mutation<
      { submittedCount: number; entries: TimesheetWeekEntry[] },
      { weekStart: string }
    >({
      query: (body) => ({
        url: "/timesheets/resubmit-week",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Timesheets", "TimesheetApprovals"],
    }),

    updateTimesheetEntry: builder.mutation<
      TimesheetWeekEntry,
      {
        id: string;
        regularHours?: number;
        overtimeHours?: number;
        notes?: string;
        isBillable?: boolean;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/timesheets/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Timesheets"],
    }),

    getTimesheetApprovals: builder.query<
      TimesheetApprovalListResponse,
      { search?: string; status?: string; page?: number; limit?: number } | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        const p = params ?? {};
        appendQueryParams(queryParams, {
          search: p.search,
          status: p.status,
          page: p.page,
          limit: p.limit,
        });
        const qs = queryParams.toString();
        return `/timesheets/pending-approvals${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["TimesheetApprovals"],
    }),

    approveTimesheetSubmission: builder.mutation<
      TimesheetApprovalDecision,
      { employeeId: string; weekStart: string; comment?: string }
    >({
      query: (body) => ({
        url: "/timesheets/submissions/approve",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["TimesheetApprovals", "Timesheets"],
    }),

    rejectTimesheetSubmission: builder.mutation<
      TimesheetApprovalDecision,
      { employeeId: string; weekStart: string; comment?: string }
    >({
      query: (body) => ({
        url: "/timesheets/submissions/reject",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["TimesheetApprovals", "Timesheets"],
    }),

    getTimesheetSyncFailures: builder.query<TimesheetSyncFailure[], void>({
      query: () => "/timesheets/keka-sync/failures",
      providesTags: ["TimesheetSyncFailures"],
    }),

    getHolidayCalendars: builder.query<
      HolidayCalendarResponse,
      { year?: number; calendarId?: string } | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        const p = params ?? {};
        appendQueryParams(queryParams, {
          year: p.year,
          calendarId: p.calendarId,
        });
        const qs = queryParams.toString();
        return `/resources/holidays${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["HolidayCalendars"],
    }),

    retryTimesheetSync: builder.mutation<
      { success: boolean; ref: string | null },
      { timesheetId: string }
    >({
      query: (body) => ({
        url: "/timesheets/keka-sync/retry",
        method: "POST",
        body,
      }),
      invalidatesTags: ["TimesheetApprovals", "TimesheetSyncFailures", "Timesheets"],
    }),
  }),
});

export const {
  useGetTeamDirectoryQuery,
  useGetTeamLeaveQuery,
  useGetEmployeeAttendanceQuery,
  useGetAllocationPolicyQuery,
  useGetDesignationOptionsQuery,
  useGetAllocationApprovalsQuery,
  useApproveAllocationMutation,
  useRejectAllocationMutation,
  useGetTimesheetContextQuery,
  useGetTimesheetWeekQuery,
  useCreateTimesheetEntryMutation,
  useDeleteTimesheetEntryMutation,
  useSubmitTimesheetWeekMutation,
  useResubmitTimesheetWeekMutation,
  useUpdateTimesheetEntryMutation,
  useGetTimesheetApprovalsQuery,
  useApproveTimesheetSubmissionMutation,
  useRejectTimesheetSubmissionMutation,
  useGetTimesheetSyncFailuresQuery,
  useRetryTimesheetSyncMutation,
  useGetHolidayCalendarsQuery,
} = resourcesApi;
