"use client";

import { ActiveTasksPage } from "@/domains/tasks";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function ActiveTasksRoute() {
  return (
    <PermissionGate
      action="read"
      subject="Task"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to view tasks.
        </div>
      }
    >
      <ActiveTasksPage />
    </PermissionGate>
  );
}
