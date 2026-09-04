import { defineConfig, devices } from "@playwright/test";
import { themeViewports } from "./e2e/support/theme-viewports";

const port = Number(process.env.STOREFRONT_FASHION_STORE_PORT || 3426);
const sourcePort = Number(process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427);
const externalBaseURL = process.env.STOREFRONT_FASHION_STORE_BASE_URL;
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;
const sourceRoot =
  process.env.STOREFRONT_FASHION_STORE_SOURCE_ROOT ||
  "../../templates/Crafto - The Multipurpose HTML5 Template/html";
const compatibilityBaseline = process.env.STOREFRONT_FASHION_STORE_COMPATIBILITY === "1";
const crossBrowser = process.env.STOREFRONT_FASHION_STORE_CROSS_BROWSER === "1";
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./e2e",
  testMatch: compatibilityBaseline
    ? ["fashion-store-compatibility-baseline.spec.ts"]
    : ["fashion-store-*.spec.ts", "theme-behavior-contract.spec.ts"],
  testIgnore: [
    "fashion-store-live-commerce.spec.ts",
    ...(!compatibilityBaseline ? ["fashion-store-compatibility-baseline.spec.ts"] : []),
  ],
  outputDir: compatibilityBaseline
    ? "test-results/fashion-store-compatibility"
    : "test-results/fashion-store",
  fullyParallel: false,
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: compatibilityBaseline
          ? "test-results/fashion-store-compatibility-results.json"
          : "test-results/fashion-store-behavior-results.json",
      },
    ],
  ],
  workers: 1,
  use: {
    baseURL,
    ...(!compatibilityBaseline && chromiumExecutable
      ? { launchOptions: { executablePath: chromiumExecutable } }
      : {}),
    contextOptions: { reducedMotion: "reduce" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects:
    compatibilityBaseline || crossBrowser
      ? (["chromium", "firefox", "webkit"] as const).flatMap((browserName) =>
          (compatibilityBaseline
            ? (["no-preference", "reduce"] as const)
            : (["reduce"] as const)
          ).flatMap((reducedMotion) =>
            (compatibilityBaseline
              ? (["desktop", "mobile"] as const)
              : (["desktop", "tablet", "mobile"] as const)
            ).map((viewport) => ({
              name: `fashion-store-${browserName}-${viewport}-${reducedMotion}`,
              metadata: { fashionStoreBrowser: browserName, fashionStoreViewport: viewport },
              use: {
                browserName,
                viewport: themeViewports[viewport],
                deviceScaleFactor: 1,
                hasTouch: viewport === "mobile",
                ...(viewport === "mobile" && browserName !== "firefox" ? { isMobile: true } : {}),
                reducedMotion,
                contextOptions: { reducedMotion },
                ...(browserName === "chromium" && chromiumExecutable
                  ? { launchOptions: { executablePath: chromiumExecutable } }
                  : {}),
              },
            })),
          ),
        )
      : [
          {
            name: "fashion-store-desktop",
            metadata: { fashionStoreBrowser: "chromium", fashionStoreViewport: "desktop" },
            use: { ...devices["Desktop Chrome"], viewport: themeViewports.desktop },
          },
          {
            name: "fashion-store-laptop",
            metadata: { fashionStoreBrowser: "chromium", fashionStoreViewport: "laptop" },
            use: { ...devices["Desktop Chrome"], viewport: themeViewports.laptop },
          },
          {
            name: "fashion-store-tablet",
            metadata: { fashionStoreBrowser: "chromium", fashionStoreViewport: "tablet" },
            use: { ...devices["Desktop Chrome"], viewport: themeViewports.tablet },
          },
          {
            name: "fashion-store-mobile",
            metadata: { fashionStoreBrowser: "chromium", fashionStoreViewport: "mobile" },
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
          command: `bun run build:preview:fashion-store && env STOREFRONT_BUILD_MODE=preview bun scripts/verify-static.ts && bun scripts/check-bundle-budget.ts && bun scripts/serve-static.ts ${port}`,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 180_000,
        },
        {
          command: `python3 -m http.server ${sourcePort} --bind 127.0.0.1 --directory=${JSON.stringify(sourceRoot)} >/dev/null 2>&1`,
          url: `http://127.0.0.1:${sourcePort}/demo-fashion-store.html`,
          reuseExistingServer: false,
          timeout: 30_000,
        },
      ],
});
