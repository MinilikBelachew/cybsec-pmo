"use client";

import { KekaIntegrationPage } from "@/domains/integrations";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function KekaIntegrationRoute() {
  return (
    <PermissionGate
      action="read"
      subject="Integration"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to view integrations.
        </div>
      }
    >
      <KekaIntegrationPage />
    </PermissionGate>
  );
}
