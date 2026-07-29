import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { chromium, expect, test } from "@playwright/test";

const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../app/generated/route-manifest.json"), "utf8"),
) as { routes: string[] };
const routes = [
  "/",
  manifest.routes.find((route) => route.startsWith("/collections/")),
  manifest.routes.find((route) => route.startsWith("/products/")),
].filter((route): route is string => Boolean(route));
const thresholds = {
  accessibility: 0.95,
  "best-practices": 0.95,
  performance: 0.9,
  seo: 1,
} as const;

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

test("core storefront routes meet mobile Lighthouse budgets", async ({ baseURL }) => {
  const [{ launch }, { default: lighthouse }] = await Promise.all([
    import("chrome-launcher"),
    import("lighthouse"),
  ]);
  const chrome = await launch({
    chromeFlags: ["--no-sandbox", "--disable-dev-shm-usage"],
    chromePath: lighthouseChromePath(),
  });
  try {
    for (const route of routes) {
      const auditRoute = () =>
        lighthouse(`${baseURL}${route}`, {
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
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const scores = Object.fromEntries(
          Object.keys(thresholds).map((category) => [
            category,
            result!.lhr.categories[category]?.score,
          ]),
        );
        console.log(`Lighthouse ${route} attempt ${attempt}: ${JSON.stringify(scores)}`);
        if (result.lhr.runtimeError) {
          throw new Error(
            `Lighthouse runtime error for ${route}: ${result.lhr.runtimeError.code} ${result.lhr.runtimeError.message}`,
          );
        }
        const missedBudget = Object.entries(thresholds).some(
          ([category, threshold]) => (result!.lhr.categories[category]?.score ?? 0) < threshold,
        );
        if (!missedBudget || attempt === 2) break;
        console.warn(`Retrying one transient Lighthouse budget miss for ${route}.`);
        result = await auditRoute();
        if (!result) throw new Error(`Lighthouse did not return a retry result for ${route}.`);
      }
      for (const [category, threshold] of Object.entries(thresholds)) {
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
    await chrome.kill();
  }
});
