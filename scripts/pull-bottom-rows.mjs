import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SERVICE_ACCOUNT_KEY  = path.join(ROOT, "scripts", "cybersec-pmo-aac8c39f3ac7.json");
const SHEET_POINTER_FILE   = path.join(ROOT, "scripts", ".google-sheet-id");
const SHEET_NAME           = "Test Cases";

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const sheetId = fs.readFileSync(SHEET_POINTER_FILE, "utf-8").trim();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_NAME}!260:287`,
  });

  const rows = res.data.values ?? [];
  
  console.log(`\n--- BOTTOM ROWS ANALYSIS (260-286) ---\n`);

  rows.forEach((row, idx) => {
    const rowNum = idx + 260;
    const tcId = (row[0] ?? "").toString().trim();
    if (tcId.startsWith("TC-")) {
      console.log(`Row ${rowNum}:`);
      console.log(`  ID         : "${row[0] ?? ""}"`);
      console.log(`  Module     : "${row[1] ?? ""}"`);
      console.log(`  Scenario   : "${row[8] ?? ""}"`);
      console.log(`  Steps      : "${(row[10] ?? "").replace(/\n/g, "  ")}"`);
      console.log(`  Expected   : "${row[11] ?? ""}"`);
      console.log();
    }
  });
}

main().catch(console.error);
