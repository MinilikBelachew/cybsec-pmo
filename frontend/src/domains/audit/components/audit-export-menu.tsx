"use client";

import { Download, ChevronDown } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { AuditExportFormat } from "../api/audit.api";

type AuditExportMenuProps = {
  disabled?: boolean;
  onExport: (format: AuditExportFormat) => void;
};

const EXPORT_OPTIONS: { format: AuditExportFormat; label: string }[] = [
  { format: "json", label: "JSON" },
  { format: "xlsx", label: "Excel (.xlsx)" },
  { format: "pdf", label: "PDF" },
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
      <DropdownMenuContent align="end" className="w-44">
        {EXPORT_OPTIONS.map((option) => (
          <DropdownMenuItem key={option.format} onClick={() => onExport(option.format)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
