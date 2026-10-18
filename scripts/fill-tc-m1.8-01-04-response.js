const ExcelJS = require("exceljs");
const path = "UAT_Phase1_Retest3_Final_15-Oct-2026 -final.xlsx";

const responses = {
  "TC-M1.8-01": `Ready for retest: Yes
Type: Fixed
Comment: Addressed DEF-P1-060 and Sara Retest 3 notes on MPP import/export:

1) After import, Phases / Milestones / Gantt no longer stay empty when preview was correct — post-import cache refresh reloads Phases, Milestones, and Tasks when the job completes.
2) MS Project XML (MSPDI) export: response is a real XML file download (not a JSON/server object). Open in MS Project via File → Open.
3) Excel Duration: MSP Excel export uses stored working-day duration (durationDays / effort) when present; phase/task order follows plan order. Selected-column export is under TC-M1.8-03.

Clarifications / UX fix (Sara observations):
4) Phase-to-phase dependencies from the MPP are not imported by design. Dependencies are task-to-task only; phase summary rows are structure, not dependency endpoints. Task predecessors in the file still import.
5) “+N more…” on import Notes is fixed: Notes still show the first 8 lines, then a “Show all N notes (+M more)” control expands the full list (and “Show less” collapses). Unmatched resource names appear in those warning lines; matched/unmatched counts are on the preview. External vs internal resource entity mapping is Phase 2 (DEF-P1-067 — Agreed).

How to retest:
1) Import the DLP/DCS .mpp → confirm preview phases/milestones/tasks → Confirm.
2) Without a hard refresh, open Phases, Milestones, and Gantt — structure should appear.
3) Export → MS Project XML → file downloads as .xml; open in MS Project.
4) Export Excel and check Duration matches working days from the plan.
5) On preview Notes with many warnings: click “Show all … (+N more)” and confirm the full list expands; “Show less” collapses. Confirm phase↔phase links stay out; task deps still present.`,

  "TC-M1.8-04": `Ready for retest: Yes
Type: Fixed
Comment: Re-import into an existing project (DEF-P1-044 / DEF-P1-045):

1) No duplicate project/tasks on same-name re-import; match updates existing rows.
2) Changed duration / dates from the MPP now apply on task update (durationDays / endDate are written when the file provides them; existing duration is not wiped to null).
3) Execution status is preserved: In Progress (or similar) is not reset to To Do solely because MPP % is still 0. Done still applies when MPP % is 100.
4) Import preview shows Create vs Update: NEW / UPDATE badges and “Update existing project” when the project name matches.

How to retest:
1) Import MPP into a project. Change one task duration in the .mpp; set a task to In Progress in the app.
2) Re-import the same file → preview shows UPDATE / Update existing project (not only Create).
3) Confirm no duplicate top-level tasks; changed duration/due date updates; In Progress is not reset to To Do because MPP % is 0.
4) Confirm assignee/comments retained where applicable.`,
};

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet("START HERE - Retest 3");
  if (!ws) throw new Error("START HERE missing");

  const header = ws.getRow(3);
  let colT = 20;
  for (let c = 1; c <= 40; c++) {
    if (
      String(header.getCell(c).value || "").includes(
        "Developer Response (Retest 4)",
      )
    ) {
      colT = c;
      break;
    }
  }

  const updated = [];
  for (let r = 4; r <= ws.rowCount; r++) {
    const tc = String(ws.getRow(r).getCell(5).value || "").trim();
    if (!responses[tc]) continue;
    const cell = ws.getRow(r).getCell(colT);
    cell.value = responses[tc];
    cell.alignment = { wrapText: true, vertical: "top" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFC6EFCE" },
    };
    cell.font = { size: 9 };
    ws.getRow(r).height = 150;
    updated.push({ tc, row: r });
  }

  await wb.xlsx.writeFile(path);
  console.log(JSON.stringify({ colT, updated }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
