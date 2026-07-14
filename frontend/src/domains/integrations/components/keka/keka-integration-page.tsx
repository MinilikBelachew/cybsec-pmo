"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { KekaIntegrationPanel } from "./keka-integration-panel";

export function KekaIntegrationPage() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="space-y-3">
        <Link
          href="/dashboard/integrations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All integrations
        </Link>
        <PageHeader
          title="Keka integration"
          description="Sync log and unresolved failure records for the Keka HR connector."
        />
      </div>

      <KekaIntegrationPanel />
    </div>
  );
}
