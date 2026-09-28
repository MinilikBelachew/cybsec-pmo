"use client";

import { SowsPortfolioPage } from "@/domains/projects";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function SowsRoute() {
  return (
    <PermissionGate
      action="read"
      subject="Project"
      fallback={
        <div className="mx-auto max-w-lg py-16 text-center text-muted-foreground">
          You do not have permission to view Statements of Work.
        </div>
      }
    >
      <SowsPortfolioPage />
    </PermissionGate>
  );
}
