import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  assertThemeScreenshotDifference,
  compareThemeScreenshots,
} from "../scripts/compare-theme-screenshots";
import { captureFontContract, compareFontContractSnapshots } from "./support/theme-font-contract";
import { captureMotionContract } from "./support/theme-motion-contract";
import {
  captureSourceContract,
  compareSourceContractSnapshots,
  type SourceContractSnapshot,
} from "./support/theme-source-contract";

const sourceURL = `http://127.0.0.1:${Number(process.env.STOREFRONT_FASHION_2_SOURCE_PORT || 3427)}/demo-fashion-store.html`;
const fontData = (name: "figtree" | "outfit") =>
  readFileSync(
    new URL(`../app/themes/fashion-2/upstream/fonts/${name}-latin.woff2`, import.meta.url),
  ).toString("base64");
const deterministicCss = `
  @font-face { font-family: "Fashion2CaptureOutfit"; font-style: normal; font-weight: 300 900;
    src: url("data:font/woff2;base64,${fontData("outfit")}") format("woff2"); }
  @font-face { font-family: "Fashion2CaptureFigtree"; font-style: normal; font-weight: 300 800;
    src: url("data:font/woff2;base64,${fontData("figtree")}") format("woff2"); }
  :root { --alt-font: "Fashion2CaptureOutfit", sans-serif !important;
    --primary-font: "Fashion2CaptureFigtree", sans-serif !important; }
  *, *::before, *::after { animation-duration: 0s !important; transition: none !important; }
  [data-anime], [data-anime] > *, .grid-loading, .grid-loading > * {
    opacity: 1 !important; transform: none !important; visibility: visible !important;
  }
  #cookies-model, .sticky-wrap, .scroll-progress, .theme-demos { display: none !important; }
`;

async function ready(page: Page, url: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: deterministicCss });
  if (url === "/") {
    await page.locator('[data-fashion-2-slide="0"]').dispatchEvent("click");
  } else {
    await page.evaluate(() => {
      const swiper = (
        document.querySelector(".swiper") as HTMLElement & {
          swiper?: {
            autoplay?: { stop(): void };
            slideToLoop(index: number, speed: number): void;
          };
        }
      ).swiper;
      swiper?.autoplay?.stop();
      swiper?.slideToLoop(0, 0);
    });
  }
  await page.evaluate(async () => document.fonts.ready);
}

function normalizeRegions(snapshot: SourceContractSnapshot): SourceContractSnapshot {
  const normalized = structuredClone(snapshot);
  normalized.documentHeight = 1_000;
  for (const probe of normalized.probes) {
    for (const element of probe.elements) {
      const { height, width } = element.rect;
      element.rect = { bottom: height, height, left: 0, right: width, top: 0, width };
    }
  }
  return normalized;
}

async function regionalPixelGate(
  source: Page,
  implementation: Page,
  sourceSelector: string,
  implementationSelector: string,
  id: string,
  testInfo: TestInfo,
  maxChangedPixelRatio = 0.01,
): Promise<void> {
  const referencePath = testInfo.outputPath(`${id}-reference.png`);
  const implementationPath = testInfo.outputPath(`${id}-implementation.png`);
  await Promise.all([
    source.locator(sourceSelector).first().scrollIntoViewIfNeeded(),
    implementation.locator(implementationSelector).first().scrollIntoViewIfNeeded(),
  ]);
  const [referenceBox, implementationBox] = await Promise.all([
    source.locator(sourceSelector).first().boundingBox(),
    implementation.locator(implementationSelector).first().boundingBox(),
  ]);
  if (!referenceBox || !implementationBox) throw new Error(`${id} region is missing.`);
  const width = Math.round(Math.min(referenceBox.width, implementationBox.width));
  const height = Math.round(Math.min(referenceBox.height, implementationBox.height));
  await source.screenshot({
    clip: { height, width, x: Math.round(referenceBox.x), y: Math.round(referenceBox.y) },
    path: referencePath,
  });
  await implementation.screenshot({
    clip: {
      height,
      width,
      x: Math.round(implementationBox.x),
      y: Math.round(implementationBox.y),
    },
    path: implementationPath,
  });
  const difference = await compareThemeScreenshots(
    referencePath,
    implementationPath,
    testInfo.outputPath(`${id}-diff.png`),
  );
  assertThemeScreenshotDifference(difference, maxChangedPixelRatio);
}

test("source header, hero, and first product card pass the two-viewport slice", async ({
  browser,
  page,
}, testInfo) => {
  const source = await browser.newPage({
    reducedMotion: "reduce",
    viewport: page.viewportSize()!,
  });
  await Promise.all([ready(source, sourceURL), ready(page, "/")]);
  await expect(page.locator("[data-fashion-2-source-parity]")).toHaveCount(1);
  await expect(page.locator("[data-fashion-2-source-parity]")).toHaveAttribute(
    "data-runtime-instance-count",
    "1",
  );
  await expect(page.locator(".swiper")).toHaveAttribute("data-motion-ready", "true");

  const mobile = page.viewportSize()!.width === 390;
  const sourceProbes = [
    {
      content: false,
      id: "navbar",
      selector: "header .navbar",
      styles: ["background-color", "padding-top", "padding-bottom"],
    },
    {
      content: false,
      id: "logo",
      selector: mobile ? ".navbar-brand .mobile-logo" : ".navbar-brand .default-logo",
    },
    {
      content: false,
      id: "hero",
      selector: ".swiper.full-screen",
      styles: ["height", "width"],
    },
    {
      content: false,
      id: "product",
      selector: "section:nth-of-type(4) .shop-modern .grid-item:nth-child(2) .shop-image",
      styles: ["height", "width"],
    },
  ] as const;
  const implementationProbes = [
    { ...sourceProbes[0], selector: "header .navbar" },
    {
      ...sourceProbes[1],
      selector: mobile ? ".navbar-brand .mobile-logo" : ".navbar-brand .default-logo",
    },
    { ...sourceProbes[2], selector: ".swiper.full-screen" },
    { ...sourceProbes[3], selector: ".shop-modern .grid-item .shop-image" },
  ] as const;
  const [reference, implementation] = await Promise.all([
    captureSourceContract(source, sourceProbes),
    captureSourceContract(page, implementationProbes),
  ]);
  expect(
    compareSourceContractSnapshots(normalizeRegions(reference), normalizeRegions(implementation), {
      fullPageHeightRatio: 1,
    }),
  ).toEqual([]);

  await page.locator('[data-fashion-2-slide="0"]').dispatchEvent("click");
  expect(await page.locator(".fashion-2-hero-slide[data-active=true]").innerText()).toContain(
    "Women's\ncollection",
  );
  expect(await page.locator(".shop-footer").innerText()).toContain("Textured sweater");
  await page.locator('[data-fashion-2-slide="0"]').dispatchEvent("click");
  await regionalPixelGate(
    source,
    page,
    ".swiper.full-screen",
    ".swiper.full-screen",
    `${testInfo.project.name}-hero`,
    testInfo,
    0.04,
  );
  await page.locator('[data-fashion-2-slide="0"]').dispatchEvent("click");
  await regionalPixelGate(
    source,
    page,
    "section:nth-of-type(4) .shop-modern .grid-item:nth-child(2) .shop-image",
    ".shop-modern .grid-item .shop-image",
    `${testInfo.project.name}-product`,
    testInfo,
  );
  await source.close();
});

test("runtime and typed preview action remain clean and Nuxt-owned", async ({ page }) => {
  const requests: { method: string; url: string }[] = [];
  const errors: string[] = [];
  page.on("request", (request) => requests.push({ method: request.method(), url: request.url() }));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page, "/");
  const cookiesBefore = await page.context().cookies();
  const originalURL = page.url();
  const action = page.getByRole("button", { name: "Add to cart" });
  await page.locator(".shop-image").hover();
  await action.click();
  await expect(page.getByRole("status")).toHaveText("Textured sweater added to preview cart.");
  await expect(page.locator("[data-fashion-2-source-parity]")).toHaveAttribute(
    "data-preview-intent-count",
    "1",
  );
  expect(page.url()).toBe(originalURL);
  expect(await page.context().cookies()).toEqual(cookiesBefore);
  expect(requests.filter(({ method }) => method !== "GET")).toEqual([]);
  expect(requests.filter(({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);
  expect(requests.filter(({ url }) => /\.php|instagram.*ajax/i.test(url))).toEqual([]);

  const initialMotion = await captureMotionContract(page, ".swiper", "initial");
  expect(initialMotion).toMatchObject({
    activeIndex: 0,
    checkpoint: "initial",
    direction: page.viewportSize()!.width >= 1199 ? "vertical" : "horizontal",
    timing: { autoplayDelayMs: 4000, delayMs: 0, durationMs: 1000 },
  });
  expect(initialMotion.layers).toHaveLength(3);
  await page.goto("/cart");
  await expect(page.locator("[data-fashion-2-source-parity]")).toHaveCount(0);
  await page.goBack({ waitUntil: "networkidle" });
  await expect(page.locator("[data-fashion-2-source-parity]")).toHaveCount(1);
  await expect(page.locator(".swiper")).toHaveAttribute("data-motion-ready", "true");
  expect(await page.locator(".fashion-2-hero-slide").count()).toBe(3);
  expect(await page.locator("[data-motion-layer]").count()).toBe(3);
  expect(await page.locator("body").getAttribute("class")).toBeNull();
  expect(errors).toEqual([]);
});

test("approved local fonts and glyph family are active", async ({ browser, page }) => {
  const source = await browser.newPage({ viewport: page.viewportSize()! });
  await Promise.all([ready(source, sourceURL), ready(page, "/")]);
  const probes = [
    { id: "hero", selector: ".swiper-slide-active .fs-120" },
    { atomic: true, id: "product", selector: ".shop-footer .fs-19" },
  ] as const;
  const implementationProbes = [
    { ...probes[0], selector: ".fashion-2-hero-slide[data-active=true] .fs-120" },
    { ...probes[1], selector: ".shop-footer .fs-19" },
  ] as const;
  const [reference, implementation] = await Promise.all([
    captureFontContract(source, probes),
    captureFontContract(page, implementationProbes),
  ]);
  expect(compareFontContractSnapshots(reference, implementation)).toEqual([]);
  expect(await page.evaluate(() => document.fonts.check("600 120px Outfit", "Women's"))).toBe(true);
  expect(
    await page.locator(".add-to-cart .feather").evaluate((element) => {
      const style = getComputedStyle(element, "::before");
      const glyph = style.content.replaceAll('"', "");
      return { codePoint: glyph.codePointAt(0), family: style.fontFamily };
    }),
  ).toEqual({ codePoint: 0xe926, family: "feather" });
  await source.close();
});
