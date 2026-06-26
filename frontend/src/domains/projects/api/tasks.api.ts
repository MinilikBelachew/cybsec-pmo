import { api } from "@/core/api/api";
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
} from "../types/tasks.types";

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
        const tags: { type: "Tasks"; id: string }[] = [{ type: "Tasks", id: "LIST" }];
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
        const tags: { type: "Tasks"; id: string }[] = [{ type: "Tasks", id: "LIST" }];
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
      invalidatesTags: (result, error, { id, body }) => {
        const tags: { type: "Tasks"; id: string }[] = [
          { type: "Tasks", id },
          { type: "Tasks", id: "LIST" },
        ];
        const projectId =
          typeof body.projectId === "string" ? body.projectId : result?.projectId;
        if (projectId) {
          tags.push({ type: "Tasks", id: `PROJECT_${projectId}` });
        }
        return tags;
      },
    }),

    deleteTask: builder.mutation<void, string>({
      query: (id) => ({
        url: `/tasks/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Tasks", id: "LIST" }],
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
  }),
});

export const {
  useGetTasksQuery,
  useLazyExportTasksQuery,
  useExportTasksQuery,
  useGetTaskByIdQuery,
  useCreateTaskMutation,
  useCreateTaskBundleMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useGetTaskCommentsQuery,
  useAddTaskCommentMutation,
  useGetTaskAttachmentsQuery,
  useAddTaskAttachmentMutation,
  useDeleteTaskAttachmentMutation,
} = tasksApi;
