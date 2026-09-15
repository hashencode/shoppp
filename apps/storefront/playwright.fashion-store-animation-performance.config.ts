import { defineConfig } from "@playwright/test";

const port = Number(process.env.STOREFRONT_FASHION_STORE_MOTION_PORT || 3441);
const baseURL = process.env.STOREFRONT_FASHION_STORE_MOTION_BASE_URL || `http://127.0.0.1:${port}`;
const profile = "combined";
const experienceFile =
  "fixtures/experience/.generated/fashion-store-live-unified-home-e2e-input.json";
const serverCommand = [
  `STOREFRONT_FASHION_HOME_PROFILE=${profile} bun scripts/prepare-theme-preview-fixture.ts fashion-store`,
  `STOREFRONT_FASHION_HOME_PROFILE=${profile} bun scripts/prepare-fashion-store-live-e2e.ts --unified-home`,
  `NUXT_TYPECHECK=false STOREFRONT_FASHION_HOME_PROFILE=${profile} STOREFRONT_BUILD_MODE=preview STOREFRONT_EXPERIENCE_FILE=${experienceFile} bun run build`,
  "STOREFRONT_BUILD_MODE=preview bun run verify:static",
  `bun scripts/serve-static.ts ${port}`,
].join(" && ");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "fashion-store-animation-performance.spec.ts",
  outputDir: "test-results/fashion-store-animation-performance",
  reporter: "list",
  timeout: 180_000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL,
    browserName: "chromium",
    reducedMotion: "no-preference",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "motion-desktop-1440-dpr2",
      metadata: {
        cpuRate: 4,
        deviceScaleFactor: 2,
        height: 900,
        motionProfile: "desktop",
        width: 1440,
      },
      use: {
        browserName: "chromium",
        deviceScaleFactor: 2,
        viewport: { height: 900, width: 1440 },
      },
    },
    {
      name: "motion-mobile-390-dpr3",
      metadata: {
        cpuRate: 4,
        deviceScaleFactor: 3,
        height: 844,
        motionProfile: "mobile",
        width: 390,
      },
      use: {
        browserName: "chromium",
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
        viewport: { height: 844, width: 390 },
      },
    },
  ],
  webServer: process.env.STOREFRONT_FASHION_STORE_MOTION_BASE_URL
    ? undefined
    : {
        command: serverCommand,
        reuseExistingServer: false,
        timeout: 240_000,
        url: baseURL,
      },
});
