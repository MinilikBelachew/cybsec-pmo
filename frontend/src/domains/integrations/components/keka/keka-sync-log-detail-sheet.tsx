"use client";

import { useState } from "react";
import { Copy, Loader2, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import type { KekaSyncLogEntry } from "../../types/integrations.types";

const DETAIL_SHEET_CLASS =
  "flex h-full w-full !max-w-[560px] flex-col gap-0 overflow-hidden p-0 rounded-l-[10px] !shadow-none bg-white dark:bg-card";

type KekaSyncLogDetailSheetProps = {
  entry: KekaSyncLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRetry: boolean;
  isRetrying: boolean;
  onRetry: (entry: KekaSyncLogEntry) => void;
};

export function KekaSyncLogDetailSheet({
  entry,
  open,
  onOpenChange,
  canRetry,
  isRetrying,
  onRetry,
}: KekaSyncLogDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={DETAIL_SHEET_CLASS} showCloseButton>
        {entry && (
          <div className="flex h-full flex-col">
            <SheetHeader
              className={cn(
                "shrink-0 border-b border-border bg-white px-6 py-4 text-left dark:bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="min-w-0">
                  <SheetTitle className="text-lg font-bold">Sync log details</SheetTitle>
                  <SheetDescription className="mt-1">
                    {entry.summary?.trim() ||
                      `${entry.status} ${entry.direction} ${entry.entityType} sync`}
                  </SheetDescription>
                </div>
                {canRetry && entry.status === "failed" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    disabled={isRetrying}
                    onClick={() => onRetry(entry)}
                    data-testid="keka-sync-log-detail-retry"
                  >
                    {isRetrying ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    Retry
                  </Button>
                ) : null}
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto bg-white px-6 py-5 dark:bg-card">
              <dl className="space-y-5">
                <DetailRow label="What happened" value={entry.summary?.trim() || "—"} />
                <div className="space-y-1.5">
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd>
                    <StatusBadge status={entry.status} />
                  </dd>
                </div>
                <DetailRow
                  label="Entity"
                  value={
                    entry.entityName
                      ? `${capitalize(entry.entityType)} · ${entry.entityName}`
                      : capitalize(entry.entityType)
                  }
                />
                <DetailRow label="Entity ID" value={entry.entityId} mono />
                <DetailRow
                  label="Project"
                  value={entry.projectName?.trim() || "—"}
                />
                {entry.projectId ? (
                  <DetailRow label="Project ID" value={entry.projectId} mono />
                ) : null}
                <DetailRow label="Direction" value={capitalize(entry.direction)} />
                <DetailRow
                  label="Retries"
                  value={String(entry.retryCount)}
                />
                <DetailRow
                  label="Time"
                  value={new Date(entry.createdAt).toLocaleString()}
                />
                <DetailRow
                  label="Failure"
                  value={entry.errorMsg?.trim() || "—"}
                />
                <JsonDetailRow
                  key={`${entry.id}-payload`}
                  label="Payload"
                  value={entry.payload ?? null}
                />
              </dl>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") {
    return (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
        Success
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50">
        Failed
      </Badge>
    );
  }
  return (
    <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
      {capitalize(status)}
    </Badge>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "break-all font-mono text-sm"
            : "whitespace-pre-wrap break-words text-sm"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function JsonDetailRow({ label, value }: { label: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const hasValue = value !== null && value !== undefined;
  const formatted = formatJson(value);

  const copyJson = async () => {
    if (!hasValue) return;
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        {hasValue ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={() => void copyJson()}
          >
            <Copy className="size-3" />
            {copied ? "Copied" : "Copy"}
          </Button>
        ) : null}
      </div>
      <dd>
        {hasValue ? (
          <pre className="max-h-64 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground">
            {formatted}
          </pre>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
