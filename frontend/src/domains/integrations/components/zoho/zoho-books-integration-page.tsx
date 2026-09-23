"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";

export function ZohoBooksIntegrationPage() {
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
          title="Zoho Books"
          description="Invoice, collection status, and auto project charter (M5.4 / M5.5). Not built yet — CRM opportunity sync is live under Zoho CRM."
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">Coming in the next Phase 5 slice</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Sync invoices (number, amount, due date, paid / unpaid / overdue)</li>
          <li>Collection date and finance alerts</li>
          <li>Confirmed order → draft project charter</li>
        </ul>
        <p className="pt-2">
          For now use{" "}
          <Link
            href="/dashboard/integrations/zoho"
            className="font-semibold text-primary hover:underline"
          >
            Zoho CRM
          </Link>{" "}
          to sync deals/opportunities.
        </p>
      </div>
    </div>
  );
}
