import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import type { RootState } from "@/store";
import { clearUser } from "@/domains/auth/store/auth.slice";

type FetchArgsWithRetry = FetchArgs & { _retry?: boolean };

const rawBaseQuery = fetchBaseQuery({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "/api",
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const state = getState() as RootState;
    if (state.auth.user?.id) {
      headers.set("x-user-id", state.auth.user.id);
    }
    return headers;
  },
});

export const baseQueryWithInterceptor: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const url = typeof args === "string" ? args : args.url;

  let result = await rawBaseQuery(args, api, extraOptions);

  const isRetry =
    typeof args !== "string" && Boolean((args as FetchArgsWithRetry)._retry);

  if (
    result.error?.status === 401 &&
    !isRetry &&
    url !== "/auth/refresh" &&
    url !== "/auth/logout"
  ) {
    const refreshResult = await rawBaseQuery(
      { url: "/auth/refresh", method: "POST" },
      api,
      extraOptions,
    );

    if (!refreshResult.error) {
      const retryArgs: FetchArgsWithRetry =
        typeof args === "string"
          ? { url: args, _retry: true }
          : { ...(args as FetchArgs), _retry: true };

      result = await rawBaseQuery(retryArgs, api, extraOptions);
    }
  }

  if (result.error?.status === 401 && url !== "/auth/refresh") {
    api.dispatch(clearUser());
  }

  return result;
};
