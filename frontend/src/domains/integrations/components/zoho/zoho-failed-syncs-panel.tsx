"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  useGetZohoFailedSyncsQuery,
  useRetryZohoSyncMutation,
} from "../../api/integrations.api";
import type { ZohoFailedSyncStatusFilter } from "../../types/integrations.types";

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "data" in err) {
    return String(
      (err as { data?: { message?: string } }).data?.message ?? fallback,
    );
  }
  return fallback;
}

type ZohoFailedSyncsPanelProps = {
  integration: "zoho_crm" | "zoho_books";
  title?: string;
};

export function ZohoFailedSyncsPanel({
  integration,
  title = "Failed sync records",
}: ZohoFailedSyncsPanelProps) {
  const [status, setStatus] = useState<ZohoFailedSyncStatusFilter>("pending");
  const [page, setPage] = useState(1);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = useGetZohoFailedSyncsQuery({
    integration,
    page,
    limit: 10,
    status,
  });
  const [retrySync] = useRetryZohoSyncMutation();

  const rows = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  async function onRetry(id: string, isDeadLetter: boolean) {
    setRetryingId(id);
    try {
      const result = await retrySync({ failedSyncRecordId: id }).unwrap();
      if (result.success) {
        toast.success(
          isDeadLetter
            ? result.message || "Force retry succeeded."
            : result.message || "Retry succeeded.",
        );
      } else {
        toast.error(result.message || "Retry failed.");
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not retry sync."));
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            Unresolved: {data?.unresolvedCount ?? 0}. Auto-retry runs hourly;
            use Retry / Force retry for stuck rows.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus((v as ZohoFailedSyncStatusFilter) ?? "pending");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]" size="sm">
              <SelectValue>
                {status === "pending"
                  ? "Pending"
                  : status === "dead_letter"
                    ? "Dead letter"
                    : status === "resolved"
                      ? "Resolved"
                      : "All"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="dead_letter">Dead letter</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="p-5 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          No failed sync records in this filter.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-semibold">Entity</th>
                <th className="px-4 py-2 font-semibold">Error</th>
                <th className="px-4 py-2 font-semibold">Retries</th>
                <th className="px-4 py-2 font-semibold">Last attempted</th>
                <th className="px-4 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60 align-top">
                  <td className="px-4 py-2">
                    <p className="font-medium">{row.entityType}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.entityId ?? "—"}
                    </p>
                    {row.isDeadLetter ? (
                      <span className="mt-1 inline-block rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                        Dead letter
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 max-w-[320px] text-muted-foreground">
                    {row.errorMsg}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{row.retryCount}</td>
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {new Date(row.lastAttempted).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {!row.isResolved ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={retryingId === row.id}
                        onClick={() => void onRetry(row.id, row.isDeadLetter)}
                        data-testid={`zoho-retry-${row.id}`}
                      >
                        {retryingId === row.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : null}
                        {row.isDeadLetter ? "Force retry" : "Retry"}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Resolved</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
