import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STOREFRONT_A11Y_PORT || 3422);
const baseURL = process.env.STOREFRONT_A11Y_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "a11y.spec.ts",
  outputDir: "test-results/a11y",
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.STOREFRONT_A11Y_BASE_URL
    ? undefined
    : {
        command: `bun run build && wrangler dev --port ${port} --local`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
