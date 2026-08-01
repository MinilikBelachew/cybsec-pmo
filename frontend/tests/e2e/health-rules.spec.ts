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
  SUPER_ADMIN_EMAIL,
  bearer,
  cleanupOrphanPhase3Projects,
  cleanupPhase3Reporting,
  dimension,
  getProjectHealth,
  healthRuleCard,
  restoreDefaultHealthRules,
  seedPhase3Reporting,
  setHealthThresholds,
} from "../helpers/reporting";

const DIMENSIONS = ["schedule", "cost", "risk", "resources", "collections"];
const RULES_URL = `${API_URL}/reports/health-rules`;

/**
 * M3.2 — Project health RAG rules. Thresholds are global, so every test that
 * edits them restores the seeded defaults before it finishes.
 */
test.describe("M3.2 Health RAG rules", () => {
  let dbClient: Client;
  let seed: Phase3Seed;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    await cleanupOrphanPhase3Projects(dbClient);
    seed = await seedPhase3Reporting(dbClient, {
      projectSuffix: `health-${Date.now()}`,
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

  test("TC-M3-2-01: RAG rules cover all five health dimensions", async ({
    page,
    request,
  }) => {
    const session = await loginViaSessionInjection(page, PMO_LEAD_EMAIL);

    await gotoWithCommit(page, "/en/dashboard/settings");
    await waitForAppReady(page);
    await page.getByRole("button", { name: "Health rules" }).click();
    await expect(page.getByText("Project health rules")).toBeVisible({
      timeout: 30000,
    });
    for (const name of DIMENSIONS) {
      const card = healthRuleCard(page, name);
      await expect(card).toBeVisible();
      // green / amber / red thresholds are configured for every dimension.
      await expect(card.getByRole("spinbutton")).toHaveCount(3);
    }
    await holdForVideo(page);

    const rules = await request.get(RULES_URL, {
      headers: bearer(session.token),
    });
    expect(rules.status()).toBe(200);
    const ruleRows = (await rules.json()) as Array<{
      dimension: string;
      greenThreshold: number;
      amberThreshold: number;
      isActive: boolean;
    }>;
    for (const name of DIMENSIONS) {
      const rule = ruleRows.find((row) => row.dimension === name);
      expect(rule, `health rule for ${name}`).toBeTruthy();
      expect(rule!.isActive).toBe(true);
      expect(rule!.greenThreshold).toBeGreaterThan(rule!.amberThreshold);
    }

    const health = await getProjectHealth(request, session.token, seed.projectId);
    expect(health.projectId).toBe(seed.projectId);
    expect(["green", "amber", "red"]).toContain(health.overallRag);
    expect(health.dimensions.map((item) => item.dimension).sort()).toEqual(
      [...DIMENSIONS].sort(),
    );
    for (const item of health.dimensions) {
      expect(Number.isFinite(item.score)).toBe(true);
      expect(["green", "amber", "red"]).toContain(item.ragStatus);
    }
    // Overall RAG is the worst dimension per the rulebook.
    const statuses = health.dimensions.map((item) => item.ragStatus);
    const expectedOverall = statuses.includes("red")
      ? "red"
      : statuses.includes("amber")
        ? "amber"
        : "green";
    expect(health.overallRag).toBe(expectedOverall);
    await holdForVideo(page);
  });

  test("TC-M3-2-02: Thresholds are configurable and change RAG on re-evaluation", async ({
    page,
    request,
  }) => {
    const session = await loginViaSessionInjection(page, SUPER_ADMIN_EMAIL);

    // Baseline — risk and resources both score 100 on the seeded project.
    const before = await getProjectHealth(
      request,
      session.token,
      seed.projectId,
    );
    expect(dimension(before, "risk").ragStatus).toBe("green");
    expect(dimension(before, "resources").ragStatus).toBe("green");

    await gotoWithCommit(page, "/en/dashboard/settings");
    await waitForAppReady(page);
    await page.getByRole("button", { name: "Health rules" }).click();
    await expect(page.getByText("Project health rules")).toBeVisible({
      timeout: 30000,
    });
    await holdForVideo(page);

    try {
      // Raise green above the achievable ceiling so a perfect score reads amber.
      await setHealthThresholds(page, "risk", 101, 99);
      await setHealthThresholds(page, "resources", 101, 99);
      await page.getByRole("button", { name: "Save rules" }).click();
      await expect(page.getByText("Health rules saved")).toBeVisible({
        timeout: 30000,
      });
      await holdForVideo(page);

      const saved = await request.get(RULES_URL, {
        headers: bearer(session.token),
      });
      const savedRows = (await saved.json()) as Array<{
        dimension: string;
        greenThreshold: number;
        amberThreshold: number;
      }>;
      expect(
        savedRows.find((row) => row.dimension === "risk")?.greenThreshold,
      ).toBe(101);
      expect(
        savedRows.find((row) => row.dimension === "resources")?.amberThreshold,
      ).toBe(99);

      const after = await getProjectHealth(
        request,
        session.token,
        seed.projectId,
      );
      expect(dimension(after, "risk").score).toBe(
        dimension(before, "risk").score,
      );
      expect(dimension(after, "risk").ragStatus).toBe("amber");
      expect(dimension(after, "resources").ragStatus).toBe("amber");
    } finally {
      await restoreDefaultHealthRules(request, session.token);
    }

    const restored = await getProjectHealth(
      request,
      session.token,
      seed.projectId,
    );
    expect(dimension(restored, "risk").ragStatus).toBe("green");
    expect(dimension(restored, "resources").ragStatus).toBe("green");
    await holdForVideo(page);
  });

  test("TC-M3-2-03: Scores reconcile to source records and move on change", async ({
    page,
    request,
  }) => {
    const session = await loginViaSessionInjection(page, PMO_LEAD_EMAIL);

    const before = await getProjectHealth(
      request,
      session.token,
      seed.projectId,
    );
    const scheduleBefore = dimension(before, "schedule");
    // Seed: 2 milestones, none done; 1 task at 0% approved progress.
    expect(scheduleBefore.value.milestonesTotal).toBe(2);
    expect(scheduleBefore.value.milestonesDone).toBe(0);
    expect(scheduleBefore.value.avgProgress).toBe(0);
    expect(scheduleBefore.score).toBe(0);

    await gotoWithCommit(page, "/en/dashboard/reports/status");
    await waitForAppReady(page);
    await holdForVideo(page);

    // Controlled source change: complete one milestone and approve task progress.
    await dbClient.query(
      "UPDATE project_milestones SET status = 'Done' WHERE id = $1",
      [seed.milestoneAlphaId],
    );
    await dbClient.query(
      "UPDATE tasks SET progress_approved = 100 WHERE id = $1",
      [seed.taskId],
    );

    const after = await getProjectHealth(
      request,
      session.token,
      seed.projectId,
    );
    const scheduleAfter = dimension(after, "schedule");
    expect(scheduleAfter.value.milestonesDone).toBe(1);
    expect(scheduleAfter.value.avgProgress).toBe(100);
    // 50% of milestones (weight 0.6) + 100% task progress (weight 0.4).
    expect(scheduleAfter.score).toBe(70);
    expect(scheduleAfter.score).toBeGreaterThan(scheduleBefore.score);
    expect(scheduleAfter.ragStatus).toBe("amber");

    // Untouched dimensions must not drift.
    expect(dimension(after, "risk").score).toBe(dimension(before, "risk").score);
    expect(dimension(after, "cost").score).toBe(dimension(before, "cost").score);
    await holdForVideo(page);
  });
});
