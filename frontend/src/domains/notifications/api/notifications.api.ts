import { api } from "@/core/api/api";

export type {
  NotificationRecord,
  NotificationsResponse,
} from "../types/notifications.types";

import type {
  NotificationRecord,
  NotificationsResponse,
} from "../types/notifications.types";

export const notificationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<
      NotificationsResponse,
      { page?: number; limit?: number; unreadOnly?: boolean } | void
    >({
      query: (params) => ({
        url: "/notifications",
        params: params ?? {},
      }),
      providesTags: ["Notifications"],
    }),

    getUnreadNotificationCount: builder.query<{ count: number }, void>({
      query: () => ({ url: "/notifications/unread-count" }),
      providesTags: ["Notifications"],
    }),

    markNotificationRead: builder.mutation<NotificationRecord, string>({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: "PATCH",
      }),
      invalidatesTags: ["Notifications"],
    }),

    markAllNotificationsRead: builder.mutation<{ updatedCount: number }, void>({
      query: () => ({
        url: "/notifications/read-all",
        method: "PATCH",
      }),
      invalidatesTags: ["Notifications"],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi;
