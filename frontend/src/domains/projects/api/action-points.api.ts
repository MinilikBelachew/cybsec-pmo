import { api } from "@/core/api/api";
import type {
  ActionPoint,
  CreateActionPointPayload,
  UpdateActionPointPayload,
} from "../types/action-points.types";

export const actionPointsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getActionPoints: builder.query<ActionPoint[], string>({
      query: (projectId) => `/projects/${projectId}/action-points`,
      providesTags: (_r, _e, projectId) => [
        { type: "ActionPoints", id: projectId },
      ],
    }),

    createActionPoint: builder.mutation<
      ActionPoint,
      { projectId: string; body: CreateActionPointPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/action-points`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "ActionPoints", id: projectId },
        { type: "Notifications", id: "LIST" },
      ],
    }),

    updateActionPoint: builder.mutation<
      ActionPoint,
      { projectId: string; actionPointId: string; body: UpdateActionPointPayload }
    >({
      query: ({ projectId, actionPointId, body }) => ({
        url: `/projects/${projectId}/action-points/${actionPointId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "ActionPoints", id: projectId },
        { type: "Notifications", id: "LIST" },
      ],
    }),

    deleteActionPoint: builder.mutation<
      void,
      { projectId: string; actionPointId: string }
    >({
      query: ({ projectId, actionPointId }) => ({
        url: `/projects/${projectId}/action-points/${actionPointId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "ActionPoints", id: projectId },
      ],
    }),
  }),
});

export const {
  useGetActionPointsQuery,
  useCreateActionPointMutation,
  useUpdateActionPointMutation,
  useDeleteActionPointMutation,
} = actionPointsApi;
