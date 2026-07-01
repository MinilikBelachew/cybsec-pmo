"use client";

import { Eye } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { type AuditLogEntry } from "../api/audit.api";

type AuditRowActionsProps = {
  entry: AuditLogEntry;
  onView: (entry: AuditLogEntry) => void;
};

export function AuditRowActions({ entry, onView }: AuditRowActionsProps) {
  return (
    <div className="flex items-center justify-end">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted/60"
        aria-label="View event details"
        onClick={() => onView(entry)}
      >
        <Eye className="size-4" />
      </Button>
    </div>
  );
}
