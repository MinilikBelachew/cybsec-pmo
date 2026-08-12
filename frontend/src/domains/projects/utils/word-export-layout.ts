/**
 * Word/HTML layout helpers — split wide task grids so Google Docs / Word
 * do not squeeze headers into one-character-per-line columns.
 */
import { DEFAULT_TASK_EXPORT_FIELDS } from "./task-export-fields";

/** Max ~7 data columns + Order/Title keeps headers readable in landscape. */
const WORD_TASK_TABLE_GROUPS: { title: string; fields: readonly string[] }[] = [
  {
    title: "Overview",
    fields: [
      "Order",
      "Title",
      "Phase",
      "Priority",
      "Status",
      "Assignee",
      "Resource Names",
    ],
  },
  {
    title: "Schedule",
    fields: [
      "Order",
      "Title",
      "Start Date",
      "End Date",
      "Duration Days",
      "% Complete",
      "Predecessors",
    ],
  },
  {
    title: "Baseline",
    fields: [
      "Order",
      "Title",
      "Baseline Start",
      "Baseline End",
      "Baseline Duration Days",
    ],
  },
  {
    title: "Tracking",
    fields: [
      "Order",
      "Title",
      "Actual Start",
      "Actual End",
      "Start Variance Days",
      "Finish Variance Days",
    ],
  },
  {
    title: "Details",
    fields: [
      "Order",
      "Title",
      "Description",
      "Parent Task",
      "Is Summary",
      "Effort Hours",
    ],
  },
];

export function resolveWordTaskTableGroups(
  selectedFields?: string[],
): { title: string; headers: string[] }[] {
  const selected = new Set(
    selectedFields?.length ? selectedFields : DEFAULT_TASK_EXPORT_FIELDS,
  );

  const groups: { title: string; headers: string[] }[] = [];

  for (const group of WORD_TASK_TABLE_GROUPS) {
    const headers = group.fields.filter((field) => selected.has(field));
    const dataCols = headers.filter(
      (field) => field !== "Order" && field !== "Title",
    );
    if (dataCols.length === 0) continue;
    groups.push({ title: group.title, headers });
  }

  return groups;
}

export function renderWordDataTable(
  headers: string[],
  rows: Record<string, unknown>[],
  escapeHtml: (value: unknown) => string,
): string {
  if (headers.length === 0 || rows.length === 0) return "";

  return `
    <table class="data">
      <thead>
        <tr>
          ${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
          <tr>
            ${headers
              .map(
                (field) =>
                  `<td>${escapeHtml(
                    row[field] !== undefined && row[field] !== null
                      ? row[field]
                      : "",
                  )}</td>`,
              )
              .join("")}
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function renderWordTaskScheduleSection(
  projName: string,
  rows: Record<string, unknown>[],
  selectedFields: string[] | undefined,
  escapeHtml: (value: unknown) => string,
): string {
  const tableGroups = resolveWordTaskTableGroups(selectedFields);
  if (tableGroups.length === 0 || rows.length === 0) return "";

  let html = `<h3>Task Schedule — ${escapeHtml(projName)}</h3>`;

  for (const group of tableGroups) {
    html += `<h4>${escapeHtml(group.title)}</h4>`;
    html += renderWordDataTable(group.headers, rows, escapeHtml);
  }

  return html;
}
