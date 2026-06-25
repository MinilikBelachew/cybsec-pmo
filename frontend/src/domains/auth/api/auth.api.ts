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

    getMyPermissions: builder.query<
      import("../types/permissions.types").PermissionRow[],
      void
    >({
      query: () => "/auth/me/permissions",
      providesTags: ["Permissions"],
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
      invalidatesTags: ["User", "Auth", "Permissions"],
    }),

    activateBreakGlass: builder.mutation<
      { user: import("../types/auth.types").ApiUser; breakGlass: true },
      { reason: string }
    >({
      query: (body) => ({
        url: "/auth/break-glass",
        method: "POST",
        body,
      }),
      invalidatesTags: ["User", "Auth", "Permissions"],
    }),

    emergencyLogin: builder.mutation<
      { user: import("../types/auth.types").ApiUser; breakGlass: true },
      { email: string; secret: string; reason: string }
    >({
      query: (body) => ({
        url: "/auth/emergency-login",
        method: "POST",
        body,
      }),
      invalidatesTags: ["User", "Auth", "Permissions"],
    }),

    stopBreakGlass: builder.mutation<{ redirectTo: "entra" | "login" }, void>({
      query: () => ({
        url: "/auth/break-glass/stop",
        method: "POST",
      }),
      invalidatesTags: ["User", "Auth", "Permissions"],
    }),
  }),
});

export const {
  useGetSessionPolicyQuery,
  useGetMeQuery,
  useLazyGetMeQuery,
  useGetMyPermissionsQuery,
  useLazyGetMyPermissionsQuery,
  useRefreshSessionMutation,
  useSessionHeartbeatMutation,
  useLogoutMutation,
  useActivateBreakGlassMutation,
  useEmergencyLoginMutation,
  useStopBreakGlassMutation,
} = authApi;
