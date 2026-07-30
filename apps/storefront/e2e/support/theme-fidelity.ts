import { mkdir, writeFile } from "node:fs/promises";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { themeViewports } from "./theme-viewports";

export async function assertThemeLayout(page: Page): Promise<void> {
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    collisions: [...document.querySelectorAll("h1, h2, h3, p, button, a")].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > innerWidth + 1;
    }).length,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.collisions).toBe(0);
}

export async function captureThemeEvidence(
  page: Page,
  testInfo: TestInfo,
  themeId: "decor" | "fashion",
): Promise<void> {
  const root = process.env.THEME_FIDELITY_CAPTURE_ROOT;
  if (
    !root ||
    !["desktop", "mobile"].some((viewport) => testInfo.project.name.includes(viewport))
  ) {
    return;
  }
  await page.evaluate(async () => {
    for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight * 0.8) {
      scrollTo(0, top);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
    scrollTo(0, 0);
  });
  const viewport = testInfo.project.name.includes("mobile") ? "mobile" : "desktop";
  await mkdir(`${root}/${themeId}`, { recursive: true });
  await writeFile(
    `${root}/${themeId}/metadata.json`,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        commit: process.env.THEME_FIDELITY_COMMIT ?? "uncommitted",
        state: "initial-home",
        themeId,
        viewports: [
          { ...themeViewports.desktop, id: "desktop" },
          { ...themeViewports.mobile, id: "mobile" },
        ],
      },
      null,
      2,
    )}\n`,
  );
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: `${root}/${themeId}/${viewport}.png`,
  });
}
