import { test, expect } from "@playwright/test";
import crypto from "crypto";
import type { Client } from "pg";
import { loginViaSessionInjection } from "../helpers/auth";
import { getDbClient } from "../helpers/db";
import {
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
  exportStatusReport,
  generateStatusReport,
  latestReportId,
  mailAttachmentNames,
  mailRecipients,
  maildevAvailable,
  listMail,
  selectWithOption,
  seedPhase3Reporting,
  statusReportRow,
  waitForMail,
} from "../helpers/reporting";

const SECTIONS = [
  "Executive health summary",
  "Milestones",
  "Open action points",
  "Missing or incomplete data",
];

async function expectPreviewSections(page: import("@playwright/test").Page) {
  for (const title of SECTIONS) {
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible({ timeout: 30000 });
  }
}

/** M3.3 — WSR / MSR generation, preview, approval flow, exports and versions. */
test.describe("M3.3 Status reports", () => {
  let dbClient: Client;
  let seed: Phase3Seed;

  test.beforeAll(async () => {
    dbClient = await getDbClient();
    await cleanupOrphanPhase3Projects(dbClient);
    seed = await seedPhase3Reporting(dbClient, {
      projectSuffix: `wsr-${Date.now()}`,
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
    await loginViaSessionInjection(page, PM_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/reports/status");
    await waitForAppReady(page);
    await expect(
      page.getByRole("heading", { name: "Status Reports" }),
    ).toBeVisible({
      timeout: 60000,
    });
  });

  test("TC-M3-3-01: WSR generates as Draft and exports PDF and DOCX", async ({
    page,
  }) => {
    await generateStatusReport(page, seed.projectId, "WSR");
    const report = await latestReportId(dbClient, seed.projectId, "WSR");
    expect(report.status).toBe("Draft");

    const row = statusReportRow(page, report.id);
    await expect(row).toBeVisible({ timeout: 30000 });
    await expect(row.getByText("Draft")).toBeVisible();
    await expect(row.getByText(`WSR · v${report.version}`)).toBeVisible();
    await holdForVideo(page);

    // Readable preview, not a JSON dump.
    await Promise.all([
      page.waitForURL(new RegExp(`/reports/status/${report.id}`), {
        timeout: 120000,
        waitUntil: "commit",
      }),
      row.getByText(seed.projectName).click(),
    ]);
    await waitForAppReady(page);
    await expect(page.getByText(/Overall: (Green|Amber|Red)/)).toBeVisible({
      timeout: 60000,
    });
    await expect(page.getByText(/^Weekly · \d{4}-\d{2}-\d{2} to /)).toBeVisible();
    await expectPreviewSections(page);
    await expect(page.getByText("M3 Milestone Alpha")).toBeVisible();
    await expect(page.getByText("M3 overdue action point")).toBeVisible();
    await holdForVideo(page);

    await gotoWithCommit(page, "/en/dashboard/reports/status");
    await waitForAppReady(page);
    await exportStatusReport(page, report.id, "PDF", ".pdf");
    await exportStatusReport(page, report.id, "DOCX", ".docx");
    await holdForVideo(page);
  });

  test("TC-M3-3-02: MSR generates with monthly period and exports", async ({
    page,
  }) => {
    await generateStatusReport(page, seed.projectId, "MSR");
    const report = await latestReportId(dbClient, seed.projectId, "MSR");
    expect(report.status).toBe("Draft");

    const row = statusReportRow(page, report.id);
    await expect(row.getByText(`MSR · v${report.version}`)).toBeVisible({
      timeout: 30000,
    });
    await holdForVideo(page);

    await gotoWithCommit(page, `/en/dashboard/reports/status/${report.id}`);
    await waitForAppReady(page);
    // Monthly period label is "<Month> <Year>", e.g. "March 2026".
    await expect(
      page.getByText(/^Monthly · [A-Z][a-z]+ \d{4}$/),
    ).toBeVisible({ timeout: 60000 });
    await expectPreviewSections(page);
    await holdForVideo(page);

    await gotoWithCommit(page, "/en/dashboard/reports/status");
    await waitForAppReady(page);
    await exportStatusReport(page, report.id, "PDF", ".pdf");
    await exportStatusReport(page, report.id, "DOCX", ".docx");
    await holdForVideo(page);
  });

  test("TC-M3-3-03: Agreed sections appear in preview and exports", async ({
    page,
  }) => {
    await generateStatusReport(page, seed.projectId, "WSR");
    const report = await latestReportId(dbClient, seed.projectId, "WSR");

    await gotoWithCommit(page, `/en/dashboard/reports/status/${report.id}`);
    await waitForAppReady(page);

    // Header meta: status, overall RAG, period, data-as-at timestamp.
    await expect(page.getByText("Draft", { exact: true })).toBeVisible({
      timeout: 60000,
    });
    await expect(page.getByText(/Overall: (Green|Amber|Red)/)).toBeVisible();
    await expect(page.getByText(/^Data as at /)).toBeVisible();
    await expectPreviewSections(page);

    // Health dimensions and milestone rows are rendered as readable tables.
    for (const name of ["Schedule", "Cost", "Risk", "Resources", "Collections"]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("M3 Milestone Beta")).toBeVisible();
    await holdForVideo(page);

    // The same sections back the PDF/DOCX renderers.
    await gotoWithCommit(page, "/en/dashboard/reports/status");
    await waitForAppReady(page);
    const pdf = await exportStatusReport(page, report.id, "PDF", ".pdf");
    expect(pdf.suggestedFilename()).toContain("WSR");
    const docx = await exportStatusReport(page, report.id, "DOCX", ".docx");
    expect(docx.suggestedFilename()).toContain("WSR");
    await holdForVideo(page);
  });

  test("TC-M3-3-04: Unresolved DQ flags surface then clear after resolve", async ({
    page,
  }) => {
    const flagId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO data_quality_flags (id, flag_type, object_type, object_id, project_id, severity, description, is_resolved, flagged_at)
       VALUES ($1, 'MISSING_TIMESHEET', 'Employee', $2, $3, 'high', $4, false, NOW())`,
      [
        flagId,
        seed.eng2EmployeeId,
        seed.projectId,
        `M2 Backup Engineer has no submitted timesheet for ${seed.projectName} this week`,
      ],
    );

    await page.reload({ waitUntil: "commit" });
    await waitForAppReady(page);
    await generateStatusReport(page, seed.projectId, "WSR");
    const flagged = await latestReportId(dbClient, seed.projectId, "WSR");

    await gotoWithCommit(page, `/en/dashboard/reports/status/${flagged.id}`);
    await waitForAppReady(page);
    await expect(
      page.getByRole("heading", {
        name: "Missing or incomplete data",
        exact: true,
      }),
    ).toBeVisible({ timeout: 60000 });
    await expect(page.getByText("Missing Timesheet")).toBeVisible();
    await expect(
      page.getByText(/has no submitted timesheet for .* this week/),
    ).toBeVisible();
    await holdForVideo(page);

    // Resolve the flag on the Data Quality page.
    await gotoWithCommit(page, "/en/dashboard/reports/data-quality");
    await waitForAppReady(page);
    await selectWithOption(page, "All projects").selectOption(seed.projectId);
    const flagRowLocator = page
      .getByRole("row")
      .filter({ hasText: "MISSING_TIMESHEET" })
      .first();
    await expect(flagRowLocator).toBeVisible({ timeout: 60000 });
    await flagRowLocator.getByRole("button", { name: "Resolve" }).click();
    await expect(page.getByText("Flag resolved")).toBeVisible({
      timeout: 30000,
    });
    await holdForVideo(page);

    // Regenerate — the missing-data section is now empty.
    await gotoWithCommit(page, "/en/dashboard/reports/status");
    await waitForAppReady(page);
    await generateStatusReport(page, seed.projectId, "WSR");
    const cleared = await latestReportId(dbClient, seed.projectId, "WSR");
    expect(cleared.version).toBe(flagged.version + 1);

    await gotoWithCommit(page, `/en/dashboard/reports/status/${cleared.id}`);
    await waitForAppReady(page);
    await expect(
      page.getByRole("heading", {
        name: "Missing or incomplete data",
        exact: true,
      }),
    ).toBeVisible({ timeout: 60000 });
    await expect(
      page.getByText("No missing or incomplete data flagged."),
    ).toBeVisible();
    await holdForVideo(page);
  });

  test("TC-M3-3-05: Approve is required before Distribute", async ({
    page,
    request,
  }) => {
    const mailAvailable = await maildevAvailable(request);
    if (mailAvailable) await clearMailbox(request);

    await generateStatusReport(page, seed.projectId, "WSR");
    const report = await latestReportId(dbClient, seed.projectId, "WSR");
    const row = statusReportRow(page, report.id);

    // Draft — only Approve is offered.
    await expect(row.getByRole("button", { name: "Approve" })).toBeVisible({
      timeout: 30000,
    });
    await expect(row.getByRole("button", { name: "Distribute" })).toHaveCount(0);
    await holdForVideo(page);

    await row.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Report approved")).toBeVisible({
      timeout: 60000,
    });
    await expect(row.getByText("Approved")).toBeVisible({ timeout: 30000 });
    await holdForVideo(page);

    const subject = `WSR - ${seed.projectName}`;
    if (mailAvailable) {
      // Approval alone must not email anyone.
      const early = (await listMail(request)).find(
        (mail) => mail.subject === subject,
      );
      expect(early).toBeUndefined();
    }

    await row.getByRole("button", { name: "Distribute" }).click();
    await expect(page.getByText("Report distributed")).toBeVisible({
      timeout: 90000,
    });
    await expect(row.getByText("Distributed")).toBeVisible({ timeout: 30000 });
    await holdForVideo(page);

    const persisted = await dbClient.query(
      "SELECT status, distributed_at FROM generated_reports WHERE id = $1",
      [report.id],
    );
    expect(persisted.rows[0].status).toBe("Distributed");
    expect(persisted.rows[0].distributed_at).toBeTruthy();

    if (mailAvailable) {
      const mail = await waitForMail(
        request,
        (item) => item.subject === subject,
      );
      if (!mail) {
        test.info().annotations.push({
          type: "notice",
          description:
            "Distribute succeeded but Maildev received nothing — point backend SMTP at Maildev (SENDGRID_ENABLED=false, MAIL_HOST=127.0.0.1, MAIL_PORT=1026).",
        });
      } else {
        expect(mailRecipients(mail)).toContain(PM_EMAIL.toLowerCase());
        expect(mailAttachmentNames(mail).join(" ")).toContain(".pdf");
      }
    }
  });

  test("TC-M3-3-06: Report exports to PDF, DOCX, Excel and CSV", async ({
    page,
  }) => {
    await generateStatusReport(page, seed.projectId, "WSR");
    const report = await latestReportId(dbClient, seed.projectId, "WSR");

    const pdf = await exportStatusReport(page, report.id, "PDF", ".pdf");
    const docx = await exportStatusReport(page, report.id, "DOCX", ".docx");
    const xlsx = await exportStatusReport(page, report.id, "Excel", ".xlsx");
    const csv = await exportStatusReport(page, report.id, "CSV", ".csv");

    for (const download of [pdf, docx, xlsx, csv]) {
      const stream = await download.createReadStream();
      expect(stream, "export produced no file").toBeTruthy();
      expect(download.suggestedFilename()).toContain(`v${report.version}`);
    }
    await holdForVideo(page);
  });

  test("TC-M3-3-07: Regenerating creates a new version and keeps history", async ({
    page,
  }) => {
    await generateStatusReport(page, seed.projectId, "WSR");
    const first = await latestReportId(dbClient, seed.projectId, "WSR");

    await generateStatusReport(page, seed.projectId, "WSR");
    const second = await latestReportId(dbClient, seed.projectId, "WSR");
    expect(second.version).toBe(first.version + 1);
    expect(second.id).not.toBe(first.id);

    // Both versions remain listed for the project.
    await selectWithOption(page, "All projects").selectOption(seed.projectId);
    await selectWithOption(page, "All types").selectOption("WSR");
    await expect(statusReportRow(page, first.id)).toBeVisible({
      timeout: 60000,
    });
    await expect(statusReportRow(page, second.id)).toBeVisible();
    await expect(
      statusReportRow(page, second.id).getByText(`WSR · v${second.version}`),
    ).toBeVisible();
    await holdForVideo(page);

    // Both open from the list.
    await gotoWithCommit(page, `/en/dashboard/reports/status/${first.id}`);
    await waitForAppReady(page);
    await expect(page.getByText(`${seed.projectName} · v${first.version}`)).toBeVisible(
      { timeout: 60000 },
    );

    await gotoWithCommit(page, `/en/dashboard/reports/status/${second.id}`);
    await waitForAppReady(page);
    await expect(
      page.getByText(`${seed.projectName} · v${second.version}`),
    ).toBeVisible({ timeout: 60000 });
    await holdForVideo(page);
  });
});
