import { api } from "@/core/api/api";
import type {
  DocumentVaultStats,
  GetVaultDocumentsParams,
  PaginatedVaultDocumentsResponse,
} from "../types/documents.types";

export const documentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getVaultDocuments: builder.query<
      PaginatedVaultDocumentsResponse,
      GetVaultDocumentsParams
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", String(params.page));
        if (params.limit) queryParams.append("limit", String(params.limit));
        if (params.search) queryParams.append("search", params.search);
        if (params.projectId) queryParams.append("projectId", params.projectId);
        if (params.category) queryParams.append("category", params.category);
        const qs = queryParams.toString();
        return `/documents${qs ? `?${qs}` : ""}`;
      },
      providesTags: (result) => {
        const tags: { type: "WorkspaceDocuments"; id: string }[] = [
          { type: "WorkspaceDocuments", id: "VAULT_LIST" },
        ];
        if (result?.data) {
          tags.push(
            ...result.data.map(({ id }) => ({
              type: "WorkspaceDocuments" as const,
              id,
            })),
          );
        }
        return tags;
      },
    }),

    getDocumentVaultStats: builder.query<DocumentVaultStats, void>({
      query: () => "/documents/stats",
      providesTags: [{ type: "WorkspaceDocuments", id: "VAULT_STATS" }],
    }),
  }),
});

export const {
  useGetVaultDocumentsQuery,
  useGetDocumentVaultStatsQuery,
} = documentsApi;
