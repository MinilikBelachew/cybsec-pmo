"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Bell, CheckCircle2, Clock, Plus } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { Badge } from "@/shared/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";
import {
  useGetNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  type NotificationRecord,
} from "@/domains/notifications";

function notificationIcon(eventType: string) {
  switch (eventType) {
    case "TASK_ASSIGNED":
      return <Plus className="size-4 text-blue-500" />;
    case "TASK_UPDATED":
      return <Clock className="size-4 text-amber-500" />;
    case "PROGRESS_SUBMITTED":
      return <Clock className="size-4 text-violet-500" />;
    case "PROGRESS_APPROVED":
      return <CheckCircle2 className="size-4 text-emerald-500" />;
    case "PROGRESS_REJECTED":
    case "PROGRESS_REWORK":
      return <AlertTriangle className="size-4 text-rose-500" />;
    default:
      return <Bell className="size-4 text-primary" />;
  }
}

function resolveNotificationHref(notification: NotificationRecord): string | null {
  const payload = notification.payload;
  const link = payload.link;
  if (typeof link === "string" && link.length > 0) {
    return link;
  }

  const projectId = payload.projectId;
  const taskId = payload.taskId;
  const progressUpdateId = payload.progressUpdateId;

  if (typeof projectId === "string" && typeof taskId === "string") {
    const params = new URLSearchParams({ taskId });

    if (
      notification.eventType === "PROGRESS_SUBMITTED" &&
      typeof progressUpdateId === "string"
    ) {
      params.set("reviewProgress", "1");
      params.set("progressUpdateId", progressUpdateId);
    } else if (
      notification.eventType === "PROGRESS_APPROVED" ||
      notification.eventType === "PROGRESS_REJECTED" ||
      notification.eventType === "PROGRESS_REWORK"
    ) {
      params.set("progress", "1");
    }

    return `/dashboard/projects/${projectId}?${params.toString()}`;
  }

  if (typeof projectId === "string") {
    return `/dashboard/projects/${projectId}`;
  }

  return null;
}

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
              <button
                key={notification.id}
                type="button"
                onClick={() => void handleOpenNotification(notification)}
                className={cn(
                  "w-full flex gap-3 px-4 py-2.5 text-left transition-all hover:bg-muted/40 relative group",
                  !notification.readAt && "bg-primary/5",
                )}
              >
                <div className="size-8 rounded-lg flex items-center justify-center shrink-0 border border-border bg-card">
                  {notificationIcon(notification.eventType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <p
                      className={cn(
                        "text-xs font-bold truncate",
                        !notification.readAt ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {notification.title}
                    </p>
                    <span className="text-[9px] text-muted-foreground/50 shrink-0">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-normal">
                    {notification.body}
                  </p>
                </div>
                {!notification.readAt && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full" />
                )}
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
