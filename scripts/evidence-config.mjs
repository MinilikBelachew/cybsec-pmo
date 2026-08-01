/**
 * Shared config for the UAT evidence → Google Drive workflow.
 *
 * Service accounts have no Drive storage quota, so uploads are done manually
 * by a human: prepare-drive-upload.mjs stages renamed videos, the user drags
 * them into Drive, then sync-drive-links.mjs reads the folder back and writes
 * the links into the register.
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..");
export const SERVICE_ACCOUNT_KEY = path.join(
  ROOT,
  "scripts",
  "cybersec-pmo-aac8c39f3ac7.json",
);
export const SHEET_NAME = "Test Cases";
export const EVIDENCE_COL = 17; // Column Q, "Evidence Link / File"
export const TC_RE = /TC-M\d+\.\d+-\d+/;

const PHASES = {
  2: {
    excel: "UAT_Test_Case_Register_v2 (1).xlsx",
    driveFolderId: "1PZrHauXXU5YJ5yN-VEfweL43AGYHj1Jg", // "PMO Phase 2 Evidence"
  },
  3: {
    excel: "UAT_Test_Case_Register_v2_phase_3.xlsx",
    driveFolderId: null, // set via DRIVE_FOLDER_ID until known
  },
};

/** Resolve phase config from argv (`--phase 3` / `3`) or PLAYWRIGHT_PHASE. */
export function resolvePhase(argv = process.argv.slice(2)) {
  const flagIndex = argv.indexOf("--phase");
  const raw =
    (flagIndex !== -1 ? argv[flagIndex + 1] : undefined) ??
    argv.find((a) => /^[23]$/.test(a)) ??
    process.env.PLAYWRIGHT_PHASE ??
    "3";

  const phase = String(raw);
  const config = PHASES[phase];
  if (!config) {
    console.error(`Unsupported phase "${phase}". Supported: ${Object.keys(PHASES).join(", ")}`);
    process.exit(1);
  }

  const driveFolderId = process.env.DRIVE_FOLDER_ID || config.driveFolderId;

  return {
    phase,
    driveFolderId,
    excelFile: path.join(ROOT, config.excel),
    testResultsDir: path.join(ROOT, "frontend", `test-results-phase${phase}`),
    stagingDir: path.join(ROOT, "scripts", `phase${phase}-drive-upload`),
    cacheFile: path.join(ROOT, "scripts", `.uploaded-drive-links-phase${phase}.json`),
  };
}
