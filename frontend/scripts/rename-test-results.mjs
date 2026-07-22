#!/usr/bin/env node
/**
 * rename-test-results.mjs
 * Renames test-results folders to end with [TC-M1.X-XX] / [TC-M2.X-XX] using a hardcoded map
 * of known test cases in the suite.
 *
 * Usage: node rename-test-results.mjs [resultsDir]
 * Default: test-results-phase1 (or PLAYWRIGHT_OUTPUT_DIR / PLAYWRIGHT_PHASE)
 */
import { readdirSync, renameSync, existsSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const phase = process.env.PLAYWRIGHT_PHASE === "2" ? "2" : "1";
const RESULTS = resolve(
  process.argv[2] ||
    process.env.PLAYWRIGHT_OUTPUT_DIR ||
    join(__dirname, "..", `test-results-phase${phase}`),
);

// ── Hardcoded map: folder suffix fragment → TC code ──────────────────────
// Key = unique substring that appears in the folder name (case-sensitive)
// Value = TC code to append
const MAP = [
  // ─── Audit Trail (M1.9) ───────────────────────────────────────────────
  ["Audit-Trail-Mi-33a92",                  "TC-M1.9-01"],  // hash for pagination/capture
  ["pagination-and-capture",                "TC-M1.9-01"],  // fallback
  ["nated-audit-events-from-API",           "TC-M1.9-01"],  // fallback
  ["Engineer-role-blocked",                 "TC-M1.9-02"],  // may not appear due to hash
  ["PM-role-blocked",                       "TC-M1.9-03"],  // may not appear due to hash
  ["Mi-3ce03",                              "TC-M1.9-02"],  // hash for Engineer blocked
  ["Mi-71556",                              "TC-M1.9-03"],  // hash for PM blocked
  ["enerates-an-audit-log-entry",           "TC-M1.9-04"],
  ["export-audit-logs-as-JSON",             "TC-M1.9-05"],
  ["export-audit-logs-as-XLSX",             "TC-M1.9-06"],
  ["export-audit-logs-as-PDF",              "TC-M1.9-07"],
  ["filtered-by-action-keyword",            "TC-M1.9-08"],

  // ─── Dependencies (M1.5) ──────────────────────────────────────────────
  ["dependency-types-supported",            "TC-M1.5-01"],
  ["Cyclic-dependencies-blocked",           "TC-M1.5-02"],
  ["hedule-impact-recalculation",           "TC-M1.5-03"],
  ["notified-on-schedule-impact",           "TC-M1.5-04"],

  // ─── Import / Export (M1.8) ───────────────────────────────────────────
  ["Import-Expor-93904",                    "TC-M1.8-01"],  // MPP import validation report
  ["Import-Expor-dbdf7",                    "TC-M1.8-02"],  // Excel import validation report
  ["Import-Expor-7c961",                    "TC-M1.8-03"],  // Export preserves agreed fields
  ["Import-Expor-d0872",                    "TC-M1.8-04"],  // Re-import without duplication
  ["API-return-well-formed-JSON",           "TC-M1.8-01"],  // fallback
  ["oint-respects-status-filter",           "TC-M1.8-02"],  // fallback
  ["ible-to-PM-on-projects-page",           "TC-M1.8-03"],  // fallback
  ["ects-invalid-file-extension",           "TC-M1.8-04"],  // fallback

  // ─── Projects — Foundation (M1.1) ────────────────────────────────────
  ["TC-M1-1-01-Titan-Create",               "TC-M1.1-01"],
  ["ase-TC-M1-1-01",                        "TC-M1.1-01"],
  ["TC-M1-1-02-Assign-PMs",                 "TC-M1.1-02"],
  ["Phase-TC-M1-1-02",                      "TC-M1.1-02"],
  ["TC-M1-1-03-Milestones",                 "TC-M1.1-03"],
  ["Phase-TC-M1-1-03",                      "TC-M1.1-03"],
  ["TC-M1-1-03-Configure-milestones-on-the-project", "TC-M1.1-03"],
  ["Project-Managemen-e674d",               "TC-M1.1-03"],  // hash for milestone test
  ["TC-M1-1-04-Mandatory-Fields",           "TC-M1.1-04"],
  ["M1-1-05-Status-on-Creation",            "TC-M1.1-05"],
  ["M1-1-06-Exception-Handling",            "TC-M1.1-06"],

  // ─── Projects — Status/Lifecycle (M1.2) ──────────────────────────────
  ["TC-M1-2-01-Supported-States",           "TC-M1.2-01"],
  ["TC-M1-2-02-Invalid-Dates",              "TC-M1.2-02"],
  ["TC-M1-2-03-Missing-Owners",             "TC-M1.2-03"],
  ["TC-M1-2-04-Audited-Status",             "TC-M1.2-04"],

  // ─── Roles & Security (M1.7) ─────────────────────────────────────────
  ["oles-mapping-verified-in-DB",           "TC-M1.7-01"],
  // M1.7-02 and M1.7-03 both end in "level-permissions-enforced"
  // differentiate by their unique hash fragment
  ["Role-Enforc-58264",                     "TC-M1.7-02"],  // Module-level
  ["Role-Enforc-db226",                     "TC-M1.7-03"],  // Record-level
  ["evel-permission-enforcement",           "TC-M1.7-04"],
  ["paration-of-duties-enforced",           "TC-M1.7-05"],
  ["user-dashboard-restrictions",           "TC-M1.7-06"],
  ["mission-changes-are-audited",           "TC-M1.7-07"],

  // ─── Security & SSO (M1.6) ───────────────────────────────────────────
  ["TC-M1-6-01",                            "TC-M1.6-01"],
  ["ired-for-privileged-actions",           "TC-M1.6-02"],
  ["led-login-controls-enforced",           "TC-M1.6-03"],
  ["ut-revocation-enforced-401",            "TC-M1.6-04"],
  ["TC-M1-6-05-Security-alerts",            "TC-M1.6-05"],
  ["TC-M1-6-06-Break-glass",                "TC-M1.6-06"],

  // ─── Tasks (M1.3) ────────────────────────────────────────────────────
  ["TC-M1-3-01-Create-Task",                "TC-M1.3-01"],
  ["TC-M1-3-02-Attachments",                "TC-M1.3-02"],
  ["TC-M1-3-03-Comments",                   "TC-M1.3-03"],
  ["TC-M1-3-04-Sub-tasks",                  "TC-M1.3-04"],
  ["TC-M1-3-05-Notifications",              "TC-M1.3-05"],
  ["TC-M1-3-06-Resource-Availability",      "TC-M1.3-06"],
  ["TC-M1-3-07-Workflow-States",            "TC-M1.3-07"],

  // ─── Tasks — Progress & Approval (M1.4) ──────────────────────────────
  ["TC-M1-4-01-Progress-Update",            "TC-M1.4-01"],
  ["TC-M1-4-02-PM-Approval",                "TC-M1.4-02"],
  ["TC-M1-4-03-PM-Rejection",               "TC-M1.4-03"],
  ["TC-M1-4-04-PM-can-request-rework",      "TC-M1.4-04"],
  ["TC-M1-4-05",                            "TC-M1.4-05"],

  // ─── Phase 2 — Keka Sync (M2.1) ───────────────────────────────────────
  ["TC-M2-1-01",                            "TC-M2.1-01"],
  ["Sync-name-department-designation",      "TC-M2.1-01"],
  ["TC-M2-1-02",                            "TC-M2.1-02"],
  ["Sync-runs-at-agreed-frequency",         "TC-M2.1-02"],
  ["TC-M2-1-03",                            "TC-M2.1-03"],
  ["Bi-directional-sync",                   "TC-M2.1-03"],
  ["TC-M2-1-04",                            "TC-M2.1-04"],
  ["Failures-retry-automatically",          "TC-M2.1-04"],
  ["TC-M2-1-05",                            "TC-M2.1-05"],
  ["Failed-records-visible",                "TC-M2.1-05"],

  // ─── Phase 2 — Keka (M2.1) — Playwright truncated folder fragments ────
  ["g-hours-leave-active-status",           "TC-M2.1-01"],
  ["nc-runs-at-agreed-frequency",           "TC-M2.1-02"],
  ["rectional-sync-where-agreed",           "TC-M2.1-03"],
  ["ailures-retry-automatically",           "TC-M2.1-04"],
  ["ed-records-visible-to-admin",           "TC-M2.1-05"],

  // ─── Phase 2 — Allocations (M2.2) ─────────────────────────────────────
  ["TC-M2-2-01",                            "TC-M2.2-01"],
  ["PM-sees-current-allocation",            "TC-M2.2-01"],
  ["urrent-allocation-and-leave",           "TC-M2.2-01"],
  ["TC-M2-2-02",                            "TC-M2.2-02"],
  ["Assign-project-role",                   "TC-M2.2-02"],
  ["ign-project-role-and-hours",            "TC-M2.2-02"],
  ["TC-M2-2-03",                            "TC-M2.2-03"],
  ["Threshold-conflicts",                   "TC-M2.2-03"],
  ["7814e-ts-warn-or-block-per-policy",     "TC-M2.2-03"],
  ["TC-M2-2-04",                            "TC-M2.2-04"],
  ["Designation-conflicts",                 "TC-M2.2-04"],
  ["c657f-ts-warn-or-block-per-policy",     "TC-M2.2-04"],
  ["TC-M2-2-05",                            "TC-M2.2-05"],
  ["Over-allocation-approval",              "TC-M2.2-05"],
  ["llocation-approval-workflow",           "TC-M2.2-05"],
  ["TC-M2-2-06",                            "TC-M2.2-06"],
  ["Allocation-pushback-to-Keka",           "TC-M2.2-06"],
  ["shback-to-Keka-where-agreed",           "TC-M2.2-06"],

  // ─── Phase 2 — Leave impact (M2.3) ────────────────────────────────────
  ["TC-M2-3-01",                            "TC-M2.3-01"],
  ["Leave-on-critical-assignment",          "TC-M2.3-01"],
  ["l-assignment-triggers-alert",           "TC-M2.3-01"],
  ["TC-M2-3-02",                            "TC-M2.3-02"],
  ["Named-backup-resource",                 "TC-M2.3-02"],
  ["d-backup-resource-supported",           "TC-M2.3-02"],
  ["TC-M2-3-03",                            "TC-M2.3-03"],
  ["Project-schedule-impact",               "TC-M2.3-03"],
  ["schedule-impact-is-visible",            "TC-M2.3-03"],

  // ─── Phase 2 — Timesheet log (M2.4) ───────────────────────────────────
  ["TC-M2-4-01",                            "TC-M2.4-01"],
  ["Log-date-project-task",                 "TC-M2.4-01"],
  ["egular-hours-overtime-notes",           "TC-M2.4-01"],
  ["73606-ntries-prevented-or-flagged",     "TC-M2.4-02"],
  ["81fb6-ntries-prevented-or-flagged",     "TC-M2.4-03"],
  ["TC-M2-4-02",                            "TC-M2.4-02"],
  ["Duplicate-entries-prevented",           "TC-M2.4-02"],
  ["TC-M2-4-03",                            "TC-M2.4-03"],
  ["Over-limit-entries",                    "TC-M2.4-03"],

  // ─── Phase 2 — Timesheet approval (M2.5) ──────────────────────────────
  ["TC-M2-5-01",                            "TC-M2.5-01"],
  ["PM-approves-rejects",                   "TC-M2.5-01"],
  ["roves-rejects-with-comments",           "TC-M2.5-01"],
  ["TC-M2-5-02",                            "TC-M2.5-02"],
  ["Approved-records-sync-to-Keka",         "TC-M2.5-02"],
  ["proved-records-sync-to-Keka",           "TC-M2.5-02"],
  ["TC-M2-5-03",                            "TC-M2.5-03"],
  ["Rejected-records-return",               "TC-M2.5-03"],
  ["rds-return-for-resubmission",           "TC-M2.5-03"],
  ["TC-M2-5-04",                            "TC-M2.5-04"],
  ["Delayed-approvals-escalate",            "TC-M2.5-04"],
  ["TC-M2-5-05",                            "TC-M2.5-05"],
  ["Retry-logic-on-failed-sync",            "TC-M2.5-05"],
  ["TC-M2-5-06",                            "TC-M2.5-06"],
  ["Approved-records-available-to-payroll", "TC-M2.5-06"],
  ["ecords-available-to-payroll",           "TC-M2.5-06"],

  // ─── Phase 2 — Utilization (M2.6) ─────────────────────────────────────
  ["TC-M2-6-01",                            "TC-M2.6-01"],
  ["Utilisation-formula",                   "TC-M2.6-01"],
  ["tilisation-formula-approved",           "TC-M2.6-01"],
  ["TC-M2-6-02",                            "TC-M2.6-02"],
  ["Report-shows-planned-submitted",        "TC-M2.6-02"],
  ["illable-and-available-hours",           "TC-M2.6-02"],
  ["TC-M2-6-03",                            "TC-M2.6-03"],
  ["Filter-by-employee",                    "TC-M2.6-03"],
  ["er-by-employee-team-project",           "TC-M2.6-03"],
  ["TC-M2-6-04",                            "TC-M2.6-04"],
  ["Reconciles-to-Keka",                    "TC-M2.6-04"],
];

if (!existsSync(RESULTS)) {
  console.log(`No results directory found (${RESULTS}) — run playwright test first.`);
  process.exit(0);
}

console.log(`Tagging results in: ${RESULTS}`);

const folders = readdirSync(RESULTS).filter((f) => !f.startsWith("."));
let renamed = 0;
let skipped = 0;

for (const folder of folders) {
  // Already tagged
  if (/\[TC-M[\d.]+\-[\d]+\]$/.test(folder) || /\[SSO-Login\]$/.test(folder)) {
    console.log(`  ✓  Already tagged: ${folder}`);
    skipped++;
    continue;
  }

  // Find matching TC code
  let tcCode = null;
  for (const [fragment, code] of MAP) {
    if (folder.includes(fragment)) {
      tcCode = code;
      break;
    }
  }

  if (!tcCode) {
    console.log(`  ⚠  No match: ${folder}`);
    continue;
  }

  const newName = `${folder} [${tcCode}]`;
  const oldPath = join(RESULTS, folder);
  const newPath = join(RESULTS, newName);

  if (existsSync(newPath)) {
    console.log(`  ↔  Target exists: ${newName}`);
    continue;
  }

  renameSync(oldPath, newPath);
  console.log(`  →  ${folder}\n     ↳  [${tcCode}]`);
  renamed++;
}

console.log(`\nDone — ${renamed} folder(s) renamed, ${skipped} already tagged.`);
