import { api } from "@/core/api/api";
import {
  type CreateProjectDto,
  type Customer,
  type Department,
  type PaginatedProjectsResponse,
  type Project,
  type ProjectManager,
} from "../types/projects.types";

export const projectsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProjects: builder.query<PaginatedProjectsResponse, { page?: number; limit?: number }>({
      query: ({ page = 1, limit = 10 }) => `/projects?page=${page}&limit=${limit}`,
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: "Projects" as const, id })),
              { type: "Projects", id: "LIST" },
            ]
          : [{ type: "Projects", id: "LIST" }],
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

    createProject: builder.mutation<Project, CreateProjectDto>({
      query: (body) => ({
        url: "/projects",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Projects", id: "LIST" }],
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
      ],
    }),

    deleteProject: builder.mutation<void, string>({
      query: (id) => ({
        url: `/projects/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Projects", id: "LIST" }],
    }),
  }),
});

export const {
  useGetProjectsQuery,
  useGetProjectByIdQuery,
  useGetDepartmentsQuery,
  useGetCustomersQuery,
  useGetProjectManagersQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
} = projectsApi;
