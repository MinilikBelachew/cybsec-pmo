import { api } from "@/core/api/api";

export type SessionPolicy = {
  idleTimeoutMs: number;
  warningAtMs: number;
  warningBeforeMs: number;
};

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSessionPolicy: builder.query<SessionPolicy, void>({
      query: () => "/auth/session-policy",
    }),

    getMe: builder.query<import("../types/auth.types").ApiUser, void>({
      query: () => "/auth/me",
      providesTags: ["User"],
    }),

    refreshSession: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/refresh",
        method: "POST",
      }),
    }),

    sessionHeartbeat: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/session/heartbeat",
        method: "POST",
      }),
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["User", "Auth"],
    }),
  }),
});

export const {
  useGetSessionPolicyQuery,
  useGetMeQuery,
  useLazyGetMeQuery,
  useRefreshSessionMutation,
  useSessionHeartbeatMutation,
  useLogoutMutation,
} = authApi;
