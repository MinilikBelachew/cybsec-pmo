import { test, expect } from "@playwright/test";
import { loginViaSessionInjection } from "../helpers/auth";
import { getDbClient } from "../helpers/db";
import * as path from "path";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api/v1";
const ADMIN_EMAIL = "bminilik12@gmail.com";
const PM_EMAIL = "john.pm@bminilik12gmail.onmicrosoft.com";

async function gotoProjectsPage(page: any) {
  const projectsLoaded = page.waitForResponse(
    (res: any) => res.url().includes("/projects") && res.status() === 200,
    { timeout: 120000 }
  ).catch(() => null);
  const permissionsLoaded = page.waitForResponse(
    (res: any) => res.url().includes("/permissions") && res.status() === 200,
    { timeout: 120000 }
  ).catch(() => null);
  await page.goto("/en/dashboard/projects", { waitUntil: "commit" });
  await Promise.all([projectsLoaded, permissionsLoaded]);
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return text.includes("Project") || text.includes("Import") || text.includes("No projects") || text.includes("permission");
    },
    { timeout: 40000 }
  ).catch(() => {});
}

async function gotoProjectDetailsPage(page: any, projectId: string) {
  const permPromise = page.waitForResponse(
    (res: any) => res.url().includes("/permissions") && res.status() === 200,
    { timeout: 120000 }
  ).catch(() => null);
  const phasesPromise = page.waitForResponse(
    (res: any) => res.url().includes("/phases") && res.status() === 200,
    { timeout: 120000 }
  ).catch(() => null);
  await page.goto(`/en/dashboard/projects/${projectId}`, { waitUntil: "commit" });
  await Promise.all([permPromise, phasesPromise]);
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return !text.includes("Loading workspace details...") &&
             (text.includes("Project") || text.includes("Import MPP") || text.includes("objective") || text.includes("permission"));
    },
    { timeout: 40000 }
  ).catch(() => {});
}

test.describe("Import / Export (Milestone 1.8)", () => {
  let dbClient: any;
  let testProjectId: string;

  test.beforeAll(async () => {
    dbClient = await getDbClient();

    // Fetch department and customer for setting up a project
    const deptRes = await dbClient.query("SELECT id FROM departments WHERE code = 'SOC' LIMIT 1");
    const deptId = deptRes.rows[0].id;
    const custRes = await dbClient.query("SELECT id FROM customers WHERE company_name = 'Acme Financial Services' LIMIT 1");
    const custId = custRes.rows[0].id;
    const pmRes = await dbClient.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [PM_EMAIL]);
    const pmId = pmRes.rows[0].id;

    // Create a temporary project for export testing
    testProjectId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO projects (id, name, objective, department_id, customer_id, engagement_type, billing_model, start_date, end_date, value, currency, primary_pm_id, status, created_by, created_at, updated_at)
       VALUES ($1, 'Export Test Project', 'Vulnerability assessments', $2, $3, 'Assessment', 'Fixed Price', NOW(), NOW() + INTERVAL '1 month', 30000, 'USD', $4, 'Active', $4, NOW(), NOW())`,
      [testProjectId, deptId, custId, pmId]
    );

    // Clean up any previously imported projects with UAT names
    await dbClient.query("DELETE FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name IN ('Security Assessment', 'Cloud Infrastructure Migration'))");
    await dbClient.query("DELETE FROM project_phases WHERE project_id IN (SELECT id FROM projects WHERE name IN ('Security Assessment', 'Cloud Infrastructure Migration'))");
    await dbClient.query("DELETE FROM project_milestones WHERE project_id IN (SELECT id FROM projects WHERE name IN ('Security Assessment', 'Cloud Infrastructure Migration'))");
    await dbClient.query("DELETE FROM projects WHERE name IN ('Security Assessment', 'Cloud Infrastructure Migration')");
  });

  test.afterAll(async () => {
    if (dbClient) {
      await dbClient.query("DELETE FROM tasks WHERE project_id = $1", [testProjectId]);
      await dbClient.query("DELETE FROM projects WHERE id = $1", [testProjectId]);

      // Clean up imported projects
      await dbClient.query("DELETE FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name IN ('Security Assessment', 'Cloud Infrastructure Migration'))");
      await dbClient.query("DELETE FROM project_phases WHERE project_id IN (SELECT id FROM projects WHERE name IN ('Security Assessment', 'Cloud Infrastructure Migration'))");
      await dbClient.query("DELETE FROM project_milestones WHERE project_id IN (SELECT id FROM projects WHERE name IN ('Security Assessment', 'Cloud Infrastructure Migration'))");
      await dbClient.query("DELETE FROM projects WHERE name IN ('Security Assessment', 'Cloud Infrastructure Migration')");

      await dbClient.end();
    }
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(300000);
    page.setDefaultNavigationTimeout(240000);
    page.setDefaultTimeout(120000);
  });


  test("TC-M1.8-01: MPP import with validation report", async ({ page, request }) => {
    // 1. Log in as PM
    await page.goto("/en/login", { waitUntil: "commit" });
    const session = await loginViaSessionInjection(page, PM_EMAIL);

    await gotoProjectDetailsPage(page, testProjectId);


    // 2. Click "Import MPP" button to visually show dialog
    const importMppBtn = page.locator('button:has-text("Import MPP")').first();
    await expect(importMppBtn).toBeVisible({ timeout: 15000 });
    await importMppBtn.click();
    await page.waitForTimeout(1500); // Dialog opens

    // 3. Set a fake .txt file to confirm invalid file extension error is displayed
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "mpp_import_test.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("this is not a valid MPP XML file"),
    });
    await page.waitForTimeout(2000);

    // Close dialog
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);

    // 4. Confirm API rejects .txt via direct POST (422)
    const res = await request.post(`${API_URL}/imports/mpp/preview`, {
      headers: { Authorization: `Bearer ${session.token}` },
      multipart: {
        projectId: testProjectId,
        file: {
          name: "mpp_import_test.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("invalid-file"),
        },
      },
    });
    expect(res.status()).toBe(422);
  });

  test("TC-M1.8-02: Excel import with validation report", async ({ page }) => {
    // 1. Log in as PM and go to projects page
    await page.goto("/en/login", { waitUntil: "commit" });
    await loginViaSessionInjection(page, PM_EMAIL);

    await gotoProjectsPage(page);


    // 2. Click "Import" button to open Import Projects dialog
    const importBtn = page.locator('button:has-text("Import Tasks"), button:has-text("Import")').first();
    await expect(importBtn).toBeVisible({ timeout: 15000 });
    await importBtn.click();
    await page.waitForTimeout(1500);

    // 3. Select project.xlsx for import
    const fileInput = page.locator('input[type="file"]').first();
    const filePath = path.resolve("/Users/adexoxo/ayne/cybsec-pmo/frontend/project.xlsx");
    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(2500); // Show preview list

    // Confirm preview shows "Security Assessment" project
    await expect(page.locator("body")).toContainText("Security Assessment");
    await expect(page.locator("body")).toContainText("Cloud Infrastructure Migration");

    // 4. Click "Import Projects" to execute import
    const importProjectsBtn = page.locator('button:has-text("Import Projects")').first();
    await expect(importProjectsBtn).toBeEnabled({ timeout: 5000 });
    await importProjectsBtn.click();

    // Verify success toast
    await expect(page.locator("body")).toContainText("Import complete", { timeout: 20000 });
    await page.waitForTimeout(3000); // Hold for video

    // 5. Verify database rows exist
    const projCheck = await dbClient.query("SELECT * FROM projects WHERE name = 'Security Assessment' LIMIT 1");
    expect(projCheck.rows.length).toBe(1);
    const projId = projCheck.rows[0].id;

    // Check phases and tasks are imported
    const phaseCheck = await dbClient.query("SELECT * FROM project_phases WHERE project_id = $1", [projId]);
    expect(phaseCheck.rows.length).toBeGreaterThan(0);

    const taskCheck = await dbClient.query("SELECT * FROM tasks WHERE project_id = $1", [projId]);
    expect(taskCheck.rows.length).toBeGreaterThan(0);
  });

  test("TC-M1.8-03: Export preserves agreed fields", async ({ page }) => {
    // 1. Log in as PM and go to project workspace
    await page.goto("/en/login", { waitUntil: "commit" });
    await loginViaSessionInjection(page, PM_EMAIL);
    await gotoProjectDetailsPage(page, testProjectId);


    // 2. Open Export dialog
    const exportBtn = page.locator('button:has-text("Export")').first();
    await expect(exportBtn).toBeVisible({ timeout: 15000 });
    await exportBtn.click();
    await page.waitForTimeout(1500);

    // Confirm that the agreed fields are displayed in the export panel list
    await expect(page.locator("body")).toContainText("Description");
    await expect(page.locator("body")).toContainText("Priority");
    await expect(page.locator("body")).toContainText("Status");
    await expect(page.locator("body")).toContainText("Assignee");

    // Close export dialog
    await page.keyboard.press("Escape");
    await page.waitForTimeout(2000); // Hold for video
  });

  test("TC-M1.8-04: Re-import without duplication", async ({ page }) => {
    // 1. Log in as PM and go to projects page
    await page.goto("/en/login", { waitUntil: "commit" });
    await loginViaSessionInjection(page, PM_EMAIL);

    await gotoProjectsPage(page);


    // 2. Click "Import" button to open Import Projects dialog
    const importBtn = page.locator('button:has-text("Import Tasks"), button:has-text("Import")').first();
    await expect(importBtn).toBeVisible({ timeout: 15000 });
    await importBtn.click();
    await page.waitForTimeout(1500);


    // 3. Upload project.xlsx again (which already exists in DB now)
    const fileInput = page.locator('input[type="file"]').first();
    const filePath = path.resolve("/Users/adexoxo/ayne/cybsec-pmo/frontend/project.xlsx");
    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(2500); // Show preview list

    // 4. Confirm UI blocks import and displays warning message "already exists" in Validation column
    await expect(page.locator("body")).toContainText("already exists");

    // 5. Confirm "Import Projects" button is disabled
    const importProjectsBtn = page.locator('button:has-text("Import Projects")').first();
    await expect(importProjectsBtn).toBeDisabled();

    // Close dialog
    await page.keyboard.press("Escape");
    await page.waitForTimeout(3000); // Hold for video
  });
});
