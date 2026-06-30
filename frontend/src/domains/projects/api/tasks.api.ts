import { api } from "@/core/api/api";
import type { RootState } from "@/store";
import type {
  AddTaskAttachmentPayload,
  AddTaskCommentPayload,
  CreateTaskBundlePayload,
  GetTasksParams,
  PaginatedTasksResponse,
  Task,
  TaskAttachment,
  TaskComment,
  UpdateTaskPayload,
  UpdateTaskBundlePayload,
  TaskProgressUpdate,
  PendingProgressReviewsResponse,
  SubmitProgressUpdatePayload,
  ReviewProgressUpdatePayload,
  CreateTaskDependencyPayload,
  TaskDependency,
  ValidateTaskDependencyResponse,
  TaskDependencyType,
  TaskActiveStats,
} from "../types/tasks.types";

type CachedQueryEntry = {
  endpointName?: string;
  originalArgs?: GetTasksParams;
};

function forEachGetTasksQuery(getState: () => unknown, fn: (args: GetTasksParams) => void) {
  const queries = (getState() as RootState).api.queries as Record<string, CachedQueryEntry | undefined>;
  for (const query of Object.values(queries)) {
    if (query?.endpointName !== "getTasks" || !query.originalArgs) continue;
    fn(query.originalArgs);
  }
}

export const tasksApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getTasks: builder.query<PaginatedTasksResponse, GetTasksParams>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", String(params.page));
        if (params.limit) queryParams.append("limit", String(params.limit));
        if (params.projectId) queryParams.append("projectId", params.projectId);
        if (params.parentTaskId) queryParams.append("parentTaskId", params.parentTaskId);
        if (params.topLevelOnly === false) queryParams.append("topLevelOnly", "false");
        if (params.status) queryParams.append("status", params.status);
        if (params.priority) queryParams.append("priority", params.priority);
        if (params.search) queryParams.append("search", params.search);
        if (params.phaseId) queryParams.append("phaseId", params.phaseId);
        if (params.ownerId) queryParams.append("ownerId", params.ownerId);
        return `/tasks?${queryParams.toString()}`;
      },
      providesTags: (result, _error, params) => {
        const tags: { type: "Tasks"; id: string }[] = [];
        if (params.projectId) {
          tags.push({ type: "Tasks", id: `PROJECT_${params.projectId}` });
        }
        tags.push({ type: "Tasks", id: "LIST" });
        if (result?.data) {
          tags.push(...result.data.map(({ id }) => ({ type: "Tasks" as const, id })));
        }
        return tags;
      },
    }),

    getActiveTaskStats: builder.query<TaskActiveStats, void>({
      query: () => "/tasks/stats",
      providesTags: [{ type: "Tasks", id: "STATS" }],
    }),

    exportTasks: builder.query<Task[], GetTasksParams>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.projectId) queryParams.append("projectId", params.projectId);
        if (params.parentTaskId) queryParams.append("parentTaskId", params.parentTaskId);
        if (params.topLevelOnly === false) queryParams.append("topLevelOnly", "false");
        if (params.status) queryParams.append("status", params.status);
        if (params.priority) queryParams.append("priority", params.priority);
        if (params.search) queryParams.append("search", params.search);
        if (params.phaseId) queryParams.append("phaseId", params.phaseId);
        if (params.ownerId) queryParams.append("ownerId", params.ownerId);
        return `/tasks/export?${queryParams.toString()}`;
      },
    }),

    getTaskById: builder.query<Task, string>({
      query: (id) => `/tasks/${id}`,
      providesTags: (result, error, id) => [{ type: "Tasks", id }],
    }),

    createTask: builder.mutation<Task, Record<string, unknown>>({
      query: (body) => ({
        url: "/tasks",
        method: "POST",
        body,
      }),
      invalidatesTags: (result, _error, body) => {
        const tags: { type: "Tasks"; id: string }[] = [
          { type: "Tasks", id: "LIST" },
          { type: "Tasks", id: "STATS" },
        ];
        if (typeof body.projectId === "string") {
          tags.push({ type: "Tasks", id: `PROJECT_${body.projectId}` });
        }
        if (result?.id) tags.push({ type: "Tasks", id: result.id });
        if (typeof body.parentTaskId === "string") {
          tags.push({ type: "Tasks", id: body.parentTaskId });
        }
        return tags;
      },
    }),

    createTaskBundle: builder.mutation<Task, CreateTaskBundlePayload>({
      query: ({ payload, files = [] }) => {
        const formData = new FormData();
        formData.append("payload", JSON.stringify(payload));
        for (const file of files) {
          formData.append("files", file);
        }
        return {
          url: "/tasks/bundle",
          method: "POST",
          body: formData,
        };
      },
      async onQueryStarted({ payload }, { dispatch, queryFulfilled }) {
        try {
          const { data: newTask } = await queryFulfilled;
          const projectId =
            typeof payload.projectId === "string" ? payload.projectId : newTask.projectId;
          if (!projectId || newTask.parentTaskId) return;

          dispatch(
            tasksApi.util.updateQueryData(
              "getTasks",
              { projectId, limit: 50 },
              (draft) => {
                if (!draft.data.some((task) => task.id === newTask.id)) {
                  draft.data.unshift(newTask);
                }
              }
            )
          );
        } catch {
          // mutation failed — cache invalidation below will refetch
        }
      },
      invalidatesTags: (result, _error, { payload }) => {
        const tags: { type: "Tasks"; id: string }[] = [
          { type: "Tasks", id: "LIST" },
          { type: "Tasks", id: "STATS" },
        ];
        const projectId =
          typeof payload.projectId === "string"
            ? payload.projectId
            : result?.projectId;
        if (projectId) {
          tags.push({ type: "Tasks", id: `PROJECT_${projectId}` });
        }
        if (result?.id) tags.push({ type: "Tasks", id: result.id });
        if (typeof payload.parentTaskId === "string") {
          tags.push({ type: "Tasks", id: payload.parentTaskId });
        }
        return tags;
      },
    }),

    updateTask: builder.mutation<Task, UpdateTaskPayload>({
      query: ({ id, body }) => ({
        url: `/tasks/${id}`,
        method: "PATCH",
        body,
      }),
      async onQueryStarted({ id, body }, { dispatch, queryFulfilled, getState }) {
        const patchResults: Array<{ undo: () => void }> = [];

        const taskByIdState = tasksApi.endpoints.getTaskById.select(id)(getState());
        if (taskByIdState?.data) {
          patchResults.push(
            dispatch(
              tasksApi.util.updateQueryData("getTaskById", id, (draft) => {
                Object.assign(draft, body);
              }),
            ),
          );
        }

        forEachGetTasksQuery(getState, (args) => {
          patchResults.push(
            dispatch(
              tasksApi.util.updateQueryData("getTasks", args, (draft) => {
                const task = draft.data.find((item) => item.id === id);
                if (task) Object.assign(task, body);
              }),
            ),
          );
        });

        try {
          const { data } = await queryFulfilled;
          if (taskByIdState?.data) {
            dispatch(tasksApi.util.updateQueryData("getTaskById", id, () => data));
          }
          forEachGetTasksQuery(getState, (args) => {
            dispatch(
              tasksApi.util.updateQueryData("getTasks", args, (draft) => {
                const index = draft.data.findIndex((item) => item.id === id);
                if (index !== -1) draft.data[index] = { ...draft.data[index], ...data };
              }),
            );
          });
        } catch {
          patchResults.forEach((patch) => patch.undo());
        }
      },
      invalidatesTags: (result, error, { id, body }) => {
        const tags: Array<{ type: "Tasks" | "TaskDependencies"; id: string }> = [
          { type: "Tasks", id },
          { type: "Tasks", id: "LIST" },
          { type: "Tasks", id: "STATS" },
        ];
        const projectId =
          typeof body.projectId === "string" ? body.projectId : result?.projectId;
        if (projectId) {
          tags.push({ type: "Tasks", id: `PROJECT_${projectId}` });
          tags.push({ type: "TaskDependencies", id: projectId });
        }
        return tags;
      },
    }),

    updateTaskBundle: builder.mutation<Task, UpdateTaskBundlePayload>({
      query: ({ taskId, payload, files = [] }) => {
        const formData = new FormData();
        formData.append("payload", JSON.stringify(payload));
        for (const file of files) {
          formData.append("files", file);
        }
        return {
          url: `/tasks/${taskId}/bundle`,
          method: "PATCH",
          body: formData,
        };
      },
      invalidatesTags: (result, _error, { taskId, payload }) => {
        const tags: Array<{ type: "Tasks" | "TaskDependencies"; id: string }> = [
          { type: "Tasks", id: taskId },
          { type: "Tasks", id: "LIST" },
          { type: "Tasks", id: "STATS" },
          { type: "TaskDependencies", id: "LIST" },
        ];
        const projectId =
          typeof payload.projectId === "string" ? payload.projectId : result?.projectId;
        if (projectId) {
          tags.push({ type: "Tasks", id: `PROJECT_${projectId}` });
          tags.push({ type: "TaskDependencies", id: projectId });
        }
        return tags;
      },
    }),

    deleteTask: builder.mutation<void, string>({
      query: (id) => ({
        url: `/tasks/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [
        { type: "Tasks", id: "LIST" },
        { type: "Tasks", id: "STATS" },
      ],
    }),

    getTaskComments: builder.query<TaskComment[], string>({
      query: (taskId) => `/tasks/${taskId}/comments`,
      providesTags: (result, error, taskId) => [{ type: "Tasks", id: taskId }],
    }),

    addTaskComment: builder.mutation<TaskComment, AddTaskCommentPayload>({
      query: ({ taskId, body, isInternal = true }) => ({
        url: `/tasks/${taskId}/comments`,
        method: "POST",
        body: { body, isInternal },
      }),
      async onQueryStarted({ taskId, body, isInternal = true }, { dispatch, queryFulfilled, getState }) {
        const patchResults: Array<{ undo: () => void }> = [];
        const commentsState = tasksApi.endpoints.getTaskComments.select(taskId)(getState());
        const optimisticId = `optimistic-${Date.now()}`;

        if (commentsState?.data) {
          patchResults.push(
            dispatch(
              tasksApi.util.updateQueryData("getTaskComments", taskId, (draft) => {
                draft.push({
                  id: optimisticId,
                  taskId,
                  authorId: "",
                  body,
                  isInternal,
                  createdAt: new Date().toISOString(),
                  author: { id: "", displayName: "You", email: "" },
                });
              }),
            ),
          );
        }

        const taskByIdState = tasksApi.endpoints.getTaskById.select(taskId)(getState());
        if (taskByIdState?.data) {
          patchResults.push(
            dispatch(
              tasksApi.util.updateQueryData("getTaskById", taskId, (draft) => {
                const next = {
                  id: optimisticId,
                  taskId,
                  authorId: "",
                  body,
                  isInternal,
                  createdAt: new Date().toISOString(),
                  author: { id: "", displayName: "You", email: "" },
                };
                draft.comments = [...(draft.comments ?? []), next];
              }),
            ),
          );
        }

        forEachGetTasksQuery(getState, (args) => {
          patchResults.push(
            dispatch(
              tasksApi.util.updateQueryData("getTasks", args, (draft) => {
                const task = draft.data.find((item) => item.id === taskId);
                if (!task) return;
                const next = {
                  id: optimisticId,
                  taskId,
                  authorId: "",
                  body,
                  isInternal,
                  createdAt: new Date().toISOString(),
                  author: { id: "", displayName: "You", email: "" },
                };
                task.comments = [...(task.comments ?? []), next];
              }),
            ),
          );
        });

        try {
          const { data } = await queryFulfilled;
          if (commentsState?.data) {
            dispatch(
              tasksApi.util.updateQueryData("getTaskComments", taskId, (draft) => {
                const index = draft.findIndex((comment) => comment.id === optimisticId);
                if (index !== -1) draft[index] = data;
                else draft.push(data);
              }),
            );
          }
        } catch {
          patchResults.forEach((patch) => patch.undo());
        }
      },
      invalidatesTags: (result, error, { taskId }) => [{ type: "Tasks", id: taskId }],
    }),

    getTaskAttachments: builder.query<TaskAttachment[], string>({
      query: (taskId) => `/tasks/${taskId}/attachments`,
      providesTags: (result, error, taskId) => [{ type: "Tasks", id: taskId }],
    }),

    addTaskAttachment: builder.mutation<TaskAttachment, AddTaskAttachmentPayload>({
      query: ({ taskId, ...body }) => ({
        url: `/tasks/${taskId}/attachments`,
        method: "POST",
        body,
      }),
      invalidatesTags: (result, error, { taskId }) => [{ type: "Tasks", id: taskId }],
    }),

    deleteTaskAttachment: builder.mutation<void, { taskId: string; attachmentId: string }>({
      query: ({ taskId, attachmentId }) => ({
        url: `/tasks/${taskId}/attachments/${attachmentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { taskId }) => [{ type: "Tasks", id: taskId }],
    }),

    getTaskProgressUpdates: builder.query<TaskProgressUpdate[], string>({
      query: (taskId) => `/tasks/${taskId}/progress-updates`,
      providesTags: (result, error, taskId) => [
        { type: "Tasks", id: taskId },
        { type: "TaskProgress", id: taskId },
      ],
    }),

    getPendingProgressReviews: builder.query<
      PendingProgressReviewsResponse,
      { projectId?: string; page?: number; limit?: number }
    >({
      query: ({ projectId, page = 1, limit = 20 }) => {
        const params = new URLSearchParams();
        if (projectId) params.append("projectId", projectId);
        params.append("page", String(page));
        params.append("limit", String(limit));
        return `/tasks/progress-reviews/pending?${params.toString()}`;
      },
      providesTags: [{ type: "TaskProgress", id: "PENDING" }],
    }),

    submitTaskProgressUpdate: builder.mutation<TaskProgressUpdate, SubmitProgressUpdatePayload>({
      query: ({ taskId, ...body }) => ({
        url: `/tasks/${taskId}/progress-updates`,
        method: "POST",
        body,
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: "Tasks", id: taskId },
        { type: "Tasks", id: "LIST" },
        { type: "Tasks", id: "STATS" },
        { type: "TaskProgress", id: taskId },
        { type: "TaskProgress", id: "PENDING" },
      ],
    }),

    reviewTaskProgressUpdate: builder.mutation<TaskProgressUpdate, ReviewProgressUpdatePayload>({
      query: ({ taskId, updateId, ...body }) => ({
        url: `/tasks/${taskId}/progress-updates/${updateId}/review`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { taskId }) => [
        { type: "Tasks", id: taskId },
        { type: "Tasks", id: "LIST" },
        { type: "Tasks", id: "STATS" },
        { type: "TaskProgress", id: taskId },
        { type: "TaskProgress", id: "PENDING" },
      ],
    }),

    getTaskDependencies: builder.query<
      TaskDependency[],
      { projectId?: string; taskId?: string }
    >({
      query: ({ projectId, taskId }) => {
        const params = new URLSearchParams();
        if (projectId) params.append("projectId", projectId);
        if (taskId) params.append("taskId", taskId);
        return `/tasks/dependencies?${params.toString()}`;
      },
      providesTags: (result, error, arg) => [
        { type: "TaskDependencies", id: arg.taskId ?? "LIST" },
        ...(arg.projectId ? [{ type: "TaskDependencies" as const, id: arg.projectId }] : []),
      ],
    }),

    validateTaskDependency: builder.mutation<
      ValidateTaskDependencyResponse,
      CreateTaskDependencyPayload
    >({
      query: (body) => ({
        url: "/tasks/dependencies/validate",
        method: "POST",
        body,
      }),
    }),

    createTaskDependency: builder.mutation<TaskDependency, CreateTaskDependencyPayload>({
      query: (body) => ({
        url: "/tasks/dependencies",
        method: "POST",
        body,
      }),
      invalidatesTags: (result) => [
        { type: "TaskDependencies", id: "LIST" },
        ...(result
          ? [
              { type: "TaskDependencies" as const, id: result.predecessorId },
              { type: "TaskDependencies" as const, id: result.successorId },
              { type: "TaskDependencies" as const, id: result.predecessor.projectId },
              { type: "Tasks" as const, id: result.successorId },
              { type: "Tasks" as const, id: result.predecessorId },
              { type: "Tasks" as const, id: "LIST" },
            ]
          : []),
      ],
    }),

    updateTaskDependency: builder.mutation<
      TaskDependency,
      { id: string; body: { depType?: TaskDependencyType; lagDays?: number } }
    >({
      query: ({ id, body }) => ({
        url: `/tasks/dependencies/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result) =>
        result
          ? [
              { type: "TaskDependencies", id: "LIST" },
              { type: "TaskDependencies", id: result.predecessorId },
              { type: "TaskDependencies", id: result.successorId },
              { type: "TaskDependencies", id: result.predecessor.projectId },
              { type: "Tasks", id: result.successorId },
              { type: "Tasks", id: result.predecessorId },
              { type: "Tasks", id: "LIST" },
            ]
          : [{ type: "TaskDependencies", id: "LIST" }],
    }),

    deleteTaskDependency: builder.mutation<void, string>({
      query: (id) => ({
        url: `/tasks/dependencies/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "TaskDependencies", id: "LIST" }, { type: "Tasks", id: "LIST" }],
    }),
  }),
});

export const {
  useGetTasksQuery,
  useGetActiveTaskStatsQuery,
  useLazyExportTasksQuery,
  useExportTasksQuery,
  useGetTaskByIdQuery,
  useCreateTaskMutation,
  useCreateTaskBundleMutation,
  useUpdateTaskMutation,
  useUpdateTaskBundleMutation,
  useDeleteTaskMutation,
  useGetTaskCommentsQuery,
  useAddTaskCommentMutation,
  useGetTaskAttachmentsQuery,
  useAddTaskAttachmentMutation,
  useDeleteTaskAttachmentMutation,
  useGetTaskProgressUpdatesQuery,
  useGetPendingProgressReviewsQuery,
  useSubmitTaskProgressUpdateMutation,
  useReviewTaskProgressUpdateMutation,
  useGetTaskDependenciesQuery,
  useValidateTaskDependencyMutation,
  useCreateTaskDependencyMutation,
  useUpdateTaskDependencyMutation,
  useDeleteTaskDependencyMutation,
} = tasksApi;
