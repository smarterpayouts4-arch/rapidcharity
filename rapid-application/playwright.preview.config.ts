import { defineConfig, devices } from "@playwright/test";

// Runs tests/preview against the deployed, protected Vercel preview and the real rapid-cc35e
// test project and Drive test folder. Needs PREVIEW_SHARE_URL (a Vercel share link) and a gcloud
// login with owner access to rapid-cc35e. See docs/preview-environment.md.
export default defineConfig({
  testDir: "tests/preview",
  fullyParallel: false,
  workers: 1,
  timeout: 600_000,
  expect: { timeout: 60_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.PREVIEW_URL ?? "https://rapid-scholarship-test.vercel.app",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
});
