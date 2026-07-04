import { google } from "googleapis";
import fs from "fs";
import path from "path";

const SERVICE_ACCOUNT_KEY  = "/Users/adexoxo/Downloads/cybersec-pmo-aac8c39f3ac7.json";
const SHEET_POINTER_FILE   = "/Users/adexoxo/ayne/cybsec-pmo/scripts/.google-sheet-id";
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
    range: `${SHEET_NAME}!A:A`,
  });

  const rows = res.data.values ?? [];
  console.log(`Loaded ${rows.length} rows from Google Sheet.`);

  rows.forEach((row, idx) => {
    const val = (row[0] ?? "").toString().trim();
    if (val.includes("TC-M1.")) {
      console.log(`Row ${idx + 1}: ${val}`);
    }
  });
}

main().catch(console.error);
