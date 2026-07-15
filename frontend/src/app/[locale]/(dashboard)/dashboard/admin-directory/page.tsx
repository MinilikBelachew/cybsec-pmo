"use client";

import { AdminDirectoryPage } from "@/domains/admin-directory";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function AdminDirectoryRoute() {
  return (
    <PermissionGate
      action="read"
      subject="User"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to view People & Org.
        </div>
      }
    >
      <AdminDirectoryPage />
    </PermissionGate>
  );
}
