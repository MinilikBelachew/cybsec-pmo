"use client";

import { ReportSchedulesPage } from "@/domains/reports";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function ReportSchedulesRoute() {
  return <PermissionGate action="read" subject="Report"><ReportSchedulesPage /></PermissionGate>;
}
