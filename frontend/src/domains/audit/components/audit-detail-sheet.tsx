"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { cn } from "@/shared/utils/cn";
import { type AuditLogEntry } from "../api/audit.api";

const AUDIT_DETAIL_SHEET_CLASS =
  "flex h-full w-full !max-w-[480px] flex-col gap-0 overflow-hidden p-0 rounded-l-[10px] !shadow-none bg-white dark:bg-card";

type AuditDetailSheetProps = {
  entry: AuditLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AuditDetailSheet({ entry, open, onOpenChange }: AuditDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={AUDIT_DETAIL_SHEET_CLASS} showCloseButton>
        {entry && (
          <div className="flex h-full flex-col">
            <SheetHeader className={cn("shrink-0 border-b border-border bg-white px-6 py-4 text-left dark:bg-card")}>
              <SheetTitle className="text-lg font-bold">Event details</SheetTitle>
              <SheetDescription>Read-only audit record</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto bg-white px-6 py-5 dark:bg-card">
              <dl className="space-y-5">
                <DetailRow label="Event ID" value={entry.id} mono />
                <DetailRow label="Time" value={new Date(entry.createdAt).toLocaleString()} />
                <DetailRow label="Action" value={entry.action} mono />
                <DetailRow label="Object type" value={entry.objectType} />
                <DetailRow label="Object ID" value={entry.objectId ?? "—"} mono />
                <DetailRow label="Actor" value={entry.user?.displayName ?? "System"} />
                <DetailRow label="Email" value={entry.user?.email ?? "—"} />
                <DetailRow label="IP address" value={entry.ipAddress ?? "—"} mono />
                <DetailRow
                  label="Break-glass"
                  value={entry.breakGlassAction ? "Yes" : "No"}
                />
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
