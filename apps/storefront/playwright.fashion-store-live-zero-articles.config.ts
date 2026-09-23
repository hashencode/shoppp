import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STOREFRONT_FASHION_STORE_ZERO_ARTICLES_PORT || 3431);
const externalBaseURL = process.env.STOREFRONT_FASHION_STORE_ZERO_ARTICLES_BASE_URL;
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;

export default defineConfig({
  globalTeardown: "./e2e/support/restore-fashion-store-preview.ts",
  testDir: "./e2e",
  testMatch: ["fashion-store-live-zero-articles.spec.ts"],
  outputDir: "test-results/fashion-store-live-zero-articles",
  reporter: "list",
  workers: 1,
  use: {
    baseURL,
    contextOptions: { reducedMotion: "reduce" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "fashion-store-zero-articles", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseURL
    ? undefined
    : {
        command: `bun scripts/prepare-theme-preview-fixture.ts fashion-store && bun scripts/prepare-fashion-store-live-e2e.ts --zero-articles && NUXT_TYPECHECK=false STOREFRONT_BUILD_MODE=preview STOREFRONT_EXPERIENCE_FILE=fixtures/experience/.generated/fashion-store-live-zero-articles-e2e-input.json bun run dev -- --host 127.0.0.1 --port ${port}`,
        reuseExistingServer: false,
        timeout: 180_000,
        url: baseURL,
      },
});
