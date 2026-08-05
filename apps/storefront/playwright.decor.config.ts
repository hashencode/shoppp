import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STOREFRONT_DECOR_PORT || 3425);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "decor-theme.spec.ts",
  outputDir: "test-results/decor",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "decor-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "decor-mobile", use: { ...devices["Pixel 7"] } },
    {
      name: "decor-no-js",
      use: { ...devices["Desktop Chrome"], javaScriptEnabled: false },
    },
    {
      name: "decor-reduced-motion",
      use: { ...devices["Pixel 7"], reducedMotion: "reduce" },
    },
  ],
  webServer: {
    command: `bun run build:preview:decor && STOREFRONT_BUILD_MODE=preview bun run verify:static && bun scripts/check-bundle-budget.ts && bun scripts/serve-static.ts ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
