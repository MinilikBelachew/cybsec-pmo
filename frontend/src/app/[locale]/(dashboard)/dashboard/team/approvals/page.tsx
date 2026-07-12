"use client";

import { StaffingApprovalsPage } from "@/domains/resources/components/staffing-approvals-page";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function TeamApprovalsRoutePage() {
  return (
    <PermissionGate
      action="approve"
      subject="Team"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to review staffing approvals.
        </div>
      }
    >
      <StaffingApprovalsPage />
    </PermissionGate>
  );
}
