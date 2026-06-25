"use client";

import { AuditTrailPage } from "@/domains/audit";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function AuditRoute() {
  return (
    <PermissionGate
      action="read"
      subject="AuditLog"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to view the audit trail.
        </div>
      }
    >
      <AuditTrailPage />
    </PermissionGate>
  );
}
