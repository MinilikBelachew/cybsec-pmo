/**
 * TC-M1.8-02 — Excel import junk/trailing rows fixture.
 *
 * Generates: scripts/fixtures/tc-m1.8-02-junk-rows.xlsx
 *
 * How to retest:
 *   Dashboard → Projects → Import → upload this file → preview
 *   Expect: only real Name/Title rows appear (not blank/dashes/0/#N/A trailing junk).
 */
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "tc-m1.8-02-junk-rows.xlsx");

const PROJECT = "TC-M1.8-02 Junk Rows Demo";
const PHASE = "Phase 01 — Initiation";

/** Junk titles the importer must skip (hasMeaningfulImportTitle = false). */
const JUNK_TITLES = [
  "",
  "   ",
  "\u00a0\u00a0", // NBSP only
  "-",
  "—",
  "---",
  "...",
  "0",
  "000",
  "N/A",
  "n/a",
  "#N/A",
  "#REF!",
  "null",
  "none",
];

function addJunkTaskRows(ws) {
  for (const title of JUNK_TITLES) {
    // Leftover cells in other columns (fill-down / formatting) — must NOT create a task.
    ws.addRow([
      title,
      "leftover description from Excel fill",
      "Medium",
      "To_Do",
      "",
      PHASE, // phase fill-down like Sara's trailing rows
      "2026-04-01",
      "2026-04-05",
      8,
    ]);
  }
}

function addJunkPhaseRows(ws) {
  for (const name of ["", "-", "0", "N/A", "---"]) {
    ws.addRow([name, "junk phase desc", 99, "Planned", "2026-04-01", "2026-04-30"]);
  }
}

function addJunkMilestoneRows(ws) {
  for (const title of ["", "-", "0", "#N/A"]) {
    ws.addRow([title, "2026-05-01", 0, "Pending", PHASE]);
  }
}

function addJunkProjectRows(ws) {
  for (const name of ["", "-", "0", "N/A", "---"]) {
    ws.addRow([
      name,
      "junk objective that should not create a project",
      "IT",
      "Acme",
      "ManagedServices",
      "TimeAndMaterial",
      "Medium",
      "2026-04-01",
      "2026-06-30",
      1,
      "USD",
      "",
      "",
      "Draft",
    ]);
  }
}

const wb = new ExcelJS.Workbook();

// --- Projects ---
const wsProjects = wb.addWorksheet("Projects");
wsProjects.addRow([
  "Name",
  "Objective",
  "Department",
  "Customer",
  "Engagement Type",
  "Billing Model",
  "Priority",
  "Start Date",
  "End Date",
  "Value",
  "Currency",
  "Primary PM",
  "Secondary PM",
  "Status",
]);
wsProjects.addRow([
  PROJECT,
  "UAT fixture: real project plus trailing junk Name rows that must be skipped.",
  "IT",
  "CyberSec",
  "ManagedServices",
  "TimeAndMaterial",
  "High",
  "2026-04-01",
  "2026-06-30",
  50000,
  "USD",
  "",
  "",
  "Draft",
]);
addJunkProjectRows(wsProjects);

// --- Phases ---
const wsPhases = wb.addWorksheet("TC-M1.8-02 Junk Rows Demo Phases".slice(0, 31));
wsPhases.addRow(["Name", "Description", "Order", "Status", "Start Date", "End Date"]);
wsPhases.addRow([
  PHASE,
  "Real initiation phase",
  1,
  "Planned",
  "2026-04-01",
  "2026-04-30",
]);
wsPhases.addRow([
  "Phase 02 — Execution",
  "Real execution phase",
  2,
  "Planned",
  "2026-05-01",
  "2026-05-31",
]);
addJunkPhaseRows(wsPhases);

// --- Tasks ---
const wsTasks = wb.addWorksheet("TC-M1.8-02 Junk Rows Demo Tasks".slice(0, 31));
wsTasks.addRow([
  "Title",
  "Description",
  "Priority",
  "Status",
  "Assignee",
  "Phase",
  "Start Date",
  "End Date",
  "Effort Hours",
]);
wsTasks.addRow([
  "Kickoff meeting",
  "Real task 1",
  "High",
  "To_Do",
  "",
  PHASE,
  "2026-04-01",
  "2026-04-02",
  8,
]);
wsTasks.addRow([
  "Draft project charter",
  "Real task 2",
  "Medium",
  "To_Do",
  "",
  PHASE,
  "2026-04-03",
  "2026-04-07",
  16,
]);
wsTasks.addRow([
  "Stakeholder register",
  "Real task 3",
  "Low",
  "To_Do",
  "",
  "Phase 02 — Execution",
  "2026-05-01",
  "2026-05-05",
  8,
]);
// Trailing junk — the Fail Sara reported
addJunkTaskRows(wsTasks);

// --- Milestones ---
const wsMs = wb.addWorksheet("TC-M1.8-02 Junk Rows Demo Miles".slice(0, 31));
wsMs.addRow(["Title", "Target Date", "Weight (%)", "Status", "Phase"]);
wsMs.addRow(["Initiation complete", "2026-04-30", 50, "Pending", PHASE]);
wsMs.addRow([
  "Execution complete",
  "2026-05-31",
  50,
  "Pending",
  "Phase 02 — Execution",
]);
addJunkMilestoneRows(wsMs);

await wb.xlsx.writeFile(OUT);
console.log("Wrote", OUT);
console.log(
  "Expect preview: 1 project, 2 phases, 3 tasks, 2 milestones — junk rows skipped.",
);
