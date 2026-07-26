"use client";

import { DataQualityPage } from "@/domains/reports";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function DataQualityRoute() {
  return <PermissionGate action="read" subject="Report"><DataQualityPage /></PermissionGate>;
}
