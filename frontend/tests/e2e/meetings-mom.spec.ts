import { test, expect } from "@playwright/test";
import crypto from "crypto";
import type { Client } from "pg";
import { loginViaSessionInjection } from "../helpers/auth";
import { getDbClient } from "../helpers/db";
import {
  ENG_EMAIL,
  gotoWithCommit,
  holdForVideo,
  waitForAppReady,
} from "../helpers/resources";
import {
  PM_EMAIL,
  Phase3Seed,
  cleanupOrphanPhase3Projects,
  cleanupPhase3Reporting,
  clearMailbox,
  downloadEvidence,
  mailAttachmentNames,
  maildevAvailable,
  meetingRow,
  momRow,
  openMeetingsTab,
  pickFirstAvailableDate,
  seedPhase3Reporting,
  waitForMail,
} from "../helpers/reporting";

const MEETING_TITLE = "M3 Weekly Status Review";
const AGENDA = "Review delivery risks";
const DECISION = "Escalate overdue action to PMO";
const ACTION = "Owner to update timesheet by Friday";

async function expandMeeting(
  page: import("@playwright/test").Page,
  title: string,
) {
  const row = meetingRow(page, title);
  await expect(row).toBeVisible({ timeout: 60000 });
  const toggle = row.getByRole("button").first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  return row;
}

/**
 * Create the shared meeting used by the MoM flow tests.
 * Idempotent — subsequent tests can call this if an earlier case aborted
 * before the meeting was persisted / listed.
 */
async function ensureMeeting(
  page: import("@playwright/test").Page,
  dbClient: Client,
  seed: Phase3Seed,
) {
  await openMeetingsTab(page, seed.projectId);

  const existing = await dbClient.query(
    `SELECT id FROM meetings WHERE project_id = $1 AND title = $2 LIMIT 1`,
    [seed.projectId, MEETING_TITLE],
  );
  if (existing.rows[0]) {
    const row = meetingRow(page, MEETING_TITLE);
    if (await row.isVisible({ timeout: 20000 }).catch(() => false)) {
      return;
    }
    // Ghost row: present in DB but not listed in the UI. Wipe and recreate.
    const meetingId = existing.rows[0].id as string;
    await dbClient.query(
      `DELETE FROM mom_acknowledgements WHERE mom_id IN (
         SELECT id FROM mom_documents WHERE meeting_id = $1
       )`,
      [meetingId],
    );
    await dbClient.query(`DELETE FROM mom_documents WHERE meeting_id = $1`, [
      meetingId,
    ]);
    await dbClient.query(`DELETE FROM meeting_items WHERE meeting_id = $1`, [
      meetingId,
    ]);
    await dbClient.query(`DELETE FROM meeting_attendees WHERE meeting_id = $1`, [
      meetingId,
    ]);
    await dbClient.query(`DELETE FROM meetings WHERE id = $1`, [meetingId]);
    await page.reload({ waitUntil: "commit" });
    await waitForAppReady(page);
    await expect(
      page.getByRole("heading", { name: /Meetings & MoM|Minutes of Meeting/ }),
    ).toBeVisible({ timeout: 90000 });
  }

  await page.getByRole("button", { name: "Meeting", exact: true }).click();
  await expect(page.getByText("Create meeting")).toBeVisible({
    timeout: 30000,
  });

  await page.locator("#meeting-title").fill(MEETING_TITLE);
  await page.locator("#meeting-type").selectOption("Weekly Status Review");
  await pickFirstAvailableDate(page);
  await page.locator("#meeting-time").fill("10:30");

  const engLabel = page.locator("label").filter({ hasText: ENG_EMAIL });
  await expect(engLabel).toBeVisible({ timeout: 30000 });
  await engLabel.locator('[data-slot="checkbox"]').click();
  await expect(engLabel.locator('[data-slot="checkbox"]')).toHaveAttribute(
    "data-checked",
    "",
  );

  await page.getByPlaceholder("Agenda item").fill(AGENDA);
  await page.getByPlaceholder("Decision item").fill(DECISION);
  await page.getByPlaceholder("Action point").fill(ACTION);
  await page
    .locator('select:has(option:text-is("Select owner"))')
    .selectOption(seed.engUserId);

  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Meeting created")).toBeVisible({
    timeout: 60000,
  });
  await expect(meetingRow(page, MEETING_TITLE)).toBeVisible({
    timeout: 30000,
  });
}

/** M3.4 — Meetings, MoM generate/review/distribute, versioning and ack. */
test.describe("M3.4 Meetings & MoM", () => {
  let dbClient: Client;
  let seed: Phase3Seed;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    await cleanupOrphanPhase3Projects(dbClient);
    seed = await seedPhase3Reporting(dbClient, {
      projectSuffix: `mom-${Date.now()}`,
    });
  });

  test.afterAll(async () => {
    if (dbClient) {
      if (seed) await cleanupPhase3Reporting(dbClient, seed);
      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(360000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });

  test("TC-M3-4-01: Meeting captures agenda, attendees, decisions and actions", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PM_EMAIL);
    await ensureMeeting(page, dbClient, seed);
    await holdForVideo(page);

    // Persist check via View / Edit.
    await meetingRow(page, MEETING_TITLE)
      .getByRole("button", { name: "View", exact: true })
      .click();
    await expect(page.getByText("Meeting details")).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(ENG_EMAIL)).toBeVisible();
    await expect(page.getByText(AGENDA)).toBeVisible();
    await expect(page.getByText(DECISION)).toBeVisible();
    await expect(page.getByText(ACTION)).toBeVisible();
    await holdForVideo(page);
    // The sheet also renders an icon-only close (data-slot="sheet-close").
    await page
      .getByRole("button", { name: "Close", exact: true })
      .first()
      .click();

    const saved = await dbClient.query(
      `SELECT m.id, COUNT(a.id) AS attendees
         FROM meetings m
         LEFT JOIN meeting_attendees a ON a.meeting_id = m.id
        WHERE m.project_id = $1 AND m.title = $2
        GROUP BY m.id`,
      [seed.projectId, MEETING_TITLE],
    );
    expect(saved.rows.length).toBe(1);
    expect(Number(saved.rows[0].attendees)).toBeGreaterThanOrEqual(1);
  });

  test("TC-M3-4-02: MoM generates as Draft and exports PDF/DOCX", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PM_EMAIL);
    await ensureMeeting(page, dbClient, seed);

    const meeting = await expandMeeting(page, MEETING_TITLE);
    await meeting.getByRole("button", { name: "Generate MoM" }).click();
    await expect(page.getByText("MoM generated")).toBeVisible({
      timeout: 60000,
    });

    const minutes = momRow(page, 1);
    await expect(minutes).toBeVisible({ timeout: 30000 });
    await expect(minutes.getByText("Draft")).toBeVisible();
    await holdForVideo(page);

    await minutes.getByRole("button", { name: /Export/i }).click();
    const menu = page.locator('[role="menu"]').last();
    await expect(menu).toBeVisible({ timeout: 15000 });
    await downloadEvidence(
      page,
      () => menu.getByRole("menuitem", { name: "PDF", exact: true }).click(),
      ".pdf",
    );

    await minutes.getByRole("button", { name: /Export/i }).click();
    const menu2 = page.locator('[role="menu"]').last();
    await expect(menu2).toBeVisible({ timeout: 15000 });
    await downloadEvidence(
      page,
      () => menu2.getByRole("menuitem", { name: "DOCX", exact: true }).click(),
      ".docx",
    );
    await holdForVideo(page);
  });

  test("TC-M3-4-03: MoM advances Draft to Reviewed via Review", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PM_EMAIL);
    await ensureMeeting(page, dbClient, seed);
    await expandMeeting(page, MEETING_TITLE);

    // Guarantee a Draft MoM exists for this assertion.
    let minutes = page
      .locator("li")
      .filter({ hasText: /^Minutes v/ })
      .filter({ hasText: "Draft" })
      .first();
    if (!(await minutes.isVisible().catch(() => false))) {
      await meetingRow(page, MEETING_TITLE)
        .getByRole("button", { name: "Generate MoM" })
        .click();
      await expect(page.getByText("MoM generated")).toBeVisible({
        timeout: 60000,
      });
      minutes = page
        .locator("li")
        .filter({ hasText: /^Minutes v/ })
        .filter({ hasText: "Draft" })
        .first();
    }

    await expect(minutes.getByText("Draft")).toBeVisible({ timeout: 30000 });
    await expect(minutes.getByRole("button", { name: "Distribute" })).toHaveCount(
      0,
    );
    await holdForVideo(page);

    await minutes.getByRole("button", { name: "Review" }).click();
    await expect(page.getByText("MoM reviewed")).toBeVisible({
      timeout: 60000,
    });
    await expect(minutes.getByText("Reviewed")).toBeVisible({ timeout: 30000 });
    await expect(
      minutes.getByRole("button", { name: "Distribute" }),
    ).toBeVisible();
    await holdForVideo(page);
  });

  test("TC-M3-4-04: Regenerating MoM versions under the same meeting", async ({
    page,
  }) => {
    await loginViaSessionInjection(page, PM_EMAIL);
    await ensureMeeting(page, dbClient, seed);

    const meeting = await expandMeeting(page, MEETING_TITLE);
    // Need at least one prior MoM so regenerating produces v2.
    if (!(await momRow(page, 1).isVisible().catch(() => false))) {
      await meeting.getByRole("button", { name: "Generate MoM" }).click();
      await expect(page.getByText("MoM generated")).toBeVisible({
        timeout: 60000,
      });
      await expect(momRow(page, 1)).toBeVisible({ timeout: 30000 });
    }

    await meeting.getByRole("button", { name: "Generate MoM" }).click();
    await expect(page.getByText("MoM generated")).toBeVisible({
      timeout: 60000,
    });

    await expect(momRow(page, 1)).toBeVisible({ timeout: 30000 });
    await expect(momRow(page, 2)).toBeVisible({ timeout: 30000 });
    await holdForVideo(page);

    const versions = await dbClient.query(
      `SELECT d.version, d.status
         FROM mom_documents d
         JOIN meetings m ON m.id = d.meeting_id
        WHERE m.project_id = $1 AND m.title = $2
        ORDER BY d.version`,
      [seed.projectId, MEETING_TITLE],
    );
    expect(versions.rows.map((row) => Number(row.version))).toEqual(
      expect.arrayContaining([1, 2]),
    );
    expect(versions.rows.length).toBeGreaterThanOrEqual(2);
  });

  test("TC-M3-4-05: Distribute emails MoM and engineer can acknowledge", async ({
    page,
    request,
  }) => {
    const mailAvailable = await maildevAvailable(request);
    if (mailAvailable) await clearMailbox(request);

    // Ensure a Reviewed MoM exists (v1 from earlier tests, or generate+review).
    await loginViaSessionInjection(page, PM_EMAIL);
    await ensureMeeting(page, dbClient, seed);
    await expandMeeting(page, MEETING_TITLE);

    let target = momRow(page, 1);
    if (!(await target.isVisible().catch(() => false))) {
      await meetingRow(page, MEETING_TITLE)
        .getByRole("button", { name: "Generate MoM" })
        .click();
      await expect(page.getByText("MoM generated")).toBeVisible({
        timeout: 60000,
      });
      target = momRow(page, 1);
    }

    const statusBadge = target.locator("span").filter({
      hasText: /^(Draft|Reviewed|Distributed)$/,
    });
    const status = ((await statusBadge.first().textContent()) ?? "").trim();
    if (status === "Draft") {
      await target.getByRole("button", { name: "Review" }).click();
      await expect(page.getByText("MoM reviewed")).toBeVisible({
        timeout: 60000,
      });
    } else if (status === "Distributed") {
      // Prefer a Reviewed MoM; fall back to generating a fresh one.
      const reviewed = page
        .locator("li")
        .filter({ hasText: /^Minutes v/ })
        .filter({ hasText: "Reviewed" })
        .first();
      if (await reviewed.isVisible().catch(() => false)) {
        target = reviewed;
      } else {
        await meetingRow(page, MEETING_TITLE)
          .getByRole("button", { name: "Generate MoM" })
          .click();
        await expect(page.getByText("MoM generated")).toBeVisible({
          timeout: 60000,
        });
        // Newest version is Draft — review it.
        const latest = await dbClient.query(
          `SELECT MAX(d.version) AS v
             FROM mom_documents d
             JOIN meetings m ON m.id = d.meeting_id
            WHERE m.project_id = $1 AND m.title = $2`,
          [seed.projectId, MEETING_TITLE],
        );
        target = momRow(page, Number(latest.rows[0].v));
        await target.getByRole("button", { name: "Review" }).click();
        await expect(page.getByText("MoM reviewed")).toBeVisible({
          timeout: 60000,
        });
      }
    }

    await target.getByRole("button", { name: "Distribute" }).click();
    await expect(page.getByText("MoM distributed")).toBeVisible({
      timeout: 90000,
    });
    await expect(target.getByText("Distributed")).toBeVisible({
      timeout: 30000,
    });
    await holdForVideo(page);

    // Acknowledgements accordion shows pending recipients.
    await target
      .getByRole("button", { name: /Acknowledgements/i })
      .click();
    await expect(target.getByText("Pending").first()).toBeVisible({
      timeout: 15000,
    });
    await holdForVideo(page);

    if (mailAvailable) {
      const mail = await waitForMail(
        request,
        (item) =>
          (item.subject ?? "").includes("Minutes of Meeting") &&
          (item.subject ?? "").includes(MEETING_TITLE),
      );
      if (!mail) {
        test.info().annotations.push({
          type: "notice",
          description:
            "Distribute succeeded but Maildev received nothing — point backend SMTP at Maildev (SENDGRID_ENABLED=false, MAIL_HOST=127.0.0.1, MAIL_PORT=1026).",
        });
      } else {
        expect(mailAttachmentNames(mail).join(" ").toLowerCase()).toContain(
          ".pdf",
        );
        const body = `${mail.html ?? ""}${mail.text ?? ""}`;
        expect(body).toMatch(/Open Minutes of Meeting/i);
      }
    }

    // Engineer never sees the Meetings list — only Distributed MoMs.
    await loginViaSessionInjection(page, ENG_EMAIL);
    await openMeetingsTab(page, seed.projectId);
    await expect(
      page.getByRole("heading", { name: "Minutes of Meeting" }),
    ).toBeVisible({ timeout: 60000 });
    await expect(
      page.getByRole("button", { name: "Meeting", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("Draft")).toHaveCount(0);
    await expect(page.getByText("Reviewed")).toHaveCount(0);

    await expandMeeting(page, MEETING_TITLE);
    const engMom = page
      .locator("li")
      .filter({ hasText: /^Minutes v/ })
      .first();
    await expect(engMom.getByRole("button", { name: "Acknowledge" })).toBeVisible(
      { timeout: 30000 },
    );
    await engMom.getByRole("button", { name: "Acknowledge" }).click();
    await expect(page.getByText("MoM acknowledged")).toBeVisible({
      timeout: 60000,
    });
    await expect(
      engMom.getByRole("button", { name: "Acknowledged" }),
    ).toBeDisabled();
    await holdForVideo(page);

    // Late-added attendee must NOT see this already-distributed MoM.
    const lateUserId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO users (id, email, display_name, role_id, is_active, is_external, entra_object_id, created_at, updated_at)
       SELECT $1, $2, 'M3 Late Attendee', id, true, false, $3, NOW(), NOW()
         FROM roles WHERE code = 'engineer' LIMIT 1`,
      [lateUserId, "late.m3@cybsec.com", crypto.randomUUID()],
    );
    const meetingId = (
      await dbClient.query(
        `SELECT id FROM meetings WHERE project_id = $1 AND title = $2 LIMIT 1`,
        [seed.projectId, MEETING_TITLE],
      )
    ).rows[0].id as string;
    await dbClient.query(
      `INSERT INTO meeting_attendees (id, meeting_id, user_id)
       VALUES ($1, $2, $3)`,
      [crypto.randomUUID(), meetingId, lateUserId],
    );

    await loginViaSessionInjection(page, "late.m3@cybsec.com");
    await openMeetingsTab(page, seed.projectId);
    await expect(
      page.getByText("No distributed minutes for meetings you attended."),
    ).toBeVisible({ timeout: 60000 });
    await holdForVideo(page);

    // PM sees the engineer as Acknowledged with a timestamp.
    await loginViaSessionInjection(page, PM_EMAIL);
    await openMeetingsTab(page, seed.projectId);
    await expandMeeting(page, MEETING_TITLE);
    const distributed = page
      .locator("li")
      .filter({ hasText: /^Minutes v/ })
      .filter({ hasText: "Distributed" })
      .first();
    await distributed
      .getByRole("button", { name: /Acknowledgements/i })
      .click();
    await expect(distributed.getByText(/Acknowledged · /)).toBeVisible({
      timeout: 30000,
    });
    await holdForVideo(page);

    // Cleanup the late-attendee user sessions/notifications only.
    await dbClient.query(`DELETE FROM sessions WHERE user_id = $1`, [
      lateUserId,
    ]);
    await dbClient.query(`DELETE FROM notifications WHERE user_id = $1`, [
      lateUserId,
    ]);
    await dbClient.query(
      `DELETE FROM meeting_attendees WHERE meeting_id = $1 AND user_id = $2`,
      [meetingId, lateUserId],
    );
  });
});
