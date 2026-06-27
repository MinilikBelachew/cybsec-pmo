"use client";

import { RolesPage } from "@/domains/roles";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function RolesRoute() {
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
      <RolesPage />
    </PermissionGate>
  );
}
