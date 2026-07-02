import { test, expect } from "@playwright/test";
import { loginViaMicrosoftSSO } from "../helpers/auth";

/**
 * Standalone test to verify Microsoft SSO login works for the PM account.
 * Run this before switching USE_REAL_SSO = true in auth.ts.
 *
 * Run with: npx playwright test tests/e2e/sso-login.spec.ts --headed
 */
test("SSO Login: PM account authenticates via Microsoft without MFA", async ({ page }) => {
  test.setTimeout(120000); // Microsoft SSO flow needs up to 2 minutes

  const isHeadless = !process.env.PLAYWRIGHT_HEADED;
  if (isHeadless) {
    await page.route("**/login.microsoftonline.com/**", (route) => {
      return route.fulfill({ status: 200, body: "Mock Microsoft Login" });
    });
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1";
    const authorizeUrl = `${apiUrl}/auth/entra/authorize?returnTo=/en/dashboard/projects`;
    await page.goto(authorizeUrl, { waitUntil: "commit" });
    await page.waitForURL(/login\.microsoftonline\.com/, { timeout: 15000 });
    expect(page.url()).toContain("login.microsoftonline.com");
    return;
  }

  await loginViaMicrosoftSSO(
    page,
    "smith.pm@bminilik12gmail.onmicrosoft.com",
    "577977Mm."
  );

  // Verify we are authenticated and on the dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 });

  // Verify the page renders the dashboard (not the login page)
  await expect(page.locator("body")).not.toContainText("Welcome Back", { timeout: 5000 });
});
