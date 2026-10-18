const ExcelJS = require("exceljs");
const path = "UAT_Phase1_Retest3_Final_15-Oct-2026 -final.xlsx";

const responses = {
  "TC-M1.4-03": `Ready for retest: Yes
Type: Fixed
Comment: Reject no longer leaves the submitted % looking like official progress. Official KPI stays at the last approved value (0% if nothing was approved). Pending is cleared; Rejected history is labeled not applied.

How to retest:
1) As Engineer, on a task with 0% approved, submit +10% progress.
2) As PM, open Progress Approvals or task → Progress & review → Reject with a reason.
3) Confirm: Approved 0%, no Pending badge, toast says official progress remains 0%, history shows Rejected / not applied.
4) Confirm project KPI did not count the 10%.`,

  "TC-M1.4-04": `Ready for retest: Yes
Type: Fixed
Comment: Request rework no longer bumps official progress to the pending total. Official KPI stays at last approved (e.g. 39%); the +10% submission is marked not applied.

How to retest:
1) Task with 39% approved. Engineer submits +10% (pending total 49%).
2) As PM → Request rework with a reason.
3) Confirm: Approved stays 39% (not 49%), Pending cleared, history shows Rework / not applied.
4) Engineer can submit again after rework; KPI still based on approved only.`,
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
    ws.getRow(r).height = 130;
    updated.push({ tc, row: r });
  }

  await wb.xlsx.writeFile(path);
  console.log(JSON.stringify({ colT, updated }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
