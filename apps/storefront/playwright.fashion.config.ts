import { defineConfig, devices } from "@playwright/test";
import { themeViewports } from "./e2e/support/theme-viewports";

const port = Number(process.env.STOREFRONT_FASHION_PORT || 3424);
const externalBaseURL = process.env.STOREFRONT_FASHION_BASE_URL;
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "fashion-theme.spec.ts",
  outputDir: "test-results/fashion",
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
      name: "fashion-desktop",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.desktop },
    },
    {
      name: "fashion-mobile",
      use: {
        ...devices["Pixel 7"],
        deviceScaleFactor: 1,
        viewport: themeViewports.mobile,
      },
    },
    {
      name: "fashion-laptop",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.laptop },
    },
    {
      name: "fashion-desktop-2x",
      use: {
        ...devices["Desktop Chrome"],
        deviceScaleFactor: 2,
        viewport: themeViewports.desktop,
      },
    },
    {
      name: "fashion-tablet",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.tablet },
    },
    {
      name: "fashion-no-js",
      use: {
        ...devices["Desktop Chrome"],
        javaScriptEnabled: false,
        viewport: themeViewports.desktop,
      },
    },
    {
      name: "fashion-reduced-motion",
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
        command: `bun run build:preview:fashion && STOREFRONT_BUILD_MODE=preview bun run verify:static && bun scripts/check-bundle-budget.ts && bun scripts/serve-static.ts ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
