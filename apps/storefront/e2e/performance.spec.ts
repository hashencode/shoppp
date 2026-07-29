import { existsSync } from "node:fs";
import { join } from "node:path";

import { chromium, expect, test } from "@playwright/test";

const routes = ["/", "/collections/travel-essentials", "/products/atlas-carry-on"];
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
      const result = await lighthouse(`${baseURL}${route}`, {
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
      if (!result) throw new Error(`Lighthouse did not return a result for ${route}.`);
      const scores = Object.fromEntries(
        Object.keys(thresholds).map((category) => [
          category,
          result.lhr.categories[category]?.score,
        ]),
      );
      console.log(`Lighthouse ${route}: ${JSON.stringify(scores)}`);
      if (result.lhr.runtimeError) {
        throw new Error(
          `Lighthouse runtime error for ${route}: ${result.lhr.runtimeError.code} ${result.lhr.runtimeError.message}`,
        );
      }
      for (const [category, threshold] of Object.entries(thresholds)) {
        const score = result.lhr.categories[category]?.score ?? 0;
        expect(
          score,
          `${route} ${category} score ${Math.round(score * 100)} is below ${threshold * 100}`,
        ).toBeGreaterThanOrEqual(threshold);
      }
    }
  } finally {
    await chrome.kill();
  }
});
