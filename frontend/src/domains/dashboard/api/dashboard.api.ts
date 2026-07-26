import { api } from "@/core/api/api";

export type {
  DashboardStats,
  ProjectHealthItem,
  MilestoneItem,
  TeamMemberUtilization,
  DeptHourBreakdown,
  ResourceUtilizationResponse,
  BurnRateResponse,
  AuditLogFeedItem,
} from "../types/dashboard.types";

import type {
  DashboardStats,
  ProjectHealthItem,
  MilestoneItem,
  ResourceUtilizationResponse,
  BurnRateResponse,
  AuditLogFeedItem,
} from "../types/dashboard.types";

export type DashboardFilters = {
  departmentId?: string;
  status?: string;
  primaryPmId?: string;
  from?: string;
  to?: string;
};

const dashboardUrl = (path: string, filters?: DashboardFilters) => {
  const query = new URLSearchParams();
  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return `${path}${query.toString() ? `?${query}` : ""}`;
};

export const dashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query<DashboardStats, DashboardFilters | void>({
      query: (filters) => dashboardUrl("/dashboard/stats", filters || undefined),
      providesTags: ["Projects", "Tasks"],
    }),
    getDashboardProjectHealth: builder.query<ProjectHealthItem[], DashboardFilters | void>({
      query: (filters) => dashboardUrl("/dashboard/project-health", filters || undefined),
      providesTags: ["Projects"],
    }),
    getDashboardMilestones: builder.query<MilestoneItem[], DashboardFilters | void>({
      query: (filters) => dashboardUrl("/dashboard/milestones", filters || undefined),
      providesTags: ["Projects", "Tasks"],
    }),
    getDashboardResources: builder.query<ResourceUtilizationResponse, DashboardFilters | void>({
      query: (filters) => dashboardUrl("/dashboard/resources", filters || undefined),
      providesTags: ["Users", "Tasks"],
    }),
    getDashboardBurnRate: builder.query<BurnRateResponse, DashboardFilters | void>({
      query: (filters) => dashboardUrl("/dashboard/burn-rate", filters || undefined),
      providesTags: ["Projects"],
    }),
    getDashboardAuditFeed: builder.query<AuditLogFeedItem[], void>({
      query: () => "/dashboard/audit-feed",
      providesTags: ["Audit"],
    }),
  }),
});

export const {
  useGetDashboardStatsQuery,
  useGetDashboardProjectHealthQuery,
  useGetDashboardMilestonesQuery,
  useGetDashboardResourcesQuery,
  useGetDashboardBurnRateQuery,
  useGetDashboardAuditFeedQuery,
} = dashboardApi;
