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

const MOCK_USERS = [
  { id: "1", name: "Admin User", email: "admin@example.com", password: "admin123", roles: ["admin"] },
  { id: "2", name: "Test User", email: "user@example.com", password: "user123", roles: ["member"] },
];

export const baseQueryWithInterceptor: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const url = typeof args === "string" ? args : args.url;
  const isMock = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (url === "/auth/login") {
      const body = (args as FetchArgs).body as { email?: string; password?: string };
      const user = MOCK_USERS.find(
        (u) => u.email === body?.email && u.password === body?.password,
      );

      if (!user) {
        return {
          error: {
            status: 401,
            data: { error: "Invalid credentials" },
          } as FetchBaseQueryError,
        };
      }

      if (typeof document !== "undefined") {
        document.cookie = `access_token=mock-access-${user.id}; path=/; max-age=3600`;
      }

      return { data: { user } };
    }

    if (url === "/auth/me") {
      if (typeof document !== "undefined" && document.cookie.includes("access_token")) {
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("access_token="))
          ?.split("=")[1];
        const userId = token?.replace("mock-access-", "");
        const user = MOCK_USERS.find((u) => u.id === userId) || MOCK_USERS[0];
        return { data: user };
      }
      return { error: { status: 401, data: { error: "Unauthenticated" } } as FetchBaseQueryError };
    }

    if (url === "/auth/logout") {
      if (typeof document !== "undefined") {
        document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      return { data: { success: true } };
    }
  }

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
