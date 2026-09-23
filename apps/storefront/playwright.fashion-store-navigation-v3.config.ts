import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STOREFRONT_FASHION_STORE_NAVIGATION_V3_PORT || 3437);
const externalBaseURL = process.env.STOREFRONT_FASHION_STORE_NAVIGATION_V3_BASE_URL;
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;

export default defineConfig({
  globalTeardown: "./e2e/support/restore-fashion-store-preview.ts",
  testDir: "./e2e",
  testMatch: ["fashion-store-navigation-v3.spec.ts"],
  outputDir: "test-results/fashion-store-navigation-v3",
  reporter: "list",
  workers: 1,
  use: {
    baseURL,
    contextOptions: { reducedMotion: "reduce" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "fashion-store-navigation-v3-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { height: 1000, width: 1440 } },
    },
    {
      name: "fashion-store-navigation-v3-mobile",
      use: { ...devices["Pixel 7"], deviceScaleFactor: 1 },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: `bun scripts/prepare-theme-preview-fixture.ts fashion-store && bun scripts/prepare-fashion-store-live-e2e.ts --navigation-v3 && NUXT_TYPECHECK=false STOREFRONT_BUILD_MODE=preview STOREFRONT_EXPERIENCE_FILE=fixtures/experience/.generated/fashion-store-navigation-v3-e2e-input.json bun run dev -- --host 127.0.0.1 --port ${port}`,
        reuseExistingServer: false,
        timeout: 180_000,
        url: baseURL,
      },
});
