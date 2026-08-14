import { api } from "@/core/api/api";
import type {
  CreateRiskPayload,
  ListRisksParams,
  Risk,
  UpdateRiskPayload,
} from "../types/risks.types";

export const risksApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getRisks: builder.query<Risk[], ListRisksParams | void>({
      query: (params) => ({
        url: "/risks",
        params: params ?? undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map((r) => ({ type: "Risks" as const, id: r.id })),
              { type: "Risks", id: "LIST" },
            ]
          : [{ type: "Risks", id: "LIST" }],
    }),

    getProjectRisks: builder.query<Risk[], string>({
      query: (projectId) => `/projects/${projectId}/risks`,
      providesTags: (_r, _e, projectId) => [
        { type: "Risks", id: projectId },
        { type: "Risks", id: "LIST" },
      ],
    }),

    createRisk: builder.mutation<
      Risk,
      { projectId: string; body: CreateRiskPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/risks`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Risks", id: projectId },
        { type: "Risks", id: "LIST" },
        { type: "Notifications", id: "LIST" },
      ],
    }),

    updateRisk: builder.mutation<
      Risk,
      { projectId: string; riskId: string; body: UpdateRiskPayload }
    >({
      query: ({ projectId, riskId, body }) => ({
        url: `/projects/${projectId}/risks/${riskId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { projectId, riskId }) => [
        { type: "Risks", id: projectId },
        { type: "Risks", id: riskId },
        { type: "Risks", id: "LIST" },
        { type: "Notifications", id: "LIST" },
      ],
    }),

    closeRisk: builder.mutation<
      Risk,
      { projectId: string; riskId: string }
    >({
      query: ({ projectId, riskId }) => ({
        url: `/projects/${projectId}/risks/${riskId}/close`,
        method: "PATCH",
      }),
      invalidatesTags: (_r, _e, { projectId, riskId }) => [
        { type: "Risks", id: projectId },
        { type: "Risks", id: riskId },
        { type: "Risks", id: "LIST" },
      ],
    }),

    deleteRisk: builder.mutation<
      void,
      { projectId: string; riskId: string }
    >({
      query: ({ projectId, riskId }) => ({
        url: `/projects/${projectId}/risks/${riskId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Risks", id: projectId },
        { type: "Risks", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetRisksQuery,
  useGetProjectRisksQuery,
  useCreateRiskMutation,
  useUpdateRiskMutation,
  useCloseRiskMutation,
  useDeleteRiskMutation,
} = risksApi;
