import { api } from "@/core/api/api";

export interface DashboardStats {
  projects: {
    total: number;
    active: number;
    atRisk: number;
    delayed: number;
    completed: number;
    totalValue: number;
    totalSpent: number;
    remainingBudget: number;
  };
  tasks: {
    total: number;
    done: number;
    open: number;
    overdue: number;
    completionRate: number;
  };
  risks: {
    activeCount: number;
  };
  resources: {
    total: number;
  };
}

export interface ProjectHealthItem {
  id: string;
  name: string;
  pm: string;
  status: "on-track" | "at-risk" | "delayed";
  progress: number;
  tasks: number;
  risks: number;
  budget: number;
}

export interface MilestoneItem {
  id: string;
  project: string;
  label: string;
  date: string;
  status: "completed" | "on-track" | "at-risk" | "delayed";
  daysLeft: number | null;
}

export interface TeamMemberUtilization {
  name: string;
  role: string;
  dept: string;
  util: number;
  billable: number;
  projects: number;
  status: "over" | "ok" | "under";
}

export interface DeptHourBreakdown {
  dept: string;
  billable: number;
  nonBillable: number;
  total: number;
}

export interface ResourceUtilizationResponse {
  team: TeamMemberUtilization[];
  departments: DeptHourBreakdown[];
}

export interface BurnRateResponse {
  months: string[];
  planned: number[];
  actual: (number | null)[];
  summary: {
    totalBudget: string;
    spentToDate: string;
    remaining: string;
    forecastEoy: string;
  };
}

export interface AuditLogFeedItem {
  actor: string;
  actionKey: string;
  target: string;
  module: string;
  time: string;
  createdAt: string;
}

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
