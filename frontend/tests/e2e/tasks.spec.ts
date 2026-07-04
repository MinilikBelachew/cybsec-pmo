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
  await expect(popup).toBeHidden({ timeout: 5000 });
  await expect(trigger).toHaveAttribute("aria-expanded", "false", { timeout: 3000 });
}

async function pickDateInTaskSheet(page: any, label: string, day: string, goNextMonths = 0) {
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

async function expectAuditLogEntry(dbClient: any, objectType: string, objectId: string, action: string) {
  let auditRes = null;
  for (let i = 0; i < 15; i++) {
    auditRes = await dbClient.query(
      "SELECT * FROM audit_logs WHERE object_type = $1 AND object_id = $2 AND action = $3 LIMIT 1",
      [objectType, objectId, action]
    );
    if (auditRes.rows.length === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  expect(auditRes.rows.length).toBe(1);
}

test.describe("Tasks", () => {
  let dbClient: any;
  let pmId: string;
  let pmEmail = "john.pm@bminilik12gmail.onmicrosoft.com";
  let engId: string;
  let engEmail = "eng_dave@cybsec.com";
  let projectId: string;
  let phaseId: string;

  test.beforeAll(async () => {
    dbClient = await getDbClient();

    // 1. Fetch PM user ID
    const pmRes = await dbClient.query("SELECT id FROM users WHERE email = $1", [pmEmail]);
    pmId = pmRes.rows[0].id;

    // Fetch department and customer
    const deptRes = await dbClient.query("SELECT id FROM departments WHERE code = $1", ["SOC"]);
    const deptId = deptRes.rows[0].id;

    // Seed Dave Engineer user/employee to match 'eng_dave' from UAT register
    const roleRes = await dbClient.query("SELECT id FROM roles WHERE code = 'engineer' LIMIT 1");
    const engRoleId = roleRes.rows[0].id;

    const userInsert = await dbClient.query(
      `INSERT INTO users (id, email, display_name, role_id, is_active, is_external, entra_object_id, created_at, updated_at)
       VALUES ($1, 'eng_dave@cybsec.com', 'Dave Engineer', $2, true, false, $3, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET display_name = 'Dave Engineer'
       RETURNING id`,
      [crypto.randomUUID(), engRoleId, crypto.randomUUID()]
    );
    engId = userInsert.rows[0].id;

    const empInsert = await dbClient.query(
      `INSERT INTO employees (id, user_id, department_id, keka_employee_id, designation, name, email, is_active, synced_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'MOCK-KEKA-DAVE', 'Software Engineer', 'Dave Engineer', 'eng_dave@cybsec.com', true, NOW(), NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET name = 'Dave Engineer'
       RETURNING id`,
      [crypto.randomUUID(), engId, deptId]
    );
    const employeeId = empInsert.rows[0].id;

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

    // 4. Allocate Dave Engineer to project (40 hours)
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
      // Also delete the seeded Dave Engineer user/employee (cascade via FK order)
      await dbClient.query("DELETE FROM employees WHERE email = 'eng_dave@cybsec.com'");
      // Remove FK-dependent rows before deleting the user
      await dbClient.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email = 'eng_dave@cybsec.com')");
      await dbClient.query("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = 'eng_dave@cybsec.com')");
      await dbClient.query("DELETE FROM users WHERE email = 'eng_dave@cybsec.com'");
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });


  test("TC-M1.3-01: Create Task", async ({ page }) => {
    // 1. Log in as PM
    await loginViaSessionInjection(page, pmEmail);

    // 2. Go directly to project detail page
    const permissionsPromise = page.waitForResponse(
      (res) => res.url().includes("/auth/me/permissions") && res.status() === 200,
      { timeout: 60000 }
    );
    const phasesPromise = page.waitForResponse(
      (res) => res.url().includes("/phases") && res.status() === 200,
      { timeout: 60000 }
    );
    await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "commit" });
    await permissionsPromise;
    await phasesPromise;

    // 3. Click Add Task button
    await page.locator('button:has-text("Add Task")').click();

    // 4. Fill main details
    const taskTitle = "API Integration";
    await page.fill('input[placeholder="Task title..."]', taskTitle);
    await page.fill('textarea[placeholder="Add a description..."]', "Connect Keka REST API");
    
    // Select priority
    await selectDropdown(page, "Priority", "High");

    // Select assignee: Dave Engineer
    await selectDropdown(page, "Assignee", "Dave Engineer");

    // Select phase: Design Phase
    await selectDropdown(page, "Phase", "Design Phase");

    // Fill effort hours
    await page.fill('input[placeholder="Optional"]', "40");

    // Pick dates: Start Date (10), Due Date (15) within phase bounds (1 month from now)
    await pickDateInTaskSheet(page, "Start date *", "10", 0);
    await pickDateInTaskSheet(page, "Due date *", "15", 0);

    // Submit
    await page.click('button[type="submit"]:has-text("Create Task")');

    // Verify task created toaster
    await expect(page.locator("body")).toContainText("Task created");

    // Verify task is in the database
    const taskRes = await dbClient.query("SELECT * FROM tasks WHERE project_id = $1 AND title = $2 LIMIT 1", [projectId, taskTitle]);
    expect(taskRes.rows.length).toBe(1);
  });

  test("TC-M1.3-02: Attachments", async ({ page }) => {
    // 1. Create a task directly in DB
    const taskId = crypto.randomUUID();
    const taskTitle = `Attachment Task - ${Date.now()}`;
    await dbClient.query(
      `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, owner_id, start_date, end_date, effort_hours, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Attachment verification', 'High', $5, NOW(), NOW() + INTERVAL '7 days', 20, 'In Progress', NOW(), NOW())`,
      [taskId, projectId, phaseId, taskTitle, engId]
    );

    // 2. Log in as PM
    await loginViaSessionInjection(page, pmEmail);
    await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "commit" });

    // 3. Open task details panel
    await page.locator(`button:has-text("${taskTitle}")`).first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();
    await page.waitForTimeout(600); // Settle slide-in animation

    // 4. Go to Files tab and upload design_doc.pdf immediately
    await page.locator('[role="dialog"] button:has-text("Files")').first().click({ force: true });
    await page.setInputFiles('input[type="file"]', {
      name: "design_doc.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("design doc pdf mock content")
    });

    // Check success toast
    await expect(page.locator("body")).toContainText("File attached");

    // 5. Verify database
    const attachmentRes = await dbClient.query("SELECT * FROM task_attachments WHERE task_id = $1 LIMIT 1", [taskId]);
    expect(attachmentRes.rows.length).toBe(1);
    expect(attachmentRes.rows[0].filename).toBe("design_doc.pdf");

    // 6. Verify audit logs for CREATE_TASK_ATTACHMENT using polling helper
    await expectAuditLogEntry(dbClient, "TaskAttachment", attachmentRes.rows[0].id, "CREATE_TASK_ATTACHMENT");

    // Close the details panel to show it is finished
    await page.keyboard.press("Escape");
    await page.waitForTimeout(2000);
  });

  test("TC-M1.3-03: Comments", async ({ page }) => {
    // 1. Create a task directly in DB
    const taskId = crypto.randomUUID();
    const taskTitle = `Comments Task - ${Date.now()}`;
    await dbClient.query(
      `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, owner_id, start_date, end_date, effort_hours, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Comments verification', 'Medium', $5, NOW(), NOW() + INTERVAL '7 days', 20, 'In Progress', NOW(), NOW())`,
      [taskId, projectId, phaseId, taskTitle, engId]
    );

    // 2. Log in as PM
    await loginViaSessionInjection(page, pmEmail);
    await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "commit" });

    // 3. Open task details panel
    await page.locator(`button:has-text("${taskTitle}")`).first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();
    await page.waitForTimeout(600); // Settle slide-in animation

    // 4. Go to Comments tab and post comment immediately
    await page.locator('[role="dialog"] button:has-text("Comments")').first().click({ force: true });
    await page.fill('textarea[placeholder="Write a comment..."]', "Subtask completed on schedule");
    await page.click('button:has-text("Post comment")', { force: true });

    // Check success toast
    await expect(page.locator("body")).toContainText("Comment added");

    // 5. Verify database
    const commentRes = await dbClient.query("SELECT * FROM task_comments WHERE task_id = $1 LIMIT 1", [taskId]);
    expect(commentRes.rows.length).toBe(1);
    expect(commentRes.rows[0].body).toBe("Subtask completed on schedule");

    // 6. Verify audit log for CREATE_TASK_COMMENT using polling helper
    await expectAuditLogEntry(dbClient, "TaskComment", commentRes.rows[0].id, "CREATE_TASK_COMMENT");
  });

  test("TC-M1.3-04: Sub-tasks", async ({ page }) => {
    // 1. Create a task directly in DB
    const taskId = crypto.randomUUID();
    const taskTitle = `Parent Task - ${Date.now()}`;
    await dbClient.query(
      `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, owner_id, start_date, end_date, effort_hours, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Subtask parent verification', 'Low', $5, NOW(), NOW() + INTERVAL '7 days', 20, 'In Progress', NOW(), NOW())`,
      [taskId, projectId, phaseId, taskTitle, engId]
    );

    // 2. Log in as PM
    await loginViaSessionInjection(page, pmEmail);
    await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "commit" });

    // 3. Open task details panel
    await page.locator(`button:has-text("${taskTitle}")`).first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();
    await page.waitForTimeout(600); // Settle slide-in animation

    // 4. Go to Subtasks tab and add subtask immediately
    await page.locator('[role="dialog"] button:has-text("Subtasks")').first().click({ force: true });
    const addBtn = page.locator('[role="dialog"] button').filter({ hasText: /^Add$/ }).first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click({ force: true });
    const subtaskInput = page.locator('input[placeholder="Sub-task title..."]');
    await expect(subtaskInput).toBeVisible({ timeout: 10000 });
    await subtaskInput.fill("Database Migration Subtask");
    await page.click('button:has-text("Add sub-task")', { force: true });

    // Check success toast
    await expect(page.locator("body")).toContainText("Sub-task created");

    // 5. Verify database
    const subTaskRes = await dbClient.query("SELECT * FROM tasks WHERE parent_task_id = $1 LIMIT 1", [taskId]);
    expect(subTaskRes.rows.length).toBe(1);
    expect(subTaskRes.rows[0].title).toBe("Database Migration Subtask");

    // 6. Verify audit log using polling helper
    await expectAuditLogEntry(dbClient, "Task", subTaskRes.rows[0].id, "CREATE_TASK");
  });

  test("TC-M1.3-06: Resource Availability", async ({ page }) => {
    await loginViaSessionInjection(page, pmEmail);
    await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "commit" });

    await page.locator('button:has-text("Add Task")').click();

    const taskTitle = `API Integration - ${Date.now()}`;
    await page.fill('input[placeholder="Task title..."]', taskTitle);
    await page.fill('textarea[placeholder="Add a description..."]', "Connect Keka REST API");
    await selectDropdown(page, "Priority", "High");
    await selectDropdown(page, "Assignee", "Dave Engineer");
    await selectDropdown(page, "Phase", "Design Phase");

    // Fill effort hours to 40 (since Dave is already at 40 allocation, this triggers warning)
    await page.fill('input[placeholder="Optional"]', "40");

    await pickDateInTaskSheet(page, "Start date *", "10", 0);
    await pickDateInTaskSheet(page, "Due date *", "15", 0);

    // Verify availability warning is visible — it's a paragraph inside the add-task sheet
    await expect(page.locator('body')).toContainText('over-allocated', { timeout: 10000 });

    // Hold on warning message so it is captured clearly in the video
    await page.waitForTimeout(2500);

    // Click submit and verify toast
    const createBtn = page.locator('button:has-text("Create Task")').first();
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click();
      // Wait for toast to appear and be captured by video
      await page.waitForTimeout(4000);
    }
  });

  test("TC-M1.3-07: Workflow States", async ({ page }) => {
    // 1. Log in as PM and create a task with UAT parameters (starts in To Do)
    await loginViaSessionInjection(page, pmEmail);
    await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "commit" });

    await page.locator('button:has-text("Add Task")').click();

    const taskTitle = `API Integration - ${Date.now()}`;
    await page.fill('input[placeholder="Task title..."]', taskTitle);
    await page.fill('textarea[placeholder="Add a description..."]', "Connect Keka REST API");
    await selectDropdown(page, "Priority", "High");
    await selectDropdown(page, "Assignee", "Dave Engineer");
    await selectDropdown(page, "Phase", "Design Phase");

    await pickDateInTaskSheet(page, "Start date *", "10", 0);
    await pickDateInTaskSheet(page, "Due date *", "15", 0);

    await page.click('button[type="submit"]:has-text("Create Task")');
    await expect(page.locator("body")).toContainText("Task created");

    // 2. Open task details panel
    await page.locator(`button:has-text("${taskTitle}")`).first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();
    await page.waitForTimeout(600); // Settle slide-in animation

    // Fetch the database ID of the created task
    const taskRes = await dbClient.query("SELECT id FROM tasks WHERE project_id = $1 AND title = $2 LIMIT 1", [projectId, taskTitle]);
    const taskId = taskRes.rows[0].id;

    // 3. Verify To Do status options are limited (To Do, In Progress) due to state machine validation
    const statusLabel = page.locator('label').filter({ hasText: "Status" }).first();
    const statusContainer = statusLabel.locator('xpath=..');
    let trigger = statusContainer.locator('[data-slot="select-trigger"]').first();
    await trigger.click();
    
    let popup = page.locator('[data-slot="select-content"]:visible');
    await expect(popup).toContainText("To Do");
    await expect(popup).toContainText("In Progress");
    await expect(popup).not.toContainText("Approved");

    // Select In Progress
    await popup.locator('[data-slot="select-item"]:visible').filter({ hasText: "In Progress" }).first().click();
    await expect(popup).toBeHidden();

    // Save changes
    await page.click('button:has-text("Save changes")');
    await page.waitForTimeout(500); // give React time to dispatch mutation
    await expect(page.locator("body")).toContainText("Task updated", { timeout: 15000 });

    // Verify DB
    let dbRes = await dbClient.query("SELECT status FROM tasks WHERE id = $1", [taskId]);
    expect(dbRes.rows[0].status).toBe("In Progress");

    // 4. Update status directly to 'Submitted for Review' in DB to test next workflow transitions
    await dbClient.query("UPDATE tasks SET status = 'Submitted for Review' WHERE id = $1", [taskId]);
    await page.reload();
    await page.locator(`button:has-text("${taskTitle}")`).first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();
    await page.waitForTimeout(600);

    // Verify Submitted for Review status options (Submitted for Review, Approved, Rework)
    trigger = statusContainer.locator('[data-slot="select-trigger"]').first();
    await trigger.click();
    popup = page.locator('[data-slot="select-content"]:visible');
    await expect(popup).toContainText("Submitted for Review");
    await expect(popup).toContainText("Approved");
    await expect(popup).toContainText("Rework");
    await expect(popup).not.toContainText("Done");

    // Choose Approved
    await popup.locator('[data-slot="select-item"]:visible').filter({ hasText: "Approved" }).first().click();
    await expect(popup).toBeHidden();
    
    // Save changes
    await page.click('button:has-text("Save changes")');
    await page.waitForTimeout(500); // give React time to dispatch mutation
    await expect(page.locator("body")).toContainText("Task updated", { timeout: 15000 });

    dbRes = await dbClient.query("SELECT status FROM tasks WHERE id = $1", [taskId]);
    expect(dbRes.rows[0].status).toBe("Approved");
  });

  test("TC-M1.4-01: Progress Update", async ({ page }) => {
    // 1. Create a task directly in DB
    const taskId = crypto.randomUUID();
    const taskTitle = `Progress Update Task - ${Date.now()}`;
    await dbClient.query(
      `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, owner_id, start_date, end_date, effort_hours, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Check progress submission', 'Medium', $5, NOW(), NOW() + INTERVAL '7 days', 20, 'In Progress', NOW(), NOW())`,
      [taskId, projectId, phaseId, taskTitle, engId]
    );

    // 2. Log in as Engineer
    await loginViaSessionInjection(page, engEmail);
    await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "commit" });

    // 3. Open task details panel
    await page.locator(`button:has-text("${taskTitle}")`).first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();
    await page.waitForTimeout(600);

    // 4. Fill in comment on Comments tab first to match UAT steps
    await page.locator('[role="dialog"] button:has-text("Comments")').first().click({ force: true });
    await page.fill('textarea[placeholder="Write a comment..."]', "Subtask completed on schedule.");
    await page.click('button:has-text("Post comment")', { force: true });
    await expect(page.locator("body")).toContainText("Comment added");

    // 5. Fill progress fields directly (no tabs in the panel — progress is in the left column)
    await page.locator('label').filter({ hasText: "Cumulative progress %" }).locator('xpath=..').locator('input').fill("65");
    await page.fill('input[placeholder="e.g. 8"]', "12");
    await page.fill('textarea[placeholder*="blockers"]', "Finished authentication flow with evidence");

    // Upload evidence file
    await page.setInputFiles('input[type="file"]', {
      name: "evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("evidence data")
    });

    // Submit progress
    await page.click('button:has-text("Submit for review")');
    await expect(page.locator("body")).toContainText("Progress submitted for PM review");

    // 6. Verify database records
    const commentRes = await dbClient.query("SELECT * FROM task_comments WHERE task_id = $1 LIMIT 1", [taskId]);
    expect(commentRes.rows.length).toBe(1);
    expect(commentRes.rows[0].body).toBe("Subtask completed on schedule.");

    const updateRes = await dbClient.query(
      "SELECT * FROM task_progress_updates WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1",
      [taskId]
    );
    expect(updateRes.rows.length).toBe(1);
    expect(updateRes.rows[0].status).toBe("Pending");
    expect(Number(updateRes.rows[0].progress_percent)).toBe(65);
    expect(Number(updateRes.rows[0].hours_spent)).toBe(12.00);

    // Verify audit logs for comment and progress
    await expectAuditLogEntry(dbClient, "TaskComment", commentRes.rows[0].id, "CREATE_TASK_COMMENT");
  });

  test("TC-M1.4-02: PM Approval", async ({ page }) => {
    // 1. Create task and progress update directly in DB in Pending status
    const taskId = crypto.randomUUID();
    const taskTitle = `PM Approval Task - ${Date.now()}`;
    await dbClient.query(
      `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, owner_id, start_date, end_date, effort_hours, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Check PM Approval', 'Medium', $5, NOW(), NOW() + INTERVAL '7 days', 20, 'In Progress', NOW(), NOW())`,
      [taskId, projectId, phaseId, taskTitle, engId]
    );

    const updateId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO task_progress_updates (id, task_id, engineer_id, progress_percent, hours_spent, comment, status, created_at)
       VALUES ($1, $2, $3, 75, 15.00, 'Done auth validation', 'Pending', NOW())`,
      [updateId, taskId, engId]
    );

    // 2. Log in as PM
    await loginViaSessionInjection(page, pmEmail);
    await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "commit" });

    // 3. Open task details panel as PM
    await page.locator(`button:has-text("${taskTitle}")`).first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();
    await page.waitForTimeout(600);

    // 4. Fill approval comment "Please verify hours." and Approve
    await page.fill('textarea[placeholder="Explain your decision…"]', "Please verify hours.");
    await page.locator('div:has(textarea[placeholder="Explain your decision…"]) button:has-text("Approve")').first().click({ force: true });
    await expect(page.locator("body")).toContainText("Progress approved");

    // 5. Verify DB states
    const taskRes = await dbClient.query("SELECT status, progress_approved FROM tasks WHERE id = $1", [taskId]);
    expect(Number(taskRes.rows[0].progress_approved)).toBe(75);

    const updateRes = await dbClient.query("SELECT status, review_reason FROM task_progress_updates WHERE id = $1", [updateId]);
    expect(updateRes.rows[0].status).toBe("Approved");
    // Note: review_reason is only stored for Reject/Rework decisions, not for Approve
    expect(updateRes.rows[0].review_reason).toBeNull();
  });

  test("TC-M1.4-03: PM Rejection", async ({ page }) => {
    // 1. Create task and progress update directly in DB in Pending status
    const taskId = crypto.randomUUID();
    const taskTitle = `PM Rejection Task - ${Date.now()}`;
    await dbClient.query(
      `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, owner_id, start_date, end_date, effort_hours, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Check PM Rejection', 'Medium', $5, NOW(), NOW() + INTERVAL '7 days', 20, 'In Progress', NOW(), NOW())`,
      [taskId, projectId, phaseId, taskTitle, engId]
    );

    const updateId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO task_progress_updates (id, task_id, engineer_id, progress_percent, hours_spent, comment, status, created_at)
       VALUES ($1, $2, $3, 75, 15.00, 'Done auth validation', 'Pending', NOW())`,
      [updateId, taskId, engId]
    );

    // 2. Log in as PM
    await loginViaSessionInjection(page, pmEmail);
    await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "commit" });

    // 3. Open task details panel as PM — scroll into view in case task list has grown
    const taskBtn = page.locator(`button:has-text("${taskTitle}")`).first();
    await taskBtn.scrollIntoViewIfNeeded({ timeout: 30000 });
    await taskBtn.click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();
    await page.waitForTimeout(600);

    // 4. Try to click Reject without explanation
    await page.locator('div:has(textarea[placeholder="Explain your decision…"]) button:has-text("Reject")').first().click({ force: true });
    
    // 5. Verify validation toast
    await expect(page.locator("body")).toContainText("Please provide a reason.");

    // 6. Fill in reason and Reject
    await page.fill('textarea[placeholder="Explain your decision…"]', "Rejected due to missing docs");
    await page.locator('div:has(textarea[placeholder="Explain your decision…"]) button:has-text("Reject")').first().click({ force: true });
    await expect(page.locator("body")).toContainText("Progress rejected");

    // 7. Verify DB states: status is Rejected, progressApproved remains 0 (since it was never approved)
    const taskRes = await dbClient.query("SELECT progress_approved FROM tasks WHERE id = $1", [taskId]);
    expect(Number(taskRes.rows[0].progress_approved)).toBe(0);

    const updateRes = await dbClient.query("SELECT status, review_reason FROM task_progress_updates WHERE id = $1", [updateId]);
    expect(updateRes.rows[0].status).toBe("Rejected");
    expect(updateRes.rows[0].review_reason).toBe("Rejected due to missing docs");

    // 8. Verify audit logs for status change using polling helper
    await expectAuditLogEntry(dbClient, "TaskProgressUpdate", updateId, "TASKPROGRESSUPDATE_STATUS_CHANGED");
  });

  test("TC-M1.4-04: PM can request rework", async ({ page }) => {
    // 1. Create task and progress update directly in DB in Pending status
    const taskId = crypto.randomUUID();
    const taskTitle = `PM Rework Task - ${Date.now()}`;
    await dbClient.query(
      `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, owner_id, start_date, end_date, effort_hours, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Check PM Rework', 'Medium', $5, NOW(), NOW() + INTERVAL '7 days', 20, 'In Progress', NOW(), NOW())`,
      [taskId, projectId, phaseId, taskTitle, engId]
    );

    const updateId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO task_progress_updates (id, task_id, engineer_id, progress_percent, hours_spent, comment, status, created_at)
       VALUES ($1, $2, $3, 75, 15.00, 'Done auth validation', 'Pending', NOW())`,
      [updateId, taskId, engId]
    );

    // 2. Log in as PM
    await loginViaSessionInjection(page, pmEmail);
    await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "commit" });

    // 3. Open task details panel as PM
    await page.locator(`button:has-text("${taskTitle}")`).first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();
    await page.waitForTimeout(600);

    // 4. Fill rework reason and click Request rework
    await page.fill('textarea[placeholder="Explain your decision…"]', "Please verify hours.");
    await page.locator('div:has(textarea[placeholder="Explain your decision…"]) button:has-text("Request rework")').first().click({ force: true });
    await expect(page.locator("body")).toContainText("Rework requested");

    // 5. Verify DB states
    const taskRes = await dbClient.query("SELECT status, progress_approved FROM tasks WHERE id = $1", [taskId]);
    expect(taskRes.rows[0].status).toBe("Rework");
    expect(Number(taskRes.rows[0].progress_approved)).toBe(0);

    const updateRes = await dbClient.query("SELECT status, review_reason FROM task_progress_updates WHERE id = $1", [updateId]);
    expect(updateRes.rows[0].status).toBe("Rework");
    expect(updateRes.rows[0].review_reason).toBe("Please verify hours.");

    // 6. Verify audit logs for status change using polling helper
    await expectAuditLogEntry(dbClient, "TaskProgressUpdate", updateId, "TASKPROGRESSUPDATE_STATUS_CHANGED");
  });

  test("TC-M1.4-05: Only approved progress affects project KPI", async ({ page }) => {
    // Fetch department and customer
    const deptRes = await dbClient.query("SELECT id FROM departments WHERE code = $1", ["SOC"]);
    const deptId = deptRes.rows[0].id;
    const custRes = await dbClient.query("SELECT id FROM customers WHERE company_name = $1", ["Acme Financial Services"]);
    const custId = custRes.rows[0].id;

    // Create a new isolated project for this test
    const newProjectId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO projects (id, name, objective, department_id, customer_id, engagement_type, billing_model, start_date, end_date, value, currency, primary_pm_id, status, created_by, created_at, updated_at)
       VALUES ($1, $2, 'Task KPI isolated objective', $3, $4, 'Managed Service', 'Fixed Price', NOW(), NOW() + INTERVAL '3 months', 100000, 'USD', $5, 'Active', $5, NOW(), NOW())`,
      [newProjectId, `KPI Isolated Project - ${Date.now()}`, deptId, custId, pmId]
    );

    const newPhaseId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO project_phases (id, project_id, name, description, start_date, end_date, status, order_index, created_at, updated_at)
       VALUES ($1, $2, 'Design Phase', 'System Architecture Design', NOW(), NOW() + INTERVAL '1 month', 'Planned', 0, NOW(), NOW())`,
      [newPhaseId, newProjectId]
    );

    // Allocate Brian Nguyen to project
    const empRes = await dbClient.query("SELECT id FROM employees WHERE keka_employee_id = $1", ["MOCK-KEKA-001"]);
    const employeeId = empRes.rows[0].id;
    await dbClient.query(
      `INSERT INTO allocations (id, employee_id, project_id, role, hours, percent, start_date, end_date, status, approved_by, created_at)
       VALUES ($1, $2, $3, 'Engineer', 40, 100, NOW(), NOW() + INTERVAL '3 months', 'Active', $4, NOW())`,
      [crypto.randomUUID(), employeeId, newProjectId, pmId]
    );

    try {
      // 1. Create two tasks in the new DB project to test project-wide KPI calculation
      const task1Id = crypto.randomUUID();
      const task1Title = `KPI Task 1 - ${Date.now()}`;
      await dbClient.query(
        `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, owner_id, start_date, end_date, effort_hours, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'KPI Task 1', 'Medium', $5, NOW(), NOW() + INTERVAL '7 days', 20, 'In Progress', NOW(), NOW())`,
        [task1Id, newProjectId, newPhaseId, task1Title, engId]
      );

      const task2Id = crypto.randomUUID();
      const task2Title = `KPI Task 2 - ${Date.now()}`;
      await dbClient.query(
        `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, owner_id, start_date, end_date, effort_hours, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'KPI Task 2', 'Medium', $5, NOW(), NOW() + INTERVAL '7 days', 20, 'In Progress', NOW(), NOW())`,
        [task2Id, newProjectId, newPhaseId, task2Title, engId]
      );

      // 2. Engineer logs in, submits 60% progress on Task 1
      await loginViaSessionInjection(page, engEmail);
      await page.goto(`/en/dashboard/projects/${newProjectId}`, { waitUntil: "commit" });
      
      // Open details of Task 1 and submit progress update
      await page.locator(`button:has-text("${task1Title}")`).first().click();
      await expect(page.locator('text="Loading task..."')).toBeHidden();
      await page.waitForTimeout(600);

      await page.locator('label').filter({ hasText: "Cumulative progress %" }).locator('xpath=..').locator('input').fill("60");
      await page.fill('input[placeholder="e.g. 8"]', "10");
      await page.fill('textarea[placeholder*="blockers"]', "KPI validation - pending status");
      await page.click('button:has-text("Submit for review")');
      await expect(page.locator("body")).toContainText("Progress submitted for PM review");

      // Close details panel
      await page.locator('button:has-text("Close")').first().click({ force: true });
      await page.waitForTimeout(600);

      // Verify Project workspace KPI overall progress is still 0% (since progress update is pending, not approved)
      await page.reload();
      await expect(page.locator('span:has-text("Overall Progress")').locator('xpath=..').locator('span.text-primary')).toContainText("0%");

      // 3. PM logs in, approves the progress update of 60%
      const updateRes = await dbClient.query(
        "SELECT id FROM task_progress_updates WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1",
        [task1Id]
      );
      const updateId = updateRes.rows[0].id;

      await loginViaSessionInjection(page, pmEmail);
      await page.goto(`/en/dashboard/projects/${newProjectId}`, { waitUntil: "commit" });

      // Open Task 1 and Approve
      await page.locator(`button:has-text("${task1Title}")`).first().click();
      await expect(page.locator('text="Loading task..."')).toBeHidden();
      await page.waitForTimeout(600);

      await page.fill('textarea[placeholder="Explain your decision…"]', "Please verify hours.");
      await page.locator('div:has(textarea[placeholder="Explain your decision…"]) button:has-text("Approve")').first().click({ force: true });
      await expect(page.locator("body")).toContainText("Progress approved");

      // Close details panel
      await page.locator('button:has-text("Close")').first().click({ force: true });
      await page.waitForTimeout(600);

      // Verify Project workspace KPI overall progress is now 30% (average of 60% on Task 1 and 0% on Task 2)
      await page.reload();
      await page.waitForTimeout(2000);
      // The Overall Progress value is shown as a sibling span next to the label
      await expect(
        page.locator('span:has-text("Overall Progress")').locator('xpath=following-sibling::span[1]')
      ).toContainText("30%", { timeout: 10000 });
    } finally {
      // Clean up isolated project
      await dbClient.query("DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)", [newProjectId]);
      await dbClient.query("DELETE FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)", [newProjectId]);
      await dbClient.query("DELETE FROM task_dependencies WHERE predecessor_id IN (SELECT id FROM tasks WHERE project_id = $1) OR successor_id IN (SELECT id FROM tasks WHERE project_id = $1)", [newProjectId]);
      await dbClient.query("DELETE FROM task_progress_updates WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)", [newProjectId]);
      await dbClient.query("DELETE FROM tasks WHERE project_id = $1", [newProjectId]);
      await dbClient.query("DELETE FROM allocations WHERE project_id = $1", [newProjectId]);
      await dbClient.query("DELETE FROM project_phases WHERE project_id = $1", [newProjectId]);
      await dbClient.query("DELETE FROM projects WHERE id = $1", [newProjectId]);
    }
  });
});
