import { test, expect } from "@playwright/test";
import type { Client } from "pg";
import { loginViaSessionInjection } from "../helpers/auth";
import { getDbClient } from "../helpers/db";
import {
  gotoWithCommit,
  holdForVideo,
  waitForAppReady,
} from "../helpers/resources";
import {
  API_URL,
  PMO_LEAD_EMAIL,
  Phase3Seed,
  bearer,
  cleanupOrphanPhase3Projects,
  cleanupPhase3Reporting,
  flagRow,
  resetDataQualityRules,
  scanRuleGroup,
  seedPhase3Reporting,
  selectWithOption,
  setScanRule,
} from "../helpers/reporting";

async function saveRules(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Save rules" }).click();
  await expect(page.getByText("Data quality rules saved")).toBeVisible({
    timeout: 30000,
  });
}

async function scanAll(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Scan all projects" }).click();
  await expect(page.getByText("Data quality scan complete")).toBeVisible({
    timeout: 120000,
  });
}

/** M3.6 — Data quality scan rules, flags and include/exclude behaviour. */
test.describe("M3.6 Data quality", () => {
  let dbClient: Client;
  let seed: Phase3Seed;
  let adminToken: string;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    await cleanupOrphanPhase3Projects(dbClient);
    seed = await seedPhase3Reporting(dbClient, {
      projectSuffix: `dq-${Date.now()}`,
    });
  });

  test.afterAll(async () => {
    if (dbClient) {
      await dbClient.query(
        `UPDATE app_settings SET data_quality_rules = '{}'::jsonb WHERE id = 'default'`,
      );
      if (seed) await cleanupPhase3Reporting(dbClient, seed);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page, request }) => {
    test.setTimeout(360000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);

    const session = await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    adminToken = session.token;
    await resetDataQualityRules(request, session.token);

    // Force Keka last success older than the 48h stale threshold when possible.
    await dbClient.query(
      `UPDATE keka_sync_logs SET created_at = NOW() - INTERVAL '3 days'
        WHERE id IN (SELECT id FROM keka_sync_logs WHERE status = 'success' ORDER BY created_at DESC LIMIT 1)`,
    ).catch(() => undefined);

    await gotoWithCommit(page, "/en/dashboard/reports/data-quality");
    await waitForAppReady(page);
    await expect(
      page.getByRole("heading", { name: "Data Quality" }),
    ).toBeVisible({
      timeout: 60000,
    });
    await expect(page.getByText("Scan rules")).toBeVisible();
  });

  test("TC-M3-6-01: Missing and unapproved timesheets are flagged", async ({
    page,
  }) => {
    await setScanRule(page, "Missing timesheet", "Include");
    await setScanRule(page, "Unapproved timesheet", "Include");
    await setScanRule(page, "Stale integration", "Exclude");
    await setScanRule(page, "Incomplete project", "Exclude");
    await saveRules(page);
    await holdForVideo(page);

    await scanAll(page);

    await selectWithOption(page, "All projects").selectOption(
      seed.incompleteProjectId,
    );
    await selectWithOption(page, "All flag types").selectOption(
      "MISSING_TIMESHEET",
    );
    await selectWithOption(page, "All statuses").selectOption("open");

    const missing = flagRow(
      page,
      "MISSING_TIMESHEET",
      seed.incompleteProjectName,
    );
    await expect(missing).toBeVisible({ timeout: 60000 });
    await expect(missing.getByText("Open")).toBeVisible();
    await holdForVideo(page);

    await selectWithOption(page, "All projects").selectOption(seed.projectId);
    await selectWithOption(page, "All flag types").selectOption(
      "UNAPPROVED_TIMESHEET",
    );
    const unapproved = flagRow(
      page,
      "UNAPPROVED_TIMESHEET",
      seed.projectName,
    );
    await expect(unapproved).toBeVisible({ timeout: 60000 });
    await holdForVideo(page);

    // Resolve one open flag and confirm it leaves the Open list.
    await unapproved.getByRole("button", { name: "Resolve" }).click();
    await expect(page.getByText("Flag resolved")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      flagRow(page, "UNAPPROVED_TIMESHEET", seed.projectName),
    ).toHaveCount(0);

    await selectWithOption(page, "All statuses").selectOption("resolved");
    await expect(
      flagRow(page, "UNAPPROVED_TIMESHEET", seed.projectName),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      flagRow(page, "UNAPPROVED_TIMESHEET", seed.projectName).getByText(
        "Resolved",
      ),
    ).toBeVisible();
    await holdForVideo(page);
  });

  test("TC-M3-6-02: Stale integrations are flagged when Included", async ({
    page,
    request,
  }) => {
    await setScanRule(page, "Stale integration", "Include");
    await setScanRule(page, "Missing timesheet", "Exclude");
    await setScanRule(page, "Unapproved timesheet", "Exclude");
    await setScanRule(page, "Incomplete project", "Exclude");
    await saveRules(page);

    await scanAll(page);

    await selectWithOption(page, "All flag types").selectOption(
      "STALE_INTEGRATION",
    );
    await selectWithOption(page, "All statuses").selectOption("open");

    const stale = page
      .getByRole("row")
      .filter({ hasText: "STALE_INTEGRATION" })
      .first();
    await expect(stale).toBeVisible({ timeout: 60000 });
    await expect(stale.getByText(/Keka/i)).toBeVisible();
    await holdForVideo(page);

    const api = await request.get(
      `${API_URL}/reports/data-quality?flagType=STALE_INTEGRATION&resolved=false`,
      { headers: bearer(adminToken) },
    );
    expect(api.status()).toBe(200);
    const body = (await api.json()) as { data: Array<{ flagType: string }> };
    expect(body.data.some((row) => row.flagType === "STALE_INTEGRATION")).toBe(
      true,
    );
  });

  test("TC-M3-6-03: Incomplete projects are flagged when Included", async ({
    page,
  }) => {
    await setScanRule(page, "Incomplete project", "Include");
    await setScanRule(page, "Missing timesheet", "Exclude");
    await setScanRule(page, "Unapproved timesheet", "Exclude");
    await setScanRule(page, "Stale integration", "Exclude");
    await saveRules(page);

    await scanAll(page);

    await selectWithOption(page, "All projects").selectOption(
      seed.incompleteProjectId,
    );
    await selectWithOption(page, "All flag types").selectOption(
      "INCOMPLETE_PROJECT",
    );
    await selectWithOption(page, "All statuses").selectOption("open");

    const incomplete = flagRow(
      page,
      "INCOMPLETE_PROJECT",
      seed.incompleteProjectName,
    );
    await expect(incomplete).toBeVisible({ timeout: 60000 });
    await expect(incomplete.getByText(/has no milestones/i)).toBeVisible();
    await holdForVideo(page);

    // Complete project must not be flagged as incomplete.
    await selectWithOption(page, "All projects").selectOption(seed.projectId);
    await expect(
      flagRow(page, "INCOMPLETE_PROJECT", seed.projectName),
    ).toHaveCount(0);
    await holdForVideo(page);
  });

  test("TC-M3-6-04: Include/Exclude rules persist and gate the scan", async ({
    page,
    request,
  }) => {
    // Helper text explains the Include/Exclude semantics.
    await expect(
      page.getByText(/Include.*runs the check.*Exclude.*skips/i),
    ).toBeVisible();

    await setScanRule(page, "Stale integration", "Exclude");
    await setScanRule(page, "Missing timesheet", "Include");
    await setScanRule(page, "Unapproved timesheet", "Include");
    await setScanRule(page, "Incomplete project", "Include");
    await saveRules(page);
    await holdForVideo(page);

    const saved = await request.get(`${API_URL}/reports/data-quality/rules`, {
      headers: bearer(adminToken),
    });
    expect(saved.status()).toBe(200);
    const rules = (await saved.json()) as {
      excludeFlagTypes?: string[];
      includeFlagTypes?: string[];
    };
    expect(rules.excludeFlagTypes).toContain("STALE_INTEGRATION");

    await scanAll(page);
    await selectWithOption(page, "All flag types").selectOption(
      "STALE_INTEGRATION",
    );
    await selectWithOption(page, "All statuses").selectOption("open");
    await expect(
      page.getByRole("row").filter({ hasText: "STALE_INTEGRATION" }),
    ).toHaveCount(0);
    await holdForVideo(page);

    // Included types still run.
    await selectWithOption(page, "All projects").selectOption(
      seed.incompleteProjectId,
    );
    await selectWithOption(page, "All flag types").selectOption(
      "MISSING_TIMESHEET",
    );
    await expect(
      flagRow(page, "MISSING_TIMESHEET", seed.incompleteProjectName),
    ).toBeVisible({ timeout: 60000 });

    // Flip Stale integration back to Include and rescan.
    await setScanRule(page, "Stale integration", "Include");
    await expect(
      scanRuleGroup(page, "Stale integration").getByRole("radio", {
        name: "Include",
      }),
    ).toHaveAttribute("aria-checked", "true");
    await saveRules(page);
    await scanAll(page);

    await selectWithOption(page, "All projects").selectOption("");
    await selectWithOption(page, "All flag types").selectOption(
      "STALE_INTEGRATION",
    );
    await expect(
      page.getByRole("row").filter({ hasText: "STALE_INTEGRATION" }).first(),
    ).toBeVisible({ timeout: 60000 });
    await holdForVideo(page);
  });
});
