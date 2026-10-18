const ExcelJS = require("exceljs");
const path = "UAT_Phase1_Retest3_Final_15-Oct-2026 -final.xlsx";

const response = `Ready for retest: Yes — Clarification (no code change)
Type: Clarification / expected validation
Comment: This is not an Approve-progress bug. Task Start/Due dates are validated against the phase date range (and parent/project if set). If the phase is only July 2026, the calendar only allows July 2026, and Save changes is blocked when dates fall outside that phase. That is intentional.

Approve does not use the date picker. Use: Dashboard → Projects → open project → Progress Approvals (top) or open task → Progress & review → Approve.

How to retest:
1) As Engineer, submit progress on a task (Pending).
2) As PM John, open the same project → Progress Approvals / Progress & review → Approve (do not change Start/Due unless they stay inside the phase).
3) Confirm status = Approved and official progress increases.
4) Optional: to change task dates to today, first widen the phase start/end (or pick a task whose phase includes today), then edit dates and Save.`;

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

  let rowNum = null;
  for (let r = 4; r <= ws.rowCount; r++) {
    if (String(ws.getRow(r).getCell(5).value || "").trim() === "TC-M1.4-02") {
      rowNum = r;
      break;
    }
  }
  if (!rowNum) throw new Error("TC-M1.4-02 row not found");

  const cell = ws.getRow(rowNum).getCell(colT);
  cell.value = response;
  cell.alignment = { wrapText: true, vertical: "top" };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC6EFCE" },
  };
  cell.font = { size: 9 };
  ws.getRow(rowNum).height = 140;

  const def = wb.getWorksheet("3. Defect Log - P1");
  let defUpdated = null;
  if (def) {
    const defHeader = def.getRow(2);
    let colAE = null;
    for (let c = 1; c <= 50; c++) {
      if (
        String(defHeader.getCell(c).value || "").includes(
          "Developer Response (Retest 4)",
        )
      ) {
        colAE = c;
        break;
      }
    }
    if (colAE) {
      for (let r = 3; r <= def.rowCount; r++) {
        const id = String(def.getRow(r).getCell(1).value || "");
        const tc = String(def.getRow(r).getCell(2).value || "");
        if (id === "DEF-P1-020") {
          const dcell = def.getRow(r).getCell(colAE);
          dcell.value = response;
          dcell.alignment = { wrapText: true, vertical: "top" };
          dcell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFC6EFCE" },
          };
          dcell.font = { size: 9 };
          defUpdated = { row: r, id, tc, col: colAE };
          break;
        }
      }
    }
  }

  await wb.xlsx.writeFile(path);
  console.log(
    JSON.stringify({ startHereRow: rowNum, colT, defUpdated }, null, 2),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
