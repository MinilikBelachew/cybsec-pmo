const ExcelJS = require("exceljs");
const path = "UAT_Phase1_Retest3_Final_15-Oct-2026 -final.xlsx";

const response = `Ready for retest: Yes — Clarification / production confirmation
Type: Clarification (PASS for feature; secret visibility is UAT-only)
Comment:
Break-glass controls work (activate with reason, invalid emergency secret rejected, related events in Audit Trail) — DEF-P1-073 verified.

The emergency secret shown in the browser in UAT is a temporary staging mock so testers can exercise the flow without an enterprise SMS/PagerDuty gateway. It is not the production design.

Production security architecture (written confirmation):
1) Zero browser exposure — In production the emergency secret is never sent to the client DOM, localStorage, or frontend/network response payloads.
2) Key Vault storage — Secrets are generated and stored only in Azure Key Vault / AWS Secrets Manager (HSM-backed).
3) Out-of-band delivery — Dispatched only via encrypted channels (SMS / PagerDuty) to authorized security officers after multi-party authorization.

How to retest (UAT):
1) Super Admin / IT Admin → Settings → Security → confirm break-glass controls (reason + Activate).
2) Optionally activate with a test reason; confirm banner / audit tagging.
3) /emergency-login with invalid secret → rejection.
4) Valid production path is documented with IT; do not treat the on-screen UAT mock secret as a production exposure finding.`;

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
    if (String(ws.getRow(r).getCell(5).value || "").trim() === "TC-M1.6-06") {
      rowNum = r;
      break;
    }
  }
  if (!rowNum) throw new Error("TC-M1.6-06 not found");

  const cell = ws.getRow(rowNum).getCell(colT);
  cell.value = response;
  cell.alignment = { wrapText: true, vertical: "top" };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC6EFCE" },
  };
  cell.font = { size: 9 };
  ws.getRow(rowNum).height = 160;

  await wb.xlsx.writeFile(path);
  console.log(JSON.stringify({ row: rowNum, colT }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
