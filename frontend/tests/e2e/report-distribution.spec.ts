import { test, expect } from "@playwright/test";
import crypto from "crypto";
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
  PM_EMAIL,
  Phase3Seed,
  SUPER_ADMIN_EMAIL,
  bearer,
  cleanupOrphanPhase3Projects,
  cleanupPhase3Reporting,
  downloadEvidence,
  exportStatusReport,
  generateStatusReport,
  latestReportId,
  seedPhase3Reporting,
} from "../helpers/reporting";

/** M3.5 — Cross-surface exports and scheduled distribution. */
test.describe("M3.5 Export & schedules", () => {
  let dbClient: Client;
  let seed: Phase3Seed;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    await cleanupOrphanPhase3Projects(dbClient);
    seed = await seedPhase3Reporting(dbClient, {
      projectSuffix: `sched-${Date.now()}`,
    });
  });

  test.afterAll(async () => {
    if (dbClient) {
      if (seed) await cleanupPhase3Reporting(dbClient, seed);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(360000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });

  test("TC-M3-5-01: Export status, utilisation and portfolio reports", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PM_EMAIL);

    // Status Reports — all four formats.
    await gotoWithCommit(page, "/en/dashboard/reports/status");
    await waitForAppReady(page);
    await generateStatusReport(page, seed.projectId, "WSR");
    const report = await latestReportId(dbClient, seed.projectId, "WSR");
    await exportStatusReport(page, report.id, "PDF", ".pdf");
    await exportStatusReport(page, report.id, "DOCX", ".docx");
    await exportStatusReport(page, report.id, "Excel", ".xlsx");
    await exportStatusReport(page, report.id, "CSV", ".csv");
    await holdForVideo(page);

    // Utilisation — CSV.
    await gotoWithCommit(page, "/en/dashboard/reports/utilization");
    await waitForAppReady(page);
    await expect(page.getByTestId("util-export-csv")).toBeVisible({
      timeout: 60000,
    });
    await downloadEvidence(
      page,
      () => page.getByTestId("util-export-csv").click(),
      ".csv",
    );
    await holdForVideo(page);

    // Dashboard — Export Portfolio (Excel by default).
    await gotoWithCommit(page, "/en/dashboard");
    await waitForAppReady(page);
    await page.getByRole("button", { name: "Export Portfolio" }).click();
    await expect(page.getByText("Export Project Schedule")).toBeVisible({
      timeout: 30000,
    });
    await downloadEvidence(
      page,
      () => page.getByRole("button", { name: "Export Schedule" }).click(),
      ".xlsx",
    );
    await holdForVideo(page);
  });

  test("TC-M3-5-02: Schedule to role-based recipients with toggle and delete", async ({
    page,
  }) => {
    // Super Admin has rbac.view so the recipient-role picker is populated.
    await loginViaSessionInjection(page, SUPER_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/reports/schedules");
    await waitForAppReady(page);
    await expect(
      page.getByRole("heading", { name: "Report Schedules" }),
    ).toBeVisible({
      timeout: 60000,
    });

    await page.getByRole("button", { name: "Create schedule" }).click();
    await expect(page.getByText("Create report schedule")).toBeVisible({
      timeout: 30000,
    });

    // WSR is the default report type; confirm project + weekday + time.
    await page.locator("#schedule-project").selectOption(seed.projectId);
    await page.locator("#schedule-weekday").selectOption("1");
    await page.locator("#schedule-time").fill("09:00");

    // Role picker shows label + code; pick the PM role.
    const pmRole = page
      .locator("label")
      .filter({ has: page.getByText("PM", { exact: true }) })
      .filter({ has: page.getByText("pm", { exact: true }) })
      .first();
    await expect(pmRole).toBeVisible({ timeout: 30000 });
    await pmRole.locator('[data-slot="checkbox"]').click();
    await expect(pmRole.locator('[data-slot="checkbox"]')).toHaveAttribute(
      "data-checked",
      "",
    );

    await page
      .getByRole("button", { name: "Create schedule" })
      .last()
      .click();
    await expect(page.getByText("Schedule created")).toBeVisible({
      timeout: 60000,
    });

    const card = page
      .locator("div.flex.flex-wrap")
      .filter({ hasText: `WSR · ${seed.projectName}` })
      .first();
    await expect(card).toBeVisible({ timeout: 30000 });
    await expect(card.getByText(/Recipients:/)).toBeVisible();
    await holdForVideo(page);

    // Active → Inactive toggle.
    const statusGroup = card.getByRole("radiogroup", {
      name: "Schedule status",
    });
    // exact — "Inactive" contains "Active" under substring matching.
    await expect(
      statusGroup.getByRole("radio", { name: "Active", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await statusGroup.getByRole("radio", { name: "Inactive" }).click();
    await expect(page.getByText("Schedule deactivated")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      statusGroup.getByRole("radio", { name: "Inactive" }),
    ).toHaveAttribute("aria-checked", "true");
    await holdForVideo(page);

    // Delete with confirmation (trash icon button).
    await card.locator('button').last().click();
    await expect(page.getByText("Delete report schedule")).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: /^Delete$/i }).click();
    await expect(page.getByText("Schedule deleted")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByText(`WSR · ${seed.projectName}`),
    ).toHaveCount(0);
    await holdForVideo(page);
  });

  test("TC-M3-5-03: Failed delivery is logged on the schedule and audit trail", async ({
    page,
    request,
  }) => {
    const session = await loginViaSessionInjection(page, SUPER_ADMIN_EMAIL);

    // Seed a schedule that has already failed delivery (avoids waiting on Bull).
    const scheduleId = crypto.randomUUID();
    const pmRoleId = (
      await dbClient.query(`SELECT id FROM roles WHERE code = 'pm' LIMIT 1`)
    ).rows[0].id as number;
    await dbClient.query(
      `INSERT INTO report_schedules
         (id, report_type, cron_expression, project_id, is_active, last_run, last_error, created_by, created_at)
       VALUES ($1, 'WSR', '0 9 * * 1', $2, true, NOW(), $3, $4, NOW())`,
      [
        scheduleId,
        seed.projectId,
        "No approved report to distribute",
        seed.adminId,
      ],
    );
    await dbClient.query(
      `INSERT INTO report_schedule_recipients (id, schedule_id, role_id)
       VALUES ($1, $2, $3)`,
      [crypto.randomUUID(), scheduleId, pmRoleId],
    );
    await dbClient.query(
      `INSERT INTO audit_logs (id, actor_id, action, object_type, object_id, new_value, created_at)
       VALUES ($1, $2, 'REPORT_DELIVERY_FAILED', 'GeneratedReport', NULL, $3::jsonb, NOW())`,
      [
        crypto.randomUUID(),
        seed.adminId,
        JSON.stringify({
          scheduleId,
          attempt: 1,
          error: "No approved report to distribute",
        }),
      ],
    );

    // API surface.
    const list = await request.get(`${API_URL}/reports/schedules`, {
      headers: bearer(session.token),
    });
    expect(list.status()).toBe(200);
    const schedules = (await list.json()) as Array<{
      id: string;
      lastError?: string | null;
    }>;
    const found = schedules.find((item) => item.id === scheduleId);
    expect(found?.lastError).toBe("No approved report to distribute");

    const audit = await dbClient.query(
      `SELECT action, new_value FROM audit_logs
        WHERE action = 'REPORT_DELIVERY_FAILED'
          AND new_value->>'scheduleId' = $1
        ORDER BY created_at DESC LIMIT 1`,
      [scheduleId],
    );
    expect(audit.rows.length).toBe(1);
    expect(audit.rows[0].new_value.attempt).toBe(1);
    expect(String(audit.rows[0].new_value.error)).toMatch(/No approved report/i);

    // UI — schedule card is listed (lastError is API-backed).
    await gotoWithCommit(page, "/en/dashboard/reports/schedules");
    await waitForAppReady(page);
    await expect(
      page.getByText(`WSR · ${seed.projectName}`).first(),
    ).toBeVisible({ timeout: 60000 });
    await holdForVideo(page);
  });
});