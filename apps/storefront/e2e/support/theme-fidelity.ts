import { mkdir, rename, writeFile } from "node:fs/promises";
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
  const viewport = (Object.keys(themeViewports) as Array<keyof typeof themeViewports>).find((id) =>
    testInfo.project.name.includes(id),
  );
  if (!root || !viewport) return;
  const imageDiagnostics = await page.evaluate(async () => {
    const images = [...document.images];
    for (const image of images) image.loading = "eager";
    for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight * 0.8) {
      scrollTo(0, top);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
    scrollTo(0, document.documentElement.scrollHeight);
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    scrollTo(0, 0);
    return images
      .filter((image) => image.currentSrc && image.naturalWidth === 0)
      .map((image) => image.currentSrc);
  });
  expect(imageDiagnostics).toEqual([]);
  await mkdir(`${root}/${themeId}`, { recursive: true });
  const metadataPath = `${root}/${themeId}/metadata.json`;
  const temporaryMetadataPath = `${metadataPath}.${process.pid}.${testInfo.project.name.replaceAll(
    /[^a-z0-9-]/gi,
    "-",
  )}.tmp`;
  await writeFile(
    temporaryMetadataPath,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        commit: process.env.THEME_FIDELITY_COMMIT ?? "uncommitted",
        state: "initial-home",
        themeId,
        viewports: Object.entries(themeViewports).map(([id, dimensions]) => ({
          ...dimensions,
          id,
        })),
      },
      null,
      2,
    )}\n`,
  );
  await rename(temporaryMetadataPath, metadataPath);
  await page.screenshot({
    animations: "disabled",
    fullPage: true,
    path: `${root}/${themeId}/${viewport}.png`,
  });
}
