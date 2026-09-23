import {
  APIRequestContext,
  Download,
  Locator,
  Page,
  expect,
  test,
} from "@playwright/test";
import crypto from "crypto";
import type { Client } from "pg";

export { PM_EMAIL, ENG_EMAIL, BACKUP_ENG_EMAIL } from "./resources";
import {
  BACKUP_ENG_EMAIL,
  ENG_EMAIL,
  PM_EMAIL,
  gotoWithCommit,
  waitForAppReady,
} from "./resources";

/** Seeded by backend/prisma/seed.ts. */
export const SUPER_ADMIN_EMAIL = "bminilik12@gmail.com";
/** Created by seedPhase3Reporting — the backend seed ships no pmo_lead user. */
export const PMO_LEAD_EMAIL = "pmo.lead.m3@cybsec.com";
/** Second PM, used to prove cross-PM dashboard scoping. */
export const PM2_EMAIL = "pm2.m3@cybsec.com";

/** Matches APP_PORT / compose publish (3001). 6001 sits in a Windows Hyper-V excluded range. */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

/** docker-compose.dev.yml publishes the maildev web UI/API on host port 8025. */
export const MAILDEV_URL =
  process.env.PLAYWRIGHT_MAILDEV_URL ?? "http://localhost:8025";

export const M3_PROJECT_PREFIX = "E2E M3";

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export type Phase3Seed = {
  suffix: string;
  pmId: string;
  pm2Id: string;
  pmoLeadId: string;
  adminId: string;
  engUserId: string;
  engEmployeeId: string;
  eng2UserId: string;
  eng2EmployeeId: string;
  deptId: string;
  custId: string;
  /** Main reporting project — owned by PM_EMAIL, has milestones/tasks/actions. */
  projectId: string;
  projectName: string;
  /** Owned by PM2_EMAIL — must stay invisible to PM_EMAIL. */
  otherProjectId: string;
  otherProjectName: string;
  /** Active with no milestones — trips INCOMPLETE_PROJECT + MISSING_TIMESHEET. */
  incompleteProjectId: string;
  incompleteProjectName: string;
  phaseId: string;
  taskId: string;
  milestoneAlphaId: string;
  milestoneBetaId: string;
  actionPointId: string;
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

async function ensureEmployee(
  db: Client,
  userId: string,
  deptId: string,
  name: string,
  email: string,
  kekaId: string,
): Promise<string> {
  const res = await db.query(
    `INSERT INTO employees (id, user_id, department_id, keka_employee_id, designation, name, email, weekly_hours, is_active, synced_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'Software Engineer', $5, $6, 40, true, NOW(), NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET name = $5, is_active = true, weekly_hours = 40, keka_employee_id = $4
     RETURNING id`,
    [crypto.randomUUID(), userId, deptId, kekaId, name, email],
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

/**
 * Seed the Phase 3 reporting fixtures: PMO Lead, a second PM and two engineers,
 * plus three projects that exercise health, status reports and DQ scans.
 */
export async function seedPhase3Reporting(
  db: Client,
  options?: { projectSuffix?: string },
): Promise<Phase3Seed> {
  const suffix = options?.projectSuffix ?? String(Date.now());

  const pmId = await lookupId(
    db,
    "SELECT id FROM users WHERE email = $1",
    [PM_EMAIL],
    `PM user ${PM_EMAIL}`,
  );
  const adminId = await lookupId(
    db,
    "SELECT id FROM users WHERE email = $1",
    [SUPER_ADMIN_EMAIL],
    `Super admin ${SUPER_ADMIN_EMAIL}`,
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

  const pmoLeadId = await ensureUser(
    db,
    PMO_LEAD_EMAIL,
    "M3 Priya PMO Lead",
    "pmo_lead",
  );
  const pm2Id = await ensureUser(db, PM2_EMAIL, "M3 Omar Second PM", "pm");
  const engUserId = await ensureUser(
    db,
    ENG_EMAIL,
    "M2 Dave Engineer",
    "engineer",
  );
  const eng2UserId = await ensureUser(
    db,
    BACKUP_ENG_EMAIL,
    "M2 Backup Engineer",
    "engineer",
  );

  // Escalation / team-directory pickers require employee rows (requireUserId).
  await ensureEmployee(
    db,
    pmoLeadId,
    deptId,
    "M3 Priya PMO Lead",
    PMO_LEAD_EMAIL,
    "MOCK-KEKA-M3-PRIYA",
  );
  await ensureEmployee(
    db,
    pm2Id,
    deptId,
    "M3 Omar Second PM",
    PM2_EMAIL,
    "MOCK-KEKA-M3-OMAR",
  );
  const engEmployeeId = await ensureEmployee(
    db,
    engUserId,
    deptId,
    "M2 Dave Engineer",
    ENG_EMAIL,
    "MOCK-KEKA-M2-DAVE",
  );
  const eng2EmployeeId = await ensureEmployee(
    db,
    eng2UserId,
    deptId,
    "M2 Backup Engineer",
    BACKUP_ENG_EMAIL,
    "MOCK-KEKA-M2-BACKUP",
  );

  const insertProject = async (
    id: string,
    name: string,
    primaryPmId: string,
  ) => {
    await db.query(
      `INSERT INTO projects (id, name, objective, department_id, customer_id, engagement_type, billing_model, start_date, end_date, value, currency, primary_pm_id, status, created_by, created_at, updated_at)
       VALUES ($1, $2, 'Phase 3 reporting e2e', $3, $4, 'Managed Service', 'Fixed Price',
               CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '90 days',
               200000, 'USD', $5, 'Active', $5, NOW(), NOW())`,
      [id, name, deptId, custId, primaryPmId],
    );
  };

  // Created oldest → newest so the dashboard (createdAt desc, take 6) shows all
  // three, with the main reporting project first.
  const otherProjectId = crypto.randomUUID();
  const otherProjectName = `${M3_PROJECT_PREFIX} Other PM Project - ${suffix}`;
  await insertProject(otherProjectId, otherProjectName, pm2Id);
  await db.query(
    `INSERT INTO project_milestones (id, project_id, title, target_date, weight, status, created_at)
     VALUES ($1, $2, 'Other PM milestone', CURRENT_DATE + INTERVAL '21 days', 100, 'Pending', NOW())`,
    [crypto.randomUUID(), otherProjectId],
  );

  const incompleteProjectId = crypto.randomUUID();
  const incompleteProjectName = `${M3_PROJECT_PREFIX} Incomplete Project - ${suffix}`;
  await insertProject(incompleteProjectId, incompleteProjectName, pmId);

  const projectId = crypto.randomUUID();
  const projectName = `${M3_PROJECT_PREFIX} Reporting Project - ${suffix}`;
  await insertProject(projectId, projectName, pmId);

  const phaseId = crypto.randomUUID();
  await db.query(
    `INSERT INTO project_phases (id, project_id, name, description, start_date, end_date, status, order_index, created_at, updated_at)
     VALUES ($1, $2, 'Delivery', 'Delivery phase', CURRENT_DATE, CURRENT_DATE + INTERVAL '60 days', 'Planned', 0, NOW(), NOW())`,
    [phaseId, projectId],
  );

  const milestoneAlphaId = crypto.randomUUID();
  const milestoneBetaId = crypto.randomUUID();
  await db.query(
    `INSERT INTO project_milestones (id, project_id, phase_id, title, target_date, weight, status, created_at)
     VALUES ($1, $2, $3, 'M3 Milestone Alpha', CURRENT_DATE + INTERVAL '14 days', 50, 'Pending', NOW()),
            ($4, $2, $3, 'M3 Milestone Beta', CURRENT_DATE + INTERVAL '30 days', 50, 'Pending', NOW())`,
    [milestoneAlphaId, projectId, phaseId, milestoneBetaId],
  );

  const taskId = crypto.randomUUID();
  await db.query(
    `INSERT INTO tasks (id, project_id, phase_id, title, description, priority, owner_id, start_date, end_date, effort_hours, progress_approved, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'M3 Reporting Task', 'Phase 3 reporting task', 'Medium', $4,
             CURRENT_DATE, CURRENT_DATE + INTERVAL '20 days', 16, 0, 'In Progress', NOW(), NOW())`,
    [taskId, projectId, phaseId, engUserId],
  );

  // Overdue + open → surfaces in the report "Open action points" section.
  const actionPointId = crypto.randomUUID();
  await db.query(
    `INSERT INTO action_points (id, source_type, source_id, project_id, owner_id, title, due_date, priority, status, created_at)
     VALUES ($1, 'Project', $2, $2, $3, 'M3 overdue action point', CURRENT_DATE - INTERVAL '3 days', 'High', 'Open', NOW())`,
    [actionPointId, projectId, engUserId],
  );

  await db.query(
    `INSERT INTO allocations (id, employee_id, project_id, role, hours, percent, start_date, end_date, status, approved_by, created_at)
     VALUES ($1, $2, $3, 'Software Engineer', 20, 50, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '90 days', 'Active', $4, NOW())`,
    [crypto.randomUUID(), engEmployeeId, projectId, pmId],
  );
  // Allocation with no timesheet at all → MISSING_TIMESHEET on the incomplete project.
  await db.query(
    `INSERT INTO allocations (id, employee_id, project_id, role, hours, percent, start_date, end_date, status, approved_by, created_at)
     VALUES ($1, $2, $3, 'Software Engineer', 10, 25, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '90 days', 'Active', $4, NOW())`,
    [crypto.randomUUID(), eng2EmployeeId, incompleteProjectId, pmId],
  );

  // Submitted (not approved) hours this week → UNAPPROVED_TIMESHEET.
  await db.query(
    `INSERT INTO timesheets (id, employee_id, project_id, task_id, work_date, regular_hours, overtime_hours, notes, is_billable, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_DATE, 6, 0, 'M3 awaiting approval', true, 'Submitted', NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    [crypto.randomUUID(), engEmployeeId, projectId, taskId],
  );

  return {
    suffix,
    pmId,
    pm2Id,
    pmoLeadId,
    adminId,
    engUserId,
    engEmployeeId,
    eng2UserId,
    eng2EmployeeId,
    deptId,
    custId,
    projectId,
    projectName,
    otherProjectId,
    otherProjectName,
    incompleteProjectId,
    incompleteProjectName,
    phaseId,
    taskId,
    milestoneAlphaId,
    milestoneBetaId,
    actionPointId,
  };
}

async function purgeProjects(db: Client, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  // Meetings and MoM rows have no cascade from meetings, so unwind by hand.
  await db.query(
    `DELETE FROM mom_acknowledgements WHERE mom_id IN (
       SELECT d.id FROM mom_documents d
       JOIN meetings m ON m.id = d.meeting_id
       WHERE m.project_id = ANY($1::uuid[])
     )`,
    [ids],
  );
  await db.query(
    `DELETE FROM mom_documents WHERE meeting_id IN (
       SELECT id FROM meetings WHERE project_id = ANY($1::uuid[])
     )`,
    [ids],
  );
  await db.query(
    `DELETE FROM meeting_items WHERE meeting_id IN (
       SELECT id FROM meetings WHERE project_id = ANY($1::uuid[])
     )`,
    [ids],
  );
  await db.query(
    `DELETE FROM meeting_attendees WHERE meeting_id IN (
       SELECT id FROM meetings WHERE project_id = ANY($1::uuid[])
     )`,
    [ids],
  );
  await db.query(`DELETE FROM meetings WHERE project_id = ANY($1::uuid[])`, [
    ids,
  ]);

  await db.query(
    `DELETE FROM report_schedule_recipients WHERE schedule_id IN (
       SELECT id FROM report_schedules WHERE project_id = ANY($1::uuid[])
     )`,
    [ids],
  );
  await db.query(
    `DELETE FROM report_schedules WHERE project_id = ANY($1::uuid[])`,
    [ids],
  );

  await db.query(
    `DELETE FROM generated_reports WHERE project_id = ANY($1::uuid[])`,
    [ids],
  );
  await db.query(
    `DELETE FROM data_quality_flags WHERE project_id = ANY($1::uuid[])`,
    [ids],
  );
  await db.query(`DELETE FROM kpi_snapshots WHERE project_id = ANY($1::uuid[])`, [
    ids,
  ]);
  await db.query(`DELETE FROM action_points WHERE project_id = ANY($1::uuid[])`, [
    ids,
  ]);
  await db.query(`DELETE FROM risks WHERE project_id = ANY($1::uuid[])`, [ids]);
  await db.query(`DELETE FROM issues WHERE project_id = ANY($1::uuid[])`, [ids]);
  await db.query(
    `DELETE FROM lessons_learned WHERE project_id = ANY($1::uuid[])`,
    [ids],
  );
  await db.query(
    `DELETE FROM timesheet_approvals WHERE timesheet_id IN (
       SELECT id FROM timesheets WHERE project_id = ANY($1::uuid[])
     )`,
    [ids],
  );
  await db.query(`DELETE FROM timesheets WHERE project_id = ANY($1::uuid[])`, [
    ids,
  ]);
  await db.query(`DELETE FROM allocations WHERE project_id = ANY($1::uuid[])`, [
    ids,
  ]);
  await db.query(`DELETE FROM tasks WHERE project_id = ANY($1::uuid[])`, [ids]);
  await db.query(
    `DELETE FROM project_milestones WHERE project_id = ANY($1::uuid[])`,
    [ids],
  );
  await db.query(
    `DELETE FROM project_phases WHERE project_id = ANY($1::uuid[])`,
    [ids],
  );
  await db.query(`DELETE FROM projects WHERE id = ANY($1::uuid[])`, [ids]);
}

export async function cleanupPhase3Reporting(
  db: Client,
  seed: Phase3Seed,
): Promise<void> {
  const projectIds = [
    seed.projectId,
    seed.otherProjectId,
    seed.incompleteProjectId,
  ];
  const employeeIds = [seed.engEmployeeId, seed.eng2EmployeeId];
  const userIds = [
    seed.pmoLeadId,
    seed.pm2Id,
    seed.engUserId,
    seed.eng2UserId,
    seed.pmId,
  ];

  await purgeProjects(db, projectIds);

  // Timesheets / allocations can outlive the project when a spec moved them.
  await db.query(
    `DELETE FROM timesheet_approvals WHERE timesheet_id IN (
       SELECT id FROM timesheets WHERE employee_id = ANY($1::uuid[])
     )`,
    [employeeIds],
  );
  await db.query(`DELETE FROM timesheets WHERE employee_id = ANY($1::uuid[])`, [
    employeeIds,
  ]);
  await db.query(`DELETE FROM allocations WHERE employee_id = ANY($1::uuid[])`, [
    employeeIds,
  ]);

  // Portfolio-wide integration flag is recreated by every scan.
  await db.query(
    `DELETE FROM data_quality_flags WHERE project_id IS NULL AND flag_type = 'STALE_INTEGRATION'`,
  );

  await db.query(`DELETE FROM notifications WHERE user_id = ANY($1::uuid[])`, [
    userIds,
  ]);
  await db.query(`DELETE FROM sessions WHERE user_id = ANY($1::uuid[])`, [
    [seed.pmoLeadId, seed.pm2Id, seed.engUserId, seed.eng2UserId],
  ]);

  // Scan rules are global — reset so a rerun starts from "everything included".
  await db.query(
    `UPDATE app_settings SET data_quality_rules = '{}'::jsonb WHERE id = 'default'`,
  );

  // Users/employees are kept: deleting them trips audit-log immutability.
}

/** Remove projects left behind by an interrupted phase 3 run. */
export async function cleanupOrphanPhase3Projects(db: Client): Promise<void> {
  const orphans = await db.query(`SELECT id FROM projects WHERE name LIKE $1`, [
    `${M3_PROJECT_PREFIX} %`,
  ]);
  await purgeProjects(
    db,
    orphans.rows.map((row) => row.id as string),
  );
}

// ─── Health rules ────────────────────────────────────────────────────────────

/** Mirrors backend/src/reports/health/health-rules.constants.ts. */
export const DEFAULT_HEALTH_RULES = [
  { dimension: "schedule", greenThreshold: 85, amberThreshold: 60, redThreshold: 0, unit: "%" },
  { dimension: "cost", greenThreshold: 90, amberThreshold: 70, redThreshold: 0, unit: "%" },
  { dimension: "risk", greenThreshold: 80, amberThreshold: 50, redThreshold: 0, unit: "%" },
  { dimension: "resources", greenThreshold: 75, amberThreshold: 50, redThreshold: 0, unit: "%" },
  { dimension: "collections", greenThreshold: 80, amberThreshold: 50, redThreshold: 0, unit: "%" },
];

export type HealthEvaluation = {
  projectId: string;
  projectName: string;
  overallRag: string;
  dimensions: Array<{
    dimension: string;
    score: number;
    ragStatus: string;
    ruleVersion: string;
    value: Record<string, unknown>;
  }>;
  evaluatedAt: string;
  source: string;
};

export async function getProjectHealth(
  request: APIRequestContext,
  token: string,
  projectId: string,
): Promise<HealthEvaluation> {
  const response = await request.get(
    `${API_URL}/reports/health/projects/${projectId}`,
    { headers: bearer(token) },
  );
  expect(response.status()).toBe(200);
  return (await response.json()) as HealthEvaluation;
}

export function dimension(health: HealthEvaluation, name: string) {
  const found = health.dimensions.find((item) => item.dimension === name);
  if (!found) throw new Error(`Health dimension ${name} missing`);
  return found;
}

/** Restore the seeded RAG thresholds so a failed run never poisons the next. */
export async function restoreDefaultHealthRules(
  request: APIRequestContext,
  token: string,
): Promise<void> {
  await request.put(`${API_URL}/reports/health-rules`, {
    headers: bearer(token),
    data: DEFAULT_HEALTH_RULES.map((rule) => ({ ...rule, isActive: true })),
  });
}

/** Clear the include/exclude scan rules so every data-quality check runs. */
export async function resetDataQualityRules(
  request: APIRequestContext,
  token: string,
): Promise<void> {
  await request.put(`${API_URL}/reports/data-quality/rules`, {
    headers: bearer(token),
    data: { includeFlagTypes: [], excludeFlagTypes: [] },
  });
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

/** Native <select> located by one of its option labels (pages use plain selects). */
export function selectWithOption(page: Page, optionLabel: string): Locator {
  return page.locator(`select:has(option:text-is("${optionLabel}"))`).first();
}

/** Segmented Include/Exclude control for one data-quality check. */
export function scanRuleGroup(page: Page, title: string): Locator {
  return page.getByRole("radiogroup", { name: `${title} scan rule` });
}

export async function setScanRule(
  page: Page,
  title: string,
  mode: "Include" | "Exclude",
): Promise<void> {
  const option = scanRuleGroup(page, title).getByRole("radio", {
    name: mode,
    exact: true,
  });
  await option.click();
  await expect(option).toHaveAttribute("aria-checked", "true");
}

/** Newest generated report id for a project + type, straight from the DB. */
export async function latestReportId(
  db: Client,
  projectId: string,
  reportType: "WSR" | "MSR",
): Promise<{ id: string; version: number; status: string }> {
  const res = await db.query(
    `SELECT id, version, status FROM generated_reports
      WHERE project_id = $1 AND report_type = $2
      ORDER BY version DESC LIMIT 1`,
    [projectId, reportType],
  );
  if (!res.rows[0]) {
    throw new Error(`No ${reportType} generated for project ${projectId}`);
  }
  return {
    id: res.rows[0].id as string,
    version: Number(res.rows[0].version),
    status: res.rows[0].status as string,
  };
}

/**
 * Generate a WSR/MSR from the Status Reports page toolbar.
 *
 * The success toast is the only signal that generation finished, so a toast left
 * over from an earlier call in the same test has to clear first — otherwise a
 * second call matches the stale toast and returns before the new version exists.
 */
export async function generateStatusReport(
  page: Page,
  projectId: string,
  reportType: "WSR" | "MSR",
): Promise<void> {
  const toast = page
    .getByText(new RegExp(`${reportType} v\\d+ generated`))
    .first();
  if (await toast.isVisible().catch(() => false)) {
    await expect(toast).toBeHidden({ timeout: 30000 });
  }

  await selectWithOption(page, "Select project to generate").selectOption(
    projectId,
  );
  await page
    .locator('select:has(option[value="WSR"])')
    .first()
    .selectOption(reportType);
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(toast).toBeVisible({ timeout: 60000 });
}

/** The status-reports list row that links to a given report id. */
export function statusReportRow(page: Page, reportId: string): Locator {
  return page
    .locator("div")
    .filter({
      has: page.locator(`a[href$="/dashboard/reports/status/${reportId}"]`),
    })
    .last();
}

/** Health rule card for one RAG dimension on Settings → Health rules. */
export function healthRuleCard(page: Page, dimension: string): Locator {
  return page
    .locator("div.grid")
    .filter({ has: page.getByText(dimension, { exact: true }) })
    .first();
}

/** Set the green/amber thresholds of one dimension in the Settings UI. */
export async function setHealthThresholds(
  page: Page,
  dimension: string,
  green: number,
  amber: number,
): Promise<void> {
  const card = healthRuleCard(page, dimension);
  await expect(card).toBeVisible({ timeout: 30000 });
  await card.getByRole("spinbutton").nth(0).fill(String(green));
  await card.getByRole("spinbutton").nth(1).fill(String(amber));
}

/** A data-quality flags table row for one flag type on one project. */
export function flagRow(
  page: Page,
  flagType: string,
  projectName: string,
): Locator {
  return page
    .getByRole("row")
    .filter({ hasText: flagType })
    .filter({ hasText: projectName })
    .first();
}

/** The meeting accordion row for a given meeting title. */
export function meetingRow(page: Page, title: string): Locator {
  return page.locator("li").filter({ hasText: title }).first();
}

/** The nested "Minutes vN" row inside an expanded meeting accordion. */
export function momRow(page: Page, version: number): Locator {
  return page
    .locator("li")
    .filter({ has: page.getByText(`Minutes v${version}`, { exact: true }) })
    .last();
}

/** Open a project workspace straight onto the Meetings & MoM tab. */
export async function openMeetingsTab(
  page: Page,
  projectId: string,
): Promise<void> {
  await gotoWithCommit(page, `/en/dashboard/projects/${projectId}?view=meetings`);
  await waitForAppReady(page);
  await expect(
    page.getByRole("heading", { name: /Meetings & MoM|Minutes of Meeting/ }),
  ).toBeVisible({ timeout: 90000 });
}

/**
 * Pick a selectable day in a ProjectDatePicker popover.
 *
 * Prefer today. The meetings sheet passes minDate=2000-01-01, which makes the
 * calendar's defaultMonth open on January of the current year — clicking the
 * first enabled day then silently schedules the meeting for Jan 1.
 */
export async function pickFirstAvailableDate(page: Page): Promise<void> {
  const trigger = page.getByRole("button", { name: /Pick a date/i }).first();
  await trigger.click();
  const calendar = page.locator('[data-slot="calendar"]');
  await expect(calendar).toBeVisible({ timeout: 15000 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toLocaleDateString();

  let picked = false;
  for (let i = 0; i < 18; i++) {
    const todayBtn = calendar.locator(
      `button[data-day="${todayKey}"]:not([disabled])`,
    );
    if ((await todayBtn.count()) > 0) {
      await todayBtn.first().click();
      picked = true;
      break;
    }
    const next = calendar.getByRole("button", {
      name: /go to the next month|next month/i,
    });
    if (await next.isDisabled().catch(() => true)) break;
    await next.click();
  }

  if (!picked) {
    await calendar.locator("button[data-day]:not([disabled])").last().click();
  }

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /Pick a date/i }),
  ).toHaveCount(0, { timeout: 10000 });
}

/**
 * Run an action that triggers a browser download and store the file beside the
 * test artifacts so it can be attached as UAT evidence.
 */
export async function downloadEvidence(
  page: Page,
  action: () => Promise<void>,
  expectedExtension: string,
): Promise<Download> {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 90000 }),
    action(),
  ]);
  expect(download.suggestedFilename().toLowerCase()).toContain(
    expectedExtension.toLowerCase(),
  );
  await download.saveAs(
    test.info().outputPath("exports", download.suggestedFilename()),
  );
  return download;
}

/** Export a status report from its list-row dropdown. */
export async function exportStatusReport(
  page: Page,
  reportId: string,
  format: "PDF" | "DOCX" | "Excel" | "CSV",
  extension: string,
): Promise<Download> {
  const row = statusReportRow(page, reportId);
  const trigger = row.getByRole("button", { name: /Export/i });
  await expect(trigger).toBeEnabled({ timeout: 30000 });
  await trigger.click();
  const menu = page.locator('[role="menu"]').last();
  await expect(menu).toBeVisible({ timeout: 15000 });
  return downloadEvidence(
    page,
    () => menu.getByRole("menuitem", { name: format, exact: true }).click(),
    extension,
  );
}

// ─── Maildev helpers ─────────────────────────────────────────────────────────

export type MailMessage = {
  id: string;
  subject: string;
  html?: string;
  text?: string;
  to?: Array<{ address?: string }>;
  attachments?: Array<{ fileName?: string; generatedFileName?: string }>;
};

/** Maildev is optional in some environments — email assertions degrade to soft. */
export async function maildevAvailable(
  request: APIRequestContext,
): Promise<boolean> {
  const response = await request.get(`${MAILDEV_URL}/email`).catch(() => null);
  return Boolean(response?.ok());
}

export async function clearMailbox(request: APIRequestContext): Promise<void> {
  await request.delete(`${MAILDEV_URL}/email/all`).catch(() => undefined);
}

export async function listMail(
  request: APIRequestContext,
): Promise<MailMessage[]> {
  const response = await request.get(`${MAILDEV_URL}/email`).catch(() => null);
  if (!response || !response.ok()) return [];
  return (await response.json()) as MailMessage[];
}

/** Poll maildev until a message matches, or return null when it never arrives. */
export async function waitForMail(
  request: APIRequestContext,
  predicate: (mail: MailMessage) => boolean,
  timeoutMs = 45000,
): Promise<MailMessage | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = (await listMail(request)).find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

export function mailRecipients(mail: MailMessage): string[] {
  return (mail.to ?? [])
    .map((entry) => entry.address?.toLowerCase())
    .filter((address): address is string => Boolean(address));
}

export function mailAttachmentNames(mail: MailMessage): string[] {
  return (mail.attachments ?? [])
    .map((entry) => entry.fileName ?? entry.generatedFileName ?? "")
    .filter(Boolean);
}
