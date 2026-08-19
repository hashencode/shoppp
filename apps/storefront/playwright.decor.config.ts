import { defineConfig, devices } from "@playwright/test";

import { themeViewports } from "./e2e/support/theme-viewports";

const port = Number(process.env.STOREFRONT_DECOR_PORT || 3438);
const externalBaseURL = process.env.STOREFRONT_DECOR_BASE_URL;
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["decor-theme.spec.ts", "decor-motion.spec.ts"],
  outputDir: "test-results/decor",
  fullyParallel: false,
  reporter: "list",
  workers: 1,
  use: {
    baseURL,
    ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "decor-desktop",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.desktop },
    },
    {
      name: "decor-tablet",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.tablet },
    },
    {
      name: "decor-mobile",
      use: { ...devices["Pixel 7"], deviceScaleFactor: 1, viewport: themeViewports.mobile },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: `bun run build:preview:decor && bun scripts/serve-static.ts ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
