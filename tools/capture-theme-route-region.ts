import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Browser, type Page, type Route } from "@playwright/test";
import sharp from "../apps/storefront/node_modules/sharp";

import {
  fidelityMatrixViewports,
  themeFidelityMatrix,
  type FidelityDensity,
  type FidelityMatrixViewportId,
  type FidelityRouteId,
} from "../apps/storefront/e2e/support/theme-fidelity-matrix";
import {
  captureSourceContract,
  compareSourceContractSnapshots,
  type SourceContractProbe,
  type SourceContractSnapshot,
} from "../apps/storefront/e2e/support/theme-source-contract";
import {
  captureCssForMode,
  captureModePreservesTarget,
} from "../apps/storefront/e2e/support/theme-capture-contract";
import type { ThemeAcceptanceMode } from "../apps/storefront/e2e/support/theme-behavior-contract";
import {
  assertThemeScreenshotDifference,
  compareThemeScreenshots,
} from "../apps/storefront/scripts/compare-theme-screenshots";
import { acquireCaptureLease } from "./theme-capture-resource-guard";

const computedStyleProperties = [
  "align-items",
  "background-color",
  "background-position",
  "background-repeat",
  "background-size",
  "border-bottom-color",
  "border-bottom-style",
  "border-bottom-width",
  "border-left-color",
  "border-left-style",
  "border-left-width",
  "border-radius",
  "border-right-color",
  "border-right-style",
  "border-right-width",
  "border-top-color",
  "border-top-style",
  "border-top-width",
  "box-shadow",
  "color",
  "display",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "gap",
  "justify-content",
  "letter-spacing",
  "line-height",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "object-fit",
  "object-position",
  "overflow-x",
  "overflow-y",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "position",
  "text-align",
  "text-transform",
  "transform",
  "white-space",
] as const;

const pseudoStyleProperties = [
  "background-color",
  "border-color",
  "border-radius",
  "border-style",
  "border-width",
  "color",
  "content",
  "height",
  "opacity",
  "transform",
  "width",
] as const;

function argumentValue(arguments_: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return arguments_.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function url(base: string, path: string): string {
  return new URL(path.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`).href;
}

function fashionStoreCheckoutCaptureCart() {
  const shippingMethods = [
    ["ship_01J00000000000000000000000", "Free shipping", 0],
    ["ship_01J00000000000000000000001", "Flat", 1_200],
    ["ship_01J00000000000000000000002", "Local pickup", 0],
  ] as const;
  return {
    adjustments: [],
    canCheckout: true,
    currency: "USD",
    expiresAt: "2026-08-08T00:00:00.000Z",
    id: "cart_01J00000000000000000000000",
    lines: [
      ["Textured sweater", "Pink", 1, 2_300, "var_01J00000000000000000000000"],
      ["Bermuda shorts", "Brown", 2, 3_500, "var_01J00000000000000000000001"],
      ["Pocket sweatshirt", "White", 1, 1_500, "var_01J00000000000000000000002"],
    ].map(([productName, variantName, quantity, unitAmount, variantId]) => ({
      availableQuantity: 20,
      lineTotal: { amount: Number(unitAmount) * Number(quantity), currency: "USD" },
      productName: String(productName),
      quantity: Number(quantity),
      unitPrice: { amount: Number(unitAmount), currency: "USD" },
      variantId: String(variantId),
      variantName: String(variantName),
    })),
    selectedShippingMethodId: shippingMethods[0][0],
    shippingAddress: null,
    shippingMethods: shippingMethods.map(([id, name, amount]) => ({
      amount,
      currency: "USD",
      estimatedDaysMax: 5,
      estimatedDaysMin: 3,
      id,
      name,
    })),
    totals: {
      discountTotal: 0,
      grandTotal: 40_500,
      shippingTotal: 0,
      subtotal: 40_500,
      taxTotal: 1_929,
    },
  };
}

async function fulfillFashionStoreCheckoutCaptureApi(route: Route): Promise<void> {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  if (path === "/api/platform/config") {
    await route.fulfill({
      contentType: "application/json",
      json: { data: { turnstile: { required: false, siteKey: null } } },
    });
    return;
  }
  if (path === "/api/cart") {
    const cart = fashionStoreCheckoutCaptureCart();
    await route.fulfill({
      contentType: "application/json",
      json:
        request.method() === "POST"
          ? { data: { cart, token: "capture_cart_token" } }
          : { data: cart },
    });
    return;
  }
  await route.continue();
}

async function stabilize(page: Page, mode: ThemeAcceptanceMode): Promise<void> {
  const captureCss = captureCssForMode(mode);
  await page.addStyleTag({ content: captureCss });
  await page.addStyleTag({
    content:
      ".skip-link, .decor-skip-link, .fashion-skip-link { visibility: hidden !important; } [data-parallax-background-ratio], .fashion-contact-parallax { background-attachment: scroll !important; background-position: center center !important; } [data-bottom-top], [data-top-bottom], .animation-rotation { animation: none !important; transform: none !important; }",
  });
  await page.evaluate(async () => {
    document.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      image.loading = "eager";
    });
    document.querySelectorAll<HTMLElement>("[data-shadow-animation]").forEach((element) => {
      element.classList.add("shadow-in");
      element.style.setProperty("transition", "none", "important");
      element.querySelectorAll<HTMLElement>("img").forEach((image) => {
        image.style.setProperty("opacity", "1", "important");
        image.style.setProperty("transition", "none", "important");
      });
    });
    await document.fonts.ready;
    await Promise.race([
      Promise.all([...document.images].map((image) => image.decode().catch(() => undefined))),
      new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 2_000)),
    ]);
    document.querySelectorAll<HTMLElement>(".swiper").forEach((element) => {
      const swiper = (element as HTMLElement & { swiper?: { autoplay?: { stop(): void } } }).swiper;
      swiper?.autoplay?.stop();
    });
    scrollTo(0, 0);
  });
  if (
    mode !== "temporal" &&
    (await page.locator(`[data-anime*='"effect": "slide"']`).count()) > 0
  ) {
    await page.waitForTimeout(2_100);
  }
  await page.waitForTimeout(100);
  await page.addStyleTag({ content: captureCss });
  await page.evaluate((preserveMotion) => {
    document
      .querySelectorAll<HTMLElement>("[data-anime], .appear, .anime-complete, [data-source-reveal]")
      .forEach((element) => {
        element.style.setProperty("opacity", "1", "important");
        if (!preserveMotion) element.style.setProperty("transform", "none", "important");
        element.style.setProperty("visibility", "visible", "important");
      });
    dispatchEvent(new Event("resize"));
    const jquery = (
      window as typeof window & {
        jQuery?: (element: Element) => {
          isotope?: (action: string | { transitionDuration: number }) => void;
        };
      }
    ).jQuery;
    if (jquery)
      document.querySelectorAll(".grid").forEach((grid) => {
        const isotopeGrid = jquery(grid);
        isotopeGrid.isotope?.({ transitionDuration: 0 });
        isotopeGrid.isotope?.("reloadItems");
        isotopeGrid.isotope?.("layout");
      });
    scrollTo(0, 0);
  }, mode === "temporal");
  await page.waitForTimeout(100);
}

async function stabilizeProductGallery(page: Page, source: boolean): Promise<void> {
  if (source) {
    await page.evaluate(() => {
      for (const element of document.querySelectorAll<HTMLElement>(
        ".product-image-slider, .product-image-thumb",
      )) {
        const swiper = (
          element as HTMLElement & {
            swiper?: {
              autoplay?: { stop(): void };
              slideTo(index: number, speed?: number, runCallbacks?: boolean): void;
              slideToLoop?(index: number, speed?: number, runCallbacks?: boolean): void;
            };
          }
        ).swiper;
        swiper?.autoplay?.stop();
        if (swiper?.slideToLoop) swiper.slideToLoop(0, 0, true);
        else swiper?.slideTo(0, 0, true);
      }
    });
    return;
  }
  await page.evaluate(() => {
    document
      .querySelector<HTMLElement>(".product-image-slider")
      ?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
  });
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>(".product-image-thumb button")?.click();
    scrollTo(0, 0);
  });
  await page.waitForTimeout(350);
  await page.evaluate(() => scrollTo(0, 0));
}

async function stabilizeDecorHero(page: Page, source: boolean): Promise<void> {
  if (source) {
    await page.evaluate(() => {
      const jquery = (
        window as typeof window & {
          jQuery?: (selector: string) => {
            revpause?(): void;
            revresume?(): void;
            revshowslide?(index: number): void;
          };
        }
      ).jQuery;
      const revolution = jquery?.("#decor-store-slider");
      revolution?.revresume?.();
      revolution?.revshowslide?.(1);
    });
    await page.waitForTimeout(5_000);
    await page.waitForFunction(
      () => {
        const slide = document.querySelector<HTMLElement>(
          '#decor-store-slider li[data-index="rs-73"]',
        );
        if (!slide?.classList.contains("active-revslide")) return false;
        return [7, 8, 9].every((layer) => {
          const element = document.querySelector<HTMLElement>(`#slide-1-layer-0${layer}`);
          if (!element) return false;
          const style = getComputedStyle(element);
          return (
            Number(style.opacity) > 0.99 &&
            (style.filter === "none" || /blur\(0(?:px)?\)/.test(style.filter))
          );
        });
      },
      undefined,
      { timeout: 15_000 },
    );
    await page.evaluate(() => {
      const jquery = (
        window as typeof window & {
          jQuery?: (selector: string) => { revpause?(): void };
        }
      ).jQuery;
      jquery?.("#decor-store-slider").revpause?.();
      scrollTo(0, 0);
    });
  } else {
    await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>(".decor-hero");
      // Keep the controller on the canonical frame while later full-page
      // stabilizers run; resetting the index alone leaves autoplay armed.
      hero?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
      const activeIndex = Number(hero?.dataset.motionActiveIndex ?? "0");
      if (activeIndex > 0) {
        hero?.focus();
        for (let index = 0; index < activeIndex; index += 1)
          hero?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" }));
      }
      scrollTo(0, 0);
    });
    await page.waitForFunction(
      () =>
        document.querySelector(".decor-hero")?.getAttribute("data-motion-active-index") === "0" &&
        document.querySelector(".decor-hero")?.getAttribute("data-motion-phase") === "idle",
      undefined,
      { timeout: 6_000 },
    );
  }
  await page.waitForTimeout(100);
}

async function stabilizeDecorMarquee(page: Page, source: boolean): Promise<void> {
  if (source)
    await page.locator("section:nth-of-type(4) .swiper").evaluate((element) => {
      (
        element as HTMLElement & {
          swiper?: {
            autoplay?: { stop(): void };
            slideToLoop?(index: number, speed: number): void;
          };
        }
      ).swiper?.autoplay?.stop();
      (
        element as HTMLElement & {
          swiper?: { slideToLoop?(index: number, speed: number): void };
        }
      ).swiper?.slideToLoop?.(0, 0);
    });
  if (source) await page.waitForTimeout(100);
  await page.evaluate((sourceSide) => {
    const root = document.querySelector(sourceSide ? "section:nth-of-type(4)" : ".decor-marquee");
    const track = root?.querySelector<HTMLElement>(
      sourceSide ? ".swiper-wrapper" : ".decor-marquee-track",
    );
    const item = root?.querySelector<HTMLElement>(
      sourceSide
        ? '.swiper-slide[data-swiper-slide-index="0"] > div'
        : ".decor-marquee-track > span:nth-child(4)",
    );
    if (!track || !item) return;
    track.style.animation = "none";
    track.style.transition = "none";
    const targetX = Math.round(innerWidth * 0.31);
    const textNode = [...item.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    const range = textNode ? document.createRange() : null;
    if (range && textNode) range.selectNode(textNode);
    const text = range?.getBoundingClientRect();
    if (!text) return;
    const matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
    track.style.transform = `matrix(1, 0, 0, 1, ${matrix.e + targetX - text.x}, ${
      matrix.f + Math.round(text.y) - text.y
    })`;
  }, source);
  await page.waitForTimeout(100);
}

async function stabilizeFashionStoreHero(page: Page, source: boolean): Promise<void> {
  if (source) {
    await page.locator("section:nth-of-type(1) .swiper").evaluate((element) => {
      const swiper = (
        element as HTMLElement & {
          swiper?: {
            autoplay?: { stop(): void };
            slideToLoop?(index: number, speed: number, runCallbacks?: boolean): void;
          };
        }
      ).swiper;
      swiper?.autoplay?.stop();
      swiper?.slideToLoop?.(0, 0, true);
    });
    await page.waitForFunction(() =>
      document
        .querySelector('section:nth-of-type(1) .swiper-slide[data-swiper-slide-index="0"]')
        ?.classList.contains("swiper-slide-active"),
    );
    // The source runtime restarts its slide reveal after slideToLoop(), even at
    // zero Swiper speed. Wait for that reveal before recording geometry so the
    // contract and screenshot observe the same settled frame.
    await page.waitForTimeout(2_100);
    await page.locator("section:nth-of-type(1) .swiper").evaluate((element: HTMLElement) => {
      const targetHeight = innerWidth >= 992 ? innerHeight : innerWidth >= 576 ? 600 : 500;
      element.style.setProperty("height", `${targetHeight}px`, "important");
      element.querySelectorAll<HTMLElement>(".swiper-slide").forEach((slide) => {
        slide.style.setProperty("height", `${targetHeight}px`, "important");
      });
    });
  } else {
    await page.locator('[data-fashion-store-slide="0"]').evaluate((button: HTMLButtonElement) => {
      button.click();
    });
    await page.waitForFunction(
      () => {
        const hero = document.querySelector<HTMLElement>("#fashion-store-main .swiper");
        return hero?.dataset.motionActiveIndex === "0" && hero.dataset.motionPhase === "idle";
      },
      undefined,
      { timeout: 6_000 },
    );
  }
  await page.waitForTimeout(100);
}

async function stabilizeFashionStoreMarquee(page: Page, source: boolean): Promise<void> {
  if (source) {
    await page.locator("section:nth-of-type(9) .swiper").evaluate((element) => {
      const swiper = (
        element as HTMLElement & {
          swiper?: {
            autoplay?: { stop(): void };
            slideToLoop?(index: number, speed: number): void;
          };
        }
      ).swiper;
      swiper?.autoplay?.stop();
      swiper?.slideToLoop?.(0, 0);
    });
    await page.waitForTimeout(100);
  }
  await page.evaluate((sourceSide) => {
    const root = document.querySelector<HTMLElement>("section:nth-of-type(9)");
    const track = root?.querySelector<HTMLElement>(
      sourceSide ? ".swiper-wrapper" : "[data-fashion-store-marquee]",
    );
    if (!track) return;
    const slides = [...track.querySelectorAll<HTMLElement>(":scope > .swiper-slide")];
    const canonicalSlides = sourceSide
      ? [0, 1, 2].map((index) =>
          slides.find((slide) => slide.dataset.swiperSlideIndex === String(index)),
        )
      : slides.slice(0, 3);
    if (canonicalSlides.some((slide) => !slide)) return;
    for (const slide of slides) slide.style.setProperty("display", "none", "important");
    canonicalSlides.forEach((slide, index) => {
      slide!.style.setProperty("display", "block", "important");
      slide!.style.setProperty("order", String(index), "important");
      slide!.style.setProperty("margin-left", "0px", "important");
    });
    track.style.setProperty("animation", "none", "important");
    track.style.setProperty("transition", "none", "important");
    track.style.setProperty("transform", "none", "important");
    const targetX = Math.round(innerWidth * 0.31);
    const trackRect = track.getBoundingClientRect();
    canonicalSlides[0]!.style.setProperty(
      "margin-left",
      `${targetX - trackRect.left}px`,
      "important",
    );
  }, source);
  await page.waitForTimeout(100);
}

async function stabilizeFashionStoreAboutCarousel(page: Page, source: boolean): Promise<void> {
  if (source) {
    await page.locator("section:nth-of-type(4) .swiper").evaluate((element) => {
      const swiper = (
        element as HTMLElement & {
          swiper?: {
            autoplay?: { stop(): void };
            slideToLoop?(index: number, speed: number, runCallbacks?: boolean): void;
          };
        }
      ).swiper;
      swiper?.autoplay?.stop();
      swiper?.slideToLoop?.(0, 0, true);
    });
  } else {
    const carousel = page.locator(".fashion-about-carousel");
    const current = Number(
      (await page.locator("[data-fashion-store-about]").getAttribute("data-carousel-index")) ?? 0,
    );
    for (let index = 0; index < current; index += 1) await carousel.press("ArrowLeft");
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-fashion-store-about]")
          ?.getAttribute("data-carousel-index") === "0",
    );
  }
  await page.evaluate((sourceSide) => {
    const root = document.querySelector<HTMLElement>(
      sourceSide ? "section:nth-of-type(4)" : ".fashion-about-carousel-section",
    );
    const track = root?.querySelector<HTMLElement>(
      sourceSide ? ".swiper-wrapper" : ".fashion-about-carousel-track",
    );
    if (!track) return;
    const slides = [
      ...track.querySelectorAll<HTMLElement>(
        sourceSide ? ":scope > .swiper-slide" : ":scope > .fashion-about-carousel-slide",
      ),
    ];
    const gap = sourceSide
      ? Number.parseFloat(getComputedStyle(slides[0]!).marginRight) || 0
      : Number.parseFloat(getComputedStyle(track).gap) || 0;
    track.style.gap = "0px";
    for (const slide of slides) {
      const width = slide.getBoundingClientRect().width;
      slide.style.flex = `0 0 ${width}px`;
      slide.style.width = `${width}px`;
      slide.style.marginRight = `${gap}px`;
    }
  }, source);
  await page.waitForTimeout(100);
}

async function stabilizeFashionStoreAboutBrands(page: Page, source: boolean): Promise<void> {
  if (source) {
    await page.locator("section:nth-of-type(6) .clients-style-08 .swiper").evaluate((element) => {
      const swiper = (
        element as HTMLElement & {
          swiper?: {
            autoplay?: { stop(): void };
            slideToLoop?(index: number, speed: number, runCallbacks?: boolean): void;
          };
        }
      ).swiper;
      swiper?.autoplay?.stop();
      swiper?.slideToLoop?.(0, 0, true);
    });
    await page.waitForTimeout(100);
  }
  await page.evaluate((sourceSide) => {
    const root = document.querySelector<HTMLElement>(
      sourceSide ? "section:nth-of-type(6)" : ".fashion-about-mission",
    );
    const track = root?.querySelector<HTMLElement>(
      sourceSide ? ".clients-style-08 .swiper-wrapper" : ".fashion-about-brand-track",
    );
    const candidates = [
      ...(root?.querySelectorAll<HTMLElement>(
        sourceSide
          ? '.clients-style-08 .swiper-slide[data-swiper-slide-index="0"]'
          : ".fashion-about-brand-track > div:first-child",
      ) ?? []),
    ];
    if (!track || candidates.length === 0) return;
    track.style.animation = "none";
    track.style.transition = "none";
    const targetX = Math.round(innerWidth * 0.18);
    const item = candidates.reduce((closest, candidate) =>
      Math.abs(candidate.getBoundingClientRect().x - targetX) <
      Math.abs(closest.getBoundingClientRect().x - targetX)
        ? candidate
        : closest,
    );
    const matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
    const itemRect = item.getBoundingClientRect();
    track.style.transform = `matrix(1, 0, 0, 1, ${matrix.e + targetX - itemRect.x}, 0)`;
  }, source);
  await page.waitForTimeout(100);
}

async function stabilizeDecorCollection(page: Page, source: boolean): Promise<void> {
  if (source) {
    await page.locator("section:nth-of-type(5) .swiper").evaluate((element) => {
      const swiper = (
        element as HTMLElement & {
          swiper?: {
            autoplay?: { stop(): void };
            slideToLoop?(index: number, speed: number, runCallbacks?: boolean): void;
          };
        }
      ).swiper;
      swiper?.autoplay?.stop();
      swiper?.slideToLoop?.(0, 0, true);
    });
    await page.waitForFunction(() =>
      document
        .querySelector('section:nth-of-type(5) .swiper-slide[data-swiper-slide-index="0"]')
        ?.classList.contains("swiper-slide-active"),
    );
  } else {
    await page.evaluate(() => {
      const collection = document.querySelector<HTMLElement>(".decor-collection");
      const activeIndex = Number(collection?.dataset.motionActiveIndex ?? "0");
      for (let index = 0; index < activeIndex; index += 1)
        collection?.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" }),
        );
    });
    await page.waitForFunction(
      () =>
        document.querySelector(".decor-collection")?.getAttribute("data-motion-active-index") ===
          "0" &&
        document.querySelector(".decor-collection")?.getAttribute("data-motion-phase") === "idle",
      undefined,
      { timeout: 6_000 },
    );
  }
  await page.waitForTimeout(100);
}

async function stabilizeDecorClients(page: Page, source: boolean): Promise<void> {
  if (source)
    await page.locator("section:nth-of-type(6) .swiper").evaluate((element) => {
      (
        element as HTMLElement & {
          swiper?: { autoplay?: { stop(): void }; setTransition?(duration: number): void };
        }
      ).swiper?.autoplay?.stop();
      (
        element as HTMLElement & { swiper?: { setTransition?(duration: number): void } }
      ).swiper?.setTransition?.(0);
    });
  await page.evaluate((sourceSide) => {
    const root = document.querySelector<HTMLElement>(
      sourceSide ? "section:nth-of-type(6)" : ".decor-clients",
    );
    const windowElement = root?.querySelector<HTMLElement>(
      sourceSide ? ".swiper" : ".decor-clients-window",
    );
    const track = windowElement?.querySelector<HTMLElement>(
      sourceSide ? ".swiper-wrapper" : ".decor-clients-track",
    );
    const item = windowElement?.querySelector<HTMLElement>(
      sourceSide ? ".swiper-slide" : ".decor-clients-track > span",
    );
    const candidates = [
      ...(windowElement?.querySelectorAll<HTMLImageElement>('img[src*="client-01"]') ?? []),
    ];
    if (!windowElement || !track || !item || candidates.length === 0) return;
    track.style.animation = "none";
    track.style.transition = "none";
    const windowRect = windowElement.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const imageWidth = candidates[0]!.getBoundingClientRect().width;
    const paddingLeft = Number.parseFloat(getComputedStyle(windowElement).paddingLeft);
    const targetX =
      windowRect.left + paddingLeft - itemRect.width + (itemRect.width - imageWidth) / 2;
    const candidate = candidates.sort(
      (left, right) =>
        Math.abs(left.getBoundingClientRect().left - targetX) -
        Math.abs(right.getBoundingClientRect().left - targetX),
    )[0]!;
    const matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
    const rect = candidate.getBoundingClientRect();
    track.style.transform = `matrix(1, 0, 0, 1, ${matrix.e + targetX - rect.left}, ${matrix.f})`;
    for (let index = 1; index <= 5; index += 1) {
      const expectedX = targetX + (index - 1) * itemRect.width;
      const matching = [
        ...windowElement.querySelectorAll<HTMLImageElement>(`img[src*="client-0${index}"]`),
      ].sort(
        (left, right) =>
          Math.abs(left.getBoundingClientRect().left - expectedX) -
          Math.abs(right.getBoundingClientRect().left - expectedX),
      )[0];
      matching?.setAttribute("data-fidelity-client", String(index));
    }
  }, source);
  await page.waitForTimeout(100);
}

interface SectionOrigin {
  left: number;
  top: number;
}

export function equivalentRoundedSectionTarget(
  sourceRect: SectionOrigin | null,
  implementationRect: SectionOrigin | null,
): SectionOrigin | null {
  if (
    !sourceRect ||
    !implementationRect ||
    Math.abs(sourceRect.left - implementationRect.left) > 0.1 ||
    Math.abs(sourceRect.top - implementationRect.top) > 0.1
  )
    return null;
  return { left: Math.round(sourceRect.left), top: Math.round(sourceRect.top) };
}

async function alignDecorHomeFullPageSections(source: Page, implementation: Page): Promise<void> {
  const sourceSelectors = [
    "section:nth-of-type(1)",
    "section:nth-of-type(2)",
    "section:nth-of-type(3)",
    "section:nth-of-type(4)",
    "section:nth-of-type(5)",
    "section:nth-of-type(6)",
    "section:nth-of-type(7)",
    "section:nth-of-type(8)",
    "footer",
  ];
  const implementationSelectors = [
    ".decor-hero",
    ".decor-categories",
    ".decor-products",
    ".decor-marquee",
    ".decor-collection",
    ".decor-clients",
    ".decor-journal",
    ".decor-services",
    ".decor-footer",
  ];
  const [sourceRects, implementationRects] = await Promise.all([
    source.evaluate(
      (selectors) =>
        selectors.map((selector) => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect ? { left: rect.left, top: rect.top } : null;
        }),
      sourceSelectors,
    ),
    implementation.evaluate(
      (selectors) =>
        selectors.map((selector) => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect ? { left: rect.left, top: rect.top } : null;
        }),
      implementationSelectors,
    ),
  ]);
  const targets = sourceRects.map((sourceRect, index) =>
    equivalentRoundedSectionTarget(sourceRect, implementationRects[index] ?? null),
  );
  await Promise.all([
    source.evaluate(
      ({ selectors, targets: sharedTargets }) => {
        selectors.forEach((selector, index) => {
          const element = document.querySelector<HTMLElement>(selector);
          const target = sharedTargets[index];
          if (!element || !target) return;
          const rect = element.getBoundingClientRect();
          element.style.translate = `${target.left - rect.left}px ${target.top - rect.top}px`;
        });
      },
      { selectors: sourceSelectors, targets },
    ),
    implementation.evaluate(
      ({ selectors, targets: sharedTargets }) => {
        selectors.forEach((selector, index) => {
          const element = document.querySelector<HTMLElement>(selector);
          const target = sharedTargets[index];
          if (!element || !target) return;
          const rect = element.getBoundingClientRect();
          element.style.translate = `${target.left - rect.left}px ${target.top - rect.top}px`;
        });
      },
      { selectors: implementationSelectors, targets },
    ),
  ]);
  await Promise.all([source.waitForTimeout(100), implementation.waitForTimeout(100)]);
}

async function hydrateSourcePlaceholderImages(page: Page): Promise<void> {
  await page.evaluate(() => {
    const decorProductAssets = ["01", "14", "12", "05", "06", "13", "09", "10", "03", "15"];
    const decorPlaceholders = [...document.querySelectorAll<HTMLImageElement>("img")].filter(
      (image) =>
        location.pathname.includes("demo-decor-store") &&
        /via\.placeholder\.com\/(?:600x700|600x650|30x30|682x480|1190x500|500x570|140x140)/.test(
          image.src,
        ),
    );
    decorPlaceholders.forEach((image, index) => {
      const dimensions = image.src.match(/\/(\d+)x(\d+)(?:\?|$)/);
      const productNumber = decorProductAssets[index % decorProductAssets.length];
      image.src = new URL(
        `images/demo-decor-store-product-${productNumber}.jpg`,
        location.href,
      ).href;
      if (dimensions) {
        image.style.aspectRatio = `${dimensions[1]} / ${dimensions[2]}`;
        image.style.display = "block";
        image.style.objectFit = "cover";
      }
    });
    const productPlaceholders = [...document.querySelectorAll<HTMLImageElement>("img")].filter(
      (image) => image.src.includes("via.placeholder.com/600x765"),
    );
    const groupedPlaceholders = [
      productPlaceholders.filter((image) => image.closest(".shop-modern")),
      productPlaceholders.filter((image) => image.closest(".product-image-slider")),
      productPlaceholders.filter((image) => image.closest(".product-image-thumb")),
      productPlaceholders.filter((image) => image.classList.contains("cart-thumb")),
    ];
    const grouped = new Set(groupedPlaceholders.flat());
    groupedPlaceholders.push(productPlaceholders.filter((image) => !grouped.has(image)));
    for (const placeholders of groupedPlaceholders) {
      placeholders.forEach((image, index) => {
        const productNumber = String((index % 12) + 1).padStart(2, "0");
        image.src = new URL(
          `images/demo-fashion-store-product-${productNumber}.jpg`,
          location.href,
        ).href;
      });
    }
    const paymentPlaceholders = [...document.querySelectorAll<HTMLImageElement>("img")].filter(
      (image) => image.src.includes("via.placeholder.com/55x20"),
    );
    paymentPlaceholders.forEach((image, index) => {
      const paymentNumber = String((index % 4) + 1).padStart(2, "0");
      image.src = new URL(
        `images/demo-decor-store-payment-icon-${paymentNumber}.png`,
        location.href,
      ).href;
    });
    const detailPlaceholders = [...document.querySelectorAll<HTMLImageElement>("img")].filter(
      (image) => image.src.includes("via.placeholder.com/580x555"),
    );
    detailPlaceholders.forEach((image) => {
      image.src = new URL("images/demo-fashion-store-product-01.jpg", location.href).href;
      image.style.aspectRatio = "580 / 555";
      image.style.display = "block";
      image.style.objectFit = "cover";
    });
  });
}

async function imageDiagnostics(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate(async (root) =>
      Promise.all(
        [...root.querySelectorAll<HTMLImageElement>("img")]
          .filter((image) => {
            const rootRect = root.getBoundingClientRect();
            const rect = image.getBoundingClientRect();
            const style = getComputedStyle(image);
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.right > rootRect.left &&
              rect.left < rootRect.right &&
              rect.bottom > rootRect.top &&
              rect.top < rootRect.bottom
            );
          })
          .map(async (image) => {
            const rootRect = root.getBoundingClientRect();
            const rect = image.getBoundingClientRect();
            const srcset = image.getAttribute("srcset");
            const selectedDensity =
              srcset
                ?.split(",")
                .map((candidate) => candidate.trim().split(/\s+/))
                .find(([candidate]) =>
                  candidate ? new URL(candidate, location.href).href === image.currentSrc : false,
                )?.[1]
                ?.match(/^(\d+(?:\.\d+)?)x$/)?.[1] ?? "1";
            const resourceDensity = Number(selectedDensity);
            let sha256: string | null = null;
            try {
              const bytes = await fetch(image.currentSrc).then((response) =>
                response.arrayBuffer(),
              );
              sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
                .map((byte) => byte.toString(16).padStart(2, "0"))
                .join("");
            } catch {
              // Cross-origin placeholders in secondary source demos are layout references only.
            }
            return {
              currentSrc: image.currentSrc,
              naturalHeight: image.naturalHeight,
              naturalWidth: image.naturalWidth,
              resourceHeight: image.naturalHeight * resourceDensity,
              resourceWidth: image.naturalWidth * resourceDensity,
              rect: {
                height: rect.height,
                width: rect.width,
                x: rect.x - rootRect.x,
                y: rect.y - rootRect.y,
              },
              sha256,
              src: image.getAttribute("src"),
              srcset,
            };
          }),
      ),
    );
}

const fullPageLayoutSelectors = {
  "decor-collection": {
    implementation: {
      footer: ".decor-footer",
      grid: ".decor-shop-grid",
      layout: ".decor-shop-layout",
      pagination: ".decor-shop-pagination",
      sidebar: ".decor-shop-sidebar",
      sidebarArrivals: ".decor-shop-sidebar > section:nth-child(5)",
      sidebarCategories: ".decor-shop-sidebar > section:nth-child(1)",
      sidebarColor: ".decor-shop-sidebar > section:nth-child(2)",
      sidebarFabric: ".decor-shop-sidebar > section:nth-child(3)",
      sidebarPrice: ".decor-shop-sidebar > section:nth-child(4)",
      sidebarTags: ".decor-shop-sidebar > section:nth-child(6)",
      title: ".decor-shop-title",
      toolbar: ".decor-shop-toolbar",
    },
    reference: {
      footer: "footer",
      grid: ".shop-wrapper",
      layout: "section:nth-of-type(2)",
      pagination: ".shop-wrapper + .w-100",
      sidebar: ".shop-sidebar",
      sidebarArrivals: ".shop-sidebar > div:nth-child(5)",
      sidebarCategories: ".shop-sidebar > div:nth-child(1)",
      sidebarColor: ".shop-sidebar > div:nth-child(2)",
      sidebarFabric: ".shop-sidebar > div:nth-child(3)",
      sidebarPrice: ".shop-sidebar > div:nth-child(4)",
      sidebarTags: ".shop-sidebar > div:nth-child(6)",
      title: "section:nth-of-type(1)",
      toolbar: ".toolbar-wrapper",
    },
  },
  "decor-product": {
    implementation: {
      breadcrumb: ".decor-product-breadcrumb",
      footer: ".decor-footer",
      gallery: ".decor-product-gallery-stage",
      info: ".decor-product-info",
      intro: ".decor-product-description-intro",
      introImage: ".decor-product-description-intro > img",
      introText: ".decor-product-description-intro > div",
      main: ".decor-product-main",
      material: ".decor-product-material-grid",
      materialCard: ".decor-product-material-grid > article",
      materialImage: ".decor-product-material-grid > article img",
      related: ".decor-related-products",
      relatedCard: ".decor-related-products > div > article",
      relatedGrid: ".decor-related-products > div",
      relatedMedia: ".decor-related-products > div > article img",
      story: ".decor-product-description-story",
      storyHeading: ".decor-product-description-story > h3",
      storyImage: ".decor-product-description-story > img",
      storyText: ".decor-product-description-story > p",
      tablist: ".decor-product-tabs [role='tablist']",
      tabs: ".decor-product-tabs",
      thumbs: ".decor-product-thumbs",
      wide: ".decor-product-description-wide",
    },
    reference: {
      breadcrumb: "body > section:nth-of-type(1)",
      footer: "footer",
      gallery: ".product-image-slider",
      info: ".product-info",
      intro: "#tab_five1 > .row:nth-child(1)",
      introImage: "#tab_five1 > .row:nth-child(1) img",
      introText: "#tab_five1 > .row:nth-child(1) > div:first-child",
      main: "body > section:nth-of-type(2)",
      material: "#tab_five1 > .row:nth-child(4)",
      materialCard: "#tab_five1 > .row:nth-child(4) > div",
      materialImage: "#tab_five1 > .row:nth-child(4) > div img",
      related: "body > section:nth-of-type(4)",
      relatedCard: "body > section:nth-of-type(4) ul.shop-wrapper > li.grid-item",
      relatedGrid: "body > section:nth-of-type(4) ul.shop-wrapper",
      relatedMedia: "body > section:nth-of-type(4) ul.shop-wrapper .shop-image img",
      story: "#tab_five1 > .row:nth-child(3)",
      storyHeading: "#tab_five1 > .row:nth-child(3) h5",
      storyImage: "#tab_five1 > .row:nth-child(3) img",
      storyText: "#tab_five1 > .row:nth-child(3) p",
      tablist: "#tab .nav-tabs",
      tabs: "#tab",
      thumbs: ".product-image-thumb",
      wide: "#tab_five1 > .row:nth-child(2)",
    },
  },
} as const;

async function fullPageLayoutDiagnostics(
  page: Page,
  routeId: FidelityRouteId,
  side: "implementation" | "reference",
) {
  const route = fullPageLayoutSelectors[routeId as keyof typeof fullPageLayoutSelectors];
  if (!route) return undefined;
  const selectors = route[side];
  const entries = await Promise.all(
    Object.entries(selectors).map(async ([id, selector]) => {
      const element = page.locator(selector).first();
      if ((await element.count()) === 0) return [id, null] as const;
      return [
        id,
        await element.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          return {
            display: style.display,
            gridTemplateColumns: style.gridTemplateColumns,
            margin: style.margin,
            padding: style.padding,
            rect: {
              height: rect.height,
              width: rect.width,
              x: rect.x,
              y: rect.y,
            },
          };
        }),
      ] as const;
    }),
  );
  return {
    documentHeight: await page.evaluate(() => document.documentElement.scrollHeight),
    elements: Object.fromEntries(entries),
  };
}

function localizeContract(
  snapshot: SourceContractSnapshot,
  origin: { left: number; top: number },
): SourceContractSnapshot {
  return {
    ...snapshot,
    probes: snapshot.probes.map((probe) => ({
      ...probe,
      elements: probe.elements.map((element) => ({
        ...element,
        rect: {
          ...element.rect,
          bottom: element.rect.bottom - origin.top,
          left: element.rect.left - origin.left,
          right: element.rect.right - origin.left,
          top: element.rect.top - origin.top,
        },
      })),
    })),
  };
}

async function normalizeRegionCaptureHeight(page: Page, selector: string): Promise<void> {
  await page
    .locator(selector)
    .first()
    .evaluate((root: HTMLElement) => {
      const height = root.getBoundingClientRect().height;
      const roundedHeight = Math.ceil(height);
      // Only remove the near-integer rounding noise that can make equivalent
      // locator captures alternate between adjacent output pixels. A material
      // fractional height is real layout geometry; forcing it to an integer can
      // move centered grid/flex children and create screenshot differences.
      if (roundedHeight - height <= 0.1)
        root.style.setProperty("height", `${roundedHeight}px`, "important");
    });
}

async function settleRegionInViewport(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.height <= innerHeight) {
        if (rect.bottom > innerHeight) scrollBy(0, Math.ceil(rect.bottom - innerHeight));
        else if (rect.top < 0) scrollBy(0, Math.floor(rect.top));
      }
      if (rect.width <= innerWidth) {
        if (rect.right > innerWidth) scrollBy(Math.ceil(rect.right - innerWidth), 0);
        else if (rect.left < 0) scrollBy(Math.floor(rect.left), 0);
      }
    });
  await page.evaluate(
    () =>
      new Promise<void>((resolvePromise) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolvePromise())),
      ),
  );
}

async function normalizeRegionFractionalOrigin(page: Page, selector: string): Promise<void> {
  await page
    .locator(selector)
    .first()
    .evaluate((element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const x = Math.floor(rect.left) - rect.left;
      const y = Math.floor(rect.top) - rect.top;
      if (getComputedStyle(element).position === "static") element.style.position = "relative";
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    });
  await page.evaluate(
    () =>
      new Promise<void>((resolvePromise) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolvePromise())),
      ),
  );
}

async function captureRegionScreenshot(page: Page, selector: string, path: string): Promise<void> {
  const bounds = await page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        documentLeft: rect.left + scrollX,
        documentTop: rect.top + scrollY,
        height: rect.height,
        left: rect.left,
        top: rect.top,
        viewportHeight: innerHeight,
        viewportWidth: innerWidth,
        width: rect.width,
      };
    });
  const density = await page.evaluate(() => devicePixelRatio);
  const fullPage = bounds.height > bounds.viewportHeight || bounds.width > bounds.viewportWidth;
  const screenshot = await page.screenshot({ animations: "allow", fullPage });
  const left = fullPage ? bounds.documentLeft : bounds.left;
  const top = fullPage ? bounds.documentTop : bounds.top;
  const cropLeft = Math.floor(left * density);
  const cropTop = Math.floor(top * density);
  const cropWidth = Math.ceil(bounds.width * density);
  const cropHeight = Math.ceil(bounds.height * density);
  const metadata = await sharp(screenshot).metadata();
  const screenshotWidth = metadata.width ?? 0;
  const screenshotHeight = metadata.height ?? 0;
  const clampedLeft = Math.max(0, Math.min(cropLeft, screenshotWidth - 1));
  const clampedTop = Math.max(0, Math.min(cropTop, screenshotHeight - 1));
  const clampedRight = Math.max(
    clampedLeft + 1,
    Math.min(clampedLeft + cropWidth, screenshotWidth),
  );
  const clampedBottom = Math.max(
    clampedTop + 1,
    Math.min(clampedTop + cropHeight, screenshotHeight),
  );
  await sharp(screenshot)
    .extract({
      height: clampedBottom - clampedTop,
      left: clampedLeft,
      top: clampedTop,
      width: clampedRight - clampedLeft,
    })
    .png()
    .toFile(path);
}

async function normalizeEquivalentRegionScreenshotDimensions(
  referencePath: string,
  implementationPath: string,
  density: FidelityDensity,
  captureBounds: {
    implementation: { height: number; left: number; top: number; width: number };
    reference: { height: number; left: number; top: number; width: number };
  },
): Promise<void> {
  const geometryMatches = (["height", "left", "top", "width"] as const).every(
    (property) =>
      Math.abs(captureBounds.reference[property] - captureBounds.implementation[property]) <= 0.01,
  );
  if (!geometryMatches) return;

  const [referenceMetadata, implementationMetadata] = await Promise.all([
    sharp(referencePath).metadata(),
    sharp(implementationPath).metadata(),
  ]);
  const referenceWidth = referenceMetadata.width ?? 0;
  const referenceHeight = referenceMetadata.height ?? 0;
  const implementationWidth = implementationMetadata.width ?? 0;
  const implementationHeight = implementationMetadata.height ?? 0;
  if (
    Math.abs(referenceWidth - implementationWidth) > density ||
    Math.abs(referenceHeight - implementationHeight) > density
  )
    return;
  const width = Math.min(referenceWidth, implementationWidth);
  const height = Math.min(referenceHeight, implementationHeight);
  if (
    width === 0 ||
    height === 0 ||
    (referenceWidth === implementationWidth && referenceHeight === implementationHeight)
  )
    return;

  const [reference, implementation] = await Promise.all([
    sharp(referencePath).extract({ height, left: 0, top: 0, width }).png().toBuffer(),
    sharp(implementationPath).extract({ height, left: 0, top: 0, width }).png().toBuffer(),
  ]);
  await Promise.all([
    writeFile(referencePath, reference),
    writeFile(implementationPath, implementation),
  ]);
}

async function regionOcclusion(page: Page, selector: string): Promise<string | null> {
  return page
    .locator(selector)
    .first()
    .evaluate((root) => {
      const rect = root.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + 2, rect.top + 2);
      if (!hit || hit === root || root.contains(hit)) return null;
      return `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ""}${
        hit.className && typeof hit.className === "string"
          ? `.${hit.className.trim().replace(/\s+/g, ".")}`
          : ""
      }: ${(hit.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 500)}`;
    });
}

type ImageDiagnostics = Awaited<ReturnType<typeof imageDiagnostics>>;

function imageAssetName(source: string): string {
  return decodeURIComponent(new URL(source).pathname.split("/").at(-1) ?? "").replace(/\?.*$/, "");
}

function compareImageDiagnostics(
  reference: ImageDiagnostics,
  implementation: ImageDiagnostics,
  geometryTolerancePx: number,
  assetPolicy: "implementation-original" | "source-match",
): string[] {
  if (assetPolicy === "implementation-original")
    return implementation.flatMap((received, index) => {
      const issues: string[] = [];
      if (received.naturalHeight <= 0 || received.naturalWidth <= 0)
        issues.push(`image[${index}] did not decode at its intrinsic dimensions`);
      if (!received.sha256) issues.push(`image[${index}] could not be hashed`);
      return issues;
    });
  if (assetPolicy === "source-match" && reference.length !== implementation.length)
    return [`Image count: expected ${reference.length}, received ${implementation.length}`];
  return reference.slice(0, implementation.length).flatMap((expected, index) => {
    const received = implementation[index]!;
    const issues: string[] = [];
    if (expected.sha256 !== received.sha256)
      issues.push(
        `image[${index}] bytes: expected ${imageAssetName(expected.currentSrc)} (${expected.sha256}), received ${imageAssetName(received.currentSrc)} (${received.sha256})`,
      );
    for (const property of ["resourceHeight", "resourceWidth"] as const) {
      if (expected[property] !== received[property])
        issues.push(
          `image[${index}] ${property}: expected ${expected[property]}, received ${received[property]}`,
        );
    }
    for (const property of ["height", "width", "x", "y"] as const) {
      if (Math.abs(expected.rect[property] - received.rect[property]) > geometryTolerancePx)
        issues.push(
          `image[${index}] rendered ${property}: expected ${expected.rect[property]}, received ${received.rect[property]}`,
        );
    }
    return issues;
  });
}

export async function captureThemeRouteRegion(options: {
  captureMode?: ThemeAcceptanceMode;
  commit: string;
  density: FidelityDensity;
  implementationOrigin: string;
  outputRoot: string;
  regionId: string;
  routeId: FidelityRouteId;
  sourceOrigin: string;
  viewportId: FidelityMatrixViewportId;
}): Promise<void> {
  const route = themeFidelityMatrix.find(({ id }) => id === options.routeId);
  if (!route) throw new Error(`Unknown fidelity route: ${options.routeId}`);
  const region = route.regions.find(({ id }) => id === options.regionId);
  if (!region) throw new Error(`Unknown fidelity region: ${options.routeId}/${options.regionId}`);
  if (!route.viewports.includes(options.viewportId))
    throw new Error(`${options.routeId} does not declare viewport ${options.viewportId}.`);
  if (!route.densities.includes(options.density))
    throw new Error(`${options.routeId} does not declare DPR ${options.density}.`);
  const captureMode = options.captureMode ?? "static";
  if (
    !captureModePreservesTarget(captureMode, region.sourceSelector) ||
    !captureModePreservesTarget(captureMode, region.implementationSelector)
  )
    throw new Error(
      `${options.routeId}/${options.regionId}: ${captureMode} capture CSS hides the target control.`,
    );

  const viewport = fidelityMatrixViewports[options.viewportId];
  const outputRoot = resolve(
    options.outputRoot,
    options.routeId,
    options.viewportId,
    `dpr-${options.density}`,
    options.regionId,
  );
  await mkdir(outputRoot, { recursive: true });
  const sourceUrl = url(options.sourceOrigin, route.sourcePath);
  const implementationUrl = url(options.implementationOrigin, route.implementationPath);
  const lease = await acquireCaptureLease({
    origins: [sourceUrl, implementationUrl],
    outputRoot,
    requestedWorkers: 2,
  });
  let sourceBrowser: Browser | undefined;
  let implementationBrowser: Browser | undefined;
  const failures: string[] = [];
  try {
    const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined;
    [sourceBrowser, implementationBrowser] = await Promise.all([
      chromium.launch(launchOptions),
      chromium.launch(launchOptions),
    ]);
    const contextOptions = {
      deviceScaleFactor: options.density,
      reducedMotion: captureMode === "temporal" ? "no-preference" : "reduce",
      viewport,
    } as const;
    const [sourceContext, implementationContext] = await Promise.all([
      sourceBrowser.newContext(contextOptions),
      implementationBrowser.newContext(contextOptions),
    ]);
    const [source, implementation] = await Promise.all([
      sourceContext.newPage(),
      implementationContext.newPage(),
    ]);
    if (options.routeId === "fashion-store-checkout") {
      await implementation.route("**/api/**", fulfillFashionStoreCheckoutCaptureApi);
    }
    await source.route("https://via.placeholder.com/**", (route) =>
      route.fulfill({ body: "", contentType: "image/png", status: 204 }),
    );
    const runtimeErrors: string[] = [];
    implementation.on("pageerror", (error) =>
      runtimeErrors.push(`implementation page error: ${error.message}`),
    );
    implementation.on("console", (message) => {
      if (message.type() === "error")
        runtimeErrors.push(`implementation console error: ${message.text()}`);
    });
    try {
      await Promise.all([
        source.goto(sourceUrl, { timeout: 60_000, waitUntil: "domcontentloaded" }),
        implementation.goto(implementationUrl, {
          timeout: 60_000,
          waitUntil: "domcontentloaded",
        }),
      ]);
      await hydrateSourcePlaceholderImages(source);
      await Promise.all([stabilize(source, captureMode), stabilize(implementation, captureMode)]);
      source.on("pageerror", (error) => runtimeErrors.push(`source page error: ${error.message}`));
      source.on("console", (message) => {
        if (message.type() === "error")
          runtimeErrors.push(`source console error: ${message.text()}`);
      });
      if (options.routeId === "fashion-store-product")
        await Promise.all([
          stabilizeProductGallery(source, true),
          stabilizeProductGallery(implementation, false),
        ]);
      const decorHomeFullPage =
        options.routeId === "decor-home" && options.regionId === "full-page";
      const fashionStoreHomeFullPage =
        options.routeId === "fashion-store-home" && options.regionId === "full-page";
      const fashionStoreAboutFullPage =
        options.routeId === "fashion-store-about" && options.regionId === "full-page";
      if (options.routeId === "fashion-store-about")
        await Promise.all([source.waitForTimeout(1_600), implementation.waitForTimeout(1_600)]);
      if (
        options.routeId === "fashion-store-home" &&
        (options.regionId === "hero" || fashionStoreHomeFullPage)
      )
        await Promise.all([
          stabilizeFashionStoreHero(source, true),
          stabilizeFashionStoreHero(implementation, false),
        ]);
      if (
        options.routeId === "fashion-store-home" &&
        (options.regionId === "marquee" || fashionStoreHomeFullPage)
      )
        await Promise.all([
          stabilizeFashionStoreMarquee(source, true),
          stabilizeFashionStoreMarquee(implementation, false),
        ]);
      if (
        options.routeId === "fashion-store-about" &&
        (options.regionId === "carousel" || fashionStoreAboutFullPage)
      )
        await Promise.all([
          stabilizeFashionStoreAboutCarousel(source, true),
          stabilizeFashionStoreAboutCarousel(implementation, false),
        ]);
      if (
        options.routeId === "fashion-store-about" &&
        (options.regionId === "mission" || fashionStoreAboutFullPage)
      )
        await Promise.all([
          stabilizeFashionStoreAboutBrands(source, true),
          stabilizeFashionStoreAboutBrands(implementation, false),
        ]);
      if (options.routeId === "decor-home" && (options.regionId === "hero" || decorHomeFullPage))
        await Promise.all([
          stabilizeDecorHero(source, true),
          stabilizeDecorHero(implementation, false),
        ]);
      if (options.routeId === "decor-home" && (options.regionId === "marquee" || decorHomeFullPage))
        await Promise.all([
          stabilizeDecorMarquee(source, true),
          stabilizeDecorMarquee(implementation, false),
        ]);
      if (
        options.routeId === "decor-home" &&
        (options.regionId === "collection" || decorHomeFullPage)
      )
        await Promise.all([
          stabilizeDecorCollection(source, true),
          stabilizeDecorCollection(implementation, false),
        ]);
      if (options.routeId === "decor-home" && (options.regionId === "clients" || decorHomeFullPage))
        await Promise.all([
          stabilizeDecorClients(source, true),
          stabilizeDecorClients(implementation, false),
        ]);
      if (decorHomeFullPage) await alignDecorHomeFullPageSections(source, implementation);
      for (const [label, page] of [
        ["source", source],
        ["implementation", implementation],
      ] as const) {
        const overlay = page.locator("vite-error-overlay");
        if (await overlay.count()) {
          const message = await overlay.evaluate(
            (element) => element.shadowRoot?.textContent?.replace(/\s+/g, " ").trim() ?? "",
          );
          runtimeErrors.push(`${label} Vite error overlay: ${message}`);
        }
      }
      failures.push(...runtimeErrors);
      const fullPage = region.kind === "full-page-smoke";
      const compareComputedStyles = region.kind === "component" || region.kind === "control";
      const commonProbe = {
        content: false,
        geometry: true,
        id: region.id,
        ...(compareComputedStyles
          ? {
              pseudoStyles: { after: pseudoStyleProperties, before: pseudoStyleProperties },
              styles: computedStyleProperties,
              textLayout: true,
            }
          : {}),
      } satisfies Omit<SourceContractProbe, "selector">;
      const rootProbe = {
        content: false,
        geometry: true,
        id: `${region.id}-root`,
        pseudoStyles: { after: pseudoStyleProperties, before: pseudoStyleProperties },
        styles: computedStyleProperties,
        textLayout: false,
      } satisfies Omit<SourceContractProbe, "selector">;
      const referenceProbes = fullPage
        ? []
        : [
            { ...commonProbe, selector: region.sourceProbeSelector ?? region.sourceSelector },
            ...(region.probeRootStyles ? [{ ...rootProbe, selector: region.sourceSelector }] : []),
          ];
      const implementationProbes = fullPage
        ? []
        : [
            {
              ...commonProbe,
              selector: region.implementationProbeSelector ?? region.implementationSelector,
            },
            ...(region.probeRootStyles
              ? [{ ...rootProbe, selector: region.implementationSelector }]
              : []),
          ];
      const [rawReferenceContract, rawImplementationContract] = await Promise.all([
        captureSourceContract(source, referenceProbes),
        captureSourceContract(implementation, implementationProbes),
      ]);
      const [referenceOrigin, implementationOrigin] = fullPage
        ? [
            { left: 0, top: 0 },
            { left: 0, top: 0 },
          ]
        : await Promise.all([
            source
              .locator(region.sourceSelector)
              .first()
              .evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return { left: rect.left, top: rect.top };
              }),
            implementation
              .locator(region.implementationSelector)
              .first()
              .evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return { left: rect.left, top: rect.top };
              }),
          ]);
      const referenceContract = localizeContract(rawReferenceContract, referenceOrigin);
      const implementationContract = localizeContract(
        rawImplementationContract,
        implementationOrigin,
      );
      failures.push(
        ...compareSourceContractSnapshots(referenceContract, implementationContract, {
          fullPageHeightRatio: fullPage ? 0.005 : 1,
          geometryPx: region.geometryTolerancePx,
          styleEquivalences: region.styleEquivalences ?? {},
        }),
      );

      const [referenceImages, implementationImages] = fullPage
        ? [[], []]
        : await Promise.all([
            imageDiagnostics(source, region.sourceSelector),
            imageDiagnostics(implementation, region.implementationSelector),
          ]);
      if (!fullPage)
        failures.push(
          ...compareImageDiagnostics(
            referenceImages,
            implementationImages,
            region.geometryTolerancePx,
            region.imageAssetPolicy ?? "source-match",
          ),
        );
      if (region.neutralizeImagePixels) {
        const neutralize = (selector: string) =>
          region.imageAssetPolicy === "implementation-original"
            ? `${selector}, ${selector} * { background-image: none !important; } ${selector} img { visibility: hidden !important; }`
            : `${selector} img { filter: brightness(0) !important; opacity: 1 !important; }`;
        await source.addStyleTag({ content: neutralize(region.sourceSelector) });
        await implementation.addStyleTag({ content: neutralize(region.implementationSelector) });
        if (options.routeId === "decor-home" && options.regionId === "collection")
          await implementation.addStyleTag({
            content: ".decor-collection-product { background-color: transparent !important; }",
          });
      }
      if (!fullPage)
        await Promise.all([
          source.addStyleTag({
            content: `.sticky-wrap, .scroll-progress${region.id === "cookie" ? "" : ", .cookie-message"} { visibility: hidden !important; }${region.id === "header" ? "" : " header { display: none !important; }"}`,
          }),
          implementation.addStyleTag({
            content: `.sticky-wrap, .scroll-progress, .decor-sticky-actions, .decor-scroll-progress${region.id === "cookie" ? "" : ", .cookie-message"} { visibility: hidden !important; }${region.id === "header" ? "" : " header { display: none !important; }"}`,
          }),
        ]);
      const mutuallyHidden =
        region.kind !== "full-page-smoke" &&
        !(await source.locator(region.sourceSelector).first().isVisible()) &&
        !(await implementation.locator(region.implementationSelector).first().isVisible());

      if (region.kind !== "full-page-smoke" && !mutuallyHidden) {
        const [sourceOcclusion, implementationOcclusion] = await Promise.all([
          regionOcclusion(source, region.sourceSelector),
          regionOcclusion(implementation, region.implementationSelector),
        ]);
        if (region.allowExpectedTopOcclusion) {
          if (Boolean(sourceOcclusion) !== Boolean(implementationOcclusion))
            failures.push(
              `Expected symmetric top occlusion, received source=${Boolean(sourceOcclusion)} implementation=${Boolean(implementationOcclusion)}`,
            );
        } else {
          if (sourceOcclusion) failures.push(`source region occluded by ${sourceOcclusion}`);
          if (implementationOcclusion)
            failures.push(`implementation region occluded by ${implementationOcclusion}`);
        }
        if (region.allowExpectedTopOcclusion)
          await Promise.all([
            source.addStyleTag({
              content: "header { opacity: 0 !important; }",
            }),
            implementation.addStyleTag({
              content: ".decor-header { opacity: 0 !important; }",
            }),
          ]);
      }

      if (region.kind !== "full-page-smoke" && !mutuallyHidden) {
        await Promise.all([
          settleRegionInViewport(source, region.sourceSelector),
          settleRegionInViewport(implementation, region.implementationSelector),
        ]);
        const sourceSlideEffects = source.locator(
          `${region.sourceSelector}[data-anime*='"effect": "slide"'], ${region.sourceSelector} [data-anime*='"effect": "slide"']`,
        );
        if ((await sourceSlideEffects.count()) > 0) {
          await source.waitForTimeout(2_100);
          await sourceSlideEffects.evaluateAll((elements) => {
            for (const element of elements as HTMLElement[]) {
              element.style.setProperty("background", "transparent", "important");
              element
                .querySelectorAll<HTMLElement>(":scope > div:not([class])")
                .forEach((overlay) => overlay.remove());
              element.querySelectorAll<HTMLElement>("img").forEach((image) => {
                image.style.setProperty("clip-path", "none", "important");
                image.style.setProperty("opacity", "1", "important");
                image.style.setProperty("transform", "none", "important");
                image.style.setProperty("visibility", "visible", "important");
              });
            }
          });
        }
        await Promise.all(
          [source, implementation].map((page) =>
            page.locator(".animation-rotation").evaluateAll((elements) => {
              for (const element of elements as HTMLElement[])
                element.style.setProperty("display", "none", "important");
            }),
          ),
        );
        if (options.routeId === "fashion-store-about")
          await Promise.all([
            source
              .locator("section:nth-of-type(6) .w-75.position-relative > [data-bottom-top]")
              .evaluateAll((elements) => {
                for (const element of elements as HTMLElement[])
                  element.style.setProperty("display", "none", "important");
              }),
            implementation.locator(".fashion-about-mission-seal").evaluateAll((elements) => {
              for (const element of elements as HTMLElement[])
                element.style.setProperty("display", "none", "important");
            }),
          ]);
        if (options.routeId === "fashion-store-contact" && region.id === "map")
          await Promise.all([
            source.locator(`${region.sourceSelector} .video-icon-box`).evaluateAll((elements) => {
              for (const element of elements as HTMLElement[])
                element.style.setProperty("visibility", "hidden", "important");
            }),
            implementation
              .locator(`${region.implementationSelector} .fashion-contact-marker`)
              .evaluateAll((elements) => {
                for (const element of elements as HTMLElement[])
                  element.style.setProperty("visibility", "hidden", "important");
              }),
          ]);
        await Promise.all([
          normalizeRegionFractionalOrigin(source, region.sourceSelector),
          normalizeRegionFractionalOrigin(implementation, region.implementationSelector),
        ]);
        if (options.routeId === "fashion-store-home" && region.id === "collection")
          await Promise.all(
            [
              [source, region.sourceSelector],
              [implementation, region.implementationSelector],
            ].map(([page, selector]) =>
              (page as Page)
                .locator(`${selector as string} .image-content .mt-auto`)
                .evaluateAll((elements) => {
                  for (const element of elements as HTMLElement[]) {
                    const title = element.querySelector<HTMLElement>(".fs-22");
                    if (!title) continue;
                    const slide = element.closest<HTMLElement>(".swiper-slide");
                    const track = element.closest<HTMLElement>(".swiper-wrapper");
                    slide?.style.setProperty("transform", "none", "important");
                    slide?.style.setProperty("will-change", "auto", "important");
                    track?.style.setProperty("transform", "none", "important");
                    track?.style.setProperty("will-change", "auto", "important");
                    const rect = title.getBoundingClientRect();
                    if (getComputedStyle(element).position === "static")
                      element.style.position = "relative";
                    element.style.top = `${Math.round(rect.top) - rect.top}px`;
                  }
                }),
            ),
          );
        if (region.normalizeFractionalCaptureHeight)
          await Promise.all([
            normalizeRegionCaptureHeight(source, region.sourceSelector),
            normalizeRegionCaptureHeight(implementation, region.implementationSelector),
          ]);
      }

      const captureBounds =
        region.kind === "full-page-smoke"
          ? undefined
          : {
              implementation: await implementation
                .locator(region.implementationSelector)
                .first()
                .evaluate((element) => {
                  const rect = element.getBoundingClientRect();
                  return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
                }),
              reference: await source
                .locator(region.sourceSelector)
                .first()
                .evaluate((element) => {
                  const rect = element.getBoundingClientRect();
                  return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
                }),
            };

      const referencePath = join(outputRoot, "reference.png");
      const implementationPath = join(outputRoot, "implementation.png");
      if (region.kind === "full-page-smoke") {
        // Decor home already has an independently hash-checked, source-matching asset set.
        // Comparing its real pixels avoids creating false differences between source CSS
        // backgrounds and equivalent implementation <img> layers. Secondary source demos
        // still contain external placeholders, so those routes keep the layout-only mask.
        if (options.routeId !== "decor-home") {
          const neutralizeFullPageImages =
            "body img { filter: brightness(0) !important; opacity: 1 !important; }";
          await Promise.all([
            source.addStyleTag({ content: neutralizeFullPageImages }),
            implementation.addStyleTag({ content: neutralizeFullPageImages }),
          ]);
        }
        await source.screenshot({ animations: "disabled", fullPage: true, path: referencePath });
        await implementation.screenshot({
          animations: "disabled",
          fullPage: true,
          path: implementationPath,
        });
      } else if (mutuallyHidden) {
        const transparentPixel = await sharp({
          create: {
            background: { alpha: 0, b: 0, g: 0, r: 0 },
            channels: 4,
            height: 1,
            width: 1,
          },
        })
          .png()
          .toBuffer();
        await Promise.all([
          writeFile(referencePath, transparentPixel),
          writeFile(implementationPath, transparentPixel),
        ]);
      } else {
        if (!captureBounds) throw new Error("Regional capture bounds were not measured.");
        await captureRegionScreenshot(
          implementation,
          region.implementationSelector,
          implementationPath,
        );
        await captureRegionScreenshot(source, region.sourceSelector, referencePath);
        await normalizeEquivalentRegionScreenshotDimensions(
          referencePath,
          implementationPath,
          options.density,
          captureBounds,
        );
      }
      const difference = await compareThemeScreenshots(
        referencePath,
        implementationPath,
        join(outputRoot, "difference.png"),
        16,
        {
          cropsDirectory: join(outputRoot, "diagnostics"),
          emitWhenChangedPixelRatioExceeds: region.maxChangedPixelRatio,
          heatmapPath: join(outputRoot, "heatmap.png"),
          maximumCrops: 3,
        },
      );
      try {
        assertThemeScreenshotDifference(difference, region.maxChangedPixelRatio);
      } catch (error) {
        failures.push((error as Error).message);
      }
      const layoutDiagnostics = fullPage
        ? {
            implementation: await fullPageLayoutDiagnostics(
              implementation,
              options.routeId,
              "implementation",
            ),
            reference: await fullPageLayoutDiagnostics(source, options.routeId, "reference"),
          }
        : undefined;
      await writeFile(
        join(outputRoot, "report.json"),
        `${JSON.stringify(
          {
            capturedAt: new Date().toISOString(),
            captureBounds,
            captureMode,
            commit: options.commit,
            contract: { implementation: implementationContract, reference: referenceContract },
            density: options.density,
            difference,
            failures,
            images: { implementation: implementationImages, reference: referenceImages },
            implementationUrl,
            layoutDiagnostics,
            region,
            route: options.routeId,
            sourceUrl,
            viewport: { id: options.viewportId, ...viewport },
          },
          null,
          2,
        )}\n`,
      );
    } finally {
      await Promise.allSettled([source.close(), implementation.close()]);
      await Promise.allSettled([sourceContext.close(), implementationContext.close()]);
    }
  } finally {
    await Promise.allSettled([sourceBrowser?.close(), implementationBrowser?.close()]);
    await lease.release();
  }
  if (failures.length > 0)
    throw new Error(
      `${options.routeId}/${options.regionId} fidelity failed:\n${failures.join("\n")}`,
    );
}

if (import.meta.main) {
  const arguments_ = Bun.argv.slice(2);
  const routeId = argumentValue(arguments_, "--route") as FidelityRouteId | undefined;
  const regionId = argumentValue(arguments_, "--region");
  const viewportId = argumentValue(arguments_, "--viewport") as
    FidelityMatrixViewportId | undefined;
  const density = Number(argumentValue(arguments_, "--dpr") ?? "1") as FidelityDensity;
  const sourceOrigin = argumentValue(arguments_, "--source-origin");
  const implementationOrigin = argumentValue(arguments_, "--implementation-origin");
  const outputRoot = argumentValue(arguments_, "--output");
  const commit = argumentValue(arguments_, "--commit");
  const captureMode = (argumentValue(arguments_, "--mode") ?? "static") as ThemeAcceptanceMode;
  if (
    !routeId ||
    !regionId ||
    !viewportId ||
    !sourceOrigin ||
    !implementationOrigin ||
    !outputRoot ||
    !commit
  )
    throw new Error(
      "Usage: bun tools/capture-theme-route-region.ts --route=<id> --region=<id> --viewport=<id> --dpr=<1|2> --source-origin=<url> --implementation-origin=<url> --output=<path> --commit=<sha>",
    );
  await captureThemeRouteRegion({
    commit,
    captureMode,
    density,
    implementationOrigin,
    outputRoot,
    regionId,
    routeId,
    sourceOrigin,
    viewportId,
  });
}
