import { mkdir, rename, writeFile } from "node:fs/promises";
import { expect, type Page, type TestInfo } from "@playwright/test";
import {
  deterministicCaptureCss,
  initialCarouselSelectors,
  type ImplementationCaptureThemeId,
} from "./theme-capture-contract";
import { themeViewports } from "./theme-viewports";

export async function waitForNuxtHydration(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      Boolean(
        (document.querySelector("#__nuxt") as (HTMLElement & { __vue_app__?: unknown }) | null)
          ?.__vue_app__,
      ),
    undefined,
    { timeout: 15_000 },
  );
}

export async function assertThemeLayout(page: Page): Promise<void> {
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    collisions: [...document.querySelectorAll("h1, h2, h3, p, button, a")]
      .filter((element) => {
        if (
          element.closest(
            '[aria-hidden="true"], [data-source-reveal], .fashion-hero, .fashion-promises, .decor-marquee, .decor-hero',
          )
        )
          return false;
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0 &&
          box.width > innerWidth + 1
        );
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          className: element.className,
          tagName: element.tagName,
          text: element.textContent?.replaceAll(/\s+/g, " ").trim().slice(0, 80),
          width: box.width,
        };
      }),
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.collisions).toEqual([]);
}

export async function captureThemeEvidence(
  page: Page,
  testInfo: TestInfo,
  themeId: ImplementationCaptureThemeId,
): Promise<void> {
  const root = process.env.THEME_FIDELITY_CAPTURE_ROOT;
  const viewport = (Object.keys(themeViewports) as Array<keyof typeof themeViewports>).find((id) =>
    testInfo.project.name.includes(id),
  );
  if (!root || !viewport) return;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: deterministicCaptureCss });
  await page
    .getByRole("button", { name: "Allow cookies" })
    .click({ timeout: 1_500 })
    .catch(() => undefined);
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
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 350));
    return images
      .filter((image) => image.currentSrc && image.naturalWidth === 0)
      .map((image) => image.currentSrc);
  });
  expect(imageDiagnostics).toEqual([]);
  await resetInitialCarousels(page, themeId);
  if (await page.evaluate(() => document.activeElement instanceof HTMLElement)) {
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  }
  await mkdir(`${root}/${themeId}`, { recursive: true });
  const metadataPath = `${root}/${themeId}/metadata.json`;
  const temporaryMetadataPath = `${metadataPath}.${process.pid}.${testInfo.project.name.replaceAll(
    /[^a-z0-9-]/gi,
    "-",
  )}.tmp`;
  const deviceScaleFactor = await page.evaluate(() => devicePixelRatio);
  await writeFile(
    temporaryMetadataPath,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        captureMode: "static",
        commit: process.env.THEME_FIDELITY_COMMIT ?? "uncommitted",
        state: "initial-home",
        themeId,
        viewports: Object.entries(themeViewports).map(([id, dimensions]) => ({
          ...dimensions,
          dpr: deviceScaleFactor,
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

async function resetInitialCarousels(
  page: Page,
  themeId: ImplementationCaptureThemeId,
): Promise<void> {
  if (themeId === "fashion-store") {
    const firstSlide = page.getByRole("button", { name: "Show slide 1" });
    await firstSlide.evaluate((button) => (button as HTMLButtonElement).click());
    await expect(page.locator(initialCarouselSelectors[themeId][0])).toHaveAttribute(
      "data-motion-active-index",
      "0",
    );
  }

  for (const selector of initialCarouselSelectors[themeId]) {
    const carousel = page.locator(selector);
    await expect(carousel).toHaveAttribute("data-motion-ready", "true");
    await expect(carousel).toHaveAttribute("data-motion-phase", "idle");
    const activeIndex = Number(await carousel.getAttribute("data-motion-active-index"));
    expect(Number.isInteger(activeIndex) && activeIndex >= 0).toBe(true);
    if (activeIndex === 0) continue;
    await carousel.focus();
    for (let index = 0; index < activeIndex; index += 1) {
      await page.keyboard.press("ArrowLeft");
      await expect(carousel).toHaveAttribute("data-motion-phase", "idle");
    }
    await expect(carousel).toHaveAttribute("data-motion-active-index", "0");
  }
}
