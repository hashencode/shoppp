import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import sharp from "../apps/storefront/node_modules/sharp";
import {
  fashionStoreNamedStates,
  namedStatePixelThreshold,
  type NamedStateAction,
  type NamedStateContract,
} from "../apps/storefront/e2e/support/theme-named-state-contract";
import {
  captureGeometryIssues,
  captureCssForMode,
  captureModeForNamedState,
} from "../apps/storefront/e2e/support/theme-capture-contract";
import type { ThemeAcceptanceMode } from "../apps/storefront/e2e/support/theme-behavior-contract";
import { themeViewports } from "../apps/storefront/e2e/support/theme-viewports";
import {
  assertThemeScreenshotDifference,
  compareThemeScreenshots,
} from "../apps/storefront/scripts/compare-theme-screenshots";
import { acquireCaptureLease } from "./theme-capture-resource-guard";

interface Box {
  height: number;
  pageX: number;
  pageY: number;
  width: number;
  x: number;
  y: number;
}

export function fashionNamedStateHeroHeight(viewport: {
  height: number;
  width: number;
}): number {
  return viewport.width >= 992 ? viewport.height : viewport.width >= 576 ? 600 : 500;
}

export function fashionCollectionNavigationKeys(
  currentIndex: number,
  targetIndex: number,
): ("ArrowLeft" | "ArrowRight")[] {
  return [
    ...Array.from({ length: Math.max(0, currentIndex) }, () => "ArrowLeft" as const),
    ...Array.from({ length: Math.max(0, targetIndex) }, () => "ArrowRight" as const),
  ];
}

export function namedStateFractionalOriginOffset(value: number): number {
  return Math.floor(value) - value;
}

const namedStateCss = (mode: ThemeAcceptanceMode) =>
  captureCssForMode(mode).replace(
    "#cookies-model, .cookie-message, .scroll-progress,",
    ".scroll-progress,",
  ) +
  `
  ${mode === "scroll-fixed" ? "" : ".fashion-scroll-progress { display: none !important; }"}
  .fashion-promises-track {
    animation: none !important;
    margin-left: 0 !important;
    transform: none !important;
  }
  ${mode === "scroll-fixed" ? "" : ".sticky-wrap { display: none !important; }"}
  .capture-cookie-overlay #cookies-model,
  .capture-cookie-overlay .fashion-cookie-message {
    display: block !important;
    opacity: 1 !important;
    transform: none !important;
    visibility: visible !important;
  }
  *:focus { outline: none !important; }
`;

async function installNamedStateCss(page: Page, mode: ThemeAcceptanceMode): Promise<void> {
  await page.evaluate(
    ({ css, id }) => {
      let style = document.querySelector<HTMLStyleElement>(`#${id}`);
      if (!style) {
        style = document.createElement("style");
        style.id = id;
        document.head.append(style);
      }
      style.textContent = css;
    },
    { css: namedStateCss(mode), id: "theme-named-state-capture-css" },
  );
}

async function fashionStoreSourceFontCss(): Promise<string> {
  const fontsRoot = resolve(
    import.meta.dir,
    "../apps/storefront/app/themes/fashion-store/upstream/fonts",
  );
  const [figtree, outfit] = await Promise.all([
    readFile(join(fontsRoot, "figtree-latin.woff2")),
    readFile(join(fontsRoot, "outfit-latin.woff2")),
  ]);
  return `
    @font-face {
      font-family: "Figtree";
      font-style: normal;
      font-weight: 300 800;
      font-display: block;
      src: url("data:font/woff2;base64,${figtree.toString("base64")}") format("woff2");
    }
    @font-face {
      font-family: "Outfit";
      font-style: normal;
      font-weight: 300 900;
      font-display: block;
      src: url("data:font/woff2;base64,${outfit.toString("base64")}") format("woff2");
    }
  `;
}

async function stabilize(page: Page): Promise<void> {
  await page.addStyleTag({ content: namedStateCss("temporal") });
  await page.evaluate(async () => {
    document.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      image.loading = "eager";
    });
    if ("fonts" in document) await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
    document.querySelectorAll<HTMLElement>(".swiper").forEach((element) => {
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
    scrollTo(0, 0);
  });
  await page.waitForTimeout(250);
}

async function hydrateFashionSourceImages(page: Page): Promise<void> {
  await page.evaluate(() => {
    const placeholders = [...document.querySelectorAll<HTMLImageElement>("img")].filter((image) =>
      image.src.includes("via.placeholder.com/600x765"),
    );
    const groups = [
      placeholders.filter((image) => image.closest(".shop-modern")),
      placeholders.filter((image) => image.classList.contains("cart-thumb")),
    ];
    const grouped = new Set(groups.flat());
    groups.push(placeholders.filter((image) => !grouped.has(image)));
    for (const group of groups)
      group.forEach((image, index) => {
        image.src = new URL(
          `images/demo-fashion-store-product-${String((index % 12) + 1).padStart(2, "0")}.jpg`,
          location.href,
        ).href;
      });
  });
}

async function normalizeNamedStateHeroHeight(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Fashion named-state capture requires a fixed viewport.");
  const targetHeight = fashionNamedStateHeroHeight(viewport);
  await page.locator(".swiper.full-screen").evaluate((element, height) => {
    (element as HTMLElement).style.setProperty("height", `${height}px`, "important");
    element.querySelectorAll<HTMLElement>(".swiper-slide").forEach((slide) => {
      slide.style.setProperty("height", `${height}px`, "important");
    });
  }, targetHeight);
}

async function prepareFashionPages(source: Page, implementation: Page): Promise<void> {
  await implementation.waitForFunction(() =>
    Boolean(
      (document.querySelector("#__nuxt") as (HTMLElement & { __vue_app__?: unknown }) | null)
        ?.__vue_app__,
    ),
    undefined,
    { timeout: 60_000 },
  );
  await implementation.waitForFunction(
    () => {
      const status = document
        .querySelector("[data-fashion-store-source-parity]")
        ?.getAttribute("data-runtime-status");
      return status === "ready" || status === "static";
    },
    undefined,
    { timeout: 60_000 },
  );
  await source.waitForFunction(() =>
    [...document.querySelectorAll<HTMLElement>(".swiper")].every((element) =>
      Boolean((element as HTMLElement & { swiper?: unknown }).swiper),
    ),
    undefined,
    { timeout: 60_000 },
  );
  await hydrateFashionSourceImages(source);
  await Promise.all([stabilize(source), stabilize(implementation)]);
  await Promise.all([
    normalizeNamedStateHeroHeight(source),
    normalizeNamedStateHeroHeight(implementation),
  ]);
}

async function resetFashion(page: Page, side: "implementation" | "source"): Promise<void> {
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape").catch(() => undefined);
  if (side === "implementation") {
    const openMenu = page.locator(".fashion-mobile-menu[open]");
    if (await openMenu.count()) await openMenu.locator(":scope > summary").click();
    const firstSlide = page.getByRole("button", { name: "Show slide 1" });
    if (await firstSlide.count()) await firstSlide.click();
    const collection = page.locator(".fashion-collection-rail");
    if (await collection.count()) {
      const activeIndex = Number(await collection.getAttribute("data-motion-active-index"));
      if (Number.isInteger(activeIndex) && activeIndex > 0) {
        await collection.focus();
        for (let index = 0; index < activeIndex; index += 1) await page.keyboard.press("ArrowLeft");
      }
    }
  } else {
    await page.evaluate(() => {
      document.documentElement.classList.remove("show-search-popup");
      document.body.classList.remove("show-search-popup");
      document.querySelector(".header-cart")?.classList.remove("open");
      document
        .querySelectorAll<HTMLElement>(".dropdown.show, .dropdown-menu.show")
        .forEach((node) => node.classList.remove("show"));
      document.querySelectorAll<HTMLElement>(".swiper").forEach((element) => {
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
    });
  }
  await page.waitForTimeout(50);
}

async function applyFashionAction(
  page: Page,
  side: "implementation" | "source",
  action: NamedStateAction,
  viewportWidth: number,
): Promise<void> {
  await resetFashion(page, side);
  if (action.kind === "initial") return;
  if (action.kind === "hero") {
    if (side === "source") {
      await page.locator(".swiper.full-screen").evaluate((element, index) => {
        (
          element as HTMLElement & { swiper?: { slideToLoop?(index: number, speed: number): void } }
        ).swiper?.slideToLoop?.(index, 0);
      }, action.index);
    } else {
      await page.getByRole("button", { name: `Show slide ${action.index + 1}` }).click();
      await page.locator(".fashion-hero").waitFor({ state: "visible" });
      await page.waitForFunction(
        (index) =>
          document.querySelector(".fashion-hero")?.getAttribute("data-motion-active-index") ===
            String(index) &&
          document.querySelector(".fashion-hero")?.getAttribute("data-motion-phase") === "idle",
        action.index,
      );
    }
  } else if (action.kind === "collection") {
    if (side === "source") {
      await page.locator(".swiper.slider-three-slide").evaluate((element, index) => {
        (
          element as HTMLElement & { swiper?: { slideToLoop?(index: number, speed: number): void } }
        ).swiper?.slideToLoop?.(index, 0);
      }, action.index);
    } else {
      const rail = page.locator(".fashion-collection-rail");
      await rail.focus();
      for (let index = 0; index < action.index; index += 1) await page.keyboard.press("ArrowRight");
      await page.waitForFunction(
        (index) =>
          document
            .querySelector(".fashion-collection-rail")
            ?.getAttribute("data-motion-active-index") === String(index),
        action.index,
      );
    }
  } else if (action.kind === "navigation") {
    const menu = action.menu ?? "Shop";
    if (viewportWidth >= 992) {
      if (side === "source") {
        const sourceMenu =
          menu === "Pages"
            ? page.locator(".navbar-right .nav-item.dropdown").first()
            : page.locator(".navbar-left .nav-item.dropdown").nth(menu === "Collection" ? 1 : 0);
        await sourceMenu.hover();
      } else {
        await page.getByRole("button", { name: `Open ${menu} menu` }).hover();
      }
    } else if (side === "source") {
      await page.evaluate((menuLabel) => {
        document.querySelector("#navbarNav")?.classList.add("show");
        if (!menuLabel) return;
        const dropdowns = [...document.querySelectorAll<HTMLElement>(".navbar .nav-item.dropdown")];
        const index = menuLabel === "Shop" ? 0 : menuLabel === "Collection" ? 1 : 2;
        const dropdown = dropdowns[index];
        dropdown?.classList.add("show");
        dropdown?.querySelector<HTMLElement>(".dropdown-menu")?.classList.add("show");
      }, menu);
    } else {
      await page.locator(".fashion-mobile-menu > summary").click();
      await page.getByRole("button", { name: `Open ${menu} mobile menu` }).click();
    }
  } else if (action.kind === "search") {
    if (side === "source") await page.locator(".header-search-form").click();
    else await page.getByRole("button", { name: "Search" }).click();
    await page.waitForTimeout(650);
  } else if (action.kind === "cart") {
    if (side === "source") {
      await page.locator(".header-cart").evaluate((element) => element.classList.add("open"));
    } else {
      await page.getByRole("button", { name: "Preview bag", exact: true }).hover();
    }
  } else if (action.kind === "overlay") {
    return;
  } else if (action.kind === "product-hover") {
    const selector =
      side === "source" ? ".shop-modern .grid-item .shop-image" : ".fashion-product-media";
    await page.locator(selector).first().hover();
  } else if (action.kind === "product-focus") {
    if (side === "source") {
      await page.locator(".shop-modern .grid-item .shop-image").first().hover();
    } else {
      await page.locator('.fashion-product-card button[aria-label^="Save"]').first().focus();
    }
  } else if (action.kind === "collection-hover") {
    const selector =
      side === "source"
        ? ".swiper.slider-three-slide .swiper-slide-active"
        : ".fashion-collection-track article";
    await page.locator(selector).first().hover();
  } else if (action.kind === "collection-card") {
    await page.locator(".categories-style-02").first().hover();
  } else if (action.kind === "pause") {
    const selector = side === "source" ? "section:nth-of-type(9)" : ".fashion-promises";
    await page.locator(selector).hover();
    if (side === "source") {
      await page.locator(".swiper-width-auto").evaluate((element) => {
        (
          element as HTMLElement & { swiper?: { autoplay?: { stop(): void } } }
        ).swiper?.autoplay?.stop();
      });
    }
  }
  await page.waitForTimeout(100);
}

async function applyFashionStoreAction(
  page: Page,
  side: "implementation" | "source",
  action: NamedStateAction,
  viewportWidth: number,
): Promise<void> {
  if (side === "source") {
    if (action.kind !== "product-focus")
      return applyFashionAction(page, side, action, viewportWidth);
    await resetFashion(page, side);
    const product = page.locator(".shop-modern .grid-item .shop-image").first();
    await product.hover();
    await product.locator('[aria-label="Add to wishlist"]').focus();
    await page.waitForTimeout(100);
    return;
  }
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.evaluate(() => {
    document.documentElement.classList.remove("show-search-popup");
    document.body.classList.remove("show-search-popup");
    document.querySelector(".header-cart")?.classList.remove("open");
  });
  const toggle = page.locator(".navbar-toggler");
  if ((await toggle.getAttribute("aria-expanded")) === "true") await toggle.click();
  const waitForHeroIdle = () =>
    page.waitForFunction(
      () =>
        document.querySelector(".swiper.full-screen")?.getAttribute("data-motion-phase") === "idle",
    );
  await waitForHeroIdle();
  const firstSlide = page.getByRole("button", { name: "Show slide 1" });
  if (await firstSlide.count()) {
    await firstSlide.evaluate((button) => (button as HTMLButtonElement).click());
    await waitForHeroIdle();
  }
  const collection = page.locator(".swiper.slider-three-slide");
  await collection.evaluate((element) => {
    element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
  });
  const currentCollectionIndex = Number(await collection.getAttribute("data-collection-index"));
  const targetCollectionIndex = action.kind === "collection" ? action.index : 0;
  if (Number.isInteger(currentCollectionIndex)) {
    let expectedIndex = currentCollectionIndex;
    for (const key of fashionCollectionNavigationKeys(
      currentCollectionIndex,
      targetCollectionIndex,
    )) {
      await collection.press(key);
      expectedIndex += key === "ArrowLeft" ? -1 : 1;
      await page.waitForFunction(
        (expected) =>
          document
            .querySelector(".swiper.slider-three-slide")
            ?.getAttribute("data-collection-index") === String(expected),
        expectedIndex,
      );
    }
  }
  if (action.kind === "initial") return;
  if (action.kind === "hero") {
    await page
      .getByRole("button", { name: `Show slide ${action.index + 1}` })
      .evaluate((button) => (button as HTMLButtonElement).click());
    await waitForHeroIdle();
  } else if (action.kind === "collection") {
    await page.waitForFunction(
      (index) =>
        document
          .querySelector(".swiper.slider-three-slide")
          ?.getAttribute("data-collection-index") === String(index),
      action.index,
    );
  } else if (action.kind === "navigation") {
    const menu = action.menu ?? "Shop";
    if (viewportWidth >= 992) {
      const dropdown =
        menu === "Pages"
          ? page.locator(".navbar-right .nav-item.dropdown").first()
          : page.locator(".navbar-left .nav-item.dropdown").nth(menu === "Collection" ? 1 : 0);
      await dropdown.hover();
      await page.waitForFunction(
        (element) => element.classList.contains("open"),
        await dropdown.elementHandle(),
      );
    } else {
      await toggle.click();
      await page.evaluate((menuLabel) => {
        document.querySelector("#navbarNav")?.classList.add("show");
        const dropdowns = [...document.querySelectorAll<HTMLElement>(".navbar .nav-item.dropdown")];
        const index = menuLabel === "Shop" ? 0 : menuLabel === "Collection" ? 1 : 2;
        dropdowns[index]?.classList.add("open", "show");
        dropdowns[index]?.querySelector<HTMLElement>(".dropdown-menu")?.classList.add("show");
      }, menu);
    }
  } else if (action.kind === "search") {
    await page.locator(".header-search-form").click();
    await page.waitForTimeout(650);
  } else if (action.kind === "cart") {
    await page.locator(".header-cart").hover();
    await page.waitForFunction(() =>
      document.querySelector(".header-cart")?.classList.contains("open"),
    );
  } else if (action.kind === "product-hover") {
    await page.locator(".shop-modern .grid-item .shop-image").first().hover();
  } else if (action.kind === "product-focus") {
    const product = page.locator(".shop-modern .grid-item .shop-image").first();
    await product.hover();
    await product.getByRole("button", { name: "Add to wishlist" }).focus();
  } else if (action.kind === "collection-card") {
    await page.locator(".categories-style-02").first().hover();
  } else if (action.kind === "pause") {
    await page.locator("section:nth-of-type(9)").hover();
    await page.locator(".swiper-width-auto").evaluate((element) => {
      (
        element as HTMLElement & { swiper?: { autoplay?: { stop(): void } } }
      ).swiper?.autoplay?.stop();
    });
  }
  await page.waitForTimeout(100);
}

async function box(page: Page, selector: string): Promise<Box> {
  const locator = page.locator(selector).first();
  await locator.evaluate((element) => {
    if (getComputedStyle(element).position === "fixed") return;
    const rect = element.getBoundingClientRect();
    const visibleHeight = Math.min(rect.height, innerHeight);
    const top = scrollY + rect.top - (innerHeight - visibleHeight) / 2;
    scrollTo({ behavior: "instant", left: scrollX, top: Math.floor(Math.max(0, top)) });
  });
  const value = await locator.boundingBox();
  if (!value || value.width <= 0 || value.height <= 0)
    throw new Error(`Named-state selector is not visible: ${selector}`);
  const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  return { ...value, pageX: value.x + scroll.x, pageY: value.y + scroll.y };
}

function geometryIssues(state: NamedStateContract, reference: Box, implementation: Box): string[] {
  return captureGeometryIssues(
    state.id,
    reference,
    implementation,
    state.capture === "viewport-top" || state.id === "cookie-overlay" ? "viewport" : "document",
  );
}

function visibleRegion(boxValue: Box, viewport: { height: number; width: number }) {
  const left = Math.max(0, Math.floor(boxValue.x));
  const top = Math.max(0, Math.floor(boxValue.y));
  const right = Math.min(viewport.width, Math.ceil(boxValue.x + boxValue.width));
  const bottom = Math.min(viewport.height, Math.ceil(boxValue.y + boxValue.height));
  return { height: bottom - top, left, top, width: right - left };
}

async function captureVisibleElement(
  page: Page,
  region: ReturnType<typeof visibleRegion>,
  dimensions: { height: number; width: number },
  path: string,
): Promise<void> {
  const screenshot = await page.screenshot({ animations: "disabled" });
  await sharp(screenshot)
    .extract({
      height: dimensions.height,
      left: region.left,
      top: region.top,
      width: dimensions.width,
    })
    .png()
    .toFile(path);
}

async function normalizeNamedStateFractionalOrigin(page: Page, selector: string): Promise<void> {
  const locator = page.locator(selector).first();
  const origin = await locator.evaluate(async (element: HTMLElement) => {
    const isCollectionRail = element.matches(".swiper.slider-three-slide");
    if (isCollectionRail) {
      const track = element.querySelector<HTMLElement>(".swiper-wrapper");
      track?.style.setProperty("gap", "30px", "important");
      track?.style.setProperty("will-change", "transform", "important");
      element.querySelectorAll<HTMLElement>(".swiper-slide").forEach((slide) => {
        slide.style.setProperty("backface-visibility", "visible", "important");
        slide.style.setProperty("margin-right", "0", "important");
        slide.style.setProperty("transform", "none", "important");
      });
      element
        .querySelectorAll<HTMLElement>(".interactive-banner-style-09")
        .forEach((card) => {
          card.style.setProperty("transform", "translate3d(0, 0, 0)", "important");
        });
      await new Promise<void>((resolvePromise) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolvePromise())),
      );
      return null;
    }
    if (element.tagName === "FOOTER") return null;
    element.style.translate = "none";
    await new Promise<void>((resolvePromise) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolvePromise())),
    );
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top };
  });
  if (!origin) return;
  const offset = {
    x: namedStateFractionalOriginOffset(origin.left),
    y: namedStateFractionalOriginOffset(origin.top),
  };
  await locator.evaluate(async (element: HTMLElement, translate) => {
    element.style.translate = `${translate.x}px ${translate.y}px`;
    await new Promise<void>((resolvePromise) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolvePromise())),
    );
  }, offset);
}

async function marqueeDiagnostics(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector("section:nth-of-type(9)");
    const track = root?.querySelector<HTMLElement>(".swiper-wrapper");
    const items = [...(root?.querySelectorAll<HTMLElement>(".swiper-slide > div") ?? [])]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const bullet = element.querySelector<HTMLElement>("span, i")?.getBoundingClientRect();
        const textNode = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
        const range = textNode ? document.createRange() : null;
        if (range && textNode) range.selectNode(textNode);
        const text = range?.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          bullet: bullet?.toJSON(),
          rect: rect.toJSON(),
          style: {
            color: style.color,
            display: style.display,
            font: style.font,
            letterSpacing: style.letterSpacing,
          },
          text: text?.toJSON(),
          value: element.textContent?.trim(),
        };
      })
      .filter((item) => item.rect.right > 0 && item.rect.left < innerWidth);
    return {
      items,
      root: root?.getBoundingClientRect().toJSON(),
      track: track
        ? {
            rect: track.getBoundingClientRect().toJSON(),
            transform: getComputedStyle(track).transform,
          }
        : null,
    };
  });
}

async function elementDiagnostics(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((root) =>
      [root, ...root.querySelectorAll<HTMLElement>("*")].map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const image = element instanceof HTMLImageElement ? element : undefined;
        return {
          className: element.className,
          image: image
            ? {
                currentSrc: image.currentSrc,
                naturalHeight: image.naturalHeight,
                naturalWidth: image.naturalWidth,
              }
            : undefined,
          rect: {
            height: rect.height,
            pageX: rect.x + scrollX,
            pageY: rect.y + scrollY,
            width: rect.width,
            x: rect.x,
            y: rect.y,
          },
          style: {
            color: style.color,
            font: style.font,
            fontWeight: style.fontWeight,
            letterSpacing: style.letterSpacing,
            lineHeight: style.lineHeight,
            margin: style.margin,
            objectFit: style.objectFit,
            objectPosition: style.objectPosition,
            padding: style.padding,
            position: style.position,
            textDecoration: style.textDecoration,
            top: style.top,
            transform: style.transform,
          },
          tag: element.tagName,
          text: element.children.length === 0 ? element.textContent?.trim() : undefined,
        };
      }),
    );
}

export async function captureFashionNamedStates(options: {
  commit: string;
  implementationUrl: string;
  outputRoot: string;
  sourceUrl: string;
  stateFilter?: string;
  viewportFilter?: string;
}): Promise<void> {
  if (!/^[a-f0-9]{7,40}$/.test(options.commit)) throw new Error("A real commit SHA is required.");
  const implementationThemeId = "fashion-store";
  const contracts = fashionStoreNamedStates;
  const outputRoot = resolve(options.outputRoot, implementationThemeId, "named");
  await mkdir(outputRoot, { recursive: true });
  const lease = await acquireCaptureLease({
    origins: [options.sourceUrl, options.implementationUrl],
    outputRoot,
    requestedWorkers: 1,
  });
  let browser: Browser | undefined;
  const failures: string[] = [];
  const results: unknown[] = [];
  const sourceFontCss = await fashionStoreSourceFontCss();
  try {
    browser = await chromium.launch(
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : undefined,
    );
    for (const [viewportId, viewport] of Object.entries(themeViewports)) {
      if (options.viewportFilter && viewportId !== options.viewportFilter) continue;
      const context = await browser.newContext({
        reducedMotion: "no-preference",
        viewport,
      });
      const source = await context.newPage();
      const implementation = await context.newPage();
      try {
        if (sourceFontCss) {
          await source.route("https://fonts.googleapis.com/**", (route) =>
            route.fulfill({ body: sourceFontCss, contentType: "text/css" }),
          );
          await source.route("https://fonts.gstatic.com/**", (route) => route.abort());
        }
        await source.route("https://via.placeholder.com/**", (route) =>
          route.fulfill({ body: "", contentType: "image/png", status: 204 }),
        );
        await Promise.all([
          source.goto(options.sourceUrl, { timeout: 60_000, waitUntil: "domcontentloaded" }),
          implementation.goto(options.implementationUrl, {
            timeout: 60_000,
            waitUntil: "domcontentloaded",
          }),
        ]);
        await prepareFashionPages(source, implementation);
        {
          await implementation
            .locator("[data-fashion-store-source-parity]")
            .waitFor({ state: "attached" });
          await implementation.waitForFunction(
            () =>
              document
                .querySelector("[data-fashion-store-source-parity]")
                ?.getAttribute("data-runtime-status") === "ready",
          );
          await Promise.all([
            source
              .locator("[data-accept-btn]")
              .click()
              .catch(() => undefined),
            implementation
              .getByRole("button", { name: "Allow cookies" })
              .click()
              .catch(() => undefined),
          ]);
        }
        if (options.stateFilter && options.stateFilter !== "cookie-overlay") {
          await Promise.all([
            source
              .locator("[data-accept-btn]")
              .click()
              .catch(() => undefined),
            implementation
              .getByRole("button", { name: "Allow cookies" })
              .click()
              .catch(() => undefined),
          ]);
        }
        for (const state of contracts) {
          if (options.stateFilter && state.id !== options.stateFilter) continue;
          await Promise.all([
            source.evaluate(
              (visible) =>
                document.documentElement.classList.toggle("capture-cookie-overlay", visible),
              state.id === "cookie-overlay",
            ),
            implementation.evaluate(
              (visible) =>
                document.documentElement.classList.toggle("capture-cookie-overlay", visible),
              state.id === "cookie-overlay",
            ),
          ]);
          if (["product-default", "product-hover", "product-focus"].includes(state.id)) {
            await Promise.all([
              source.emulateMedia({ reducedMotion: "no-preference" }),
              implementation.emulateMedia({ reducedMotion: "no-preference" }),
              source.evaluate(() => scrollTo(0, 0)),
              implementation.evaluate(() => scrollTo(0, 0)),
            ]);
            await Promise.all([
              source.reload({ timeout: 60_000, waitUntil: "domcontentloaded" }),
              implementation.reload({ timeout: 60_000, waitUntil: "domcontentloaded" }),
            ]);
            await prepareFashionPages(source, implementation);
            await Promise.all([
              source
                .locator("[data-accept-btn]")
                .click()
                .catch(() => undefined),
              implementation
                .getByRole("button", { name: "Allow cookies" })
                .click()
                .catch(() => undefined),
            ]);
          }
          const captureMode = captureModeForNamedState(state);
          await Promise.all([
            source.emulateMedia({
              reducedMotion: captureMode === "temporal" ? "no-preference" : "reduce",
            }),
            implementation.emulateMedia({
              reducedMotion: captureMode === "temporal" ? "no-preference" : "reduce",
            }),
            installNamedStateCss(source, captureMode),
            installNamedStateCss(implementation, captureMode),
          ]);
          await Promise.all([
            applyFashionStoreAction(source, "source", state.action, viewport.width),
            applyFashionStoreAction(implementation, "implementation", state.action, viewport.width),
          ]);
          if (state.capture === "element")
            await Promise.all([
              normalizeNamedStateFractionalOrigin(source, state.sourceSelector),
              normalizeNamedStateFractionalOrigin(
                implementation,
                state.implementationSelector,
              ),
            ]);
          const [referenceBox, implementationBox] = await Promise.all([
            box(source, state.sourceSelector),
            box(implementation, state.implementationSelector),
          ]);
          const stateGeometryIssues = geometryIssues(state, referenceBox, implementationBox);
          failures.push(...stateGeometryIssues.map((issue) => `${viewportId}: ${issue}`));
          const width =
            state.capture === "viewport-top"
              ? viewport.width
              : Math.floor(Math.min(referenceBox.width, implementationBox.width));
          const height =
            state.capture === "viewport-top"
              ? Math.min(viewport.height, 620)
              : Math.floor(Math.min(referenceBox.height, implementationBox.height));
          const referencePath = join(outputRoot, `${viewportId}-${state.id}-reference.png`);
          const implementationPath = join(
            outputRoot,
            `${viewportId}-${state.id}-implementation.png`,
          );
          if (["initial", "hero", "collection"].includes(state.action.kind)) {
            await Promise.all([
              source.mouse.move(viewport.width - 1, 0),
              implementation.mouse.move(viewport.width - 1, 0),
            ]);
          }
          if (state.capture === "viewport-top") {
            await Promise.all([
              source.screenshot({
                animations: "disabled",
                clip: { height, width, x: 0, y: 0 },
                path: referencePath,
              }),
              implementation.screenshot({
                animations: "disabled",
                clip: { height, width, x: 0, y: 0 },
                path: implementationPath,
              }),
            ]);
          } else {
            const referenceRegion = visibleRegion(referenceBox, viewport);
            const implementationRegion = visibleRegion(implementationBox, viewport);
            const dimensions = {
              height: Math.min(referenceRegion.height, implementationRegion.height),
              width: Math.min(referenceRegion.width, implementationRegion.width),
            };
            if (dimensions.height <= 0 || dimensions.width <= 0)
              throw new Error(`${viewportId} ${state.id} has no visible capture region.`);
            await Promise.all([
              captureVisibleElement(source, referenceRegion, dimensions, referencePath),
              captureVisibleElement(
                implementation,
                implementationRegion,
                dimensions,
                implementationPath,
              ),
            ]);
          }
          const differencePath = join(outputRoot, `${viewportId}-${state.id}-diff.png`);
          const difference = await compareThemeScreenshots(
            referencePath,
            implementationPath,
            differencePath,
            16,
            {
              cropsDirectory: join(outputRoot, "diagnostics", `${viewportId}-${state.id}`),
              emitWhenChangedPixelRatioExceeds: namedStatePixelThreshold(state),
              heatmapPath: join(outputRoot, `${viewportId}-${state.id}-heatmap.png`),
              maximumCrops: 3,
            },
          );
          try {
            assertThemeScreenshotDifference(difference, namedStatePixelThreshold(state));
          } catch (error) {
            failures.push(`${viewportId} ${state.id}: ${(error as Error).message}`);
          }
          const diagnostics =
            state.id === "promotional-marquee-paused"
              ? {
                  implementation: await marqueeDiagnostics(implementation),
                  reference: await marqueeDiagnostics(source),
                }
              : undefined;
          results.push({
            captureMode: captureModeForNamedState(state),
            diagnostics:
              diagnostics ??
              ([
                "collection-slide-1",
                "collection-menu-open",
                "cart-open",
                "footer",
                "hero-slide-1",
                "language-open",
                "navigation-open",
                "pages-menu-open",
                "product-default",
                "search-open",
              ].includes(state.id)
                ? {
                    implementation: await elementDiagnostics(
                      implementation,
                      state.implementationSelector,
                    ),
                    reference: await elementDiagnostics(source, state.sourceSelector),
                  }
                : undefined),
            difference,
            geometry: { implementation: implementationBox, reference: referenceBox },
            state: state.id,
            viewport: viewportId,
          });
          if (state.action.kind === "overlay") {
            await Promise.all([
              source
                .locator("[data-accept-btn]")
                .click()
                .catch(() => undefined),
              implementation
                .getByRole("button", { name: "Allow cookies" })
                .click()
                .catch(() => undefined),
            ]);
          }
        }
      } finally {
        await Promise.allSettled([source.close(), implementation.close()]);
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    await lease.release();
  }
  await writeFile(
    join(outputRoot, "report.json"),
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        commit: options.commit,
        failures,
        implementationUrl: options.implementationUrl,
        results,
        sourceUrl: options.sourceUrl,
        implementationThemeId,
        referenceThemeId: "fashion",
        state: `${implementationThemeId}-named-states`,
        themeId: implementationThemeId,
        viewports: themeViewports,
      },
      null,
      2,
    )}\n`,
  );
  if (failures.length > 0)
    throw new Error(`${implementationThemeId} named-state capture failed:\n${failures.join("\n")}`);
}

export async function captureFashionStoreNamedStates(
  options: Parameters<typeof captureFashionNamedStates>[0],
): Promise<void> {
  await captureFashionNamedStates(options);
}

function value(arguments_: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return arguments_.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

if (import.meta.main) {
  const arguments_ = Bun.argv.slice(2);
  const sourceUrl = value(arguments_, "--source-url");
  const implementationUrl = value(arguments_, "--implementation-url");
  const outputRoot = value(arguments_, "--output");
  const commit = value(arguments_, "--commit");
  const theme = value(arguments_, "--theme") ?? "fashion-store";
  const stateFilter = value(arguments_, "--state");
  const viewportFilter = value(arguments_, "--viewport");
  if (!sourceUrl || !implementationUrl || !outputRoot || !commit)
    throw new Error(
      "Usage: bun tools/capture-theme-named-states.ts --source-url=<url> --implementation-url=<url> --output=<root> --commit=<sha> [--theme=fashion-store] [--state=<id>] [--viewport=<id>]",
    );
  if (theme === "fashion-store")
    await captureFashionStoreNamedStates({
      commit,
      implementationUrl,
      outputRoot,
      sourceUrl,
      ...(stateFilter ? { stateFilter } : {}),
      ...(viewportFilter ? { viewportFilter } : {}),
    });
  else throw new Error(`Unsupported theme for named-state capture: ${theme}`);
}
