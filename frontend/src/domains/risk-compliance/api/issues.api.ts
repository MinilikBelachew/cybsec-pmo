import { api } from "@/core/api/api";
import type {
  CloseIssuePayload,
  CreateIssuePayload,
  Issue,
  ListIssuesParams,
  UpdateIssuePayload,
} from "../types/issues.types";

export const issuesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getIssues: builder.query<Issue[], ListIssuesParams | void>({
      query: (params) => ({
        url: "/issues",
        params: params ?? undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map((i) => ({ type: "Issues" as const, id: i.id })),
              { type: "Issues", id: "LIST" },
            ]
          : [{ type: "Issues", id: "LIST" }],
    }),

    getProjectIssues: builder.query<Issue[], string>({
      query: (projectId) => `/projects/${projectId}/issues`,
      providesTags: (_r, _e, projectId) => [
        { type: "Issues", id: projectId },
        { type: "Issues", id: "LIST" },
      ],
    }),

    createIssue: builder.mutation<
      Issue,
      { projectId: string; body: CreateIssuePayload }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/issues`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Issues", id: projectId },
        { type: "Issues", id: "LIST" },
        { type: "Notifications", id: "LIST" },
      ],
    }),

    updateIssue: builder.mutation<
      Issue,
      { projectId: string; issueId: string; body: UpdateIssuePayload }
    >({
      query: ({ projectId, issueId, body }) => ({
        url: `/projects/${projectId}/issues/${issueId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, { projectId, issueId }) => [
        { type: "Issues", id: projectId },
        { type: "Issues", id: issueId },
        { type: "Issues", id: "LIST" },
        { type: "Notifications", id: "LIST" },
      ],
    }),

    closeIssue: builder.mutation<
      Issue,
      { projectId: string; issueId: string; body?: CloseIssuePayload }
    >({
      query: ({ projectId, issueId, body }) => ({
        url: `/projects/${projectId}/issues/${issueId}/close`,
        method: "PATCH",
        body: body ?? {},
      }),
      invalidatesTags: (_r, _e, { projectId, issueId }) => [
        { type: "Issues", id: projectId },
        { type: "Issues", id: issueId },
        { type: "Issues", id: "LIST" },
        { type: "Notifications", id: "LIST" },
      ],
    }),

    deleteIssue: builder.mutation<
      void,
      { projectId: string; issueId: string }
    >({
      query: ({ projectId, issueId }) => ({
        url: `/projects/${projectId}/issues/${issueId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { projectId }) => [
        { type: "Issues", id: projectId },
        { type: "Issues", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetIssuesQuery,
  useGetProjectIssuesQuery,
  useCreateIssueMutation,
  useUpdateIssueMutation,
  useCloseIssueMutation,
  useDeleteIssueMutation,
} = issuesApi;
