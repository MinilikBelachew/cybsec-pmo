#!/usr/bin/env node
/**
 * upload-evidence-to-drive.mjs
 *
 * 1. On first run: uploads UAT Excel to Google Drive as a Google Sheet (one-time)
 * 2. Every run: scans test-results/ for videos, uploads to Drive, writes links
 *    directly into the live Google Sheet (column "Evidence Link / File")
 *
 * Usage:
 *   node scripts/upload-evidence-to-drive.mjs
 */

import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_KEY  = path.join(ROOT, "scripts", "cybersec-pmo-aac8c39f3ac7.json");
const DRIVE_FOLDER_ID      = "1w6Nc-OwEGpNKVrq4AzZAcYIVBXQPuUel";
const EXCEL_FILE           = path.join(ROOT, "UAT_Test_Case_Register_v2 (1).xlsx");
const TEST_RESULTS_DIR     = path.join(ROOT, "frontend", "test-results");
const SHEET_POINTER_FILE   = path.join(ROOT, "scripts", ".google-sheet-id"); // stores the Sheet ID
const SHEET_NAME           = "Test Cases";
const TC_COL_INDEX         = 0;   // Col A (0-based) = "Test Case ID"
const EVIDENCE_COL_INDEX   = 16;  // Col Q (0-based) = "Evidence Link / File"
// ─────────────────────────────────────────────────────────────────────────────

/** Authenticate with Google APIs */
async function getClients() {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_KEY,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
  const authClient = await auth.getClient();
  return {
    drive:  google.drive({ version: "v3", auth: authClient }),
    sheets: google.sheets({ version: "v4", auth: authClient }),
  };
}

/**
 * Get or create the Google Sheet.
 * - Checks .google-sheet-id for a cached ID
 * - If not found, guides the user on how to manually create and share the Google Sheet
 */
async function getOrCreateSheet(drive) {
  // 1. Check cached sheet ID
  if (fs.existsSync(SHEET_POINTER_FILE)) {
    const sheetId = fs.readFileSync(SHEET_POINTER_FILE, "utf-8").trim();
    console.log(`📋 Using existing Google Sheet: https://docs.google.com/spreadsheets/d/${sheetId}`);
    return { sheetId, sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}` };
  }

  console.error("❌ Error: No Google Sheet ID linked yet.");
  console.log("\n=========================================================================");
  console.log("👉 GOOGLE DRIVE SERVICE ACCOUNT LIMITATION WORKAROUND:");
  console.log("Because Google allocates 0 bytes of storage quota to Service Accounts,");
  console.log("you need to manually host the spreadsheet on your 5 TB Google account:");
  console.log("1. Open Google Drive in your web browser.");
  console.log("2. Drag & drop 'UAT_Test_Case_Register_v2 (1).xlsx' to upload it.");
  console.log("3. Double-click the file in Drive, and click 'File' -> 'Save as Google Sheets'.");
  console.log("4. Click the 'Share' button in the top right, and add this email as 'Editor':");
  console.log("   pmo-evidence-uploader@cybersec-pmo.iam.gserviceaccount.com");
  console.log("5. Copy the Sheet ID from the browser URL (between '/d/' and '/edit').");
  console.log(`6. Save that Sheet ID into the file: scripts/.google-sheet-id`);
  console.log("=========================================================================\n");
  process.exit(1);
}

/** Upload a video file to Catbox.moe and return its permanent shareable link */
async function uploadVideo(drive, filePath, tcCode) {
  const fileName = `${tcCode} - Evidence Video.webm`;
  console.log(`  ↑ Uploading video to Catbox: ${fileName}`);

  const fileBuffer = fs.readFileSync(filePath);
  const fileBlob = new Blob([fileBuffer], { type: "video/webm" });

  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", fileBlob, fileName);

  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Catbox HTTP error! Status: ${res.status}`);
  }

  const link = (await res.text()).trim();
  if (!link.startsWith("http")) {
    throw new Error(`Catbox error: ${link}`);
  }

  console.log(`  ✅ ${tcCode} → ${link}`);
  return link;
}

/** Scan test-results and return Map<tcCode, videoPath> */
function scanTestResults() {
  const map = new Map();
  if (!fs.existsSync(TEST_RESULTS_DIR)) {
    console.error(`❌ test-results not found: ${TEST_RESULTS_DIR}`);
    return map;
  }

  for (const folder of fs.readdirSync(TEST_RESULTS_DIR)) {
    const match = folder.match(/\[?(TC-M[\d]+\.[\d]+-[\d]+)\]?/);
    if (!match) continue;
    const tcCode    = match[1];
    const videoPath = path.join(TEST_RESULTS_DIR, folder, "video.webm");
    if (fs.existsSync(videoPath) && !map.has(tcCode)) {
      map.set(tcCode, videoPath);
      console.log(`  📹 ${tcCode} → ${folder}/video.webm`);
    }
  }
  return map;
}

/**
 * Read all rows from the Google Sheet and return a map of
 * tcCode → array of rowIndices (0-based, including header)
 */
async function getTCRowMap(sheets, sheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!A:A`,
  });

  const rows  = res.data.values ?? [];
  const tcMap = new Map();
  rows.forEach((row, idx) => {
    const val   = (row[0] ?? "").toString().trim();
    const match = val.match(/TC-M[\d]+\.[\d]+-[\d]+/);
    if (match) {
      const code = match[0];
      if (!tcMap.has(code)) {
        tcMap.set(code, []);
      }
      tcMap.get(code).push(idx);
    }
  });
  return tcMap;
}

/** Write evidence links into the Google Sheet via batchUpdate */
async function writeLinksToSheet(sheets, sheetId, tcLinks, tcRowMap) {
  const colLetter = String.fromCharCode(65 + EVIDENCE_COL_INDEX); // "Q"
  const updates   = [];

  for (const [tcCode, link] of tcLinks.entries()) {
    if (!tcRowMap.has(tcCode)) {
      console.log(`  ⚠️  ${tcCode}: not found in Google Sheet, skipping`);
      continue;
    }
    const rowIndices = tcRowMap.get(tcCode);
    for (const idx of rowIndices) {
      const rowNumber = idx + 1; // 1-based for Sheets API
      const range     = `${SHEET_NAME}!${colLetter}${rowNumber}`;
      updates.push({ range, values: [[`=HYPERLINK("${link}","▶ Watch Video")`]] });
      console.log(`  ✅ Row ${rowNumber}: ${tcCode} → ${link}`);
    }
  }

  if (updates.length === 0) {
    console.log("  ⚠️  No matching rows found to update.");
    return 0;
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED", // parses HYPERLINK formula
      data: updates,
    },
  });

  return updates.length;
}

/** Main */
async function main() {
  console.log("\n🚀 PMO Evidence Uploader — Google Sheets Edition\n");

  // 1. Authenticate
  console.log("🔑 Authenticating...");
  const { drive, sheets } = await getClients();
  console.log("✅ Authenticated.\n");

  // 2. Get or create the Google Sheet
  const { sheetId, sheetUrl } = await getOrCreateSheet(drive);
  console.log();

  // 3. Scan test results
  console.log("📂 Scanning test results...");
  const videoMap = scanTestResults();
  if (videoMap.size === 0) {
    console.log("⚠️  No videos found. Run the tests first.");
    process.exit(1);
  }
  console.log(`\nFound ${videoMap.size} test video(s).\n`);

  // Load cache of uploaded links
  const cachePath = path.join(ROOT, "scripts", ".uploaded-links.json");
  let cachedLinks = {};
  if (fs.existsSync(cachePath)) {
    try {
      cachedLinks = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      console.log(`📦 Loaded ${Object.keys(cachedLinks).length} cached video link(s).`);
    } catch (e) {
      console.warn("⚠️  Failed to parse uploaded-links cache, starting fresh.");
    }
  }

  // 4. Upload videos → get links
  console.log("📤 Processing videos (uploading only if not cached)...");
  const tcLinks = new Map(Object.entries(cachedLinks));
  let uploadCount = 0;
  let cacheCount = 0;

  for (const [tcCode, videoPath] of videoMap.entries()) {
    try {
      if (cachedLinks[tcCode]) {
        cacheCount++;
      } else {
        const link = await uploadVideo(drive, videoPath, tcCode);
        tcLinks.set(tcCode, link);
        cachedLinks[tcCode] = link;
        uploadCount++;
      }
    } catch (err) {
      console.error(`  ❌ Failed to process ${tcCode}: ${err.message}`);
    }
  }

  // Save cache back
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cachedLinks, null, 2));
    console.log(`💾 Saved updated links cache to: scripts/.uploaded-links.json`);
  } catch (e) {
    console.error("⚠️  Failed to save updated links cache:", e.message);
  }

  console.log(`\n✅ Done: ${cacheCount} loaded from cache, ${uploadCount} uploaded.\n`);

  // 5. Read TC → row mapping from live Google Sheet
  console.log("📊 Reading Google Sheet rows...");
  const tcRowMap = await getTCRowMap(sheets, sheetId);
  console.log(`   Found ${tcRowMap.size} TC rows in sheet.\n`);

  // 6. Write links directly into the Google Sheet
  console.log("✍️  Writing evidence links to Google Sheet...");
  const updated = await writeLinksToSheet(sheets, sheetId, tcLinks, tcRowMap);

  // 7. Summary
  console.log("\n─────────────────────────────────────────────────────────");
  console.log(`✅ Videos uploaded     : ${tcLinks.size}`);
  console.log(`✅ Sheet rows updated  : ${updated}`);
  console.log(`🔗 Google Sheet URL    : ${sheetUrl}`);
  console.log("─────────────────────────────────────────────────────────\n");
  console.log("Share this link with your team — it's always up to date.");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});
