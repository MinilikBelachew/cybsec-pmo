"use client";

import { ReportsHubPage } from "@/domains/reports";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function ReportsRoute() {
  return (
    <PermissionGate
      action="read"
      subject="Report"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to view reports.
        </div>
      }
    >
      <ReportsHubPage />
    </PermissionGate>
  );
}
