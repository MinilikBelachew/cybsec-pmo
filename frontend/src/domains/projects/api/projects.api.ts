import { api } from "@/core/api/api";
import {
  type CreateProjectDto,
  type CreateProjectBundleDto,
  type Currency,
  type Customer,
  type Department,
  type GetProjectsParams,
  type PaginatedProjectsResponse,
  type Project,
  type ProjectManager,
  type ProjectPhase,
  type ProjectMilestone,
  type TeamCandidate,
  type ProjectAllocation,
  type ProjectTaskAssignee,
  type GetTeamCandidatesParams,
  type CreateProjectTeamPayload,
  type CreateProjectTeamResult,
  type GetTaskAssigneeAvailabilityParams,
  type TaskAssigneeAvailability,
  type ProjectPortfolioStats,
} from "../types/projects.types";

export const projectsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getPortfolioStats: builder.query<ProjectPortfolioStats, void>({
      query: () => "/projects/portfolio-stats",
      providesTags: [{ type: "PortfolioStats", id: "SUMMARY" }],
    }),

    getProjects: builder.query<PaginatedProjectsResponse, GetProjectsParams>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", String(params.page));
        if (params.limit) queryParams.append("limit", String(params.limit));
        if (params.search) queryParams.append("search", params.search);
        if (params.status) queryParams.append("status", params.status);
        if (params.priority) queryParams.append("priority", params.priority);
        if (params.sortBy) queryParams.append("sortBy", params.sortBy);
        if (params.sortOrder) queryParams.append("sortOrder", params.sortOrder);
        return `/projects?${queryParams.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: "Projects" as const, id })),
              { type: "Projects", id: "LIST" },
            ]
          : [{ type: "Projects", id: "LIST" }],
    }),

    exportProjects: builder.query<Project[], GetProjectsParams>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.search) queryParams.append("search", params.search);
        if (params.status) queryParams.append("status", params.status);
        if (params.priority) queryParams.append("priority", params.priority);
        return `/projects/export?${queryParams.toString()}`;
      },
    }),

    getProjectById: builder.query<Project, string>({
      query: (id) => `/projects/${id}`,
      providesTags: (result, error, id) => [{ type: "Projects", id }],
    }),

    getDepartments: builder.query<Department[], void>({
      query: () => "/projects/meta/departments",
      providesTags: [{ type: "Departments", id: "LIST" }],
    }),

    getCustomers: builder.query<Customer[], void>({
      query: () => "/projects/meta/customers",
      providesTags: [{ type: "Customers", id: "LIST" }],
    }),

    getProjectManagers: builder.query<ProjectManager[], void>({
      query: () => "/projects/meta/project-managers",
      providesTags: [{ type: "ProjectManagers", id: "LIST" }],
    }),

    getCurrencies: builder.query<Currency[], void>({
      query: () => "/currencies",
      providesTags: [{ type: "Currencies", id: "LIST" }],
    }),

    createProject: builder.mutation<Project, CreateProjectDto>({
      query: (body) => ({
        url: "/projects",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "Projects", id: "LIST" },
        { type: "PortfolioStats", id: "SUMMARY" },
      ],
    }),

    createProjectBundle: builder.mutation<Project, CreateProjectBundleDto>({
      query: (body) => ({
        url: "/projects/bundle",
        method: "POST",
        body,
      }),
      invalidatesTags: (result) =>
        result
          ? [
              { type: "Projects", id: "LIST" },
              { type: "PortfolioStats", id: "SUMMARY" },
              { type: "ProjectTeam", id: result.id },
              { type: "ProjectTeam", id: `assignees-${result.id}` },
              { type: "ProjectTeam", id: "CANDIDATES" },
              { type: "Milestones", id: result.id },
            ]
          : [
              { type: "Projects", id: "LIST" },
              { type: "PortfolioStats", id: "SUMMARY" },
            ],
    }),

    updateProject: builder.mutation<Project, { id: string; body: Partial<CreateProjectDto> }>({
      query: ({ id, body }) => ({
        url: `/projects/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Projects", id },
        { type: "Projects", id: "LIST" },
        { type: "PortfolioStats", id: "SUMMARY" },
      ],
    }),

    deleteProject: builder.mutation<void, string>({
      query: (id) => ({
        url: `/projects/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [
        { type: "Projects", id: "LIST" },
        { type: "PortfolioStats", id: "SUMMARY" },
      ],
    }),

    getPhases: builder.query<ProjectPhase[], string>({
      query: (projectId) => `/projects/${projectId}/phases`,
      providesTags: (result, error, projectId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Phases" as const, id })),
              { type: "Phases", id: "LIST" },
              { type: "Phases", id: projectId },
            ]
          : [{ type: "Phases", id: "LIST" }],
    }),

    createPhase: builder.mutation<ProjectPhase, { projectId: string; body: Omit<ProjectPhase, "id" | "projectId" | "createdAt" | "updatedAt"> }>({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/phases`,
        method: "POST",
        body,
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: "Phases", id: "LIST" },
        { type: "Phases", id: projectId },
        { type: "Projects", id: projectId },
      ],
    }),

    updatePhase: builder.mutation<ProjectPhase, { projectId: string; phaseId: string; body: Partial<ProjectPhase> }>({
      query: ({ projectId, phaseId, body }) => ({
        url: `/projects/${projectId}/phases/${phaseId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { projectId, phaseId }) => [
        { type: "Phases", id: phaseId },
        { type: "Phases", id: projectId },
        { type: "Phases", id: "LIST" },
        { type: "Projects", id: projectId },
        { type: "Tasks" },
      ],
    }),

    deletePhase: builder.mutation<void, { projectId: string; phaseId: string }>({
      query: ({ projectId, phaseId }) => ({
        url: `/projects/${projectId}/phases/${phaseId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { projectId, phaseId }) => [
        { type: "Phases", id: phaseId },
        { type: "Phases", id: projectId },
        { type: "Phases", id: "LIST" },
        { type: "Projects", id: projectId },
        { type: "Tasks" },
        { type: "Milestones", id: projectId },
      ],
    }),

    getMilestones: builder.query<ProjectMilestone[], string>({
      query: (projectId) => `/projects/${projectId}/milestones`,
      providesTags: (result, error, projectId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Milestones" as const, id })),
              { type: "Milestones", id: "LIST" },
              { type: "Milestones", id: projectId },
            ]
          : [{ type: "Milestones", id: "LIST" }],
    }),

    createMilestone: builder.mutation<ProjectMilestone, { projectId: string; body: Omit<ProjectMilestone, "id" | "projectId" | "createdAt"> }>({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/milestones`,
        method: "POST",
        body,
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: "Milestones", id: "LIST" },
        { type: "Milestones", id: projectId },
        { type: "Projects", id: projectId },
        { type: "Phases", id: projectId },
      ],
    }),

    updateMilestone: builder.mutation<ProjectMilestone, { projectId: string; milestoneId: string; body: Partial<ProjectMilestone> }>({
      query: ({ projectId, milestoneId, body }) => ({
        url: `/projects/${projectId}/milestones/${milestoneId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { projectId, milestoneId }) => [
        { type: "Milestones", id: milestoneId },
        { type: "Milestones", id: projectId },
        { type: "Milestones", id: "LIST" },
        { type: "Projects", id: projectId },
        { type: "Phases", id: projectId },
      ],
    }),

    deleteMilestone: builder.mutation<void, { projectId: string; milestoneId: string }>({
      query: ({ projectId, milestoneId }) => ({
        url: `/projects/${projectId}/milestones/${milestoneId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { projectId, milestoneId }) => [
        { type: "Milestones", id: milestoneId },
        { type: "Milestones", id: projectId },
        { type: "Milestones", id: "LIST" },
        { type: "Projects", id: projectId },
        { type: "Phases", id: projectId },
      ],
    }),

    getTeamCandidates: builder.query<TeamCandidate[], GetTeamCandidatesParams>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.departmentId) queryParams.append("departmentId", params.departmentId);
        if (params.projectId) queryParams.append("projectId", params.projectId);
        if (params.startDate) queryParams.append("startDate", params.startDate);
        if (params.endDate) queryParams.append("endDate", params.endDate);
        const qs = queryParams.toString();
        return `/projects/meta/team-candidates${qs ? `?${qs}` : ""}`;
      },
      providesTags: [{ type: "ProjectTeam", id: "CANDIDATES" }],
    }),

    getProjectTeam: builder.query<ProjectAllocation[], string>({
      query: (projectId) => `/projects/${projectId}/team`,
      providesTags: (result, error, projectId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "ProjectTeam" as const, id })),
              { type: "ProjectTeam", id: projectId },
            ]
          : [{ type: "ProjectTeam", id: projectId }],
    }),

    getProjectTaskAssignees: builder.query<ProjectTaskAssignee[], string>({
      query: (projectId) => `/projects/${projectId}/team/assignees`,
      providesTags: (result, error, projectId) =>
        result
          ? [
              ...result.map(({ userId }) => ({ type: "ProjectTeam" as const, id: `assignee-${userId}` })),
              { type: "ProjectTeam", id: `assignees-${projectId}` },
            ]
          : [{ type: "ProjectTeam", id: `assignees-${projectId}` }],
    }),

    addProjectTeamMembers: builder.mutation<
      CreateProjectTeamResult,
      { projectId: string; body: CreateProjectTeamPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/team`,
        method: "POST",
        body,
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: "ProjectTeam", id: projectId },
        { type: "ProjectTeam", id: `assignees-${projectId}` },
        { type: "ProjectTeam", id: "CANDIDATES" },
        { type: "Projects", id: projectId },
      ],
    }),

    removeProjectTeamMember: builder.mutation<void, { projectId: string; allocationId: string }>({
      query: ({ projectId, allocationId }) => ({
        url: `/projects/${projectId}/team/${allocationId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { projectId }) => [
        { type: "ProjectTeam", id: projectId },
        { type: "ProjectTeam", id: `assignees-${projectId}` },
        { type: "Projects", id: projectId },
      ],
    }),

    getTaskAssigneeAvailability: builder.query<
      TaskAssigneeAvailability,
      GetTaskAssigneeAvailabilityParams
    >({
      query: ({ projectId, ownerId, startDate, endDate, effortHours, excludeTaskId }) => {
        const queryParams = new URLSearchParams({ ownerId });
        if (startDate) queryParams.append("startDate", startDate);
        if (endDate) queryParams.append("endDate", endDate);
        if (effortHours != null) queryParams.append("effortHours", String(effortHours));
        if (excludeTaskId) queryParams.append("excludeTaskId", excludeTaskId);
        return `/projects/${projectId}/team/task-availability?${queryParams.toString()}`;
      },
    }),
  }),
});

export const {
  useGetPortfolioStatsQuery,
  useGetProjectsQuery,
  useLazyExportProjectsQuery,
  useExportProjectsQuery,
  useGetProjectByIdQuery,
  useGetDepartmentsQuery,
  useGetCustomersQuery,
  useGetProjectManagersQuery,
  useGetCurrenciesQuery,
  useCreateProjectMutation,
  useCreateProjectBundleMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetPhasesQuery,
  useCreatePhaseMutation,
  useUpdatePhaseMutation,
  useDeletePhaseMutation,
  useGetMilestonesQuery,
  useCreateMilestoneMutation,
  useUpdateMilestoneMutation,
  useDeleteMilestoneMutation,
  useGetTeamCandidatesQuery,
  useGetProjectTeamQuery,
  useGetProjectTaskAssigneesQuery,
  useAddProjectTeamMembersMutation,
  useRemoveProjectTeamMemberMutation,
  useGetTaskAssigneeAvailabilityQuery,
} = projectsApi;
