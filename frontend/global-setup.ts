/**
 * global-setup.ts
 * Runs once before the suite, off-camera.
 *
 * In dev the Next server compiles each route on first request, which costs
 * 10-30s and shows up as a blank spinner in the middle of a test video. Paying
 * that cost here keeps it out of the recordings; next.config's onDemandEntries
 * then keeps the routes compiled for the rest of the run.
 *
 * Never fails the run: a broken warm-up only means slower tests, and the tests
 * themselves report the real problem far more clearly.
 */
import { chromium, type Browser, type FullConfig } from "@playwright/test";
import { createTestSession } from "./tests/helpers/db";
import { IT_ADMIN_EMAIL, PM_EMAIL } from "./tests/helpers/resources";

/**
 * Only accounts from the backend seed are usable here — per-phase fixtures are
 * seeded later, inside the spec files. Which of these exists varies by database,
 * so try each and take the first that resolves.
 */
const WARMUP_EMAILS = ["bminilik12@gmail.com", IT_ADMIN_EMAIL, PM_EMAIL];

/** Dev compiles a dynamic segment regardless of whether the record resolves. */
const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

const ROUTES_BY_PHASE: Record<string, string[]> = {
  "1": [
    "/en/login",
    "/en/dashboard",
    "/en/dashboard/projects",
    `/en/dashboard/projects/${PLACEHOLDER_ID}`,
    "/en/dashboard/roles",
    "/en/dashboard/audit",
    "/en/dashboard/notifications",
  ],
  "2": [
    "/en/dashboard",
    "/en/dashboard/team",
    "/en/dashboard/team/approvals",
    "/en/dashboard/timesheets/log",
    "/en/dashboard/timesheets/approvals",
    "/en/dashboard/integrations/keka",
    "/en/dashboard/reports/utilization",
  ],
  "3": [
    "/en/dashboard",
    "/en/dashboard/settings",
    "/en/dashboard/reports/status",
    `/en/dashboard/reports/status/${PLACEHOLDER_ID}`,
    "/en/dashboard/reports/schedules",
    "/en/dashboard/reports/data-quality",
    "/en/dashboard/reports/utilization",
    `/en/dashboard/projects/${PLACEHOLDER_ID}`,
  ],
  "4": [
    "/en/dashboard",
    "/en/dashboard/risks",
    "/en/dashboard/issues",
    "/en/dashboard/alerts",
    "/en/dashboard/escalations",
    "/en/dashboard/actions",
    "/en/dashboard/lessons",
    `/en/dashboard/projects/${PLACEHOLDER_ID}`,
  ],
};

/** Frontend route handlers the shell calls on mount; they compile separately. */
const API_ROUTES = ["/api/ws-token"];

function describe(error: unknown) {
  return error instanceof Error ? error.message.split("\n")[0] : String(error);
}

export default async function globalSetup(config: FullConfig) {
  if (process.env.PLAYWRIGHT_SKIP_WARMUP === "1") return;

  const phase = process.env.PLAYWRIGHT_PHASE ?? "1";
  const routes = ROUTES_BY_PHASE[phase];
  if (!routes?.length) return;

  const baseURL =
    config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  let token: string | undefined;
  let lastError: unknown;
  for (const email of WARMUP_EMAILS) {
    try {
      token = (await createTestSession(email)).token;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!token) {
    console.warn(`[warmup] skipped, no session: ${describe(lastError)}`);
    return;
  }

  let browser: Browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    console.warn(`[warmup] skipped, no browser: ${describe(error)}`);
    return;
  }

  const startedAt = Date.now();

  try {
    const context = await browser.newContext({ baseURL });
    await context.addCookies(
      ["localhost", "127.0.0.1"].map((domain) => ({
        name: "access_token",
        value: token,
        domain,
        path: "/",
        httpOnly: true,
        sameSite: "Lax" as const,
      })),
    );

    const page = await context.newPage();

    for (const route of routes) {
      const routeStartedAt = Date.now();
      try {
        await page.goto(route, { waitUntil: "load", timeout: 180000 });
        await page
          .locator("main")
          .first()
          .waitFor({ state: "visible", timeout: 60000 });
        console.log(`[warmup] ${route} — ${Date.now() - routeStartedAt}ms`);
      } catch (error) {
        console.warn(
          `[warmup] ${route} — ${Date.now() - routeStartedAt}ms, ${describe(error)}`,
        );
      }
    }

    for (const route of API_ROUTES) {
      await context.request
        .get(route, { timeout: 120000 })
        .catch((error) => console.warn(`[warmup] ${route} — ${describe(error)}`));
    }

    console.log(
      `[warmup] phase ${phase} ready in ${Math.round((Date.now() - startedAt) / 1000)}s`,
    );
  } catch (error) {
    console.warn(`[warmup] aborted: ${describe(error)}`);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
