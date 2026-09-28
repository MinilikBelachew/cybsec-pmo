import { api } from "@/core/api/api";
import type {
  ApproveSowPayload,
  SowDocument,
  UpdateSowPayload,
} from "../types/sow.types";

export const sowsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProjectSow: builder.query<SowDocument, string>({
      query: (projectId) => `/projects/${projectId}/sow`,
      providesTags: (_result, _error, projectId) => [
        { type: "ProjectSow", id: projectId },
      ],
    }),
    createProjectSow: builder.mutation<SowDocument, string>({
      query: (projectId) => ({
        url: `/projects/${projectId}/sow`,
        method: "POST",
        body: {},
      }),
      invalidatesTags: (_result, _error, projectId) => [
        { type: "ProjectSow", id: projectId },
        { type: "ProjectSow", id: "LIST" },
        { type: "Projects", id: projectId },
      ],
    }),
    updateProjectSow: builder.mutation<
      SowDocument,
      { projectId: string; body: UpdateSowPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/sow`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "ProjectSow", id: projectId },
        { type: "ProjectSow", id: "LIST" },
      ],
    }),
    approveProjectSow: builder.mutation<
      SowDocument,
      { projectId: string; body: ApproveSowPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/sow/approve`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "ProjectSow", id: projectId },
        { type: "ProjectSow", id: "LIST" },
        { type: "Projects", id: projectId },
        { type: "Projects", id: "LIST" },
      ],
    }),
    listSows: builder.query<SowDocument[], void>({
      query: () => `/sows`,
      providesTags: [{ type: "ProjectSow", id: "LIST" }],
    }),
  }),
});

export const {
  useGetProjectSowQuery,
  useCreateProjectSowMutation,
  useUpdateProjectSowMutation,
  useApproveProjectSowMutation,
  useListSowsQuery,
} = sowsApi;

/** Download SOW PDF via direct fetch (avoids caching a Blob in Redux). */
export async function downloadSowPdf(projectId: string): Promise<void> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "/api";
  const normalizedBase = apiBase.replace(/\/$/, "");
  const hasV1InBase =
    normalizedBase.endsWith("/v1") || normalizedBase.includes("/api/v1");
  const versionPrefix = hasV1InBase ? "" : "/v1";

  const url = `${normalizedBase}${versionPrefix}/projects/${projectId}/sow/export`;
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Export failed (${response.status})`);
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition);
  const filename = match
    ? decodeURIComponent(match[1].replace(/"/g, "").trim())
    : `sow-${projectId}.pdf`;
  const anchor = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
