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

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.includes("/login")) return;
  const locale = window.location.pathname.split("/")[1] || "en";
  window.location.assign(`/${locale}/login?error=session_failed`);
}

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
    } else {
      // Refresh failed — session is actually gone. Clear auth and leave the app.
      // Do not clear auth on a lone 401 from a resource endpoint (permission/access
      // errors must not wipe the logged-in user display mid-page).
      const hadUser = Boolean((api.getState() as RootState).auth.user);
      api.dispatch(clearUser());
      if (hadUser) redirectToLogin();
    }
  }

  return result;
};
