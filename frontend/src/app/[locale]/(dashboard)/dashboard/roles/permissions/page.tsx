"use client";

import { PermissionsPage } from "@/domains/roles";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function PermissionsRoute() {
  return (
    <PermissionGate
      action="read"
      subject="Rbac"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to view roles and permissions.
        </div>
      }
    >
      <PermissionsPage />
    </PermissionGate>
  );
}
