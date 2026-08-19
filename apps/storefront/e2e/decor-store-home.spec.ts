import { expect, test, type Locator, type Page } from "@playwright/test";

async function prepare(page: Page): Promise<Locator> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-decor-store-source-parity]");
  await expect(root).toHaveAttribute("data-runtime-status", "ready", { timeout: 15_000 });
  await expect(root).toHaveAttribute("data-decor-body-ready", "true");
  return root;
}

test("reduced motion is stable when requested before the first navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const root = await prepare(page);
  await expect(root).toHaveAttribute("data-storefront-hydration", "eager");
  await expect(root).toHaveAttribute("data-runtime-status", "ready");
  await expect(page.locator("#decor-store-slider")).toHaveAttribute(
    "data-decor-hero-reduced-motion",
    "true",
  );
  const title = page.locator("#decor-store-slider > ul > li.active-revslide [id$='-layer-07']");
  await expect(title).toBeVisible();
  await expect(title).toHaveCSS("filter", "none");
  await expect(
    page.locator("[data-decor-region='products'] #tab_five1 .grid-item").first(),
  ).toBeVisible();
});

test("desktop navigation starts below the fixed top bar", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await prepare(page);
  const geometry = await page.evaluate(() => {
    const topBar = document.querySelector<HTMLElement>("header .header-top-bar");
    const navigation = document.querySelector<HTMLElement>("header .navbar");
    if (!topBar || !navigation) throw new Error("Decor header geometry is missing.");
    return {
      navigationTop: navigation.getBoundingClientRect().top,
      topBarBottom: topBar.getBoundingClientRect().bottom,
    };
  });
  expect(Math.abs(geometry.navigationTop - geometry.topBarBottom)).toBeLessThanOrEqual(1);
});

test("source footer routes are typed while newsletter remains presentation-only", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const root = await prepare(page);
  await expect(root).toHaveAttribute("data-decor-tail-ready", "true");
  const footer = page.locator("footer.footer-dark");
  await expect(footer).toContainText("Categories");
  await expect(footer).toContainText("Newsletter");
  await expect(footer.locator("img")).toHaveCount(5);
  await expect(footer.getByRole("link", { name: "Bed room" })).toHaveAttribute("href", "/shop");

  const newsletter = footer.locator("[data-decor-newsletter-form]");
  await expect(newsletter).toHaveAttribute("data-newsletter-supported", "false");
  await newsletter.getByRole("textbox").fill("reader@example.com");
  await expect(
    newsletter.getByRole("button", { name: "Newsletter unavailable in preview" }),
  ).toHaveAttribute("aria-disabled", "true");
  await newsletter.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(newsletter.locator(".form-results")).toBeHidden();
  expect(requests.filter((url) => url.includes("subscribe-newsletter.php"))).toEqual([]);
  await footer.getByRole("link", { name: "Bed room" }).click();
  await expect(page).toHaveURL(/\/shop$/);
});

test("cookie choices dismiss locally without persistence or network requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const root = await prepare(page);
  const cookie = page.locator(".cookie-message");
  await expect(cookie).toBeVisible();
  await cookie.getByRole("link", { name: "Allow cookies" }).click();
  await expect(cookie).toBeHidden();
  await expect(root).toHaveAttribute("data-decor-cookie-choice", "accept");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".cookie-message")).toBeVisible();
  await page.locator(".cookie-message").getByRole("link", { name: "Reject cookies" }).click();
  await expect(page.locator(".cookie-message")).toBeHidden();
  await expect(page.locator("[data-decor-store-source-parity]")).toHaveAttribute(
    "data-decor-cookie-choice",
    "reject",
  );
  expect(
    requests.filter((url) => /cookie|consent/i.test(url) && !url.includes("127.0.0.1")),
  ).toEqual([]);
});

test("fixed controls follow source breakpoints, thresholds, progress, and back-to-top", async ({
  page,
}) => {
  await prepare(page);
  const sticky = page.locator(".sticky-wrap");
  const progress = page.locator(".scroll-progress");
  await expect(sticky).toHaveAttribute("data-sticky-visible", "true");
  await expect(sticky).toHaveClass(/shadow-in/);
  await expect(progress).toHaveAttribute("data-scroll-visible", "false");
  await page.evaluate(() => window.scrollTo(0, 350));
  await expect(progress).toHaveAttribute("data-scroll-visible", "true");
  const first = Number(await progress.getAttribute("data-scroll-progress"));
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.55));
  await expect
    .poll(async () => Number(await progress.getAttribute("data-scroll-progress")))
    .toBeGreaterThan(first);
  const pointHeight = Number.parseFloat(
    await progress.locator(".scroll-point").evaluate((node) => getComputedStyle(node).height),
  );
  expect(pointHeight).toBeGreaterThan(0);
  await progress.getByRole("button", { name: "Back to top" }).click();
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 2_000 }).toBeLessThan(5);
  await expect(progress).toHaveAttribute("data-scroll-visible", "false");
});

test("mobile keeps source fixed controls hidden without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  await expect(page.locator(".sticky-wrap")).toBeHidden();
  await expect(page.locator(".scroll-progress")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test("page visibility pauses Hero and every timed body capability", async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#decor-store-slider")).toHaveAttribute(
    "data-decor-hero-page-hidden",
    "true",
  );
  for (const key of ["promotional-marquee", "collection-carousel", "client-marquee"]) {
    await expect(page.locator(`[data-decor-region='${key}']`)).toHaveAttribute(
      "data-motion-paused",
      "true",
    );
  }
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#decor-store-slider")).toHaveAttribute(
    "data-decor-hero-page-hidden",
    "false",
  );
});

test("fast unmount leaves no Decor DOM or acceptance globals", async ({ page }) => {
  await page.route("**/jquery.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const appRoot = document.querySelector("#__nuxt") as
      (HTMLElement & { __vue_app__?: unknown }) | null;
    return Boolean(appRoot?.__vue_app__);
  });
  await expect(page.locator("[data-decor-store-source-parity]")).toHaveAttribute(
    "data-decor-body-ready",
    "true",
  );
  await page.evaluate(() => {
    const appRoot = document.querySelector("#__nuxt") as
      (HTMLElement & { __vue_app__?: { unmount(): void } }) | null;
    appRoot?.__vue_app__?.unmount();
  });
  await page.waitForTimeout(800);
  await expect(
    page.locator(
      "[data-decor-store-source-parity], .revslider-initialised, .sticky-wrap, .scroll-progress",
    ),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __decorStoreBodyFailure?: string;
            __decorStoreForceInitError?: boolean;
            __decorStoreHeroTestState?: unknown;
          }
        ).__decorStoreHeroTestState,
    ),
  ).toBeUndefined();
});

test("body renders every source region in order with frozen inventory counts", async ({ page }) => {
  await prepare(page);
  const regions = page.locator("[data-decor-region]");
  await expect(regions).toHaveCount(7);
  expect(
    await regions.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-decor-region")),
    ),
  ).toEqual([
    "featured-categories",
    "products",
    "promotional-marquee",
    "collection-carousel",
    "client-marquee",
    "journal",
    "services",
  ]);
  await expect(
    page.locator("[data-decor-region='featured-categories'] .categories-style-01"),
  ).toHaveCount(6);
  await expect(
    page.locator("[data-decor-region='featured-categories'] .filter-content .grid-item"),
  ).toHaveCount(3);
  await expect(page.locator("[data-decor-region='products'] .shop-box.pb-25px")).toHaveCount(16);
  await expect(page.locator("[data-decor-region='promotional-marquee'] .swiper-slide")).toHaveCount(
    6,
  );
  await expect(page.locator("[data-decor-region='collection-carousel'] .swiper-slide")).toHaveCount(
    3,
  );
  await expect(page.locator("[data-decor-region='client-marquee'] .swiper-slide")).toHaveCount(8);
  await expect(page.locator("[data-decor-region='journal'] .blog-wrapper .grid-item")).toHaveCount(
    4,
  );
  await expect(page.locator("[data-decor-region='services'] .icon-with-text-style-08")).toHaveCount(
    4,
  );
  await expect(page.locator("[data-decor-region='products'] .shop-wrapper").first()).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(
    page.locator("[data-decor-region='products'] #tab_five1 .grid-item").first(),
  ).toBeVisible();

  const promotions = page.locator(
    "[data-decor-region='featured-categories'] .filter-content .grid-item",
  );
  const [lead, secondary, tertiary] = await Promise.all([
    promotions.nth(0).boundingBox(),
    promotions.nth(1).boundingBox(),
    promotions.nth(2).boundingBox(),
  ]);
  expect(lead?.height).toBeGreaterThan((secondary?.height || 0) * 1.8);
  expect(secondary?.x).toBeGreaterThan((lead?.x || 0) + 100);
  expect(tertiary?.x).toBeCloseTo(secondary?.x || 0, 0);
  expect(tertiary?.y).toBeGreaterThan(secondary?.y || 0);

  for (const selector of [
    "[data-decor-region='products'] #tab_five1 .grid-item",
    "[data-decor-region='journal'] .grid-item",
  ]) {
    const firstRowX = await page
      .locator(selector)
      .evaluateAll((nodes) => nodes.slice(0, 4).map((node) => node.getBoundingClientRect().x));
    expect(new Set(firstRowX).size).toBe(4);
  }
});

test("product tabs preserve counts, current semantics, focus, and source panels", async ({
  page,
}) => {
  await prepare(page);
  const products = page.locator("[data-decor-region='products']");
  const tabs = products.getByRole("tab");
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(
    products.getByRole("tabpanel").filter({ visible: true }).locator(".shop-box.pb-25px"),
  ).toHaveCount(8);
  await tabs.nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(products.locator("#tab_five2:not([hidden]) .shop-box.pb-25px")).toHaveCount(8);
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(0)).toBeFocused();
});

test("all product cards expose typed actions to pointer, keyboard, and touch", async ({ page }) => {
  const root = await prepare(page);
  const card = page.locator("[data-decor-region='products'] #tab_five1 .grid-item").nth(1);
  await card.locator(".shop-box").hover();
  await card.getByRole("link", { name: "Add to cart" }).click();
  await card.getByRole("link", { name: "Add to wishlist" }).focus();
  await page.keyboard.press("Enter");
  await card.getByRole("link", { name: "Quick shop" }).tap();
  await expect(root).toHaveAttribute("data-preview-intent-count", "3");
});

test("category and journal links emit typed destinations while services remain source-static", async ({
  page,
}) => {
  const root = await prepare(page);
  const category = page
    .locator("[data-decor-region='featured-categories']")
    .getByRole("link", { name: "Lamp" });
  const article = page
    .locator("[data-decor-region='journal']")
    .getByRole("link", { name: /best influencers/i });
  await expect(category).toHaveAttribute("href", "/shop");
  await expect(article).toHaveAttribute("href", "/blog/best-influencers-for-decor-inspiration");
  await expect(
    page.locator("[data-decor-region='services'] a, [data-decor-region='services'] button"),
  ).toHaveCount(0);
  const services = page.locator("[data-decor-region='services']");
  for (const label of ["Free shipping", "Store locator", "Secure payment", "Online support"]) {
    await expect(services).toContainText(label);
  }
  const intentCount = await root.getAttribute("data-preview-intent-count");
  await category.evaluate((anchor) => {
    const preventNativeNavigation = (event: MouseEvent) => {
      document.removeEventListener("click", preventNativeNavigation, true);
      event.preventDefault();
    };
    document.addEventListener("click", preventNativeNavigation, true);
    anchor.dispatchEvent(
      new MouseEvent("click", { bubbles: true, button: 0, cancelable: true, ctrlKey: true }),
    );
  });
  await expect(page).toHaveURL(/\/$/);
  await expect(root).toHaveAttribute("data-preview-intent-count", intentCount || "0");
  await category.click();
  await expect(page).toHaveURL(/\/shop$/);
  await prepare(page);
  await page
    .locator("[data-decor-region='journal']")
    .getByRole("link", { name: /best influencers/i })
    .click();
  await expect(page).toHaveURL(/\/blog\/best-influencers-for-decor-inspiration$/);
});

test("first timed capability moves left, loops, and pauses independently", async ({ page }) => {
  await prepare(page);
  const region = page.locator("[data-decor-region='promotional-marquee']");
  const track = region.locator(".swiper-wrapper");
  await expect(region).toHaveAttribute("data-motion-direction", "left");
  await expect(region).toHaveAttribute("data-motion-loop", "true");
  const start = await track.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41);
  await page.waitForTimeout(350);
  const moving = await track.evaluate(
    (node) => new DOMMatrix(getComputedStyle(node).transform).m41,
  );
  expect(moving).toBeLessThan(start);
  await region.hover();
  await expect(region).toHaveAttribute("data-motion-paused", "true");
  const paused = await track.evaluate(
    (node) => new DOMMatrix(getComputedStyle(node).transform).m41,
  );
  await page.waitForTimeout(250);
  expect(
    await track.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41),
  ).toBeCloseTo(paused, 0);
});

test("collection carousel supports autoplay, manual controls, pause, and resize", async ({
  page,
}) => {
  await prepare(page);
  const region = page.locator("[data-decor-region='collection-carousel']");
  const initial = Number(await region.getAttribute("data-carousel-index"));
  await region.getByRole("button", { name: "Next product" }).click();
  await expect(region).toHaveAttribute("data-carousel-index", String((initial + 1) % 3));
  await region.getByRole("button", { name: "Previous product" }).click();
  await expect(region).toHaveAttribute("data-carousel-index", String(initial));
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect
    .poll(() => region.getAttribute("data-carousel-index"), { timeout: 4_000 })
    .toBe(String((initial + 1) % 3));
  await region.hover();
  await expect(region).toHaveAttribute("data-motion-paused", "true");
  const paused = await region.getAttribute("data-carousel-index");
  await page.waitForTimeout(3_200);
  expect(await region.getAttribute("data-carousel-index")).toBe(paused);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(region.locator(".swiper-slide:not([hidden])")).toHaveCount(1);
});

test("client marquee has real continuous motion and source sequence", async ({ page }) => {
  await prepare(page);
  const region = page.locator("[data-decor-region='client-marquee']");
  const track = region.locator(".swiper-wrapper");
  await expect(region).toHaveAttribute("data-motion-direction", "left");
  await expect(region).toHaveAttribute("data-motion-loop", "true");
  const start = await track.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41);
  await page.waitForTimeout(350);
  expect(
    await track.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m41),
  ).toBeLessThan(start);
});

test("reduced motion stops automatic body motion while manual controls remain", async ({
  page,
}) => {
  await prepare(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const key of ["promotional-marquee", "collection-carousel", "client-marquee"]) {
    await expect(page.locator(`[data-decor-region='${key}']`)).toHaveAttribute(
      "data-motion-paused",
      "true",
    );
  }
  const collection = page.locator("[data-decor-region='collection-carousel']");
  const initial = Number(await collection.getAttribute("data-carousel-index"));
  await collection.getByRole("button", { name: "Next product" }).click();
  await expect(collection).toHaveAttribute("data-carousel-index", String((initial + 1) % 3));
});

test("one failed capability falls back without blanking siblings", async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { __decorStoreBodyFailure?: string }).__decorStoreBodyFailure =
      "promotional-marquee";
  });
  await prepare(page);
  await expect(page.locator("[data-decor-region='promotional-marquee']")).toHaveAttribute(
    "data-body-status",
    "fallback",
  );
  await expect(page.locator("[data-decor-region='promotional-marquee'] .swiper-slide")).toHaveCount(
    6,
  );
  await expect(page.locator("[data-decor-region='collection-carousel']")).toHaveAttribute(
    "data-body-status",
    "ready",
  );
  await expect(page.locator("[data-decor-region='journal'] .grid-item")).toHaveCount(4);
});

test("failed collection capability keeps all source slides static", async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { __decorStoreBodyFailure?: string }).__decorStoreBodyFailure =
      "collection-carousel";
  });
  await prepare(page);
  const collection = page.locator("[data-decor-region='collection-carousel']");
  await expect(collection).toHaveAttribute("data-body-status", "fallback");
  await expect(collection.locator(".swiper-slide:not([hidden])")).toHaveCount(3);
  await collection.getByRole("button", { name: "Next product" }).click();
  await expect(collection.locator(".swiper-slide:not([hidden])")).toHaveCount(3);
  await expect(page.locator("[data-decor-region='client-marquee']")).toHaveAttribute(
    "data-body-status",
    "ready",
  );
});

test("no JavaScript keeps the default panel and every timed region readable", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1024, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("#decor-store-slider > ul > li").first()).toBeVisible();
  await expect(page.locator("#decor-store-slider > ul > li").first()).toContainText("Corby sofas");
  await expect(
    page.locator("[data-decor-region='products'] #tab_five1 .shop-box.pb-25px"),
  ).toHaveCount(8);
  await expect(
    page.locator("[data-decor-region='products'] #tab_five1 .shop-box.pb-25px").first(),
  ).toBeVisible();
  await expect(page.locator("[data-decor-region='products'] #tab_five2")).toBeHidden();
  await expect(page.locator("[data-decor-region='promotional-marquee'] .swiper-slide")).toHaveCount(
    6,
  );
  await expect(page.locator("[data-decor-region='collection-carousel'] .swiper-slide")).toHaveCount(
    3,
  );
  await expect(page.locator("[data-decor-region='client-marquee'] .swiper-slide")).toHaveCount(8);
  await expect(page.locator("footer.footer-dark")).toContainText("Newsletter");
  await expect(page.locator(".cookie-message")).toBeVisible();
  await expect(page.locator("[data-decor-newsletter-form]")).not.toHaveAttribute(
    "action",
    /subscribe-newsletter\.php/,
  );
  await context.close();
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet-landscape", width: 1024, height: 900 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`${viewport.name} body has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepare(page);
    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
  });
}
