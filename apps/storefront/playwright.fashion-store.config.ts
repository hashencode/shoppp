import { defineConfig, devices } from "@playwright/test";
import { themeViewports } from "./e2e/support/theme-viewports";

const port = Number(process.env.STOREFRONT_FASHION_STORE_PORT || 3426);
const sourcePort = Number(process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427);
const externalBaseURL = process.env.STOREFRONT_FASHION_STORE_BASE_URL;
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;
const sourceRoot =
  process.env.STOREFRONT_FASHION_STORE_SOURCE_ROOT ||
  "../../templates/Crafto - The Multipurpose HTML5 Template/html";
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "fashion-store-theme.spec.ts",
    "fashion-store-acceptance-slice.spec.ts",
    "fashion-store-acceptance-self-test.spec.ts",
    "theme-behavior-contract.spec.ts",
  ],
  outputDir: "test-results/fashion-store",
  fullyParallel: false,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/fashion-store-behavior-results.json" }],
  ],
  workers: 1,
  use: {
    baseURL,
    ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "fashion-store-desktop",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.desktop },
    },
    {
      name: "fashion-store-laptop",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.laptop },
    },
    {
      name: "fashion-store-tablet",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.tablet },
    },
    {
      name: "fashion-store-mobile",
      use: {
        ...devices["Pixel 7"],
        deviceScaleFactor: 1,
        viewport: themeViewports.mobile,
      },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : [
        {
          command: `bun run build:preview:fashion-store && STOREFRONT_BUILD_MODE=preview bun run verify:static && bun scripts/check-bundle-budget.ts && bun scripts/serve-static.ts ${port}`,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 180_000,
        },
        {
          command: `python3 -m http.server ${sourcePort} --bind 127.0.0.1 --directory=${JSON.stringify(sourceRoot)}`,
          url: `http://127.0.0.1:${sourcePort}/demo-fashion-store.html`,
          reuseExistingServer: false,
          timeout: 30_000,
        },
      ],
});
