import { Page } from "@playwright/test";
import { createTestSession, TestSessionResult } from "./db";

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
  // 1. Create a session in the database and sign a JWT
  const sessionResult = await createTestSession(email, isBreakGlass, breakGlassReason);

  // 2. Set cookie on the browser context
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
