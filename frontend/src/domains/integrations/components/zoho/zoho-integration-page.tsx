"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Plug, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import {
  useGetZohoOpportunitiesQuery,
  useGetZohoStatusQuery,
  useSyncZohoOpportunitiesMutation,
  useTestZohoConnectionMutation,
} from "../../api/integrations.api";

export function ZohoIntegrationPage() {
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } =
    useGetZohoStatusQuery();
  const { data: opportunities = [], isLoading: listLoading, refetch: refetchList } =
    useGetZohoOpportunitiesQuery({ limit: 50 });
  const [testConnection, { isLoading: testing }] = useTestZohoConnectionMutation();
  const [syncOpportunities, { isLoading: syncing }] =
    useSyncZohoOpportunitiesMutation();

  const busy = testing || syncing;

  async function onTest() {
    try {
      const result = await testConnection().unwrap();
      toast.success(result.message);
      await refetchStatus();
    } catch (err) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String((err as { data?: { message?: string } }).data?.message ?? "Test failed")
          : "Test failed";
      toast.error(message);
    }
  }

  async function onSync() {
    try {
      const result = await syncOpportunities().unwrap();
      toast.success(
        `Synced opportunities: ${result.upserted} saved (${result.fetched} fetched, ${result.failed} failed)`,
      );
      await Promise.all([refetchStatus(), refetchList()]);
    } catch (err) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String((err as { data?: { message?: string } }).data?.message ?? "Sync failed")
          : "Sync failed";
      toast.error(message);
    }
  }

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
          title="Zoho CRM"
          description="Env-based OAuth connection. Sync Deals (opportunities) into PMO for M5.3 revenue tracking."
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-bold">Connection status</h2>
            <p className="text-xs text-muted-foreground">
              Credentials come from backend{" "}
              <code className="text-[11px]">ZOHO_*</code> env vars (refresh token).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || !status?.configured}
              onClick={onTest}
              data-testid="zoho-test-connection"
            >
              {testing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plug className="size-3.5" />
              )}
              Test connection
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !status?.configured}
              onClick={onSync}
              data-testid="zoho-sync-opportunities"
            >
              {syncing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Sync opportunities
            </Button>
          </div>
        </div>

        {statusLoading ? (
          <p className="text-sm text-muted-foreground">Loading status…</p>
        ) : status ? (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Configured</dt>
              <dd className="font-semibold">
                {status.configured ? "Yes" : "No — set ZOHO_* in .env"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Data center</dt>
              <dd className="font-semibold">{status.dc}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Opportunities in PMO</dt>
              <dd className="font-semibold">{status.opportunityCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last synced</dt>
              <dd className="font-semibold">
                {status.lastSyncedAt
                  ? new Date(status.lastSyncedAt).toLocaleString()
                  : "Never"}
              </dd>
            </div>
            {status.openFailureCount > 0 ? (
              <div>
                <dt className="text-xs text-muted-foreground">Open sync failures</dt>
                <dd className="font-semibold text-destructive">
                  {status.openFailureCount}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-bold">Synced opportunities</h2>
          <p className="text-xs text-muted-foreground">
            Zoho CRM Deals mapped into{" "}
            <code className="text-[11px]">crm_opportunities</code>.
          </p>
        </div>
        {listLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : opportunities.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No opportunities yet. Click Sync opportunities after Test connection succeeds.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-semibold">Name</th>
                  <th className="px-4 py-2 font-semibold">Account</th>
                  <th className="px-4 py-2 font-semibold">Stage</th>
                  <th className="px-4 py-2 font-semibold">Amount</th>
                  <th className="px-4 py-2 font-semibold">Synced</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((row) => (
                  <tr key={row.id} className="border-t border-border/60">
                    <td className="px-4 py-2 font-medium">
                      {row.name ?? row.zohoOpportunityId}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {row.accountName ?? "—"}
                    </td>
                    <td className="px-4 py-2">{row.stage ?? "—"}</td>
                    <td className="px-4 py-2">{row.expectedRevenue ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(row.syncedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
