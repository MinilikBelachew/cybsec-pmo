import { api } from "@/core/api/api";
import type {
  MppImportPreview,
  MppImportResultSummary,
  MppPortfolioImportDefaults,
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

    importMppPortfolio: builder.mutation<
      MppImportResultSummary,
      { file: File; defaults: MppPortfolioImportDefaults }
    >({
      query: ({ file, defaults }) => {
        const formData = new FormData();
        formData.append("file", file);

        const appendIf = (key: string, value: string | number | undefined) => {
          if (value === undefined || value === null) return;
          const text = String(value).trim();
          if (!text) return;
          formData.append(key, text);
        };

        appendIf("objective", defaults.objective);
        appendIf("departmentId", defaults.departmentId);
        appendIf("customerId", defaults.customerId);
        appendIf("engagementType", defaults.engagementType);
        appendIf("billingModel", defaults.billingModel);
        appendIf("priority", defaults.priority);
        if (defaults.value != null && Number.isFinite(defaults.value)) {
          formData.append("value", String(defaults.value));
        }
        appendIf("currency", defaults.currency);
        appendIf("primaryPmId", defaults.primaryPmId);
        if (defaults.projects?.length) {
          const projectsJson = JSON.stringify(defaults.projects);
          formData.append("projectsJson", projectsJson);
          // Back-compat for older backends
          formData.append("projects", projectsJson);
        }

        return {
          url: "/imports/mpp/portfolio",
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: [
        { type: "Projects", id: "LIST" },
        { type: "Tasks", id: "LIST" },
        { type: "TaskDependencies", id: "LIST" },
      ],
    }),

    exportMspdi: builder.mutation<Blob, { projectId: string }>({
      query: ({ projectId }) => ({
        url: `/imports/mspdi/export/${projectId}`,
        method: "GET",
        responseHandler: async (response) => response.blob(),
      }),
    }),
  }),
});

export const {
  usePreviewMppImportMutation,
  useImportMppMutation,
  useImportMppPortfolioMutation,
  useExportMspdiMutation,
} = mppImportApi;
