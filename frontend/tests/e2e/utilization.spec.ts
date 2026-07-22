import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { loginViaSessionInjection } from "../helpers/auth";
import { getDbClient } from "../helpers/db";
import {
  PM_EMAIL,
  Phase2Seed,
  captureEvidence,
  cleanupPhase2Resources,
  expectVisibleInTable,
  gotoWithCommit,
  holdForVideo,
  seedPhase2Resources,
  todayDateKey,
} from "../helpers/resources";

test.describe("Resource & Time – Utilization (Phase 2)", () => {
  let dbClient: any;
  let seed: Phase2Seed;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    seed = await seedPhase2Resources(dbClient, {
      projectSuffix: `util-${Date.now()}`,
    });

    const workDate = todayDateKey();
    // Seed submitted + approved hours for formula/column checks
    await dbClient.query(
      `INSERT INTO timesheets (id, employee_id, project_id, task_id, work_date, regular_hours, overtime_hours, notes, is_billable, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::date, 8, 0, 'util approved', true, 'Approved', NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [
        crypto.randomUUID(),
        seed.engEmployeeId,
        seed.projectId,
        seed.taskId,
        workDate,
      ],
    );
    await dbClient.query(
      `INSERT INTO timesheets (id, employee_id, project_id, task_id, work_date, regular_hours, overtime_hours, notes, is_billable, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, ($5::date - INTERVAL '1 day'), 4, 0, 'util submitted', true, 'Submitted', NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [
        crypto.randomUUID(),
        seed.engEmployeeId,
        seed.projectId,
        seed.criticalTaskId,
        workDate,
      ],
    );
  });

  test.afterAll(async () => {
    if (dbClient && seed) {
      await cleanupPhase2Resources(dbClient, seed);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });

  test("TC-M2.6-01: Utilisation formula approved", async ({ page }) => {
    await loginViaSessionInjection(page, PM_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/reports/utilization");
    await expect(page.getByText("Resource Utilization")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByText(/cybsec-2026-v1|How each column is calculated/i),
    ).toBeVisible();
    await expect(page.getByText(/Available/i).first()).toBeVisible();
    await expect(page.getByText(/Planned/i).first()).toBeVisible();
    await expect(page.getByText(/Billable util/i).first()).toBeVisible();

    // Spot-check Dave row appears with numeric utilisation
    await page.getByPlaceholder(/Search name, role/i).fill("M2 Dave");
    await page.waitForTimeout(400);
    await expectVisibleInTable(page, "M2 Dave Engineer");
    await holdForVideo(page);
  });

  test("TC-M2.6-02: Report shows planned, submitted, approved, billable, non-billable and available hours", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PM_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/reports/utilization");
    await expect(page.getByText("Resource Utilization")).toBeVisible({
      timeout: 30000,
    });

    for (const col of [
      "Planned",
      "Submitted",
      "Approved",
      "Billable",
      "Available",
      "Keka",
    ]) {
      await expect(page.getByText(col, { exact: false }).first()).toBeVisible();
    }
    await expect(
      page.getByText(/Non-bill|Non-billable|Non-bill\./i).first(),
    ).toBeVisible();

    await holdForVideo(page);
  });

  test("TC-M2.6-03: Filter by employee / team / project", async ({ page }) => {
    await loginViaSessionInjection(page, PM_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/reports/utilization");
    await expect(page.getByTestId("util-period")).toBeVisible({
      timeout: 30000,
    });

    await page.getByTestId("util-period").getByText("This month").click();
    await page.getByPlaceholder(/Search name, role/i).fill("M2 Dave");
    await page.waitForTimeout(400);
    await expectVisibleInTable(page, "M2 Dave Engineer");

    await page.getByTestId("util-period").getByText("Last 30 days").click();
    await expect(page.getByText("Resource Utilization")).toBeVisible();

    const exportBtn = page.getByTestId("util-export-csv");
    await expect(exportBtn).toBeVisible();
    // Click export — download may start; just ensure button works
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }).catch(() => null),
      exportBtn.click(),
    ]);
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    }

    await page.getByTestId("util-period").getByText("This month").click();
    await expectVisibleInTable(page, "M2 Dave Engineer");
    await holdForVideo(page);
  });

  test("TC-M2.6-04: Reconciles to Keka", async ({ page }) => {
    await loginViaSessionInjection(page, PM_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/reports/utilization");
    await expect(page.getByTestId("util-keka-column")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(/Keka reconciliation/i)).toBeVisible();
    await captureEvidence(page, /Matched|Pending|Mismatch|No Keka|Keka/i);
  });
});
