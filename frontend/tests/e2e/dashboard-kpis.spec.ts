import { test, expect } from "@playwright/test";
import crypto from "crypto";
import type { Client } from "pg";
import { loginViaSessionInjection } from "../helpers/auth";
import { getDbClient } from "../helpers/db";
import {
  captureEvidence,
  gotoWithCommit,
  holdForVideo,
  waitForAppReady,
} from "../helpers/resources";
import {
  API_URL,
  ENG_EMAIL,
  PMO_LEAD_EMAIL,
  PM_EMAIL,
  Phase3Seed,
  bearer,
  cleanupOrphanPhase3Projects,
  cleanupPhase3Reporting,
  seedPhase3Reporting,
  selectWithOption,
} from "../helpers/reporting";

/**
 * M3.1 — Executive dashboard & KPIs.
 * The PMO Lead account is seeded by the helper: the backend seed ships none.
 * Titles stay short so Playwright keeps the TC id in the artifact folder name.
 */
test.describe("M3.1 Dashboard KPIs", () => {
  let dbClient: Client;
  let seed: Phase3Seed;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    await cleanupOrphanPhase3Projects(dbClient);
    seed = await seedPhase3Reporting(dbClient, {
      projectSuffix: `dash-${Date.now()}`,
    });
  });

  test.afterAll(async () => {
    if (dbClient) {
      if (seed) await cleanupPhase3Reporting(dbClient, seed);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });

  test("TC-M3-1-01: KPIs load for schedule, milestones, budget and utilisation", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard");
    await waitForAppReady(page);

    // Portfolio Overview is the PMO Lead default tab.
    // Title lives in the subtitle ("Executive Dashboard · …"), not the h1.
    await expect(page.getByText(/Executive Dashboard ·/)).toBeVisible({
      timeout: 60000,
    });
    await expect(
      page.getByRole("button", { name: "Portfolio Overview" }),
    ).toBeVisible();
    await expect(page.getByText("Project Progress")).toBeVisible();
    await expect(page.getByText("On-Time Delivery")).toBeVisible();
    await expect(
      page.getByText(/Total Portfolio Budget|Total Projects/).first(),
    ).toBeVisible();
    await expect(page.getByText("Collection", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Project Health", { exact: true }),
    ).toBeVisible({ timeout: 30000 });

    // Execution Health — task/risk KPIs plus the project health table.
    await page.getByRole("button", { name: "Execution Health" }).click();
    await expect(page.getByText("Task Completion Rate")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText("Overdue Tasks")).toBeVisible();
    await expect(page.getByText("Active Risks")).toBeVisible();
    await expect(page.getByText("Pending Timesheets")).toBeVisible();
    await expect(page.getByText(seed.projectName).first()).toBeVisible({
      timeout: 30000,
    });

    // People & Resources — workload / utilisation widgets.
    await page.getByRole("button", { name: "People & Resources" }).click();
    await expect(page.getByText("Resource Utilization").first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText("Overallocated").first()).toBeVisible();
    await expect(page.getByText("Billable Hours").first()).toBeVisible();
    await holdForVideo(page);

    // Settings → Health rules exposes the five configured RAG dimensions.
    await gotoWithCommit(page, "/en/dashboard/settings");
    await waitForAppReady(page);
    await page.getByRole("button", { name: "Health rules" }).click();
    await expect(page.getByText("Project health rules")).toBeVisible({
      timeout: 30000,
    });
    for (const name of ["schedule", "cost", "risk", "resources", "collections"]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    await holdForVideo(page);
  });

  test("TC-M3-1-02: Role-based dashboard access enforced", async ({
    page,
    request,
  }) => {
    // 1. Engineer — no portfolio filters, no access to the reports hub.
    const engSession = await loginViaSessionInjection(page, ENG_EMAIL);
    await gotoWithCommit(page, "/en/dashboard");
    await waitForAppReady(page);
    await expect(page.getByText(/My Workspace ·/)).toBeVisible({ timeout: 60000 });
    await expect(selectWithOption(page, "All departments")).toHaveCount(0);
    await expect(selectWithOption(page, "All statuses")).toHaveCount(0);
    await expect(selectWithOption(page, "All project managers")).toHaveCount(0);

    await gotoWithCommit(page, "/en/dashboard/reports/utilization");
    await captureEvidence(
      page,
      /You do not have permission to view utilization reports/i,
      { timeout: 60000 },
    );
    const engApi = await request.get(`${API_URL}/reports/utilisation`, {
      headers: bearer(engSession.token),
    });
    expect(engApi.status()).toBe(403);

    // 2. PM (own_projects) — only their own projects reach the dashboard.
    await loginViaSessionInjection(page, PM_EMAIL);
    await gotoWithCommit(page, "/en/dashboard");
    await waitForAppReady(page);
    await expect(page.getByText(/PM Dashboard ·/)).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(seed.projectName).first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(seed.otherProjectName)).toHaveCount(0);
    await holdForVideo(page);

    // 3. PMO Lead (all) — cross-PM portfolio visibility.
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard");
    await waitForAppReady(page);
    await expect(page.getByText(seed.projectName).first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(seed.otherProjectName).first()).toBeVisible({
      timeout: 30000,
    });
    await holdForVideo(page);
  });

  test("TC-M3-1-03: Dashboard filters available and role scoped", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard");
    await waitForAppReady(page);

    const departmentFilter = selectWithOption(page, "All departments");
    const statusFilter = selectWithOption(page, "All statuses");
    const pmFilter = selectWithOption(page, "All project managers");
    await expect(departmentFilter).toBeVisible({ timeout: 60000 });
    await expect(statusFilter).toBeVisible();
    await expect(pmFilter).toBeVisible();

    const healthRefetched = page.waitForResponse(
      (response) =>
        response.url().includes("/dashboard/project-health") &&
        response.status() === 200,
      { timeout: 90000 },
    );
    await departmentFilter.selectOption(seed.deptId);
    await statusFilter.selectOption("Active");
    await healthRefetched;
    await expect(page.getByText(seed.projectName).first()).toBeVisible({
      timeout: 30000,
    });
    await holdForVideo(page);

    const clearFilters = page.getByRole("button", { name: "Clear filters" });
    await expect(clearFilters).toBeVisible();
    await clearFilters.click();
    await expect(departmentFilter).toHaveValue("");
    await expect(statusFilter).toHaveValue("");
    await expect(page.getByText(seed.projectName).first()).toBeVisible({
      timeout: 30000,
    });
    await holdForVideo(page);

    // Engineer never sees the filter bar.
    await loginViaSessionInjection(page, ENG_EMAIL);
    await gotoWithCommit(page, "/en/dashboard");
    await waitForAppReady(page);
    await expect(page.getByText(/My Workspace ·/)).toBeVisible({ timeout: 60000 });
    await expect(selectWithOption(page, "All departments")).toHaveCount(0);
    await holdForVideo(page);

    // PM keeps department/status but never gets a cross-PM filter.
    await loginViaSessionInjection(page, PM_EMAIL);
    await gotoWithCommit(page, "/en/dashboard");
    await waitForAppReady(page);
    await expect(selectWithOption(page, "All departments")).toBeVisible({
      timeout: 60000,
    });
    await expect(selectWithOption(page, "All statuses")).toBeVisible();
    await expect(selectWithOption(page, "All project managers")).toHaveCount(0);
    await expect(page.getByText(seed.otherProjectName)).toHaveCount(0);
    await holdForVideo(page);
  });

  test("TC-M3-1-04: Drill-down into project and utilisation detail", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard");
    await waitForAppReady(page);

    await page.getByRole("button", { name: "Execution Health" }).click();
    // exact — the tab also renders a "Project Health Simulator" card.
    await expect(
      page.getByText("Project Health", { exact: true }),
    ).toBeVisible({ timeout: 30000 });

    const healthRow = page
      .getByRole("row")
      .filter({ hasText: seed.projectName })
      .first();
    await expect(healthRow).toBeVisible({ timeout: 30000 });
    await healthRow.click();
    await page.waitForURL(new RegExp(`/dashboard/projects/${seed.projectId}`), {
      timeout: 120000,
    });
    await waitForAppReady(page);
    await expect(page.getByText(seed.projectName).first()).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page);

    // People & Resources → detailed utilisation report.
    await gotoWithCommit(page, "/en/dashboard");
    await waitForAppReady(page);
    await page.getByRole("button", { name: "People & Resources" }).click();
    await expect(page.getByText("Resource Utilization").first()).toBeVisible({
      timeout: 30000,
    });

    await gotoWithCommit(page, "/en/dashboard/reports/utilization");
    await waitForAppReady(page);
    await captureEvidence(page, /Utilization|Utilisation/i, { timeout: 60000 });
  });

  test("TC-M3-1-05: Freshness badge and Reload refetch live data", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard");
    await waitForAppReady(page);

    const freshness = page
      .locator("span")
      .filter({ hasText: /As of \d|Refreshing/ })
      .first();
    await expect(freshness).toBeVisible({ timeout: 60000 });
    await expect(page.getByText("live", { exact: true }).first()).toBeVisible();
    const before = (await freshness.textContent())?.trim() ?? "";
    expect(before).toMatch(/As of \d|Refreshing/);
    await holdForVideo(page);

    const reload = page.getByRole("button", { name: "Reload" });
    await expect(reload).toBeVisible();
    const [statsResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/dashboard/stats") &&
          response.status() === 200,
        { timeout: 90000 },
      ),
      reload.click(),
    ]);
    const stats = (await statsResponse.json()) as {
      dataFreshness?: { source?: string };
    };
    expect(stats.dataFreshness?.source).toBe("live");

    await expect(freshness).toBeVisible();
    const after = (await freshness.textContent())?.trim() ?? "";
    expect(after).toMatch(/As of \d/);
    await holdForVideo(page);
  });

  test("TC-M3-1-06: Unknown project ID returns structured 404", async ({
    page,
    request,
  }) => {
    const session = await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard");
    await waitForAppReady(page);

    const missingId = crypto.randomUUID();

    const healthRes = await request.get(
      `${API_URL}/reports/health/projects/${missingId}`,
      { headers: bearer(session.token) },
    );
    expect(healthRes.status()).toBe(404);
    const healthBody = (await healthRes.json()) as { message?: string };
    expect(String(healthBody.message)).toMatch(/not found/i);

    const reportRes = await request.get(`${API_URL}/reports/status/${missingId}`, {
      headers: bearer(session.token),
    });
    expect(reportRes.status()).toBe(404);
    const reportBody = (await reportRes.json()) as { message?: string };
    expect(String(reportBody.message)).toMatch(/not found/i);

    // No partial writes for the unknown ids.
    const written = await dbClient.query(
      "SELECT id FROM generated_reports WHERE id = $1",
      [missingId],
    );
    expect(written.rows.length).toBe(0);
    await holdForVideo(page);
  });
});
