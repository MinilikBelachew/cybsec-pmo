"use client";

import { DocumentVaultPage } from "@/domains/documents";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function DocumentVaultRoute() {
  return (
    <PermissionGate
      action="read"
      subject="Document"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to view the Document Vault.
        </div>
      }
    >
      <DocumentVaultPage />
    </PermissionGate>
  );
}
