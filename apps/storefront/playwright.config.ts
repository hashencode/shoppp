import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STOREFRONT_E2E_PORT || 3420);
const baseURL = process.env.STOREFRONT_E2E_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: [
    "a11y.spec.ts",
    "decor-store-*.spec.ts",
    "fashion-store-*.spec.ts",
    "performance.spec.ts",
    "theme-behavior-contract.spec.ts",
  ],
  outputDir: "test-results",
  fullyParallel: true,
  reporter: "list",
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "no-js-desktop",
      use: { ...devices["Desktop Chrome"], javaScriptEnabled: false },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: process.env.STOREFRONT_E2E_BASE_URL
    ? undefined
    : {
        command: `bun run build && bun scripts/serve-static.ts ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
