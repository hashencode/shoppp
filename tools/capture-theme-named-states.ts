import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import sharp from "../apps/storefront/node_modules/sharp";
import {
  decorNamedStates,
  fashionNamedStates,
  namedStatePixelThreshold,
  type NamedStateAction,
  type NamedStateContract,
} from "../apps/storefront/e2e/support/theme-named-state-contract";
import {
  captureGeometryIssues,
  deterministicCaptureCss,
} from "../apps/storefront/e2e/support/theme-capture-contract";
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

const namedStateCss =
  deterministicCaptureCss.replace(
    "#cookies-model, .cookie-message, .scroll-progress,",
    ".scroll-progress,",
  ) +
  `
  .fashion-scroll-progress { display: none !important; }
  .fashion-promises-track {
    animation: none !important;
    margin-left: 0 !important;
    transform: none !important;
  }
  .sticky-wrap { display: none !important; }
  #cookies-model, .fashion-cookie-message {
    display: block !important;
    opacity: 1 !important;
    transform: none !important;
    visibility: visible !important;
  }
  .decor-scroll-progress { display: none !important; }
  .decor-marquee-track {
    animation: none !important;
  }
  .decor-clients-track {
    animation: none !important;
    transform: none !important;
  }
  .decor-hero, .decor-collection { outline: none !important; }
  .decor-hero-slide .decor-hero-accent,
  .decor-hero-slide .decor-hero-product,
  .decor-hero-slide .decor-hero-copy h1,
  .decor-hero-slide .decor-hero-copy p,
  .decor-hero-slide .decor-hero-copy a {
    animation: none !important;
  }
  *:focus { outline: none !important; }
  #cookies-model, .decor-cookie-message {
    display: block !important;
    opacity: 1 !important;
    transform: none !important;
    visibility: visible !important;
  }
`;

async function stabilize(page: Page): Promise<void> {
  await page.addStyleTag({ content: namedStateCss });
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

async function prepareFashionPages(source: Page, implementation: Page): Promise<void> {
  await implementation.waitForFunction(() =>
    Boolean(
      (document.querySelector("#__nuxt") as (HTMLElement & { __vue_app__?: unknown }) | null)
        ?.__vue_app__,
    ),
  );
  await source.waitForFunction(() =>
    [...document.querySelectorAll<HTMLElement>(".swiper")].every((element) =>
      Boolean((element as HTMLElement & { swiper?: unknown }).swiper),
    ),
  );
  await hydrateFashionSourceImages(source);
  await Promise.all([stabilize(source), stabilize(implementation)]);
}

async function prepareDecorPages(source: Page, implementation: Page): Promise<void> {
  await implementation.waitForFunction(() =>
    Boolean(
      (document.querySelector("#__nuxt") as (HTMLElement & { __vue_app__?: unknown }) | null)
        ?.__vue_app__,
    ),
  );
  await source.waitForFunction(() => {
    const swipersReady = [...document.querySelectorAll<HTMLElement>(".swiper")].every((element) =>
      Boolean((element as HTMLElement & { swiper?: unknown }).swiper),
    );
    return swipersReady && Boolean(document.querySelector("#decor-store-slider .active-revslide"));
  });
  await source.waitForTimeout(3_200);
  await Promise.all([stabilize(source), stabilize(implementation)]);
  await source.evaluate(() => {
    const jquery = (
      window as unknown as {
        jQuery?: (selector: string) => { revpause?(): void };
      }
    ).jQuery;
    jquery?.("#decor-store-slider").revpause?.();
  });
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

async function resetDecor(page: Page, side: "implementation" | "source"): Promise<void> {
  const viewport = page.viewportSize();
  if (viewport) await page.mouse.move(viewport.width - 1, 0);
  await page.keyboard.press("Escape").catch(() => undefined);
  if (side === "implementation") {
    const mobileMenu = page.locator(".decor-mobile-menu[open]");
    if (await mobileMenu.count()) await mobileMenu.locator(":scope > summary").click();
    const selectedTab = page.getByRole("tab", { selected: true });
    if ((await selectedTab.count()) && (await selectedTab.getAttribute("id")) !== "decor-tab-0")
      await page.getByRole("tab", { name: "Best sellers" }).click();
    const languageTrigger = page.locator(".decor-language > button");
    if ((await languageTrigger.getAttribute("aria-expanded")) === "true")
      await languageTrigger.evaluate((element) => (element as HTMLButtonElement).click());
    const openNavigation = page.locator('.decor-nav-item > button[aria-expanded="true"]');
    if (await openNavigation.count())
      await openNavigation.first().evaluate((element) => (element as HTMLButtonElement).click());
    const hero = page.locator(".decor-hero");
    const heroIndex = Number(await hero.getAttribute("data-motion-active-index"));
    if (Number.isInteger(heroIndex) && heroIndex > 0) {
      await hero.focus();
      for (let index = 0; index < heroIndex; index += 1) await page.keyboard.press("ArrowLeft");
      await page.waitForFunction(
        () => document.querySelector(".decor-hero")?.getAttribute("data-motion-phase") === "idle",
      );
    }
    const collection = page.locator(".decor-collection");
    const collectionIndex = Number(await collection.getAttribute("data-motion-active-index"));
    if (Number.isInteger(collectionIndex) && collectionIndex > 0) {
      await collection.focus();
      for (let index = 0; index < collectionIndex; index += 1)
        await page.keyboard.press("ArrowLeft");
      await page.waitForFunction(
        () =>
          document.querySelector(".decor-collection")?.getAttribute("data-motion-phase") === "idle",
      );
    }
  } else {
    const changedHero = await page.evaluate(() => {
      document
        .querySelectorAll<HTMLElement>(".dropdown.show, .dropdown-menu.show")
        .forEach((node) => node.classList.remove("show"));
      document.querySelector("#navbarNav")?.classList.remove("show");
      const jquery = (
        window as unknown as {
          jQuery?: (selector: string) => {
            revpause?(): void;
            revresume?(): void;
            revshowslide?(index: number): void;
          };
        }
      ).jQuery;
      const revolution = jquery?.("#decor-store-slider");
      const activeSlide = document.querySelector("#decor-store-slider .active-revslide");
      const changed = activeSlide?.getAttribute("data-index") !== "rs-73";
      revolution?.revresume?.();
      revolution?.revshowslide?.(1);
      const primaryProductsTab = document.querySelector<HTMLAnchorElement>('a[href="#tab_five1"]');
      if (primaryProductsTab && !primaryProductsTab.classList.contains("active"))
        primaryProductsTab.click();
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
      return changed;
    });
    if (changedHero) await page.waitForTimeout(5_000);
    await page.waitForFunction(
      () => {
        const item = document.querySelector<HTMLElement>(".shop-boxed .grid-item");
        if (!item) return false;
        const style = getComputedStyle(item);
        return (
          Number(style.opacity) > 0.99 &&
          (style.transform === "none" || style.transform === "matrix(1, 0, 0, 1, 0, 0)")
        );
      },
      undefined,
      { timeout: 5_000 },
    );
    await page.evaluate(() => {
      const jquery = (window as unknown as { jQuery?: (selector: string) => { revpause?(): void } })
        .jQuery;
      jquery?.("#decor-store-slider").revpause?.();
    });
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.waitForTimeout(100);
}

async function applyDecorAction(
  page: Page,
  side: "implementation" | "source",
  action: NamedStateAction,
  viewportWidth: number,
): Promise<void> {
  await resetDecor(page, side);
  if (action.kind === "initial" || action.kind === "overlay") return;
  if (action.kind === "hero") {
    if (side === "source") {
      await page.evaluate((index) => {
        const jquery = (
          window as unknown as {
            jQuery?: (selector: string) => {
              revresume?(): void;
              revshowslide?(slide: number): void;
            };
          }
        ).jQuery;
        const revolution = jquery?.("#decor-store-slider");
        revolution?.revresume?.();
        revolution?.revshowslide?.(index + 1);
      }, action.index);
      await page.waitForTimeout(5_000);
      await page.waitForFunction(
        (slide) => {
          const sourceIndexes = ["rs-73", "rs-72", "rs-74"];
          const active = document.querySelector(
            `#decor-store-slider li[data-index="${sourceIndexes[slide]}"]`,
          );
          if (!active?.classList.contains("active-revslide")) return false;
          return [7, 8, 9].every((layer) => {
            const element = document.querySelector<HTMLElement>(
              `#slide-${slide + 1}-layer-0${layer}`,
            );
            if (!element) return false;
            const style = getComputedStyle(element);
            return (
              Number(style.opacity) > 0.99 &&
              (style.filter === "none" || /blur\(0(?:px)?\)/.test(style.filter))
            );
          });
        },
        action.index,
        { timeout: 15_000 },
      );
      await page.evaluate(() => {
        const jquery = (
          window as unknown as { jQuery?: (selector: string) => { revpause?(): void } }
        ).jQuery;
        jquery?.("#decor-store-slider").revpause?.();
      });
    } else {
      const hero = page.locator(".decor-hero");
      await hero.focus();
      for (let index = 0; index < action.index; index += 1) await page.keyboard.press("ArrowRight");
      await page.waitForFunction(
        (index) =>
          document.querySelector(".decor-hero")?.getAttribute("data-motion-active-index") ===
            String(index) &&
          document.querySelector(".decor-hero")?.getAttribute("data-motion-phase") === "idle",
        action.index,
      );
    }
  } else if (action.kind === "navigation") {
    if (viewportWidth >= 992) {
      if (side === "source") await page.locator(".navbar-nav .nav-item.dropdown").first().hover();
      else await page.locator(".decor-nav-item").filter({ hasText: "Shop" }).hover();
    } else if (side === "source") {
      await page.evaluate(() => document.querySelector("#navbarNav")?.classList.add("show"));
    } else {
      await page.locator(".decor-mobile-menu > summary").click();
    }
  } else if (action.kind === "language") {
    if (viewportWidth < 768) return;
    if (side === "source") await page.locator(".header-language").hover();
    else
      await page.locator(".decor-language > button").evaluate((element) => {
        (element as HTMLButtonElement).click();
      });
  } else if (action.kind === "category-hover") {
    const selector = side === "source" ? ".categories-style-01" : ".decor-category-icon-list a";
    await page.locator(selector).first().hover();
  } else if (action.kind === "product-hover" || action.kind === "product-focus") {
    if (side === "source") {
      const product = page.locator(".shop-boxed .grid-item .shop-box").first();
      await product.hover();
      await page.waitForFunction(() => {
        const element = document.querySelector<HTMLElement>(".shop-boxed .grid-item .shop-box");
        const item = element?.closest<HTMLElement>(".grid-item");
        if (!element || !item) return false;
        const style = getComputedStyle(item);
        return style.visibility !== "hidden" && Number(style.opacity) > 0.99;
      });
    } else if (action.kind === "product-focus") {
      await page.locator('.decor-product-card button[aria-label^="Save"]').first().focus();
    } else {
      await page.locator(".decor-product-media").first().hover();
    }
  } else if (action.kind === "tab-secondary") {
    if (side === "source") await page.locator('a[href="#tab_five2"]').click();
    else await page.getByRole("tab", { name: "New arrivals" }).click();
  } else if (action.kind === "collection") {
    if (side === "source") {
      await page.locator("section:nth-of-type(5) .swiper").evaluate((element, index) => {
        (
          element as HTMLElement & { swiper?: { slideToLoop?(index: number, speed: number): void } }
        ).swiper?.slideToLoop?.(index, 0);
      }, action.index);
    } else {
      const collection = page.locator(".decor-collection");
      await collection.focus();
      for (let index = 0; index < action.index; index += 1) await page.keyboard.press("ArrowRight");
      await page.waitForFunction(
        (index) =>
          document.querySelector(".decor-collection")?.getAttribute("data-motion-active-index") ===
          String(index),
        action.index,
      );
    }
  } else if (action.kind === "promo-pause") {
    if (side === "source") {
      await page.locator("section:nth-of-type(4)").hover();
      await page.locator("section:nth-of-type(4) .swiper").evaluate((element) => {
        (
          element as HTMLElement & { swiper?: { autoplay?: { stop(): void } } }
        ).swiper?.autoplay?.stop();
      });
    } else await page.locator(".decor-marquee").hover();
    await page.evaluate((currentSide) => {
      const root = document.querySelector(
        currentSide === "source" ? "section:nth-of-type(4)" : ".decor-marquee",
      );
      const track = root?.querySelector<HTMLElement>(
        currentSide === "source" ? ".swiper-wrapper" : ".decor-marquee-track",
      );
      const items = [
        ...(root?.querySelectorAll<HTMLElement>(
          currentSide === "source" ? ".swiper-slide > div" : ".decor-marquee-track > span",
        ) ?? []),
      ].filter((element) => element.textContent?.includes("Pay with multiple credit cards"));
      if (!root || !track || items.length === 0) return;
      track.style.animation = "none";
      track.style.transition = "none";
      const targetX = Math.round(innerWidth * 0.31);
      const item = items
        .map((element) => {
          const textNode = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
          const range = textNode ? document.createRange() : null;
          if (range && textNode) range.selectNode(textNode);
          return { element, text: range?.getBoundingClientRect() };
        })
        .filter((entry): entry is { element: HTMLElement; text: DOMRect } => Boolean(entry.text))
        .sort(
          (left, right) => Math.abs(left.text.x - targetX) - Math.abs(right.text.x - targetX),
        )[0];
      if (!item) return;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
      const deltaX = targetX - item.text.x;
      const deltaY = Math.round(item.text.y) - item.text.y;
      track.style.transform = `matrix(1, 0, 0, 1, ${matrix.e + deltaX}, ${matrix.f + deltaY})`;
    }, side);
  } else if (action.kind === "client-pause") {
    if (side === "source") {
      await page.locator("section:nth-of-type(6)").hover();
      await page.locator("section:nth-of-type(6) .swiper").evaluate((element) => {
        (
          element as HTMLElement & { swiper?: { autoplay?: { stop(): void } } }
        ).swiper?.autoplay?.stop();
      });
    } else await page.locator(".decor-clients").hover();
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

async function marqueeDiagnostics(page: Page, side: "implementation" | "source") {
  return page.evaluate((currentSide) => {
    const root = document.querySelector(
      currentSide === "source" ? "section:nth-of-type(4)" : ".decor-marquee",
    );
    const track = root?.querySelector<HTMLElement>(
      currentSide === "source" ? ".swiper-wrapper" : ".decor-marquee-track",
    );
    const items = [
      ...(root?.querySelectorAll<HTMLElement>(
        currentSide === "source" ? ".swiper-slide > div" : ".decor-marquee-track > span",
      ) ?? []),
    ]
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
  }, side);
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
  const outputRoot = resolve(options.outputRoot, "fashion", "named");
  await mkdir(outputRoot, { recursive: true });
  const lease = await acquireCaptureLease({
    origins: [options.sourceUrl, options.implementationUrl],
    outputRoot,
    requestedWorkers: 1,
  });
  let browser: Browser | undefined;
  const failures: string[] = [];
  const results: unknown[] = [];
  try {
    browser = await chromium.launch(
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : undefined,
    );
    for (const [viewportId, viewport] of Object.entries(themeViewports)) {
      if (options.viewportFilter && viewportId !== options.viewportFilter) continue;
      const context = await browser.newContext({ reducedMotion: "reduce", viewport });
      const source = await context.newPage();
      const implementation = await context.newPage();
      try {
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
        for (const state of fashionNamedStates) {
          if (options.stateFilter && state.id !== options.stateFilter) continue;
          if (
            !options.stateFilter &&
            ["product-default", "product-hover", "product-focus"].includes(state.id)
          ) {
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
          await Promise.all([
            applyFashionAction(source, "source", state.action, viewport.width),
            applyFashionAction(implementation, "implementation", state.action, viewport.width),
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
                  implementation: await marqueeDiagnostics(implementation, "implementation"),
                  reference: await marqueeDiagnostics(source, "source"),
                }
              : undefined;
          results.push({
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
        state: "fashion-named-states",
        themeId: "fashion",
        viewports: themeViewports,
      },
      null,
      2,
    )}\n`,
  );
  if (failures.length > 0)
    throw new Error(`Fashion named-state capture failed:\n${failures.join("\n")}`);
}

export async function captureDecorNamedStates(options: {
  commit: string;
  implementationUrl: string;
  outputRoot: string;
  sourceUrl: string;
  stateFilter?: string;
  viewportFilter?: string;
}): Promise<void> {
  if (!/^[a-f0-9]{7,40}$/.test(options.commit)) throw new Error("A real commit SHA is required.");
  const outputRoot = resolve(options.outputRoot, "decor", "named");
  await mkdir(outputRoot, { recursive: true });
  const lease = await acquireCaptureLease({
    origins: [options.sourceUrl, options.implementationUrl],
    outputRoot,
    requestedWorkers: 1,
  });
  let browser: Browser | undefined;
  const failures: string[] = [];
  const results: unknown[] = [];
  try {
    browser = await chromium.launch(
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : undefined,
    );
    for (const [viewportId, viewport] of Object.entries(themeViewports)) {
      if (options.viewportFilter && viewportId !== options.viewportFilter) continue;
      const context = await browser.newContext({ reducedMotion: "reduce", viewport });
      const source = await context.newPage();
      const implementation = await context.newPage();
      try {
        await Promise.all([
          source.goto(options.sourceUrl, { timeout: 60_000, waitUntil: "domcontentloaded" }),
          implementation.goto(options.implementationUrl, {
            timeout: 60_000,
            waitUntil: "domcontentloaded",
          }),
        ]);
        await prepareDecorPages(source, implementation);
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
        for (const state of decorNamedStates) {
          if (options.stateFilter && state.id !== options.stateFilter) continue;
          if (
            !options.stateFilter &&
            ["category-hover", "new-arrivals-tab", "product-hover", "product-focus"].includes(
              state.id,
            )
          ) {
            await Promise.all([
              source.reload({ timeout: 60_000, waitUntil: "domcontentloaded" }),
              implementation.reload({ timeout: 60_000, waitUntil: "domcontentloaded" }),
            ]);
            await prepareDecorPages(source, implementation);
          }
          await Promise.all([
            applyDecorAction(source, "source", state.action, viewport.width),
            applyDecorAction(implementation, "implementation", state.action, viewport.width),
          ]);
          const [referenceBox, implementationBox] = await Promise.all([
            box(source, state.sourceSelector),
            box(implementation, state.implementationSelector),
          ]);
          failures.push(
            ...geometryIssues(state, referenceBox, implementationBox).map(
              (issue) => `${viewportId}: ${issue}`,
            ),
          );
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
                  implementation: await marqueeDiagnostics(implementation, "implementation"),
                  reference: await marqueeDiagnostics(source, "source"),
                }
              : undefined;
          results.push({
            diagnostics:
              diagnostics ??
              ([
                "collection-slide-1",
                "footer",
                "hero-slide-1",
                "hero-slide-2",
                "hero-slide-3",
                "language-open",
                "navigation-open",
                "new-arrivals-tab",
                "product-default",
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
        state: "decor-named-states",
        themeId: "decor",
        viewports: themeViewports,
      },
      null,
      2,
    )}\n`,
  );
  if (failures.length > 0)
    throw new Error(`Decor named-state capture failed:\n${failures.join("\n")}`);
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
  const theme = value(arguments_, "--theme") ?? "fashion";
  const stateFilter = value(arguments_, "--state");
  const viewportFilter = value(arguments_, "--viewport");
  if (!sourceUrl || !implementationUrl || !outputRoot || !commit)
    throw new Error(
      "Usage: bun tools/capture-theme-named-states.ts --source-url=<url> --implementation-url=<url> --output=<root> --commit=<sha> [--theme=<fashion|decor>] [--state=<id>] [--viewport=<id>]",
    );
  if (theme === "decor")
    await captureDecorNamedStates({
      commit,
      implementationUrl,
      outputRoot,
      sourceUrl,
      ...(stateFilter ? { stateFilter } : {}),
      ...(viewportFilter ? { viewportFilter } : {}),
    });
  else if (theme === "fashion")
    await captureFashionNamedStates({
      commit,
      implementationUrl,
      outputRoot,
      sourceUrl,
      ...(stateFilter ? { stateFilter } : {}),
      ...(viewportFilter ? { viewportFilter } : {}),
    });
  else throw new Error(`Unsupported theme for named-state capture: ${theme}`);
}
