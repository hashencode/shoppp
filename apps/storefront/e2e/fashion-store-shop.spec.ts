import { expect, test, type Page } from "@playwright/test";

import { recordThemeBehaviorEvidence } from "./support/theme-behavior-evidence";

const sourceOrigin = `http://127.0.0.1:${Number(
  process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427,
)}`;

const shopPages = [
  {
    layout: "left",
    route: "/shop",
    sourceEntry: "demo-fashion-store-shop.html",
  },
  {
    layout: "none",
    route: "/shop/no-sidebar",
    sourceEntry: "demo-fashion-store-no-sidebar.html",
  },
  {
    layout: "right",
    route: "/shop/right-sidebar",
    sourceEntry: "demo-fashion-store-right-sidebar.html",
  },
] as const;

async function prepareImplementation(
  page: Page,
  route: string,
  dismissCookie = true,
): Promise<void> {
  await page.goto(route, { waitUntil: "networkidle" });
  await page.locator("[data-fashion-store-shop][data-runtime-status='ready']").waitFor();
  await page.evaluate(async () => document.fonts.ready);
  if (dismissCookie) await page.getByRole("button", { name: "Allow cookies" }).click();
}

async function productColumnCount(page: Page): Promise<number> {
  const tops = await page
    .locator("[data-fashion-store-shop] .shop-modern > .grid-item")
    .evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
  return tops.filter((top) => top === tops[0]).length;
}

for (const shopPage of shopPages) {
  test(`${shopPage.layout} Shop preserves source structure and responsive geometry`, async ({
    page,
  }, testInfo) => {
    await prepareImplementation(page, shopPage.route, false);
    const shop = page.locator("[data-fashion-store-shop]");
    await expect(shop).toHaveAttribute("data-layout", shopPage.layout);
    await expect(shop.locator("h1")).toHaveText("Shop");
    await expect(shop.locator("h1")).toBeVisible();
    await expect(shop.locator("section:nth-of-type(1) .row")).toHaveCSS("opacity", "1");
    await expect(shop.locator(".shop-modern > .grid-item")).toHaveCount(12);
    await expect(shop.locator(".pagination .page-item.active .page-link")).toHaveText("02");
    await expect(shop.locator(".pagination [aria-current='page']")).toHaveCount(1);
    await expect(shop.locator(".shop-sidebar")).toHaveCount(shopPage.layout === "none" ? 0 : 1);
    await expect(page.locator("#cookies-model")).toBeVisible();
    await page.getByRole("button", { name: "Allow cookies" }).click();
    await expect(page.locator("#cookies-model")).toHaveCount(0);

    const expectedColumns =
      page.viewportSize()!.width >= 1400 ? 4 : page.viewportSize()!.width >= 768 ? 3 : 1;
    expect(await productColumnCount(page)).toBe(expectedColumns);
    const [headerNavigation, pageTitle] = await Promise.all([
      page.locator("header .navbar").boundingBox(),
      shop.locator("section:nth-of-type(1)").boundingBox(),
    ]);
    const viewportWidth = page.viewportSize()!.width;
    expect(Math.round(headerNavigation!.y)).toBe(
      viewportWidth >= 992 ? 40 : viewportWidth >= 576 ? 41 : 0,
    );
    expect(Math.round(pageTitle!.y)).toBe(
      viewportWidth >= 992 ? 118 : viewportWidth >= 576 ? 119 : 79,
    );
    expect(
      await shop
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    ).toBe(true);

    if (testInfo.project.name === "fashion-store-desktop") {
      const source = await page.context().newPage();
      try {
        await source.goto(`${sourceOrigin}/${shopPage.sourceEntry}`, {
          waitUntil: "networkidle",
        });
        await source.locator(".grid:not(.grid-loading)").waitFor({ timeout: 15_000 });
        await source.waitForFunction(
          () => document.querySelector<HTMLElement>("section.top-space-margin")?.style.marginTop,
        );
        await source.evaluate(async () => document.fonts.ready);
        await expect(source.locator("section:nth-of-type(2) .grid-item")).toHaveCount(12);
        await expect(source.locator(".shop-sidebar")).toHaveCount(
          shopPage.layout === "none" ? 0 : 1,
        );

        const [sourceGrid, implementationGrid] = await Promise.all([
          source.locator("section:nth-of-type(2) .shop-modern").boundingBox(),
          shop.locator("section:nth-of-type(2) .shop-modern").boundingBox(),
        ]);
        expect(sourceGrid).not.toBeNull();
        expect(implementationGrid).not.toBeNull();
        const [sourceTitle, implementationTitle] = await Promise.all([
          source.locator("section:nth-of-type(1)").boundingBox(),
          shop.locator("section:nth-of-type(1)").boundingBox(),
        ]);
        expect(Math.abs(sourceTitle!.y - implementationTitle!.y)).toBeLessThanOrEqual(1);
        expect(
          Math.abs(
            sourceGrid!.width / source.viewportSize()!.width -
              implementationGrid!.width / page.viewportSize()!.width,
          ),
        ).toBeLessThan(0.03);

        if (shopPage.layout !== "none") {
          const [sourceSidebar, implementationSidebar] = await Promise.all([
            source.locator(".shop-sidebar").boundingBox(),
            shop.locator(".shop-sidebar").boundingBox(),
          ]);
          expect(sourceSidebar).not.toBeNull();
          expect(implementationSidebar).not.toBeNull();
          expect(sourceSidebar!.x < sourceGrid!.x).toBe(shopPage.layout === "left");
          expect(implementationSidebar!.x < implementationGrid!.x).toBe(shopPage.layout === "left");
        }
      } finally {
        await source.close();
      }
    }
  });
}

test("shop-product-hover interaction: pointer, keyboard, and touch expose operable product actions", async ({
  page,
}, testInfo) => {
  test.skip(
    !["fashion-store-desktop", "fashion-store-mobile"].includes(testInfo.project.name),
    "The contract branches are exercised at their boundary viewports.",
  );
  await prepareImplementation(page, "/shop/no-sidebar");
  const product = page.locator(".shop-modern > .grid-item").first();
  const addToCart = product.getByRole("button", { name: "Add to cart" });

  if (testInfo.project.name === "fashion-store-mobile") {
    const box = await product.locator(".shop-image").boundingBox();
    expect(box).not.toBeNull();
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(addToCart).toHaveCSS("visibility", "visible");
    await addToCart.tap();
    await expect(page.locator("[data-fashion-store-shop]")).toHaveAttribute(
      "data-preview-intent-count",
      "1",
    );
    recordThemeBehaviorEvidence(testInfo, {
      actionOutcome: true,
      behaviorId: "shop-product-actions",
      branches: [{ id: "touch", outcome: true, viewportId: "mobile" }],
      mode: "interaction",
    });
    return;
  }

  await product.hover();
  await expect(addToCart).toHaveCSS("visibility", "visible");
  await product.getByRole("button", { name: "Add to wishlist" }).focus();
  await expect(product.locator(".shop-hover")).toHaveCSS("opacity", "1");
  await addToCart.click();
  await expect(page.locator("[data-fashion-store-shop]")).toHaveAttribute(
    "data-preview-intent-count",
    "1",
  );
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "shop-product-actions",
    branches: [
      { id: "pointer", outcome: true, viewportId: "desktop" },
      { id: "keyboard", outcome: true, viewportId: "desktop" },
    ],
    mode: "interaction",
  });
});

test("Shop filters combine source controls without implementation-only result copy", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Interaction evidence runs once.");
  await prepareImplementation(page, "/shop");
  const shop = page.locator("[data-fashion-store-shop]");
  const jeans = shop.locator(".category-filter button", { hasText: "Jeans" });
  const cotton = shop.locator(".tag-cloud a", { hasText: "Cotton" });
  await cotton.click();
  await expect(shop).toHaveAttribute("data-active-tag", "Cotton");
  await expect(shop).toHaveAttribute("data-visible-product-count", "3");
  await expect(shop.locator(".shop-modern > .grid-item")).toHaveCount(3);
  await cotton.click();
  await expect(shop).not.toHaveAttribute("data-active-tag", "Cotton");
  await expect(shop.locator(".shop-modern > .grid-item")).toHaveCount(12);
  await jeans.click();
  await expect(shop.locator(".shop-modern > .grid-item")).toHaveCount(2);
  await jeans.press("Enter");
  await expect(shop.locator(".shop-modern > .grid-item")).toHaveCount(12);
  await shop.locator(".color-filter button", { hasText: "Blue" }).click();
  await shop.locator(".size-filter button", { hasText: "M" }).click();
  await shop.locator(".tag-cloud a", { hasText: "Cotton" }).click();
  await jeans.focus();
  await jeans.press("Enter");
  await expect(shop.locator(".shop-modern > .grid-item")).toHaveCount(1);
  await expect(shop).not.toContainText(/products? (found|shown|remaining)/i);
  await expect(jeans).toBeFocused();
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "shop-filters",
    branches: [
      { id: "pointer", outcome: true, viewportId: "desktop" },
      { id: "keyboard", outcome: true, viewportId: "desktop" },
    ],
    mode: "interaction",
  });
});

test("Shop pagination preserves focus and source page semantics", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Focus behavior runs once.");
  await prepareImplementation(page, "/shop/right-sidebar");
  const thirdPage = page.locator(".pagination .page-link", { hasText: "03" });
  await thirdPage.focus();
  await thirdPage.press("Enter");
  await expect(thirdPage).toBeFocused();
  await expect(thirdPage).toHaveAttribute("aria-current", "page");
});

test("Shop arrivals advance, pause, respond to keys, and remount cleanly", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Temporal evidence runs once.");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await prepareImplementation(page, "/shop");
  const carousel = page.locator(".slider-one-slide");
  const arrivalTrack = carousel.locator(".swiper-wrapper");
  await expect(arrivalTrack).toHaveCSS("transition-duration", "0.3s");
  const initialTransform = await arrivalTrack.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  const before = Number(await carousel.getAttribute("data-arrival-index"));
  await expect
    .poll(() => carousel.getAttribute("data-arrival-index"), { timeout: 6_500 })
    .not.toBe(String(before));
  const after = Number(await carousel.getAttribute("data-arrival-index"));
  await page.waitForTimeout(350);
  expect(await arrivalTrack.evaluate((element) => getComputedStyle(element).transform)).not.toBe(
    initialTransform,
  );

  await carousel.focus();
  await page.keyboard.press("ArrowRight");
  await expect(carousel).toHaveAttribute("data-arrival-index", String((after + 1) % 2));
  const pausedAt = await carousel.getAttribute("data-arrival-index");
  await page.waitForTimeout(5_250);
  await expect(carousel).toHaveAttribute("data-arrival-index", pausedAt!);

  await prepareImplementation(page, "/shop/no-sidebar");
  await expect(page.locator(".slider-one-slide")).toHaveCount(0);
  await prepareImplementation(page, "/shop/right-sidebar");
  await expect(page.locator(".slider-one-slide")).toHaveAttribute("data-arrival-index", "0");
  recordThemeBehaviorEvidence(
    testInfo,
    {
      behaviorId: "shop-new-arrivals",
      branches: [{ id: "timer", outcome: true, viewportId: "desktop" }],
      mode: "temporal",
      temporalSamples: { after, before, elapsedMs: 5_000 },
    },
    {
      actionOutcome: true,
      behaviorId: "shop-new-arrivals",
      branches: [{ id: "keyboard", outcome: true, viewportId: "desktop" }],
      mode: "interaction",
    },
  );
});

test("Shop native fallback keeps controls, links, and both arrival groups operable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-store-desktop", "Fallback evidence runs once.");
  await prepareImplementation(page, "/shop");
  const shop = page.locator("[data-fashion-store-shop]");
  await expect(shop.locator(".shop-modern > .grid-item")).toHaveCount(12);
  await expect(shop.locator(".category-filter button")).toHaveCount(7);
  await expect(shop.locator(".slider-one-slide .swiper-slide")).toHaveCount(2);
  await expect(shop.locator(".shop-modern [data-fashion-store-route]")).not.toHaveCount(0);
  recordThemeBehaviorEvidence(
    testInfo,
    { actionOutcome: true, behaviorId: "shop-filters", mode: "fallback" },
    { actionOutcome: true, behaviorId: "shop-product-actions", mode: "fallback" },
    { actionOutcome: true, behaviorId: "shop-new-arrivals", mode: "fallback" },
  );
});
