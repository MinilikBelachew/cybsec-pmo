"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, GitCompareArrows, Loader2, Plug, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  useGetMilestonesQuery,
  useGetProjectsQuery,
} from "@/domains/projects/api/projects.api";
import {
  useGetZohoBooksStatusQuery,
  useGetZohoInvoicesQuery,
  useLinkZohoInvoiceMilestoneMutation,
  useLinkZohoInvoiceMutation,
  useReconcileZohoInvoicesMutation,
  useSyncZohoInvoicesMutation,
  useTestZohoBooksConnectionMutation,
} from "../../api/integrations.api";
import type {
  ZohoInvoiceReconcileResult,
  ZohoInvoiceRow,
} from "../../types/integrations.types";
import { ZohoFailedSyncsPanel } from "./zoho-failed-syncs-panel";

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    return String(
      (err as { data?: { message?: string } }).data?.message ?? fallback,
    );
  }
  return fallback;
}

function InvoiceMilestoneCell({
  row,
  disabled,
}: {
  row: ZohoInvoiceRow;
  disabled: boolean;
}) {
  const [pick, setPick] = useState<string | undefined>();
  const { data: milestones = [] } = useGetMilestonesQuery(row.projectId!, {
    skip: !row.projectId,
  });
  const [linkMilestone, { isLoading }] = useLinkZohoInvoiceMilestoneMutation();

  if (!row.projectId) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (row.matchedMilestoneId) {
    return (
      <div className="flex min-w-[160px] flex-col gap-1">
        <span className="text-foreground">{row.milestoneTitle ?? "Milestone"}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-fit px-2"
          disabled={disabled || isLoading}
          onClick={async () => {
            try {
              await linkMilestone({ id: row.id, milestoneId: null }).unwrap();
              toast.success("Milestone unlinked");
            } catch (err) {
              toast.error(apiErrorMessage(err, "Unlink failed"));
            }
          }}
        >
          Unlink milestone
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-[220px] items-center gap-2">
      <Select value={pick} onValueChange={(v) => setPick(v ?? undefined)}>
        <SelectTrigger className="h-8 w-[160px]" size="sm">
          <SelectValue placeholder="Milestone">
            {milestones.find((m) => m.id === pick)?.title}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {milestones.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        disabled={disabled || isLoading || !pick}
        onClick={async () => {
          if (!pick) return;
          try {
            await linkMilestone({ id: row.id, milestoneId: pick }).unwrap();
            toast.success("Invoice linked to milestone");
            setPick(undefined);
          } catch (err) {
            toast.error(apiErrorMessage(err, "Link failed"));
          }
        }}
        data-testid={`zoho-books-milestone-link-${row.id}`}
      >
        Link
      </Button>
    </div>
  );
}

export function ZohoBooksIntegrationPage() {
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } =
    useGetZohoBooksStatusQuery();
  const { data: invoices = [], isLoading: listLoading, refetch: refetchList } =
    useGetZohoInvoicesQuery({ limit: 100 });
  const { data: projectsResponse } = useGetProjectsQuery({ page: 1, limit: 200 });
  const projects = projectsResponse?.data ?? [];
  const [testConnection, { isLoading: testing }] =
    useTestZohoBooksConnectionMutation();
  const [syncInvoices, { isLoading: syncing }] = useSyncZohoInvoicesMutation();
  const [reconcileInvoices, { isLoading: reconciling }] =
    useReconcileZohoInvoicesMutation();
  const [linkInvoice, { isLoading: linking }] = useLinkZohoInvoiceMutation();
  const [linkPick, setLinkPick] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "unlinked" | "linked">("all");
  const [reconcileResult, setReconcileResult] =
    useState<ZohoInvoiceReconcileResult | null>(null);

  const busy = testing || syncing || linking || reconciling;
  const ready = Boolean(status?.booksConfigured);

  const visible = useMemo(() => {
    if (filter === "unlinked") return invoices.filter((r) => !r.projectId);
    if (filter === "linked") return invoices.filter((r) => Boolean(r.projectId));
    return invoices;
  }, [invoices, filter]);

  const unlinkedCount = invoices.filter((r) => !r.projectId).length;

  async function onTest() {
    try {
      const result = await testConnection().unwrap();
      toast.success(result.message);
      await refetchStatus();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Test failed"));
    }
  }

  async function onSync() {
    try {
      const result = await syncInvoices().unwrap();
      const soSummary = `Confirmed SOs: ${result.ordersCreated} charter(s) created (${result.ordersConfirmed} confirmed, ${result.ordersSkipped} skipped, ${result.ordersFailed} failed)`;
      if (result.ordersFailed > 0 && result.ordersError) {
        toast.error(
          `Invoices OK (${result.upserted} saved). Sales orders failed: ${result.ordersError}`,
        );
      } else {
        toast.success(
          `Synced invoices: ${result.upserted} saved (${result.fetched} fetched, ${result.unmatched} unlinked, ${result.failed} failed). ${soSummary}`,
        );
      }
      await Promise.all([refetchStatus(), refetchList()]);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Sync failed"));
    }
  }

  async function onReconcile() {
    try {
      const result = await reconcileInvoices().unwrap();
      setReconcileResult(result);
      const exceptions =
        result.missingInPmo +
        result.missingInBooks +
        result.fieldMismatch +
        result.unlinked;
      if (exceptions === 0) {
        toast.success(
          `Reconciled: ${result.matched} matched (${result.booksCount} Books / ${result.pmoCount} PMO)`,
        );
      } else {
        toast.success(
          `Reconciled with ${exceptions} exception(s) — see report below`,
        );
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Reconcile failed"));
    }
  }

  async function onLink(invoiceId: string) {
    const projectId = linkPick[invoiceId];
    if (!projectId) {
      toast.error("Select a project first");
      return;
    }
    try {
      await linkInvoice({ id: invoiceId, projectId }).unwrap();
      toast.success("Invoice linked to project");
      setLinkPick((prev) => {
        const next = { ...prev };
        delete next[invoiceId];
        return next;
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Link failed"));
    }
  }

  async function onUnlink(invoiceId: string) {
    try {
      await linkInvoice({ id: invoiceId, projectId: null }).unwrap();
      toast.success("Invoice unlinked");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unlink failed"));
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
          description="Invoices and confirmed sales orders sync Zoho Books → PMO on a nightly schedule (or Sync now). Confirmed SOs create one Draft project + charter (skipped if the linked CRM Deal already provisioned). Link invoice project/milestone in PMO when auto-match cannot; retry failed rows below if the API fails."
        />
      </div>

      <div className="rounded-xl border border-border bg-card px-5 py-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Sync direction</p>
        <p className="mt-1">
          Invoice amount / due / paid / collection: <strong>Zoho Books → PMO</strong>.
          Confirmed sales orders: <strong>Zoho Books → Draft project + charter</strong>{" "}
          (no duplicate when SO is linked to a Deal that already created one).
          Project and milestone links on invoices are owned in PMO (manual fallback when sync or
          auto-match fails). Approved SOW PDFs attach to the linked Sales Order when present;
          failed SOW attachments appear in the queue below for admin Retry.
        </p>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || !ready}
              onClick={onReconcile}
              data-testid="zoho-books-reconcile"
            >
              {reconciling ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <GitCompareArrows className="size-3.5" />
              )}
              Reconcile
            </Button>
          </div>
        </div>

        {statusLoading ? (
          <p className="text-sm text-muted-foreground">Loading status…</p>
        ) : status ? (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
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
              <dt className="text-xs text-muted-foreground">Unlinked</dt>
              <dd className="font-semibold">{status.unmatchedOpenCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">SO charters</dt>
              <dd className="font-semibold">
                {status.confirmedOrderCharterCount ?? 0}
              </dd>
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

      {reconcileResult ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Reconciliation report</h2>
              <p className="text-xs text-muted-foreground">
                Live Zoho Books vs PMO compare (read-only). Sync to pull missing
                or drifted invoices; link unlinked rows below.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReconcileResult(null)}
            >
              Dismiss
            </Button>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Matched</dt>
              <dd className="font-semibold">{reconcileResult.matched}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Missing in PMO</dt>
              <dd className="font-semibold text-amber-700 dark:text-amber-400">
                {reconcileResult.missingInPmo}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Missing in Books</dt>
              <dd className="font-semibold">{reconcileResult.missingInBooks}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Field mismatch</dt>
              <dd className="font-semibold text-destructive">
                {reconcileResult.fieldMismatch}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Unlinked in PMO</dt>
              <dd className="font-semibold">{reconcileResult.unlinked}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Books / PMO counts</dt>
              <dd className="font-semibold">
                {reconcileResult.booksCount} / {reconcileResult.pmoCount}
              </dd>
            </div>
          </dl>
          {reconcileResult.issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No exceptions — Books and PMO agree on compared fields.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Kind</th>
                    <th className="px-3 py-2 font-semibold">Invoice</th>
                    <th className="px-3 py-2 font-semibold">Project</th>
                    <th className="px-3 py-2 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {reconcileResult.issues.map((issue) => (
                    <tr
                      key={`${issue.kind}-${issue.zohoInvoiceId}-${issue.details.slice(0, 24)}`}
                      className="border-t border-border/60 align-top"
                    >
                      <td className="px-3 py-2 whitespace-nowrap font-medium">
                        {issue.kind === "missing_in_pmo"
                          ? "Missing in PMO"
                          : issue.kind === "missing_in_books"
                            ? "Missing in Books"
                            : issue.kind === "field_mismatch"
                              ? "Field mismatch"
                              : "Unlinked"}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium">
                          {issue.invoiceNumber ?? issue.zohoInvoiceId}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {issue.zohoInvoiceId}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {issue.projectName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[420px]">
                        {issue.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <ZohoFailedSyncsPanel integration="zoho_books" />

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Synced invoices</h2>
            <p className="text-xs text-muted-foreground">
              Link to a project first, then optionally to a milestone (
              {unlinkedCount} unlinked). Scroll horizontally to see all columns.
            </p>
          </div>
          <Select
            value={filter}
            onValueChange={(v) =>
              setFilter((v as "all" | "unlinked" | "linked") ?? "all")
            }
          >
            <SelectTrigger className="w-[160px]" size="sm">
              <SelectValue>
                {filter === "all"
                  ? "All"
                  : filter === "unlinked"
                    ? "Unlinked"
                    : "Linked"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unlinked">Unlinked</SelectItem>
              <SelectItem value="linked">Linked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {listLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            {invoices.length === 0
              ? "No invoices yet. Sync from Zoho Books to import them."
              : "No invoices in this filter."}
          </p>
        ) : (
          <div className="overflow-x-scroll overscroll-x-contain pb-1 [scrollbar-gutter:stable]">
            <table className="min-w-[1600px] w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-semibold">Number</th>
                  <th className="px-4 py-2 font-semibold">Customer</th>
                  <th className="px-4 py-2 font-semibold">Reference</th>
                  <th className="px-4 py-2 font-semibold">Project</th>
                  <th className="px-4 py-2 font-semibold">Milestone</th>
                  <th className="px-4 py-2 font-semibold">Amount</th>
                  <th className="px-4 py-2 font-semibold min-w-[300px]">Discrepancy</th>
                  <th className="px-4 py-2 font-semibold">Balance</th>
                  <th className="px-4 py-2 font-semibold">Paid</th>
                  <th className="px-4 py-2 font-semibold whitespace-nowrap">Invoice date</th>
                  <th className="px-4 py-2 font-semibold whitespace-nowrap">Due</th>
                  <th className="px-4 py-2 font-semibold whitespace-nowrap">Collected</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Link</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-t border-border/60 align-top">
                    <td className="px-4 py-2 font-medium whitespace-nowrap">
                      {row.invoiceNumber}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                      {row.customerName ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[140px] truncate">
                      {row.referenceNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {row.projectId ? (
                        <span className="text-foreground">
                          {row.projectName ?? row.projectId}
                        </span>
                      ) : (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          Unlinked
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <InvoiceMilestoneCell row={row} disabled={busy} />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {row.amount} {row.currency}
                    </td>
                    <td className="px-4 py-2 min-w-[300px] max-w-[380px]">
                      {row.discrepancyNote ? (
                        <span
                          className="inline-block w-full rounded bg-destructive/10 px-2 py-1.5 text-[11px] font-medium leading-snug text-destructive"
                          title={row.discrepancyNote}
                        >
                          {row.discrepancyNote}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                      {row.balance != null ? `${row.balance} ${row.currency}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                      {row.paymentMade != null
                        ? `${row.paymentMade} ${row.currency}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                      {row.invoiceDate ?? "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {row.dueDate ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                      {row.collectionDate ?? "—"}
                    </td>
                    <td className="px-4 py-2">{row.status}</td>
                    <td className="px-4 py-2">
                      {row.projectId ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => onUnlink(row.id)}
                        >
                          Unlink
                        </Button>
                      ) : (
                        <div className="flex min-w-[220px] items-center gap-2">
                          <Select
                            value={linkPick[row.id]}
                            onValueChange={(v) =>
                              setLinkPick((prev) => ({
                                ...prev,
                                [row.id]: v ?? "",
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 w-[160px]" size="sm">
                              <SelectValue placeholder="Select project">
                                {projects.find((p) => p.id === linkPick[row.id])
                                  ?.name}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {projects.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy || !linkPick[row.id]}
                            onClick={() => onLink(row.id)}
                            data-testid={`zoho-books-link-${row.id}`}
                          >
                            Link
                          </Button>
                        </div>
                      )}
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
