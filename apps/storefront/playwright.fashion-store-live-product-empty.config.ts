import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STOREFRONT_FASHION_STORE_LIVE_PRODUCT_EMPTY_PORT || 3431);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  globalTeardown: "./e2e/support/restore-fashion-store-preview.ts",
  testDir: "./e2e",
  testMatch: ["fashion-store-live-product-empty.spec.ts"],
  outputDir: "test-results/fashion-store-live-product-empty",
  reporter: "list",
  workers: 1,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "fashion-store-live-product-empty-desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `bun scripts/prepare-theme-preview-fixture.ts fashion-store && bun scripts/prepare-fashion-store-live-e2e.ts --empty-product && NUXT_TYPECHECK=false STOREFRONT_BUILD_MODE=preview STOREFRONT_EXPERIENCE_FILE=fixtures/experience/.generated/fashion-store-live-empty-product-e2e-input.json bun run dev -- --host 127.0.0.1 --port ${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
    url: baseURL,
  },
});
