import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.STOREFRONT_FASHION_PORT || 3424);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "fashion-theme.spec.ts",
  outputDir: "test-results/fashion",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "fashion-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "fashion-mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "fashion-no-js",
      use: { ...devices["Desktop Chrome"], javaScriptEnabled: false },
    },
    {
      name: "fashion-reduced-motion",
      use: { ...devices["Pixel 7"], reducedMotion: "reduce" },
    },
  ],
  webServer: {
    command: `bun run build:preview:fashion && bun scripts/serve-static.ts ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
