"use client";

import { Download, ChevronDown } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";
import type { AuditExportFormat } from "../api/audit.api";
import { AUDIT_EXPORT_OPTIONS } from "./audit-export-options";

type AuditExportMenuProps = {
  disabled?: boolean;
  label?: string;
  onExport: (format: AuditExportFormat) => void;
};

export function AuditExportMenu({ disabled, label = "Export filtered", onExport }: AuditExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={disabled}
          />
        }
      >
        <Download className="size-4" />
        {disabled ? "Exporting…" : label}
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 p-2 shadow-none">
        <div className="space-y-1">
          {AUDIT_EXPORT_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuItem
                key={option.format}
                onClick={() => onExport(option.format)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-transparent px-2.5 py-1.5 cursor-pointer select-none",
                  "hover:border-border/60 hover:bg-muted/50 focus:outline-none focus:bg-muted/50 focus:border-border/60",
                )}
              >
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                  <Icon className={cn("size-3.5", option.iconClass)} />
                </div>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className="block text-[10px] text-muted-foreground">{option.description}</span>
                </span>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
