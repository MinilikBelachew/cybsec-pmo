"use client";

import { useParams } from "next/navigation";
import { StatusReportPreviewPage } from "@/domains/reports";
import { PermissionGate } from "@/shared/components/permission-gate";

export default function StatusReportPreviewRoute() {
  const params = useParams<{ id: string }>();
  return <PermissionGate action="read" subject="Report"><StatusReportPreviewPage id={params.id} /></PermissionGate>;
}
