"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Plug, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import {
  useGetZohoBooksStatusQuery,
  useGetZohoInvoicesQuery,
  useSyncZohoInvoicesMutation,
  useTestZohoBooksConnectionMutation,
} from "../../api/integrations.api";

export function ZohoBooksIntegrationPage() {
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } =
    useGetZohoBooksStatusQuery();
  const { data: invoices = [], isLoading: listLoading, refetch: refetchList } =
    useGetZohoInvoicesQuery({ limit: 50 });
  const [testConnection, { isLoading: testing }] =
    useTestZohoBooksConnectionMutation();
  const [syncInvoices, { isLoading: syncing }] = useSyncZohoInvoicesMutation();

  const busy = testing || syncing;
  const ready = Boolean(status?.booksConfigured);

  async function onTest() {
    try {
      const result = await testConnection().unwrap();
      toast.success(result.message);
      await refetchStatus();
    } catch (err) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String(
              (err as { data?: { message?: string } }).data?.message ??
                "Test failed",
            )
          : "Test failed";
      toast.error(message);
    }
  }

  async function onSync() {
    try {
      const result = await syncInvoices().unwrap();
      toast.success(
        `Synced invoices: ${result.upserted} saved (${result.fetched} fetched, ${result.unmatched} unmatched, ${result.failed} failed)`,
      );
      await Promise.all([refetchStatus(), refetchList()]);
    } catch (err) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String(
              (err as { data?: { message?: string } }).data?.message ??
                "Sync failed",
            )
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
          title="Zoho Books"
          description="Sync invoices into PMO. Match via Reference # (project UUID) or unique customer→project. See docs/samples for import CSV."
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-bold">Connection status</h2>
            <p className="text-xs text-muted-foreground">
              Needs Zoho OAuth with Books scopes plus{" "}
              <code className="text-[11px]">ZOHO_BOOKS_ORGANIZATION_ID</code>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || !ready}
              onClick={onTest}
              data-testid="zoho-books-test"
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
              disabled={busy || !ready}
              onClick={onSync}
              data-testid="zoho-books-sync-invoices"
            >
              {syncing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Sync invoices
            </Button>
          </div>
        </div>

        {statusLoading ? (
          <p className="text-sm text-muted-foreground">Loading status…</p>
        ) : status ? (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">OAuth configured</dt>
              <dd className="font-semibold">
                {status.configured ? "Yes" : "No — set ZOHO_*"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Books org id</dt>
              <dd className="font-semibold">
                {status.organizationId
                  ? status.organizationId
                  : "Missing ZOHO_BOOKS_ORGANIZATION_ID"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Invoices in PMO</dt>
              <dd className="font-semibold">{status.invoiceCount}</dd>
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
                  {status.unmatchedOpenCount > 0
                    ? ` (${status.unmatchedOpenCount} unmatched)`
                    : ""}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {(status?.recentErrors?.length ?? 0) > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Recent errors
            </p>
            <ul className="space-y-2 text-xs">
              {status!.recentErrors.map((err) => (
                <li
                  key={`${err.entityId}-${err.lastAttempted}`}
                  className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2"
                >
                  <p className="font-medium text-foreground">
                    Invoice {err.entityId}
                  </p>
                  <p className="text-muted-foreground">{err.errorMsg}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-bold">Synced invoices</h2>
          <p className="text-xs text-muted-foreground">
            Matched rows in{" "}
            <code className="text-[11px]">invoices</code>. Unmatched stay in
            failed sync only.
          </p>
        </div>
        {listLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No invoices yet. Import the sample CSV into Zoho Books (set Reference
            = project UUID), then Sync invoices.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-semibold">Number</th>
                  <th className="px-4 py-2 font-semibold">Project</th>
                  <th className="px-4 py-2 font-semibold">Amount</th>
                  <th className="px-4 py-2 font-semibold">Due</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Collected</th>
                  <th className="px-4 py-2 font-semibold">Synced</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((row) => (
                  <tr key={row.id} className="border-t border-border/60">
                    <td className="px-4 py-2 font-medium">{row.invoiceNumber}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {row.projectName ?? row.projectId}
                    </td>
                    <td className="px-4 py-2">
                      {row.amount} {row.currency}
                    </td>
                    <td className="px-4 py-2">{row.dueDate}</td>
                    <td className="px-4 py-2">{row.status}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {row.collectionDate ?? "—"}
                    </td>
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
