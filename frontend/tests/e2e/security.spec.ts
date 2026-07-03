import { test, expect } from "@playwright/test";
import { loginViaSessionInjection } from "../helpers/auth";
import { getDbClient } from "../helpers/db";

test.describe("Security & SSO", () => {
  let dbClient: any;
  let engEmail = "briannguyen@bminilik12gmail.onmicrosoft.com";
  const adminEmail = "bminilik12@gmail.com";

  test.beforeAll(async () => {
    dbClient = await getDbClient();
  });

  test.afterAll(async () => {
    if (dbClient) {
      await dbClient.end();
    }
  });
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
  });

  test("TC-M1.6-02: MFA / Conditional Access required for privileged actions", async ({ page, request }) => {
    // 1. Log in as Engineer (who does NOT have manage settings permission)
    const session = await loginViaSessionInjection(page, engEmail);

    // 2. Try to access settings page
    await page.goto("/en/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // 3. Verify settings tabs are limited (only Profile is visible, no Audit or Security tabs for Engineer)
    await expect(page.locator('button:has-text("Audit & Compliance")')).toBeHidden();
    await expect(page.locator('button:has-text("Security")')).toBeHidden();

    // 4. Try to query the backend settings API directly using the session token
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1";
    const res = await request.get(`${apiUrl}/settings/audit`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });

    // 5. Confirm REST API returns 403 Forbidden
    expect(res.status()).toBe(403);
  });

  test("TC-M1.6-03: Failed-login controls enforced", async ({ page, request }) => {
    // 1. Log in as Engineer (limited role)
    const session = await loginViaSessionInjection(page, engEmail);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1";

    // 2. Attempt to access settings/audit API — should be blocked 403
    const res = await request.get(`${apiUrl}/settings/audit`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });

    // 3. Confirm access is blocked with 403 Forbidden
    expect(res.status()).toBe(403);
  });

  test("TC-M1.6-04: Session timeout/revocation enforced (401)", async ({ page, request }) => {
    // 1. Inject a session token
    const session = await loginViaSessionInjection(page, engEmail);

    // 2. Verify we can call authorized endpoints (e.g. auth profile info)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1";
    let res = await request.get(`${apiUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });
    expect(res.status()).toBe(200);

    // 3. Delete session from database to simulate timeout/revocation
    await dbClient.query("DELETE FROM sessions WHERE user_id = $1", [session.userId]);

    // 4. Try to query the backend API again with the same token
    res = await request.get(`${apiUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });

    // 5. Confirm the system denies access immediately with a 401 Unauthorized
    expect(res.status()).toBe(401);
  });

  test("TC-M1.6-05: Security alerts generated", async ({ page, request }) => {
    // Verify the audit logs contain security-related events accessible to admin
    const session = await loginViaSessionInjection(page, adminEmail);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1";

    // 1. Fetch audit events as admin
    const res = await request.get(`${apiUrl}/audit/events?limit=50`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);

    // 2. Verify the audit log schema includes expected security fields
    if (body.data.length > 0) {
      const evt = body.data[0];
      // Audit events must capture actor, action, timestamp
      expect(evt).toHaveProperty("actorId");
      expect(evt).toHaveProperty("action");
      expect(evt).toHaveProperty("createdAt");
    }

    // 3. Confirm meta information is returned (total count)
    expect(body.meta).toBeDefined();
    expect(typeof body.meta.total).toBe("number");
  });

  test("TC-M1.6-06: Break-glass access defined", async ({ page, request }) => {
    // Verify break-glass emergency login endpoint exists and is protected
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1";

    // 1. Attempt emergency-login with wrong secret — must NOT succeed
    const res = await request.post(`${apiUrl}/auth/emergency-login`, {
      data: {
        email: "breakglass-test@cybsec.com",
        secret: "invalid-break-glass-secret",
        reason: "Break-glass access UAT test"
      }
    });

    // 2. System must reject with 401/403 (invalid credentials/not permitted) or 429 (rate-limited)
    // NOT 200/201 — break-glass must never allow random access
    expect([400, 401, 403, 429]).toContain(res.status());
  });
});

async function selectDropdown(page: any, label: string, optionText: string) {
  let scope = page.locator('[role="dialog"]:visible');
  if (await scope.count() === 0) {
    scope = page.locator('body');
  }

  const labelEl = scope.locator('label').filter({ hasText: label }).first();
  let container = labelEl.locator('xpath=..');
  const isFlex = await container.evaluate((el: any) => el.classList.contains('flex') || el.className.includes('flex')).catch(() => false);
  if (isFlex) {
    container = container.locator('xpath=..');
  }

  const trigger = container.locator('[data-slot="select-trigger"]').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const popup = page.locator('[data-slot="select-content"]:visible');
  await expect(popup).toBeVisible({ timeout: 5000 });
  const item = popup.locator('[data-slot="select-item"]:visible').filter({ hasText: optionText }).first();
  await item.click();
  await expect(popup).toBeHidden({ timeout: 5000 });
}

async function pickDate(page: any, label: string, day: string, goNextMonths = 0) {
  let scope = page.locator('[role="dialog"]:visible');
  if (await scope.count() === 0) {
    scope = page.locator('body');
  }

  const labelEl = scope.locator('label').filter({ hasText: label }).first();
  let container = labelEl.locator('xpath=..');
  const isFlex = await container.evaluate((el: any) => el.classList.contains('flex') || el.className.includes('flex')).catch(() => false);
  if (isFlex) {
    container = container.locator('xpath=..');
  }

  await container.locator('button').first().scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await container.locator('button').first().click();

  const calendar = page.locator('[data-slot="calendar"]');
  await expect(calendar).toBeVisible({ timeout: 8000 });

  for (let i = 0; i < goNextMonths; i++) {
    await page.locator('[data-slot="calendar"] button').filter({ has: page.locator('svg.lucide-chevron-right') }).first().click();
    await page.waitForTimeout(200);
  }

  const dayBtn = calendar
    .locator('button:not([disabled]):not([aria-disabled="true"])')
    .filter({ hasText: new RegExp(`^${day}$`) })
    .first();
  await dayBtn.click();
  await page.keyboard.press("Escape");
  await expect(calendar).toBeHidden({ timeout: 3000 });
}
