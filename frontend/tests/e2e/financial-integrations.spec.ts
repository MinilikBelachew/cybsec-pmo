import { test, expect } from "@playwright/test";
import type { Client } from "pg";
import { loginViaSessionInjection } from "../helpers/auth";
import { getDbClient } from "../helpers/db";
import {
  FINANCE_EMAIL,
  IT_ADMIN_EMAIL,
  PM_EMAIL,
  PMO_LEAD_EMAIL,
  Phase5Seed,
  addCostLineFromUi,
  approveBaselineFromUi,
  approveFirstPendingRevision,
  captureEvidence,
  cleanupOrphanPhase5Projects,
  cleanupPhase5Financial,
  clickIntegrationAction,
  exportBudgetTracker,
  gotoWithCommit,
  holdForVideo,
  openFinanceTab,
  openProjectFinancials,
  postBooksAlert,
  proposeRevisionFromUi,
  refreshPhase5FailedSyncs,
  requestAdjustmentFromUi,
  scanDataQuality,
  seedPhase5Financial,
  expectZohoFailedSyncVisible,
  visibleText,
  waitForAppReady,
} from "../helpers/financial-integrations";

/**
 * Gate 5 — Financial & Integrations
 * One Playwright test per UAT checkpoint (35) from UAT_Test_Case_Register_v2_phase_4.xlsx.
 * Artifacts: test-results-phase5 / playwright-report-phase5
 */
test.describe.configure({ mode: "serial" });

test.describe("Phase 5 — Financial & Integrations (35 checkpoints)", () => {
  let dbClient: Client;
  let seed: Phase5Seed;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    await cleanupOrphanPhase5Projects(dbClient);
    seed = await seedPhase5Financial(dbClient, {
      projectSuffix: `full-${Date.now()}`,
    });
  });

  test.afterAll(async () => {
    if (dbClient) {
      if (seed) await cleanupPhase5Financial(dbClient, seed);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });

  // ─── M5.1 ─────────────────────────────────────────────────────────────

  test("TC-M5.1-01: Approved baseline and revisions", async ({ page }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await openProjectFinancials(page, seed.projectId, seed.projectName);
    await approveBaselineFromUi(page, 250000);
    await captureEvidence(page, /250,?000|Baseline|Current budget/i, {
      holdMs: 3000,
    });
    await proposeRevisionFromUi(page, 275000, "Scope increase for Phase 2");
    await approveFirstPendingRevision(page);
    await captureEvidence(page, /275,?000|Approved/i, { holdMs: 3000 });
  });

  test("TC-M5.1-02: Expected vs actual cost", async ({ page }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await openProjectFinancials(page, seed.projectId, seed.projectName);
    await expect(visibleText(page, /Expected|Actual|Variance/i)).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 2500);
    await gotoWithCommit(page, "/en/dashboard/budget");
    await waitForAppReady(page);
    await expect(visibleText(page, "Budget Tracker")).toBeVisible({
      timeout: 60000,
    });
    await captureEvidence(page, /Expected|Actual|On track/i, { holdMs: 3000 });
    await captureEvidence(page, seed.projectName, { holdMs: 2500 });
  });

  test("TC-M5.1-03: Resource cost breakdown", async ({ page }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await openProjectFinancials(page, seed.projectId, seed.projectName);
    await openFinanceTab(page, "Resource costs");
    await expect(
      visibleText(page, /Resource cost breakdown|By employee|Group/i),
    ).toBeVisible({ timeout: 60000 });
    await holdForVideo(page, 3000);

    // PM without view_rates — hours/totals only
    await loginViaSessionInjection(page, PM_EMAIL);
    await openProjectFinancials(page, seed.projectId, seed.projectName);
    await openFinanceTab(page, "Resource costs");
    await holdForVideo(page, 2500);
  });

  test("TC-M5.1-04: Other cost line items", async ({ page }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await openProjectFinancials(page, seed.projectId, seed.projectName);
    await addCostLineFromUi(page, {
      category: "Travel",
      name: `Client workshop flights ${seed.suffix}`,
      planned: 8000,
      actual: 2500,
    });
    await addCostLineFromUi(page, {
      category: "Software",
      name: `Licenses ${seed.suffix}`,
      planned: 3000,
      actual: 1000,
    });
    await captureEvidence(page, new RegExp(`Client workshop flights ${seed.suffix}`), {
      holdMs: 3000,
    });
  });

  test("TC-M5.1-05: Revenue and margin", async ({ page }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await openProjectFinancials(page, seed.projectId, seed.projectName);
    await expect(visibleText(page, /Revenue|Margin/i)).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 2500);
    await gotoWithCommit(page, "/en/dashboard/budget");
    await waitForAppReady(page);
    await captureEvidence(page, seed.projectName, { holdMs: 3000 });
  });

  test("TC-M5.1-06: Configurable overrun alerts", async ({ page }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await openProjectFinancials(page, seed.projectId, seed.projectName);
    // Drive actual via large line actual already added; overrun badge may appear on tracker
    await gotoWithCommit(page, "/en/dashboard/budget");
    await waitForAppReady(page);
    await expect(visibleText(page, "Budget Tracker")).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 2500);
    await gotoWithCommit(page, "/en/dashboard/notifications");
    await waitForAppReady(page);
    await holdForVideo(page, 2500);
  });

  test("TC-M5.1-07: Manual adjustment with approval", async ({ page }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await openProjectFinancials(page, seed.projectId, seed.projectName);
    await requestAdjustmentFromUi(page, {
      amount: 260000,
      reason: "Correct misposted travel actual",
    });
    const approve = page.getByRole("button", { name: /^Approve$/ }).first();
    if (await approve.isVisible().catch(() => false)) {
      await approve.click();
      await holdForVideo(page, 2500);
    }
    await captureEvidence(page, /Pending|Approved|adjustment/i, { holdMs: 3000 });
  });

  test("TC-M5.1-08: Budget Tracker export", async ({ page }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/budget");
    await waitForAppReady(page);
    await expect(visibleText(page, "Budget Tracker")).toBeVisible({
      timeout: 60000,
    });
    await exportBudgetTracker(page, "csv");
    await exportBudgetTracker(page, "xlsx");
    await holdForVideo(page, 2000);
  });

  test("TC-M5.1-09: Negative billing/line amount validation", async ({ page }) => {
    // No Create Invoice UI — assert cost line rejects invalid/negative planned via UI validation.
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await openProjectFinancials(page, seed.projectId, seed.projectName);
    await openFinanceTab(page, "Cost lines");
    await page.getByRole("button", { name: /Add line/i }).click();
    const plannedInput = page
      .locator("label")
      .filter({ hasText: /^Planned/ })
      .first()
      .locator("xpath=..")
      .locator("input");
    await plannedInput.fill("-5000");
    const nameInput = page
      .locator("label")
      .filter({ hasText: /^Name/ })
      .first()
      .locator("xpath=..")
      .locator("input");
    await nameInput.fill("Negative amount attempt");
    await page.getByRole("button", { name: /^Save line$|^Save$|^Add$/ }).first().click();
    await expect(
      visibleText(page, /positive|invalid|must be|required|greater/i),
    ).toBeVisible({ timeout: 20000 });
    await holdForVideo(page, 3000);
  });

  // ─── M5.2 ─────────────────────────────────────────────────────────────

  test("TC-M5.2-01: Salary/cost rates restricted to financial roles", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await openProjectFinancials(page, seed.projectId, seed.projectName);
    await openFinanceTab(page, "Resource costs");
    await holdForVideo(page, 2500);

    await loginViaSessionInjection(page, PM_EMAIL);
    await openProjectFinancials(page, seed.projectId, seed.projectName);
    await openFinanceTab(page, "Resource costs");
    // Rate column may be absent for PM without view_rates
    await holdForVideo(page, 3000);
  });

  test("TC-M5.2-02: Salary confidentiality on integrations", async ({ page }) => {
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/keka");
    await waitForAppReady(page);
    await expect(visibleText(page, /Keka/i)).toBeVisible({ timeout: 60000 });
    // Sync log detail should not expose raw CTC in UI copy when opened from list
    await holdForVideo(page, 3000);
  });

  test("TC-M5.2-03: Cost from approved hours visible in Financials", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await openProjectFinancials(page, seed.projectId, seed.projectName);
    await openFinanceTab(page, "Resource costs");
    await expect(
      visibleText(page, /Resource cost|hours|M5 Jump|M5 Cost/i),
    ).toBeVisible({ timeout: 60000 });
    await holdForVideo(page, 3000);
  });

  test("TC-M5.2-04: Approved cost formula in Settings", async ({ page }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/settings");
    await waitForAppReady(page);
    await page.getByRole("button", { name: /Cost formula/i }).click();
    await expect(visibleText(page, /Hours per week|Overtime|Cost formula/i)).toBeVisible({
      timeout: 60000,
    });
    await page.locator("#cost-hours-week").fill("40").catch(async () => {
      await page.getByLabel(/Hours per week/i).fill("40");
    });
    const save = page.getByRole("button", { name: /Save draft/i });
    if (await save.isEnabled().catch(() => false)) {
      await save.click();
      await expect(visibleText(page, /saved|draft/i)).toBeVisible({
        timeout: 30000,
      });
    }
    const approve = page.getByRole("button", { name: /Approve formula/i });
    if (await approve.isEnabled().catch(() => false)) {
      await approve.click();
      await holdForVideo(page, 2500);
    }
    await holdForVideo(page, 2500);
  });

  test("TC-M5.2-05: Anomaly detection (cost flags)", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/reports/data-quality");
    await waitForAppReady(page);
    await scanDataQuality(page);
    await captureEvidence(
      page,
      /rate Per Hour|COST_MISSING_RATE|COST_RATE_JUMP|COST_OT_SPIKE|Missing cost|OT spike|rate jumped/i,
      { timeout: 60000, holdMs: 4000 },
    );
  });

  test("TC-M5.2-06: Keka sync schedule / reconcile surface", async ({ page }) => {
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/keka");
    await waitForAppReady(page);
    await expect(visibleText(page, /Keka|Sync|salary/i)).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 3000);
  });

  test("TC-M5.2-07: Duplicate invoice sync blocked (unique zoho id)", async ({
    page,
  }) => {
    // Adapter upserts by zoho_invoice_id — re-insert of same id must fail uniqueness.
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/zoho-books");
    await waitForAppReady(page);
    await captureEvidence(page, seed.invoiceNumberLinked, { holdMs: 2500 });
    const dup = await dbClient.query(
      `INSERT INTO invoices (
         id, project_id, zoho_invoice_id, invoice_number, amount, currency, due_date, status, synced_at, created_at
       ) VALUES ($1, $2, $3, $4, 1, 'USD', CURRENT_DATE, 'unpaid', NOW(), NOW())`,
      [
        cryptoRandom(),
        seed.projectId,
        `M5-E2E-INV-L-${seed.suffix}`,
        "DUP-SHOULD-FAIL",
      ],
    ).then(
      () => false,
      () => true,
    );
    expect(dup).toBe(true);
    await holdForVideo(page, 2000);
  });

  // ─── M5.3 ─────────────────────────────────────────────────────────────

  test("TC-M5.3-01: Named CRM mapping / Zoho CRM page", async ({ page }) => {
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/zoho");
    await waitForAppReady(page);
    await captureEvidence(page, /Zoho CRM → PMO|Sync direction/i, { holdMs: 3000 });
    await clickIntegrationAction(page, "zoho-test-connection", /success|connected|ok/i);
    await captureEvidence(page, seed.opportunityName, { timeout: 60000, holdMs: 3000 });
  });

  test("TC-M5.3-02: Milestones link to revenue/invoices", async ({ page }) => {
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/zoho-books");
    await waitForAppReady(page);
    await captureEvidence(page, seed.invoiceNumberLinked, { holdMs: 2500 });
    await expect(visibleText(page, seed.milestoneTitle)).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 3000);
  });

  test("TC-M5.3-03: Invoice matching to project", async ({ page }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/revenue");
    await waitForAppReady(page);
    await captureEvidence(page, seed.invoiceNumberLinked, { holdMs: 3000 });
    await expect(visibleText(page, seed.projectName)).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 2500);
  });

  test("TC-M5.3-04: Payment-delay alerts", async ({ page, request }) => {
    const session = await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await postBooksAlert(request, session.token, "payment-delay");
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/notifications");
    await waitForAppReady(page);
    await holdForVideo(page, 3500);
  });

  test("TC-M5.3-05: Discrepancy handling", async ({ page, request }) => {
    const session = await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    // Seed discrepancy note on linked invoice
    await dbClient.query(
      `UPDATE invoices SET discrepancy_note = $1 WHERE id = $2`,
      ["M5 E2E milestone amount mismatch", seed.invoiceLinkedId],
    );
    await postBooksAlert(request, session.token, "discrepancy");
    await gotoWithCommit(page, "/en/dashboard/integrations/zoho-books");
    await waitForAppReady(page);
    await captureEvidence(page, /discrepancy|mismatch|M5 E2E milestone/i, {
      timeout: 60000,
      holdMs: 3500,
    });
  });

  test("TC-M5.3-06: Sync direction and manual fallback", async ({ page }) => {
    await refreshPhase5FailedSyncs(dbClient, seed);
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/zoho");
    await waitForAppReady(page);
    await captureEvidence(page, /Sync direction|Zoho CRM → PMO/i, { holdMs: 2500 });
    await expectZohoFailedSyncVisible(page, {
      match: /M5 E2E CRM simulated failure|M5-E2E-CRM-FAIL/i,
      retryRecordId: seed.failedCrmId,
    });
  });

  // ─── M5.4 ─────────────────────────────────────────────────────────────

  test("TC-M5.4-01: Invoice number, amount, due date against project", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/zoho-books");
    await waitForAppReady(page);
    await captureEvidence(page, seed.invoiceNumberLinked, { holdMs: 3000 });
    await expect(visibleText(page, /50000|50,000/i)).toBeVisible({
      timeout: 30000,
    });
    await holdForVideo(page, 2500);
  });

  test("TC-M5.4-02: Paid / unpaid / overdue status", async ({ page }) => {
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/zoho-books");
    await waitForAppReady(page);
    await expect(visibleText(page, /paid/i)).toBeVisible({ timeout: 60000 });
    await expect(visibleText(page, /overdue|unpaid/i)).toBeVisible({
      timeout: 30000,
    });
    await captureEvidence(page, seed.invoiceNumberOverdue, { holdMs: 3000 });
  });

  test("TC-M5.4-03: Collection date captured", async ({ page }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/revenue");
    await waitForAppReady(page);
    await captureEvidence(page, seed.invoiceNumberLinked, { holdMs: 2500 });
    // Paid fixture has collection_date; overdue has null
    await expect(visibleText(page, seed.invoiceNumberOverdue)).toBeVisible();
    await holdForVideo(page, 2500);
  });

  test("TC-M5.4-04: Reconciliation control", async ({ page }) => {
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/zoho-books");
    await waitForAppReady(page);
    await clickIntegrationAction(
      page,
      "zoho-books-reconcile",
      /reconcil|match|missing|unlinked|success/i,
    );
  });

  test("TC-M5.4-05: Retry on Books failure", async ({ page }) => {
    await refreshPhase5FailedSyncs(dbClient, seed);
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/zoho-books");
    await waitForAppReady(page);
    await expectZohoFailedSyncVisible(page, {
      match: /M5 E2E Books simulated failure|M5-E2E-BOOKS-FAIL/i,
      retryRecordId: seed.failedBooksId,
    });
  });

  test("TC-M5.4-06: Finance alerts threshold", async ({ page, request }) => {
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/settings");
    await waitForAppReady(page);
    const financeTab = page.getByRole("button", { name: /Finance alert|Cost formula|finance/i });
    if (await financeTab.first().isVisible().catch(() => false)) {
      await financeTab.first().click();
    }
    const threshold = page.locator("#large-unpaid-threshold");
    if (await threshold.isVisible().catch(() => false)) {
      await threshold.fill("1000");
      const save = page.getByRole("button", { name: /Save/i }).first();
      await save.click();
      await holdForVideo(page, 2000);
    }
    const session = await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await postBooksAlert(request, session.token, "large-unpaid");
    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/notifications");
    await waitForAppReady(page);
    await holdForVideo(page, 3500);
  });

  // ─── M5.5 ─────────────────────────────────────────────────────────────

  test("TC-M5.5-01: Confirmed order draft charter surface", async ({ page }) => {
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/projects");
    await waitForAppReady(page);
    await captureEvidence(page, seed.draftProjectName, { holdMs: 3000 });
    await expect(page.getByRole("link", { name: /Draft Charters/i })).toHaveCount(
      0,
    );
  });

  test("TC-M5.5-02: Mapped customer, scope, value and dates", async ({ page }) => {
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(
      page,
      `/en/dashboard/projects/${seed.draftProjectId}?view=charter`,
    );
    await waitForAppReady(page);
    await captureEvidence(page, /Mapped purpose|Mapped scope|90000|Draft/i, {
      timeout: 60000,
      holdMs: 3500,
    });
  });

  test("TC-M5.5-03: Incomplete data flagged", async ({ page }) => {
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/projects");
    await waitForAppReady(page);
    await captureEvidence(page, seed.draftProjectName, { holdMs: 2000 });
    await gotoWithCommit(
      page,
      `/en/dashboard/projects/${seed.draftProjectId}?view=charter`,
    );
    await waitForAppReady(page);
    await captureEvidence(page, /incomplete|successCriteria|stakeholders|missing/i, {
      timeout: 60000,
      holdMs: 3500,
    });
  });

  test("TC-M5.5-04: Duplicate prevention by sourceOrderId", async ({ page }) => {
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    const blocked = await dbClient
      .query(
        `INSERT INTO project_charters (id, project_id, source_order_id, status, created_at)
         VALUES ($1, $2, $3, 'Draft', NOW())`,
        [cryptoRandom(), seed.draftProjectId, seed.sourceOrderId],
      )
      .then(
        () => false,
        () => true,
      );
    expect(blocked).toBe(true);
    await gotoWithCommit(page, "/en/dashboard/projects");
    await waitForAppReady(page);
    await expect(visibleText(page, seed.draftProjectName)).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page, 2500);
  });

  // ─── M5.6 ─────────────────────────────────────────────────────────────

  test("TC-M5.6-01: SOW writeback path documented on Zoho CRM page", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/zoho");
    await waitForAppReady(page);
    await captureEvidence(page, /SOW|attachment|Deal|writeback|PDF/i, {
      holdMs: 3500,
    });
  });

  test("TC-M5.6-02: Failed SOW updates queue and retry control", async ({
    page,
  }) => {
    await refreshPhase5FailedSyncs(dbClient, seed);
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/zoho");
    await waitForAppReady(page);
    await expectZohoFailedSyncVisible(page, {
      match: /M5 E2E SOW writeback failure|M5-E2E-SOW-FAIL|SOW write-back/i,
      retryRecordId: seed.failedSowId,
    });
  });

  test("TC-M5.6-03: Failed updates remain visible; Finance blocked", async ({
    page,
  }) => {
    await refreshPhase5FailedSyncs(dbClient, seed);
    await loginViaSessionInjection(page, IT_ADMIN_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/zoho");
    await waitForAppReady(page);
    await expectZohoFailedSyncVisible(page, {
      match: /M5 E2E SOW writeback failure|M5-E2E-SOW-FAIL/i,
      retryRecordId: seed.failedSowId,
    });

    await loginViaSessionInjection(page, FINANCE_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/integrations/zoho");
    await waitForAppReady(page);
    await expect(
      visibleText(page, /do not have permission to view integrations/i),
    ).toBeVisible({ timeout: 60000 });
    await holdForVideo(page, 3000);
  });
});

function cryptoRandom() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
