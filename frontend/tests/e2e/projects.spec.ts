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

  let scope = page.locator('[role="dialog"]:visible');
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

  let scope = page.locator('[role="dialog"]:visible');
  if (await scope.count() === 0) {
    scope = page.locator('body');
  }

  const labelEl = scope.locator('label').filter({ hasText: label }).first();
  let container = labelEl.locator('xpath=..');
  const isFlex = await container.evaluate((el: any) => el.classList.contains('flex') || el.className.includes('flex')).catch(() => false);
  if (isFlex) {
    container = container.locator('xpath=..');
  }

  // Re-locate fresh to avoid stale context after DOM modifications
  await container.locator('button').first().scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await container.locator('button').first().click();

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

async function ensureListView(page: any) {
  const listViewBtn = page.locator('button:has(svg.lucide-list)');
  await expect(listViewBtn).toBeVisible({ timeout: 15000 });
  await listViewBtn.click();
  await page.waitForTimeout(200);
}

test.describe("Project Management (Foundation Phase)", () => {
  let dbClient: any;
  let bobPmId: string;

  test.beforeAll(async () => {
    dbClient = await getDbClient();

    // 1. Fetch pm role ID and insert PM Bob so we have a secondary PM for TC-M1.1-02
    const pmRoleRes = await dbClient.query("SELECT id FROM roles WHERE code = 'pm' LIMIT 1");
    const pmRoleId = pmRoleRes.rows[0].id;

    bobPmId = crypto.randomUUID();
    const insertRes = await dbClient.query(
      `INSERT INTO users (id, email, display_name, role_id, is_active, is_external, entra_object_id, created_at, updated_at)
       VALUES ($1, 'bob.pm@bminilik12gmail.onmicrosoft.com', 'PM Bob', $2, true, false, $3, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET display_name = 'PM Bob'
       RETURNING id`,
      [bobPmId, pmRoleId, crypto.randomUUID()]
    );
    bobPmId = insertRes.rows[0].id;

    // 2. Ensure Department 'IT' exists
    await dbClient.query(
      `INSERT INTO departments (id, code, name, is_active, created_at)
       VALUES ($1, 'IT', 'Information Technology', true, NOW())
       ON CONFLICT (code) DO NOTHING`,
      [crypto.randomUUID()]
    );

    // 3. Ensure Customer 'CUST-101' exists
    await dbClient.query(
      `INSERT INTO customers (id, type, display_name, company_name, industry, country, primary_email, status, created_at, updated_at)
       VALUES ($1, 'Company', 'CUST-101', 'CUST-101', 'IT Services', 'USA', 'cust101@example.com', 'Active', NOW(), NOW())
       ON CONFLICT (primary_email) DO NOTHING`,
      [crypto.randomUUID()]
    );

    // 4. Pre-clean any existing Project Titan to avoid name collisions
    await dbClient.query("DELETE FROM project_milestones WHERE project_id IN (SELECT id FROM projects WHERE name = 'Project Titan')");
    await dbClient.query("DELETE FROM projects WHERE name = 'Project Titan'");
  });

  test.afterAll(async () => {
    if (dbClient) {
      // Clean up PM Bob and any test projects and tasks created during testing
      await dbClient.query("DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %'))");
      await dbClient.query("DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %'))");
      await dbClient.query("DELETE FROM task_dependencies WHERE predecessor_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %')) OR successor_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %'))");
      await dbClient.query("DELETE FROM task_progress_updates WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %'))");
      await dbClient.query("DELETE FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %')");
      await dbClient.query("DELETE FROM allocations WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %')");
      await dbClient.query("DELETE FROM project_phases WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %')");
      await dbClient.query("DELETE FROM project_milestones WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'Project %')");
      await dbClient.query("DELETE FROM projects WHERE name LIKE 'Project %'");
      await dbClient.query("DELETE FROM users WHERE email = $1", ["bob.pm@bminilik12gmail.onmicrosoft.com"]);
      await dbClient.query("DELETE FROM departments WHERE code = 'IT'");
      await dbClient.query("DELETE FROM customers WHERE primary_email = 'cust101@example.com'");
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test("TC-M1.1-01: Titan Create", async ({ page }) => {
    // 1. Log in as PM using Session Injection
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");

    // 2. Go to projects list page and wait for layout hydration by checking the button visibility
    await page.goto("/en/dashboard/projects");
    await expect(page.locator('button:has-text("New Project")')).toBeVisible({ timeout: 45000 });

    // 3. Open project creation sheet
    await page.locator('button:has-text("New Project")').click();

    // 4. Fill in Overview details
    const projectName = "Project Titan";
    await page.fill('input[placeholder="e.g. ERP Migration Phase 3"]', projectName);
    await page.fill('textarea[placeholder*="Brief overview"]', "Upgrade Core");
    
    // Select Department: Information Technology
    await selectDropdown(page, "Department", "Information Technology");

    // Select Client: CUST-101
    await selectDropdown(page, "Client / Customer", "CUST-101");

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
    expect(dbRes.rows[0].objective).toBe("Upgrade Core");
    expect(Number(dbRes.rows[0].value)).toBe(120000);

    // 8. Verify Audit Logs
    const auditRes = await dbClient.query(
      "SELECT * FROM audit_logs WHERE object_type = 'Project' AND object_id = $1 AND action = 'CREATE_PROJECT' LIMIT 1",
      [dbRes.rows[0].id]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].new_value).toBeDefined();
    expect(auditRes.rows[0].new_value.name).toBe("Project Titan");
  });

  test("TC-M1.1-02: Assign PMs", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");

    // 2. Go to projects list page
    await page.goto("/en/dashboard/projects");
    await expect(page.locator('button:has-text("New Project")')).toBeVisible({ timeout: 45000 });

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

    // Select Secondary PM: PM Bob
    await selectDropdown(page, "Secondary PM", "PM Bob");

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
    expect(dbRes.rows[0].secondary_pm_id).toBe(bobPmId);

    // 7. Verify Audit Logs
    const auditRes = await dbClient.query(
      "SELECT * FROM audit_logs WHERE object_type = 'Project' AND object_id = $1 AND action = 'CREATE_PROJECT' LIMIT 1",
      [dbRes.rows[0].id]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].new_value).toBeDefined();
    expect(auditRes.rows[0].new_value.primaryPmId).toBe(pmId);
    expect(auditRes.rows[0].new_value.secondaryPmId).toBe(bobPmId);
  });

  test("TC-M1.1-03: Milestones", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");

    // 2. Go to projects list page
    await page.goto("/en/dashboard/projects");
    await expect(page.locator('button:has-text("New Project")')).toBeVisible({ timeout: 45000 });

    // 3. Open project creation sheet
    await page.locator('button:has-text("New Project")').click();

    // 4. Fill basic fields
    const projectName = `Project Milestones - ${Date.now()}`;
    await page.fill('input[placeholder="e.g. ERP Migration Phase 3"]', projectName);
    await page.fill('textarea[placeholder*="Brief overview"]', "Objectives");
    await selectDropdown(page, "Department", "Security Operations Center");
    await selectDropdown(page, "Client / Customer", "Acme Financial Services");
    await selectDropdown(page, "Primary PM", "John Smith");
    await pickDate(page, "Start Date", "30", 0);
    await pickDate(page, "End Date", "15", 2); // 2 months duration
    await page.fill('input[name="value"]', "50000");
    await selectDropdown(page, "Engagement Type", "Fixed Price");
    await selectDropdown(page, "Billing Model", "Fixed Price");

    // 5. Fill Milestone section
    await page.click('button:has-text("Add Milestones")');
    const milestoneSection = page.locator('section:has-text("Milestones")');
    await milestoneSection.locator('input[placeholder="e.g. Phase 1 sign-off"]').fill("Architecture Design");
    
    // Pick milestone target date: Aug 15 (which is next month, day 15)
    await pickDate(page, "Target date", "15", 1);
    
    await milestoneSection.locator('input[type="number"]').fill("15");
    await milestoneSection.locator('button:has-text("Add")').click();
    // Confirm milestone was added (no error shown)
    await expect(milestoneSection.locator('text="Architecture Design"')).toBeVisible({ timeout: 3000 });

    // 6. Submit Form
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.locator("body")).toContainText("Project created");

    // 7. Verify DB has project and milestone
    const projRes = await dbClient.query("SELECT id FROM projects WHERE name = $1 LIMIT 1", [projectName]);
    expect(projRes.rows.length).toBe(1);
    const projectId = projRes.rows[0].id;

    const msRes = await dbClient.query("SELECT * FROM project_milestones WHERE project_id = $1 LIMIT 1", [projectId]);
    expect(msRes.rows.length).toBe(1);
    expect(msRes.rows[0].title).toBe("Architecture Design");
    expect(Number(msRes.rows[0].weight)).toBe(15);

    // 8. Verify Audit Logs
    const auditRes = await dbClient.query(
      "SELECT * FROM audit_logs WHERE object_type = 'Project' AND object_id = $1 AND action = 'CREATE_PROJECT' LIMIT 1",
      [projectId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].new_value).toBeDefined();
    expect(auditRes.rows[0].new_value.name).toBe(projectName);
  });

  test("TC-M1.1-04: Mandatory Fields", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");

    // 2. Go to projects list page
    await page.goto("/en/dashboard/projects");
    await expect(page.locator('button:has-text("New Project")')).toBeVisible({ timeout: 45000 });

    // 3. Open sheet
    await page.locator('button:has-text("New Project")').click();

    // 4. Directly submit form without filling mandatory fields
    await page.click('button[type="submit"]:has-text("Create Project")');

    // 5. Verify client-side error notifications on name
    await expect(page.locator("body")).toContainText("Name is required");

    // 6. Verify no state changes or database writes occurred in database and audit trail
    const dbRes = await dbClient.query("SELECT * FROM projects WHERE name = '' OR name IS NULL");
    expect(dbRes.rows.length).toBe(0);

    const auditRes = await dbClient.query(
      "SELECT * FROM audit_logs WHERE action = 'CREATE_PROJECT' AND (new_value->>'name' = '' OR new_value->>'name' IS NULL)"
    );
    expect(auditRes.rows.length).toBe(0);
  });

  test("TC-M1.1-05: Status on Creation", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");

    // 2. Go to projects list page
    await page.goto("/en/dashboard/projects");
    await expect(page.locator('button:has-text("New Project")')).toBeVisible({ timeout: 45000 });

    // 3. Open project creation sheet
    await page.locator('button:has-text("New Project")').click();

    // 4. Fill in details (status defaults to Draft)
    const projectName = `Project Status Creation - ${Date.now()}`;
    await page.fill('input[placeholder="e.g. ERP Migration Phase 3"]', projectName);
    await page.fill('textarea[placeholder*="Brief overview"]', "Status Set on Creation");
    await selectDropdown(page, "Department", "Information Technology");
    await selectDropdown(page, "Client / Customer", "CUST-101");
    await selectDropdown(page, "Primary PM", "John Smith");
    await pickDate(page, "Start Date", "30", 0);
    await page.waitForTimeout(800);
    await pickDate(page, "End Date", "15", 1);
    await page.fill('input[name="value"]', "90000");
    await selectDropdown(page, "Engagement Type", "Fixed Price");
    await selectDropdown(page, "Billing Model", "Fixed Price");

    // 5. Submit Form
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.locator("body")).toContainText("Project created");

    // 6. Verify DB has status Draft
    const dbRes = await dbClient.query("SELECT * FROM projects WHERE name = $1 LIMIT 1", [projectName]);
    expect(dbRes.rows.length).toBe(1);
    expect(dbRes.rows[0].status).toBe("Draft");

    // 7. Verify Audit Log
    const auditRes = await dbClient.query(
      "SELECT * FROM audit_logs WHERE object_type = 'Project' AND object_id = $1 AND action = 'CREATE_PROJECT' LIMIT 1",
      [dbRes.rows[0].id]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].new_value.status).toBe("Draft");
  });

  test("TC-M1.1-06: Exception Handling", async ({ page }) => {
    // 1. Log in as PM
    const session = await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1";

    // 2. Direct API call bypassing frontend to create project with invalid status "Active"
    const res = await page.request.post(`${apiUrl}/projects`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
      },
      data: {
        name: "Exception Bypass Project",
        objective: "Objective",
        status: "Active", // Invalid status on creation (only Draft allowed)
        value: 120000,
        engagementType: "FixedPrice",
        billingModel: "FixedPrice",
      },
    });

    // Expect NestJS to reject with 422 Unprocessable Entity
    expect(res.status()).toBe(422);

    // 3. Verify no DB writes occurred
    const dbRes = await dbClient.query("SELECT * FROM projects WHERE name = 'Exception Bypass Project'");
    expect(dbRes.rows.length).toBe(0);

    // 4. Verify no audit trail logs exist
    const auditRes = await dbClient.query(
      "SELECT * FROM audit_logs WHERE action = 'CREATE_PROJECT' AND new_value->>'name' = 'Exception Bypass Project'"
    );
    expect(auditRes.rows.length).toBe(0);
  });

  test("TC-M1.2-01: Supported States", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");

    // 2. Go to projects list page
    await page.goto("/en/dashboard/projects");
    await expect(page.locator('button:has-text("New Project")')).toBeVisible({ timeout: 45000 });

    // 3. Create a project in Draft (default)
    await page.locator('button:has-text("New Project")').click();
    const projectName = `Project State Transitions - ${Date.now()}`;
    await page.fill('input[placeholder="e.g. ERP Migration Phase 3"]', projectName);
    await page.fill('textarea[placeholder*="Brief overview"]', "Status transition checking");
    await selectDropdown(page, "Department", "Information Technology");
    await selectDropdown(page, "Client / Customer", "CUST-101");
    await selectDropdown(page, "Primary PM", "John Smith");
    await pickDate(page, "Start Date", "30", 0);
    await pickDate(page, "End Date", "15", 1);
    await page.fill('input[name="value"]', "70000");
    await selectDropdown(page, "Engagement Type", "Fixed Price");
    await selectDropdown(page, "Billing Model", "Fixed Price");
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.locator("body")).toContainText("Project created");

    // Ensure list view is active
    await ensureListView(page);

    // Wait for row
    const row = page.locator("tr").filter({ hasText: projectName });
    await expect(row).toBeVisible({ timeout: 15000 });

    const dbRes = await dbClient.query("SELECT id FROM projects WHERE name = $1 LIMIT 1", [projectName]);
    const projectId = dbRes.rows[0].id;

    // Draft -> Active
    await row.locator("button").last().click();
    await page.locator('[role="menuitem"]:has-text("Edit")').click();
    await selectDropdown(page, "Status", "Active");
    let responsePromise = page.waitForResponse(
      (res) => res.url().includes(`/projects/${projectId}`) && res.status() === 200
    );
    await page.click('button[type="submit"]:has-text("Save Changes")');
    await responsePromise;
    await expect(page.locator("body")).toContainText("Project updated successfully!");

    let statusCheck = await dbClient.query("SELECT status FROM projects WHERE id = $1", [projectId]);
    expect(statusCheck.rows[0].status).toBe("Active");

    // Active -> OnHold
    await row.locator("button").last().click();
    await page.locator('[role="menuitem"]:has-text("Edit")').click();
    await selectDropdown(page, "Status", "On Hold");
    responsePromise = page.waitForResponse(
      (res) => res.url().includes(`/projects/${projectId}`) && res.status() === 200
    );
    await page.click('button[type="submit"]:has-text("Save Changes")');
    await responsePromise;
    await expect(page.locator("body")).toContainText("Project updated successfully!");

    statusCheck = await dbClient.query("SELECT status FROM projects WHERE id = $1", [projectId]);
    expect(statusCheck.rows[0].status).toBe("On Hold");

    // OnHold -> Active
    await row.locator("button").last().click();
    await page.locator('[role="menuitem"]:has-text("Edit")').click();
    await selectDropdown(page, "Status", "Active");
    responsePromise = page.waitForResponse(
      (res) => res.url().includes(`/projects/${projectId}`) && res.status() === 200
    );
    await page.click('button[type="submit"]:has-text("Save Changes")');
    await responsePromise;
    await expect(page.locator("body")).toContainText("Project updated successfully!");

    statusCheck = await dbClient.query("SELECT status FROM projects WHERE id = $1", [projectId]);
    expect(statusCheck.rows[0].status).toBe("Active");

    // Active -> PendingClosure
    await row.locator("button").last().click();
    await page.locator('[role="menuitem"]:has-text("Edit")').click();
    await selectDropdown(page, "Status", "Pending Closure");
    responsePromise = page.waitForResponse(
      (res) => res.url().includes(`/projects/${projectId}`) && res.status() === 200
    );
    await page.click('button[type="submit"]:has-text("Save Changes")');
    await responsePromise;
    await expect(page.locator("body")).toContainText("Project updated successfully!");

    statusCheck = await dbClient.query("SELECT status FROM projects WHERE id = $1", [projectId]);
    expect(statusCheck.rows[0].status).toBe("Pending Closure");
  });

  test("TC-M1.2-02: Invalid Dates", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");

    // 2. Go to projects list page
    await page.goto("/en/dashboard/projects");
    await expect(page.locator('button:has-text("New Project")')).toBeVisible({ timeout: 45000 });

    // 3. Open sheet
    await page.locator('button:has-text("New Project")').click();

    // 4. Fill name and other fields
    await page.fill('input[placeholder="e.g. ERP Migration Phase 3"]', "Invalid Date Project");
    await page.fill('textarea[placeholder*="Brief overview"]', "Objectives");
    await selectDropdown(page, "Department", "Security Operations Center");
    await selectDropdown(page, "Client / Customer", "Acme Financial Services");
    await selectDropdown(page, "Primary PM", "John Smith");

    // 5. Fill required Budget/Type fields to isolate date error
    await page.fill('input[name="value"]', "80000");
    await selectDropdown(page, "Engagement Type", "Fixed Price");
    await selectDropdown(page, "Billing Model", "Fixed Price");

    // 6. Pick valid Start (next month day 15) and End (next month day 20)
    await pickDate(page, "Start Date", "15", 1); // Start = Aug 15
    await pickDate(page, "End Date", "20", 1);   // End = Aug 20 (valid — after start)

    // 7. Re-pick Start Date to day 25 (AFTER end date Aug 20) to force end < start
    await pickDate(page, "Start Date", "25", 1); // Start = Aug 25 > End Aug 20

    // 8. Submit — Zod refine: endDate(Aug20) < startDate(Aug25) → error
    await page.click('button[type="submit"]:has-text("Create Project")');

    // 9. Verify validation message
    await expect(page.locator("body")).toContainText("End date must be after start date");

    // 10. Verify no state changes or database writes occurred in database and audit trail
    const dbRes = await dbClient.query("SELECT * FROM projects WHERE name = 'Invalid Date Project'");
    expect(dbRes.rows.length).toBe(0);

    const auditRes = await dbClient.query(
      "SELECT * FROM audit_logs WHERE action = 'CREATE_PROJECT' AND new_value->>'name' = 'Invalid Date Project'"
    );
    expect(auditRes.rows.length).toBe(0);
  });

  test("TC-M1.2-03: Missing Owners", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");

    // 2. Go to projects list page
    await page.goto("/en/dashboard/projects");
    await expect(page.locator('button:has-text("New Project")')).toBeVisible({ timeout: 45000 });

    // 3. Open sheet
    await page.locator('button:has-text("New Project")').click();

    // 4. Fill details but leave Primary PM unselected
    await page.fill('input[placeholder="e.g. ERP Migration Phase 3"]', "Missing Owner Project");
    await page.fill('textarea[placeholder*="Brief overview"]', "Objectives");
    await selectDropdown(page, "Department", "Security Operations Center");
    await selectDropdown(page, "Client / Customer", "Acme Financial Services");

    // Do NOT select Primary PM
    await pickDate(page, "Start Date", "15", 1);
    await pickDate(page, "End Date", "20", 1);
    await page.fill('input[name="value"]', "80000");
    await selectDropdown(page, "Engagement Type", "Fixed Price");
    await selectDropdown(page, "Billing Model", "Fixed Price");

    // 5. Submit
    await page.click('button[type="submit"]:has-text("Create Project")');

    // 6. Verify validation message
    await expect(page.locator("body")).toContainText("Please assign a primary PM");

    // 7. Verify no database writes occurred
    const dbRes = await dbClient.query("SELECT * FROM projects WHERE name = 'Missing Owner Project'");
    expect(dbRes.rows.length).toBe(0);

    const auditRes = await dbClient.query(
      "SELECT * FROM audit_logs WHERE action = 'CREATE_PROJECT' AND new_value->>'name' = 'Missing Owner Project'"
    );
    expect(auditRes.rows.length).toBe(0);
  });

  test("TC-M1.2-04: Audited Status", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, "john.pm@bminilik12gmail.onmicrosoft.com");

    // 2. Go to projects list page
    await page.goto("/en/dashboard/projects");
    await expect(page.locator('button:has-text("New Project")')).toBeVisible({ timeout: 45000 });

    // 3. Create a project in Draft (default)
    await page.locator('button:has-text("New Project")').click();
    const projectName = `Project Status Auditing - ${Date.now()}`;
    await page.fill('input[placeholder="e.g. ERP Migration Phase 3"]', projectName);
    await page.fill('textarea[placeholder*="Brief overview"]', "Status transition checking for audit log");
    await selectDropdown(page, "Department", "Information Technology");
    await selectDropdown(page, "Client / Customer", "CUST-101");
    await selectDropdown(page, "Primary PM", "John Smith");
    await pickDate(page, "Start Date", "30", 0);
    await pickDate(page, "End Date", "15", 1);
    await page.fill('input[name="value"]', "70000");
    await selectDropdown(page, "Engagement Type", "Fixed Price");
    await selectDropdown(page, "Billing Model", "Fixed Price");
    await page.click('button[type="submit"]:has-text("Create Project")');
    await expect(page.locator("body")).toContainText("Project created");

    // Ensure list view is active
    await ensureListView(page);

    // Wait for row
    const row = page.locator("tr").filter({ hasText: projectName });
    await expect(row).toBeVisible({ timeout: 15000 });

    const dbRes = await dbClient.query("SELECT id FROM projects WHERE name = $1 LIMIT 1", [projectName]);
    const projectId = dbRes.rows[0].id;

    // Transition: Draft -> Active
    await row.locator("button").last().click();
    await page.locator('[role="menuitem"]:has-text("Edit")').click();
    await selectDropdown(page, "Status", "Active");
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes(`/projects/${projectId}`) && res.status() === 200
    );
    await page.click('button[type="submit"]:has-text("Save Changes")');
    await responsePromise;
    await expect(page.locator("body")).toContainText("Project updated successfully!");

    // Verify DB
    const statusCheck = await dbClient.query("SELECT status FROM projects WHERE id = $1", [projectId]);
    expect(statusCheck.rows[0].status).toBe("Active");

    // Verify Audit Logs show transition Draft -> Active
    const auditRes = await dbClient.query(
      "SELECT * FROM audit_logs WHERE object_type = 'Project' AND object_id = $1 AND action = 'PROJECT_STATUS_CHANGED' ORDER BY created_at DESC LIMIT 1",
      [projectId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].new_value).toBeDefined();
    expect(auditRes.rows[0].new_value.statusTransition).toBeDefined();
    expect(auditRes.rows[0].new_value.statusTransition.from).toBe("Draft");
    expect(auditRes.rows[0].new_value.statusTransition.to).toBe("Active");
  });
});
