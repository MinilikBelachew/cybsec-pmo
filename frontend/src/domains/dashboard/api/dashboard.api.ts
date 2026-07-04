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

export const dashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query<DashboardStats, void>({
      query: () => "/dashboard/stats",
      providesTags: ["Projects", "Tasks"],
    }),
    getDashboardProjectHealth: builder.query<ProjectHealthItem[], void>({
      query: () => "/dashboard/project-health",
      providesTags: ["Projects"],
    }),
    getDashboardMilestones: builder.query<MilestoneItem[], void>({
      query: () => "/dashboard/milestones",
      providesTags: ["Projects", "Tasks"],
    }),
    getDashboardResources: builder.query<ResourceUtilizationResponse, void>({
      query: () => "/dashboard/resources",
      providesTags: ["Users", "Tasks"],
    }),
    getDashboardBurnRate: builder.query<BurnRateResponse, void>({
      query: () => "/dashboard/burn-rate",
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
