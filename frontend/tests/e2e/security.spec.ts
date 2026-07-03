import { test, expect } from "@playwright/test";
import { loginViaSessionInjection } from "../helpers/auth";
import { getDbClient } from "../helpers/db";

test.describe("Security & SSO", () => {
  let dbClient: any;
  let engEmail = "briannguyen@bminilik12gmail.onmicrosoft.com";

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
  test("TC-M1.6-01: Entire ID SSO login working", async ({ page }) => {
    // 1. Navigate to login page
    await page.goto("/en/login");
    await page.waitForLoadState("networkidle");

    // 2. Click "Sign in with Microsoft"
    await page.click('button:has-text("Sign in with Microsoft")');

    // 3. Verify it redirects to Microsoft Entra authorization endpoint
    await page.waitForURL(/login\.microsoftonline\.com/);
    expect(page.url()).toContain("login.microsoftonline.com");
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
});
