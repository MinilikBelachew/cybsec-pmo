import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import type { RootState } from "@/store";
import { clearUser } from "@/domains/auth/store/auth.slice";

// ---------------------------------------------------------------------------
// Base query — attaches auth cookies automatically (credentials: "include")
// ---------------------------------------------------------------------------
const rawBaseQuery = fetchBaseQuery({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "/api",
  credentials: "include", // sends HTTP-only cookies on every request
  prepareHeaders: (headers, { getState }) => {
    // Attach any client-side metadata if needed (e.g. locale, tenant)
    const state = getState() as RootState;
    if (state.auth.user?.id) {
      headers.set("x-user-id", state.auth.user.id);
    }
    return headers;
  },
});

// Mock Users for Dev Environment
const MOCK_USERS = [
  { id: "1", name: "Admin User", email: "admin@example.com", password: "admin123", roles: ["admin"] },
  { id: "2", name: "Test User", email: "user@example.com", password: "user123", roles: ["member"] },
];

// ---------------------------------------------------------------------------
// Base query with Mock Interceptor and 401 handling
// ---------------------------------------------------------------------------
export const baseQueryWithInterceptor: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const url = typeof args === "string" ? args : args.url;
  const isMock = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

  // -------------------------------------------------------------------------
  // DEV MOCK INTERCEPTOR
  // -------------------------------------------------------------------------
  if (isMock) {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (url === "/auth/login") {
      const body = (args as FetchArgs).body as any;
      const user = MOCK_USERS.find(u => u.email === body?.email && u.password === body?.password);

      if (!user) {
        return { error: { status: 401, data: { error: "Invalid credentials" } } as FetchBaseQueryError };
      }

      // Set cookie client-side so Next.js proxy middleware authorizes protected routes
      if (typeof document !== "undefined") {
        document.cookie = `access_token=mock-access-${user.id}; path=/; max-age=3600`;
      }

      return { data: { user } };
    }

    if (url === "/auth/me") {
      if (typeof document !== "undefined" && document.cookie.includes("access_token")) {
        const token = document.cookie.split("; ").find(row => row.startsWith("access_token="))?.split("=")[1];
        const userId = token?.replace("mock-access-", "");
        const user = MOCK_USERS.find(u => u.id === userId) || MOCK_USERS[0];
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

  // -------------------------------------------------------------------------
  // REAL API REQUEST
  // -------------------------------------------------------------------------
  const result = await rawBaseQuery(args, api, extraOptions);

  // Simple 401 handling — logs out the user automatically.
  // (In a real app, you could implement a token refresh flow here)
  if (result.error && result.error.status === 401) {
    api.dispatch(clearUser());
  }

  return result;
};
