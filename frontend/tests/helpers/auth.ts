import { Page } from "@playwright/test";
import { createTestSession, TestSessionResult } from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// Feature flag: set to true to use real Microsoft SSO login via browser UI.
// Set to false to use fast database session injection (default for CI/CD).
// ─────────────────────────────────────────────────────────────────────────────
export const USE_REAL_SSO = false;

/**
 * Logs in the browser context using Database Session Injection.
 * Direct database write to generate a valid session and set the cookie.
 */
export async function loginViaSessionInjection(
  page: Page,
  email: string,
  isBreakGlass: boolean = false,
  breakGlassReason: string | null = null
): Promise<TestSessionResult> {
  // 1. Clear any existing cookies to prevent session bleed-over between tests
  await page.context().clearCookies();

  // 2. Create a session in the database and sign a JWT
  const sessionResult = await createTestSession(email, isBreakGlass, breakGlassReason);

  // 3. Set cookie on the browser context
  await page.context().addCookies([
    {
      name: "access_token",
      value: sessionResult.token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      // Expose to http://localhost:3000
    },
  ]);

  return sessionResult;
}

/**
 * Logs in via the real Microsoft Entra ID SSO login page.
 * Navigates to /en/login, clicks "Sign in with Microsoft", then fills in
 * email and password on the Microsoft login portal.
 *
 * NOTE: Only use this when the test account has NO MFA configured.
 * Toggle USE_REAL_SSO = true at the top of this file to activate.
 */
export async function loginViaMicrosoftSSO(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  // Set a long per-action timeout to accommodate the Microsoft SSO flow
  page.setDefaultTimeout(60000);

  // 1. Navigate directly to the backend OAuth authorize endpoint.
  //    This bypasses the frontend button click → window.location.href chain
  //    which causes ERR_ABORTED/ERR_CONNECTION_REFUSED in Docker environments
  //    due to the Next.js SSR frame being detached during the redirect.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1";
  const authorizeUrl = `${apiUrl}/auth/entra/authorize?returnTo=/en/dashboard/projects`;

  await page.goto(authorizeUrl, { waitUntil: "commit" });

  // 2. Wait for Microsoft login page to load (email step)
  await page.waitForURL(/login\.microsoftonline\.com/, { timeout: 60000 });

  // 3. Fill email and click Next
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.click('input[type="submit"]');

  // 4. Wait for password step and fill password
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.fill('input[type="password"]', password);
  await page.click('input[type="submit"]');

  // 5. Handle "Stay signed in?" prompt if it appears
  const staySignedIn = page.locator('input[type="submit"][value="Yes"]');
  if (await staySignedIn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await staySignedIn.click();
  }

  // 6. Wait until app redirects back to the dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
}

/**
 * Unified login function — uses real SSO or session injection based on the
 * USE_REAL_SSO flag. Call this in tests instead of calling each function directly.
 *
 * Usage:
 *   await login(page, "smith.pm@bminilik12gmail.onmicrosoft.com");
 */
export async function login(
  page: Page,
  email: string,
  password: string = "577977Mm."
): Promise<void> {
  if (USE_REAL_SSO) {
    await loginViaMicrosoftSSO(page, email, password);
  } else {
    await loginViaSessionInjection(page, email);
  }
}

/**
 * Logs in via the real UI Emergency Login form.
 */
export async function loginViaEmergencyForm(
  page: Page,
  email: string,
  secret: string,
  reason: string
): Promise<void> {
  // 1. Go to the emergency login page
  await page.goto("/en/emergency-login");

  // 2. Fill out the form
  await page.fill("#emergency-email", email);
  await page.fill("#emergency-secret", secret);
  await page.fill("#emergency-reason", reason);

  // 3. Submit
  await page.click('button[type="submit"]');

  // 4. Verify we successfully navigate to the dashboard
  await page.waitForURL("**/dashboard");
}
