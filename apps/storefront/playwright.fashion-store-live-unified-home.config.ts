import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STOREFRONT_FASHION_STORE_LIVE_UNIFIED_HOME_PORT || 3430);
const baseURL = `http://127.0.0.1:${port}`;
const sourcePort = Number(process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427);
const sourceRoot =
  process.env.STOREFRONT_FASHION_STORE_SOURCE_ROOT ||
  "../../templates/Crafto - The Multipurpose HTML5 Template/html";

export default defineConfig({
  timeout: 60_000,
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
      name: "fashion-store-live-unified-home-1440",
      use: {
        ...devices["Desktop Chrome"],
        reducedMotion: "no-preference",
        viewport: { height: 1_000, width: 1_440 },
      },
    },
    {
      name: "fashion-store-live-unified-home-1024",
      use: {
        ...devices["Desktop Chrome"],
        reducedMotion: "no-preference",
        viewport: { height: 900, width: 1_024 },
      },
    },
    {
      name: "fashion-store-live-unified-home-768",
      use: {
        ...devices["Desktop Chrome"],
        reducedMotion: "no-preference",
        viewport: { height: 1_024, width: 768 },
      },
    },
    {
      name: "fashion-store-live-unified-home-mobile-390-reduced",
      use: {
        ...devices["Pixel 7"],
        contextOptions: { reducedMotion: "reduce" },
        reducedMotion: "reduce",
        viewport: { height: 844, width: 390 },
      },
    },
  ],
  webServer: [
    {
      command: `bun scripts/prepare-theme-preview-fixture.ts fashion-store && bun scripts/prepare-fashion-store-live-e2e.ts --unified-home && NUXT_TYPECHECK=false STOREFRONT_BUILD_MODE=preview STOREFRONT_EXPERIENCE_FILE=fixtures/experience/.generated/fashion-store-live-unified-home-e2e-input.json bun run dev -- --host 127.0.0.1 --port ${port}`,
      reuseExistingServer: false,
      timeout: 180_000,
      url: baseURL,
    },
    {
      command: `python3 -m http.server ${sourcePort} --bind 127.0.0.1 --directory=${JSON.stringify(sourceRoot)} >/dev/null 2>&1`,
      reuseExistingServer: false,
      timeout: 30_000,
      url: `http://127.0.0.1:${sourcePort}/demo-decor-store.html`,
    },
  ],
});
