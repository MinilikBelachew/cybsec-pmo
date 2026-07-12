"use client";

import { ApprovalQueuePage } from "@/domains/resources";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function ApprovalQueueRoute() {
  return (
    <PermissionGate
      action="approve"
      subject="Timesheet"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to approve timesheets.
        </div>
      }
    >
      <ApprovalQueuePage />
    </PermissionGate>
  );
}
