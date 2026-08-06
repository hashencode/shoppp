import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  assertThemeScreenshotDifference,
  compareThemeScreenshots,
} from "../scripts/compare-theme-screenshots";
import { captureFontContract, compareFontContractSnapshots } from "./support/theme-font-contract";
import { captureThemeEvidence } from "./support/theme-fidelity";
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

async function ready(page: Page, url: string, reducedMotion = true): Promise<void> {
  await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference" });
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
  await expect(page.locator(".swiper.full-screen")).toHaveAttribute("data-motion-ready", "true");

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
    {
      ...sourceProbes[3],
      selector: "section:nth-of-type(4) .shop-modern .grid-item:nth-child(2) .shop-image",
    },
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
  expect(await page.locator("section:nth-of-type(4) .shop-footer").first().innerText()).toContain(
    "Textured sweater",
  );
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
    "section:nth-of-type(4) .shop-modern .grid-item:nth-child(2) .shop-image",
    `${testInfo.project.name}-product`,
    testInfo,
  );
  await source.close();
});

test("complete source home renders every static region and local image", async ({ page }) => {
  await ready(page, "/");

  await expect(page.locator("html")).toHaveAttribute("class", "js");
  await expect(page.locator("body")).toHaveAttribute("data-mobile-nav-style", "classic");
  await expect(page.locator("body > div#__nuxt section")).toHaveCount(10);
  await expect(page.locator("section:nth-of-type(2) .feature-box")).toHaveCount(4);
  await expect(page.locator("section:nth-of-type(3) .categories-style-02")).toHaveCount(4);
  await expect(page.locator("section:nth-of-type(4) .grid-item")).toHaveCount(10);
  await expect(page.locator("section:nth-of-type(6) .swiper-slide")).toHaveCount(8);
  await expect(page.locator("section:nth-of-type(7) img")).toHaveCount(5);
  await expect(page.locator("section:nth-of-type(8) .grid-item")).toHaveCount(5);
  await expect(page.locator("section:nth-of-type(9) .swiper-slide")).toHaveCount(8);
  await expect(page.locator("section:nth-of-type(10) .grid-item")).toHaveCount(4);
  await expect(page.locator("footer.footer-dark")).toHaveCount(1);
  await expect(page.locator(".sticky-wrap")).toHaveCount(1);
  await expect(page.locator(".scroll-progress")).toHaveCount(1);

  const unloadedImages = await page
    .locator("img")
    .evaluateAll((images) =>
      images
        .filter(
          (image) =>
            !(image as HTMLImageElement).complete || !(image as HTMLImageElement).naturalWidth,
        )
        .map((image) => (image as HTMLImageElement).currentSrc),
    );
  expect(unloadedImages).toEqual([]);
  const externalResources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map(({ name }) => name)
      .filter((name) => !name.startsWith("data:") && new URL(name).origin !== location.origin),
  );
  expect(externalResources).toEqual([]);

  const viewportWidth = page.viewportSize()!.width;
  const expectedColumns =
    viewportWidth >= 1200 ? 5 : viewportWidth >= 992 ? 4 : viewportWidth >= 768 ? 3 : 1;
  const firstRowTops = await page
    .locator("section:nth-of-type(4) .grid-item")
    .evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
  expect(firstRowTops.filter((top) => top === firstRowTops[0])).toHaveLength(expectedColumns);
});

test("Fashion 2 home has no serious accessibility violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-2-desktop");
  await ready(page, "/");
  await page.evaluate(async () => {
    for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight * 0.75) {
      scrollTo(0, top);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
    }
    scrollTo(0, 0);
  });

  const structure = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .disableRules(["color-contrast"])
    .analyze();
  expect(
    structure.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
  ).toEqual([]);

  const contrast = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    // These selectors retain the source package's audited low-contrast presentation.
    .exclude(".feature-box-content p")
    .exclude(".shop-footer .price")
    .exclude(".lable")
    .exclude(".xs-pe-15px")
    .exclude(".fs-180")
    .exclude(".blog-wrapper .mb-5px")
    .exclude("footer ul a")
    .exclude("footer a[href^='tel:'], footer a[href^='mailto:']")
    .exclude("footer .col-md-6 > .mb-15px")
    .exclude("footer .input-small")
    .exclude("footer .col-lg-7 > p")
    .exclude("footer .col-lg-5 > span")
    .analyze();
  expect(contrast.violations).toEqual([]);
});

test("visual capabilities initialize once and leave no runtime residue", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-2-desktop");
  await ready(page, "/", false);
  const marker = page.locator("[data-fashion-2-source-parity]");
  await expect(marker).toHaveAttribute("data-runtime-status", "ready");
  await expect(page.locator("[data-fashion2-runtime-script]")).toHaveCount(2);
  await expect(page.locator(".grid-loading")).toHaveCount(0);
  await expect(page.locator(".swiper.slider-three-slide")).toHaveClass(/swiper-initialized/);
  expect(
    await page.evaluate(() => ({ jquery: "jQuery" in window, swiper: "Swiper" in window })),
  ).toEqual({ jquery: true, swiper: true });

  await page.goto("/cart");
  await expect(page.locator("[data-fashion2-runtime-script]")).toHaveCount(0);
  expect(await page.locator("body").getAttribute("data-fashion2-visual-runtime")).toBeNull();
  expect(
    await page.evaluate(() => ({ jquery: "jQuery" in window, swiper: "Swiper" in window })),
  ).toEqual({ jquery: false, swiper: false });

  await page.goBack({ waitUntil: "networkidle" });
  await expect(marker).toHaveAttribute("data-runtime-status", "ready");
  await expect(page.locator("[data-fashion2-runtime-script]")).toHaveCount(2);
  await expect(marker).toHaveAttribute("data-runtime-instance-count", "1");
});

test("runtime load failure exposes stable static content", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-2-desktop");
  await page.route(/jquery(?:\.[^/]+)?\.js(?:\?.*)?$/, (route) => route.abort());
  await ready(page, "/", false);
  await expect(page.locator("[data-fashion-2-source-parity]")).toHaveAttribute(
    "data-runtime-status",
    "fallback",
  );
  await expect(page.getByRole("alert")).toContainText("Visual enhancements are unavailable");
  await expect(page.locator("[data-fashion2-runtime-script]")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({ jquery: "jQuery" in window, swiper: "Swiper" in window })),
  ).toEqual({ jquery: false, swiper: false });
  await expect(page.locator(".grid-loading")).toHaveCount(0);
  await expect(page.locator("section:nth-of-type(10)")).toBeVisible();
});

test("partial runtime load failure removes earlier scripts and globals", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-2-desktop");
  await page.route(/vendors\.min\.js(?:\?.*)?$/, (route) => route.abort());
  await ready(page, "/", false);
  await expect(page.locator("[data-fashion-2-source-parity]")).toHaveAttribute(
    "data-runtime-status",
    "fallback",
  );
  await expect(page.locator("[data-fashion2-runtime-script]")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({ jquery: "jQuery" in window, swiper: "Swiper" in window })),
  ).toEqual({ jquery: false, swiper: false });
  await expect(page.locator("section:nth-of-type(10)")).toBeVisible();
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
  const action = page.locator("button.add-to-cart").first();
  await page.locator("section:nth-of-type(4) .shop-image").first().hover({ force: true });
  await expect(action).toHaveAttribute("aria-label", "Add to cart");
  await action.dispatchEvent("click");
  await expect(page.getByRole("status")).toHaveText("Product added to the preview cart.");
  await expect(page.locator("[data-fashion-2-source-parity]")).toHaveAttribute(
    "data-preview-intent-count",
    "1",
  );
  expect(page.url()).toBe(originalURL);
  expect(await page.context().cookies()).toEqual(cookiesBefore);
  expect(requests.filter(({ method }) => method !== "GET")).toEqual([]);
  expect(requests.filter(({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);
  expect(requests.filter(({ url }) => /\.php|instagram.*ajax/i.test(url))).toEqual([]);

  const initialMotion = await captureMotionContract(page, ".swiper.full-screen", "initial");
  expect(initialMotion).toMatchObject({
    activeIndex: 0,
    checkpoint: "initial",
    direction: page.viewportSize()!.width >= 1199 ? "vertical" : "horizontal",
    timing: { autoplayDelayMs: 4000, delayMs: 0, durationMs: 1000 },
  });
  expect(initialMotion.layers).toHaveLength(3);
  await page.goto("/cart");
  await expect(page.locator("[data-fashion-2-source-parity]")).toHaveCount(0);
  expect(await page.locator("body").getAttribute("class")).toBeNull();
  await page.goBack({ waitUntil: "networkidle" });
  await expect(page.locator("[data-fashion-2-source-parity]")).toHaveCount(1);
  await expect(page.locator(".swiper.full-screen")).toHaveAttribute("data-motion-ready", "true");
  expect(await page.locator(".fashion-2-hero-slide").count()).toBe(3);
  expect(await page.locator("[data-motion-layer]").count()).toBe(3);
  expect(await page.locator("body").getAttribute("class")).toBe("fashion-2-home");
  expect(errors).toEqual([]);
});

test("internal navigation and product actions stay Nuxt-owned", async ({ page }) => {
  await ready(page, "/");
  const marker = page.locator("[data-fashion-2-source-parity]");
  const card = page.locator("section:nth-of-type(4) .shop-image").first();
  await card.hover({ force: true });

  const wishlist = card.getByRole("button", { name: "Add to wishlist" });
  await wishlist.focus();
  expect(await wishlist.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    "none",
  );
  await page.keyboard.press("Enter");
  await expect(marker).toHaveAttribute("data-preview-intent-count", "1");
  await expect(page.getByRole("status")).toHaveText("Product wishlist preview updated.");

  const quickView = card.getByRole("button", { name: "Quick shop" });
  await quickView.focus();
  await page.keyboard.press("Space");
  await expect(marker).toHaveAttribute("data-preview-intent-count", "2");
  await expect(page.getByRole("status")).toHaveText("Product quick view preview requested.");

  const navigationEntries = await page.evaluate(
    () => performance.getEntriesByType("navigation").length,
  );
  await page.locator('a[href="/cart"][data-fashion-2-route]').dispatchEvent("click");
  await expect(page).toHaveURL(/\/cart$/);
  expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(
    navigationEntries,
  );
});

test("mobile menu closes through Nuxt handling and restores toggle focus", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-2-mobile");
  await ready(page, "/");
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#navbarNav")).toHaveClass(/show/);
  expect(
    await page.locator("body").evaluate((element) => getComputedStyle(element).overflowY),
  ).not.toBe("hidden");

  const home = page.locator("#navbarNav .nav-link", { hasText: "Home" });
  await home.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#navbarNav")).not.toHaveClass(/show/);
  await expect(toggle).toBeFocused();
  await expect(page.locator(".modal-backdrop, .offcanvas-backdrop")).toHaveCount(0);
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
    { ...probes[1], selector: "section:nth-of-type(4) .shop-footer .fs-19" },
  ] as const;
  const [reference, implementation] = await Promise.all([
    captureFontContract(source, probes),
    captureFontContract(page, implementationProbes),
  ]);
  expect(compareFontContractSnapshots(reference, implementation)).toEqual([]);
  expect(await page.evaluate(() => document.fonts.check("600 120px Outfit", "Women's"))).toBe(true);
  expect(
    await page
      .locator(".add-to-cart .feather")
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element, "::before");
        const glyph = style.content.replaceAll('"', "");
        return { codePoint: glyph.codePointAt(0), family: style.fontFamily };
      }),
  ).toEqual({ codePoint: 0xe926, family: "feather" });
  await source.close();
});

test("captures the four-viewport Fashion 2 initial-home evidence", async ({ page }, testInfo) => {
  test.skip(!process.env.THEME_FIDELITY_CAPTURE_ROOT);
  await ready(page, "/");
  await captureThemeEvidence(page, testInfo, "fashion-2");
});
