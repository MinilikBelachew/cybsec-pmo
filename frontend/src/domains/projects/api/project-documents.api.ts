import { api } from "@/core/api/api";
import type {
  CreateWorkspaceDocumentPayload,
  GetWorkspaceDocumentsParams,
  WorkspaceDocument,
} from "../types/project-documents.types";

export const projectDocumentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProjectDocuments: builder.query<WorkspaceDocument[], GetWorkspaceDocumentsParams>({
      query: ({ projectId, category, phaseId, milestoneId, taskId }) => {
        const params = new URLSearchParams();
        if (category) params.append("category", category);
        if (phaseId) params.append("phaseId", phaseId);
        if (milestoneId) params.append("milestoneId", milestoneId);
        if (taskId) params.append("taskId", taskId);
        const qs = params.toString();
        return `/projects/${projectId}/documents${qs ? `?${qs}` : ""}`;
      },
      providesTags: (_result, _error, { projectId }) => [
        { type: "WorkspaceDocuments", id: projectId },
      ],
    }),

    createProjectDocument: builder.mutation<WorkspaceDocument, CreateWorkspaceDocumentPayload>({
      query: ({ projectId, ...body }) => ({
        url: `/projects/${projectId}/documents`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "WorkspaceDocuments", id: projectId },
        { type: "WorkspaceDocuments", id: "VAULT_LIST" },
        { type: "WorkspaceDocuments", id: "VAULT_STATS" },
        { type: "Tasks", id: "LIST" },
      ],
    }),

    deleteProjectDocument: builder.mutation<
      void,
      { projectId: string; documentId: string }
    >({
      query: ({ projectId, documentId }) => ({
        url: `/projects/${projectId}/documents/${documentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "WorkspaceDocuments", id: projectId },
        { type: "WorkspaceDocuments", id: "VAULT_LIST" },
        { type: "WorkspaceDocuments", id: "VAULT_STATS" },
        { type: "Tasks", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetProjectDocumentsQuery,
  useCreateProjectDocumentMutation,
  useDeleteProjectDocumentMutation,
} = projectDocumentsApi;
