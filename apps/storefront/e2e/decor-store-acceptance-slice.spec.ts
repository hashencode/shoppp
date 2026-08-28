import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const themeRoot = fileURLToPath(new URL("../app/themes/decor-store/upstream/", import.meta.url));
const sourceHtmlPath = `${themeRoot}demo-decor-store.html`;
const runtimeScripts = [
  "js/jquery.js",
  "revolution/js/jquery.themepunch.tools.min.js",
  "revolution/js/jquery.themepunch.revolution.min.js",
  "revolution/js/extensions/revolution.extension.actions.min.js",
  "revolution/js/extensions/revolution.extension.layeranimation.min.js",
  "revolution/js/extensions/revolution.extension.navigation.min.js",
  "revolution/js/extensions/revolution.extension.slideanims.min.js",
] as const;

async function sourceHeroMarkup(): Promise<string> {
  const html = await readFile(sourceHtmlPath, "utf8");
  const match = html.match(/<section class="p-0">[\s\S]*?<\/section>/);
  if (!match) throw new Error("The source Revolution Hero markup was not found.");
  return match[0].replaceAll(/\sdata-thumb="https?:\/\/[^"]*"/g, "");
}

async function initializeSourceHero(page: Page): Promise<void> {
  await page.evaluate(() => {
    const jquery = (
      globalThis as typeof globalThis & {
        jQuery: (selector: string) => {
          revolution(options: object): unknown;
          show(): { revolution(options: object): unknown };
        };
      }
    ).jQuery;
    jquery("#decor-store-slider")
      .show()
      .revolution({
        sliderType: "standard",
        delay: 9000,
        sliderLayout: "fullscreen",
        autoHeight: "off",
        stopLoop: "on",
        stopAfterLoops: 0,
        stopAtSlide: 1,
        navigation: {
          keyboardNavigation: "on",
          keyboard_direction: "horizontal",
          mouseScrollNavigation: "off",
          mouseScrollReverse: "default",
          onHoverStop: "off",
          touch: {
            touchenabled: "on",
            touchOnDesktop: "on",
            swipe_threshold: 75,
            swipe_min_touches: 1,
            swipe_direction: "horizontal",
            drag_block_vertical: true,
          },
          arrows: {
            enable: false,
            style: "uranus",
            rtl: false,
            hide_onleave: false,
            hide_onmobile: false,
            hide_under: 0,
            hide_over: 778,
            hide_delay: 200,
            hide_delay_mobile: 1200,
            left: {
              container: "slider",
              h_align: "left",
              v_align: "center",
              h_offset: 10,
              v_offset: 10,
            },
            right: {
              container: "slider",
              h_align: "right",
              v_align: "center",
              h_offset: 10,
              v_offset: 10,
            },
          },
        },
        lazyType: "smart",
        spinner: "spinner0",
        fullScreenAlignForce: "off",
        hideThumbsOnMobile: "off",
        hideSliderAtLimit: 0,
        hideCaptionAtLimit: 0,
        hideAllCaptionAtLilmit: 0,
        responsiveLevels: [1240, 1024, 778, 480],
        gridwidth: [1220, 1024, 778, 480],
        gridheight: [900, 1000, 960, 720],
        visibilityLevels: [1240, 1024, 1024, 480],
        fallbacks: {
          simplifyAll: "on",
          nextSlideOnWindowFocus: "off",
          disableFocusListener: false,
        },
      });
  });
}

async function prepareImplementation(page: Page, expected: "ready" | "fallback" = "ready") {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-decor-store-source-parity]")).toHaveAttribute(
    "data-runtime-status",
    expected,
    { timeout: 15_000 },
  );
}

async function expectRenderedLayer(
  page: Page,
  selector: "title" | "product" | "shop" | "next",
): Promise<void> {
  const rendered = await page
    .locator("#decor-store-slider > ul > li.active-revslide")
    .evaluate((activeSlide, layerName) => {
      const selectors = {
        title: "[id$='-layer-07']",
        product: ".product-image-layer",
        shop: ".shop-button",
        next: ".navigation-arrow [id$='-layer-13']",
      } as const;
      const layer = activeSlide.querySelector<HTMLElement>(selectors[layerName]);
      if (!layer) {
        return { height: 0, imageNaturalWidth: 0, opacity: 0, text: "", visible: false, width: 0 };
      }
      const box = layer.getBoundingClientRect();
      const image = layer.querySelector<HTMLImageElement>("img");
      let current: HTMLElement | null = layer;
      let visible = true;
      let opacity = 1;
      while (current && current !== activeSlide.parentElement) {
        const style = getComputedStyle(current);
        opacity *= Number.parseFloat(style.opacity || "1");
        visible &&= style.display !== "none" && style.visibility !== "hidden";
        current = current.parentElement;
      }
      return {
        height: box.height,
        imageNaturalWidth: image?.naturalWidth || 0,
        opacity,
        text: layer.textContent?.trim() || "",
        visible,
        width: box.width,
      };
    }, selector);
  expect(rendered.width, `${selector} width`).toBeGreaterThan(0);
  expect(rendered.height, `${selector} height`).toBeGreaterThan(0);
  expect(rendered.visible, `${selector} visibility`).toBe(true);
  expect(rendered.opacity, `${selector} effective opacity`).toBeGreaterThan(0.9);
  if (selector === "title") expect(rendered.text).toContain("Corby sofas");
  if (selector === "product") expect(rendered.imageNaturalWidth).toBeGreaterThan(0);
  if (selector === "shop") expect(rendered.text.toLowerCase()).toContain("shop now");
  if (selector === "next") expect(rendered.text.toLowerCase()).toContain("next");
}

async function expectVisibleSourceHero(page: Page): Promise<void> {
  await expect(page.locator("#decor-store-slider > ul > li.active-revslide")).toHaveCount(1);
  for (const layer of ["title", "product", "shop", "next"] as const) {
    await expectRenderedLayer(page, layer);
  }
}

test("exact Revolution chain mounts, advances, destroys, and remounts once", async ({ page }) => {
  const heroMarkup = await sourceHeroMarkup();
  await page.setContent(`<main>${heroMarkup}</main>`);
  for (const stylesheet of [
    "revolution/css/settings.css",
    "revolution/css/layers.css",
    "revolution/css/navigation.css",
  ]) {
    await page.addStyleTag({ path: `${themeRoot}${stylesheet}` });
  }
  for (const script of runtimeScripts) await page.addScriptTag({ path: `${themeRoot}${script}` });

  await initializeSourceHero(page);
  await expect(page.locator("#decor-store-slider")).toHaveClass(/revslider-initialised/);
  await expect(page.locator("#decor-store-slider > ul > li")).toHaveCount(3);

  await page.evaluate(() => {
    const jquery = (
      globalThis as typeof globalThis & {
        jQuery: (selector: string) => { revnext(): void };
      }
    ).jQuery;
    jquery("#decor-store-slider").revnext();
  });
  await expect(page.locator("#decor-store-slider > ul > li[data-index='rs-72']")).toHaveClass(
    /active-revslide/,
  );

  await page.evaluate(() => {
    const jquery = (
      globalThis as typeof globalThis & {
        jQuery: (selector: string) => { revkill(): void };
      }
    ).jQuery;
    jquery("#decor-store-slider").revkill();
  });
  await expect(page.locator("#decor-store-slider")).toHaveCount(0);

  await page.locator("main").evaluate((root, markup) => {
    root.innerHTML = markup;
  }, heroMarkup);
  await initializeSourceHero(page);
  await expect(page.locator(".revslider-initialised")).toHaveCount(1);
});

test("implementation renders the source header, three-slide Hero, and representative card", async ({
  page,
}) => {
  await prepareImplementation(page);

  await expect(page.locator("header.header-with-topbar nav.navbar")).toBeVisible();
  await expect(page.locator("#decor-store-slider")).toHaveAttribute(
    "data-decor-hero-ready",
    "true",
  );
  await expect(page.locator("#decor-store-slider > ul > li")).toHaveCount(3);
  await expect(
    page
      .locator("[data-decor-region='products'] #tab_five1")
      .getByRole("link", { name: "Table clock" }),
  ).toBeVisible();
  await expect(page.locator("[data-decor-store-source-parity]")).toHaveAttribute(
    "data-runtime-status",
    "ready",
  );
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`${viewport.name} ready state has visible source Hero layers`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareImplementation(page);
    await page.waitForLoadState("networkidle");
    await expectVisibleSourceHero(page);
    await page.screenshot({
      fullPage: true,
      path: `/tmp/decor-store-u3-${viewport.name}.png`,
    });
  });
}

test("mobile representative card retains source-equivalent geometry", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareImplementation(page);
  const card = page.locator("[data-decor-region='products'] #tab_five1 .grid-item").first();
  const cardBox = await card.boundingBox();
  const imageBox = await card.locator(".shop-image img").boundingBox();
  expect(cardBox?.width).toBeGreaterThanOrEqual(378);
  expect(imageBox?.width).toBeGreaterThanOrEqual(345);
  const priceBox = await card.locator(".shop-footer > div").boundingBox();
  expect(priceBox?.height).toBeLessThanOrEqual(24);
});

test("header states interlock, dismiss, resize, search, and restore focus", async ({ page }) => {
  await prepareImplementation(page);
  const search = page.getByRole("button", { name: "Open search" });
  await search.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();
  await expect(page.locator(".search-input")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();
  await page.waitForTimeout(200);
  await expect(search).toBeFocused();
  await expect(page.locator(".search-input")).not.toBeFocused();

  const language = page.getByRole("button", { name: "Choose language" });
  await language.click();
  await expect(page.locator(".header-language .language-dropdown")).toBeVisible();
  await page.mouse.click(20, 700);
  await expect(page.locator(".header-language .language-dropdown")).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileToggle = page.getByRole("button", { name: "Toggle navigation" });
  await mobileToggle.tap();
  await expect(page.locator("#navbarNav")).toHaveClass(/show/);
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator("#navbarNav")).not.toHaveClass(/show/);
});

test("Hero exposes source transition state and makes no remote thumbnail request", async ({
  page,
}) => {
  const remoteRequests: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1")) remoteRequests.push(request.url());
  });
  await prepareImplementation(page);
  const slider = page.locator("#decor-store-slider");
  await expect(slider).toHaveAttribute("data-decor-hero-ready", "true");
  await page.evaluate(() => {
    const jquery = (
      globalThis as typeof globalThis & {
        jQuery: (selector: string) => { revnext(): void };
      }
    ).jQuery;
    jquery("#decor-store-slider").revnext();
  });
  await expect(slider).toHaveAttribute("data-decor-hero-active-slide", "rs-72");
  await expect(slider).toHaveAttribute("data-decor-hero-transition", "settled");
  await expect(slider.locator(":scope > ul > li")).toHaveCount(3);
  await expect(slider.locator("[data-thumb^='http']")).toHaveCount(0);
  expect(remoteRequests).toEqual([]);
});

test("blocked Revolution extension keeps header, stable Hero, and product usable", async ({
  page,
}) => {
  await page.route("**/revolution.extension.navigation.min.js", (route) => route.abort());
  await prepareImplementation(page, "fallback");
  await expect(page.locator("#decor-store-slider > ul > li").first()).toBeVisible();
  await expect(page.locator("header nav.navbar")).toBeVisible();
  await expect(
    page.locator("[data-decor-region='products'] #tab_five1 .grid-item").first(),
  ).toBeVisible();
  await expect(page.locator("footer.footer-dark")).toContainText("Newsletter");
  await expect(page.locator(".cookie-message")).toBeVisible();
});

test("a stalled Revolution dependency times out into the stable Hero fallback", async ({
  page,
}) => {
  await page.route("**/revolution.extension.navigation.min.js", async () => {
    await new Promise(() => undefined);
  });
  await prepareImplementation(page, "fallback");
  await expect(page.locator("#decor-store-slider")).toHaveAttribute(
    "data-decor-hero-fallback",
    /timed out/,
  );
  await expect(page.locator("#decor-store-slider > ul > li").first()).toBeVisible();
});

test("initializer exception is isolated to the stable Hero fallback", async ({ page }) => {
  await page.addInitScript(() => {
    (
      window as typeof window & { __decorStoreForceInitError?: boolean }
    ).__decorStoreForceInitError = true;
  });
  await prepareImplementation(page, "fallback");
  await expect(page.locator("#decor-store-slider")).toHaveAttribute(
    "data-decor-hero-fallback",
    /initializer failure/,
  );
  await expect(page.locator("#decor-store-slider > ul > li").first()).toBeVisible();
  await expect(page.locator("footer.footer-dark")).toContainText("Newsletter");
});

test("post-initialization readiness failure destroys Revolution before restoring fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (
      window as typeof window & { __decorStoreForceReadinessError?: boolean }
    ).__decorStoreForceReadinessError = true;
  });
  await prepareImplementation(page, "fallback");
  await expect(page.locator("#decor-store-slider")).toHaveAttribute(
    "data-decor-hero-fallback",
    /post-initialization readiness failure/,
  );
  await expect(page.locator(".revslider-initialised")).toHaveCount(0);
  await expect(page.locator("#decor-store-slider_wrapper")).toHaveCount(1);
  await expect(page.locator("#decor-store-slider > ul > li")).toHaveCount(3);
  await expect(page.locator("#decor-store-slider > ul > li").first()).toBeVisible();
});

test("responsive Hero geometry and reduced motion retain the source runtime", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await prepareImplementation(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const wrapper = page.locator("#decor-store-slider_wrapper");
    await expect(wrapper).toBeVisible();
    const box = await wrapper.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(viewport.width - 2);
    expect(box?.height).toBeGreaterThan(590);
    await expect(page.locator("#decor-store-slider")).toHaveAttribute(
      "data-decor-hero-reduced-motion",
      "true",
    );
  }
});

test("route teardown clears owned state and reload remounts one bounded instance", async ({
  page,
}) => {
  await prepareImplementation(page);
  await page.evaluate(() => {
    const appRoot = document.querySelector("#__nuxt") as
      (HTMLElement & { __vue_app__?: { unmount(): void } }) | null;
    appRoot?.__vue_app__?.unmount();
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __decorStoreHeroTestState?: { destroyed: boolean; instances: number };
            }
          ).__decorStoreHeroTestState,
      ),
    )
    .toBeUndefined();
  await expect(
    page.locator("[data-decor-store-source-parity], .revslider-initialised"),
  ).toHaveCount(0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __decorStoreHeroTestState?: { destroyed: boolean; instances: number };
            }
          ).__decorStoreHeroTestState,
      ),
    )
    .toMatchObject({ destroyed: false, instances: 1 });
  await expect(page.locator(".revslider-initialised")).toHaveCount(1);
  await expect(page.locator("[data-decor-region][data-body-status='ready']")).toHaveCount(3);
  await expect(page.locator("script[data-decor-store-runtime]")).toHaveCount(7);
});

test("representative product actions are pointer, keyboard, and touch operable typed intents", async ({
  page,
}) => {
  await prepareImplementation(page);
  const root = page.locator("[data-decor-store-source-parity]");
  const card = page.locator("[data-decor-region='products'] #tab_five1 .grid-item").first();
  await card.locator(".shop-box").hover();
  await card.getByRole("link", { name: "Add to cart" }).click();
  await card.getByRole("link", { name: "Add to wishlist" }).focus();
  await page.keyboard.press("Enter");
  await card.getByRole("link", { name: "Quick shop" }).tap();
  await expect(root).toHaveAttribute("data-preview-intent-count", "3");
});
