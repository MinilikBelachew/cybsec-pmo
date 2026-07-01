"use client";

import { Copy, ChevronDown, FileJson, Table2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";
import {
  downloadAuditJson,
  downloadAuditCsv,
  type AuditJsonValue,
  type AuditLogEntry,
  type AuditExportFormat,
} from "../api/audit.api";

const AUDIT_DETAIL_SHEET_CLASS =
  "flex h-full w-full !max-w-[560px] flex-col gap-0 overflow-hidden p-0 rounded-l-[10px] !shadow-none bg-white dark:bg-card";

const ENTRY_EXPORT_OPTIONS: {
  format: AuditExportFormat;
  label: string;
  description: string;
  icon: React.ElementType;
  iconClass: string;
}[] = [
  {
    format: "json",
    label: "JSON",
    description: "Pretty-printed, structured",
    icon: FileJson,
    iconClass: "text-amber-500",
  },
  {
    format: "csv",
    label: "CSV",
    description: "Spreadsheet-compatible row",
    icon: Table2,
    iconClass: "text-emerald-500",
  },
];

type AuditDetailSheetProps = {
  entry: AuditLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AuditDetailSheet({ entry, open, onOpenChange }: AuditDetailSheetProps) {
  const handleExport = (format: AuditExportFormat) => {
    if (!entry) return;
    const base = `audit-event-${entry.id}`;

    if (format === "json") {
      downloadAuditJson(`${base}.json`, entry);
      return;
    }

    if (format === "csv") {
      downloadAuditCsv(`${base}.csv`, [entry]);
      return;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={AUDIT_DETAIL_SHEET_CLASS} showCloseButton>
        {entry && (
          <div className="flex h-full flex-col">
            <SheetHeader
              className={cn(
                "shrink-0 border-b border-border bg-white px-6 py-4 text-left dark:bg-card",
              )}
            >
              <div className="flex items-start justify-between gap-3 pr-8">
                <div>
                  <SheetTitle className="text-lg font-bold">Event details</SheetTitle>
                  <SheetDescription>Read-only audit record with change payload</SheetDescription>
                </div>

                {/* 4-format export dropdown — mirrors the main audit page export menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1.5"
                      />
                    }
                  >
                    Export
                    <ChevronDown className="size-3.5 opacity-60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2 shadow-none">
                    <div className="space-y-1">
                      {ENTRY_EXPORT_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <DropdownMenuItem
                            key={opt.format}
                            onClick={() => handleExport(opt.format)}
                            className={cn(
                              "flex items-start gap-3 rounded-xl border border-transparent px-2.5 py-1.5 cursor-pointer select-none",
                              "hover:border-border/60 hover:bg-muted/50 focus:outline-none focus:bg-muted/50 focus:border-border/60",
                            )}
                          >
                            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                              <Icon className={cn("size-3.5", opt.iconClass)} />
                            </div>
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold">{opt.label}</span>
                              <span className="block text-[10px] text-muted-foreground">
                                {opt.description}
                              </span>
                            </span>
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto bg-white px-6 py-5 dark:bg-card">
              <dl className="space-y-5">
                <DetailRow label="Event ID" value={entry.id} mono />
                <DetailRow label="Time" value={new Date(entry.createdAt).toLocaleString()} />
                <DetailRow label="Action" value={entry.action} mono />
                <DetailRow label="Object type" value={entry.objectType} />
                <DetailRow label="Object ID" value={entry.objectId ?? "—"} mono />
                <DetailRow label="Source" value={entry.source ?? "—"} mono />
                <DetailRow label="Actor" value={entry.user?.displayName ?? "System"} />
                <DetailRow label="Email" value={entry.user?.email ?? "—"} />
                <DetailRow label="IP address" value={entry.ipAddress ?? "—"} mono />
                <DetailRow
                  label="Break-glass"
                  value={entry.breakGlassAction ? "Yes" : "No"}
                />
                <DetailRow label="External user" value={entry.isExternal ? "Yes" : "No"} />
                <JsonDetailRow label="Old value" value={entry.oldValue} />
                <JsonDetailRow label="New value" value={entry.newValue} />
              </dl>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
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
      <dd className={mono ? "break-all font-mono text-sm" : "text-sm break-words"}>{value}</dd>
    </div>
  );
}

function JsonDetailRow({ label, value }: { label: string; value: AuditJsonValue }) {
  const hasValue = value !== null && value !== undefined;
  const formatted = formatAuditJson(value);

  const copyJson = async () => {
    if (!hasValue) return;
    await navigator.clipboard.writeText(formatted);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        {hasValue && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={copyJson}
          >
            <Copy className="size-3" />
            Copy
          </Button>
        )}
      </div>
      <dd>
        {hasValue ? (
          <pre className="max-h-48 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground">
            {formatted}
          </pre>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}

function formatAuditJson(value: AuditJsonValue): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
