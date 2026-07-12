import type { UtilisationEmployeeRow } from "../types/reports.types";
import { RECONCILE_STATUS_CONFIG, UTILISATION_STATUS_CONFIG } from "./utilization-ui.config";

const CSV_HEADERS = [
  "Employee",
  "Designation",
  "Department",
  "Planned (h)",
  "Submitted (h)",
  "Approved (h)",
  "Billable (h)",
  "Non-billable (h)",
  "Available (h)",
  "Billable util. (%)",
  "Status",
  "Keka reconcile",
] as const;

function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function convertUtilisationToCsv(rows: UtilisationEmployeeRow[]): string {
  const dataRows = rows.map((row) =>
    [
      row.name,
      row.designation,
      row.departmentName,
      row.plannedHours.toFixed(2),
      row.submittedHours.toFixed(2),
      row.approvedHours.toFixed(2),
      row.billableHours.toFixed(2),
      row.nonBillableHours.toFixed(2),
      row.availableHours.toFixed(2),
      row.billableUtilisationPercent,
      UTILISATION_STATUS_CONFIG[row.status].label,
      RECONCILE_STATUS_CONFIG[row.reconcile.status].label,
    ].map(escapeCsvCell),
  );

  return [
    CSV_HEADERS.map(escapeCsvCell).join(","),
    ...dataRows.map((row) => row.join(",")),
  ].join("\n");
}

export function downloadUtilisationCsv(filename: string, rows: UtilisationEmployeeRow[]) {
  const csv = convertUtilisationToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
