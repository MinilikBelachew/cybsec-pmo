import { api } from "@/core/api/api";
import type {
  Meeting,
  MeetingInput,
  MomDocument,
} from "../types/meetings.types";

export const meetingsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMeetings: builder.query<Meeting[], string>({
      query: (projectId) => `/projects/${projectId}/meetings`,
      providesTags: (_result, _error, projectId) => [
        { type: "Projects", id: `meetings-${projectId}` },
      ],
    }),
    getMeeting: builder.query<
      Meeting,
      { projectId: string; meetingId: string }
    >({
      query: ({ projectId, meetingId }) =>
        `/projects/${projectId}/meetings/${meetingId}`,
    }),
    createMeeting: builder.mutation<
      Meeting,
      { projectId: string; body: MeetingInput }
    >({
      query: ({ projectId, body }) => ({
        url: `/projects/${projectId}/meetings`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "Projects", id: `meetings-${projectId}` },
      ],
    }),
    updateMeeting: builder.mutation<
      Meeting,
      { projectId: string; meetingId: string; body: Partial<MeetingInput> }
    >({
      query: ({ projectId, meetingId, body }) => ({
        url: `/projects/${projectId}/meetings/${meetingId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "Projects", id: `meetings-${projectId}` },
      ],
    }),
    deleteMeeting: builder.mutation<
      void,
      { projectId: string; meetingId: string }
    >({
      query: ({ projectId, meetingId }) => ({
        url: `/projects/${projectId}/meetings/${meetingId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "Projects", id: `meetings-${projectId}` },
        { type: "Projects", id: `moms-${projectId}` },
      ],
    }),
    deleteMom: builder.mutation<void, { projectId: string; momId: string }>({
      query: ({ projectId, momId }) => ({
        url: `/projects/${projectId}/meetings/moms/${momId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "Projects", id: `moms-${projectId}` },
      ],
    }),
    generateMom: builder.mutation<
      MomDocument,
      { projectId: string; meetingId: string }
    >({
      query: ({ projectId, meetingId }) => ({
        url: `/projects/${projectId}/meetings/${meetingId}/mom`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "Projects", id: `meetings-${projectId}` },
        { type: "Projects", id: `moms-${projectId}` },
      ],
    }),
    getMoms: builder.query<MomDocument[], string>({
      query: (projectId) => `/projects/${projectId}/meetings/moms`,
      providesTags: (_result, _error, projectId) => [
        { type: "Projects", id: `moms-${projectId}` },
      ],
    }),
    getMom: builder.query<MomDocument, { projectId: string; momId: string }>({
      query: ({ projectId, momId }) =>
        `/projects/${projectId}/meetings/moms/${momId}`,
    }),
    reviewMom: builder.mutation<
      MomDocument,
      { projectId: string; momId: string }
    >({
      query: ({ projectId, momId }) => ({
        url: `/projects/${projectId}/meetings/moms/${momId}/review`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "Projects", id: `moms-${projectId}` },
      ],
    }),
    distributeMom: builder.mutation<
      MomDocument,
      { projectId: string; momId: string }
    >({
      query: ({ projectId, momId }) => ({
        url: `/projects/${projectId}/meetings/moms/${momId}/distribute`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "Projects", id: `moms-${projectId}` },
      ],
    }),
    acknowledgeMom: builder.mutation<
      MomDocument,
      { projectId: string; momId: string }
    >({
      query: ({ projectId, momId }) => ({
        url: `/projects/${projectId}/meetings/moms/${momId}/acknowledge`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: "Projects", id: `moms-${projectId}` },
      ],
    }),
  }),
});

export const {
  useGetMeetingsQuery,
  useGetMeetingQuery,
  useCreateMeetingMutation,
  useUpdateMeetingMutation,
  useDeleteMeetingMutation,
  useDeleteMomMutation,
  useGenerateMomMutation,
  useGetMomsQuery,
  useGetMomQuery,
  useReviewMomMutation,
  useDistributeMomMutation,
  useAcknowledgeMomMutation,
} = meetingsApi;

/**
 * Download a MoM export via direct fetch (avoids caching a Blob in Redux).
 */
export async function downloadMomExport(
  projectId: string,
  momId: string,
  format: "pdf" | "docx",
): Promise<void> {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "/api";
  const normalizedBase = apiBase.replace(/\/$/, "");

  // Some environments set NEXT_PUBLIC_API_URL to ".../api/v1" already.
  const hasV1InBase =
    normalizedBase.endsWith("/v1") || normalizedBase.includes("/api/v1");
  const versionPrefix = hasV1InBase ? "" : "/v1";

  const url = `${normalizedBase}${versionPrefix}/projects/${projectId}/meetings/moms/${momId}/export?format=${format}`;
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Export failed (${response.status})`);
  const blob = await response.blob();
  const anchor = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  anchor.href = objectUrl;
  anchor.download = `mom-${momId}.${format}`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
