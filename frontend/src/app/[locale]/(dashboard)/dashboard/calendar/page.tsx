"use client";

import { ResourceCalendarPage } from "@/domains/resources";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function ResourceCalendarRoute() {
  return (
    <PermissionGate
      action="read"
      subject="Team"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to view the resource calendar.
        </div>
      }
    >
      <ResourceCalendarPage />
    </PermissionGate>
  );
}
