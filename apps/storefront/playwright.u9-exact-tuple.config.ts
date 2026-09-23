import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STOREFRONT_U9_EXACT_TUPLE_PORT || 3437);
const externalBaseURL = process.env.STOREFRONT_U9_EXACT_TUPLE_BASE_URL;
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;
const prebuilt = process.env.STOREFRONT_U9_EXACT_PREBUILT === "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["u9-exact-tuple.spec.ts"],
  outputDir: "test-results/u9-exact-tuple",
  reporter: "list",
  workers: 1,
  use: {
    baseURL,
    contextOptions: { reducedMotion: "reduce" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "u9-exact-tuple-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseURL ? undefined : {
    command: prebuilt
      ? `bun scripts/serve-static.ts ${port}`
      : `NUXT_CATALOG_RELEASE_FILE=test-results/u9-exact-tuple-release.json STOREFRONT_BUILD_MODE=preview STOREFRONT_EXPERIENCE_FILE=test-results/u9-exact-tuple-build-input.json bun run build && STOREFRONT_BUILD_MODE=preview bun scripts/verify-static.ts && bun scripts/serve-static.ts ${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
    url: baseURL,
  },
});
