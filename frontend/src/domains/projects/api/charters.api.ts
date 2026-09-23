import { api } from "@/core/api/api";
import type {
  ApproveProjectCharterPayload,
  ProjectCharter,
  UpdateProjectCharterPayload,
} from "../types/charter.types";

export const chartersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProjectCharter: builder.query<ProjectCharter, string>({
      query: (projectId) => `/projects/${projectId}/charter`,
      providesTags: (_result, _error, projectId) => [
        { type: "ProjectCharter", id: projectId },
      ],
    }),
    updateProjectCharter: builder.mutation<
      ProjectCharter,
      { projectId: string; body: UpdateProjectCharterPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/charter`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "ProjectCharter", id: projectId },
        "Projects",
      ],
    }),
    approveProjectCharter: builder.mutation<
      ProjectCharter,
      { projectId: string; body: ApproveProjectCharterPayload }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/charter/approve`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "ProjectCharter", id: projectId },
        "Projects",
      ],
    }),
  }),
});

export const {
  useGetProjectCharterQuery,
  useUpdateProjectCharterMutation,
  useApproveProjectCharterMutation,
} = chartersApi;

/**
 * Download charter PDF via direct fetch (avoids caching a Blob in Redux).
 */
export async function downloadCharterPdf(projectId: string): Promise<void> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "/api";
  const normalizedBase = apiBase.replace(/\/$/, "");
  const hasV1InBase =
    normalizedBase.endsWith("/v1") || normalizedBase.includes("/api/v1");
  const versionPrefix = hasV1InBase ? "" : "/v1";

  const url = `${normalizedBase}${versionPrefix}/projects/${projectId}/charter/export`;
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Export failed (${response.status})`);
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disposition);
  const filename = match
    ? decodeURIComponent(match[1].replace(/"/g, "").trim())
    : `charter-${projectId}.pdf`;
  const anchor = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
