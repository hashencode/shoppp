import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "formal-publication-purchase.browser.ts",
  outputDir: `../.artifacts/screenshots/${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })}-formal-publication-local`,
  forbidOnly: true,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: { ...devices["Desktop Chrome"], screenshot: "only-on-failure", trace: "off" },
});
