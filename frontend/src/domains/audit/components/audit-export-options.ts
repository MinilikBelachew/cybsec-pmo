import { FileJson, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import type { AuditExportFormat } from "../api/audit.api";

export type AuditExportOption = {
  format: AuditExportFormat;
  label: string;
  description: string;
  icon: React.ElementType;
  iconClass: string;
};

export const AUDIT_EXPORT_OPTIONS: AuditExportOption[] = [
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
