import { defineConfig, devices } from "@playwright/test";

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const port = Number(process.env.STOREFRONT_DECOR_STORE_PORT || 3436);
const externalBaseURL = process.env.STOREFRONT_DECOR_STORE_BASE_URL;
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["decor-store-acceptance-slice.spec.ts"],
  outputDir: "test-results/decor-store",
  fullyParallel: false,
  reporter: "list",
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    hasTouch: true,
    ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: `bun run build:preview:decor-store && bun scripts/serve-static.ts ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
