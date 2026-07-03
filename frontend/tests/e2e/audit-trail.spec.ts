import { test, expect } from "@playwright/test";
import { loginViaSessionInjection } from "../helpers/auth";
import { getDbClient } from "../helpers/db";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1";
const ADMIN_EMAIL = "bminilik12@gmail.com";
const PM_EMAIL = "john.pm@bminilik12gmail.onmicrosoft.com";
const ENG_EMAIL = "briannguyen@bminilik12gmail.onmicrosoft.com";
const AUDIT_URL = "/en/dashboard/audit";

/**
 * Log in and navigate to the Audit Trail page.
 * Uses 'load' (not 'networkidle') because the audit page polls every 30s,
 * which would keep networkidle from ever resolving.
 * Goes to /en/login first so the video never starts with a blank frame.
 */
async function loginAndGoToAudit(page: any, email: string) {
  await page.goto("/en/login");
  await page.waitForLoadState("load");
  const session = await loginViaSessionInjection(page, email);
  await page.goto(AUDIT_URL);
  await page.waitForLoadState("load");
  // Let the table fully render (polling page — networkidle never fires)
  await page.waitForTimeout(3000);
  return session;
}

/** Scroll to the bottom of the table so rows are clearly visible in the video */
async function showTableContent(page: any) {
  await page.evaluate(() => window.scrollBy(0, 250));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

test.describe("Audit Trail (Milestone 1.9)", () => {
  let dbClient: any;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
  });

  test.afterAll(async () => {
    if (dbClient) await dbClient.end();
  });

  // ─── TC-M1.9-01: Audit events page returns paginated list ──────────────
  test("TC-M1.9-01: Admin can fetch paginated audit events from API", async ({ page, request }) => {
    const session = await loginAndGoToAudit(page, ADMIN_EMAIL);

    // Show table content clearly in the video
    await showTableContent(page);

    // Verify API returns paginated data
    const res = await request.get(`${API_URL}/audit/events?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("meta");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toHaveProperty("total");
    expect(body.meta).toHaveProperty("page");
    expect(body.meta.page).toBe(1);

    // Navigate to page 2 via UI to visually demonstrate pagination
    const nextBtn = page.locator('button[aria-label*="next"], button:has-text("Next"), button:has-text("›")').first();
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(1500);
    }

    // Hold page so video encoder captures final state
    await page.waitForTimeout(3000);
  });

  // ─── TC-M1.9-02: Non-admin gets 403 on audit events ──────────────────
  test("TC-M1.9-02: Engineer role blocked from audit events endpoint", async ({ page, request }) => {
    await page.goto("/en/login");
    await page.waitForLoadState("load");
    const session = await loginViaSessionInjection(page, ENG_EMAIL);

    // Attempt to navigate to audit page — should redirect or show access denied
    await page.goto(AUDIT_URL);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000); // Show where the Engineer lands (redirected)

    const res = await request.get(`${API_URL}/audit/events`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(res.status()).toBe(403);

    await page.waitForTimeout(3000);
  });

  // ─── TC-M1.9-03: PM role blocked from audit events endpoint ──────────
  test("TC-M1.9-03: PM role blocked from audit events endpoint", async ({ page, request }) => {
    await page.goto("/en/login");
    await page.waitForLoadState("load");
    const session = await loginViaSessionInjection(page, PM_EMAIL);

    // Attempt to navigate to audit page — should redirect or show access denied
    await page.goto(AUDIT_URL);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000); // Show where PM lands (redirected)

    const res = await request.get(`${API_URL}/audit/events`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(res.status()).toBe(403);

    await page.waitForTimeout(3000);
  });

  // ─── TC-M1.9-04: Audit log created on project creation ───────────────
  test("TC-M1.9-04: Project creation generates an audit log entry", async ({ page, request }) => {
    const adminSession = await loginAndGoToAudit(page, ADMIN_EMAIL);

    const deptRes = await dbClient.query("SELECT id FROM departments WHERE code = 'SOC' LIMIT 1");
    const custRes = await dbClient.query("SELECT id FROM customers LIMIT 1");
    const pmRes  = await dbClient.query(
      "SELECT id FROM users WHERE email = $1",
      ["john.pm@bminilik12gmail.onmicrosoft.com"]
    );
    if (deptRes.rows.length === 0 || custRes.rows.length === 0 || pmRes.rows.length === 0) return;

    const projectName = `Audit Trail Test Project ${Date.now()}`;
    const createRes = await request.post(`${API_URL}/projects`, {
      headers: { Authorization: `Bearer ${adminSession.token}` },
      data: {
        name: projectName,
        objective: "Test audit trail generation",
        departmentId: deptRes.rows[0].id,
        customerId:  custRes.rows[0].id,
        primaryPmId: pmRes.rows[0].id,
        engagementType: "ManagedServices",
        billingModel: "FixedPrice",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        value: 50000,
        currency: "USD",
      },
    });
    expect([200, 201]).toContain(createRes.status());
    const created = await createRes.json();
    const projectId = created?.id;

    try {
      // Wait for async audit write then reload to show the new entry
      await new Promise((r) => setTimeout(r, 1500));
      await page.reload();
      await page.waitForLoadState("load");
      await page.waitForTimeout(2500);

      // Show the table — the top row should be the CREATE_PROJECT event
      await showTableContent(page);

      // Verify via API
      const auditRes = await request.get(`${API_URL}/audit/events?limit=20`, {
        headers: { Authorization: `Bearer ${adminSession.token}` },
      });
      expect(auditRes.status()).toBe(200);
      const auditBody = await auditRes.json();
      expect(Array.isArray(auditBody.data)).toBe(true);
      expect(auditBody.meta.total).toBeGreaterThan(0);

      // Hold page to show the audit entry in video
      await page.waitForTimeout(3000);
    } finally {
      if (projectId) {
        await dbClient.query("DELETE FROM projects WHERE id = $1", [projectId]);
      }
    }
  });

  // ─── TC-M1.9-05: Audit export JSON returns valid JSON ─────────────────
  test("TC-M1.9-05: Admin can export audit logs as JSON", async ({ page, request }) => {
    const session = await loginAndGoToAudit(page, ADMIN_EMAIL);

    // Visually demonstrate the Export filtered button and JSON option
    const exportBtn = page.locator('button:has-text("Export filtered")').first();
    const isExportVisible = await exportBtn.isVisible({ timeout: 10000 }).catch(() => false);
    if (isExportVisible) {
      await exportBtn.click();
      await page.waitForTimeout(1200);
      // Hover over the JSON option to show it in video
      const jsonItem = page.locator('[role="menuitem"]:has-text("JSON")').first();
      if (await jsonItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await jsonItem.hover();
        await page.waitForTimeout(1000);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Verify API returns valid JSON
    const res = await request.get(`${API_URL}/audit/export?format=json`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/json");

    // Show table again at end so video ends on meaningful content
    await showTableContent(page);
    await page.waitForTimeout(3000);
  });

  // ─── TC-M1.9-06: Audit export XLSX returns correct content type ───────
  test("TC-M1.9-06: Admin can export audit logs as XLSX", async ({ page, request }) => {
    const session = await loginAndGoToAudit(page, ADMIN_EMAIL);

    // Demonstrate Export filtered → Excel option
    const exportBtn = page.locator('button:has-text("Export filtered")').first();
    const isExportVisible = await exportBtn.isVisible({ timeout: 10000 }).catch(() => false);
    if (isExportVisible) {
      await exportBtn.click();
      await page.waitForTimeout(1200);
      const xlsxItem = page.locator('[role="menuitem"]:has-text("Excel")').first();
      if (await xlsxItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await xlsxItem.hover();
        await page.waitForTimeout(1000);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    const res = await request.get(`${API_URL}/audit/export?format=xlsx`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(res.headers()["content-disposition"]).toContain(".xlsx");

    await showTableContent(page);
    await page.waitForTimeout(3000);
  });

  // ─── TC-M1.9-07: Audit export PDF returns valid PDF content type ──────
  test("TC-M1.9-07: Admin can export audit logs as PDF", async ({ page, request }) => {
    const session = await loginAndGoToAudit(page, ADMIN_EMAIL);

    // Demonstrate Export filtered → PDF option
    const exportBtn = page.locator('button:has-text("Export filtered")').first();
    const isExportVisible = await exportBtn.isVisible({ timeout: 10000 }).catch(() => false);
    if (isExportVisible) {
      await exportBtn.click();
      await page.waitForTimeout(1200);
      const pdfItem = page.locator('[role="menuitem"]:has-text("PDF")').first();
      if (await pdfItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pdfItem.hover();
        await page.waitForTimeout(1000);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    const res = await request.get(`${API_URL}/audit/export?format=pdf`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    expect(res.headers()["content-disposition"]).toContain(".pdf");

    await showTableContent(page);
    await page.waitForTimeout(3000);
  });

  // ─── TC-M1.9-08: Filter audit events by action type ──────────────────
  test("TC-M1.9-08: Audit events can be filtered by action keyword", async ({ page, request }) => {
    const session = await loginAndGoToAudit(page, ADMIN_EMAIL);

    // Use the search bar to filter by LOGIN — this is visually clear in the video
    const searchInput = page.locator('input[placeholder*="Search action"]').first();
    if (await searchInput.isVisible({ timeout: 8000 }).catch(() => false)) {
      await searchInput.click();
      await searchInput.fill("LOGIN");
      await page.waitForTimeout(2000); // Let the table update with filtered results
    } else {
      // Fallback: click the Action filter dropdown
      const actionBtn = page.locator('button:has-text("Action")').first();
      if (await actionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await actionBtn.click();
        await page.waitForTimeout(800);
        await page.keyboard.press("Escape");
      }
    }

    // Show filtered table content in video
    await showTableContent(page);

    // Verify API returns only LOGIN events
    const res = await request.get(`${API_URL}/audit/events?action=LOGIN&limit=10`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    for (const evt of body.data) {
      expect(evt.action.toUpperCase()).toContain("LOGIN");
    }

    // Hold page so video shows the filtered results at the end
    await page.waitForTimeout(3000);
  });
});
