import { test, expect } from "@playwright/test";
import { loginViaSessionInjection, loginViaEmergencyForm } from "../helpers/auth";
import { getDbClient } from "../helpers/db";
import crypto from "crypto";
async function dismissDropdowns(page: any) {
  // Only target Select dropdowns (data-slot="select-trigger"), NOT date picker popover triggers
  let attempts = 0;
  while (attempts < 5) {
    const openSelects = page.locator('[data-slot="select-trigger"][aria-expanded="true"]');
    const count = await openSelects.count();
    if (count === 0) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    attempts++;
  }
}

async function selectDropdown(page: any, label: string, optionText: string) {
  // Close any open Select dropdowns first
  await dismissDropdowns(page);

  let scope = page.locator('[role="dialog"]');
  if (await scope.count() === 0) {
    scope = page.locator('body');
  }

  const labelEl = scope.locator('label').filter({ hasText: label }).first();
  let container = labelEl.locator('xpath=..');
  const isFlex = await container.evaluate((el: any) => el.classList.contains('flex') || el.className.includes('flex')).catch(() => false);
  if (isFlex) {
    container = container.locator('xpath=..');
  }

  const trigger = container.locator('[data-slot="select-trigger"]').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const popup = page.locator('[data-slot="select-content"]:visible');
  await expect(popup).toBeVisible({ timeout: 5000 });
  const item = popup.locator('[data-slot="select-item"]:visible').filter({ hasText: optionText }).first();
  await expect(item).toBeVisible({ timeout: 5000 });
  await item.click();
  // Wait until the popup is fully gone
  await expect(popup).toBeHidden({ timeout: 5000 });
  // Confirm trigger is closed
  await expect(trigger).toHaveAttribute("aria-expanded", "false", { timeout: 3000 });
}

async function pickDate(page: any, label: string, day: string, goNextMonths = 0) {
  // Make sure no Select dropdowns are open before we open the date calendar
  await dismissDropdowns(page);
  await page.waitForTimeout(200);

  let scope = page.locator('[role="dialog"]');
  if (await scope.count() === 0) {
    scope = page.locator('body');
  }

  const labelEl = scope.locator('label').filter({ hasText: label }).first();
  let container = labelEl.locator('xpath=..');
  const isFlex = await container.evaluate((el: any) => el.classList.contains('flex') || el.className.includes('flex')).catch(() => false);
  if (isFlex) {
    container = container.locator('xpath=..');
  }

  const trigger = container.locator('button').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  // Wait for the calendar popup to appear
  const calendar = page.locator('[data-slot="calendar"]');
  await expect(calendar).toBeVisible({ timeout: 8000 });

  // Navigate months if needed
  for (let i = 0; i < goNextMonths; i++) {
    await page.locator('[data-slot="calendar"] button').filter({ has: page.locator('svg.lucide-chevron-right') }).first().click();
    await page.waitForTimeout(200);
  }

  // Click the correct day — exact text match, not disabled, not outside current month
  const dayBtn = calendar
    .locator('button:not([disabled]):not([aria-disabled="true"])')
    .filter({ hasText: new RegExp(`^${day}$`) })
    .first();
  await expect(dayBtn).toBeVisible({ timeout: 5000 });
  await dayBtn.click();
  
  // Since date picker popover remains open, press Escape to close it programmatically in tests
  await page.keyboard.press("Escape");
  await expect(calendar).toBeHidden({ timeout: 3000 });
  await page.waitForTimeout(200);
}

test.describe("Project Management (Foundation Phase)", () => {
  let dbClient: any;
  let alicePmId: string;

  test.beforeAll(async () => {
    dbClient = await getDbClient();

    // 1. Fetch pm role ID and insert Alice PM so we have a secondary PM for TC-M1.1-02
    const pmRoleRes = await dbClient.query("SELECT id FROM roles WHERE code = 'pm' LIMIT 1");
    const pmRoleId = pmRoleRes.rows[0].id;

    alicePmId = crypto.randomUUID();
    const insertRes = await dbClient.query(
      `INSERT INTO users (id, email, display_name, role_id, is_active, is_external, entra_object_id, created_at, updated_at)
       VALUES ($1, 'alice.pm@bminilik12gmail.onmicrosoft.com', 'Alice PM', $2, true, false, $3, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET display_name = 'Alice PM'
       RETURNING id`,
      [alicePmId, pmRoleId, crypto.randomUUID()]
    );
    alicePmId = insertRes.rows[0].id;
  });

  test.afterAll(async () => {
    if (dbClient) {
      // Clean up Alice PM and any test projects and tasks created during testing
      await dbClient.query("DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %'))");
      await dbClient.query("DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %'))");
      await dbClient.query("DELETE FROM task_dependencies WHERE predecessor_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %')) OR successor_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %'))");
      await dbClient.query("DELETE FROM task_progress_updates WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %'))");
      await dbClient.query("DELETE FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %')");
      await dbClient.query("DELETE FROM allocations WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %')");
      await dbClient.query("DELETE FROM project_phases WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %')");
      await dbClient.query("DELETE FROM project_milestones WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %')");
      await dbClient.query("DELETE FROM projects WHERE name LIKE 'Project %'");
      await dbClient.query("DELETE FROM users WHERE email = $1", ["alice.pm@bminilik12gmail.onmicrosoft.com"]);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test("TC-M1.1-01: Create project with name, objective, department, customer, dates and value", async ({ page }) => {
    // 1. Log in as PM using Session Injection
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");

    // 2. Go to projects list page — wait for permissions API to confirm auth is fully hydrated
    const permissionsResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/auth/me/permissions") && res.status() === 200,
      { timeout: 60000 }
    );
    await page.goto("/en/dashboard/projects");
    await permissionsResponsePromise;
    // Wait for the page's network activity to fully idle (lets any HMR finish before we act)
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    // Now the auth is hydrated — wait for the projects list to finish loading
    await expect(page.locator('text="Loading projects..."')).toBeHidden({ timeout: 30000 });

    // 3. Open project creation sheet
    await page.locator('button:has-text("New Project")').click();

    // 4. Fill in Overview details
    const projectName = `Project Titan - ${Date.now()}`;
    await page.fill('input[placeholder="e.g. ERP Migration Phase 3"]', projectName);
    await page.fill('textarea[placeholder*="Brief overview"]', "Upgrade Core project objective text");
    
    // Select Department: Security Operations Center
    await selectDropdown(page, "Department", "Security Operations Center");

    // Select Client: Acme Financial Services
    await selectDropdown(page, "Client / Customer", "Acme Financial Services");

    // Select Primary PM: John Smith
    await selectDropdown(page, "Primary PM", "John Smith");

    // Select Dates: Start Date (today, 30), End Date (next month, 15)
    await pickDate(page, "Start Date", "30", 0);
    await pickDate(page, "End Date", "15", 1);

    // Fill Budget Value
    await page.fill('input[name="value"]', "120000");

    // Select Engagement Type & Billing Model
    await selectDropdown(page, "Engagement Type", "Fixed Price");
    await selectDropdown(page, "Billing Model", "Fixed Price");

    // 5. Submit Form
    await page.click('button[type="submit"]:has-text("Create Project")');

    // 6. Verify success toast or list update
    await expect(page.locator("body")).toContainText("Project created");

    // 7. Verify DB writes directly
    const dbRes = await dbClient.query(
      "SELECT * FROM projects WHERE name = $1 LIMIT 1",
      [projectName]
    );
    expect(dbRes.rows.length).toBe(1);
    expect(dbRes.rows[0].objective).toBe("Upgrade Core project objective text");
    expect(Number(dbRes.rows[0].value)).toBe(120000);

    // 8. Verify Audit Logs
    const auditRes = await dbClient.query(
      "SELECT * FROM audit_logs WHERE action = 'PROJECT_CREATED' OR (new_value->>'name' = $1) LIMIT 1",
      [projectName]
    );
    expect(auditRes.rows.length).toBe(1);
  });

  test("TC-M1.1-02: Assign primary PM and secondary PM", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");

    // 2. Go to projects list page — wait for permissions API to confirm auth is fully hydrated
    const permissionsResponsePromise2 = page.waitForResponse(
      (res) => res.url().includes("/auth/me/permissions") && res.status() === 200,
      { timeout: 60000 }
    );
    await page.goto("/en/dashboard/projects");
    await permissionsResponsePromise2;
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    await expect(page.locator('text="Loading projects..."')).toBeHidden({ timeout: 30000 });

    // 3. Open project creation sheet
    await page.locator('button:has-text("New Project")').click();

    // 4. Fill basic details
    const projectName = `Project PM Assignment - ${Date.now()}`;
    await page.fill('input[placeholder="e.g. ERP Migration Phase 3"]', projectName);
    await page.fill('textarea[placeholder*="Brief overview"]', "Upgrade Core PMs assignment objective");
    await selectDropdown(page, "Department", "Security Operations Center");
    await selectDropdown(page, "Client / Customer", "Acme Financial Services");

    // Select Primary PM: John Smith
    await selectDropdown(page, "Primary PM", "John Smith");

    // Select Secondary PM: Alice PM
    await selectDropdown(page, "Secondary PM", "Alice PM");

    // Select Dates and Budget
    await pickDate(page, "Start Date", "30", 0);
    await pickDate(page, "End Date", "15", 1);
    await page.fill('input[name="value"]', "80000");
    await selectDropdown(page, "Engagement Type", "Fixed Price");
    await selectDropdown(page, "Billing Model", "Fixed Price");

    // 5. Submit Form
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.locator("body")).toContainText("Project created");

    // 6. Verify DB writes for primary and secondary PM IDs
    const dbRes = await dbClient.query(
      "SELECT * FROM projects WHERE name = $1 LIMIT 1",
      [projectName]
    );
    expect(dbRes.rows.length).toBe(1);
    const pmRes = await dbClient.query("SELECT id FROM users WHERE email = $1", ["john.pm@bminilik12gmail.onmicrosoft.com"]);
    const pmId = pmRes.rows[0].id;
    expect(dbRes.rows[0].primary_pm_id).toBe(pmId);
    expect(dbRes.rows[0].secondary_pm_id).toBe(alicePmId);

    // 7. Verify Audit Logs
    const auditRes = await dbClient.query(
      "SELECT * FROM audit_logs WHERE action = 'PROJECT_CREATED' OR (new_value->>'name' = $1) LIMIT 1",
      [projectName]
    );
    expect(auditRes.rows.length).toBe(1);
  });

  test("TC-M1.1-03: Configure milestones on the project", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");
    const permissionsResponsePromise3 = page.waitForResponse(
      (res) => res.url().includes("/auth/me/permissions") && res.status() === 200,
      { timeout: 60000 }
    );
    await page.goto("/en/dashboard/projects");
    await permissionsResponsePromise3;
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    await expect(page.locator('text="Loading projects..."')).toBeHidden({ timeout: 30000 });

    // 2. Open project creation sheet
    await page.locator('button:has-text("New Project")').click();

    // 3. Fill basic fields
    const projectName = `Project Milestones - ${Date.now()}`;
    await page.fill('input[placeholder="e.g. ERP Migration Phase 3"]', projectName);
    await page.fill('textarea[placeholder*="Brief overview"]', "Objectives");
    await selectDropdown(page, "Department", "Security Operations Center");
    await selectDropdown(page, "Client / Customer", "Acme Financial Services");
    await selectDropdown(page, "Primary PM", "John Smith");
    await pickDate(page, "Start Date", "30", 0);
    await pickDate(page, "End Date", "15", 2); // 2 months duration
    await page.fill('input[name="value"]', "50000");

    // 4. Fill Milestone section
    const milestoneSection = page.locator('section:has-text("Milestones")');
    await milestoneSection.locator('input[placeholder="e.g. Phase 1 sign-off"]').fill("Architecture Design");
    // Target date must be within project duration: start=Jul 30 + 15 days = Aug 14
    const projectStartDate = new Date();
    projectStartDate.setDate(30); // Jul 30 (current month)
    const targetDate = new Date(projectStartDate);
    targetDate.setDate(targetDate.getDate() + 15); // +15 days = Aug 14
    const dateStr = targetDate.toISOString().slice(0, 10);
    await milestoneSection.locator('input[type="date"]').fill(dateStr);
    await milestoneSection.locator('input[type="number"]').fill("15");
    await milestoneSection.locator('button:has-text("Add")').click();
    // Confirm milestone was added (no error shown)
    await expect(milestoneSection.locator('text="Architecture Design"')).toBeVisible({ timeout: 3000 });

    // 5. Submit Form
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.locator("body")).toContainText("Project created");

    // 6. Verify DB has project and milestone
    const projRes = await dbClient.query("SELECT id FROM projects WHERE name = $1 LIMIT 1", [projectName]);
    expect(projRes.rows.length).toBe(1);
    const projectId = projRes.rows[0].id;

    const msRes = await dbClient.query("SELECT * FROM project_milestones WHERE project_id = $1 LIMIT 1", [projectId]);
    expect(msRes.rows.length).toBe(1);
    expect(msRes.rows[0].title).toBe("Architecture Design");
    expect(Number(msRes.rows[0].weight)).toBe(15);
  });

  test("TC-M1.1-04: Mandatory-field validation enforced (Negative)", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");
    const permissionsResponsePromise4 = page.waitForResponse(
      (res) => res.url().includes("/auth/me/permissions") && res.status() === 200,
      { timeout: 60000 }
    );
    await page.goto("/en/dashboard/projects");
    await permissionsResponsePromise4;
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    await expect(page.locator('text="Loading projects..."')).toBeHidden({ timeout: 30000 });

    // 2. Open sheet
    await page.locator('button:has-text("New Project")').click();

    // 3. Directly submit form without filling mandatory fields
    await page.click('button[type="submit"]:has-text("Create Project")');

    // 4. Verify client-side error notifications on name
    await expect(page.locator("body")).toContainText("Name is required");
  });

  test("TC-M1.2-02: Invalid dates rejected (Negative)", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");
    const permissionsResponsePromise5 = page.waitForResponse(
      (res) => res.url().includes("/auth/me/permissions") && res.status() === 200,
      { timeout: 60000 }
    );
    await page.goto("/en/dashboard/projects");
    await permissionsResponsePromise5;
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    await expect(page.locator('text="Loading projects..."')).toBeHidden({ timeout: 30000 });

    // 2. Open sheet
    await page.locator('button:has-text("New Project")').click();

    // 3. Fill name and other fields
    await page.fill('input[placeholder="e.g. ERP Migration Phase 3"]', "Invalid Date Project");
    await page.fill('textarea[placeholder*="Brief overview"]', "Objectives");
    await selectDropdown(page, "Department", "Security Operations Center");
    await selectDropdown(page, "Client / Customer", "Acme Financial Services");
    await selectDropdown(page, "Primary PM", "John Smith");

    // 4. Pick valid Start (next month day 15) and End (next month day 20)
    await pickDate(page, "Start Date", "15", 1); // Start = Aug 15
    await pickDate(page, "End Date", "20", 1);   // End = Aug 20 (valid — after start)

    // 5. Re-pick Start Date to day 25 (AFTER end date Aug 20) to force end < start
    await pickDate(page, "Start Date", "25", 1); // Start = Aug 25 > End Aug 20

    // 6. Submit — Zod refine: endDate(Aug20) < startDate(Aug25) → error
    await page.click('button[type="submit"]:has-text("Create Project")');

    // 7. Verify validation message
    await expect(page.locator("body")).toContainText("End date must be after start date");
  });

  // test("TC-M1.6-06 & UI Login: Super Admin Emergency Login", async ({ page }) => {
  //   // 1. Perform UI login using Emergency Login form
  //   await loginViaEmergencyForm(
  //     page,
  //     "bminilik12@gmail.com",
  //     "cybsec-emergency-vault-secret-2026",
  //     "E2E automated testing session"
  //   );

  //   // 2. Verify dashboard header displays correctly
  //   await expect(page.locator("h1")).toContainText("Welcome back");
  //   await expect(page.locator("body")).toContainText("roba belachew");
  // });
});
