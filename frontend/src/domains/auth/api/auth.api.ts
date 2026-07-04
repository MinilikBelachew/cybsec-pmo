import { api } from "@/core/api/api";
import type { ApiUser, SessionPolicy } from "../types/auth.types";
import type { PermissionRow } from "../types/permissions.types";

export type { SessionPolicy } from "../types/auth.types";

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSessionPolicy: builder.query<SessionPolicy, void>({
      query: () => "/auth/session-policy",
    }),

    getMe: builder.query<ApiUser, void>({
      query: () => "/auth/me",
      providesTags: ["User"],
    }),

    getMyPermissions: builder.query<
      PermissionRow[],
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
      { user: ApiUser; breakGlass: true },
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
      { user: ApiUser; breakGlass: true },
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
