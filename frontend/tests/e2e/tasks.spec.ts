import { test, expect } from "@playwright/test";
import { loginViaSessionInjection } from "../helpers/auth";
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
  await expect(popup).toBeHidden({ timeout: 5000 });
  await expect(trigger).toHaveAttribute("aria-expanded", "false", { timeout: 3000 });
}

async function pickDateInTaskSheet(page: any, label: string, day: string, goNextMonths = 0) {
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

  const calendar = page.locator('[data-slot="calendar"]');
  await expect(calendar).toBeVisible({ timeout: 8000 });

  for (let i = 0; i < goNextMonths; i++) {
    await page.locator('[data-slot="calendar"] button').filter({ has: page.locator('svg.lucide-chevron-right') }).first().click();
    await page.waitForTimeout(200);
  }

  const dayBtn = calendar
    .locator('button:not([disabled]):not([aria-disabled="true"])')
    .filter({ hasText: new RegExp(`^${day}$`) })
    .first();
  await expect(dayBtn).toBeVisible({ timeout: 5000 });
  await dayBtn.click();
  
  // Close the date picker popover programmatically in tests
  await page.keyboard.press("Escape");
  await expect(calendar).toBeHidden({ timeout: 3000 });
  await page.waitForTimeout(200);
}

test.describe("Task Management, Progress Updates and PM Approval Flows", () => {
  let dbClient: any;
  let pmId: string;
  let pmEmail = "john.pm@bminilik12gmail.onmicrosoft.com";
  let engId: string;
  let engEmail = "briannguyen@bminilik12gmail.onmicrosoft.com";
  let projectId: string;
  let phaseId: string;

  test.beforeAll(async () => {
    dbClient = await getDbClient();

    // 1. Fetch user IDs
    const pmRes = await dbClient.query("SELECT id FROM users WHERE email = $1", [pmEmail]);
    pmId = pmRes.rows[0].id;

    const engRes = await dbClient.query("SELECT id FROM users WHERE email = $1", [engEmail]);
    engId = engRes.rows[0].id;

    // Fetch department and customer
    const deptRes = await dbClient.query("SELECT id FROM departments WHERE code = $1", ["SOC"]);
    const deptId = deptRes.rows[0].id;

    const custRes = await dbClient.query("SELECT id FROM customers WHERE company_name = $1", ["Acme Financial Services"]);
    const custId = custRes.rows[0].id;

    // 2. Insert test project
    projectId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO projects (id, name, objective, department_id, customer_id, engagement_type, billing_model, start_date, end_date, value, currency, primary_pm_id, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'Managed Service', 'Fixed Price', NOW(), NOW() + INTERVAL '3 months', 100000, 'USD', $6, 'Active', $7, NOW(), NOW())`,
      [projectId, `E2E Task flow Project - ${Date.now()}`, "Task flow objective", deptId, custId, pmId, pmId]
    );

    // 3. Insert test project phase
    phaseId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO project_phases (id, project_id, name, description, start_date, end_date, status, order_index, created_at, updated_at)
       VALUES ($1, $2, 'Design Phase', 'System Architecture Design', NOW(), NOW() + INTERVAL '1 month', 'Planned', 0, NOW(), NOW())`,
      [phaseId, projectId]
    );

    // 4. Allocate Brian Nguyen to project
    const empRes = await dbClient.query("SELECT id FROM employees WHERE keka_employee_id = $1", ["MOCK-KEKA-001"]);
    const employeeId = empRes.rows[0].id;
    await dbClient.query(
      `INSERT INTO allocations (id, employee_id, project_id, role, hours, percent, start_date, end_date, status, approved_by, created_at)
       VALUES ($1, $2, $3, 'Engineer', 40, 100, NOW(), NOW() + INTERVAL '3 months', 'Active', $4, NOW())`,
      [crypto.randomUUID(), employeeId, projectId, pmId]
    );
  });

  test.afterAll(async () => {
    if (dbClient) {
      // Clean up project, phases, tasks, allocations
      await dbClient.query("DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)", [projectId]);
      await dbClient.query("DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)", [projectId]);
      await dbClient.query("DELETE FROM task_dependencies WHERE predecessor_id IN (SELECT id FROM tasks WHERE project_id = $1) OR successor_id IN (SELECT id FROM tasks WHERE project_id = $1)", [projectId]);
      await dbClient.query("DELETE FROM task_progress_updates WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)", [projectId]);
      await dbClient.query("DELETE FROM tasks WHERE project_id = $1", [projectId]);
      await dbClient.query("DELETE FROM allocations WHERE project_id = $1", [projectId]);
      await dbClient.query("DELETE FROM project_phases WHERE project_id = $1", [projectId]);
      await dbClient.query("DELETE FROM projects WHERE id = $1", [projectId]);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
  });

  test("TC-M1.3-01 & TC-M1.3-03: PM creates task, sub-task, and comment", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, pmEmail);

    // 2. Go directly to project detail page — wait for permissions and phases to load
    const permissionsPromise = page.waitForResponse(
      (res) => res.url().includes("/auth/me/permissions") && res.status() === 200,
      { timeout: 60000 }
    );
    const phasesPromise = page.waitForResponse(
      (res) => res.url().includes("/phases") && res.status() === 200,
      { timeout: 60000 }
    );
    await page.goto(`/en/dashboard/projects/${projectId}`);
    await permissionsPromise;
    await phasesPromise;
    await page.waitForLoadState("networkidle", { timeout: 30000 });

    // 3. Click Add Task button
    await page.locator('button:has-text("Add Task")').click();

    // 4. Fill main details
    const taskTitle = "Implement E2E Test Suite";
    await page.fill('input[placeholder="Task title..."]', taskTitle);
    await page.fill('textarea[placeholder="Add a description..."]', "Implement all E2E specs for UAT flow");
    
    // Select priority
    await selectDropdown(page, "Priority", "High");

    // Select assignee: Brian Nguyen
    await selectDropdown(page, "Assignee", "Brian Nguyen");

    // Select phase: Design Phase
    await selectDropdown(page, "Phase", "Design Phase");

    // Fill effort hours
    await page.fill('input[placeholder="Optional"]', "40");

    // Add sub-task in sheet side-tab
    await page.locator('button:has-text("Subtasks")').click();
    await page.fill('input[placeholder="Sub-task title..."]', "Setup Playwright config");
    await page.click('button:has-text("Add to list")');

    // Add comment in comments tab
    await page.locator('button:has-text("Comments")').click();
    await page.fill('textarea[placeholder="Write a comment..."]', "Staged comment during creation");
    await page.click('button:has-text("Add to list")');

    // Pick dates: Start Date (today), Due Date (next month, 15)
    await pickDateInTaskSheet(page, "Start date *", "30", 0);
    await pickDateInTaskSheet(page, "Due date *", "15", 1);

    // Submit
    await page.click('button[type="submit"]:has-text("Create Task")');

    // Verify task created toaster
    await expect(page.locator("body")).toContainText("Task created");

    // Verify task is in the database
    const taskRes = await dbClient.query("SELECT * FROM tasks WHERE project_id = $1 AND title = $2 LIMIT 1", [projectId, taskTitle]);
    expect(taskRes.rows.length).toBe(1);
    const taskId = taskRes.rows[0].id;

    // Verify sub-task created
    const subRes = await dbClient.query("SELECT * FROM tasks WHERE parent_task_id = $1 LIMIT 1", [taskId]);
    expect(subRes.rows.length).toBe(1);
    expect(subRes.rows[0].title).toBe("Setup Playwright config");

    // Verify comment created
    const commRes = await dbClient.query("SELECT * FROM task_comments WHERE task_id = $1 LIMIT 1", [taskId]);
    expect(commRes.rows.length).toBe(1);
    expect(commRes.rows[0].body).toBe("Staged comment during creation");
  });

  test("TC-M1.4-01 & TC-M1.4-02: Engineer progress update and PM approval", async ({ page }) => {
    // 1. Setup: PM creates a task directly in DB to guarantee a fresh task for progress update
    const taskId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, owner_id, start_date, end_date, effort_hours, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'Medium', $6, NOW(), NOW() + INTERVAL '7 days', 20, 'In Progress', NOW(), NOW())`,
      [taskId, projectId, phaseId, "Code implementation", "Write core auth models", engId]
    );

    // 2. Log in as Engineer
    await loginViaSessionInjection(page, engEmail);
    await page.goto(`/en/dashboard/projects/${projectId}`);

    // 3. Open task details panel by clicking task
    await page.locator(`button:has-text("Code implementation")`).first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();

    // 4. Fill progress fields
    const progressSection = page.locator('div:has-text("Progress & review")');
    await page.locator('label').filter({ hasText: "Cumulative progress %" }).locator('xpath=..').locator('input').fill("60");
    await page.fill('input[placeholder="e.g. 8"]', "12");
    await page.fill('textarea[placeholder*="blockers"]', "Finished authentication flow");
    
    // Submit progress
    await page.click('button:has-text("Submit for review")');
    await expect(page.locator("body")).toContainText("Progress submitted for PM review");

    // Verify DB update is in 'Pending' state
    const updateRes = await dbClient.query(
      "SELECT * FROM task_progress_updates WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1",
      [taskId]
    );
    expect(updateRes.rows.length).toBe(1);
    expect(updateRes.rows[0].status).toBe("Pending");
    expect(Number(updateRes.rows[0].progress_percent)).toBe(60);

    // 5. Log in as PM to approve
    await loginViaSessionInjection(page, pmEmail);
    await page.goto(`/en/dashboard/projects/${projectId}`);

    // Open task details panel as PM
    await page.locator(`button:has-text("Code implementation")`).first().click();

    // Review progress section
    await page.fill('textarea[placeholder="Explain your decision…"]', "Nice progress, approved");
    await page.locator('div:has(textarea[placeholder="Explain your decision…"]) button:has-text("Approve")').first().click();
    await expect(page.locator("body")).toContainText("Progress approved");

    // Verify DB states: task status is In Progress (since progress is 60% < 100%), progressApproved is 60
    const taskFinalRes = await dbClient.query("SELECT status, progress_approved FROM tasks WHERE id = $1", [taskId]);
    expect(taskFinalRes.rows[0].status).toBe("In Progress");
    expect(Number(taskFinalRes.rows[0].progress_approved)).toBe(60);
  });
});
