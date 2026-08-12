import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: ".playwright/test-results",
  globalSetup: "./tests/e2e/waiter-pos/global.setup.ts",
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  // Each spec file is one journey provisioning its own tenant, and fullyParallel
  // stays off, so raising this parallelises whole journeys and never the steps
  // inside one. Two, not more: every journey provisions through a single
  // backend container, and concurrent provisioning has broken this repo before.
  // The workflow asserts one distinct tenant per journey and a clean teardown,
  // so an isolation regression fails CI rather than going unnoticed.
  // Overridable to debug a suspected concurrency problem by pinning it to 1.
  workers: Number(process.env.HIVE_E2E_WORKERS ?? (isCi ? 2 : 1)),
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  reporter: isCi
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }], ["junit", { outputFile: ".playwright/junit.xml" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  metadata: {
    backendBaseUrl: process.env.HIVE_E2E_BACKEND_URL ?? "http://localhost:8081",
    reverbHost: process.env.HIVE_E2E_REVERB_HOST ?? "localhost",
    reverbPort: process.env.HIVE_E2E_REVERB_PORT ?? "9095",
    reverbScheme: process.env.HIVE_E2E_REVERB_SCHEME ?? "http",
    reverbAppKey: process.env.HIVE_E2E_REVERB_APP_KEY ?? "configured-by-frontend-runtime",
  },
  use: {
    ...devices["Desktop Chrome"],
    headless: process.env.HIVE_E2E_HEADED !== "1",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
    baseURL: process.env.HIVE_E2E_FRONTEND_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
});
