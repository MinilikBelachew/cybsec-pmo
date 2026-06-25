"use client";

import { Eye, MoreHorizontal, Copy } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { type AuditLogEntry } from "../api/audit.api";

type AuditRowActionsProps = {
  entry: AuditLogEntry;
  onView: (entry: AuditLogEntry) => void;
};

export function AuditRowActions({ entry, onView }: AuditRowActionsProps) {
  const copyId = async () => {
    await navigator.clipboard.writeText(entry.id);
  };

  return (
    <div className="flex items-center justify-end gap-0.5">
     
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label="More actions"
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => onView(entry)}>
            <Eye className="size-4" />
            View details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyId}>
            <Copy className="size-4" />
            Copy event ID
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
