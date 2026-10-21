import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "npx tsx scripts/e2e/stack.ts",
      url: "http://127.0.0.1:5199/__health",
      timeout: 300_000,
      reuseExistingServer: true,
      stdout: "pipe",
    },
    {
      command: "npx vite --port 5173 --strictPort",
      url: "http://localhost:5173",
      timeout: 120_000,
      reuseExistingServer: true,
      env: { VITE_USE_EMULATORS: "1" },
    },
  ],
});
