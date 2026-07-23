"use client";

import { ProgressApprovalsPage } from "@/domains/tasks";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function ProgressApprovalsRoute() {
  return (
    <PermissionGate
      action="approve"
      subject="Task"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to review task progress.
        </div>
      }
    >
      <ProgressApprovalsPage />
    </PermissionGate>
  );
}
