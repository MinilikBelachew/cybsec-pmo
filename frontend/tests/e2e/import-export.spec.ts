import { test, expect } from "@playwright/test";
import { loginViaSessionInjection } from "../helpers/auth";
import { getDbClient } from "../helpers/db";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1";
const ADMIN_EMAIL = "bminilik12@gmail.com";
const PM_EMAIL = "john.pm@bminilik12gmail.onmicrosoft.com";

/**
 * Log in and navigate to the Projects list page.
 * Goes to /en/login first so the video never starts blank.
 * Uses 'load' (not 'networkidle') to avoid hanging on live-query pages.
 */
async function loginAndGoToProjects(page: any, email: string) {
  await page.goto("/en/login");
  await page.waitForLoadState("load");
  const session = await loginViaSessionInjection(page, email);
  await page.goto("/en/dashboard/projects");
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000); // Let projects list fully render
  return session;
}

test.describe("Import / Export (Milestone 1.8)", () => {
  let dbClient: any;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
  });

  test.afterAll(async () => {
    if (dbClient) await dbClient.end();
  });

  // ─── TC-M1.8-01: Export projects as JSON via API ────────────────────────
  test("TC-M1.8-01: Projects exported via API return well-formed JSON", async ({ page, request }) => {
    const session = await loginAndGoToProjects(page, ADMIN_EMAIL);

    // Click the "Export" button to visually show the export dialog in the video
    const exportBtn = page.locator('button:has-text("Export")').first();
    if (await exportBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await exportBtn.click();
      await page.waitForTimeout(1500); // Dialog opens — show it in video
      // Close dialog without triggering a download
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Verify API returns well-formed JSON
    const res = await request.get(`${API_URL}/projects/export`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      const proj = body[0];
      expect(proj).toHaveProperty("id");
      expect(proj).toHaveProperty("name");
      expect(proj).toHaveProperty("status");
    }

    // Show the projects list at the end
    await page.waitForTimeout(3000);
  });

  // ─── TC-M1.8-02: Export filtered by status ──────────────────────────────
  test("TC-M1.8-02: Export endpoint respects status filter", async ({ page, request }) => {
    const session = await loginAndGoToProjects(page, ADMIN_EMAIL);

    // Apply the "Active" status filter in the UI to demonstrate filtering
    const statusFilter = page.locator('button:has-text("Status"), [data-testid="status-filter"], select[name*="status"]').first();
    if (await statusFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await statusFilter.click();
      await page.waitForTimeout(800);
      const activeOption = page.locator('[role="option"]:has-text("Active"), li:has-text("Active"), [data-value="Active"]').first();
      if (await activeOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await activeOption.click();
        await page.waitForTimeout(1500);
      } else {
        await page.keyboard.press("Escape");
      }
    }

    // Click "Export" button to show export is available after filter
    const exportBtn = page.locator('button:has-text("Export")').first();
    if (await exportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await exportBtn.click();
      await page.waitForTimeout(1200);
      await page.keyboard.press("Escape");
    }

    // Verify API returns only Active projects
    const res = await request.get(`${API_URL}/projects/export?status=Active`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const proj of body) {
      expect(proj.status).toBe("Active");
    }

    await page.waitForTimeout(3000);
  });

  // ─── TC-M1.8-03: Import XLSX button visible to PM ─────────────────────
  test("TC-M1.8-03: Import XLSX button visible to PM on projects page", async ({ page }) => {
    await loginAndGoToProjects(page, PM_EMAIL);

    // "Import" button must be visible for PMs
    const importBtn = page.locator('button:has-text("Import"):not(:has-text("MPP"))').first();
    await expect(importBtn).toBeVisible({ timeout: 20000 });

    // Click to open the import dialog
    await importBtn.click();
    await page.waitForTimeout(1500); // Dialog opens

    // Set a synthetic XLSX file into the file input so the video shows a file selected
    const xlsxFileInput = page.locator('input[type="file"]').first();
    if (await xlsxFileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await xlsxFileInput.setInputFiles({
        name: "projects_export.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: Buffer.from("PK\x03\x04"), // minimal XLSX header bytes
      });
      await page.waitForTimeout(2000); // Show filename in dialog
    }

    // Close the dialog
    await page.keyboard.press("Escape");
    await page.waitForTimeout(3000); // Show projects page at the end
  });

  // ─── TC-M1.8-04: MPP file rejected when invalid extension sent to API ───
  test("TC-M1.8-04: MPP import API rejects invalid file extension", async ({ page, request }) => {
    const session = await loginAndGoToProjects(page, PM_EMAIL);

    // Click "Import MPP" button to visually demonstrate the MPP import flow
    const importMppBtn = page.locator('button:has-text("Import MPP")').first();
    if (await importMppBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await importMppBtn.click();
      await page.waitForTimeout(1500); // MPP import dialog opens

      // Set a fake .txt file into the file input — shows invalid file being attempted
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fileInput.setInputFiles({
          name: "fake_project.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("this is not a valid MPP file"),
        });
        await page.waitForTimeout(2000); // Show the rejected file in dialog
      }

      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Confirm API also rejects .txt via direct POST (422)
    const projRes = await dbClient.query("SELECT id FROM projects ORDER BY created_at DESC LIMIT 1");
    if (projRes.rows.length === 0) {
      await page.waitForTimeout(3000);
      return;
    }
    const projectId = projRes.rows[0].id;

    const fakeFile = Buffer.from("not a real mpp file");
    const res = await request.post(`${API_URL}/imports/mpp/preview`, {
      headers: { Authorization: `Bearer ${session.token}` },
      multipart: {
        projectId,
        file: {
          name: "fake.txt",
          mimeType: "text/plain",
          buffer: fakeFile,
        },
      },
    });

    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body?.errors?.file ?? body?.errors ?? "").toBeTruthy();

    await page.waitForTimeout(3000);
  });
});
