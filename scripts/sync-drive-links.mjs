#!/usr/bin/env node
/**
 * sync-drive-links.mjs
 *
 * Reads a Google Drive folder of evidence videos (named "TC-… - Evidence
 * Video.webm") and writes each link into the register's
 * "Evidence Link / File" column as a clickable "Watch Video" hyperlink.
 *
 * Native hyperlinks are used rather than =HYPERLINK() formulas, which desktop
 * Excel tries to download itself instead of handing to the browser.
 *
 * Usage:
 *   $env:DRIVE_FOLDER_ID="<folderId>"
 *   node scripts/sync-drive-links.mjs --phase 3
 *
 * Add --sheet to also update the live Google Sheet in scripts/.google-sheet-id.
 */

import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

import {
  EVIDENCE_COL,
  ROOT,
  SERVICE_ACCOUNT_KEY,
  SHEET_NAME,
  TC_RE,
  resolvePhase,
} from "./evidence-config.mjs";

const SERVICE_ACCOUNT_EMAIL = "pmo-evidence-uploader@cybersec-pmo.iam.gserviceaccount.com";
const SHEET_POINTER_FILE = path.join(ROOT, "scripts", ".google-sheet-id");
const FILE_ID_RE = /\/file\/d\/([^/]+)/;
const LINK_LABEL = "Watch Video";

const { phase, driveFolderId, excelFile, cacheFile } = resolvePhase();
const updateSheet = process.argv.includes("--sheet");

/** Drop the ?usp= tracking suffix Drive adds, so the URL is clean in Excel. */
function normalizeDriveUrl(url, fileId) {
  const match = url?.match(FILE_ID_RE);
  return `https://drive.google.com/file/d/${match?.[1] ?? fileId}/view`;
}

async function getClients() {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_KEY,
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
  const authClient = await auth.getClient();
  return {
    drive: google.drive({ version: "v3", auth: authClient }),
    sheets: google.sheets({ version: "v4", auth: authClient }),
  };
}

async function listVideosInFolder(drive) {
  const links = new Map();
  let pageToken;

  do {
    const res = await drive.files.list({
      q: `'${driveFolderId}' in parents and trashed=false`,
      fields: "nextPageToken, files(id,name,webViewLink)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const file of res.data.files ?? []) {
      const match = (file.name ?? "").match(TC_RE);
      if (!match) continue;
      const url = normalizeDriveUrl(file.webViewLink, file.id);
      links.set(match[0], url);
      console.log(`  📹 ${match[0]} → ${url}`);
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return links;
}

function writeLinksToExcel(links) {
  const py = `
import json, openpyxl, re, sys
from openpyxl.styles import Alignment, Font

excel, payload, col, link_label = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
links = json.loads(payload)
wb = openpyxl.load_workbook(excel)
ws = wb["${SHEET_NAME}"]
tc_re = re.compile(r"TC-M\\d+\\.\\d+-\\d+")
updated = 0
for r in range(2, ws.max_row + 1):
    label = ws.cell(r, 1).value
    if not label:
        continue
    m = tc_re.search(str(label))
    if not m or m.group(0) not in links:
        continue
    cell = ws.cell(r, col)
    cell.value = link_label
    cell.hyperlink = links[m.group(0)]
    cell.font = Font(color="0563C1", underline="single")
    cell.alignment = Alignment(horizontal="center", vertical="center")
    updated += 1
wb.save(excel)
print(updated)
`.trim();

  const result = spawnSync(
    "python",
    [
      "-c",
      py,
      excelFile,
      JSON.stringify(Object.fromEntries(links)),
      String(EVIDENCE_COL),
      LINK_LABEL,
    ],
    { encoding: "utf-8" },
  );
  if (result.status !== 0) {
    throw new Error(`Excel update failed: ${result.stderr || result.stdout}`);
  }
  return Number((result.stdout ?? "").trim()) || 0;
}

async function writeLinksToSheet(sheets, sheetId, links) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A:A`,
  });

  const updates = [];
  (res.data.values ?? []).forEach((row, index) => {
    const match = (row[0] ?? "").toString().match(TC_RE);
    if (!match || !links.has(match[0])) return;
    updates.push({
      range: `${SHEET_NAME}!Q${index + 1}`,
      values: [[`=HYPERLINK("${links.get(match[0])}","${LINK_LABEL}")`]],
    });
  });

  if (updates.length === 0) return 0;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data: updates },
  });
  return updates.length;
}

async function main() {
  console.log(`\n🔗 Sync Phase ${phase} Drive links → ${path.basename(excelFile)}\n`);

  if (!driveFolderId) {
    console.error(`❌ No Drive folder ID for phase ${phase}.

Share the "PMO Phase ${phase} Evidence" folder with ${SERVICE_ACCOUNT_EMAIL}
as Viewer, then re-run with its ID:
  $env:DRIVE_FOLDER_ID="<folderId>"
  node scripts/sync-drive-links.mjs --phase ${phase}
`);
    process.exit(1);
  }

  const { drive, sheets } = await getClients();

  try {
    const meta = await drive.files.get({
      fileId: driveFolderId,
      fields: "id,name",
      supportsAllDrives: true,
    });
    console.log(`📁 Folder: ${meta.data.name} (${driveFolderId})\n`);
  } catch (err) {
    console.error(`❌ Cannot access folder ${driveFolderId}: ${err.message}`);
    console.error(`\nShare it with ${SERVICE_ACCOUNT_EMAIL} as Viewer, then retry.\n`);
    process.exit(1);
  }

  console.log("📂 Listing videos in Drive folder...");
  const links = await listVideosInFolder(drive);
  if (links.size === 0) {
    console.error(`
❌ No videos with TC codes found in that folder.
   Upload files named like "TC-M${phase}.1-01 - Evidence Video.webm"
   (run: node scripts/prepare-drive-upload.mjs --phase ${phase})
`);
    process.exit(1);
  }
  console.log(`\nFound ${links.size} matching video(s).\n`);

  fs.writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(links), null, 2));
  console.log(`💾 Cached links: ${path.relative(ROOT, cacheFile)}`);

  console.log("✍️  Updating Excel...");
  const excelUpdated = writeLinksToExcel(links);
  console.log(`✅ Excel rows updated: ${excelUpdated}`);

  if (updateSheet && fs.existsSync(SHEET_POINTER_FILE)) {
    const sheetId = fs.readFileSync(SHEET_POINTER_FILE, "utf-8").trim();
    try {
      const sheetUpdated = await writeLinksToSheet(sheets, sheetId, links);
      console.log(`✅ Google Sheet rows updated: ${sheetUpdated}`);
    } catch (err) {
      console.warn(`⚠️  Google Sheet update skipped: ${err.message}`);
    }
  }

  const missing = links.size !== excelUpdated;
  console.log(`
📁 https://drive.google.com/drive/folders/${driveFolderId}
${missing ? "⚠️  Some Drive videos had no matching row in the register.\n" : ""}`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
