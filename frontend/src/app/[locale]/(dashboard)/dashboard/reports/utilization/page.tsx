"use client";

import { UtilizationReportPage } from "@/domains/reports";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function UtilizationReportRoute() {
  return (
    <PermissionGate
      action="read"
      subject="Report"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to view utilization reports.
        </div>
      }
    >
      <UtilizationReportPage />
    </PermissionGate>
  );
}
