"use client";

import { Bell } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { Badge } from "@/shared/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  useGetNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  type NotificationRecord,
} from "@/domains/notifications";
import { NotificationListItem } from "@/domains/notifications/components/notification-list-item";
import { resolveNotificationHref } from "@/domains/notifications/utils/notification-navigation";

export function NotificationBell() {
  const router = useRouter();
  const { data: unreadData } = useGetUnreadNotificationCountQuery(undefined, {
    pollingInterval: 30_000,
  });
  const { data, isLoading } = useGetNotificationsQuery(
    { page: 1, limit: 10 },
    { pollingInterval: 30_000 },
  );
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, { isLoading: isMarkingAll }] = useMarkAllNotificationsReadMutation();

  const unreadCount = unreadData?.count ?? data?.meta.unreadCount ?? 0;
  const notifications = data?.data ?? [];

  const handleOpenNotification = async (notification: NotificationRecord) => {
    if (!notification.readAt) {
      try {
        await markRead(notification.id).unwrap();
      } catch {
        // Bell still navigates even if mark-read fails.
      }
    }

    const href = resolveNotificationHref(notification);
    if (href) {
      router.push(href);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex items-center justify-center size-9 rounded-xl hover:bg-muted/60 transition-all group outline-none"
        aria-label="Open notifications"
      >
        <Bell className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 size-2 rounded-full bg-rose-500 border-2 border-background animate-pulse" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 md:w-96 p-0 overflow-hidden rounded-xl border border-border/60 bg-background"
      >
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold">Notifications</span>
            {unreadCount > 0 && (
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border-none text-[9px] px-1.5 py-0"
              >
                {unreadCount} New
              </Badge>
            )}
          </div>
          <button
            type="button"
            disabled={unreadCount === 0 || isMarkingAll}
            onClick={() => void markAllRead()}
            className="text-[10px] font-semibold text-primary hover:underline px-2 py-1 rounded-md disabled:opacity-50"
          >
            Mark all as read
          </button>
        </div>

        <div className="max-h-[300px] overflow-y-auto divide-y divide-border/30 text-xs">
          {isLoading ? (
            <p className="px-4 py-6 text-center text-muted-foreground">Loading notifications…</p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.map((notification) => (
              <NotificationListItem
                key={notification.id}
                notification={notification}
                onClick={() => void handleOpenNotification(notification)}
                className="py-2.5"
              />
            ))
          )}
        </div>

        <div className="border-t border-border/50 bg-muted/20 px-4 py-2.5 text-center">
          <Link
            href="/dashboard/notifications"
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
