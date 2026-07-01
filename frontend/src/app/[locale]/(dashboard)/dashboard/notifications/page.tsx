"use client";

import { NotificationsPage } from "@/domains/notifications";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function NotificationsRoute() {
  return (
    <PermissionGate
      action="read"
      subject="Notification"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to view notifications.
        </div>
      }
    >
      <NotificationsPage />
    </PermissionGate>
  );
}
