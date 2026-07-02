import { api } from "@/core/api/api";
import type {
  MppImportPreview,
  MppImportResultSummary,
} from "../types/mpp-import.types";

export const mppImportApi = api.injectEndpoints({
  endpoints: (builder) => ({
    previewMppImport: builder.mutation<
      MppImportPreview,
      { projectId?: string; file: File }
    >({
      query: ({ projectId, file }) => {
        const formData = new FormData();
        if (projectId) formData.append("projectId", projectId);
        formData.append("file", file);
        return {
          url: "/imports/mpp/preview",
          method: "POST",
          body: formData,
        };
      },
    }),

    importMpp: builder.mutation<
      MppImportResultSummary,
      { projectId: string; file: File }
    >({
      query: ({ projectId, file }) => {
        const formData = new FormData();
        formData.append("projectId", projectId);
        formData.append("file", file);
        return {
          url: "/imports/mpp",
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "Tasks", id: "LIST" },
        { type: "Tasks", id: projectId },
        { type: "TaskDependencies", id: "LIST" },
      ],
    }),
  }),
});

export const { usePreviewMppImportMutation, useImportMppMutation } =
  mppImportApi;
