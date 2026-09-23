"use client";

import { ZohoBooksIntegrationPage } from "@/domains/integrations/components/zoho/zoho-books-integration-page";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function ZohoBooksIntegrationRoute() {
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
      <ZohoBooksIntegrationPage />
    </PermissionGate>
  );
}
