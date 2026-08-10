"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { cn } from "@/shared/utils/cn";
import { KekaConnectionForm } from "./keka-connection-form";
import { KekaIntegrationPanel } from "./keka-integration-panel";

type KekaPageTab = "connection" | "sync";

export function KekaIntegrationPage() {
  const [tab, setTab] = useState<KekaPageTab>("sync");

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
          description="Configure Keka authentication, then run syncs and review logs or failed records."
        />
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("sync")}
          data-testid="keka-tab-sync"
          className={cn(
            "-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-all",
            tab === "sync"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Sync
        </button>
        <button
          type="button"
          onClick={() => setTab("connection")}
          data-testid="keka-tab-connection"
          className={cn(
            "-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-all",
            tab === "connection"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Connection
        </button>
      </div>

      {tab === "connection" ? <KekaConnectionForm /> : <KekaIntegrationPanel />}
    </div>
  );
}
