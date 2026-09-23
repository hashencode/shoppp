import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STOREFRONT_FASHION_AUTHORED_HERO_PORT || 3441);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["fashion-store-authored-hero.spec.ts"],
  outputDir: "test-results/fashion-store-authored-hero",
  reporter: "list",
  workers: 1,
  use: { baseURL, screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    {
      name: "authored-hero-desktop",
      metadata: { fashionStoreViewport: "desktop" },
      use: { ...devices["Desktop Chrome"], viewport: { height: 1_000, width: 1_440 } },
    },
    {
      name: "authored-hero-mobile",
      metadata: { fashionStoreViewport: "mobile" },
      use: { ...devices["Pixel 7"], viewport: { height: 844, width: 390 } },
    },
  ],
  webServer: {
    command: `STOREFRONT_FASHION_AUTHORED_HERO_COUNT=5 bun scripts/prepare-theme-preview-fixture.ts fashion-store && STOREFRONT_FASHION_AUTHORED_HERO_COUNT=5 bun scripts/prepare-fashion-store-live-e2e.ts && NUXT_TYPECHECK=false STOREFRONT_BUILD_MODE=preview STOREFRONT_EXPERIENCE_FILE=fixtures/experience/.generated/fashion-store-live-e2e-input.json bun run dev -- --host 127.0.0.1 --port ${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
    url: baseURL,
  },
});
