import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STOREFRONT_FASHION_PORT || 3424);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "fashion-theme.spec.ts",
  outputDir: "test-results/fashion",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "fashion-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { height: 1000, width: 1440 } },
    },
    {
      name: "fashion-mobile",
      use: {
        ...devices["Pixel 7"],
        deviceScaleFactor: 1,
        viewport: { height: 915, width: 412 },
      },
    },
    {
      name: "fashion-tablet",
      use: { ...devices["Desktop Chrome"], viewport: { height: 1024, width: 768 } },
    },
    {
      name: "fashion-no-js",
      use: {
        ...devices["Desktop Chrome"],
        javaScriptEnabled: false,
        viewport: { height: 1000, width: 1440 },
      },
    },
    {
      name: "fashion-reduced-motion",
      use: {
        ...devices["Pixel 7"],
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        viewport: { height: 915, width: 412 },
      },
    },
  ],
  webServer: {
    command: `bun run build:preview:fashion && STOREFRONT_BUILD_MODE=preview bun run verify:static && bun scripts/check-bundle-budget.ts && bun scripts/serve-static.ts ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
