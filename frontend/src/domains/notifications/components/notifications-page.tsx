"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { PageHeader } from "@/shared/components/page-header";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "../api/notifications.api";
import { NotificationListItem } from "./notification-list-item";
import { resolveNotificationHref } from "../utils/notification-navigation";
import { useApplyLeaveBackupMutation } from "@/domains/projects";
import { toast } from "react-hot-toast";

const PAGE_SIZE = 20;

export function NotificationsPage() {
  const router = useRouter();
  const [pageIndex, setPageIndex] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading, isFetching } = useGetNotificationsQuery({
    page: pageIndex + 1,
    limit: PAGE_SIZE,
    unreadOnly: unreadOnly || undefined,
  });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, { isLoading: isMarkingAll }] = useMarkAllNotificationsReadMutation();
  const [applyLeaveBackup] = useApplyLeaveBackupMutation();

  const notifications = data?.data ?? [];
  const meta = data?.meta;
  const unreadCount = meta?.unreadCount ?? 0;

  const handleOpenNotification = async (notification: (typeof notifications)[number]) => {
    if (!notification.readAt) {
      try {
        await markRead(notification.id).unwrap();
      } catch {
        // Navigation still proceeds if mark-read fails.
      }
    }

    const href = resolveNotificationHref(notification);
    if (href) {
      router.push(href);
    }
  };

  const handleApplyBackup = async (notification: (typeof notifications)[number]) => {
    const projectId =
      typeof notification.payload.projectId === "string"
        ? notification.payload.projectId
        : null;
    const taskId =
      typeof notification.payload.taskId === "string"
        ? notification.payload.taskId
        : null;

    if (!projectId || !taskId) {
      toast.error("Missing project or task for backup assignment.");
      return;
    }

    try {
      const result = await applyLeaveBackup({ projectId, taskId }).unwrap();
      if (!notification.readAt) {
        await markRead(notification.id).unwrap();
      }
      toast.success(`Task reassigned to ${result.ownerName ?? "backup resource"}.`);
      router.push(`/dashboard/projects/${projectId}?taskId=${taskId}`);
    } catch {
      toast.error("Could not assign backup resource.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Notifications"
        description="All activity updates, assignments, and review requests in one place."
        actions={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
                {unreadCount} unread
              </Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={unreadCount === 0 || isMarkingAll}
              onClick={() => void markAllRead()}
            >
              Mark all as read
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={unreadOnly ? "outline" : "secondary"}
          onClick={() => {
            setUnreadOnly(false);
            setPageIndex(0);
          }}
        >
          All
        </Button>
        <Button
          type="button"
          size="sm"
          variant={unreadOnly ? "secondary" : "outline"}
          onClick={() => {
            setUnreadOnly(true);
            setPageIndex(0);
          }}
        >
          Unread only
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs">
        {isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Loading notifications…
          </p>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {unreadOnly ? "No unread notifications." : "No notifications yet."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Task assignments and updates will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {notifications.map((notification) => (
              <NotificationListItem
                key={notification.id}
                notification={notification}
                onClick={() => void handleOpenNotification(notification)}
                onApplyBackup={(item) => void handleApplyBackup(item)}
              />
            ))}
          </div>
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Page {meta.page} of {meta.totalPages} · {meta.total} total
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pageIndex === 0 || isFetching}
              onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={meta.page >= meta.totalPages || isFetching}
              onClick={() => setPageIndex((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
