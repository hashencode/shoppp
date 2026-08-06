import { defineConfig, devices } from "@playwright/test";
import { themeViewports } from "./e2e/support/theme-viewports";

const port = Number(process.env.STOREFRONT_FASHION_2_PORT || 3426);
const sourcePort = Number(process.env.STOREFRONT_FASHION_2_SOURCE_PORT || 3427);
const externalBaseURL = process.env.STOREFRONT_FASHION_2_BASE_URL;
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;
const sourceRoot = process.env.STOREFRONT_FASHION_2_SOURCE_ROOT || "app/themes/fashion-2/upstream";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "fashion-2-theme.spec.ts",
  outputDir: "test-results/fashion-2",
  fullyParallel: false,
  reporter: "list",
  workers: 1,
  use: {
    baseURL,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "fashion-2-desktop",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.desktop },
    },
    {
      name: "fashion-2-laptop",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.laptop },
    },
    {
      name: "fashion-2-tablet",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.tablet },
    },
    {
      name: "fashion-2-mobile",
      use: {
        ...devices["Pixel 7"],
        deviceScaleFactor: 1,
        viewport: themeViewports.mobile,
      },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : [
        {
          command: `bun run build:preview:fashion-2 && STOREFRONT_BUILD_MODE=preview bun run verify:static && bun scripts/check-bundle-budget.ts && bun scripts/serve-static.ts ${port}`,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 180_000,
        },
        {
          command: `python3 -m http.server ${sourcePort} --bind 127.0.0.1 --directory=${JSON.stringify(sourceRoot)}`,
          url: `http://127.0.0.1:${sourcePort}/demo-fashion-store.html`,
          reuseExistingServer: false,
          timeout: 30_000,
        },
      ],
});
