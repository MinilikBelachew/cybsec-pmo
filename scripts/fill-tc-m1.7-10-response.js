const ExcelJS = require("exceljs");
const path = "UAT_Phase1_Retest3_Final_15-Oct-2026 -final.xlsx";

const response = `Ready for retest: Yes
Type: Fixed
Comment: Global API rate limiting is enabled for all /api/v1 endpoints (per client IP). Default: 200 requests per 10 seconds. Over-limit responses return HTTP 429 Too Many Requests with Retry-After and code API_RATE_LIMITED. Login still has its own stricter limit. Large imports (MPP/Excel) are not blocked — bulk work runs as a background job; only HTTP calls are counted.

How to retest:
1) Authenticated script: send >200 GET requests to /api/v1/projects (or similar) within 10 seconds from one IP.
2) Confirm later responses return HTTP 429.
3) Wait ~10 seconds and confirm requests succeed again.
4) Normal UI use and a single large import job should still work.`;

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
    if (String(ws.getRow(r).getCell(5).value || "").trim() === "TC-M1.7-10") {
      rowNum = r;
      break;
    }
  }
  if (!rowNum) throw new Error("TC-M1.7-10 not found");

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

  await wb.xlsx.writeFile(path);
  console.log(JSON.stringify({ row: rowNum, colT }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
