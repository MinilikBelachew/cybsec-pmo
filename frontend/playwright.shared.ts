import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

const PHASE1_SPECS = [
  "**/projects.spec.ts",
  "**/tasks.spec.ts",
  "**/audit-trail.spec.ts",
  "**/security.spec.ts",
  "**/dependencies.spec.ts",
  "**/roles-security.spec.ts",
  "**/import-export.spec.ts",
];

const PHASE2_SPECS = [
  "**/timesheets.spec.ts",
  "**/allocations.spec.ts",
  "**/utilization.spec.ts",
  "**/keka-sync.spec.ts",
];

export function createPlaywrightConfig(
  phase: "1" | "2",
): PlaywrightTestConfig {
  process.env.PLAYWRIGHT_PHASE = phase;

  return defineConfig({
    testDir: "./tests/e2e",
    testMatch: phase === "1" ? PHASE1_SPECS : PHASE2_SPECS,
    outputDir: `./test-results-phase${phase}`,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    timeout: 120000,
    reporter: [
      ["list"],
      [
        "html",
        {
          outputFolder: `playwright-report-phase${phase}`,
          open: process.env.CI ? "never" : "always",
        },
      ],
    ],
    globalTeardown: "./global-teardown.ts",
    use: {
      baseURL: "http://localhost:3000",
      navigationTimeout: 30000,
      actionTimeout: 15000,
      trace: "on-first-retry",
      video: "on",
      screenshot: "on",
    },
    projects: [
      {
        name: "chromium",
        use: { ...devices["Desktop Chrome"] },
      },
    ],
  });
}
