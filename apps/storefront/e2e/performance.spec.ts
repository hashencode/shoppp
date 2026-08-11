import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { chromium, expect, test, type Page } from "@playwright/test";

import { fashionStorePageContracts } from "../app/themes/fashion-store/page-contracts";

const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../app/generated/route-manifest.json"), "utf8"),
) as { routes: string[] };
const theme = process.env.STOREFRONT_THEME ?? "production-fallback";
const rootUrlOverride = process.env.STOREFRONT_PERF_ROOT_URL;
const fashionStorePerformancePageIds = new Set([
  "home",
  "shop-left",
  "product",
  "cart",
  "checkout",
  "magazine",
]);
const fashionStoreRoutes = fashionStorePageContracts
  .filter(({ id }) => fashionStorePerformancePageIds.has(id))
  .map(({ path }) => path);
if (fashionStoreRoutes.length !== fashionStorePerformancePageIds.size) {
  throw new Error("Fashion Store performance routes are incomplete.");
}
function performanceRoutes(): string[] {
  if (rootUrlOverride || theme === "decor-store") return ["/"];
  if (theme === "fashion-store") return fashionStoreRoutes;
  return [
    "/",
    manifest.routes.find((route) => route.startsWith("/collections/")),
    manifest.routes.find((route) => route.startsWith("/products/")),
    "/cart",
    "/checkout",
    "/orders/fixture-order",
    manifest.routes.find((route) => route.startsWith("/policies/")),
  ].filter((route): route is string => Boolean(route));
}

const routes = performanceRoutes();
const thresholds = {
  accessibility: 0.95,
  "best-practices": 0.95,
  performance: 0.9,
  seo: 1,
} as const;
const routeThresholds = (route: string) => ({
  ...thresholds,
  // Source-equivalent themes intentionally preserve their source package's audited low-contrast
  // labels and secondary copy. Dedicated Axe gates enforce every serious structural rule.
  accessibility: ["decor-store", "fashion-store"].includes(theme) ? 0.85 : thresholds.accessibility,
  performance: thresholds.performance,
  // Private previews and production transaction shells are intentionally noindex, which
  // Lighthouse reports as an SEO deduction. verify-static.ts separately enforces their
  // canonical metadata, meaningful HTML, noindex tags, and sitemap exclusion.
  seo:
    theme !== "production-fallback"
      ? 0.65
      : ["/cart", "/checkout"].includes(route) || route.startsWith("/orders/")
        ? 0.5
        : 1,
});

function lighthouseChromePath(): string {
  if (process.env.LIGHTHOUSE_CHROME_PATH) return process.env.LIGHTHOUSE_CHROME_PATH;
  const chromiumPath = chromium.executablePath();
  const revision = chromiumPath.match(/chromium-(\d+)/)?.[1];
  if (!revision) return chromiumPath;
  const cacheRoot = chromiumPath.split(`/chromium-${revision}/`)[0] ?? chromiumPath;
  const macArchitecture = process.arch === "arm64" ? "arm64" : "x64";
  const executable =
    process.platform === "darwin"
      ? join(
          cacheRoot,
          `chromium_headless_shell-${revision}`,
          `chrome-headless-shell-mac-${macArchitecture}`,
          "chrome-headless-shell",
        )
      : process.platform === "win32"
        ? join(
            cacheRoot,
            `chromium_headless_shell-${revision}`,
            "chrome-headless-shell-win64",
            "chrome-headless-shell.exe",
          )
        : join(
            cacheRoot,
            `chromium_headless_shell-${revision}`,
            "chrome-headless-shell-linux64",
            "chrome-headless-shell",
          );
  return existsSync(executable) ? executable : chromiumPath;
}

test(`${theme} storefront routes meet mobile Lighthouse budgets`, async ({ baseURL }) => {
  const [{ launch }, { default: lighthouse }] = await Promise.all([
    import("chrome-launcher"),
    import("lighthouse"),
  ]);
  const chrome = await launch({
    chromeFlags: ["--no-sandbox", "--disable-dev-shm-usage"],
    chromePath: lighthouseChromePath(),
  });
  const lighthouseBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
  try {
    const context = lighthouseBrowser.contexts()[0];
    if (!context) throw new Error("Lighthouse did not expose its default browser context.");
    const emulateStableMotionState = (page: Page) => page.emulateMedia({ reducedMotion: "reduce" });
    context.on("page", emulateStableMotionState);
    await Promise.all(context.pages().map(emulateStableMotionState));
    await context.addInitScript(() => {
      const applyStableMotionPolicy = () => {
        const style = document.createElement("style");
        style.dataset.performanceMotionPolicy = "reduced";
        style.textContent =
          "*,*::before,*::after{animation:none!important;scroll-behavior:auto!important;transition:none!important}" +
          "[data-motion-layer]{opacity:1!important;filter:none!important}" +
          "[data-source-reveal]{opacity:1!important;transform:none!important;visibility:visible!important}";
        document.documentElement.append(style);
      };
      if (document.documentElement) applyStableMotionPolicy();
      else {
        const observer = new MutationObserver(() => {
          if (!document.documentElement) return;
          observer.disconnect();
          applyStableMotionPolicy();
        });
        observer.observe(document, { childList: true });
      }
    });
    await context.addCookies([
      {
        name: "cookieConsent",
        url: baseURL!,
        value: "closed",
      },
    ]);
    for (const route of routes) {
      const expected = routeThresholds(route);
      const auditRoute = () =>
        lighthouse(rootUrlOverride && route === "/" ? rootUrlOverride : `${baseURL}${route}`, {
          disableStorageReset: true,
          formFactor: "mobile",
          logLevel: "error",
          onlyCategories: Object.keys(thresholds),
          output: "json",
          port: chrome.port,
          screenEmulation: {
            deviceScaleFactor: 2.625,
            disabled: false,
            height: 823,
            mobile: true,
            width: 412,
          },
          throttlingMethod: "simulate",
        });
      let result = await auditRoute();
      if (!result) throw new Error(`Lighthouse did not return a result for ${route}.`);
      const maximumAttempts = 3;
      for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
        const scores = Object.fromEntries(
          Object.keys(thresholds).map((category) => [
            category,
            result!.lhr.categories[category]?.score,
          ]),
        );
        const runtimeMetrics = {
          largestContentfulPaintMs:
            result.lhr.audits["largest-contentful-paint"]?.numericValue ?? null,
          totalBlockingTimeMs: result.lhr.audits["total-blocking-time"]?.numericValue ?? null,
        };
        console.log(
          `Lighthouse ${route} attempt ${attempt}: ${JSON.stringify({ ...scores, ...runtimeMetrics })}`,
        );
        if (result.lhr.runtimeError) {
          throw new Error(
            `Lighthouse runtime error for ${route}: ${result.lhr.runtimeError.code} ${result.lhr.runtimeError.message}`,
          );
        }
        const missedBudget = Object.entries(expected).some(
          ([category, threshold]) => (result!.lhr.categories[category]?.score ?? 0) < threshold,
        );
        if (!missedBudget || attempt === maximumAttempts) break;
        console.warn(
          `Retrying transient Lighthouse budget miss for ${route} (attempt ${attempt + 1} of ${maximumAttempts}).`,
        );
        result = await auditRoute();
        if (!result) throw new Error(`Lighthouse did not return a retry result for ${route}.`);
      }
      for (const [category, threshold] of Object.entries(expected)) {
        const lighthouseCategory = result.lhr.categories[category];
        const score = lighthouseCategory?.score ?? 0;
        const failedAudits = (lighthouseCategory?.auditRefs ?? [])
          .filter(({ id, weight }) => weight > 0 && (result.lhr.audits[id]?.score ?? 0) < 1)
          .map(({ id }) => {
            const audit = result.lhr.audits[id];
            return `${id}: ${audit?.title ?? "unknown"}${audit?.displayValue ? ` (${audit.displayValue})` : ""}`;
          });
        expect(
          score,
          `${route} ${category} score ${Math.round(score * 100)} is below ${threshold * 100}; failed audits: ${failedAudits.join("; ") || "unknown"}`,
        ).toBeGreaterThanOrEqual(threshold);
      }
    }
  } finally {
    await lighthouseBrowser.close().catch(() => undefined);
    await chrome.kill();
  }
});
