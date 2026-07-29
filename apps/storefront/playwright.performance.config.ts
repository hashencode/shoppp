import { defineConfig } from "@playwright/test";

const port = Number(process.env.STOREFRONT_PERF_PORT || 3421);
const baseURL = process.env.STOREFRONT_PERF_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "performance.spec.ts",
  outputDir: "test-results/performance",
  reporter: "list",
  timeout: 180_000,
  use: { baseURL },
  webServer: process.env.STOREFRONT_PERF_BASE_URL
    ? undefined
    : {
        command: `bun run build && wrangler dev --port ${port} --local`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
