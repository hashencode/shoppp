import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { assertFashionStoreDecorHeroSourceTiming } from "../app/themes/fashion-store/contracts/home-hero";

const decorSourceUrl = `http://127.0.0.1:${Number(
  process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427,
)}/demo-decor-store.html`;

function isChromiumDesktop(testInfo: TestInfo): boolean {
  return (
    testInfo.project.metadata.fashionStoreBrowser === "chromium" &&
    testInfo.project.metadata.fashionStoreViewport === "desktop"
  );
}

async function probeCarouselThreshold(
  page: Page,
  selector: string,
  distance: number,
): Promise<boolean> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error("Hero is unavailable for pointer input.");
  const session = await page.context().newCDPSession(page);
  const startX = Math.round(box.x + box.width * 0.7);
  const y = Math.round(box.y + box.height * 0.5);
  try {
    await session.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 1,
      clickCount: 1,
      type: "mousePressed",
      x: startX,
      y,
    });
    await session.send("Input.dispatchMouseEvent", {
      buttons: 1,
      type: "mouseMoved",
      x: startX - distance,
      y,
    });
    const thresholdAccepted = await page.locator(selector).evaluate((element) =>
      Boolean(
        (
          element as HTMLElement & {
            swiper?: { touchEventsData?: { allowThresholdMove?: boolean } };
          }
        ).swiper?.touchEventsData?.allowThresholdMove,
      ),
    );
    await session.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 0,
      clickCount: 1,
      type: "mouseReleased",
      x: startX - distance,
      y,
    });
    return thresholdAccepted;
  } finally {
    await session.detach();
  }
}

async function prepareDecorSource(page: Page): Promise<void> {
  await page.goto(decorSourceUrl, { waitUntil: "networkidle" });
  await page.waitForFunction(() =>
    document.querySelector("#decor-store-slider")?.classList.contains("revslider-initialised"),
  );
  await page.evaluate(() => {
    const jquery = (
      window as typeof window & {
        jQuery?: (selector: string) => { revpause?(): void; revshowslide?(index: number): void };
      }
    ).jQuery;
    jquery?.("#decor-store-slider").revshowslide?.(1);
    jquery?.("#decor-store-slider").revpause?.();
  });
}

async function activateHeroRuntime(page: Page): Promise<void> {
  await page.locator("#fashion-store-main").dispatchEvent("click");
  await expect(page.locator("html")).toHaveClass(/^js$/);
}

test("renders the permanent furniture Hero in a complete static first state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "networkidle" });

  const hero = page.locator("#fashion-store-decor-hero");
  await expect(hero).toBeVisible();
  await expect(hero).toHaveAttribute("data-active-slide", "1");
  await expect(hero.locator("[data-hero-slide='1'] h1")).toHaveText("Corby sofas");
  await expect(hero.locator("[data-hero-slide='1']")).toContainText("$199.00");
  await expect(hero.locator("[data-hero-slide='1'] a[href='/shop']")).toHaveText("Shop Now");
  await expect(hero.locator("[data-hero-slide='1'] [data-hero-layer='thumbnail']")).toHaveCSS(
    "background-image",
    /decor-hero-02-thumb/,
  );
  await expect(hero.getByText("More information", { exact: true })).toHaveCount(0);
  await expect(hero.locator("[role='tooltip'], [data-hero-tooltip]")).toHaveCount(0);
});

test("keeps the first slide static and layers later accepted changes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "networkidle" });
  await activateHeroRuntime(page);

  const hero = page.locator("#fashion-store-decor-hero");
  await expect(hero).toHaveAttribute("data-runtime-status", "operational");
  await hero.evaluate((element) =>
    (
      element as HTMLElement & { swiper?: { autoplay?: { stop(): void } } }
    ).swiper?.autoplay?.stop(),
  );
  const firstTitle = hero.locator(".swiper-slide-active [data-hero-layer='title']");
  await expect(firstTitle).toHaveCSS("opacity", "1");
  await expect(firstTitle).not.toHaveAttribute("style", /opacity|transform|filter/);

  await hero.locator(".swiper-slide-active [data-hero-layer='next']").click();
  await expect(hero).toHaveAttribute("data-active-slide", "2");
  await expect(hero).toHaveAttribute("data-action-phase", "layer-busy");
  await hero.locator(".swiper-slide-active [data-hero-layer='next']").click({ force: true });
  await hero.evaluate((element) =>
    (element as HTMLElement & { swiper?: { slideNext(): void } }).swiper?.slideNext(),
  );
  await expect(hero).toHaveAttribute("data-active-slide", "2");
  await expect(hero.locator(".swiper-slide-active [data-hero-layer='title']")).toHaveText(
    "Verona sofas",
  );
  await expect(hero).toHaveAttribute("data-action-phase", "idle", { timeout: 5_000 });
});

test("uses native Swiper threshold and adjacent lazy preload without custom loading state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "networkidle" });
  await activateHeroRuntime(page);
  const hero = page.locator("#fashion-store-decor-hero");
  await expect(hero).toHaveAttribute("data-runtime-status", "operational");
  const parameters = await hero.evaluate((element) => {
    const swiper = (element as HTMLElement & { swiper?: { params?: Record<string, unknown> } })
      .swiper;
    return swiper?.params;
  });

  expect(parameters).toMatchObject({ lazyPreloadPrevNext: 1, threshold: 75 });
  await expect(hero.locator("[data-image-state], [data-load-error]")).toHaveCount(0);
  await expect(hero.locator("img[loading='lazy']").first()).toBeAttached();
});

test("keeps the SSR Hero usable when JavaScript is unavailable", async ({ browser }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo), "One engine and viewport prove the static SSR boundary.");
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto("/");
    const hero = page.locator("#fashion-store-decor-hero");
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute("data-active-slide", "1");
    await expect(hero.locator("[data-hero-slide='1'] h1")).toHaveText("Corby sofas");
    await expect(hero.locator("[data-hero-slide='1'] a[href='/shop']")).toHaveText("Shop Now");
  } finally {
    await context.close();
  }
});

test("binds all Hero content and layer timings to the independent Decor source", async ({
  browser,
  page,
}, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo), "One source runtime pass freezes the independent ledger.");
  const source = await browser.newPage({ viewport: page.viewportSize()! });
  try {
    await Promise.all([prepareDecorSource(source), page.goto("/", { waitUntil: "networkidle" })]);
    const sourceSlides = source.locator("#decor-store-slider > ul > li");
    await expect(sourceSlides).toHaveCount(3);
    for (const [index, title, price] of [
      [0, "Corby sofas", "$199.00"],
      [1, "Verona sofas", "$259.00"],
      [2, "Lewis sofas", "$259.00"],
    ] as const) {
      await expect(sourceSlides.nth(index)).toContainText(title);
      await expect(sourceSlides.nth(index)).toContainText(price);
      await expect(page.locator(`[data-hero-slide='${index + 1}']`)).toContainText(title);
      await expect(page.locator(`[data-hero-slide='${index + 1}']`)).toContainText(price);
    }
    const transitionMs = Number(await sourceSlides.first().getAttribute("data-masterspeed"));
    const observedLayers = [] as Array<{
      delayMs: number;
      durationMs: number;
      role: "pattern" | "shape" | "product" | "title" | "price" | "cta" | "next" | "thumbnail";
    }>;
    for (const [layer, role] of [
      ["02", "pattern"],
      ["01", "shape"],
      ["04", "product"],
      ["07", "title"],
      ["08", "price"],
      ["09", "cta"],
      ["13", "next"],
      ["14", "thumbnail"],
    ] as const) {
      const frames = await source.locator(`#slide-1-layer-${layer}`).getAttribute("data-frames");
      const entrance = JSON.parse(frames ?? "[]")[0] as { delay?: number | string; speed?: number | string };
      observedLayers.push({
        delayMs: Number(entrance.delay),
        durationMs: Number(entrance.speed),
        role,
      });
    }
    const initializer = (await source.locator("script").allTextContents()).join("\n");
    const autoplayMs = Number(initializer.match(/delay:\s*(\d+)/)?.[1]);
    const swipeThresholdPx = Number(initializer.match(/swipe_threshold:\s*(\d+)/)?.[1]);
    assertFashionStoreDecorHeroSourceTiming({
      autoplayMs,
      layers: observedLayers,
      stopAfterReturnToFirst:
        initializer.includes('stopLoop: "on"') &&
        initializer.includes("stopAfterLoops: 0") &&
        initializer.includes("stopAtSlide: 1"),
      swipeThresholdPx,
      transitionMs,
    });
    expect(initializer).toContain("stopAfterLoops: 0");
    expect(initializer).toContain("stopAtSlide: 1");
    await activateHeroRuntime(page);
    for (const [index, sourceIndex, title] of [
      [0, 1, "Corby sofas"],
      [1, 2, "Verona sofas"],
      [2, 3, "Lewis sofas"],
    ] as const) {
      await source.evaluate((nextIndex) => {
        const jquery = (
          window as typeof window & {
            jQuery?: (selector: string) => { revshowslide?(index: number): void };
          }
        ).jQuery;
        jquery?.("#decor-store-slider").revshowslide?.(nextIndex);
      }, sourceIndex);
      await page.locator("#fashion-store-decor-hero").evaluate((element, nextIndex) => {
        (element as HTMLElement & { swiper?: { slideTo(index: number, speed: number): void } }).swiper
          ?.slideTo(nextIndex, 0);
      }, index);
      await expect(
        source.locator("#decor-store-slider > ul > li.active-revslide"),
      ).toContainText(title);
      await expect(page.locator(".swiper-slide-active [data-hero-layer='title']")).toHaveText(title);
    }
  } finally {
    await source.close();
  }
});

test("rejects 74px and opens Swiper's native threshold gate at 76px", async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo), "Desktop Chromium provides deterministic pointer geometry.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "networkidle" });
  await activateHeroRuntime(page);
  const hero = page.locator("#fashion-store-decor-hero");
  await expect(hero).toHaveAttribute("data-runtime-status", "operational");
  expect(await probeCarouselThreshold(page, "#fashion-store-decor-hero", 74)).toBe(false);
  await expect(hero).toHaveAttribute("data-active-slide", "1");
  await page.waitForTimeout(350);
  expect(await probeCarouselThreshold(page, "#fashion-store-decor-hero", 76)).toBe(true);
  await expect(hero).toHaveAttribute("data-active-slide", "1");
});

test("stops after one complete cycle and remounts one clean Hero", async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo), "One engine and viewport prove the lifecycle boundary.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "networkidle" });
  await activateHeroRuntime(page);
  const hero = page.locator("#fashion-store-decor-hero");
  await expect(hero).toHaveAttribute("data-runtime-status", "operational");
  const next = hero.locator(".swiper-slide-active [data-hero-layer='next']");
  await next.click();
  await expect(hero).toHaveAttribute("data-active-slide", "2");
  await next.click();
  await expect(hero).toHaveAttribute("data-active-slide", "3");
  await next.click();
  await expect(hero).toHaveAttribute("data-active-slide", "1");
  expect(
    await hero.evaluate(
      (element) =>
        (element as HTMLElement & { swiper?: { autoplay?: { running?: boolean } } }).swiper
          ?.autoplay?.running,
    ),
  ).toBe(false);

  await page.goto("/shop", { waitUntil: "networkidle" });
  await page.goto("/", { waitUntil: "networkidle" });
  await activateHeroRuntime(page);
  await expect(page.locator("#fashion-store-decor-hero")).toHaveCount(1);
  await expect(page.locator("#fashion-store-decor-hero.swiper-initialized")).toHaveCount(1);
});

test("keeps the Hero atomic when the GSAP runtime cannot load", async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo), "One engine and viewport prove the load-failure boundary.");
  await page.route("**/*gsap*.js*", (route) => route.abort("failed"));
  await page.goto("/", { waitUntil: "networkidle" });
  await activateHeroRuntime(page);
  const hero = page.locator("#fashion-store-decor-hero");
  await expect(hero).toHaveAttribute("data-runtime-status", "static");
  await expect(hero).toHaveAttribute("data-active-slide", "1");
  await hero.locator("[data-hero-layer='next']").first().click();
  await page.keyboard.press("ArrowRight");
  await expect(hero).toHaveAttribute("data-active-slide", "1");
  await expect(hero.locator("[data-hero-slide='1'] a[href='/shop']")).toHaveText("Shop Now");
});
