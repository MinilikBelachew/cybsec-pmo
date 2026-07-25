/**
 * PDF layout helpers for project / task schedule exports.
 * Task tables follow a clean single-grid style (readable columns, wrap down).
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function drawPdfReportHeader(doc: jsPDF, title: string) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, pageW, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const safeTitle = title.length > 70 ? `${title.slice(0, 67)}…` : title;
  doc.text(safeTitle, 12, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Exported ${new Date().toLocaleDateString()}`, pageW - 12, 10, {
    align: "right",
  });
  doc.setTextColor(15, 23, 42);
}

export function drawPdfSectionTitle(
  doc: jsPDF,
  label: string,
  y: number,
): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 40) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text(label, 14, y);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, y + 1.5, doc.internal.pageSize.getWidth() - 14, y + 1.5);
  doc.setTextColor(15, 23, 42);
  return y + 5;
}

export function drawPdfKeyValueGrid(
  doc: jsPDF,
  pairs: [string, string][],
  startY: number,
): number {
  if (pairs.length === 0) return startY;

  autoTable(doc, {
    startY,
    theme: "grid",
    showHead: false,
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      overflow: "linebreak",
      valign: "middle",
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: {
        cellWidth: 52,
        fontStyle: "bold",
        fillColor: [248, 250, 252],
        textColor: [71, 85, 105],
      },
      1: { cellWidth: "auto" },
    },
    body: pairs.map(([k, v]) => [k, v || "—"]),
  });

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
}

/** Columns that stay readable on a landscape PDF (Jira-style single table). */
const PDF_TASK_COLUMN_ORDER = [
  "Order",
  "Title",
  "Phase",
  "Priority",
  "Status",
  "Assignee",
  "Resource Names",
  "Start Date",
  "End Date",
  "Duration Days",
  "% Complete",
  "Baseline Start",
  "Baseline End",
  "Predecessors",
] as const;

/** Fields that crush the PDF when dumped (cause letter-stack wrapping). */
const PDF_TASK_EXCLUDED = new Set([
  "Description",
  "Parent Task",
  "Is Summary",
  "Effort Hours",
  "Actual Start",
  "Actual End",
  "Baseline Duration Days",
  "Start Variance Days",
  "Finish Variance Days",
]);

/** Short header labels for PDF (still horizontal / readable). */
const PDF_HEADER_LABELS: Record<string, string> = {
  Order: "#",
  Title: "Summary",
  Priority: "P",
  "Duration Days": "Days",
  "% Complete": "%",
  "Baseline Start": "BL Start",
  "Baseline End": "BL End",
  "Resource Names": "Resources",
  Predecessors: "Links",
};

const PDF_COLUMN_WIDTHS: Record<string, number> = {
  Order: 10,
  Title: 52,
  Phase: 28,
  Priority: 16,
  Status: 20,
  Assignee: 26,
  "Resource Names": 32,
  "Start Date": 20,
  "End Date": 20,
  "Duration Days": 12,
  "% Complete": 10,
  "Baseline Start": 20,
  "Baseline End": 20,
  Predecessors: 28,
};

function formatPdfCell(field: string, value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (field === "Status") {
    return raw.replace(/_/g, " ");
  }
  if (field === "Priority") {
    const map: Record<string, string> = {
      Critical: "Highest",
      High: "High",
      Medium: "Medium",
      Low: "Low",
    };
    return map[raw] || raw;
  }
  // Soft-wrap friendly: keep spaces; truncate extreme cells.
  if (field === "Title" && raw.length > 120) return `${raw.slice(0, 117)}…`;
  if (field === "Predecessors" && raw.length > 80) return `${raw.slice(0, 77)}…`;
  if (field === "Resource Names" && raw.length > 80) return `${raw.slice(0, 77)}…`;
  if (field === "Phase" && raw.length > 48) return `${raw.slice(0, 45)}…`;
  return raw;
}

export function drawPdfScheduleTable(
  doc: jsPDF,
  headers: string[],
  rows: Record<string, unknown>[],
  startY: number,
) {
  const displayHeaders = headers.map((h) => PDF_HEADER_LABELS[h] || h);
  const body = rows.map((row) =>
    headers.map((field) => formatPdfCell(field, row[field])),
  );

  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 10;
  const usable = pageW - marginX * 2;
  const natural = headers.reduce(
    (sum, h) => sum + (PDF_COLUMN_WIDTHS[h] ?? 18),
    0,
  );
  const scale = natural > usable ? usable / natural : 1;

  const columnStyles: Record<
    number,
    { cellWidth: number; halign?: "left" | "center" | "right" }
  > = {};
  headers.forEach((header, index) => {
    const width = Math.max(9, (PDF_COLUMN_WIDTHS[header] ?? 18) * scale);
    const center =
      header === "Order" ||
      header === "Priority" ||
      header === "% Complete" ||
      header === "Duration Days";
    columnStyles[index] = {
      cellWidth: width,
      halign: center ? "center" : "left",
    };
  });

  autoTable(doc, {
    startY,
    head: [displayHeaders],
    body,
    theme: "plain",
    horizontalPageBreak: false,
    showHead: "everyPage",
    tableWidth: usable,
    margin: { left: marginX, right: marginX, top: 20, bottom: 12 },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
      overflow: "linebreak",
      valign: "top",
      minCellHeight: 7,
      textColor: [33, 37, 41],
      lineColor: [222, 226, 230],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [241, 243, 245],
      textColor: [33, 37, 41],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: { top: 3, right: 2, bottom: 3, left: 2 },
      overflow: "linebreak",
      valign: "middle",
      lineColor: [206, 212, 218],
      lineWidth: 0.25,
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
    },
    alternateRowStyles: {
      fillColor: [252, 252, 253],
    },
    columnStyles,
    didDrawPage: () => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${doc.getCurrentPageInfo().pageNumber}`,
        pageW - 10,
        pageH - 6,
        { align: "right" },
      );
      doc.setTextColor(15, 23, 42);
    },
  });
}

/**
 * Curated PDF columns — readable single table like a Jira export.
 * Ignores Description / Parent Task / etc. that crush the layout.
 */
export function resolveTaskPdfHeaders(selectedFields?: string[]): string[] {
  const allow = new Set<string>(PDF_TASK_COLUMN_ORDER);

  if (!selectedFields?.length) {
    return [...PDF_TASK_COLUMN_ORDER];
  }

  const picked = selectedFields.filter(
    (f) => allow.has(f) && !PDF_TASK_EXCLUDED.has(f),
  );

  // Always keep the core schedule / ownership columns.
  for (const required of [
    "Title",
    "Status",
    "Priority",
    "Start Date",
    "End Date",
    "Assignee",
    "Resource Names",
  ]) {
    if (!picked.includes(required) && allow.has(required)) {
      picked.push(required);
    }
  }

  // Stable left-to-right order.
  return PDF_TASK_COLUMN_ORDER.filter((f) => picked.includes(f));
}
