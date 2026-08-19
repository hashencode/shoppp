import { defineConfig, devices } from "@playwright/test";
import { themeViewports } from "./e2e/support/theme-viewports";

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const port = Number(process.env.STOREFRONT_DECOR_STORE_PORT || 3436);
const sourcePort = Number(process.env.STOREFRONT_DECOR_STORE_SOURCE_PORT || 3437);
const externalBaseURL = process.env.STOREFRONT_DECOR_STORE_BASE_URL;
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;
const externalSourceURL = process.env.STOREFRONT_DECOR_STORE_SOURCE_URL;
const sourceRoot =
  process.env.STOREFRONT_DECOR_STORE_SOURCE_ROOT ||
  "../../templates/Crafto - The Multipurpose HTML5 Template/html";

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "decor-store-acceptance-slice.spec.ts",
    "decor-store-home.spec.ts",
    "decor-store-shell.spec.ts",
    "decor-store-shop.spec.ts",
    "decor-store-collection.spec.ts",
    "decor-store-product.spec.ts",
    "decor-store-cart-checkout-account.spec.ts",
    "decor-store-stabilization.spec.ts",
    "decor-store-source-equivalence.spec.ts",
  ],
  outputDir: "test-results/decor-store",
  fullyParallel: false,
  reporter: [["list"], ["json", { outputFile: "test-results/decor-store-behavior-results.json" }]],
  workers: 1,
  use: {
    baseURL,
    ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "decor-store-desktop",
      use: {
        ...devices["Desktop Chrome"],
        hasTouch: true,
        viewport: themeViewports.desktop,
      },
    },
    {
      name: "decor-store-laptop",
      testMatch: "decor-store-source-equivalence.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: themeViewports.laptop },
    },
    {
      name: "decor-store-tablet",
      testMatch: "decor-store-source-equivalence.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        hasTouch: true,
        viewport: themeViewports.tablet,
      },
    },
    {
      name: "decor-store-mobile",
      testMatch: [
        "decor-store-source-equivalence.spec.ts",
        "decor-store-shop.spec.ts",
        "decor-store-collection.spec.ts",
        "decor-store-product.spec.ts",
        "decor-store-cart-checkout-account.spec.ts",
      ],
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
          command: `bun run build:preview:decor-store && env STOREFRONT_BUILD_MODE=preview bun scripts/verify-static.ts && bun scripts/check-bundle-budget.ts && bun scripts/serve-static.ts ${port}`,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 180_000,
        },
        ...(externalSourceURL
          ? []
          : [
              {
                command: `python3 -m http.server ${sourcePort} --bind 127.0.0.1 --directory=${JSON.stringify(sourceRoot)} >/dev/null 2>&1`,
                reuseExistingServer: false,
                timeout: 30_000,
                url: `http://127.0.0.1:${sourcePort}/demo-decor-store.html`,
              },
            ]),
      ],
});
