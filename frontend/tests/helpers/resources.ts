import { Page, expect } from "@playwright/test";
import crypto from "crypto";
import type { Client } from "pg";

export const PM_EMAIL = "john.pm@bminilik12gmail.onmicrosoft.com";
export const ENG_EMAIL = "eng_m2_dave@cybsec.com";
export const BACKUP_ENG_EMAIL = "eng_m2_backup@cybsec.com";
export const IT_ADMIN_EMAIL = "roba.admin@bminilik12gmail.onmicrosoft.com";

export type Phase2Seed = {
  pmId: string;
  engUserId: string;
  engEmployeeId: string;
  backupUserId: string;
  backupEmployeeId: string;
  itAdminId: string;
  projectId: string;
  projectName: string;
  taskId: string;
  criticalTaskId: string;
  phaseId: string;
  allocationId: string;
  deptId: string;
  custId: string;
};

export async function gotoWithCommit(page: Page, path: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(path, { waitUntil: "commit" });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("ERR_ABORTED") || attempt === 2) {
        throw error;
      }
      await page.waitForTimeout(500);
    }
  }
}

/** Wait until dashboard shell finished loading (avoids stuck "Loading workspace details..."). */
export async function waitForAppReady(page: Page, timeout = 60000) {
  const loading = page.getByText(/Loading workspace details/i);
  if (await loading.isVisible().catch(() => false)) {
    await expect(loading).toBeHidden({ timeout });
  }
}

/** Open a project workspace and wait until its name (or Team tab) is interactive. */
export async function gotoProjectWorkspace(
  page: Page,
  projectId: string,
  projectName: string,
) {
  await gotoWithCommit(page, `/en/dashboard/projects/${projectId}`);
  await waitForAppReady(page);

  const name = page.getByText(projectName).first();
  const teamTab = page.getByRole("button", { name: /^Team$/ });

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await name.isVisible().catch(() => false)) return;
    if (await teamTab.isVisible().catch(() => false)) return;
    if (await page.getByText(/Loading workspace details/i).isVisible().catch(() => false)) {
      await expect(page.getByText(/Loading workspace details/i)).toBeHidden({
        timeout: 60000,
      });
    }
    await page.reload({ waitUntil: "commit" });
    await waitForAppReady(page);
  }

  await expect(name.or(teamTab).first()).toBeVisible({ timeout: 30000 });
}

export async function dismissOverlays(page: Page) {
  await dismissDropdowns(page);
  for (let i = 0; i < 5; i++) {
    const backdrop = page.locator('[role="presentation"][data-base-ui-inert]');
    if (!(await backdrop.first().isVisible().catch(() => false))) {
      break;
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
}

/** Assert text in the primary data table (avoids hidden chart/duplicate nodes). */
export async function expectVisibleInTable(page: Page, text: string | RegExp) {
  const cell = page.getByRole("table").getByText(text).first();
  await expect(cell).toBeVisible({ timeout: 20000 });
}

/**
 * Hold the page so Playwright video captures the expected result.
 * Call this WHILE the success/error UI is still visible — before slow DB checks.
 */
export async function holdForVideo(page: Page, ms = 3500) {
  await page.waitForTimeout(ms);
}

/**
 * Assert a visible UAT outcome, bring it into frame, then hold for the video.
 * Prefer this over DB-only assertions when evidence videos matter.
 */
export async function captureEvidence(
  page: Page,
  text: string | RegExp,
  options?: { timeout?: number; holdMs?: number },
) {
  const locator = page.getByText(text).first();
  await expect(locator).toBeVisible({ timeout: options?.timeout ?? 20000 });
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await holdForVideo(page, options?.holdMs ?? 3500);
}

export async function dismissDropdowns(page: Page) {
  let attempts = 0;
  while (attempts < 5) {
    const openSelects = page.locator(
      '[data-slot="select-trigger"][aria-expanded="true"]',
    );
    const count = await openSelects.count();
    if (count === 0) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    attempts++;
  }
}

export async function selectDropdown(
  page: Page,
  label: string,
  optionText: string,
) {
  await dismissDropdowns(page);

  let scope = page.locator('[role="dialog"]:visible');
  if ((await scope.count()) === 0) {
    scope = page.locator("body");
  }

  const labelEl = scope.locator("label").filter({ hasText: label }).first();
  let container = labelEl.locator("xpath=..");
  const isFlex = await container
    .evaluate(
      (el: HTMLElement) =>
        el.classList.contains("flex") || el.className.includes("flex"),
    )
    .catch(() => false);
  if (isFlex) {
    container = container.locator("xpath=..");
  }

  const trigger = container.locator('[data-slot="select-trigger"]').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const popup = page.locator('[data-slot="select-content"]:visible');
  await expect(popup).toBeVisible({ timeout: 5000 });
  const item = popup
    .locator('[data-slot="select-item"]:visible')
    .filter({ hasText: optionText })
    .first();
  await expect(item).toBeVisible({ timeout: 5000 });
  await item.click();
  await expect(popup).toBeHidden({ timeout: 5000 });
}

/** Submit the log-hours add-entry form (not the header toggle). */
export async function submitLogHoursEntry(page: Page) {
  await dismissOverlays(page);
  const form = page.locator("form").filter({ hasText: "New Entry" });
  await expect(form).toBeVisible({ timeout: 10000 });
  const submit = form
    .locator('button[type="submit"]')
    .filter({ hasText: /Add Entry/i });
  await expect(submit).toBeEnabled({ timeout: 10000 });
  await submit.click();
}

export async function openLogHoursAddForm(page: Page) {
  await expect(page.getByText("Log Hours").first()).toBeVisible({
    timeout: 30000,
  });
  await dismissOverlays(page);

  const newEntryForm = page.locator("form").filter({ hasText: "New Entry" });
  if (await newEntryForm.isVisible().catch(() => false)) {
    return;
  }

  const headerAdd = page
    .getByTestId("log-hours-add-header")
    .or(page.locator('button[type="button"]').filter({ hasText: /^Add Entry$/ }));
  if (await headerAdd.first().isVisible({ timeout: 8000 }).catch(() => false)) {
    await headerAdd.first().click();
  } else {
    const addLink = page.getByTestId("log-hours-add");
    if (await addLink.isVisible().catch(() => false)) {
      await dismissOverlays(page);
      await addLink.click();
    } else {
      await page
        .getByRole("button", { name: /\+ Add entry|Add entry/i })
        .first()
        .click();
    }
  }

  await expect(newEntryForm).toBeVisible({ timeout: 10000 });
}

/** Seed shared Phase 2 fixtures: PM, engineers, Active project, tasks, allocation. */
export async function seedPhase2Resources(
  db: Client,
  options?: { projectSuffix?: string },
): Promise<Phase2Seed> {
  const suffix = options?.projectSuffix ?? String(Date.now());

  const pmRes = await db.query("SELECT id FROM users WHERE email = $1", [
    PM_EMAIL,
  ]);
  if (!pmRes.rows[0]) {
    throw new Error(`PM user ${PM_EMAIL} not found — run backend seed first`);
  }
  const pmId = pmRes.rows[0].id as string;

  const deptRes = await db.query(
    "SELECT id FROM departments WHERE code = $1 LIMIT 1",
    ["SOC"],
  );
  const deptId = deptRes.rows[0].id as string;

  const custRes = await db.query(
    "SELECT id FROM customers WHERE company_name = $1 LIMIT 1",
    ["Acme Financial Services"],
  );
  if (!custRes.rows[0]) {
    throw new Error(
      "Customer 'Acme Financial Services' not found — run backend seed first",
    );
  }
  const custId = custRes.rows[0].id as string;

  const engRole = await db.query(
    "SELECT id FROM roles WHERE code = 'engineer' LIMIT 1",
  );
  const engRoleId = engRole.rows[0].id;

  const itRole = await db.query(
    "SELECT id FROM roles WHERE code = 'it_admin' LIMIT 1",
  );
  const itRoleId = itRole.rows[0].id;

  const engUserInsert = await db.query(
    `INSERT INTO users (id, email, display_name, role_id, is_active, is_external, entra_object_id, created_at, updated_at)
     VALUES ($1, $2, 'M2 Dave Engineer', $3, true, false, $4, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET display_name = 'M2 Dave Engineer', role_id = $3, is_active = true
     RETURNING id`,
    [crypto.randomUUID(), ENG_EMAIL, engRoleId, crypto.randomUUID()],
  );
  const engUserId = engUserInsert.rows[0].id as string;

  const engEmpInsert = await db.query(
    `INSERT INTO employees (id, user_id, department_id, keka_employee_id, designation, name, email, weekly_hours, is_active, synced_at, created_at, updated_at)
     VALUES ($1, $2, $3, 'MOCK-KEKA-M2-DAVE', 'Software Engineer', 'M2 Dave Engineer', $4, 40, true, NOW(), NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET name = 'M2 Dave Engineer', weekly_hours = 40, designation = 'Software Engineer', is_active = true, keka_employee_id = 'MOCK-KEKA-M2-DAVE'
     RETURNING id`,
    [crypto.randomUUID(), engUserId, deptId, ENG_EMAIL],
  );
  const engEmployeeId = engEmpInsert.rows[0].id as string;

  const backupUserInsert = await db.query(
    `INSERT INTO users (id, email, display_name, role_id, is_active, is_external, entra_object_id, created_at, updated_at)
     VALUES ($1, $2, 'M2 Backup Engineer', $3, true, false, $4, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET display_name = 'M2 Backup Engineer', role_id = $3, is_active = true
     RETURNING id`,
    [crypto.randomUUID(), BACKUP_ENG_EMAIL, engRoleId, crypto.randomUUID()],
  );
  const backupUserId = backupUserInsert.rows[0].id as string;

  const backupEmpInsert = await db.query(
    `INSERT INTO employees (id, user_id, department_id, keka_employee_id, designation, name, email, weekly_hours, is_active, synced_at, created_at, updated_at)
     VALUES ($1, $2, $3, 'MOCK-KEKA-M2-BACKUP', 'Software Engineer', 'M2 Backup Engineer', $4, 40, true, NOW(), NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET name = 'M2 Backup Engineer', weekly_hours = 40, is_active = true
     RETURNING id`,
    [crypto.randomUUID(), backupUserId, deptId, BACKUP_ENG_EMAIL],
  );
  const backupEmployeeId = backupEmpInsert.rows[0].id as string;

  const itAdminInsert = await db.query(
    `INSERT INTO users (id, email, display_name, role_id, is_active, is_external, entra_object_id, created_at, updated_at)
     VALUES ($1, $2, 'Roba Admin', $3, true, false, $4, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET display_name = 'Roba Admin', role_id = $3, is_active = true
     RETURNING id`,
    [crypto.randomUUID(), IT_ADMIN_EMAIL, itRoleId, crypto.randomUUID()],
  );
  const itAdminId = itAdminInsert.rows[0].id as string;

  const projectId = crypto.randomUUID();
  const projectName = `E2E M2 Resource Project - ${suffix}`;
  await db.query(
    `INSERT INTO projects (id, name, objective, department_id, customer_id, engagement_type, billing_model, start_date, end_date, value, currency, primary_pm_id, status, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'Managed Service', 'Fixed Price', CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '3 months', 100000, 'USD', $6, 'Active', $7, NOW(), NOW())`,
    [projectId, projectName, "Phase 2 resource & time e2e", deptId, custId, pmId, pmId],
  );

  const phaseId = crypto.randomUUID();
  await db.query(
    `INSERT INTO project_phases (id, project_id, name, description, start_date, end_date, status, order_index, created_at, updated_at)
     VALUES ($1, $2, 'Delivery', 'Delivery phase', CURRENT_DATE, CURRENT_DATE + INTERVAL '2 months', 'Planned', 0, NOW(), NOW())`,
    [phaseId, projectId],
  );

  const taskId = crypto.randomUUID();
  await db.query(
    `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, owner_id, start_date, end_date, effort_hours, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'Loggable Task', 'Phase 2 loggable', 'Medium', $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 16, 'In Progress', NOW(), NOW())`,
    [taskId, projectId, phaseId, engUserId],
  );

  const criticalTaskId = crypto.randomUUID();
  await db.query(
    `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, owner_id, start_date, end_date, effort_hours, status, is_on_critical_path, created_at, updated_at)
     VALUES ($1, $2, $3, 'Critical Path Task', 'Phase 2 critical', 'Critical', $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '10 days', 24, 'In Progress', true, NOW(), NOW())`,
    [criticalTaskId, projectId, phaseId, engUserId],
  );

  const allocationId = crypto.randomUUID();
  await db.query(
    `INSERT INTO allocations (id, employee_id, project_id, role, hours, percent, start_date, end_date, status, approved_by, created_at)
     VALUES ($1, $2, $3, 'Software Engineer', 20, 50, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '3 months', 'Active', $4, NOW())`,
    [allocationId, engEmployeeId, projectId, pmId],
  );

  // Backup engineer also on project (for backup picker)
  await db.query(
    `INSERT INTO allocations (id, employee_id, project_id, role, hours, percent, start_date, end_date, status, approved_by, created_at)
     VALUES ($1, $2, $3, 'Software Engineer', 10, 25, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '3 months', 'Active', $4, NOW())`,
    [crypto.randomUUID(), backupEmployeeId, projectId, pmId],
  );

  // app_settings row is created by backend migrations/seed; policy resets happen in cleanup.
  return {
    pmId,
    engUserId,
    engEmployeeId,
    backupUserId,
    backupEmployeeId,
    itAdminId,
    projectId,
    projectName,
    taskId,
    criticalTaskId,
    phaseId,
    allocationId,
    deptId,
    custId,
  };
}

export async function cleanupPhase2Resources(
  db: Client,
  seed: Phase2Seed,
): Promise<void> {
  const projectId = seed.projectId;
  const employeeIds = [seed.engEmployeeId, seed.backupEmployeeId];

  // Remove all data tied to test employees (may span multiple spec projects).
  await db.query(
    `DELETE FROM timesheet_approvals WHERE timesheet_id IN (
       SELECT id FROM timesheets
       WHERE employee_id = ANY($1::uuid[]) OR project_id = $2
     )`,
    [employeeIds, projectId],
  );
  await db.query(
    `DELETE FROM timesheets
     WHERE employee_id = ANY($1::uuid[]) OR project_id = $2`,
    [employeeIds, projectId],
  );
  await db.query(`DELETE FROM leave_records WHERE employee_id = ANY($1::uuid[])`, [
    employeeIds,
  ]);
  await db.query(
    `DELETE FROM allocations
     WHERE employee_id = ANY($1::uuid[])
        OR backup_employee_id = ANY($1::uuid[])
        OR project_id = $2`,
    [employeeIds, projectId],
  );
  await db.query(`DELETE FROM tasks WHERE project_id = $1`, [projectId]);
  await db.query(`DELETE FROM project_phases WHERE project_id = $1`, [projectId]);
  await db.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
  // Orphan E2E projects from prior failed cleanups
  await db.query(
    `DELETE FROM timesheet_approvals WHERE timesheet_id IN (
       SELECT t.id FROM timesheets t
       JOIN projects p ON p.id = t.project_id
       WHERE p.name LIKE 'E2E M2 Resource Project - %'
     )`,
  );
  await db.query(
    `DELETE FROM timesheets WHERE project_id IN (
       SELECT id FROM projects WHERE name LIKE 'E2E M2 Resource Project - %'
     )`,
  );
  await db.query(
    `DELETE FROM allocations WHERE project_id IN (
       SELECT id FROM projects WHERE name LIKE 'E2E M2 Resource Project - %'
     )`,
  );
  await db.query(
    `DELETE FROM tasks WHERE project_id IN (
       SELECT id FROM projects WHERE name LIKE 'E2E M2 Resource Project - %'
     )`,
  );
  await db.query(
    `DELETE FROM project_phases WHERE project_id IN (
       SELECT id FROM projects WHERE name LIKE 'E2E M2 Resource Project - %'
     )`,
  );
  await db.query(
    `DELETE FROM projects WHERE name LIKE 'E2E M2 Resource Project - %'`,
  );
  await db.query(
    `DELETE FROM failed_sync_records WHERE entity_id LIKE 'M2-E2E%' OR error_msg LIKE 'M2 E2E%'`,
  );
  await db.query(
    `DELETE FROM keka_sync_log WHERE entity_id LIKE 'M2-E2E%' OR error_msg LIKE 'M2 E2E%'`,
  );
  await db.query(
    `DELETE FROM notifications WHERE user_id = ANY($1::uuid[])`,
    [[seed.engUserId, seed.backupUserId, seed.pmId, seed.itAdminId]],
  );
  await db.query(
    `DELETE FROM sessions WHERE user_id = ANY($1::uuid[])`,
    [[seed.engUserId, seed.backupUserId, seed.itAdminId]],
  );
  // Keep eng_m2_* users/employees for reuse across spec files (ON CONFLICT seed).
  // Deleting users triggers audit_log immutability errors in the DB.
  // Reset allocation policies to defaults
  await db.query(
    `UPDATE app_settings SET allocation_threshold_mode = 'warn', designation_mismatch_mode = 'warn', department_staffing_mode = 'off' WHERE id = 'default'`,
  );
}

export async function setAllocationThresholdMode(
  db: Client,
  mode: "warn" | "block" | "approve",
) {
  await db.query(
    `UPDATE app_settings SET allocation_threshold_mode = $1 WHERE id = 'default'`,
    [mode],
  );
}

export async function setDesignationMismatchMode(
  db: Client,
  mode: "off" | "warn" | "block",
) {
  await db.query(
    `UPDATE app_settings SET designation_mismatch_mode = $1 WHERE id = 'default'`,
    [mode],
  );
}

export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function offsetDateKey(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff),
  );
  return monday.toISOString().slice(0, 10);
}
