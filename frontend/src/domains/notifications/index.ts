export type { NotificationRecord, NotificationsResponse } from "./api/notifications.api";
export {
  notificationsApi,
  useGetNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from "./api/notifications.api";
export { NotificationsPage } from "./components/notifications-page";
export { NotificationListItem } from "./components/notification-list-item";
export {
  notificationIcon,
  notificationIconClass,
  resolveNotificationHref,
} from "./utils/notification-navigation";
