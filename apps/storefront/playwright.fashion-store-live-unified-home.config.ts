import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STOREFRONT_FASHION_STORE_LIVE_UNIFIED_HOME_PORT || 3430);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  globalTeardown: "./e2e/support/restore-fashion-store-preview.ts",
  testDir: "./e2e",
  testMatch: ["fashion-store-live-unified-home.spec.ts"],
  outputDir: "test-results/fashion-store-live-unified-home",
  reporter: "list",
  workers: 1,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "fashion-store-live-unified-home-desktop",
      use: { ...devices["Desktop Chrome"], reducedMotion: "no-preference" },
    },
    {
      name: "fashion-store-live-unified-home-mobile-reduced",
      use: {
        ...devices["Pixel 7"],
        contextOptions: { reducedMotion: "reduce" },
        reducedMotion: "reduce",
      },
    },
  ],
  webServer: {
    command: `bun scripts/prepare-theme-preview-fixture.ts fashion-store && bun scripts/prepare-fashion-store-live-e2e.ts --unified-home && NUXT_TYPECHECK=false STOREFRONT_BUILD_MODE=preview STOREFRONT_EXPERIENCE_FILE=fixtures/experience/.generated/fashion-store-live-unified-home-e2e-input.json bun run dev -- --host 127.0.0.1 --port ${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
    url: baseURL,
  },
});
