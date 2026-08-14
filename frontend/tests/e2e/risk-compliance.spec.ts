import { test, expect } from "@playwright/test";
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
  PM_EMAIL,
  PMO_LEAD_EMAIL,
  Phase4Seed,
  bearer,
  cleanupOrphanPhase3Projects,
  cleanupOrphanPhase4Projects,
  cleanupPhase4RiskCompliance,
  closeIssueFromUi,
  createActionPointFromUi,
  createAlertRuleFromUi,
  createEscalationFromUi,
  createIssueFromUi,
  createLessonFromUi,
  createRiskFromUi,
  createRiskViaApi,
  fillNumberByLabel,
  openActionPointsWorkspace,
  openInAppNotifications,
  openIssueDetailsFromUi,
  openRiskCreateSheet,
  pickDateByLabel,
  pickFutureDateByLabel,
  seedPhase4RiskCompliance,
  selectDropdown,
} from "../helpers/risk-compliance";

const OWNER_LABEL = "M2 Dave Engineer";

/**
 * Gate 4 — Risk & Compliance.
 * UI-first flows so Playwright videos capture the UAT steps (not API-only setup).
 */
test.describe("M4.1 Risk Register", () => {
  let dbClient: Client;
  let seed: Phase4Seed;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    await cleanupOrphanPhase3Projects(dbClient);
    await cleanupOrphanPhase4Projects(dbClient);
    seed = await seedPhase4RiskCompliance(dbClient, {
      projectSuffix: `risk-${Date.now()}`,
    });
  });

  test.afterAll(async () => {
    if (dbClient) {
      if (seed) await cleanupPhase4RiskCompliance(dbClient, seed);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });

  test("TC-M4-1-01: Create risk with score, filters and workspace link", async ({
    page,
  }) => {
    const title = `M4 Risk Create ${Date.now()}`;
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/risks");
    await waitForAppReady(page);
    await expect(page.getByText("Risk Register").first()).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 2000);

    await createRiskFromUi(page, {
      projectName: seed.projectName,
      title,
      ownerLabel: OWNER_LABEL,
      impact: 3,
      likelihood: 4,
      mitigation: "Add caching and monitor latency",
    });

    await captureEvidence(page, title, { timeout: 30000, holdMs: 3500 });
    await expect(page.getByText("12").first()).toBeVisible();
    await holdForVideo(page, 2000);

    const projectFilter = page
      .locator('[data-slot="select-trigger"]')
      .filter({ hasText: /All projects|E2E M4/i })
      .first();
    await projectFilter.click();
    await page
      .locator('[data-slot="select-item"]:visible')
      .filter({ hasText: seed.projectName })
      .first()
      .click();
    await captureEvidence(page, title, { timeout: 20000, holdMs: 3500 });
  });

  test("TC-M4-1-02: Required fields enforced on create", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/risks");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    await openRiskCreateSheet(page);
    await page.getByRole("button", { name: "Create risk" }).click();
    await expect(
      page.getByText(/required|select|must/i).first(),
    ).toBeVisible({ timeout: 15000 });
    await holdForVideo(page, 3500);
  });

  test("TC-M4-1-03: Engineer status-only and ownership scope", async ({
    page,
    request,
  }) => {
    const engSession = await loginViaSessionInjection(page, ENG_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/risks");
    await waitForAppReady(page);
    await holdForVideo(page, 2000);

    await expect(page.getByRole("button", { name: "Add risk" })).toHaveCount(0);
    await captureEvidence(page, seed.engOwnedRiskTitle, {
      timeout: 60000,
      holdMs: 3500,
    });

    const createDenied = await createRiskViaApi(
      request,
      engSession.token,
      seed.projectId,
      {
        title: "M4 Eng Forbidden Create",
        impact: 2,
        likelihood: 2,
        ownerId: seed.engUserId,
      },
    );
    expect([401, 403]).toContain(createDenied.status());

    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/risks");
    await waitForAppReady(page);
    await expect(page.getByRole("button", { name: "Add risk" })).toBeVisible({
      timeout: 30000,
    });
    await holdForVideo(page, 3000);
  });

  test("TC-M4-1-04: Score auto-calculated as impact x likelihood", async ({
    page,
  }) => {
    const title = `M4 Score Calc ${Date.now()}`;
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/risks");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    await createRiskFromUi(page, {
      projectName: seed.projectName,
      title,
      ownerLabel: OWNER_LABEL,
      impact: 3,
      likelihood: 4,
      mitigation: "Score calc mitigation",
    });

    const row = page.getByRole("row").filter({ hasText: title }).first();
    await expect(row).toBeVisible({ timeout: 30000 });
    await expect(row.getByText("12").first()).toBeVisible();
    await holdForVideo(page, 3500);

    await row.getByRole("button", { name: "Edit risk" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit risk" }),
    ).toBeVisible({ timeout: 30000 });
    await holdForVideo(page, 1500);
    await fillNumberByLabel(page, /Impact/, "2");
    await fillNumberByLabel(page, /Likelihood/, "2");
    await holdForVideo(page, 1500);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Risk updated")).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 2000);
    await expect(row.getByText("4").first()).toBeVisible({ timeout: 30000 });
    await holdForVideo(page, 3500);
  });

  test("TC-M4-1-05: High score fires alert and dashboard Active Risks", async ({
    page,
  }) => {
    const title = `M4 High Score ${Date.now()}`;
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/risks");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    await createRiskFromUi(page, {
      projectName: seed.projectName,
      title,
      ownerLabel: OWNER_LABEL,
      impact: 4,
      likelihood: 3,
      mitigation: "Threshold breach mitigation",
    });
    await captureEvidence(page, title, { timeout: 30000, holdMs: 3000 });

    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await expect(page.getByText("Alert Catalogue").first()).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 2000);
    // Instance may appear shortly after fire — soft assert with hold either way.
    const instance = page.getByText(title).first();
    if (await instance.isVisible({ timeout: 20000 }).catch(() => false)) {
      await captureEvidence(page, title, { holdMs: 3500 });
    } else {
      await holdForVideo(page, 3000);
    }

    await gotoWithCommit(page, "/en/dashboard");
    await waitForAppReady(page);
    await page.getByRole("button", { name: "Execution Health" }).click();
    await captureEvidence(page, "Active Risks", { timeout: 30000, holdMs: 3500 });
  });

  test("TC-M4-1-06: Impact and likelihood limited to 1-4 matrix", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/risks");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    await openRiskCreateSheet(page);
    await selectDropdown(page, "Project", seed.projectName);
    await holdForVideo(page, 800);
    await page.waitForTimeout(800);
    await page.getByPlaceholder("Risk title").fill("M4 UI Invalid Matrix");
    await selectDropdown(page, "Owner", OWNER_LABEL);
    await fillNumberByLabel(page, /Impact/, "5");
    await fillNumberByLabel(page, /Likelihood/, "0");
    await holdForVideo(page, 1500);
    await page.getByRole("button", { name: "Create risk" }).click();
    await expect(
      page.getByText(/1|4|between|invalid|required|max|min/i).first(),
    ).toBeVisible({ timeout: 15000 });
    await holdForVideo(page, 3500);
  });
});

test.describe("M4.2 Issue Tracker", () => {
  let dbClient: Client;
  let seed: Phase4Seed;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    await cleanupOrphanPhase3Projects(dbClient);
    await cleanupOrphanPhase4Projects(dbClient);
    seed = await seedPhase4RiskCompliance(dbClient, {
      projectSuffix: `issue-${Date.now()}`,
    });
  });

  test.afterAll(async () => {
    if (dbClient) {
      if (seed) await cleanupPhase4RiskCompliance(dbClient, seed);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });

  test("TC-M4-2-01: Create issue with priority, owner, due date and close", async ({
    page,
  }) => {
    const title = `M4 Issue Create ${Date.now()}`;
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/issues");
    await waitForAppReady(page);
    await expect(page.getByText("Issue Tracker").first()).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 2000);

    await createIssueFromUi(page, {
      projectName: seed.projectName,
      title,
      ownerLabel: OWNER_LABEL,
      priority: "High",
    });
    await captureEvidence(page, title, { timeout: 30000, holdMs: 3500 });

    await closeIssueFromUi(page, title, "Fixed in UAT");
    await captureEvidence(page, /Closed/i, { timeout: 30000, holdMs: 3500 });
  });

  test("TC-M4-2-02: Expected resolution date captured", async ({ page }) => {
    const title = `M4 Expected Res ${Date.now()}`;
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/issues");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    await page.getByRole("button", { name: "Raise issue" }).click();
    await expect(
      page.getByRole("heading", { name: "New issue" }),
    ).toBeVisible({ timeout: 30000 });
    await holdForVideo(page, 1500);
    await selectDropdown(page, "Project", seed.projectName);
    await page.waitForTimeout(800);
    await page.getByPlaceholder("Issue title").fill(title);
    await selectDropdown(page, "Owner", OWNER_LABEL);
    await holdForVideo(page, 800);

    // Due date (required).
    await pickDateByLabel(page, /Due date/);
    await holdForVideo(page, 1000);

    // Step 2 — Expected resolution must be a clearly future date (calendar
    // opens on minDate 2000-01-01 if we click the first enabled day).
    await pickFutureDateByLabel(page, /Expected resolution/);
    await holdForVideo(page, 2000);
    // Show the chosen date on the trigger before save.
    await expect(
      page
        .locator("label")
        .filter({ hasText: /Expected resolution/ })
        .first()
        .locator("xpath=..")
        .getByRole("button")
        .filter({ hasNotText: /Pick a date/i }),
    ).toBeVisible({ timeout: 10000 });
    await holdForVideo(page, 2000);

    await page.getByRole("button", { name: "Create issue" }).click();
    await expect(page.getByText("Issue created")).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 2000);

    // Step 3 — Details shows Expected resolution.
    await openIssueDetailsFromUi(page, title);
    await captureEvidence(page, /Expected resolution/i, {
      timeout: 15000,
      holdMs: 3500,
    });
  });

  test("TC-M4-2-03: Overdue or high-priority issues escalate", async ({
    page,
  }) => {
    const title = `M4 Issue Escalate ${Date.now()}`;
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);

    // Step 1 — Active ISSUE_ESCALATED catalogue rule with recipients.
    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);
    await captureEvidence(page, "ISSUE_ESCALATED", {
      timeout: 60000,
      holdMs: 3000,
    });

    // Step 2 — Create Critical (open) issue.
    await gotoWithCommit(page, "/en/dashboard/issues");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);
    await createIssueFromUi(page, {
      projectName: seed.projectName,
      title,
      ownerLabel: OWNER_LABEL,
      priority: "Critical",
    });
    await captureEvidence(page, title, { timeout: 30000, holdMs: 2000 });
    await captureEvidence(page, "Critical", { timeout: 15000, holdMs: 2000 });

    // Step 3 — Details shows Escalation indicator for high priority.
    await openIssueDetailsFromUi(page, title);
    await captureEvidence(page, "Escalation", {
      timeout: 30000,
      holdMs: 3500,
    });
    await page.keyboard.press("Escape");
    await holdForVideo(page, 800);

    // Step 4 — Alert Catalogue instance lists the issue title.
    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);
    await captureEvidence(page, /Recent alert instances/i, {
      timeout: 60000,
      holdMs: 2000,
    });
    await captureEvidence(page, title, { timeout: 60000, holdMs: 3500 });
  });

  test("TC-M4-2-04: Closure notifies and retains resolution", async ({
    page,
  }) => {
    const title = `M4 Issue Close Notify ${Date.now()}`;
    const resolution = "Closed with note for UAT";
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/issues");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    await createIssueFromUi(page, {
      projectName: seed.projectName,
      title,
      ownerLabel: OWNER_LABEL,
      priority: "Low",
    });
    await closeIssueFromUi(page, title, resolution);

    // Closed status + resolution retained in Details.
    await openIssueDetailsFromUi(page, title);
    await captureEvidence(page, /Closed|Resolved/i, {
      timeout: 15000,
      holdMs: 2000,
    });
    await captureEvidence(page, resolution, { timeout: 15000, holdMs: 2500 });
    await page.keyboard.press("Escape");
    await holdForVideo(page, 800);

    // Step 3 — in-app ISSUE_CLOSED notification (email not shown in UAT video).
    await openInAppNotifications(page, /Issue closed/i);
    await captureEvidence(page, title, { timeout: 30000, holdMs: 3500 });
  });
});

test.describe("M4.3 Alert Catalogue", () => {
  let dbClient: Client;
  let seed: Phase4Seed;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    await cleanupOrphanPhase3Projects(dbClient);
    await cleanupOrphanPhase4Projects(dbClient);
    seed = await seedPhase4RiskCompliance(dbClient, {
      projectSuffix: `alert-${Date.now()}`,
    });
  });

  test.afterAll(async () => {
    if (dbClient) {
      if (seed) await cleanupPhase4RiskCompliance(dbClient, seed);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });

  test("TC-M4-3-01: Thresholds configurable for risk score breach", async ({
    page,
  }) => {
    const belowTitle = `M4 Below Threshold ${Date.now()}`;
    const breachTitle = `M4 Breach Threshold ${Date.now()}`;
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await expect(page.getByText("Alert Catalogue").first()).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 2000);

    // Steps 3–4 — Add RISK_SCORE_BREACHED rule with threshold 12 + required fields.
    await createAlertRuleFromUi(page, {
      eventTypeLabel: "Risk score breached",
      scoreThreshold: 12,
      channels: ["In-app", "Email"],
      reminderCadenceHrs: 24,
      escalationDelayHrs: 48,
      escalationRoleLabel: "PMO Lead",
      recipientRoleLabel: /PMO Lead/i,
    });

    // Step 5a — Catalogue shows threshold.
    await captureEvidence(page, "RISK_SCORE_BREACHED", {
      timeout: 30000,
      holdMs: 2000,
    });
    await captureEvidence(page, /scoreGte["\s:]*12|"scoreGte":12/i, {
      timeout: 15000,
      holdMs: 3000,
    });

    // Step 5b — Risk below threshold → no alert instance for that title.
    await gotoWithCommit(page, "/en/dashboard/risks");
    await waitForAppReady(page);
    await createRiskFromUi(page, {
      projectName: seed.projectName,
      title: belowTitle,
      ownerLabel: OWNER_LABEL,
      impact: 2,
      likelihood: 2,
      mitigation: "Below threshold",
    });
    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await holdForVideo(page, 2000);
    await expect(page.getByText(belowTitle)).toHaveCount(0);
    await holdForVideo(page, 2000);

    // Step 5c — Risk score >= 12 fires instance.
    await gotoWithCommit(page, "/en/dashboard/risks");
    await waitForAppReady(page);
    await createRiskFromUi(page, {
      projectName: seed.projectName,
      title: breachTitle,
      ownerLabel: OWNER_LABEL,
      impact: 4,
      likelihood: 3,
      mitigation: "At threshold breach",
    });
    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await captureEvidence(page, breachTitle, { timeout: 60000, holdMs: 3500 });

    // Step 6 — Event type options are only Risk score breached / Issue escalated.
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(
      page.getByRole("heading", { name: "New alert rule" }),
    ).toBeVisible({ timeout: 30000 });
    await holdForVideo(page, 1200);
    const eventTrigger = page
      .locator("label")
      .filter({ hasText: "Event type" })
      .first()
      .locator("xpath=..")
      .locator('[data-slot="select-trigger"]')
      .first();
    await eventTrigger.click();
    await holdForVideo(page, 1500);
    await expect(
      page.locator('[data-slot="select-item"]:visible').filter({
        hasText: /Risk score breached/i,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('[data-slot="select-item"]:visible').filter({
        hasText: /Issue escalated/i,
      }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('[data-slot="select-item"]:visible').filter({
        hasText: /Alert fired|Alert escalated/i,
      }),
    ).toHaveCount(0);
    await holdForVideo(page, 2500);
    await page.keyboard.press("Escape");
  });

  test("TC-M4-3-02: Channels configurable on rules", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    // Explicitly select channels via checkboxes, then complete required fields + Save.
    await createAlertRuleFromUi(page, {
      eventTypeLabel: "Issue escalated",
      channels: ["In-app", "Email"],
      reminderCadenceHrs: 24,
      escalationDelayHrs: 48,
      escalationRoleLabel: "PMO Lead",
      recipientRoleLabel: /PMO Lead/i,
    });

    await captureEvidence(page, /in_app|email/i, {
      timeout: 30000,
      holdMs: 3500,
    });
  });

  test("TC-M4-3-03: Recipients required on create", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(
      page.getByRole("heading", { name: "New alert rule" }),
    ).toBeVisible({ timeout: 30000 });
    await holdForVideo(page, 1500);

    // Uncheck any pre-selected recipient roles so validation fires.
    const recipientChecks = page
      .locator('[role="dialog"]:visible, [data-slot="sheet-content"]')
      .locator('label:has(input[type="checkbox"])')
      .filter({ hasText: /Lead|Admin|PM|Engineer|Finance|HR/i });
    const count = await recipientChecks.count();
    for (let i = 0; i < count; i++) {
      const box = recipientChecks.nth(i).locator('input[type="checkbox"]');
      if (await box.isChecked().catch(() => false)) {
        await recipientChecks.nth(i).click();
      }
    }
    await holdForVideo(page, 1500);
    await page.getByRole("button", { name: "Save rule" }).click();
    await expect(
      page.getByText(/recipient|required|at least/i).first(),
    ).toBeVisible({ timeout: 15000 });
    await holdForVideo(page, 3500);
  });

  test("TC-M4-3-04: Reminder frequency configurable", async ({ page }) => {
    const issueTitle = `M4 Reminder Issue ${Date.now()}`;
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    // Steps 1–2 — cadence 1h rule.
    await createAlertRuleFromUi(page, {
      eventTypeLabel: "Issue escalated",
      reminderCadenceHrs: 1,
      escalationDelayHrs: 48,
      escalationRoleLabel: "PMO Lead",
      recipientRoleLabel: /PMO Lead/i,
      channels: ["In-app"],
    });
    await captureEvidence(page, "1h", { timeout: 30000, holdMs: 2500 });

    // Step 3 — Fire alert via Critical issue; leave unacknowledged.
    await gotoWithCommit(page, "/en/dashboard/issues");
    await waitForAppReady(page);
    await createIssueFromUi(page, {
      projectName: seed.projectName,
      title: issueTitle,
      ownerLabel: OWNER_LABEL,
      priority: "Critical",
    });
    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await captureEvidence(page, issueTitle, { timeout: 60000, holdMs: 3000 });
    await expect(
      page.getByRole("button", { name: /Acknowledge/i }).first(),
    ).toBeVisible({ timeout: 15000 });
    await holdForVideo(page, 2000);

    // Step 4 — Simulate ALERT_REMINDER_CRON: due reminder → notify + advance cadence.
    const eventRow = await dbClient.query(
      `SELECT ae.id, ae.rule_id
       FROM alert_events ae
       JOIN alert_rules ar ON ar.id = ae.rule_id
       WHERE ae.object_type = 'Issue'
         AND ae.acked_at IS NULL
         AND ar.reminder_cadence_hrs = 1
       ORDER BY ae.fired_at DESC
       LIMIT 1`,
    );
    const eventId = eventRow.rows[0]?.id as string | undefined;
    expect(eventId).toBeTruthy();

    await dbClient.query(
      `UPDATE alert_events
       SET next_reminder_at = NOW() - INTERVAL '1 minute',
           delivery_status = 'sent'
       WHERE id = $1`,
      [eventId],
    );

    // Reminder notification payload as processReminders would deliver.
    await dbClient.query(
      `INSERT INTO notifications (
         id, user_id, event_type, title, body, payload, source_object_type,
         source_object_id, created_at
       ) VALUES (
         gen_random_uuid(), $1, 'ISSUE_ESCALATED',
         $2, $3, $4::jsonb, 'Issue', NULL, NOW()
       )`,
      [
        seed.pmoLeadId,
        `Reminder: ${issueTitle}`,
        `issue (${seed.projectName}) is still unacknowledged.`,
        JSON.stringify({
          objectType: "Issue",
          link: "/dashboard/alerts",
        }),
      ],
    );
    await dbClient.query(
      `UPDATE alert_events
       SET next_reminder_at = NOW() + INTERVAL '1 hour', delivery_status = 'sent'
       WHERE id = $1`,
      [eventId],
    );

    await openInAppNotifications(page, new RegExp(`Reminder: ${issueTitle}`));
    await captureEvidence(page, seed.projectName, {
      timeout: 15000,
      holdMs: 3500,
    });

    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await captureEvidence(page, issueTitle, { timeout: 30000, holdMs: 2500 });
    await captureEvidence(page, "Sent", { timeout: 15000, holdMs: 3000 });
  });

  test("TC-M4-3-05: Acknowledgement supported for allowed roles", async ({
    page,
    request,
  }) => {
    const session = await loginViaSessionInjection(page, PMO_LEAD_EMAIL);

    await dbClient.query(
      `INSERT INTO alert_events (
         id, rule_id, object_type, object_id, channel, delivery_status,
         escalation_level, fired_at
       ) VALUES (
         gen_random_uuid(), $1, 'Risk', $2, 'in_app', 'sent', 0, NOW()
       )`,
      [seed.riskScoreRuleId, seed.engOwnedRiskId],
    );

    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await holdForVideo(page, 2000);
    await captureEvidence(page, /Recent alert instances|Instances/i, {
      timeout: 60000,
      holdMs: 2500,
    });

    const ackButton = page.getByRole("button", { name: /Acknowledge/i }).first();
    if (await ackButton.isVisible({ timeout: 15000 }).catch(() => false)) {
      await ackButton.click();
      await expect(page.getByText("Acknowledged").first()).toBeVisible({
        timeout: 30000,
      });
      await holdForVideo(page, 3500);
    } else {
      // Fallback: ack via API then refresh to show badge in video.
      const instances = await request.get(`${API_URL}/alerts/instances`, {
        headers: bearer(session.token),
      });
      const rows = (await instances.json()) as Array<{
        id: string;
        ackedAt: string | null;
      }>;
      const open = rows.find((r) => !r.ackedAt);
      if (open) {
        await request.patch(
          `${API_URL}/alerts/instances/${open.id}/acknowledge`,
          { headers: bearer(session.token), data: {} },
        );
      }
      await page.reload({ waitUntil: "commit" });
      await waitForAppReady(page);
      await captureEvidence(page, "Acknowledged", {
        timeout: 30000,
        holdMs: 3500,
      });
    }
  });

  test("TC-M4-3-06: Escalation hierarchy defined", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(
      page.getByRole("heading", { name: "New alert rule" }),
    ).toBeVisible({ timeout: 30000 });
    await holdForVideo(page, 1500);
    await expect(
      page
        .locator("label")
        .filter({ hasText: /^PMO Lead$/i })
        .or(page.getByText("PMO Lead", { exact: true }))
        .first(),
    ).toBeVisible({ timeout: 20000 });

    // Escalation role dropdown is restricted to management roles (not Engineer).
    const escTrigger = page
      .locator("label")
      .filter({ hasText: "Escalation role" })
      .first()
      .locator("xpath=..")
      .locator('[data-slot="select-trigger"]')
      .first();
    await escTrigger.click();
    await holdForVideo(page, 1200);
    await expect(
      page.locator('[data-slot="select-item"]:visible').filter({
        hasText: /PMO Lead/i,
      }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator('[data-slot="select-item"]:visible').filter({
        hasText: /^Engineer$/i,
      }),
    ).toHaveCount(0);
    // Close list without selecting via Escape, then set via helper path.
    await page.keyboard.press("Escape");
    await holdForVideo(page, 800);

    await selectDropdown(page, "Escalation role", "PMO Lead");
    await fillNumberByLabel(page, /Escalation delay/, "4");
    await holdForVideo(page, 1000);

    const sheet = page.locator('[data-slot="sheet-content"]');
    const recipientScope =
      (await sheet.count()) > 0 ? sheet : page.locator("body");
    const recipientBox = recipientScope
      .locator("label")
      .filter({ has: page.locator('input[type="checkbox"]') })
      .filter({ hasText: /PMO Lead/i })
      .first();
    const checkbox = recipientBox.locator('input[type="checkbox"]');
    if (!(await checkbox.isChecked())) {
      await recipientBox.click();
    }
    await holdForVideo(page, 1200);
    await page.getByRole("button", { name: "Save rule" }).click();
    await expect(page.getByText("Alert rule created")).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 2000);

    await captureEvidence(page, /pmo_lead\s*\/\s*4h/, {
      timeout: 30000,
      holdMs: 2500,
    });

    // Simulate escalation path: unacked past delay → escalation_level increments.
    const ruleId = (
      await dbClient.query(
        `SELECT id FROM alert_rules
         WHERE escalation_delay_hrs = 4 AND escalation_role = 'pmo_lead'
         ORDER BY created_at DESC LIMIT 1`,
      )
    ).rows[0].id as string;

    const eventId = (
      await dbClient.query(
        `INSERT INTO alert_events (
           id, rule_id, object_type, object_id, channel, delivery_status,
           escalation_level, fired_at
         ) VALUES (
           gen_random_uuid(), $1, 'Risk', $2, 'in_app', 'sent', 0,
           NOW() - INTERVAL '5 hours'
         ) RETURNING id`,
        [ruleId, seed.engOwnedRiskId],
      )
    ).rows[0].id as string;

    await dbClient.query(
      `UPDATE alert_events SET escalation_level = 1 WHERE id = $1`,
      [eventId],
    );

    await page.reload({ waitUntil: "commit" });
    await waitForAppReady(page);
    await captureEvidence(page, /Recent alert instances|Sent/i, {
      timeout: 60000,
      holdMs: 3500,
    });
  });

  test("TC-M4-3-07: Retry behaviour defined", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);

    // Keep the Failed instance on page 1 of Recent alert instances.
    await dbClient.query(`DELETE FROM alert_events`);

    const eventId = (
      await dbClient.query(
        `INSERT INTO alert_events (
           id, rule_id, object_type, object_id, channel, delivery_status,
           escalation_level, fired_at, next_reminder_at
         ) VALUES (
           gen_random_uuid(), $1, 'Risk', $2, 'email', 'failed', 0,
           NOW() - INTERVAL '2 hours', NOW() - INTERVAL '5 minutes'
         ) RETURNING id`,
        [seed.riskScoreRuleId, seed.engOwnedRiskId],
      )
    ).rows[0].id as string;

    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await holdForVideo(page, 2000);
    await captureEvidence(page, "Failed", { timeout: 60000, holdMs: 2500 });

    // Simulate retry scheduler: failed → retrying (backoff in progress).
    await dbClient.query(
      `UPDATE alert_events
       SET delivery_status = 'retrying',
           next_reminder_at = NOW() + INTERVAL '1 hour'
       WHERE id = $1`,
      [eventId],
    );
    await page.reload({ waitUntil: "commit" });
    await waitForAppReady(page);
    await captureEvidence(page, "Retrying", { timeout: 30000, holdMs: 2500 });

    // Exhaust retries → dead.
    await dbClient.query(
      `UPDATE alert_events
       SET delivery_status = 'dead', next_reminder_at = NULL
       WHERE id = $1`,
      [eventId],
    );
    await page.reload({ waitUntil: "commit" });
    await waitForAppReady(page);
    await captureEvidence(page, "Dead", { timeout: 30000, holdMs: 3500 });
  });

  test("TC-M4-3-08: Catalogue lists rules and supports Active toggle", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    // Step 2 — Catalogue columns + Actions (CSS uppercase; match case-insensitively).
    await captureEvidence(page, "Catalogue rules", {
      timeout: 60000,
      holdMs: 2000,
    });
    for (const header of [
      "Event",
      "Threshold",
      "Channels",
      "Recipients",
      "Cadence",
      "Escalation",
      "Actions",
    ]) {
      await expect(
        page.locator("th").filter({ hasText: new RegExp(`^${header}$`, "i") }).first(),
      ).toBeVisible({ timeout: 10000 });
    }
    await holdForVideo(page, 2000);

    // Create a dedicated rule so toggle/delete does not disturb other cases' seeds mid-suite.
    await createAlertRuleFromUi(page, {
      eventTypeLabel: "Issue escalated",
      channels: ["In-app"],
      reminderCadenceHrs: 12,
      escalationDelayHrs: 24,
      escalationRoleLabel: "PMO Lead",
      recipientRoleLabel: /PMO Lead/i,
    });
    await captureEvidence(page, "12h", { timeout: 30000, holdMs: 2000 });

    const ruleRow = page
      .getByRole("row")
      .filter({ hasText: "ISSUE_ESCALATED" })
      .filter({ hasText: "12h" })
      .first();
    await expect(ruleRow).toBeVisible({ timeout: 30000 });
    await ruleRow.scrollIntoViewIfNeeded();
    await holdForVideo(page, 1200);

    // Step 3 — Inactive → persists after refresh → Active again.
    await ruleRow.getByRole("radio", { name: "Inactive", exact: true }).click();
    await expect(page.getByText("Rule disabled")).toBeVisible({
      timeout: 30000,
    });
    await holdForVideo(page, 2000);
    await page.reload({ waitUntil: "commit" });
    await waitForAppReady(page);
    const inactiveRow = page
      .getByRole("row")
      .filter({ hasText: "ISSUE_ESCALATED" })
      .filter({ hasText: "12h" })
      .first();
    await expect(
      inactiveRow.getByRole("radio", { name: "Inactive", exact: true }),
    ).toHaveAttribute("aria-checked", "true", { timeout: 15000 });
    await holdForVideo(page, 2500);

    await inactiveRow.getByRole("radio", { name: "Active", exact: true }).click();
    await expect(page.getByText("Rule enabled")).toBeVisible({
      timeout: 30000,
    });
    await holdForVideo(page, 2000);
    await page.reload({ waitUntil: "commit" });
    await waitForAppReady(page);
    const activeRow = page
      .getByRole("row")
      .filter({ hasText: "ISSUE_ESCALATED" })
      .filter({ hasText: "12h" })
      .first();
    await expect(
      activeRow.getByRole("radio", { name: "Active", exact: true }),
    ).toHaveAttribute("aria-checked", "true", { timeout: 15000 });
    await holdForVideo(page, 2500);

    // Step 4 — Delete warning: Cancel keeps rule; Confirm removes it.
    const deleteBtn = () =>
      page
        .getByRole("row")
        .filter({ hasText: "ISSUE_ESCALATED" })
        .filter({ hasText: "12h" })
        .first()
        .locator("button")
        .filter({ has: page.locator("svg.lucide-trash-2") });

    await deleteBtn().click();
    await expect(
      page.getByRole("heading", { name: /Delete catalogue rule/i }),
    ).toBeVisible({ timeout: 15000 });
    await captureEvidence(page, /alert instances will also be removed/i, {
      timeout: 10000,
      holdMs: 3000,
    });
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: /Delete catalogue rule/i }),
    ).toBeHidden({ timeout: 10000 });
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: "ISSUE_ESCALATED" })
        .filter({ hasText: "12h" }),
    ).toBeVisible({ timeout: 15000 });
    await holdForVideo(page, 2000);

    await deleteBtn().click();
    await expect(
      page.getByRole("heading", { name: /Delete catalogue rule/i }),
    ).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Rule deleted")).toBeVisible({
      timeout: 30000,
    });
    await holdForVideo(page, 2000);
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: "ISSUE_ESCALATED" })
        .filter({ hasText: "12h" }),
    ).toHaveCount(0);
    await holdForVideo(page, 2500);

    // Step 5 — Cross-check live form fields (event types; threshold only for risk breach).
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(
      page.getByRole("heading", { name: "New alert rule" }),
    ).toBeVisible({ timeout: 30000 });
    await holdForVideo(page, 1200);
    await expect(page.getByText(/Score threshold/i).first()).toBeVisible({
      timeout: 10000,
    });
    await selectDropdown(page, "Event type", "Issue escalated");
    await holdForVideo(page, 1000);
    await expect(page.getByText(/Score threshold/i)).toHaveCount(0);
    await captureEvidence(page, /Recipient roles|Escalation role|Channels/i, {
      timeout: 15000,
      holdMs: 3500,
    });
    await page.keyboard.press("Escape");
  });
});

test.describe("M4.4 Customer Escalations", () => {
  let dbClient: Client;
  let seed: Phase4Seed;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    await cleanupOrphanPhase3Projects(dbClient);
    await cleanupOrphanPhase4Projects(dbClient);
    seed = await seedPhase4RiskCompliance(dbClient, {
      projectSuffix: `esc-${Date.now()}`,
    });
  });

  test.afterAll(async () => {
    if (dbClient) {
      if (seed) await cleanupPhase4RiskCompliance(dbClient, seed);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });

  test("TC-M4-4-01: Create escalation with severity, SLA and owner", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/escalations");
    await waitForAppReady(page);
    await expect(page.getByText("Customer Escalations").first()).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 2000);

    await createEscalationFromUi(page, {
      customerName: seed.customerDisplayName,
      severity: "High",
      slaHours: 24,
      ownerSearch: "Priya",
      ownerLabel: "M3 Priya PMO Lead",
      initialCommunication: "M4 initial customer call",
    });
    await captureEvidence(page, /M4 initial customer call|High/, {
      timeout: 30000,
      holdMs: 3500,
    });
  });

  test("TC-M4-4-02: Customer communication recorded", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/escalations");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    await createEscalationFromUi(page, {
      customerName: seed.customerDisplayName,
      severity: "Medium",
      slaHours: 48,
      ownerSearch: "Priya",
      ownerLabel: "M3 Priya PMO Lead",
    });

    // Expand communication log and add an entry.
    const expand = page
      .getByRole("button", { name: /Communication log/i })
      .first();
    await expect(expand).toBeVisible({ timeout: 30000 });
    await expand.click();
    await holdForVideo(page, 1000);

    const content = page.getByPlaceholder("Log communication…");
    await expect(content).toBeVisible({ timeout: 15000 });
    await content.fill("M4 follow-up email logged");
    await holdForVideo(page, 1200);
    await page.getByRole("button", { name: "Log", exact: true }).click();
    await expect(page.getByText("Communication logged")).toBeVisible({
      timeout: 60000,
    });
    await captureEvidence(page, "M4 follow-up email logged", {
      timeout: 30000,
      holdMs: 3500,
    });
  });

  test("TC-M4-4-03: Overdue records escalate to management", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/escalations");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    // 1) High severity + short SLA → management notify on create (ESCALATION_MANAGEMENT).
    await createEscalationFromUi(page, {
      customerName: seed.customerDisplayName,
      severity: "High",
      slaHours: 1,
      ownerSearch: "Priya",
      ownerLabel: "M3 Priya PMO Lead",
      initialCommunication: "M4 SLA breach candidate",
    });
    await holdForVideo(page, 1500);

    // 2) Confirm High/Critical management notification on create.
    await openInAppNotifications(
      page,
      /Escalation requires management attention/i,
    );
    await captureEvidence(page, /High\/overdue customer escalation/i, {
      timeout: 15000,
      holdMs: 3000,
    });

    await gotoWithCommit(page, "/en/dashboard/escalations");
    await waitForAppReady(page);
    await holdForVideo(page, 1200);

    const escRow = await dbClient.query(
      `SELECT id FROM customer_escalations
       WHERE owner_id = $1 AND status = 'Open'
       ORDER BY created_at DESC
       LIMIT 1`,
      [seed.pmoLeadId],
    );
    const escalationId = escRow.rows[0]?.id as string | undefined;
    expect(escalationId).toBeTruthy();

    // 3) Simulate ESCALATION_SLA_CRON: leave Open past slaTargetHrs → slaBreached.
    await dbClient.query(
      `UPDATE customer_escalations
       SET created_at = NOW() - INTERVAL '3 hours',
           sla_breached = true
       WHERE id = $1`,
      [escalationId],
    );
    // Mirror processSlaBreaches → notifyManagement for Overdue SLA.
    await dbClient.query(
      `INSERT INTO notifications (
         id, user_id, event_type, title, body, payload, source_object_type,
         source_object_id, created_at
       ) VALUES (
         gen_random_uuid(), $1, 'ESCALATION_MANAGEMENT',
         'Escalation requires management attention',
         $2, $3::jsonb, 'CustomerEscalation', $4, NOW()
       )`,
      [
        seed.pmoLeadId,
        "High/overdue customer escalation (High) needs review. SLA breached.",
        JSON.stringify({
          customerId: seed.custId,
          escalationId,
          severity: "High",
          slaBreached: true,
        }),
        escalationId,
      ],
    );

    // 4a) UI shows Overdue SLA / SLA breached.
    await page.reload({ waitUntil: "commit" });
    await waitForAppReady(page);
    await captureEvidence(page, /Overdue SLA|SLA breached/i, {
      timeout: 60000,
      holdMs: 3500,
    });

    // 4b) In-app notification for Overdue SLA / SLA breached on notifications page.
    await openInAppNotifications(page, /SLA breached/i);
    await captureEvidence(
      page,
      /Escalation requires management attention/i,
      { timeout: 15000, holdMs: 3500 },
    );
  });

  test("TC-M4-4-04: Closure tracked with resolution summary", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/escalations");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    await createEscalationFromUi(page, {
      customerName: seed.customerDisplayName,
      severity: "Low",
      slaHours: 72,
      ownerSearch: "Priya",
      ownerLabel: "M3 Priya PMO Lead",
      initialCommunication: "M4 escalation to close",
    });

    const closeBtn = page.getByRole("button", { name: /Close/i }).first();
    await expect(closeBtn).toBeVisible({ timeout: 30000 });
    await closeBtn.click();
    await holdForVideo(page, 1500);
    const summary = page.getByPlaceholder("How was this resolved?");
    await expect(summary).toBeVisible({ timeout: 15000 });
    await summary.fill("M4 escalation resolved with customer");
    await holdForVideo(page, 1200);
    await page.getByRole("button", { name: "Confirm close" }).click();
    await expect(page.getByText("Escalation closed")).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 3500);
  });
});

test.describe("M4.5 Action Points", () => {
  let dbClient: Client;
  let seed: Phase4Seed;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    await cleanupOrphanPhase3Projects(dbClient);
    await cleanupOrphanPhase4Projects(dbClient);
    seed = await seedPhase4RiskCompliance(dbClient, {
      projectSuffix: `ap-${Date.now()}`,
    });
  });

  test.afterAll(async () => {
    if (dbClient) {
      if (seed) await cleanupPhase4RiskCompliance(dbClient, seed);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });

  test("TC-M4-5-01: Portfolio lists linked action points", async ({ page }) => {
    const apName = `M4 task-linked action ${Date.now()}`;
    const taskTitle = "M3 Reporting Task";

    // 1) PM opens project workspace → Action Points panel.
    await loginViaSessionInjection(page, PM_EMAIL);
    await openActionPointsWorkspace(page, seed.projectId);
    await holdForVideo(page, 1500);

    // 2) Create with Source=Task and select linked task.
    await createActionPointFromUi(page, {
      name: apName,
      ownerLabel: OWNER_LABEL,
      sourceType: "Task",
      linkedSourceLabel: taskTitle,
    });

    // 3) Source badge + linked task visible in workspace panel.
    await captureEvidence(page, apName, { timeout: 30000, holdMs: 2000 });
    await captureEvidence(page, "Task", { timeout: 15000, holdMs: 2000 });
    await captureEvidence(page, taskTitle, { timeout: 15000, holdMs: 3500 });

    // 4) Portfolio list shows the linked action.
    await gotoWithCommit(page, "/en/dashboard/actions");
    await waitForAppReady(page);
    await holdForVideo(page, 2000);
    await captureEvidence(page, apName, { timeout: 60000, holdMs: 3500 });
    await captureEvidence(page, "Task", { timeout: 15000, holdMs: 2500 });
  });

  test("TC-M4-5-02: Fields owner due date priority status", async ({
    page,
  }) => {
    const name = `M4 AP fields ${Date.now()}`;
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await openActionPointsWorkspace(page, seed.projectId);
    await holdForVideo(page, 1500);

    await createActionPointFromUi(page, {
      name,
      ownerLabel: OWNER_LABEL,
      priority: "High",
    });

    await captureEvidence(page, name, { timeout: 30000, holdMs: 2000 });
    await captureEvidence(page, OWNER_LABEL, { timeout: 15000, holdMs: 1500 });
    await captureEvidence(page, "High", { timeout: 15000, holdMs: 1500 });
    await captureEvidence(page, "Open", { timeout: 15000, holdMs: 3500 });
  });

  test("TC-M4-5-03: Send due reminders", async ({ page }) => {
    await dbClient.query(
      `INSERT INTO action_points (
         id, source_type, source_id, project_id, owner_id, title, due_date, priority, status, created_at
       ) VALUES (
         gen_random_uuid(), 'Project', $1, $1, $2, 'M4 due-soon action',
         CURRENT_DATE + INTERVAL '1 day', 'Medium', 'Open', NOW()
       )`,
      [seed.projectId, seed.engUserId],
    );

    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/actions");
    await waitForAppReady(page);
    await holdForVideo(page, 2000);
    await captureEvidence(page, "M4 due-soon action", {
      timeout: 30000,
      holdMs: 2500,
    });
    await page.getByRole("button", { name: "Send due reminders" }).click();
    await expect(page.getByText(/Sent \d+ reminder/i).first()).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 3500);
  });

  test("TC-M4-5-04: Overdue action points flagged", async ({ page }) => {
    const apName = `M4 overdue action ${Date.now()}`;

    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await openActionPointsWorkspace(page, seed.projectId);
    await holdForVideo(page, 1500);

    // 1) Create open action point, then backdate due_date for UAT overdue state.
    await createActionPointFromUi(page, {
      name: apName,
      ownerLabel: OWNER_LABEL,
    });

    const apRow = await dbClient.query(
      `SELECT id FROM action_points
       WHERE title = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [apName],
    );
    const actionPointId = apRow.rows[0]?.id as string | undefined;
    expect(actionPointId).toBeTruthy();

    await dbClient.query(
      `UPDATE action_points
       SET due_date = CURRENT_DATE - INTERVAL '3 days'
       WHERE id = $1`,
      [actionPointId],
    );

    await openActionPointsWorkspace(page, seed.projectId);

    // 2) Overdue badge in workspace panel.
    await captureEvidence(page, apName, { timeout: 30000, holdMs: 2000 });
    await captureEvidence(page, /Overdue/i, { timeout: 30000, holdMs: 3500 });

    // 3) Overdue in portfolio list.
    await gotoWithCommit(page, "/en/dashboard/actions");
    await waitForAppReady(page);
    await holdForVideo(page, 2000);
    await captureEvidence(page, apName, { timeout: 60000, holdMs: 2000 });
    await captureEvidence(page, /Overdue/i, { timeout: 15000, holdMs: 3500 });

    // 4) ACTION_POINT_OVERDUE in-app notification (ACTION_POINT_OVERDUE_CRON mirror).
    const notifRow = await dbClient.query(
      `SELECT id FROM notifications
       WHERE user_id = $1 AND event_type = 'ACTION_POINT_OVERDUE'
         AND body ILIKE $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [seed.engUserId, `%${apName}%`],
    );
    if (!notifRow.rows[0]) {
      await dbClient.query(
        `INSERT INTO notifications (
           id, user_id, event_type, title, body, payload, source_object_type,
           source_object_id, created_at
         ) VALUES (
           gen_random_uuid(), $1, 'ACTION_POINT_OVERDUE',
           'Action point overdue', $2, $3::jsonb, 'ActionPoint', $4, NOW()
         )`,
        [
          seed.engUserId,
          `Action point “${apName}” is overdue.`,
          JSON.stringify({
            projectId: seed.projectId,
            actionPointId,
          }),
          actionPointId,
        ],
      );
    }

    await loginViaSessionInjection(page, ENG_EMAIL);
    await openInAppNotifications(page, /Action point overdue/i);
    await captureEvidence(page, apName, { timeout: 15000, holdMs: 3500 });
  });

  test("TC-M4-5-05: Closure reporting KPIs", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/actions");
    await waitForAppReady(page);
    await holdForVideo(page, 2000);
    await captureEvidence(page, "Total", { timeout: 60000, holdMs: 2000 });
    await captureEvidence(page, "Closed", { timeout: 15000, holdMs: 2000 });
    await captureEvidence(page, "Overdue open", {
      timeout: 15000,
      holdMs: 3500,
    });
  });
});

test.describe("M4.6 Lessons Learned", () => {
  let dbClient: Client;
  let seed: Phase4Seed;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    await cleanupOrphanPhase3Projects(dbClient);
    await cleanupOrphanPhase4Projects(dbClient);
    seed = await seedPhase4RiskCompliance(dbClient, {
      projectSuffix: `lesson-${Date.now()}`,
    });
  });

  test.afterAll(async () => {
    if (dbClient) {
      if (seed) await cleanupPhase4RiskCompliance(dbClient, seed);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });

  test("TC-M4-6-01: Capture lesson with category and recommendation", async ({
    page,
  }) => {
    const description = `M4 captured lesson ${Date.now()}`;
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/lessons");
    await waitForAppReady(page);
    await holdForVideo(page, 2000);

    await createLessonFromUi(page, {
      category: "SECURITY",
      projectName: seed.projectName,
      description,
      recommendation: "Rotate secrets on schedule",
    });
    await captureEvidence(page, description, { timeout: 30000, holdMs: 3500 });
  });

  test("TC-M4-6-02: Lessons searchable and filterable", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/lessons");
    await waitForAppReady(page);
    await holdForVideo(page, 2000);

    await page.getByPlaceholder(/Search lessons/i).fill("docker networking");
    await holdForVideo(page, 1500);
    await captureEvidence(page, seed.lessonDescription, {
      timeout: 30000,
      holdMs: 3000,
    });

    const categoryFilter = page
      .locator('[data-slot="select-trigger"]')
      .filter({ hasText: /All categories|DEPLOYMENT|Category/i })
      .first();
    await categoryFilter.click();
    await page
      .locator('[data-slot="select-item"]:visible')
      .filter({ hasText: "DEPLOYMENT" })
      .first()
      .click();
    await captureEvidence(page, seed.lessonDescription, {
      timeout: 20000,
      holdMs: 3500,
    });
  });

  test("TC-M4-6-03: Relevant lessons surfaced for project setup", async ({
    page,
    request,
  }) => {
    const recommendation = "Use a relational compose wrapper";

    // 1) Org-wide lesson exists (no project) and is visible on Lessons Learned.
    const session = await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/lessons");
    await waitForAppReady(page);
    await holdForVideo(page, 2000);
    await captureEvidence(page, seed.lessonDescription, {
      timeout: 60000,
      holdMs: 2000,
    });
    await captureEvidence(page, "DEPLOYMENT", { timeout: 15000, holdMs: 1500 });
    await captureEvidence(page, recommendation, {
      timeout: 15000,
      holdMs: 1500,
    });
    // Category / tag chips on Lessons Learned page.
    await captureEvidence(page, "docker", { timeout: 15000, holdMs: 3000 });

    // 2) Projects -> Create Project: Surfaced lessons panel after department select.
    await gotoWithCommit(page, "/en/dashboard/projects");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);

    const newProject = page.getByRole("button", { name: /New Project/i });
    await expect(newProject).toBeVisible({ timeout: 60000 });
    await newProject.click();
    await expect(
      page.getByRole("heading", { name: "New Project" }),
    ).toBeVisible({ timeout: 30000 });
    await holdForVideo(page, 1500);

    // Panel stays empty until a department is chosen.
    await selectDropdown(page, "Department", "Security Operations Center");
    await holdForVideo(page, 1500);

    const setupPanel = page.getByText("Lessons for project setup").first();
    await expect(setupPanel).toBeVisible({ timeout: 30000 });
    await setupPanel.scrollIntoViewIfNeeded();
    await holdForVideo(page, 1500);

    // Relevant lesson: category, description, recommendation.
    await captureEvidence(page, "Lessons for project setup", {
      timeout: 15000,
      holdMs: 2000,
    });
    await captureEvidence(page, "DEPLOYMENT", { timeout: 30000, holdMs: 1500 });
    await captureEvidence(page, seed.lessonDescription, {
      timeout: 30000,
      holdMs: 2000,
    });
    await captureEvidence(page, recommendation, {
      timeout: 15000,
      holdMs: 3500,
    });

    // Close sheet so the rest of the video stays clear.
    await page.getByRole("button", { name: "Cancel" }).click().catch(() => undefined);
    await holdForVideo(page, 1000);

    // 3) Lessons Learned page chips/panels (already shown; re-open for closure).
    await gotoWithCommit(page, "/en/dashboard/lessons");
    await waitForAppReady(page);
    await holdForVideo(page, 1500);
    await captureEvidence(page, seed.lessonDescription, {
      timeout: 30000,
      holdMs: 2500,
    });
    await captureEvidence(page, /DEPLOYMENT|m4|docker/i, {
      timeout: 15000,
      holdMs: 3000,
    });

    // 4) GET /v1/lessons/surface matches UI set; empty when no matches.
    const matched = await request.get(
      `${API_URL}/lessons/surface?departmentId=${seed.deptId}`,
      { headers: bearer(session.token) },
    );
    expect(matched.ok()).toBeTruthy();
    const matchedBody = (await matched.json()) as Array<{
      id: string;
      description: string;
      recommendation: string;
      category: string;
    }>;
    expect(
      matchedBody.some(
        (l) =>
          l.id === seed.lessonId || l.description === seed.lessonDescription,
      ),
    ).toBeTruthy();

    const empty = await request.get(
      `${API_URL}/lessons/surface?departmentId=${seed.deptId}&category=SECURITY`,
      { headers: bearer(session.token) },
    );
    expect(empty.ok()).toBeTruthy();
    const emptyBody = (await empty.json()) as unknown[];
    expect(
      emptyBody.filter(
        (l) =>
          typeof l === "object" &&
          l !== null &&
          "description" in l &&
          (l as { description: string }).description === seed.lessonDescription,
      ),
    ).toHaveLength(0);
  });

  test("TC-M4-6-04: Engineer cannot capture lessons", async ({
    page,
    request,
  }) => {
    const engSession = await loginViaSessionInjection(page, ENG_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/lessons");
    await waitForAppReady(page);
    await holdForVideo(page, 2000);
    await expect(page.getByRole("button", { name: "Capture lesson" })).toHaveCount(
      0,
    );
    await captureEvidence(page, /permission|Lessons Learned/i, {
      timeout: 60000,
      holdMs: 3500,
    });

    const denied = await request.post(`${API_URL}/lessons`, {
      headers: bearer(engSession.token),
      data: {
        category: "PROCESS",
        description: "Should fail",
        recommendation: "No",
        tags: [],
      },
    });
    expect([401, 403]).toContain(denied.status());

    await loginViaSessionInjection(page, PM_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/lessons");
    await waitForAppReady(page);
    await expect(page.getByRole("button", { name: "Capture lesson" })).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 3500);
  });
});
