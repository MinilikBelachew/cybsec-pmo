import { test, expect } from "@playwright/test";
import { loginViaSessionInjection } from "../helpers/auth";
import {
  gotoWithCommit,
  holdForVideo,
  waitForAppReady,
} from "../helpers/resources";
import { PMO_LEAD_EMAIL } from "../helpers/reporting";

/**
 * Gate 4 — Risk & Compliance portfolio surfaces.
 * Smoke coverage for M4 register / catalogue / escalation / lessons / actions pages.
 */
test.describe("M4 Risk & Compliance", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });

  test("TC-M4-01: Risk register page loads", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/risks");
    await waitForAppReady(page);
    await expect(page.getByText(/Risk Register|Risks/i).first()).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page);
  });

  test("TC-M4-02: Issue tracker page loads", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/issues");
    await waitForAppReady(page);
    await expect(page.getByText(/Issue Tracker|Issues/i).first()).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page);
  });

  test("TC-M4-03: Alert catalogue page loads", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/alerts");
    await waitForAppReady(page);
    await expect(page.getByText(/Alert Catalogue|Alerts/i).first()).toBeVisible({
      timeout: 60000,
    });
    await holdForVideo(page);
  });

  test("TC-M4-04: Escalations page loads", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/escalations");
    await waitForAppReady(page);
    await expect(
      page.getByText(/Escalations|Customer escalation/i).first(),
    ).toBeVisible({ timeout: 60000 });
    await holdForVideo(page);
  });

  test("TC-M4-05: Lessons learned page loads", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/lessons");
    await waitForAppReady(page);
    await expect(
      page.getByText(/Lessons Learned|Lessons/i).first(),
    ).toBeVisible({ timeout: 60000 });
    await holdForVideo(page);
  });

  test("TC-M4-06: Actions portfolio page loads", async ({ page }) => {
    await loginViaSessionInjection(page, PMO_LEAD_EMAIL);
    await gotoWithCommit(page, "/en/dashboard/actions");
    await waitForAppReady(page);
    await expect(
      page.getByText(/Action Points|Actions/i).first(),
    ).toBeVisible({ timeout: 60000 });
    await holdForVideo(page);
  });
});
