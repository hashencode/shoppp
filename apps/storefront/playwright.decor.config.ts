import { defineConfig, devices } from "@playwright/test";
import { themeViewports } from "./e2e/support/theme-viewports";

const port = Number(process.env.STOREFRONT_DECOR_PORT || 3425);
const externalBaseURL = process.env.STOREFRONT_DECOR_BASE_URL;
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "decor-theme.spec.ts",
  outputDir: "test-results/decor",
  fullyParallel: true,
  reporter: "list",
  workers: 1,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "decor-desktop",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.desktop },
    },
    {
      name: "decor-mobile",
      use: {
        ...devices["Pixel 7"],
        deviceScaleFactor: 1,
        viewport: themeViewports.mobile,
      },
    },
    {
      name: "decor-laptop",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.laptop },
    },
    {
      name: "decor-tablet",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.tablet },
    },
    {
      name: "decor-no-js",
      use: {
        ...devices["Desktop Chrome"],
        javaScriptEnabled: false,
        viewport: themeViewports.desktop,
      },
    },
    {
      name: "decor-reduced-motion",
      use: {
        ...devices["Pixel 7"],
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        viewport: themeViewports.mobile,
      },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: `bun run build:preview:decor && STOREFRONT_BUILD_MODE=preview bun run verify:static && bun scripts/check-bundle-budget.ts && bun scripts/serve-static.ts ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
