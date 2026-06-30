import { api } from "@/core/api/api";
import type { GlobalSearchParams, GlobalSearchResponse } from "../types/search.types";

export const searchApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getGlobalSearch: builder.query<GlobalSearchResponse, GlobalSearchParams>({
      query: ({ q, category, limit }) => ({
        url: "/search",
        params: {
          ...(q?.trim() ? { q: q.trim() } : {}),
          ...(category && category !== "all" ? { category } : {}),
          ...(limit ? { limit } : {}),
        },
      }),
    }),
  }),
});

export const { useGetGlobalSearchQuery, useLazyGetGlobalSearchQuery } = searchApi;
