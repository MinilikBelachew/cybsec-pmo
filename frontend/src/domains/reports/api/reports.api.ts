import { api } from "@/core/api/api";
import type {
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
  }),
});

export const { useGetUtilisationReportQuery, useLazyGetUtilisationReportQuery } = reportsApi;
