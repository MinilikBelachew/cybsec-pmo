import { api } from "@/core/api/api";
import type {
  DataQualityFlag,
  HealthRule,
  ProjectHealthReport,
  ReportSchedule,
  ReportScheduleInput,
  ReportType,
  StatusReport,
  UpdateHealthRule,
  UtilisationReportResponse,
  UtilisationSortField,
} from "../types/reports.types";

export type QueryUtilisationParams = {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  departmentId?: string;
  managerEmployeeId?: string;
  projectId?: string;
  search?: string;
  sortBy?: UtilisationSortField;
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

export const reportsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getUtilisationReport: builder.query<
      UtilisationReportResponse,
      QueryUtilisationParams | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        const p = params ?? {};
        appendQueryParams(queryParams, {
          startDate: p.startDate,
          endDate: p.endDate,
          employeeId: p.employeeId,
          departmentId: p.departmentId,
          managerEmployeeId: p.managerEmployeeId,
          projectId: p.projectId,
          search: p.search,
          sortBy: p.sortBy,
          sortOrder: p.sortOrder,
          page: p.page,
          limit: p.limit,
        });
        const qs = queryParams.toString();
        return qs ? `/reports/utilisation?${qs}` : "/reports/utilisation";
      },
      providesTags: [{ type: "UtilisationReport", id: "LIST" }],
    }),
    getHealthRules: builder.query<HealthRule[], void>({
      query: () => "/reports/health-rules",
      providesTags: [{ type: "Settings", id: "HEALTH_RULES" }],
    }),
    updateHealthRules: builder.mutation<HealthRule[], UpdateHealthRule[]>({
      query: (body) => ({ url: "/reports/health-rules", method: "PUT", body }),
      invalidatesTags: [{ type: "Settings", id: "HEALTH_RULES" }],
    }),
    getProjectHealthReports: builder.query<ProjectHealthReport[], void>({
      query: () => "/reports/health/projects",
      providesTags: [{ type: "Projects", id: "HEALTH" }],
    }),
    getProjectHealthReport: builder.query<ProjectHealthReport, string>({
      query: (id) => `/reports/health/projects/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Projects", id: `health-${id}` }],
    }),
    getDataQualityFlags: builder.query<
      DataQualityFlag[],
      { resolved?: boolean; projectId?: string; flagType?: string } | void
    >({
      query: (params) => {
        const query = new URLSearchParams();
        if (params?.resolved !== undefined) query.set("resolved", String(params.resolved));
        if (params?.projectId) query.set("projectId", params.projectId);
        if (params?.flagType) query.set("flagType", params.flagType);
        return `/reports/data-quality${query.size ? `?${query}` : ""}`;
      },
      providesTags: [{ type: "Projects", id: "DATA_QUALITY" }],
    }),
    scanDataQuality: builder.mutation<unknown, { projectId?: string }>({
      query: (body) => ({ url: "/reports/data-quality/scan", method: "POST", body }),
      invalidatesTags: [{ type: "Projects", id: "DATA_QUALITY" }],
    }),
    resolveDataQualityFlag: builder.mutation<DataQualityFlag, string>({
      query: (id) => ({ url: `/reports/data-quality/${id}/resolve`, method: "PATCH" }),
      invalidatesTags: [{ type: "Projects", id: "DATA_QUALITY" }],
    }),
    generateStatusReport: builder.mutation<
      StatusReport,
      { reportType: ReportType; projectId: string }
    >({
      query: (body) => ({ url: "/reports/status", method: "POST", body }),
      invalidatesTags: [{ type: "Projects", id: "STATUS_REPORTS" }],
    }),
    getStatusReports: builder.query<
      StatusReport[],
      { projectId?: string; reportType?: ReportType; status?: string } | void
    >({
      query: (params) => {
        const query = new URLSearchParams();
        if (params?.projectId) query.set("projectId", params.projectId);
        if (params?.reportType) query.set("reportType", params.reportType);
        if (params?.status) query.set("status", params.status);
        return `/reports/status${query.size ? `?${query}` : ""}`;
      },
      providesTags: [{ type: "Projects", id: "STATUS_REPORTS" }],
    }),
    getStatusReport: builder.query<StatusReport, string>({
      query: (id) => `/reports/status/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Projects", id: `status-${id}` }],
    }),
    approveStatusReport: builder.mutation<StatusReport, string>({
      query: (id) => ({ url: `/reports/status/${id}/approve`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Projects", id: "STATUS_REPORTS" },
        { type: "Projects", id: `status-${id}` },
      ],
    }),
    exportStatusReport: builder.query<Blob, { id: string; format: "pdf" | "docx" }>({
      query: ({ id, format }) => ({
        url: `/reports/status/${id}/export?format=${format}`,
        responseHandler: (response) => response.blob(),
      }),
    }),
    getReportSchedules: builder.query<ReportSchedule[], void>({
      query: () => "/reports/schedules",
      providesTags: [{ type: "Projects", id: "REPORT_SCHEDULES" }],
    }),
    getReportSchedule: builder.query<ReportSchedule, string>({
      query: (id) => `/reports/schedules/${id}`,
    }),
    createReportSchedule: builder.mutation<ReportSchedule, ReportScheduleInput>({
      query: (body) => ({ url: "/reports/schedules", method: "POST", body }),
      invalidatesTags: [{ type: "Projects", id: "REPORT_SCHEDULES" }],
    }),
    updateReportSchedule: builder.mutation<
      ReportSchedule,
      { id: string; body: Partial<ReportScheduleInput> }
    >({
      query: ({ id, body }) => ({ url: `/reports/schedules/${id}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "Projects", id: "REPORT_SCHEDULES" }],
    }),
    deleteReportSchedule: builder.mutation<void, string>({
      query: (id) => ({ url: `/reports/schedules/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Projects", id: "REPORT_SCHEDULES" }],
    }),
  }),
});

export const {
  useGetUtilisationReportQuery,
  useLazyGetUtilisationReportQuery,
  useGetHealthRulesQuery,
  useUpdateHealthRulesMutation,
  useGetProjectHealthReportsQuery,
  useGetProjectHealthReportQuery,
  useGetDataQualityFlagsQuery,
  useScanDataQualityMutation,
  useResolveDataQualityFlagMutation,
  useGenerateStatusReportMutation,
  useGetStatusReportsQuery,
  useGetStatusReportQuery,
  useApproveStatusReportMutation,
  useLazyExportStatusReportQuery,
  useGetReportSchedulesQuery,
  useGetReportScheduleQuery,
  useCreateReportScheduleMutation,
  useUpdateReportScheduleMutation,
  useDeleteReportScheduleMutation,
} = reportsApi;
