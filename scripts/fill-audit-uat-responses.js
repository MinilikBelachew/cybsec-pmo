const ExcelJS = require("exceljs");
const path = "UAT_Phase1_Retest3_Final_15-Oct-2026 -final.xlsx";

const startHereResponses = {
  "TC-M1.9-01": `Ready for retest: Yes
Type: Clarification (PM Audit access) + Fixed (generic labels — DEF-P1-071)
Comment:
1) PM Audit Trail access: Not a product bug. In this UAT environment the Roles matrix grants PM audit.view / audit.export / audit.view_project, so PM can open Audit Trail (including login/logout). Access follows RBAC. To restrict PM, revoke audit.view and audit.export in Roles → Matrix → Audit (leave Super Admin / IT Admin).
2) Generic “Update Setting” labels (DEF-P1-071): Fixed. Settings → Audit (log retention, export limits, archive), Run archive, Allocation policies, and Timesheet escalation now log specific actions/descriptions (same pattern as session timeout), not generic UPDATE_SETTINGS.

How to retest:
A) As PM: confirm Audit Trail visibility matches the matrix grants (expected if audit.view is checked).
B) As IT Admin / Super Admin: Settings → Audit → change Log Retention (and/or export limits / archive) → Audit Trail → Action should read e.g. “Updated audit settings” / “Updated log retention to N months”, not generic Update Setting.
C) Optionally change Allocation policies or Timesheet escalation and confirm specific labels.`,

  "TC-M1.7-02": `Ready for retest: Yes
Type: Clarification
Comment: Module permissions are enforced by RBAC. Settings → Security and Roles & Permissions stay hidden for PM (correct). Audit Trail is visible for PM because this UAT Roles matrix grants PM audit.view / audit.export / audit.view_project — configuration, not a code defect. To hide system Audit Trail from PM, revoke audit.view and audit.export in Roles → Matrix → Audit.

How to retest:
1) As PM: confirm Roles & Permissions and Settings → Security are not in the menu.
2) Audit Trail appears only if PM has audit.view in the matrix (current UAT setup).
3) As Super Admin / IT Admin: Roles & Permissions and Settings are available.`,
};

const defectResponses = {
  "DEF-P1-005": `Ready for retest: Yes — Clarification
Type: Clarification / RBAC configuration
Comment: PM can see system Audit Trail in UAT because Roles → Matrix grants PM audit.view (and export / view_project). That matches RBAC, not a broken gate. Product default seed is view_project-only for PM; this environment was granted broader audit access. To block PM from system Audit Trail (login/logout list), revoke audit.view and audit.export for PM in the matrix. Project Audit log tab can remain via audit.view_project if desired.

How to retest: Adjust matrix as needed, re-login as PM, confirm sidebar Audit Trail matches grants.`,

  "DEF-P1-071": `Ready for retest: Yes
Type: Fixed
Comment: Settings changes no longer log only as generic UPDATE_SETTINGS / “Update Setting”. Specific actions: UPDATE_AUDIT_SETTINGS (log retention, export limits, archive toggle), RUN_AUDIT_ARCHIVE, UPDATE_ALLOCATION_POLICIES, UPDATE_TIMESHEET_ESCALATION, plus existing UPDATE_SESSION_TIMEOUT. Descriptions name the field/value where possible (e.g. log retention to N months).

How to retest:
1) Settings → Audit → change Log Retention → save.
2) Open Audit Trail → find the event.
3) Action/description should be specific (Updated audit settings / Updated log retention…), not generic Update Setting.
4) Optionally retest allocation policies and timesheet escalation the same way.`,
};

function styleCell(cell, text) {
  cell.value = text;
  cell.alignment = { wrapText: true, vertical: "top" };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFC6EFCE" },
  };
  cell.font = { size: 9 };
}

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

  const updatedStart = [];
  for (let r = 4; r <= ws.rowCount; r++) {
    const tc = String(ws.getRow(r).getCell(5).value || "").trim();
    if (!startHereResponses[tc]) continue;
    styleCell(ws.getRow(r).getCell(colT), startHereResponses[tc]);
    ws.getRow(r).height = 150;
    updatedStart.push({ tc, row: r });
  }

  const def = wb.getWorksheet("3. Defect Log - P1");
  const updatedDef = [];
  if (def) {
    const defHeader = def.getRow(2);
    let colAE = 31;
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
    for (let r = 3; r <= def.rowCount; r++) {
      const id = String(def.getRow(r).getCell(1).value || "").trim();
      if (!defectResponses[id]) continue;
      styleCell(def.getRow(r).getCell(colAE), defectResponses[id]);
      def.getRow(r).height = 140;
      updatedDef.push({ id, row: r, col: colAE });
    }
  }

  await wb.xlsx.writeFile(path);
  console.log(JSON.stringify({ colT, updatedStart, updatedDef }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
