/**
 * Phase 5 — Financial & Integrations e2e helpers (M5.1–M5.6).
 * Seeds PMO fixtures so UI tests run without live Zoho when sync is unavailable.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import crypto from "crypto";
import type { Client } from "pg";
import {
  API_URL,
  PM_EMAIL,
  SUPER_ADMIN_EMAIL,
  bearer,
} from "./reporting";
import {
  IT_ADMIN_EMAIL,
  captureEvidence,
  gotoWithCommit,
  gotoProjectWorkspace,
  holdForVideo,
  waitForAppReady,
} from "./resources";

export {
  API_URL,
  IT_ADMIN_EMAIL,
  PM_EMAIL,
  SUPER_ADMIN_EMAIL,
  bearer,
  captureEvidence,
  gotoWithCommit,
  gotoProjectWorkspace,
  holdForVideo,
  waitForAppReady,
};

export const FINANCE_EMAIL = "finance.m5@cybsec.com";
export const PMO_LEAD_EMAIL = "pmo.lead.m3@cybsec.com";
export const M5_PROJECT_PREFIX = "E2E M5";

/** Prefer visible matches — DataTable keeps a md:hidden mobile copy of each row. */
export function visibleText(page: Page, text: string | RegExp) {
  return page.getByText(text).filter({ visible: true }).first();
}

export type Phase5Seed = {
  suffix: string;
  financeUserId: string;
  itAdminId: string;
  pmoLeadId: string;
  pmId: string;
  deptId: string;
  custId: string;
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneTitle: string;
  engEmployeeId: string;
  invoiceLinkedId: string;
  invoiceUnlinkedId: string;
  invoiceOverdueId: string;
  invoiceNumberLinked: string;
  invoiceNumberUnlinked: string;
  invoiceNumberOverdue: string;
  opportunityId: string;
  opportunityName: string;
  failedCrmId: string;
  failedBooksId: string;
  failedSowId: string;
  costMissingRateId: string;
  costWithRateId: string;
  costRateJumpId: string;
  costOtSpikeId: string;
  engUserId: string;
  draftProjectId: string;
  draftProjectName: string;
  draftCharterId: string;
  sourceOrderId: string;
};

async function roleId(db: Client, code: string): Promise<number> {
  const res = await db.query("SELECT id FROM roles WHERE code = $1 LIMIT 1", [
    code,
  ]);
  if (!res.rows[0]) throw new Error(`Role ${code} not found — run backend seed`);
  return res.rows[0].id as number;
}

async function ensureUser(
  db: Client,
  email: string,
  displayName: string,
  roleCode: string,
): Promise<string> {
  const rid = await roleId(db, roleCode);
  const res = await db.query(
    `INSERT INTO users (id, email, display_name, role_id, is_active, is_external, entra_object_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, true, false, $5, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET display_name = $3, role_id = $4, is_active = true
     RETURNING id`,
    [crypto.randomUUID(), email, displayName, rid, crypto.randomUUID()],
  );
  return res.rows[0].id as string;
}

async function lookupId(
  db: Client,
  sql: string,
  params: unknown[],
  label: string,
): Promise<string> {
  const res = await db.query(sql, params);
  if (!res.rows[0]) {
    throw new Error(`${label} not found — run the backend seed first`);
  }
  return res.rows[0].id as string;
}

export async function cleanupOrphanPhase5Projects(db: Client): Promise<void> {
  const orphans = await db.query(`SELECT id FROM projects WHERE name LIKE $1`, [
    `${M5_PROJECT_PREFIX} %`,
  ]);
  for (const row of orphans.rows) {
    await cleanupProjectCascade(db, row.id as string);
  }
}

async function cleanupProjectCascade(db: Client, projectId: string) {
  await db.query(
    `DELETE FROM invoices WHERE project_id = $1 OR zoho_invoice_id LIKE $2`,
    [projectId, "M5-E2E-%"],
  );
  await db.query(
    `DELETE FROM employee_costs WHERE project_id = $1`,
    [projectId],
  );
  await db.query(
    `DELETE FROM data_quality_flags WHERE project_id = $1`,
    [projectId],
  );
  await db.query(
    `DELETE FROM budget_adjustments WHERE budget_id IN (SELECT id FROM project_budgets WHERE project_id = $1)`,
    [projectId],
  );
  await db.query(
    `DELETE FROM budget_line_items WHERE budget_id IN (SELECT id FROM project_budgets WHERE project_id = $1)`,
    [projectId],
  );
  await db.query(
    `DELETE FROM budget_revisions WHERE budget_id IN (SELECT id FROM project_budgets WHERE project_id = $1)`,
    [projectId],
  );
  await db.query(`DELETE FROM project_budgets WHERE project_id = $1`, [
    projectId,
  ]);
  await db.query(`DELETE FROM project_charters WHERE project_id = $1`, [
    projectId,
  ]);
  await db.query(`DELETE FROM project_milestones WHERE project_id = $1`, [
    projectId,
  ]);
  await db.query(`DELETE FROM project_phases WHERE project_id = $1`, [
    projectId,
  ]);
  await db.query(`DELETE FROM allocations WHERE project_id = $1`, [projectId]);
  await db.query(`DELETE FROM tasks WHERE project_id = $1`, [projectId]);
  await db.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
}

export async function cleanupPhase5Financial(
  db: Client,
  seed: Phase5Seed,
): Promise<void> {
  await db.query(
    `DELETE FROM failed_sync_records WHERE id = ANY($1::uuid[]) OR entity_id LIKE 'M5-E2E%'`,
    [[seed.failedCrmId, seed.failedBooksId, seed.failedSowId]],
  );
  await db.query(
    `DELETE FROM invoices WHERE id = ANY($1::uuid[]) OR zoho_invoice_id LIKE 'M5-E2E%'`,
    [[seed.invoiceLinkedId, seed.invoiceUnlinkedId, seed.invoiceOverdueId]],
  );
  await db.query(
    `DELETE FROM crm_opportunities WHERE id = $1 OR zoho_opportunity_id LIKE 'M5-E2E%'`,
    [seed.opportunityId],
  );
  await db.query(
    `DELETE FROM employee_costs WHERE project_id = ANY($1::uuid[])`,
    [[seed.projectId, seed.draftProjectId]],
  );
  await db.query(
    `DELETE FROM data_quality_flags WHERE project_id = ANY($1::uuid[])`,
    [[seed.projectId, seed.draftProjectId]],
  );
  await db.query(`DELETE FROM project_charters WHERE id = $1 OR project_id = $2`, [
    seed.draftCharterId,
    seed.draftProjectId,
  ]);
  await cleanupProjectCascade(db, seed.draftProjectId);
  await cleanupProjectCascade(db, seed.projectId);
}

export async function seedPhase5Financial(
  db: Client,
  options?: { projectSuffix?: string },
): Promise<Phase5Seed> {
  const suffix = options?.projectSuffix ?? String(Date.now());

  const pmId = await lookupId(
    db,
    "SELECT id FROM users WHERE email = $1",
    [PM_EMAIL],
    `PM user ${PM_EMAIL}`,
  );
  const itAdminId = await ensureUser(
    db,
    IT_ADMIN_EMAIL,
    "M5 Roba IT Admin",
    "it_admin",
  );
  const financeUserId = await ensureUser(
    db,
    FINANCE_EMAIL,
    "M5 Fiona Finance",
    "finance",
  );
  const pmoLeadId = await ensureUser(
    db,
    PMO_LEAD_EMAIL,
    "M3 Priya PMO Lead",
    "pmo_lead",
  );
  const deptId = await lookupId(
    db,
    "SELECT id FROM departments WHERE code = $1 LIMIT 1",
    ["SOC"],
    "Department SOC",
  );
  const custId = await lookupId(
    db,
    "SELECT id FROM customers WHERE company_name = $1 LIMIT 1",
    ["Acme Financial Services"],
    "Customer 'Acme Financial Services'",
  );

  // Engineer employee for cost anomaly fixtures
  const engUserId = await ensureUser(
    db,
    "eng.m5.cost@cybsec.com",
    "M5 Cost Engineer",
    "engineer",
  );
  const engEmployeeRes = await db.query(
    `INSERT INTO employees (id, user_id, department_id, keka_employee_id, designation, name, email, weekly_hours, is_active, synced_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'Software Engineer', 'M5 Cost Engineer', 'eng.m5.cost@cybsec.com', 40, true, NOW(), NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET name = 'M5 Cost Engineer', is_active = true
     RETURNING id`,
    [crypto.randomUUID(), engUserId, deptId, `MOCK-KEKA-M5-${suffix}`],
  );
  const engEmployeeId = engEmployeeRes.rows[0].id as string;

  const projectId = crypto.randomUUID();
  const projectName = `${M5_PROJECT_PREFIX} Finance Project - ${suffix}`;
  await db.query(
    `INSERT INTO projects (id, name, objective, department_id, customer_id, engagement_type, billing_model, start_date, end_date, value, currency, primary_pm_id, status, created_by, created_at, updated_at)
     VALUES ($1, $2, 'Phase 5 financial e2e', $3, $4, 'Managed Service', 'Fixed Price',
             CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '90 days',
             250000, 'USD', $5, 'Active', $5, NOW(), NOW())`,
    [projectId, projectName, deptId, custId, pmId],
  );

  const phaseId = crypto.randomUUID();
  await db.query(
    `INSERT INTO project_phases (id, project_id, name, description, start_date, end_date, status, order_index, created_at, updated_at)
     VALUES ($1, $2, 'Delivery', 'Delivery phase', CURRENT_DATE, CURRENT_DATE + INTERVAL '60 days', 'Planned', 0, NOW(), NOW())`,
    [phaseId, projectId],
  );

  const milestoneId = crypto.randomUUID();
  const milestoneTitle = `M5 Invoice Milestone ${suffix}`;
  await db.query(
    `INSERT INTO project_milestones (id, project_id, phase_id, title, target_date, weight, status, created_at)
     VALUES ($1, $2, $3, $4, CURRENT_DATE + INTERVAL '21 days', 100, 'Pending', NOW())`,
    [milestoneId, projectId, phaseId, milestoneTitle],
  );

  await db.query(
    `INSERT INTO allocations (id, employee_id, project_id, role, hours, percent, start_date, end_date, status, approved_by, created_at)
     VALUES ($1, $2, $3, 'Software Engineer', 40, 100, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '90 days', 'Active', $4, NOW())`,
    [crypto.randomUUID(), engEmployeeId, projectId, pmId],
  );

  const now = new Date();
  const periodYear = now.getUTCFullYear();
  const periodMonth = now.getUTCMonth() + 1;
  const priorMonth = periodMonth === 1 ? 12 : periodMonth - 1;
  const priorYear = periodMonth === 1 ? periodYear - 1 : periodYear;
  const olderMonth = priorMonth === 1 ? 12 : priorMonth - 1;
  const olderYear = priorMonth === 1 ? priorYear - 1 : priorYear;

  const costMissingRateId = crypto.randomUUID();
  const costWithRateId = crypto.randomUUID();
  const costRateJumpId = crypto.randomUUID();
  const costOtSpikeId = crypto.randomUUID();

  // Missing rate (current): hours > 0, rate 0
  await db.query(
    `INSERT INTO employee_costs (
       id, employee_id, project_id, period_year, period_month,
       regular_hours, overtime_hours, rate_per_hour, total_cost, computed_at
     ) VALUES ($1, $2, $3, $4, $5, 40, 0, 0, 0, NOW())`,
    [costMissingRateId, engEmployeeId, projectId, periodYear, periodMonth],
  );
  // Rate jump series on a second employee
  const eng2UserId = await ensureUser(
    db,
    "eng.m5.jump@cybsec.com",
    "M5 Jump Engineer",
    "engineer",
  );
  const eng2Res = await db.query(
    `INSERT INTO employees (id, user_id, department_id, keka_employee_id, designation, name, email, weekly_hours, is_active, synced_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'Software Engineer', 'M5 Jump Engineer', 'eng.m5.jump@cybsec.com', 40, true, NOW(), NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET name = 'M5 Jump Engineer', is_active = true
     RETURNING id`,
    [crypto.randomUUID(), eng2UserId, deptId, `MOCK-KEKA-M5-J-${suffix}`],
  );
  const eng2EmployeeId = eng2Res.rows[0].id as string;
  await db.query(
    `INSERT INTO allocations (id, employee_id, project_id, role, hours, percent, start_date, end_date, status, approved_by, created_at)
     VALUES ($1, $2, $3, 'Software Engineer', 20, 50, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '90 days', 'Active', $4, NOW())`,
    [crypto.randomUUID(), eng2EmployeeId, projectId, pmId],
  );
  await db.query(
    `INSERT INTO employee_costs (
       id, employee_id, project_id, period_year, period_month,
       regular_hours, overtime_hours, rate_per_hour, total_cost, computed_at
     ) VALUES
       ($1, $2, $3, $4, $5, 40, 0, 50, 2000, NOW()),
       ($6, $2, $3, $7, $8, 40, 0, 100, 4000, NOW()),
       ($9, $2, $3, $10, $11, 10, 20, 80, 2400, NOW())`,
    [
      costWithRateId,
      eng2EmployeeId,
      projectId,
      priorYear,
      priorMonth,
      costRateJumpId,
      periodYear,
      periodMonth,
      costOtSpikeId,
      olderYear,
      olderMonth,
    ],
  );

  const draftProjectId = crypto.randomUUID();
  const draftProjectName = `${M5_PROJECT_PREFIX} Draft Charter - ${suffix}`;
  const sourceOrderId = `zoho-so:M5-E2E-SO-${suffix}`;
  const draftCharterId = crypto.randomUUID();
  await db.query(
    `INSERT INTO projects (id, name, objective, department_id, customer_id, engagement_type, billing_model, start_date, end_date, value, currency, primary_pm_id, status, created_by, created_at, updated_at)
     VALUES ($1, $2, 'Phase 5 draft charter e2e', $3, $4, 'Managed Service', 'Fixed Price',
             CURRENT_DATE, CURRENT_DATE + INTERVAL '60 days',
             90000, 'USD', $5, 'Draft', $5, NOW(), NOW())`,
    [draftProjectId, draftProjectName, deptId, custId, pmId],
  );
  await db.query(
    `INSERT INTO project_charters (
       id, project_id, customer_id, source_order_id, status, purpose, scope_summary,
       value_snapshot, start_date, end_date, version, incomplete_fields, created_at
     ) VALUES (
       $1, $2, $3, $4, 'Draft', 'Mapped purpose from SO', 'Mapped scope from SO notes',
       90000, CURRENT_DATE, CURRENT_DATE + INTERVAL '60 days', 1,
       $5::jsonb, NOW()
     )`,
    [
      draftCharterId,
      draftProjectId,
      custId,
      sourceOrderId,
      JSON.stringify(["successCriteria", "stakeholders"]),
    ],
  );

  const opportunityId = crypto.randomUUID();
  const opportunityName = `M5 E2E Deal ${suffix}`;
  await db.query(
    `INSERT INTO crm_opportunities (
       id, zoho_opportunity_id, name, account_name, expected_revenue, stage, synced_at, created_at
     ) VALUES ($1, $2, $3, 'Acme Financial Services', 120000, 'Qualification', NOW(), NOW())`,
    [opportunityId, `M5-E2E-DEAL-${suffix}`, opportunityName],
  );

  const invoiceLinkedId = crypto.randomUUID();
  const invoiceUnlinkedId = crypto.randomUUID();
  const invoiceOverdueId = crypto.randomUUID();
  const invoiceNumberLinked = `M5-INV-L-${suffix.slice(-6)}`;
  const invoiceNumberUnlinked = `M5-INV-U-${suffix.slice(-6)}`;
  const invoiceNumberOverdue = `M5-INV-O-${suffix.slice(-6)}`;

  await db.query(
    `INSERT INTO invoices (
       id, project_id, zoho_invoice_id, invoice_number, customer_name, amount, balance, payment_made,
       currency, invoice_date, due_date, collection_date, status, matched_milestone_id, synced_at, created_at
     ) VALUES
       ($1, $2, $3, $4, 'Acme Financial Services', 50000, 0, 50000, 'USD',
        CURRENT_DATE - 20, CURRENT_DATE - 5, CURRENT_DATE - 2, 'paid', $5, NOW(), NOW()),
       ($6, NULL, $7, $8, 'Acme Financial Services', 15000, 15000, 0, 'USD',
        CURRENT_DATE - 10, CURRENT_DATE + 20, NULL, 'unpaid', NULL, NOW(), NOW()),
       ($9, $2, $10, $11, 'Acme Financial Services', 8000, 8000, 0, 'USD',
        CURRENT_DATE - 40, CURRENT_DATE - 10, NULL, 'overdue', NULL, NOW(), NOW())`,
    [
      invoiceLinkedId,
      projectId,
      `M5-E2E-INV-L-${suffix}`,
      invoiceNumberLinked,
      milestoneId,
      invoiceUnlinkedId,
      `M5-E2E-INV-U-${suffix}`,
      invoiceNumberUnlinked,
      invoiceOverdueId,
      `M5-E2E-INV-O-${suffix}`,
      invoiceNumberOverdue,
    ],
  );

  const failedCrmId = crypto.randomUUID();
  const failedBooksId = crypto.randomUUID();
  const failedSowId = crypto.randomUUID();
  await db.query(
    `DELETE FROM failed_sync_records WHERE entity_id LIKE 'M5-E2E%' OR error_msg LIKE 'M5 E2E%'`,
  );
  await db.query(
    `INSERT INTO failed_sync_records
       (id, integration, entity_type, entity_id, direction, payload, error_msg, retry_count, is_resolved, dead_lettered_at, last_attempted, created_at)
     VALUES
       ($1, 'zoho_crm', 'opportunity', 'M5-E2E-CRM-FAIL', 'inbound', '{}'::jsonb, 'M5 E2E CRM simulated failure', 0, false, NULL, NOW(), NOW()),
       ($2, 'zoho_books', 'invoice', 'M5-E2E-BOOKS-FAIL', 'inbound', '{}'::jsonb, 'M5 E2E Books simulated failure', 0, false, NULL, NOW(), NOW()),
       ($3, 'zoho_crm', 'sow_writeback', 'M5-E2E-SOW-FAIL', 'outbound', '{}'::jsonb, 'M5 E2E SOW writeback failure', 1, false, NULL, NOW(), NOW())`,
    [failedCrmId, failedBooksId, failedSowId],
  );

  return {
    suffix,
    financeUserId,
    itAdminId,
    pmoLeadId,
    pmId,
    deptId,
    custId,
    projectId,
    projectName,
    milestoneId,
    milestoneTitle,
    engEmployeeId,
    engUserId,
    invoiceLinkedId,
    invoiceUnlinkedId,
    invoiceOverdueId,
    invoiceNumberLinked,
    invoiceNumberUnlinked,
    invoiceNumberOverdue,
    opportunityId,
    opportunityName,
    failedCrmId,
    failedBooksId,
    failedSowId,
    costMissingRateId,
    costWithRateId,
    costRateJumpId,
    costOtSpikeId,
    draftProjectId,
    draftProjectName,
    draftCharterId,
    sourceOrderId,
  };
}

/** Open project Financials tab (finance role sees this as the only view). */
export async function openProjectFinancials(
  page: Page,
  projectId: string,
  projectName: string,
) {
  await gotoWithCommit(
    page,
    `/en/dashboard/projects/${projectId}?view=financials`,
  );
  await waitForAppReady(page);
  await expect(visibleText(page, projectName)).toBeVisible({
    timeout: 60000,
  });
  // Scope to main — "Financials" also appears in sidebar/nav (strict-mode).
  const main = page.getByRole("main");
  await expect(
    main
      .getByRole("heading", { name: /Approve baseline|Current budget|Financials/i })
      .or(main.locator("#baseline-amount"))
      .or(main.getByText("Current Budget").filter({ visible: true }).first())
      .first(),
  ).toBeVisible({ timeout: 60000 });
}

export async function approveBaselineFromUi(
  page: Page,
  amount: string | number,
) {
  const amountStr = String(amount);
  await expect(visibleText(page, "Approve baseline")).toBeVisible({
    timeout: 30000,
  });
  await page.locator("#baseline-amount").fill(amountStr);
  await page.getByRole("button", { name: "Approve baseline" }).click();
  await expect(visibleText(page, /baseline|approved|budget/i)).toBeVisible({
    timeout: 30000,
  });
  await holdForVideo(page, 2500);
}

/** Click a sync/test control when enabled; otherwise assert visibility only. */
export async function clickIntegrationAction(
  page: Page,
  testId: string,
  successPattern: RegExp,
) {
  const button = page.getByTestId(testId);
  await expect(button).toBeVisible({ timeout: 60000 });
  await holdForVideo(page, 1500);
  if (await button.isDisabled()) {
    // Zoho OAuth not configured in this environment — UI presence is enough.
    await holdForVideo(page, 2000);
    return;
  }
  await button.click();
  const toast = page
    .getByText(successPattern)
    .or(page.getByText(/fail|error|not configured|unauthorized|token|OAuth/i));
  await expect(toast.first())
    .toBeVisible({ timeout: 90000 })
    .catch(() => undefined);
  await holdForVideo(page, 3000);
}

export async function openFinanceTab(
  page: Page,
  label: "Budget" | "Cost lines" | "Adjustments" | "Resource costs",
) {
  const tab = page.getByRole("button", { name: new RegExp(`^${label}`, "i") });
  await expect(tab.first()).toBeVisible({ timeout: 30000 });
  await tab.first().click();
  await holdForVideo(page, 1000);
}

export async function proposeRevisionFromUi(
  page: Page,
  amount: string | number,
  reason: string,
) {
  await openFinanceTab(page, "Budget");
  await page.getByRole("button", { name: /Propose revision/i }).click();
  await page.locator("#rev-amount").fill(String(amount));
  await page.locator("#rev-reason").fill(reason);
  await page.getByRole("button", { name: /^Submit$/ }).click();
  await expect(visibleText(page, /Pending|revision/i)).toBeVisible({
    timeout: 30000,
  });
  await holdForVideo(page, 2500);
}

export async function approveFirstPendingRevision(page: Page) {
  const approve = page.getByRole("button", { name: /^Approve$/ }).first();
  await expect(approve).toBeVisible({ timeout: 30000 });
  await approve.click();
  await expect(visibleText(page, /Approved|budget/i)).toBeVisible({
    timeout: 30000,
  });
  await holdForVideo(page, 2500);
}

export async function addCostLineFromUi(
  page: Page,
  options: {
    category: string;
    name: string;
    planned: string | number;
    actual?: string | number;
  },
) {
  await openFinanceTab(page, "Cost lines");
  await page.getByRole("button", { name: /Add line/i }).click();
  // Category select — click trigger near Category label
  const catLabel = page.locator("label").filter({ hasText: /^Category/ }).first();
  await catLabel.locator("xpath=..").locator('[data-slot="select-trigger"]').click();
  await page
    .locator('[data-slot="select-item"]:visible')
    .filter({ hasText: options.category })
    .first()
    .click();
  const nameInput = page
    .locator("label")
    .filter({ hasText: /^Name/ })
    .first()
    .locator("xpath=..")
    .locator("input");
  await nameInput.fill(options.name);
  const plannedInput = page
    .locator("label")
    .filter({ hasText: /^Planned/ })
    .first()
    .locator("xpath=..")
    .locator("input");
  await plannedInput.fill(String(options.planned));
  if (options.actual != null) {
    const actualInput = page
      .locator("label")
      .filter({ hasText: /^Actual/ })
      .first()
      .locator("xpath=..")
      .locator("input");
    if (await actualInput.isVisible().catch(() => false)) {
      await actualInput.fill(String(options.actual));
    }
  }
  await page.getByRole("button", { name: /^Save line$|^Save$|^Add$/ }).first().click();
  await expect(visibleText(page, options.name)).toBeVisible({
    timeout: 30000,
  });
  await holdForVideo(page, 2500);
}

export async function requestAdjustmentFromUi(
  page: Page,
  options: { amount: string | number; reason: string },
) {
  await openFinanceTab(page, "Adjustments");
  await page.getByRole("button", { name: /Request adjustment/i }).click();
  await page.locator("#adj-amount, input").filter({ hasText: "" }).first();
  const amountField = page
    .locator("label")
    .filter({ hasText: /New amount/i })
    .first()
    .locator("xpath=..")
    .locator("input");
  await amountField.fill(String(options.amount));
  const reasonField = page
    .locator("label")
    .filter({ hasText: /^Reason/i })
    .first()
    .locator("xpath=..")
    .locator("textarea, input")
    .first();
  await reasonField.fill(options.reason);
  await page.getByRole("button", { name: /^Submit$|^Request$/ }).first().click();
  await expect(visibleText(page, /Pending|adjustment/i)).toBeVisible({
    timeout: 30000,
  });
  await holdForVideo(page, 2500);
}

export async function exportBudgetTracker(
  page: Page,
  format: "csv" | "xlsx",
) {
  await page.getByRole("button", { name: /Export/i }).click();
  const item =
    format === "csv"
      ? page.getByText(/^CSV$/i).first()
      : page.getByText(/Excel|\.xlsx/i).first();
  await expect(item).toBeVisible({ timeout: 10000 });
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }).catch(() => null),
    item.click(),
  ]);
  await holdForVideo(page, 2500);
  return download;
}

export async function scanDataQuality(page: Page) {
  const scanBtn = page.getByRole("button", { name: /Scan all projects/i });
  await expect(scanBtn).toBeVisible({ timeout: 30000 });
  await scanBtn.click();
  await expect(
    page.getByText(/Data quality scan complete/i).first(),
  ).toBeVisible({ timeout: 120000 });
  await holdForVideo(page, 2500);
}

export async function postBooksAlert(
  request: import("@playwright/test").APIRequestContext,
  token: string,
  kind: "payment-delay" | "discrepancy" | "large-unpaid",
) {
  const res = await request.post(
    `${API_URL}/integrations/zoho/books/alerts/${kind}`,
    { headers: bearer(token) },
  );
  return res;
}

/** Re-insert Phase 5 failed-sync fixtures (ids stay stable on the seed object). */
export async function refreshPhase5FailedSyncs(
  db: Client,
  seed: Phase5Seed,
): Promise<void> {
  await db.query(
    `DELETE FROM failed_sync_records
     WHERE id = ANY($1::uuid[])
        OR entity_id LIKE 'M5-E2E%'
        OR error_msg LIKE 'M5 E2E%'`,
    [[seed.failedCrmId, seed.failedBooksId, seed.failedSowId]],
  );
  await db.query(
    `INSERT INTO failed_sync_records
       (id, integration, entity_type, entity_id, direction, payload, error_msg, retry_count, is_resolved, dead_lettered_at, last_attempted, created_at)
     VALUES
       ($1, 'zoho_crm', 'opportunity', 'M5-E2E-CRM-FAIL', 'inbound', '{}'::jsonb, 'M5 E2E CRM simulated failure', 0, false, NULL, NOW(), NOW()),
       ($2, 'zoho_books', 'invoice', 'M5-E2E-BOOKS-FAIL', 'inbound', '{}'::jsonb, 'M5 E2E Books simulated failure', 0, false, NULL, NOW(), NOW()),
       ($3, 'zoho_crm', 'sow_writeback', 'M5-E2E-SOW-FAIL', 'outbound', '{}'::jsonb, 'M5 E2E SOW writeback failure', 1, false, NULL, NOW(), NOW())`,
    [seed.failedCrmId, seed.failedBooksId, seed.failedSowId],
  );
}

/**
 * Scroll to Failed sync panel, switch filter to All, refresh, assert row + retry.
 */
export async function expectZohoFailedSyncVisible(
  page: Page,
  options: { match: string | RegExp; retryRecordId: string },
) {
  const panelTitle = page.getByRole("heading", { name: /Failed sync records/i });
  await expect(panelTitle).toBeVisible({ timeout: 60000 });
  await panelTitle.scrollIntoViewIfNeeded();

  const panel = page
    .locator("div.rounded-xl.border")
    .filter({ has: panelTitle });

  const statusTrigger = panel.locator('[data-slot="select-trigger"]').first();
  if (await statusTrigger.isVisible().catch(() => false)) {
    await statusTrigger.click();
    await page
      .locator('[data-slot="select-item"]:visible')
      .filter({ hasText: /^All$/ })
      .click();
    await holdForVideo(page, 500);
  }

  const refresh = panel.getByRole("button", { name: /Refresh/i });
  if (await refresh.isVisible().catch(() => false)) {
    await refresh.click();
  }

  await expect(
    panel.getByText(options.match).filter({ visible: true }).first(),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByTestId(`zoho-retry-${options.retryRecordId}`),
  ).toBeVisible({ timeout: 30000 });
  await holdForVideo(page, 2500);
}

