import { api } from "@/core/api/api";

export interface TaskDto {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  priority: "Low" | "Medium" | "High" | "Critical";
  ownerId: string | null;
  startDate: string | null;
  endDate: string | null;
  effortHours: number | null;
  progressApproved: number;
  status: "To_Do" | "In_Progress" | "Submitted_for_Review" | "Approved" | "Rework" | "Done";
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string };
  owner?: { id: string; displayName: string; email: string };
  parentTask?: { id: string; title: string };
  subTasks?: { id: string; title: string; status: string }[];
  comments?: any[];
  attachments?: any[];
}

export interface PaginatedTasksResponse {
  data: TaskDto[];
  hasNextPage: boolean;
}

export const tasksApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTasks: builder.query<
      PaginatedTasksResponse,
      { page?: number; limit?: number; projectId?: string; status?: string; search?: string }
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", String(params.page));
        if (params.limit) queryParams.append("limit", String(params.limit));
        if (params.projectId) queryParams.append("projectId", params.projectId);
        if (params.status) queryParams.append("status", params.status);
        if (params.search) queryParams.append("search", params.search);
        return `/tasks?${queryParams.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: "Tasks" as const, id })),
              { type: "Tasks", id: "LIST" },
            ]
          : [{ type: "Tasks", id: "LIST" }],
    }),

    getTaskById: builder.query<TaskDto, string>({
      query: (id) => `/tasks/${id}`,
      providesTags: (result, error, id) => [{ type: "Tasks", id }],
    }),

    createTask: builder.mutation<TaskDto, any>({
      query: (body) => ({
        url: "/tasks",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "Tasks", id: "LIST" }],
    }),

    updateTask: builder.mutation<TaskDto, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/tasks/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Tasks", id },
        { type: "Tasks", id: "LIST" },
      ],
    }),

    deleteTask: builder.mutation<void, string>({
      query: (id) => ({
        url: `/tasks/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Tasks", id: "LIST" }],
    }),

    addTaskComment: builder.mutation<any, { taskId: string; body: string; isInternal?: boolean }>({
      query: ({ taskId, body, isInternal = true }) => ({
        url: `/tasks/${taskId}/comments`,
        method: "POST",
        body: { body, isInternal },
      }),
      invalidatesTags: (result, error, { taskId }) => [{ type: "Tasks", id: taskId }],
    }),
  }),
});

export const {
  useGetTasksQuery,
  useGetTaskByIdQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useAddTaskCommentMutation,
} = tasksApi;
