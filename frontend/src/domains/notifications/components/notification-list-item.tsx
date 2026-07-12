"use client";

import { formatDistanceToNow } from "date-fns";
import { cn } from "@/shared/utils/cn";
import type { NotificationRecord } from "../api/notifications.api";
import {
  notificationIcon,
  notificationIconClass,
} from "../utils/notification-navigation";

type NotificationListItemProps = {
  notification: NotificationRecord;
  onClick: () => void;
  onApplyBackup?: (notification: NotificationRecord) => void;
  className?: string;
};

export function NotificationListItem({
  notification,
  onClick,
  onApplyBackup,
  className,
}: NotificationListItemProps) {
  const Icon = notificationIcon(notification.eventType);
  const canApplyBackup =
    notification.eventType === "LEAVE_CRITICAL_CONFLICT" &&
    notification.payload.canApplyBackup === true;
  const backupName =
    typeof notification.payload.backupName === "string"
      ? notification.payload.backupName
      : "backup";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 relative group",
        !notification.readAt && "bg-muted/20",
        className,
      )}
    >
      <div className="size-9 rounded-lg flex items-center justify-center shrink-0 border border-border bg-card">
        <Icon className={cn("size-4", notificationIconClass(notification.eventType))} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-sm font-semibold truncate",
              !notification.readAt ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {notification.title}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
          {notification.body}
        </p>
        {canApplyBackup && onApplyBackup && (
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-primary hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              onApplyBackup(notification);
            }}
          >
            Assign {backupName} now
          </button>
        )}
      </div>
      {!notification.readAt && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-primary rounded-r-full" />
      )}
    </button>
  );
}
