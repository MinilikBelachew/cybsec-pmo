import { api } from "@/core/api/api";
import type {
  MppImportPreview,
  MppImportResultSummary,
  MppPortfolioImportDefaults,
} from "../types/mpp-import.types";
import type { ImportEnqueueResult } from "./imports.api";

export const mppImportApi = api.injectEndpoints({
  endpoints: (builder) => ({
    previewMppImport: builder.mutation<
      MppImportPreview,
      { projectId?: string; file: File; timeZone?: string }
    >({
      query: ({ projectId, file, timeZone }) => {
        const formData = new FormData();
        if (projectId) formData.append("projectId", projectId);
        if (timeZone) formData.append("timeZone", timeZone);
        formData.append("file", file);
        return {
          url: "/imports/mpp/preview",
          method: "POST",
          body: formData,
        };
      },
    }),

    importMpp: builder.mutation<
      ImportEnqueueResult,
      { projectId: string; file: File; timeZone?: string }
    >({
      query: ({ projectId, file, timeZone }) => {
        const formData = new FormData();
        formData.append("projectId", projectId);
        if (timeZone) formData.append("timeZone", timeZone);
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
      ImportEnqueueResult,
      { file: File; defaults: MppPortfolioImportDefaults; timeZone?: string }
    >({
      query: ({ file, defaults, timeZone }) => {
        const formData = new FormData();
        formData.append("file", file);
        if (timeZone) formData.append("timeZone", timeZone);

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

    exportMspdi: builder.mutation<
      Blob,
      { projectId: string; timeZone?: string }
    >({
      query: ({ projectId, timeZone }) => ({
        url: `/imports/mspdi/export/${projectId}`,
        method: "GET",
        params: timeZone ? { timeZone } : undefined,
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

// Re-export for callers that still expect the old summary type name in imports.
export type { MppImportResultSummary };
