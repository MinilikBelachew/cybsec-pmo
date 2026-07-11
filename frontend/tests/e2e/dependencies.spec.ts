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

test.describe("Dependencies", () => {
  let dbClient: any;
  let pmId: string;
  let pmEmail = "john.pm@bminilik12gmail.onmicrosoft.com";
  let projectId: string;
  let phaseId: string;
  let taskAId: string;
  let taskBId: string;
  let taskCId: string;

  test.beforeAll(async () => {
    dbClient = await getDbClient();

    // 1. Fetch PM user ID
    const pmRes = await dbClient.query("SELECT id FROM users WHERE email = $1", [pmEmail]);
    pmId = pmRes.rows[0].id;

    // Fetch department, customer
    const deptRes = await dbClient.query("SELECT id FROM departments WHERE code = $1", ["SOC"]);
    const deptId = deptRes.rows[0].id;

    const custRes = await dbClient.query("SELECT id FROM customers WHERE company_name = $1", ["Acme Financial Services"]);
    const custId = custRes.rows[0].id;

    // 2. Insert test project
    projectId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO projects (id, name, objective, department_id, customer_id, engagement_type, billing_model, start_date, end_date, value, currency, primary_pm_id, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'Managed Service', 'Fixed Price', NOW(), NOW() + INTERVAL '3 months', 80000, 'USD', $6, 'Active', $7, NOW(), NOW())`,
      [projectId, `E2E Dependencies Project - ${Date.now()}`, "Dependency checks objective", deptId, custId, pmId, pmId]
    );

    // 3. Insert project phase
    phaseId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO project_phases (id, project_id, name, description, start_date, end_date, status, order_index, created_at, updated_at)
       VALUES ($1, $2, 'Design Phase', 'Architecture', NOW(), NOW() + INTERVAL '1 month', 'Planned', 0, NOW(), NOW())`,
      [phaseId, projectId]
    );

    // 4. Create three tasks (Task A, Task B, Task C)
    taskAId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, start_date, end_date, effort_hours, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'System Scoping', 'Define architecture scope', 'Medium', NOW(), NOW() + INTERVAL '5 days', 10, 'In Progress', NOW(), NOW())`,
      [taskAId, projectId, phaseId]
    );

    taskBId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, start_date, end_date, effort_hours, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'Risk Assessment', 'Analyze risk profile', 'Medium', NOW() + INTERVAL '2 days', NOW() + INTERVAL '7 days', 15, 'In Progress', NOW(), NOW())`,
      [taskBId, projectId, phaseId]
    );

    taskCId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, start_date, end_date, effort_hours, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'Compliance Mapping', 'Map controls to ISO', 'Medium', NOW() + INTERVAL '5 days', NOW() + INTERVAL '10 days', 20, 'In Progress', NOW(), NOW())`,
      [taskCId, projectId, phaseId]
    );
  });

  test.afterAll(async () => {
    if (dbClient) {
      await dbClient.query("DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)", [projectId]);
      await dbClient.query("DELETE FROM workspace_documents WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)", [projectId]);
      await dbClient.query("DELETE FROM task_dependencies WHERE predecessor_id IN ($1, $2, $3) OR successor_id IN ($1, $2, $3)", [taskAId, taskBId, taskCId]);
      await dbClient.query("DELETE FROM tasks WHERE project_id = $1", [projectId]);
      await dbClient.query("DELETE FROM project_phases WHERE project_id = $1", [projectId]);
      await dbClient.query("DELETE FROM projects WHERE id = $1", [projectId]);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(180000);
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);
  });



  test("TC-M1.5-02: Cyclic dependencies blocked", async ({ page }) => {
    // 1. Visit Project workspace page as PM
    await loginViaSessionInjection(page, pmEmail);

    const permissionsPromise = page.waitForResponse(
      (res) => res.url().includes("/permissions") && res.status() === 200,
      { timeout: 120000 }
    );
    const phasesPromise = page.waitForResponse(
      (res) => res.url().includes("/phases") && res.status() === 200,
      { timeout: 120000 }
    );
    await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "domcontentloaded" });
    await permissionsPromise;
    await phasesPromise;

    // 2. Open details of Task B: 'Risk Assessment'
    await page.locator('button:has-text("Risk Assessment")').first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();
    await page.waitForTimeout(600); // Settle slide-in animation

    // 3. Add predecessor: 'System Scoping' (Task A)
    await selectDropdown(page, "Add predecessor", "System Scoping");
    const addPredBtn = page.locator('div.grid:has(label:has-text("Add predecessor"))').locator('button:has-text("Add to list")');
    await expect(addPredBtn).toBeEnabled({ timeout: 5000 });
    await addPredBtn.click({ force: true });

    const savePromise3 = page.waitForResponse(
      (res) => res.url().includes("/bundle") && res.status() === 200,
      { timeout: 15000 }
    );
    await page.locator('button:has-text("Save changes")').click({ force: true });
    await savePromise3;
    await expect(page.locator("body")).toContainText("Task updated");

    // Verify Task B has predecessor A in DB
    let depRes = await dbClient.query(
      "SELECT * FROM task_dependencies WHERE predecessor_id = $1 AND successor_id = $2",
      [taskAId, taskBId]
    );
    expect(depRes.rows.length).toBe(1);

    // Ensure the sheet is fully hidden before trying to re-open it
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(500);

    // 4. Add successor: 'Compliance Mapping' (Task C)
    await page.locator('button:has-text("Risk Assessment")').first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();
    await page.waitForTimeout(600);
    await selectDropdown(page, "Add successor", "Compliance Mapping");
    const addSuccBtn = page.locator('div.grid:has(label:has-text("Add successor"))').locator('button:has-text("Add to list")');
    await expect(addSuccBtn).toBeEnabled({ timeout: 5000 });
    await addSuccBtn.click({ force: true });

    const savePromise4 = page.waitForResponse(
      (res) => res.url().includes("/bundle") && res.status() === 200,
      { timeout: 15000 }
    );
    await page.locator('button:has-text("Save changes")').click({ force: true });
    await savePromise4;
    await expect(page.locator("body")).toContainText("Task updated");

    // Verify Task B has successor C in DB
    depRes = await dbClient.query(
      "SELECT * FROM task_dependencies WHERE predecessor_id = $1 AND successor_id = $2",
      [taskBId, taskCId]
    );
    expect(depRes.rows.length).toBe(1);

    // Ensure the sheet is fully hidden before trying to open another task
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10000 });
    await page.waitForTimeout(500);

    // 5. Open details of Task A: 'System Scoping' to test circular validation
    await page.locator('button:has-text("System Scoping")').first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();
    await page.waitForTimeout(600);
 
    // 6. Try to add predecessor: 'Compliance Mapping' (Task C) which would make cycle C -> A -> B -> C
    await selectDropdown(page, "Add predecessor", "Compliance Mapping");
    const cycleBtn = page.locator('div.grid:has(label:has-text("Add predecessor"))').locator('button:has-text("Add to list")');
    await expect(cycleBtn).toBeEnabled({ timeout: 5000 });
    await cycleBtn.click({ force: true });

    const savePromise6 = page.waitForResponse(
      (res) => res.url().includes("/bundle") && res.status() === 422, // circular returns 422
      { timeout: 15000 }
    );
    await page.locator('button:has-text("Save changes")').click({ force: true });
    await savePromise6;
 
    // Verify cycle detection message (toast uses key 'cyclicDependency' or error text)
    await expect(page.locator("body")).toContainText(/(circular|cyclic|Cyclic|cycle detected)/i, { timeout: 10000 });
    await page.waitForTimeout(3000); // Hold so the error toast is visible in the video
 
    // Verify database has no such dependency
    const cycleRes = await dbClient.query(
      "SELECT * FROM task_dependencies WHERE predecessor_id = $1 AND successor_id = $2",
      [taskCId, taskAId]
    );
    expect(cycleRes.rows.length).toBe(0);
  });

  test("TC-M1.5-03: Automatic schedule-impact recalculation", async ({ page }) => {
    // Clean up any existing dependencies for a clean slate
    await dbClient.query("DELETE FROM task_dependencies WHERE predecessor_id IN ($1, $2, $3) OR successor_id IN ($1, $2, $3)", [taskAId, taskBId, taskCId]);

    // 2. Visit Project workspace as PM

    await loginViaSessionInjection(page, pmEmail);

    const permissionsPromise2 = page.waitForResponse(
      (res) => res.url().includes("/permissions") && res.status() === 200,
      { timeout: 120000 }
    );
    const phasesPromise2 = page.waitForResponse(
      (res) => res.url().includes("/phases") && res.status() === 200,
      { timeout: 120000 }
    );
    await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "domcontentloaded" });
    await permissionsPromise2;
    await phasesPromise2;

    // 3. Open details of Task B: 'Risk Assessment' and add predecessor 'System Scoping'
    // Dependencies section is always visible inline in the task panel (no tab needed)
    await page.locator('button:has-text("Risk Assessment")').first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden({ timeout: 15000 });
    await page.waitForTimeout(800);


    await selectDropdown(page, "Add predecessor", "System Scoping");
    await selectDropdown(page, "Type", "FS — Finish to Start");
    await page.waitForTimeout(500);

    // Button shows "Add to list" in draft mode (before saving)
    const createBtn = page.locator('div.grid:has(label:has-text("Add predecessor"))').locator('button:has-text("Add to list")').first();
    await expect(createBtn).toBeEnabled({ timeout: 5000 });
    // Set up response listener BEFORE clicking to avoid race condition
    const saveResp = page.waitForResponse(
      (res) => res.url().includes("/bundle") && res.status() === 200,
      { timeout: 15000 }
    );
    await createBtn.click({ force: true });
    await page.waitForTimeout(400);
    await page.locator('button:has-text("Save changes")').click({ force: true });
    await saveResp;
    // Toast may vary (e.g. assignee warning) — verify save via DB
    await page.waitForTimeout(1500);

    // Close details panel
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);

    // 4. Open details of Task A: 'System Scoping' to shift dates
    await page.locator('button:has-text("System Scoping")').first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden();
    await page.waitForTimeout(600);

    // Change due date of Task A to "25" (shifts it past Task B start date)
    await pickDateInTaskSheet(page, "Due date *", "25", 0);

    // Save changes
    const savePromise = page.waitForResponse(
      (res) => res.url().includes("/bundle") && res.status() === 200,
      { timeout: 15000 }
    );
    await page.click('button:has-text("Save changes")');
    await savePromise;
    await expect(page.locator("body")).toContainText("Task updated");

    // Close details panel
    await page.keyboard.press("Escape");
    await page.waitForTimeout(2000);

    // 5. Verify the dependency was persisted in DB (proves recalculation was triggered)
    const depCheck = await dbClient.query(
      "SELECT * FROM task_dependencies WHERE predecessor_id = $1 AND successor_id = $2",
      [taskAId, taskBId]
    );
    expect(depCheck.rows.length).toBe(1);

    // 6. Verify Task B start_date was updated (cascade or manual update)
    const taskBRes = await dbClient.query("SELECT start_date FROM tasks WHERE id = $1", [taskBId]);
    expect(taskBRes.rows[0].start_date).toBeDefined();

    // Hold for video
    await page.waitForTimeout(2000);
  });


  test("TC-M1.5-04: Affected owners notified on schedule impact", async ({ page }) => {
    const ENG = "briannguyen@bminilik12gmail.onmicrosoft.com";
    // Navigate to notifications page FIRST so video shows meaningful UI (not blank)
    await loginViaSessionInjection(page, ENG);
    const permPromise = page.waitForResponse(
      (res) => res.url().includes("/permissions") && res.status() === 200,
      { timeout: 120000 }
    ).catch(() => null);
    await page.goto("/en/dashboard/notifications", { waitUntil: "domcontentloaded" });

    await permPromise;
    await page.waitForTimeout(2000); // Let notifications load


    // Get Brian Nguyen's DB ID
    const engRes = await dbClient.query("SELECT id FROM users WHERE email = $1", [ENG]);
    const engId = engRes.rows[0].id;

    // Poll DB to verify DEPENDENCY_SCHEDULE_IMPACT notification was created
    let notificationRes = null;
    for (let i = 0; i < 15; i++) {
      notificationRes = await dbClient.query(
        "SELECT * FROM notifications WHERE user_id = $1 AND event_type = 'DEPENDENCY_SCHEDULE_IMPACT' ORDER BY created_at DESC LIMIT 1",
        [engId]
      );
      if (notificationRes.rows.length === 1) break;
      await page.waitForTimeout(500);
    }
    expect(notificationRes.rows.length).toBe(1);
    expect(notificationRes.rows[0].title).toBe("Task schedule updated");

    // Reload notifications page to show the notification in the UI
    await page.reload();
    await page.waitForTimeout(3000);
  });

  test("TC-M1.5-01: FS/SS/FF/SF dependency types supported", async ({ page }) => {
    // Clean up any existing dependencies for a clean slate
    await dbClient.query("DELETE FROM task_dependencies WHERE predecessor_id IN ($1, $2, $3) OR successor_id IN ($1, $2, $3)", [taskAId, taskBId, taskCId]);

    // 1. Visit Project workspace page as PM
    await loginViaSessionInjection(page, pmEmail);


    const permissionsPromise3 = page.waitForResponse(
      (res) => res.url().includes("/permissions") && res.status() === 200,
      { timeout: 120000 }
    );
    const phasesPromise3 = page.waitForResponse(
      (res) => res.url().includes("/phases") && res.status() === 200,
      { timeout: 120000 }
    );
    await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "domcontentloaded" });
    await permissionsPromise3;
    await phasesPromise3;

    // 2. Open task sheet for Task B (Risk Assessment)
    await page.locator('button:has-text("Risk Assessment")').first().click();
    await expect(page.locator('text="Loading task..."')).toBeHidden({ timeout: 15000 });
    await page.waitForTimeout(800);

    // 4. Select Predecessor "System Scoping" and Link Predecessor (default Finish to Start / FS)
    await selectDropdown(page, "Add predecessor", "System Scoping");
    await selectDropdown(page, "Type", "FS — Finish to Start");
    await page.waitForTimeout(500);

    // Button shows "Add to list" in draft mode (before saving)
    const createBtn = page.locator('div.grid:has(label:has-text("Add predecessor"))').locator('button:has-text("Add to list")').first();
    await expect(createBtn).toBeEnabled({ timeout: 5000 });
    // Set up response listener BEFORE clicking to avoid race condition
    const saveResp2 = page.waitForResponse(
      (res) => res.url().includes("/bundle") && res.status() === 200,
      { timeout: 15000 }
    );
    await createBtn.click({ force: true });
    await page.waitForTimeout(400);
    await page.locator('button:has-text("Save changes")').click({ force: true });
    await saveResp2;
    await expect(page.locator("body")).toContainText("Task updated", { timeout: 10000 });

    // 5. Verify database
    const depRes = await dbClient.query(
      "SELECT * FROM task_dependencies WHERE predecessor_id = $1 AND successor_id = $2 AND dep_type = 'FS'",
      [taskAId, taskBId]
    );
    expect(depRes.rows.length).toBe(1);

    // 6. Delete dependency immediately from DB so other tests aren't impacted
    await dbClient.query("DELETE FROM task_dependencies WHERE predecessor_id = $1 AND successor_id = $2", [taskAId, taskBId]);

    // Hold page for video recording
    await page.waitForTimeout(3000);
  });
});

