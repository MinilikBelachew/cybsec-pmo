"use client";

import { Download, ChevronDown, FileJson, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/shared/utils/cn";
import type { AuditExportFormat } from "../api/audit.api";

type AuditExportMenuProps = {
  disabled?: boolean;
  onExport: (format: AuditExportFormat) => void;
};

const EXPORT_OPTIONS: {
  format: AuditExportFormat;
  label: string;
  description: string;
  icon: React.ElementType;
  iconClass: string;
}[] = [
  {
    format: "json",
    label: "JSON",
    description: "Pretty-printed, structured data",
    icon: FileJson,
    iconClass: "text-amber-500",
  },
  {
    format: "csv",
    label: "CSV",
    description: "Spreadsheet-compatible rows",
    icon: Table2,
    iconClass: "text-emerald-500",
  },
  {
    format: "xlsx",
    label: "Excel (.xlsx)",
    description: "Native Excel workbook",
    icon: FileSpreadsheet,
    iconClass: "text-green-600",
  },
  {
    format: "pdf",
    label: "PDF",
    description: "Print-ready audit report",
    icon: FileText,
    iconClass: "text-rose-500",
  },
];

export function AuditExportMenu({ disabled, onExport }: AuditExportMenuProps) {
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
        {disabled ? "Exporting…" : "Export filtered"}
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 p-2 shadow-none">
        <div className="space-y-1">
          {EXPORT_OPTIONS.map((option) => {
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
