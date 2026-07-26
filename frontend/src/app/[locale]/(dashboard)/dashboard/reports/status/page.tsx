"use client";

import { StatusReportsPage } from "@/domains/reports";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function StatusReportsRoute() {
  return <PermissionGate action="read" subject="Report"><StatusReportsPage /></PermissionGate>;
}
