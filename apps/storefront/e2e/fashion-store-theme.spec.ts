import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { fashionStorePageContracts } from "../app/themes/fashion-store/page-contracts";
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
import { probeNativeCursorVisibility } from "./support/theme-behavior-probes";
import { recordThemeBehaviorEvidence } from "./support/theme-behavior-evidence";

const sourceURL = `http://127.0.0.1:${Number(process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427)}/demo-fashion-store.html`;
const fontData = (name: "figtree" | "outfit") =>
  readFileSync(
    new URL(`../app/themes/fashion-store/upstream/fonts/${name}-latin.woff2`, import.meta.url),
  ).toString("base64");
const deterministicCss = `
  @font-face { font-family: "FashionStoreCaptureOutfit"; font-style: normal; font-weight: 300 900;
    src: url("data:font/woff2;base64,${fontData("outfit")}") format("woff2"); }
  @font-face { font-family: "FashionStoreCaptureFigtree"; font-style: normal; font-weight: 300 800;
    src: url("data:font/woff2;base64,${fontData("figtree")}") format("woff2"); }
  :root { --alt-font: "FashionStoreCaptureOutfit", sans-serif !important;
    --primary-font: "FashionStoreCaptureFigtree", sans-serif !important; }
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
    await page.locator('[data-fashion-store-slide="0"]').dispatchEvent("click");
  } else {
    await page.evaluate(() => {
      const element = document.querySelector(".swiper.full-screen") as HTMLElement;
      const swiper = (
        element as HTMLElement & {
          swiper?: {
            autoplay?: { stop(): void };
            slideToLoop(index: number, speed: number): void;
          };
        }
      ).swiper;
      swiper?.autoplay?.stop();
      swiper?.slideToLoop(0, 0);
      const headerHeight = [".header-top-bar", "header nav.navbar"].reduce(
        (height, selector) =>
          height + (document.querySelector(selector)?.getBoundingClientRect().height ?? 0),
        0,
      );
      const targetHeight =
        innerWidth >= 992 ? innerHeight - headerHeight : innerWidth >= 576 ? 600 : 500;
      element.style.setProperty("height", `${targetHeight}px`, "important");
      element.querySelectorAll<HTMLElement>(".swiper-slide").forEach((slide) => {
        slide.style.setProperty("height", `${targetHeight}px`, "important");
      });
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
  await expect(page.locator("[data-fashion-store-source-parity]")).toHaveCount(1);
  await expect(page.locator("[data-fashion-store-source-parity]")).toHaveAttribute(
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

  await page.locator('[data-fashion-store-slide="0"]').dispatchEvent("click");
  expect(await page.locator(".fashion-store-hero-slide[data-active=true]").innerText()).toContain(
    "Women's\ncollection",
  );
  expect(await page.locator("section:nth-of-type(4) .shop-footer").first().innerText()).toContain(
    "Textured sweater",
  );
  await page.locator('[data-fashion-store-slide="0"]').dispatchEvent("click");
  await regionalPixelGate(
    source,
    page,
    ".swiper.full-screen",
    ".swiper.full-screen",
    `${testInfo.project.name}-hero`,
    testInfo,
    0.04,
  );
  await page.locator('[data-fashion-store-slide="0"]').dispatchEvent("click");
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

test("complete source home renders every static region and local image", async ({
  page,
}, testInfo) => {
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
  recordThemeBehaviorEvidence(
    testInfo,
    { actionOutcome: true, behaviorId: "hero-carousel", mode: "static" },
    { actionOutcome: true, behaviorId: "product-card-actions", mode: "static" },
    {
      actionOutcome: true,
      behaviorId: "new-arrival-collection-carousel",
      mode: "static",
    },
    {
      actionOutcome: true,
      behaviorId: "desktop-social-rail",
      mode: "static",
    },
  );
});

test("Fashion Store home has no serious accessibility violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop");
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

test("reduced motion defers home hydration without deferring readable content", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "networkidle" });

  const marker = page.locator("[data-fashion-store-source-parity]");
  await expect(marker).not.toHaveAttribute("data-storefront-hydration", "eager");
  await expect(marker).toHaveAttribute("data-runtime-status", "loading");
  await expect(page.locator("section:nth-of-type(4) .shop-footer").first()).toContainText(
    "Textured sweater",
  );

  const searchTrigger = page.getByRole("link", { name: "Search" });
  await searchTrigger.click();
  await expect(marker).toHaveAttribute("data-runtime-status", "static");
  await expect(page.locator("html")).toHaveAttribute("class", "js");
  await expect(page.locator(".search-form-wrapper")).toBeVisible();
});

test("visual capabilities initialize once and leave no runtime residue", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop");
  await ready(page, "/", false);
  const marker = page.locator("[data-fashion-store-source-parity]");
  await expect(marker).toHaveAttribute("data-runtime-status", "ready");
  await expect(page.locator("[data-fashion-store-runtime-script]")).toHaveCount(2);
  await expect(page.locator(".grid-loading")).toHaveCount(0);
  await expect(page.locator("[data-fashion-store-collection-carousel]")).toHaveAttribute(
    "data-collection-index",
    "0",
  );
  expect(
    await page.evaluate(() => ({ jquery: "jQuery" in window, swiper: "Swiper" in window })),
  ).toEqual({ jquery: true, swiper: true });

  await page.goto("/checkout/complete");
  await expect(page.locator("[data-fashion-store-runtime-script]")).toHaveCount(0);
  expect(await page.locator("body").getAttribute("data-fashion-store-visual-runtime")).toBeNull();
  expect(
    await page.evaluate(() => ({ jquery: "jQuery" in window, swiper: "Swiper" in window })),
  ).toEqual({ jquery: false, swiper: false });

  await page.goBack({ waitUntil: "networkidle" });
  await expect(marker).toHaveAttribute("data-runtime-status", "ready");
  await expect(page.locator("[data-fashion-store-runtime-script]")).toHaveCount(2);
  await expect(marker).toHaveAttribute("data-runtime-instance-count", "1");
});

test("collection carousel and edge rails remain interactive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(async () => document.fonts.ready);

  const hero = page.locator(".swiper.full-screen");
  const heroBefore = Number(await hero.getAttribute("data-motion-active-index"));

  const carousel = page.locator("[data-fashion-store-collection-carousel]");
  const collectionBefore = await carousel.getAttribute("data-collection-index");
  await expect
    .poll(() => carousel.getAttribute("data-collection-index"), { timeout: 5_500 })
    .not.toBe(collectionBefore);
  await expect
    .poll(() => hero.getAttribute("data-motion-active-index"), { timeout: 5_500 })
    .not.toBe(String(heroBefore));
  await expect(hero).toHaveAttribute("data-motion-phase", "idle");
  const heroAfter = Number(await hero.getAttribute("data-motion-active-index"));
  await expect(hero.locator('.fashion-store-hero-slide[data-active="true"]')).toHaveCount(1);
  const interactionTarget = (heroAfter + 1) % 3;
  await hero.focus();
  await page.keyboard.press("ArrowRight");
  await expect(hero).toHaveAttribute("data-motion-active-index", String(interactionTarget));

  const socialRail = page.locator(".sticky-wrap");
  await expect(socialRail).toBeVisible();
  await expect(socialRail).toHaveClass(/shadow-in/);

  await page.evaluate(() => scrollTo(0, 1_000));
  const scrollProgress = page.locator(".scroll-progress");
  await expect(scrollProgress).toHaveClass(/visible/);
  await expect
    .poll(() => scrollProgress.locator(".scroll-point").evaluate((node) => node.clientHeight))
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: "Back to top" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const footerScroll = await page.evaluate(() => scrollY);
  await expect(page.locator("footer.footer-dark")).toBeVisible();
  recordThemeBehaviorEvidence(
    testInfo,
    {
      behaviorId: "hero-carousel",
      mode: "temporal",
      temporalSamples: {
        after: heroAfter,
        before: heroBefore,
        elapsedMs: 5_500,
      },
    },
    { actionOutcome: true, behaviorId: "hero-carousel", mode: "interaction" },
    { actionOutcome: true, behaviorId: "desktop-social-rail", mode: "static" },
    {
      behaviorId: "desktop-social-rail",
      branches: [{ id: "desktop-visible", outcome: true, viewportId: "desktop" }],
      mode: "scroll-fixed",
      scrollSamples: [0, 1_000],
    },
    {
      behaviorId: "footer-sticky-reveal",
      mode: "scroll-fixed",
      scrollSamples: [0, footerScroll],
    },
  );
});

test("collection loop ignores extra advance input until its clone reset completes", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop");
  await ready(page, "/");
  const carousel = page.locator("[data-fashion-store-collection-carousel]");
  await carousel.focus();
  for (let index = 0; index < 4; index += 1) await page.keyboard.press("ArrowRight");
  await expect(carousel).toHaveAttribute("data-collection-index", "4");
  await page.keyboard.press("ArrowRight");
  await expect(carousel).toHaveAttribute("data-collection-index", "4");
  await expect(carousel).toHaveAttribute("data-collection-index", "0", { timeout: 1_200 });
});

test("hero retains the approved native cursor adaptation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop");
  await ready(page, "/", false);
  const result = await probeNativeCursorVisibility(page, ".swiper.full-screen");
  expect(result.visible).toBe(true);
  expect(result.cursor).not.toBe("none");
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "hero-native-cursor",
    mode: "interaction",
  });
});

test("runtime load failure exposes stable static content", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop");
  await page.route(/jquery(?:\.[^/]+)?\.js(?:\?.*)?$/, (route) => route.abort());
  await ready(page, "/", false);
  await expect(page.locator("[data-fashion-store-source-parity]")).toHaveAttribute(
    "data-runtime-status",
    "fallback",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator("[data-fashion-store-source-parity]")).toHaveAttribute(
    "data-runtime-error",
    /.+/,
  );
  await expect(page.locator("[data-fashion-store-runtime-script]")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({ jquery: "jQuery" in window, swiper: "Swiper" in window })),
  ).toEqual({ jquery: false, swiper: false });
  await expect(page.locator(".grid-loading")).toHaveCount(0);
  await expect(page.locator("section:nth-of-type(10)")).toBeVisible();
  const evidence: Parameters<typeof recordThemeBehaviorEvidence>[1][] = [];

  const shopLink = page.locator(".navbar-left .nav-item.dropdown .nav-link").first();
  await expect(shopLink).toBeVisible();
  await shopLink.focus();
  await expect(shopLink).toBeFocused();
  await expect(
    page.locator(".navbar-left .nav-item.dropdown .dropdown-menu a").first(),
  ).toBeAttached();
  evidence.push({ actionOutcome: true, behaviorId: "header-shop-navigation", mode: "fallback" });

  const searchTrigger = page.getByRole("link", { name: "Search" });
  await searchTrigger.click();
  await expect(page.locator(".search-form-wrapper")).toBeVisible();
  await expect(page.getByPlaceholder("Enter your keywords...")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(searchTrigger).toBeFocused();
  evidence.push({ actionOutcome: true, behaviorId: "header-search-overlay", mode: "fallback" });

  const cart = page.locator(".header-cart");
  const cartTrigger = cart.getByRole("button", { name: "Open preview cart" });
  await cartTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(cart.locator(".cart-item-list")).toBeVisible();
  await expect(cart.locator(".cart-item-list")).toContainText("Ribbed tank");
  await page.keyboard.press("Enter");
  evidence.push({ actionOutcome: true, behaviorId: "header-cart-preview", mode: "fallback" });

  const hero = page.locator(".swiper.full-screen");
  const activeHero = hero.locator('.fashion-store-hero-slide[data-active="true"]');
  await expect(activeHero).toContainText("collection");
  await expect(activeHero.getByRole("link", { name: "View collection" })).toBeVisible();
  evidence.push({ actionOutcome: true, behaviorId: "hero-carousel", mode: "fallback" });
  expect(await hero.evaluate((element) => getComputedStyle(element).cursor)).not.toBe("none");
  evidence.push({ actionOutcome: true, behaviorId: "hero-native-cursor", mode: "fallback" });

  const productCard = page.locator(".shop-modern .shop-image").first();
  await productCard.hover();
  const productAction = productCard.getByRole("button", { name: "Add to wishlist" });
  await productAction.focus();
  await expect(productAction).toBeFocused();
  expect(
    await productAction.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).not.toBe("none");
  evidence.push({ actionOutcome: true, behaviorId: "product-card-actions", mode: "fallback" });

  const collectionLayout = await page
    .locator("[data-fashion-store-collection-carousel]")
    .evaluate((element) => {
      const root = element.getBoundingClientRect();
      const cards = [...element.querySelectorAll<HTMLElement>(".swiper-slide")].slice(0, 4);
      return {
        cardWidthRatio: cards[0]!.getBoundingClientRect().width / root.width,
        visibleCards: cards.filter((card) => {
          const rect = card.getBoundingClientRect();
          return rect.right > root.left && rect.left < root.right;
        }).length,
      };
    });
  expect(collectionLayout.visibleCards).toBeGreaterThanOrEqual(3);
  expect(collectionLayout.cardWidthRatio).toBeLessThanOrEqual(0.35);
  evidence.push({
    actionOutcome: true,
    behaviorId: "new-arrival-collection-carousel",
    mode: "fallback",
  });

  const marquee = page.locator("section:nth-of-type(9)");
  await expect(marquee).toContainText("Get 20% off for your first order");
  await expect(marquee).toContainText("The fashion core collection");
  expect(
    await marquee
      .locator(".swiper-wrapper")
      .evaluate((element) => getComputedStyle(element).animationDuration),
  ).toBe("0s");
  evidence.push({ actionOutcome: true, behaviorId: "promotional-marquee", mode: "fallback" });

  await expect(page.locator(".sticky-wrap a")).toHaveCount(4);
  evidence.push({ actionOutcome: true, behaviorId: "desktop-social-rail", mode: "fallback" });

  await page.evaluate(() => scrollTo(0, 600));
  const fallbackScroll = await page.evaluate(() => scrollY);
  expect(fallbackScroll).toBeGreaterThan(0);
  evidence.push({
    actionOutcome: true,
    behaviorId: "scroll-progress-indicator",
    mode: "fallback",
  });
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  evidence.push({ actionOutcome: true, behaviorId: "back-to-top-control", mode: "fallback" });

  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator("footer.footer-dark")).toBeVisible();
  evidence.push({ actionOutcome: true, behaviorId: "footer-sticky-reveal", mode: "fallback" });

  recordThemeBehaviorEvidence(testInfo, ...evidence);
});

test("partial runtime load failure removes earlier scripts and globals", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop");
  await page.route(/vendors\.min(?:\.[^/]+)?\.js(?:\?.*)?$/, (route) => route.abort());
  await ready(page, "/", false);
  await expect(page.locator("[data-fashion-store-source-parity]")).toHaveAttribute(
    "data-runtime-status",
    "fallback",
  );
  await expect(page.locator("[data-fashion-store-runtime-script]")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({ jquery: "jQuery" in window, swiper: "Swiper" in window })),
  ).toEqual({ jquery: false, swiper: false });
  await expect(page.locator("section:nth-of-type(10)")).toBeVisible();
});

test("runtime and typed preview action remain clean and Nuxt-owned", async ({ page }, testInfo) => {
  const requests: { method: string; url: string }[] = [];
  const errors: string[] = [];
  page.on("request", (request) => requests.push({ method: request.method(), url: request.url() }));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/cart", (route) =>
    route.fulfill({
      contentType: "application/json",
      json: {
        data: {
          adjustments: [],
          canCheckout: false,
          currency: "USD",
          expiresAt: "2026-08-08T00:00:00.000Z",
          id: "cart_01J00000000000000000000000",
          lines: [],
          selectedShippingMethodId: null,
          shippingAddress: null,
          shippingMethods: [],
          totals: {
            discountTotal: 0,
            grandTotal: 0,
            shippingTotal: 0,
            subtotal: 0,
            taxTotal: 0,
          },
        },
      },
    }),
  );
  await ready(page, "/");
  const cookiesBefore = await page.context().cookies();
  const originalURL = page.url();
  const action = page.locator("button.add-to-cart").first();
  await page.locator("section:nth-of-type(4) .shop-image").first().hover({ force: true });
  await expect(action).toHaveAttribute("aria-label", "Add to cart");
  await action.dispatchEvent("click");
  await expect(page.locator(".fashion-store-action-feedback")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator("[data-fashion-store-source-parity]")).toHaveAttribute(
    "data-preview-intent-count",
    "1",
  );
  expect(page.url()).toBe(originalURL);
  expect(await page.context().cookies()).toEqual(cookiesBefore);
  expect(requests.filter(({ method }) => method !== "GET")).toEqual([]);
  expect(requests.filter(({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);
  expect(requests.filter(({ url }) => /\.php|instagram.*ajax/i.test(url))).toEqual([]);

  if (page.viewportSize()!.width >= 992) {
    const shopMenu = page.locator(".navbar-left .nav-item.dropdown").first();
    await shopMenu.hover();
    await expect(shopMenu).toHaveClass(/\bopen\b/);
    await page.mouse.move(0, page.viewportSize()!.height - 1);
    await expect(shopMenu).not.toHaveClass(/\bopen\b/);
    recordThemeBehaviorEvidence(testInfo, {
      actionOutcome: true,
      behaviorId: "header-shop-navigation",
      branches: [{ id: "desktop-hover", outcome: true, viewportId: "desktop" }],
      mode: "interaction",
    });
  }

  const initialMotion = await captureMotionContract(page, ".swiper.full-screen", "initial");
  expect(initialMotion).toMatchObject({
    activeIndex: 0,
    checkpoint: "initial",
    direction: page.viewportSize()!.width >= 1199 ? "vertical" : "horizontal",
    timing: { autoplayDelayMs: 4000, delayMs: 0, durationMs: 1000 },
  });
  expect(initialMotion.layers).toHaveLength(3);
  await page
    .locator('.header-cart a[href="/cart"][data-fashion-store-route]')
    .dispatchEvent("click");
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.locator("[data-fashion-store-source-parity]")).toHaveCount(1);
  expect((await page.locator("body").getAttribute("class")) ?? "").toBe("");
  await page.goBack({ waitUntil: "networkidle" });
  await expect(page.locator("[data-fashion-store-source-parity]")).toHaveCount(1);
  await expect(page.locator(".swiper.full-screen")).toHaveAttribute("data-motion-ready", "true");
  expect(await page.locator(".fashion-store-hero-slide").count()).toBe(3);
  expect(await page.locator("[data-motion-layer]").count()).toBe(3);
  expect(await page.locator("body").getAttribute("class")).toBe("fashion-store-home");
  expect(errors).toEqual([]);
});

test("internal navigation and product actions stay Nuxt-owned", async ({ page }, testInfo) => {
  await ready(page, "/");
  const marker = page.locator("[data-fashion-store-source-parity]");
  const card = page.locator("section:nth-of-type(4) .shop-image").first();
  await card.hover({ force: true });

  const wishlist = card.getByRole("button", { name: "Add to wishlist" });
  await wishlist.focus();
  expect(await wishlist.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    "none",
  );
  await page.keyboard.press("Enter");
  await expect(marker).toHaveAttribute("data-preview-intent-count", "1");
  await expect(page.locator(".fashion-store-action-feedback")).toHaveCount(0);

  const quickView = card.getByRole("button", { name: "Quick shop" });
  await quickView.focus();
  await page.keyboard.press("Space");
  await expect(marker).toHaveAttribute("data-preview-intent-count", "2");

  const navigationEntries = await page.evaluate(
    () => performance.getEntriesByType("navigation").length,
  );
  await page
    .locator('.header-cart a[href="/cart"][data-fashion-store-route]')
    .dispatchEvent("click");
  await expect(page).toHaveURL(/\/cart$/);
  expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(
    navigationEntries,
  );
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "product-card-actions",
    mode: "interaction",
  });
});

test("header search and preview cart reproduce the source interactions", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop");
  await ready(page, "/");

  const searchTrigger = page.getByRole("link", { name: "Search" });
  const searchOverlay = page.locator(".search-form-wrapper");
  await searchTrigger.click();
  await expect(page.locator("body")).toHaveClass(/show-search-popup/);
  await expect(searchTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(searchOverlay).toBeVisible();
  await expect(page.getByPlaceholder("Enter your keywords...")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/show-search-popup/);
  await expect(searchOverlay).toBeHidden();
  await expect(searchTrigger).toBeFocused();

  const cart = page.locator(".header-cart");
  await cart.hover();
  await expect(cart).toHaveClass(/open/);
  await expect(cart.locator(".cart-item-list")).toBeVisible();
  await expect(cart.locator(".cart-item-list")).toContainText("Ribbed tank");
  await expect(cart.locator(".cart-item-list")).toContainText("Pleated dress");
  await page.mouse.move(0, page.viewportSize()!.height - 1);
  await expect(cart).not.toHaveClass(/open/);
  await expect(cart.locator(".cart-item-list")).toBeHidden();
});

test("mobile menu closes through Nuxt handling and restores toggle focus", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-mobile");
  await ready(page, "/");
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#navbarNav")).toHaveClass(/show/);
  expect(
    await page.locator("body").evaluate((element) => getComputedStyle(element).overflowY),
  ).not.toBe("hidden");

  const shop = page.locator(".navbar-left .nav-item.dropdown").first();
  await shop.locator(".dropdown-toggle").click();
  await expect(shop.locator(".dropdown-toggle")).toHaveClass(/\bshow\b/);
  await expect(shop.locator(".dropdown-menu")).toBeVisible();

  const home = page.locator("#navbarNav .nav-link", { hasText: "Home" });
  await home.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#navbarNav")).not.toHaveClass(/show/);
  await expect(toggle).toBeFocused();
  await expect(page.locator(".modal-backdrop, .offcanvas-backdrop")).toHaveCount(0);

  const cart = page.locator(".header-cart");
  const cartTrigger = cart.getByRole("button", { name: "Open preview cart" });
  await cartTrigger.tap();
  await expect(cartTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(cart.locator(".cart-item-list")).toBeVisible();
  await cartTrigger.tap();
  await expect(cart.locator(".cart-item-list")).toBeHidden();
  recordThemeBehaviorEvidence(
    testInfo,
    {
      actionOutcome: true,
      behaviorId: "header-shop-navigation",
      branches: [{ id: "mobile-click", outcome: true, viewportId: "mobile" }],
      mode: "interaction",
    },
    {
      actionOutcome: true,
      behaviorId: "header-cart-preview",
      branches: [{ id: "compact-trigger", outcome: true, viewportId: "mobile" }],
      mode: "interaction",
    },
  );
});

test("compact scroll-progress branch stays hidden while native scrolling remains usable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "fashion-store-desktop");
  await ready(page, "/");
  const progress = page.locator(".scroll-progress");
  await expect(progress).toBeHidden();
  const socialRail = page.locator(".sticky-wrap");
  await expect(socialRail).toHaveClass(/d-none.*d-xl-inline-block/);
  await expect(socialRail).toBeHidden();
  await page.evaluate(() => scrollTo(0, 500));
  const scrollPosition = await page.evaluate(() => scrollY);
  expect(scrollPosition).toBeGreaterThan(0);
  recordThemeBehaviorEvidence(
    testInfo,
    {
      behaviorId: "scroll-progress-indicator",
      branches: [{ id: "compact-hidden", outcome: true, viewportId: "mobile" }],
      mode: "scroll-fixed",
      scrollSamples: [0, scrollPosition],
    },
    {
      actionOutcome: true,
      behaviorId: "desktop-social-rail",
      branches: [{ id: "compact-hidden", outcome: true, viewportId: "mobile" }],
      mode: "static",
    },
  );
});

test("approved local fonts and glyph family are active", async ({ browser, page }) => {
  const source = await browser.newPage({ viewport: page.viewportSize()! });
  await Promise.all([ready(source, sourceURL), ready(page, "/")]);
  const probes = [
    { id: "hero", selector: ".swiper-slide-active .fs-120" },
    { atomic: true, id: "product", selector: ".shop-footer .fs-19" },
  ] as const;
  const implementationProbes = [
    { ...probes[0], selector: ".fashion-store-hero-slide[data-active=true] .fs-120" },
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

test("captures the four-viewport Fashion Store initial-home evidence", async ({
  page,
}, testInfo) => {
  test.skip(!process.env.THEME_FIDELITY_CAPTURE_ROOT);
  await ready(page, "/");
  await captureThemeEvidence(page, testInfo, "fashion-store");
});

async function attachSharedRegion(
  locator: Locator,
  name: string,
  testInfo: TestInfo,
): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await locator.screenshot({ path, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

// These checks intentionally bypass ready(): its static capture CSS hides the scroll control.
for (const route of ["/", "/products/relaxed-corduroy-shirt", "/collections"]) {
  test(`shared shell appearance and controls: ${route}`, async ({ page }, testInfo) => {
    await page.goto(route, { waitUntil: "networkidle" });
    await page.evaluate(async () => document.fonts.ready);
    const header = page.locator("header.header-with-topbar nav.navbar");
    await expect(header).toBeVisible();
    await expect(page.locator("body")).toHaveClass(route === "/" ? /fashion-store-home/ : /^$/);
    await attachSharedRegion(header, "header", testInfo);
    const search = page.getByRole("link", { name: "Search", exact: true });
    await search.click();
    await expect(page.getByPlaceholder("Enter your keywords...")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator(".search-form-wrapper")).toBeHidden();
    await expect(search).toBeFocused();
    await expect(search).toHaveCSS("outline-style", "solid");

    const cart = page.locator(".header-cart");
    const cartTrigger = cart.getByRole("button", { name: "Open preview cart" });
    await cartTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(cartTrigger).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(cartTrigger).toHaveCSS("padding-left", route === "/" ? "14px" : "18px");
    await expect(cart.locator(".cart-item-list")).toBeVisible();
    await attachSharedRegion(cart.locator(".cart-item-list"), "mini-cart", testInfo);
    const geometry = await page.evaluate(() => {
      const inspect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)!;
        const style = getComputedStyle(element);
        const { x, y, width, height } = element.getBoundingClientRect();
        return {
          rect: { x, y, width, height },
          top: style.top,
          padding: style.padding,
          lineHeight: style.lineHeight,
          fontSize: style.fontSize,
          marginTop: style.marginTop,
        };
      };
      return {
        nav: inspect("header.header-with-topbar nav.navbar"),
        navContainer: inspect("header nav.navbar > .container-fluid"),
        cartTrigger: inspect(".header-cart > .fashion-store-source-action"),
        cartCTA: inspect(".header-cart .cart-total .btn.btn-large"),
        footer: inspect("footer.footer-dark"),
        footerContainer: inspect("footer.footer-dark > .container"),
        footerRow: inspect("footer.footer-dark > .container > .row"),
      };
    });
    const geometryPath = testInfo.outputPath("geometry.json");
    writeFileSync(geometryPath, JSON.stringify(geometry, null, 2));
    await testInfo.attach("geometry", { path: geometryPath, contentType: "application/json" });
    await search.focus();
    await expect(cart.locator(".cart-item-list")).toBeHidden();
    const cookie = page.locator("#cookies-model");
    await expect(cookie).toBeVisible();
    await cookie.getByRole("button", { name: "Allow cookies" }).click();
    await expect(cookie).toBeHidden();
    const card = page.locator(".shop-box").first();
    if (await card.count()) {
      await attachSharedRegion(card, "product-card", testInfo);
      const action = card.locator(".shop-hover button").first();
      if (await action.count()) {
        await card.hover();
        await action.focus();
        await expect(action).toBeVisible();
        await expect(action).toHaveCSS("border-top-width", "0px");
        await expect(action).toHaveCSS("padding", "0px");
      }
    }
    const footer = page.locator("footer.footer-dark");
    const viewport = page.viewportSize()!;
    const footerHeight = await footer.evaluate((element) => element.clientHeight);
    // Keep the entire region in-view so offscreen fixed controls cannot enter the capture.
    await page.setViewportSize({
      ...viewport,
      height: Math.max(viewport.height, footerHeight + 40),
    });
    await footer.getByText("Categories", { exact: true }).click();
    await attachSharedRegion(footer, "footer", testInfo);
  });

  test(`shared scroll control follows page progress: ${route}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.locator("[data-fashion-store-source-parity]")).toHaveAttribute(
      "data-runtime-status",
      "ready",
    );
    await page.evaluate(async () => document.fonts.ready);
    await page.evaluate(() =>
      window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2),
    );
    const progress = page.locator(".scroll-progress");
    if (page.viewportSize()!.width < 1400) {
      await expect(progress).toBeHidden();
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
      return;
    }
    await expect(progress).toHaveClass(/visible/);
    const button = progress.getByRole("button", { name: "Back to top" });
    await expect(button).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(button).toHaveCSS("border-top-width", "0px");
    const point = progress.locator(".scroll-point");
    const fraction = () =>
      point.evaluate(
        (node) =>
          node.getBoundingClientRect().height / node.parentElement!.getBoundingClientRect().height,
      );
    await expect.poll(fraction).toBeGreaterThan(0.4);
    await expect.poll(fraction).toBeLessThan(0.6);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(fraction).toBeGreaterThan(0.98);
    await attachSharedRegion(progress, "scroll-control", testInfo);
    await button.click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect(page).toHaveURL(new RegExp(`${route.replaceAll("/", "\\/")}$`));
  });
}

for (const { id, path } of fashionStorePageContracts) {
  test(`shared shell route smoke: ${id}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator("[data-fashion-store-source-parity]")).toHaveCount(1);
    // Reduced-motion Home intentionally defers hydration until interaction.
    if (id === "home") {
      await page.getByRole("link", { name: "Search", exact: true }).click();
      await expect(page.getByPlaceholder("Enter your keywords...")).toBeFocused();
      await page.keyboard.press("Escape");
    }
    await expect(page.locator("[data-fashion-store-source-parity]")).toHaveAttribute(
      "data-runtime-instance-count",
      "1",
    );
    await expect(page.locator("header.header-with-topbar nav.navbar")).toBeVisible();
    await expect(page.locator("footer.footer-dark")).toBeVisible();
    await expect(page.getByRole("link", { name: "Search", exact: true })).toBeVisible();
    await expect(
      page.locator(".header-cart").getByRole("button", { name: "Open preview cart" }),
    ).toBeVisible();
    await expect(page.locator("body")).toHaveClass(id === "home" ? /fashion-store-home/ : /^$/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
  });
}

test("shared shell survives link navigation and browser history", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "networkidle" });
  const verifyRoute = async (path: string) => {
    await expect(page).toHaveURL((url) => url.pathname === path);
    const marker = page.locator("[data-fashion-store-source-parity]");
    await expect(marker).toHaveCount(1);
    await expect(marker).toHaveAttribute("data-runtime-status", "ready");
    await expect(marker).toHaveAttribute("data-runtime-instance-count", "1");
    await expect(page.locator("body")).toHaveClass(path === "/" ? /fashion-store-home/ : /^$/);
    await page.evaluate(async () => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    await page.evaluate(() =>
      window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2),
    );
    const progress = page.locator(".scroll-progress");
    await expect(progress).toBeVisible();
    const button = progress.getByRole("button", { name: "Back to top" });
    await expect(button).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(button).toHaveCSS("border-top-width", "0px");
    await expect
      .poll(() =>
        progress.locator(".scroll-point").evaluate((point) => {
          const actual =
            point.getBoundingClientRect().height /
            point.parentElement!.getBoundingClientRect().height;
          const expected = scrollY / (document.documentElement.scrollHeight - innerHeight);
          return Math.abs(actual - expected);
        }),
      )
      .toBeLessThan(0.025);
  };

  await verifyRoute("/");
  await page.locator('.shop-footer a[href="/products/relaxed-corduroy-shirt"]').first().click();
  await verifyRoute("/products/relaxed-corduroy-shirt");
  await page.locator('footer a[href="/collections"]').click();
  await verifyRoute("/collections");
  await page.locator('header a.navbar-brand[href="/"]').click();
  await verifyRoute("/");
  await page.goBack();
  await verifyRoute("/collections");
  await page.goBack();
  await verifyRoute("/products/relaxed-corduroy-shirt");
  await page.goForward();
  await verifyRoute("/collections");
  await page.goForward();
  await verifyRoute("/");
});

test("shared scroll control preserves the 1400px visibility boundary", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/products/relaxed-corduroy-shirt", { waitUntil: "networkidle" });
  await expect(page.locator("[data-fashion-store-source-parity]")).toHaveAttribute(
    "data-runtime-status",
    "ready",
  );
  for (const width of [1399, 1400]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() =>
      window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2),
    );
    const progress = page.locator(".scroll-progress");
    await expect(progress).toHaveClass(/visible/);
    if (width < 1400) {
      await expect(progress).toBeHidden();
    } else {
      await expect(progress).toBeVisible();
      await expect(progress.getByRole("button", { name: "Back to top" })).toHaveCSS(
        "background-color",
        "rgba(0, 0, 0, 0)",
      );
      await attachSharedRegion(progress, "scroll-control-1400", testInfo);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
  }
});
