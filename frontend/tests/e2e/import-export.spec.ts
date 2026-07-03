import { test, expect } from "@playwright/test";
import { loginViaSessionInjection } from "../helpers/auth";
import { getDbClient } from "../helpers/db";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1";
const ADMIN_EMAIL = "bminilik12@gmail.com";
const PM_EMAIL = "john.pm@bminilik12gmail.onmicrosoft.com";
const ENG_EMAIL = "briannguyen@bminilik12gmail.onmicrosoft.com";

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
    const session = await loginViaSessionInjection(page, PM_EMAIL);

    const res = await request.get(`${API_URL}/projects/export`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    // Must be an array
    expect(Array.isArray(body)).toBe(true);

    // Each project must have the core required fields
    if (body.length > 0) {
      const proj = body[0];
      expect(proj).toHaveProperty("id");
      expect(proj).toHaveProperty("name");
      expect(proj).toHaveProperty("status");
    }
  });

  // ─── TC-M1.8-02: Export filtered by status ──────────────────────────────
  test("TC-M1.8-02: Export endpoint respects status filter", async ({ page, request }) => {
    const session = await loginViaSessionInjection(page, PM_EMAIL);

    const res = await request.get(`${API_URL}/projects/export?status=Active`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);

    // All returned projects must be Active
    for (const proj of body) {
      expect(proj.status).toBe("Active");
    }
  });

  // ─── TC-M1.8-03: Import XLSX — wrong format rejected ────────────────────
  test("TC-M1.8-03: Import XLSX button visible to PM on projects page", async ({ page }) => {
    await loginViaSessionInjection(page, PM_EMAIL);
    await page.goto("/en/dashboard/projects");
    await page.waitForLoadState("networkidle");

    // The "Import" button should be visible for a PM
    // The button text in the UI is just "Import" (with an Upload icon)
    const importBtn = page.locator('button:has-text("Import"):not(:has-text("MPP"))');
    await expect(importBtn.first()).toBeVisible({ timeout: 20000 });
  });

  // ─── TC-M1.8-04: MPP file rejected when invalid extension sent to API ───
  test("TC-M1.8-04: MPP import API rejects invalid file extension", async ({ page, request }) => {
    const session = await loginViaSessionInjection(page, PM_EMAIL);

    // Grab any existing project ID for the test
    const projRes = await dbClient.query(
      "SELECT id FROM projects ORDER BY created_at DESC LIMIT 1"
    );
    if (projRes.rows.length === 0) return; // Skip if no projects

    const projectId = projRes.rows[0].id;

    // Send a .txt file (invalid extension) to the MPP import preview endpoint
    const fakeFile = Buffer.from("not a real mpp file");
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("file", new Blob([fakeFile], { type: "text/plain" }), "fake.txt");

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

    // Must be rejected: 422 Unprocessable Entity
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body?.errors?.file ?? body?.errors ?? "").toBeTruthy();
  });

  // ─── TC-M1.8-05: Engineer cannot access export endpoint ─────────────────
  test("TC-M1.8-05: Engineer role blocked from project export endpoint", async ({ page, request }) => {
    const session = await loginViaSessionInjection(page, ENG_EMAIL);

    const res = await request.get(`${API_URL}/projects/export`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });

    // Engineer lacks project_export module permission → 403
    expect(res.status()).toBe(403);
  });

  // ─── TC-M1.8-06: Export without auth returns 401 ────────────────────────
  test("TC-M1.8-06: Unauthenticated export request returns 401", async ({ request }) => {
    const res = await request.get(`${API_URL}/projects/export`);
    expect(res.status()).toBe(401);
  });
});
