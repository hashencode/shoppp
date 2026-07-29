import { defineConfig, devices } from "@playwright/test";

const storefront = process.env.STOREFRONT_E2E_BASE_URL?.replace(/\/$/, "");
if (!storefront)
  throw new Error("STOREFRONT_E2E_BASE_URL is required for the staging proof suite.");

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: "../test-results/staging",
  forbidOnly: true,
  fullyParallel: false,
  retries: 1,
  timeout: 10 * 60_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { outputFolder: "../playwright-report", open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: storefront,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
});
