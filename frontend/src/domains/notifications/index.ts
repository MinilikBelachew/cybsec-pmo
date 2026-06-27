export type { NotificationRecord, NotificationsResponse } from "./api/notifications.api";
export {
  notificationsApi,
  useGetNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from "./api/notifications.api";
