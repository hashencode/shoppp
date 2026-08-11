import { defineConfig } from "@playwright/test";

const port = Number(process.env.STOREFRONT_PERF_PORT || 3421);
const baseURL = process.env.STOREFRONT_PERF_BASE_URL || `http://127.0.0.1:${port}`;
const theme = process.env.STOREFRONT_THEME;
if (theme && theme !== "decor-store" && theme !== "fashion-store") {
  throw new Error(`Unsupported STOREFRONT_THEME: ${theme}`);
}
const buildCommand = theme ? `bun run build:preview:${theme}` : "bun run build";
const verifyCommand = theme
  ? "STOREFRONT_BUILD_MODE=preview bun run verify:static"
  : "bun run verify:static";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "performance.spec.ts",
  outputDir: "test-results/performance",
  reporter: "list",
  timeout: 180_000,
  workers: 1,
  use: { baseURL },
  webServer: process.env.STOREFRONT_PERF_BASE_URL
    ? undefined
    : {
        command: `${buildCommand} && ${verifyCommand} && bun scripts/check-bundle-budget.ts && bun scripts/serve-static.ts ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
