"use client";

import { LogHoursPage } from "@/domains/resources";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function LogHoursRoute() {
  return (
    <PermissionGate
      action="update"
      subject="Timesheet"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to log hours.
        </div>
      }
    >
      <LogHoursPage />
    </PermissionGate>
  );
}
