/**
 * global-teardown.ts
 * Runs after every playwright suite.
 * Renames folders under the active phase outputDir to end with [TC-M*.*] tags.
 */
import { execFileSync } from "child_process";
import { join } from "path";
import type { FullConfig } from "@playwright/test";

export default async function globalTeardown(config: FullConfig) {
  const script = join(__dirname, "scripts", "rename-test-results.mjs");
  const outputDir =
    config.projects[0]?.outputDir ??
    join(config.rootDir, `test-results-phase${process.env.PLAYWRIGHT_PHASE ?? "1"}`);

  try {
    execFileSync("node", [script, outputDir], { stdio: "inherit" });
  } catch (e) {
    // Non-fatal — don't block the test report from opening
    console.warn("rename-test-results.mjs failed:", e);
  }
}
