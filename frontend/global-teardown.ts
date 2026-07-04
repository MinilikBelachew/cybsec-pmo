/**
 * global-teardown.ts
 * Runs automatically after every playwright test suite.
 * Renames test-results/ folders to end with [TC-M1.X-XX] for easy identification.
 */
import { execFileSync } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";

export default async function globalTeardown() {
  const script = join(__dirname, "scripts", "rename-test-results.mjs");
  try {
    execFileSync("node", [script], { stdio: "inherit" });
  } catch (e) {
    // Non-fatal — don't block the test report from opening
    console.warn("rename-test-results.mjs failed:", e);
  }
}
