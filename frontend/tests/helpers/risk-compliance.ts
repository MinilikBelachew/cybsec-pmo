import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import crypto from "crypto";
import type { Client } from "pg";
import {
  API_URL,
  Phase3Seed,
  bearer,
  cleanupPhase3Reporting,
  cleanupOrphanPhase3Projects,
  seedPhase3Reporting,
} from "./reporting";
import {
  gotoWithCommit,
  holdForVideo,
  selectDropdown,
  waitForAppReady,
} from "./resources";

export {
  API_URL,
  ENG_EMAIL,
  PM_EMAIL,
  PMO_LEAD_EMAIL,
  SUPER_ADMIN_EMAIL,
  bearer,
  cleanupOrphanPhase3Projects,
} from "./reporting";

export const M4_PROJECT_PREFIX = "E2E M4";

export type Phase4Seed = Phase3Seed & {
  /** Active RISK_SCORE_BREACHED catalogue rule (scoreGte 12). */
  riskScoreRuleId: string;
  /** Active ISSUE_ESCALATED catalogue rule. */
  issueEscalationRuleId: string;
  /** Risk owned by the engineer — used for status-only / ownership tests. */
  engOwnedRiskId: string;
  engOwnedRiskTitle: string;
  /** Org-wide lesson used for surface / search tests. */
  lessonId: string;
  lessonDescription: string;
  /** Customer label shown in escalation UI. */
  customerDisplayName: string;
  pmoLeadRoleId: number;
  pmRoleId: number;
};

async function roleId(db: Client, code: string): Promise<number> {
  const res = await db.query("SELECT id FROM roles WHERE code = $1 LIMIT 1", [
    code,
  ]);
  if (!res.rows[0]) throw new Error(`Role ${code} not found — run backend seed`);
  return res.rows[0].id as number;
}

async function insertAlertRule(
  db: Client,
  options: {
    eventType: string;
    thresholdConfig: Record<string, unknown>;
    recipientRoleIds: number[];
    escalationRole?: string;
    reminderCadenceHrs?: number;
    escalationDelayHrs?: number;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO alert_rules (
       id, event_type, threshold_config, channels, reminder_cadence_hrs,
       escalation_delay_hrs, escalation_role, is_active, created_at, updated_at
     ) VALUES (
       $1, $2, $3::jsonb, ARRAY['in_app','email']::text[], $4, $5, $6, true, NOW(), NOW()
     )`,
    [
      id,
      options.eventType,
      JSON.stringify(options.thresholdConfig),
      options.reminderCadenceHrs ?? 24,
      options.escalationDelayHrs ?? 48,
      options.escalationRole ?? "pmo_lead",
    ],
  );
  for (const rid of options.recipientRoleIds) {
    await db.query(
      `INSERT INTO alert_rule_recipients (id, rule_id, role_id)
       VALUES ($1, $2, $3)`,
      [crypto.randomUUID(), id, rid],
    );
  }
  return id;
}

/**
 * Remove leftover M4-prefixed projects from aborted runs.
 */
export async function cleanupOrphanPhase4Projects(db: Client): Promise<void> {
  const orphans = await db.query(`SELECT id FROM projects WHERE name LIKE $1`, [
    `${M4_PROJECT_PREFIX} %`,
  ]);
  // Reuse Phase 3 purge by temporarily matching — delete via direct SQL for M4 names.
  const ids = orphans.rows.map((row) => row.id as string);
  if (ids.length === 0) return;
  await db.query(`DELETE FROM action_points WHERE project_id = ANY($1::uuid[])`, [
    ids,
  ]);
  await db.query(`DELETE FROM risks WHERE project_id = ANY($1::uuid[])`, [ids]);
  await db.query(`DELETE FROM issues WHERE project_id = ANY($1::uuid[])`, [ids]);
  await db.query(
    `DELETE FROM lessons_learned WHERE project_id = ANY($1::uuid[])`,
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

/**
 * Phase 4 fixtures: reuses Phase 3 users/projects, then adds alert catalogue
 * rules, an engineer-owned risk, and a searchable lesson.
 */
export async function seedPhase4RiskCompliance(
  db: Client,
  options?: { projectSuffix?: string },
): Promise<Phase4Seed> {
  const suffix = options?.projectSuffix ?? String(Date.now());
  const base = await seedPhase3Reporting(db, {
    projectSuffix: `m4-${suffix}`,
  });

  // Rename the main project so list filters / evidence show an M4 prefix.
  const projectName = `${M4_PROJECT_PREFIX} Risk Project - ${suffix}`;
  await db.query(`UPDATE projects SET name = $1 WHERE id = $2`, [
    projectName,
    base.projectId,
  ]);

  const pmoLeadRoleId = await roleId(db, "pmo_lead");
  const pmRoleId = await roleId(db, "pm");

  const riskScoreRuleId = await insertAlertRule(db, {
    eventType: "RISK_SCORE_BREACHED",
    thresholdConfig: { scoreGte: 12 },
    recipientRoleIds: [pmoLeadRoleId, pmRoleId],
  });
  const issueEscalationRuleId = await insertAlertRule(db, {
    eventType: "ISSUE_ESCALATED",
    thresholdConfig: {},
    recipientRoleIds: [pmoLeadRoleId, pmRoleId],
  });

  const engOwnedRiskId = crypto.randomUUID();
  const engOwnedRiskTitle = `M4 Eng Owned Risk ${suffix}`;
  await db.query(
    `INSERT INTO risks (
       id, project_id, title, category, impact, likelihood, score, owner_id,
       mitigation_plan, status, created_at, updated_at
     ) VALUES (
       $1, $2, $3, 'TECHNICAL', 2, 2, 4, $4,
       'Engineer-owned mitigation', 'Open', NOW(), NOW()
     )`,
    [engOwnedRiskId, base.projectId, engOwnedRiskTitle, base.engUserId],
  );

  const lessonId = crypto.randomUUID();
  const lessonDescription = `M4 docker networking lesson ${suffix}`;
  await db.query(
    `INSERT INTO lessons_learned (
       id, project_id, category, description, recommendation, tags, author_id, created_at
     ) VALUES (
       $1, NULL, 'DEPLOYMENT', $2, 'Use a relational compose wrapper',
       ARRAY['m4','docker']::text[], $3, NOW()
     )`,
    [lessonId, lessonDescription, base.pmoLeadId],
  );

  const cust = await db.query(
    `SELECT display_name FROM customers WHERE id = $1`,
    [base.custId],
  );
  const customerDisplayName =
    (cust.rows[0]?.display_name as string) || "Acme Financial Services";

  return {
    ...base,
    projectName,
    customerDisplayName,
    riskScoreRuleId,
    issueEscalationRuleId,
    engOwnedRiskId,
    engOwnedRiskTitle,
    lessonId,
    lessonDescription,
    pmoLeadRoleId,
    pmRoleId,
  };
}

export async function cleanupPhase4RiskCompliance(
  db: Client,
  seed: Phase4Seed,
): Promise<void> {
  // Wipe catalogue (seed + any UI-created rules from this suite).
  await db.query(`DELETE FROM alert_events`);
  await db.query(`DELETE FROM alert_rule_recipients`);
  await db.query(`DELETE FROM alert_rules`);

  // Escalations are customer-scoped (no project FK) — wipe ones owned by suite users.
  const userIds = [
    seed.pmoLeadId,
    seed.pmId,
    seed.pm2Id,
    seed.engUserId,
    seed.eng2UserId,
  ];
  await db.query(
    `DELETE FROM escalation_communications WHERE escalation_id IN (
       SELECT id FROM customer_escalations WHERE owner_id = ANY($1::uuid[])
     )`,
    [userIds],
  );
  await db.query(
    `DELETE FROM customer_escalations WHERE owner_id = ANY($1::uuid[])`,
    [userIds],
  );

  await db.query(`DELETE FROM lessons_learned WHERE id = $1 OR author_id = $2`, [
    seed.lessonId,
    seed.pmoLeadId,
  ]);

  // Project-scoped risks/issues cascade on project delete in cleanupPhase3Reporting.
  await cleanupPhase3Reporting(db, seed);
}

export async function createRiskViaApi(
  request: APIRequestContext,
  token: string,
  projectId: string,
  body: {
    title: string;
    category?: string;
    impact: number;
    likelihood: number;
    ownerId: string;
    mitigationPlan?: string;
    residualImpact?: number;
    residualLikelihood?: number;
    status?: string;
  },
) {
  const response = await request.post(
    `${API_URL}/projects/${projectId}/risks`,
    {
      headers: bearer(token),
      data: {
        category: "TECHNICAL",
        status: "Open",
        ...body,
      },
    },
  );
  return response;
}

export async function createIssueViaApi(
  request: APIRequestContext,
  token: string,
  projectId: string,
  body: {
    title: string;
    priority: string;
    ownerId: string;
    dueDate: string;
    expectedResolutionDate?: string;
    status?: string;
  },
) {
  return request.post(`${API_URL}/projects/${projectId}/issues`, {
    headers: bearer(token),
    data: { status: "Open", ...body },
  });
}

export async function createAlertRuleViaApi(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>,
) {
  return request.post(`${API_URL}/alerts/catalogue`, {
    headers: bearer(token),
    data: body,
  });
}

export async function createLessonViaApi(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>,
) {
  return request.post(`${API_URL}/lessons`, {
    headers: bearer(token),
    data: body,
  });
}

export async function createEscalationViaApi(
  request: APIRequestContext,
  token: string,
  body: Record<string, unknown>,
) {
  return request.post(`${API_URL}/escalations`, {
    headers: bearer(token),
    data: body,
  });
}

/** Fill a labelled number input inside the visible sheet/dialog. */
export async function fillNumberByLabel(
  page: Page,
  label: string | RegExp,
  value: string,
) {
  let scope = page.locator('[role="dialog"]:visible');
  if ((await scope.count()) === 0) {
    scope = page.locator("body");
  }
  const container = scope
    .locator("label")
    .filter({ hasText: label })
    .first()
    .locator("xpath=..");
  const input = container.locator("input").first();
  await input.fill(value);
}

/** Fill a labelled text input / textarea inside the visible sheet/dialog. */
export async function fillTextByLabel(
  page: Page,
  label: string | RegExp,
  value: string,
) {
  let scope = page.locator('[role="dialog"]:visible');
  if ((await scope.count()) === 0) {
    scope = page.locator("body");
  }
  const container = scope
    .locator("label")
    .filter({ hasText: label })
    .first()
    .locator("xpath=..");
  const input = container.locator("input, textarea").first();
  await input.fill(value);
}

export async function openRiskCreateSheet(page: Page) {
  await page.getByRole("button", { name: "Add risk" }).click();
  await expect(
    page.getByRole("heading", { name: "New risk" }),
  ).toBeVisible({ timeout: 30000 });
  await holdForVideo(page, 1500);
}

/** Pick a date in a labelled ProjectDatePicker inside the open sheet. */
export async function pickDateByLabel(
  page: Page,
  label: string | RegExp,
): Promise<void> {
  let scope = page.locator('[role="dialog"]:visible');
  if ((await scope.count()) === 0) {
    scope = page.locator('[data-slot="sheet-content"]');
  }
  if ((await scope.count()) === 0) {
    scope = page.locator("body");
  }
  const container = scope
    .locator("label")
    .filter({ hasText: label })
    .first()
    .locator("xpath=..");
  await container.getByRole("button", { name: /Pick a date/i }).click();
  const calendar = page.locator('[data-slot="calendar"]');
  await expect(calendar).toBeVisible({ timeout: 15000 });
  const enabled = calendar.locator("button[data-day]:not([disabled])");
  await expect(enabled.first()).toBeVisible({ timeout: 10000 });
  await enabled.first().click();
  await expect(calendar).toBeHidden({ timeout: 10000 }).catch(() => undefined);
}

/**
 * Pick a clearly future date for fields whose calendar opens on an old minDate
 * (e.g. Expected resolution minDate=2000-01-01).
 */
export async function pickFutureDateByLabel(
  page: Page,
  label: string | RegExp,
): Promise<void> {
  let scope = page.locator('[role="dialog"]:visible');
  if ((await scope.count()) === 0) {
    scope = page.locator('[data-slot="sheet-content"]');
  }
  if ((await scope.count()) === 0) {
    scope = page.locator("body");
  }
  const container = scope
    .locator("label")
    .filter({ hasText: label })
    .first()
    .locator("xpath=..");
  const trigger = container.getByRole("button", {
    name: /Pick a date|[A-Z][a-z]{2} \d/i,
  });
  await trigger.click();
  const calendar = page.locator('[data-slot="calendar"]');
  await expect(calendar).toBeVisible({ timeout: 15000 });

  const target = new Date();
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 14);
  const targetKey = target.toLocaleDateString();

  let picked = false;
  for (let i = 0; i < 24; i++) {
    const dayBtn = calendar.locator(
      `button[data-day="${targetKey}"]:not([disabled])`,
    );
    if ((await dayBtn.count()) > 0) {
      await dayBtn.first().click();
      picked = true;
      break;
    }
    const next = calendar.getByRole("button", {
      name: /go to the next month|next month/i,
    });
    if (await next.isDisabled().catch(() => true)) break;
    await next.click();
    await page.waitForTimeout(200);
  }

  if (!picked) {
    // Fallback: last enabled day on the visible month (after navigating forward).
    const enabled = calendar.locator("button[data-day]:not([disabled])");
    await expect(enabled.last()).toBeVisible({ timeout: 10000 });
    await enabled.last().click();
  }

  await expect(calendar).toBeHidden({ timeout: 10000 }).catch(() => undefined);
}

/** Pick a past due date (within project window) for overdue action-point flows. */
export async function pickPastDateByLabel(
  page: Page,
  label: string | RegExp,
  daysAgo = 5,
): Promise<void> {
  let scope = page.locator('[role="dialog"]:visible');
  if ((await scope.count()) === 0) {
    scope = page.locator("body");
  }
  const container = scope
    .locator("label")
    .filter({ hasText: label })
    .first()
    .locator("xpath=..");
  const trigger = container.getByRole("button", {
    name: /Pick a due date|Pick a date|[A-Z][a-z]{2} \d/i,
  });
  await trigger.click();
  const calendar = page.locator('[data-slot="calendar"]');
  await expect(calendar).toBeVisible({ timeout: 15000 });

  const target = new Date();
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() - daysAgo);
  const targetKey = target.toLocaleDateString();

  let picked = false;
  for (let i = 0; i < 24; i++) {
    const dayBtn = calendar.locator(
      `button[data-day="${targetKey}"]:not([disabled])`,
    );
    if ((await dayBtn.count()) > 0) {
      await dayBtn.first().click();
      picked = true;
      break;
    }
    const prev = calendar.getByRole("button", {
      name: /go to the previous month|previous month/i,
    });
    if (await prev.isDisabled().catch(() => true)) break;
    await prev.click();
    await page.waitForTimeout(200);
  }

  if (!picked) {
    const enabled = calendar.locator("button[data-day]:not([disabled])");
    await expect(enabled.first()).toBeVisible({ timeout: 10000 });
    await enabled.first().click();
  }

  await expect(calendar).toBeHidden({ timeout: 10000 }).catch(() => undefined);
}

/** Open Issue Tracker details sheet for a row by title. */
export async function openIssueDetailsFromUi(page: Page, title: string) {
  const row = page.getByRole("row").filter({ hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  await row.scrollIntoViewIfNeeded();
  await holdForVideo(page, 800);
  await row.getByRole("button", { name: /View issue/i }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({
    timeout: 30000,
  });
  await holdForVideo(page, 2000);
}

/** Open in-app notifications page and wait for a matching title/body. */
export async function openInAppNotifications(
  page: Page,
  match: string | RegExp,
) {
  await gotoWithCommit(page, "/en/dashboard/notifications");
  await waitForAppReady(page);
  await holdForVideo(page, 1500);
  await expect(page.getByText(match).first()).toBeVisible({ timeout: 60000 });
  await holdForVideo(page, 3500);
}

export async function createRiskFromUi(
  page: Page,
  options: {
    projectName: string;
    title: string;
    ownerLabel: string;
    impact: number;
    likelihood: number;
    mitigation?: string;
  },
) {
  await openRiskCreateSheet(page);
  await selectDropdown(page, "Project", options.projectName);
  await holdForVideo(page, 1200);
  await page.waitForTimeout(800);
  await page.getByPlaceholder("Risk title").fill(options.title);
  await holdForVideo(page, 800);
  await selectDropdown(page, "Owner", options.ownerLabel);
  await holdForVideo(page, 800);
  await fillNumberByLabel(page, /Impact/, String(options.impact));
  await fillNumberByLabel(page, /Likelihood/, String(options.likelihood));
  await holdForVideo(page, 1200);
  if (options.mitigation) {
    await page.getByPlaceholder(/Mitigation/i).fill(options.mitigation);
    await holdForVideo(page, 800);
  }
  await page.getByRole("button", { name: "Create risk" }).click();
  await expect(page.getByText("Risk created")).toBeVisible({ timeout: 60000 });
  await holdForVideo(page, 2500);
}

export async function createIssueFromUi(
  page: Page,
  options: {
    projectName: string;
    title: string;
    ownerLabel: string;
    priority?: string;
  },
) {
  await page.getByRole("button", { name: "Raise issue" }).click();
  await expect(
    page.getByRole("heading", { name: "New issue" }),
  ).toBeVisible({ timeout: 30000 });
  await holdForVideo(page, 1500);

  await selectDropdown(page, "Project", options.projectName);
  await holdForVideo(page, 1000);
  await page.waitForTimeout(800);
  await page.getByPlaceholder("Issue title").fill(options.title);
  await holdForVideo(page, 800);
  if (options.priority) {
    await selectDropdown(page, "Priority", options.priority);
  }
  await selectDropdown(page, "Owner", options.ownerLabel);
  await holdForVideo(page, 800);
  await pickDateByLabel(page, /Due date/);
  await holdForVideo(page, 1000);
  await page.getByRole("button", { name: "Create issue" }).click();
  await expect(page.getByText("Issue created")).toBeVisible({ timeout: 60000 });
  await holdForVideo(page, 2500);
}

export async function closeIssueFromUi(
  page: Page,
  title: string,
  resolutionNote: string,
) {
  const row = page.getByRole("row").filter({ hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 30000 });
  await row.scrollIntoViewIfNeeded();
  await holdForVideo(page, 1000);
  await row.getByRole("button", { name: /Close issue/i }).click();
  await expect(
    page.getByRole("heading", { name: /Close issue/i }),
  ).toBeVisible({ timeout: 30000 });
  await holdForVideo(page, 1500);
  await page.getByPlaceholder("How was this resolved?").fill(resolutionNote);
  await holdForVideo(page, 1200);
  await page
    .locator('[role="dialog"]:visible')
    .getByRole("button", { name: "Close issue" })
    .click();
  await expect(page.getByText("Issue closed")).toBeVisible({ timeout: 60000 });
  await holdForVideo(page, 2500);
}

export async function createAlertRuleFromUi(
  page: Page,
  options?: {
    eventTypeLabel?: string;
    scoreThreshold?: number;
    recipientRoleLabel?: string | RegExp;
    escalationRoleLabel?: string;
    reminderCadenceHrs?: number;
    escalationDelayHrs?: number;
    /** When set, ensure these channel checkboxes end checked (others unchecked). */
    channels?: Array<"In-app" | "Email">;
  },
) {
  await page.getByRole("button", { name: "Add rule" }).click();
  await expect(
    page.getByRole("heading", { name: "New alert rule" }),
  ).toBeVisible({ timeout: 30000 });
  await holdForVideo(page, 1500);
  // Sheet may not expose role=dialog — wait for recipient role chips from catalog.
  await expect(
    page
      .locator("label")
      .filter({ hasText: /^PMO Lead$/i })
      .or(page.getByText("PMO Lead", { exact: true }))
      .first(),
  ).toBeVisible({ timeout: 20000 });

  if (options?.eventTypeLabel) {
    await selectDropdown(page, "Event type", options.eventTypeLabel);
    await holdForVideo(page, 800);
  }
  if (options?.scoreThreshold != null) {
    await fillNumberByLabel(
      page,
      /Score threshold/,
      String(options.scoreThreshold),
    );
    await holdForVideo(page, 800);
  }

  if (options?.channels && options.channels.length > 0) {
    const sheet = page.locator('[data-slot="sheet-content"]');
    const channelScope =
      (await sheet.count()) > 0 ? sheet : page.locator("body");
    for (const label of ["In-app", "Email"] as const) {
      const chip = channelScope
        .locator("label")
        .filter({ has: page.locator('input[type="checkbox"]') })
        .filter({ hasText: new RegExp(`^${label}$`) })
        .first();
      await expect(chip).toBeVisible({ timeout: 10000 });
      const box = chip.locator('input[type="checkbox"]');
      const want = options.channels.includes(label);
      const isOn = await box.isChecked();
      if (want !== isOn) {
        await chip.click();
        await holdForVideo(page, 600);
      }
    }
    await holdForVideo(page, 1000);
  }

  if (options?.reminderCadenceHrs != null) {
    await fillNumberByLabel(
      page,
      /Reminder cadence/,
      String(options.reminderCadenceHrs),
    );
    await holdForVideo(page, 800);
  }
  if (options?.escalationDelayHrs != null) {
    await fillNumberByLabel(
      page,
      /Escalation delay/,
      String(options.escalationDelayHrs),
    );
    await holdForVideo(page, 800);
  }
  if (options?.escalationRoleLabel) {
    await selectDropdown(page, "Escalation role", options.escalationRoleLabel);
    await holdForVideo(page, 800);
  }

  const recipientLabel =
    options?.recipientRoleLabel ?? /PMO Lead|pmo_lead|PM\b/i;
  const sheet = page.locator('[data-slot="sheet-content"]');
  const recipientScope = (await sheet.count()) > 0 ? sheet : page.locator("body");
  const recipientBox = recipientScope
    .locator("label")
    .filter({ has: page.locator('input[type="checkbox"]') })
    .filter({ hasText: recipientLabel })
    .first();
  await expect(recipientBox).toBeVisible({ timeout: 15000 });
  const checkbox = recipientBox.locator('input[type="checkbox"]');
  if (!(await checkbox.isChecked())) {
    await recipientBox.click();
  }
  await holdForVideo(page, 1500);

  await page.getByRole("button", { name: "Save rule" }).click();
  await expect(page.getByText("Alert rule created")).toBeVisible({
    timeout: 60000,
  });
  await holdForVideo(page, 2500);
}

export async function createEscalationFromUi(
  page: Page,
  options: {
    customerName: string;
    severity?: string;
    slaHours?: number;
    ownerSearch: string;
    ownerLabel: string;
    initialCommunication?: string;
  },
) {
  await page.getByRole("button", { name: "New escalation" }).click();
  await expect(
    page.getByRole("heading", { name: "New escalation" }),
  ).toBeVisible({ timeout: 30000 });
  await holdForVideo(page, 1500);

  await selectDropdown(page, "Customer", options.customerName);
  await holdForVideo(page, 800);
  if (options.severity) {
    await selectDropdown(page, "Severity", options.severity);
  }
  if (options.slaHours != null) {
    await fillNumberByLabel(page, /SLA hours/, String(options.slaHours));
  }

  // Employee picker for owner.
  const ownerTrigger = page
    .locator('[role="dialog"]:visible')
    .getByText(/Select owner/i)
    .first();
  await ownerTrigger.click();
  const search = page.getByPlaceholder("Search employee...");
  await expect(search).toBeVisible({ timeout: 15000 });
  await search.fill(options.ownerSearch);
  await holdForVideo(page, 800);
  // Prefer popover list button; fall back to any visible name match.
  const ownerOption = page
    .locator('[data-slot="popover-content"]')
    .getByRole("button")
    .filter({ hasText: options.ownerLabel })
    .or(page.getByRole("button").filter({ hasText: options.ownerLabel }))
    .first();
  await expect(ownerOption).toBeVisible({ timeout: 30000 });
  await holdForVideo(page, 800);
  await ownerOption.click();
  await holdForVideo(page, 1000);

  if (options.initialCommunication) {
    await page
      .getByPlaceholder("Optional first customer communication")
      .fill(options.initialCommunication);
    await holdForVideo(page, 800);
  }

  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("Escalation created")).toBeVisible({
    timeout: 60000,
  });
  await holdForVideo(page, 2500);
}

export async function createLessonFromUi(
  page: Page,
  options: {
    category?: string;
    projectName: string;
    description: string;
    recommendation: string;
  },
) {
  await page.getByRole("button", { name: "Capture lesson" }).click();
  await expect(
    page.getByRole("heading", { name: "New lesson" }),
  ).toBeVisible({ timeout: 30000 });
  await holdForVideo(page, 1500);

  if (options.category) {
    await selectDropdown(page, "Category", options.category);
  }
  await selectDropdown(page, "Project", options.projectName);
  await holdForVideo(page, 800);
  await page.getByPlaceholder("What happened?").fill(options.description);
  await holdForVideo(page, 800);
  await page
    .getByPlaceholder("What should we do next time?")
    .fill(options.recommendation);
  await holdForVideo(page, 1200);
  await page.getByRole("button", { name: "Save lesson" }).click();
  await expect(page.getByText("Lesson captured")).toBeVisible({
    timeout: 60000,
  });
  await holdForVideo(page, 2500);
}

/** Open project workspace Action points view. */
export async function openActionPointsWorkspace(
  page: Page,
  projectId: string,
) {
  await gotoWithCommit(
    page,
    `/en/dashboard/projects/${projectId}?view=actions`,
  );
  await waitForAppReady(page);
  await expect(page.getByText("Action points").first()).toBeVisible({
    timeout: 90000,
  });
  await holdForVideo(page, 1500);
}

export async function createActionPointFromUi(
  page: Page,
  options: {
    name: string;
    ownerLabel: string;
    priority?: string;
    sourceType?: string;
    linkedSourceLabel?: string;
    usePastDueDate?: boolean;
  },
) {
  await page.getByRole("button", { name: "Add action point" }).click();
  await expect(page.getByText("New action point")).toBeVisible({
    timeout: 30000,
  });
  await holdForVideo(page, 1500);

  await page.getByPlaceholder("Action point name").fill(options.name);
  await holdForVideo(page, 800);
  await selectDropdown(page, "Owner", options.ownerLabel);
  await holdForVideo(page, 800);
  if (options.priority) {
    await selectDropdown(page, "Priority", options.priority);
  }

  if (options.sourceType) {
    await selectDropdown(page, "Source", options.sourceType);
    await holdForVideo(page, 800);
    if (options.linkedSourceLabel && options.sourceType !== "Project") {
      await selectDropdown(
        page,
        `Linked ${options.sourceType}`,
        options.linkedSourceLabel,
      );
      await holdForVideo(page, 800);
    }
  }

  if (options.usePastDueDate) {
    await pickPastDateByLabel(page, /Due date/, 5);
  } else {
    // Due date — panel uses "Pick a due date" placeholder.
    const dueTrigger = page
      .locator("label")
      .filter({ hasText: /Due date/ })
      .first()
      .locator("xpath=..")
      .getByRole("button", { name: /Pick a due date|Pick a date/i });
    await dueTrigger.click();
    const calendar = page.locator('[data-slot="calendar"]');
    await expect(calendar).toBeVisible({ timeout: 15000 });
    const enabled = calendar.locator("button[data-day]:not([disabled])");
    // Navigate months if the project window isn't on the default month view.
    for (let i = 0; i < 18; i++) {
      if ((await enabled.count()) > 0) break;
      const next = calendar.getByRole("button", {
        name: /go to the next month|next month/i,
      });
      if (await next.isDisabled().catch(() => true)) break;
      await next.click();
    }
    await expect(enabled.first()).toBeVisible({ timeout: 10000 });
    await enabled.first().click();
    await holdForVideo(page, 1200);
  }

  await page.getByRole("button", { name: "Save action point" }).click();
  await expect(page.getByText("Action point created")).toBeVisible({
    timeout: 60000,
  });
  await holdForVideo(page, 2500);
}

export { selectDropdown };
