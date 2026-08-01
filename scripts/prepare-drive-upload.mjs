#!/usr/bin/env node
/**
 * prepare-drive-upload.mjs
 *
 * Copies a phase's Playwright evidence videos into one staging folder with
 * readable names:  TC-M3.1-01 - Evidence Video.webm
 *
 * You then drag that folder's contents into Google Drive and run
 * sync-drive-links.mjs to write the links back into the register.
 *
 * Usage:
 *   node scripts/prepare-drive-upload.mjs --phase 3
 */

import fs from "fs";
import path from "path";

import { TC_RE, resolvePhase } from "./evidence-config.mjs";

const { phase, testResultsDir, stagingDir } = resolvePhase();

if (!fs.existsSync(testResultsDir)) {
  console.error(`Missing results directory: ${testResultsDir}`);
  process.exit(1);
}

fs.mkdirSync(stagingDir, { recursive: true });

const untagged = [];
let count = 0;

for (const folder of fs.readdirSync(testResultsDir)) {
  const src = path.join(testResultsDir, folder, "video.webm");
  if (!fs.existsSync(src)) continue;

  const match = folder.match(TC_RE);
  if (!match) {
    untagged.push(folder);
    continue;
  }

  fs.copyFileSync(src, path.join(stagingDir, `${match[0]} - Evidence Video.webm`));
  console.log(`✅ ${match[0]}`);
  count++;
}

if (untagged.length > 0) {
  console.log(`\n⚠️  ${untagged.length} folder(s) have no TC code and were skipped:`);
  for (const folder of untagged) console.log(`   - ${folder}`);
  console.log(`   Fix with: node frontend/scripts/rename-test-results.mjs ${testResultsDir}`);
}

console.log(`
────────────────────────────────────────
Prepared ${count} Phase ${phase} videos in:
  ${stagingDir}

Next steps:
  1. Open Google Drive in your browser
  2. Open (or create) the folder "PMO Phase ${phase} Evidence"
  3. Drag & drop ALL files from the folder above into it
  4. Share that Drive folder with:
       pmo-evidence-uploader@cybersec-pmo.iam.gserviceaccount.com
     as Viewer
  5. Copy the folder ID from the URL, then run:
       $env:DRIVE_FOLDER_ID="<folderId>"
       node scripts/sync-drive-links.mjs --phase ${phase}
────────────────────────────────────────
`);
