import { isFashionStoreViewport } from "./support/fashion-store-project";
import { expect, test, type Page } from "@playwright/test";

import { recordThemeBehaviorEvidence } from "./support/theme-behavior-evidence";

const sourceOrigin = `http://127.0.0.1:${Number(
  process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427,
)}`;
const productRoute = "/products/relaxed-corduroy-shirt";

async function prepareProduct(page: Page, dismissCookie = true): Promise<void> {
  await page.goto(productRoute, { waitUntil: "networkidle" });
  await page.locator("[data-fashion-store-product][data-runtime-status='ready']").waitFor();
  await page.evaluate(async () => document.fonts.ready);
  if (dismissCookie) await page.getByRole("button", { name: "Allow cookies" }).click();
}

const cart = (quantity: number) => ({
  adjustments: [],
  canCheckout: true,
  currency: "USD",
  expiresAt: "2026-08-08T00:00:00.000Z",
  id: "cart_01J00000000000000000000000",
  lines: [
    {
      availableQuantity: 20,
      lineTotal: { amount: 6_500 * quantity, currency: "USD" },
      productName: "Relaxed corduroy shirt",
      quantity,
      unitPrice: { amount: 6_500, currency: "USD" },
      variantId: "var_01JFSHIRTGREENXL000000001",
      variantName: "Green / XL",
    },
  ],
  selectedShippingMethodId: null,
  shippingAddress: null,
  shippingMethods: [],
  totals: {
    discountTotal: 0,
    grandTotal: 6_500 * quantity,
    shippingTotal: 0,
    subtotal: 6_500 * quantity,
    taxTotal: 0,
  },
});

test("Product preserves source structure, facts, assets, and responsive geometry", async ({
  page,
}, testInfo) => {
  await prepareProduct(page, false);
  const product = page.locator("[data-fashion-store-product]");
  await expect(product.locator("h1")).toHaveText("Relaxed corduroy shirt");
  await expect(product.locator(".product-image-thumb button")).toHaveCount(6);
  await expect(product.locator(".slider-product-prev, .slider-product-next")).toHaveCount(0);
  await expect(product.locator(".product-info")).toContainText("$85.00$65.00");
  await expect(product.locator("[role='tab']")).toHaveCount(4);
  await expect(
    product.locator(".fashion-product-related > .container > ul > .grid-item"),
  ).toHaveCount(4);
  const relatedCardActions = product.locator(
    "[data-fashion-store-product-card] .shop-hover button",
  );
  await expect(relatedCardActions).toHaveCount(8);
  expect(
    await relatedCardActions.evaluateAll((controls) =>
      controls.every((control) => {
        const style = getComputedStyle(control);
        return (
          style.appearance === "none" &&
          style.borderTopWidth === "0px" &&
          style.paddingTop === "0px"
        );
      }),
    ),
  ).toBe(true);
  await expect(page.locator("#cookies-model")).toBeVisible();
  await page.getByRole("button", { name: "Allow cookies" }).click();
  expect(
    await product
      .locator("img")
      .evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);

  const [breadcrumb, gallery, info] = await Promise.all([
    product.locator("section:nth-of-type(1)").boundingBox(),
    product.locator(".fashion-product-gallery .row.overflow-hidden").boundingBox(),
    product.locator(".product-info").boundingBox(),
  ]);
  const viewportWidth = page.viewportSize()!.width;
  expect(Math.round(breadcrumb!.y)).toBe(
    viewportWidth >= 992 ? 118 : viewportWidth >= 768 ? 119 : 79,
  );
  expect(gallery).not.toBeNull();
  expect(info).not.toBeNull();
  if (page.viewportSize()!.width >= 992) expect(gallery!.x).toBeLessThan(info!.x);

  if (isFashionStoreViewport(testInfo, "desktop")) {
    const source = await page.context().newPage();
    try {
      await source.goto(`${sourceOrigin}/demo-fashion-store-single-product.html`, {
        waitUntil: "networkidle",
      });
      await source.locator(".product-image-slider.swiper-initialized").waitFor({ timeout: 15_000 });
      await source.evaluate(async () => document.fonts.ready);
      const [sourceBreadcrumb, sourceGallery, sourceInfo] = await Promise.all([
        source.locator("section:nth-of-type(1)").boundingBox(),
        source.locator(".col-lg-7 .row.overflow-hidden").boundingBox(),
        source.locator(".product-info").boundingBox(),
      ]);
      expect(Math.abs(sourceBreadcrumb!.y - breadcrumb!.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(sourceGallery!.width - gallery!.width)).toBeLessThanOrEqual(8);
      expect(Math.abs(sourceInfo!.width - info!.width)).toBeLessThanOrEqual(8);
      await expect(source.locator(".product-image-thumb .swiper-slide")).toHaveCount(6);
    } finally {
      await source.close();
    }
  }
});

test("product-gallery-slide-2 temporal: gallery advances and pauses without reduced-motion drift", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Temporal evidence runs once.");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await prepareProduct(page);
  const gallery = page.locator(".product-image-slider");
  const before = Number(await gallery.getAttribute("data-gallery-index"));
  await expect
    .poll(() => gallery.getAttribute("data-gallery-index"), { timeout: 6_500 })
    .not.toBe("0");
  const after = Number(await gallery.getAttribute("data-gallery-index"));
  await gallery.focus();
  const pausedAt = await gallery.getAttribute("data-gallery-index");
  await page.waitForTimeout(5_250);
  await expect(gallery).toHaveAttribute("data-gallery-index", pausedAt!);
  recordThemeBehaviorEvidence(testInfo, {
    behaviorId: "product-gallery",
    mode: "temporal",
    temporalSamples: { after, before, elapsedMs: 5_000 },
  });
});

test("product-gallery-slide-2 interaction: gallery supports pointer, keyboard, touch, and lightbox", async ({
  page,
}, testInfo) => {
  test.skip(
    !isFashionStoreViewport(testInfo, "desktop", "mobile"),
    "Boundary viewports cover the interaction branches.",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await prepareProduct(page);
  const gallery = page.locator(".product-image-slider");
  if (isFashionStoreViewport(testInfo, "mobile")) {
    await gallery.locator(".swiper-slide-active button").tap();
    await expect(page.getByRole("dialog", { name: "Product image preview" })).toBeVisible();
    await page.getByRole("button", { name: "Close product image preview" }).tap();
    await productThumbnail(page, 1).tap();
    await expect(gallery).toHaveAttribute("data-gallery-index", "1");
    recordThemeBehaviorEvidence(testInfo, {
      actionOutcome: true,
      behaviorId: "product-gallery",
      branches: [{ id: "touch", outcome: true, viewportId: "mobile" }],
      mode: "interaction",
    });
    return;
  }
  const mainTrack = gallery.locator(".swiper-wrapper");
  const thumbnailTrack = page.locator(".product-image-thumb .swiper-wrapper");
  await expect(mainTrack).toHaveCSS("transition-duration", "0.3s");
  await expect(thumbnailTrack).toHaveCSS("transition-duration", "0.3s");
  const mainTransformBefore = await mainTrack.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  const thumbnailTransformBefore = await thumbnailTrack.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await gallery.hover();
  await page.waitForTimeout(350);
  const dragStartIndex = await gallery.getAttribute("data-gallery-index");
  const galleryBox = (await gallery.boundingBox())!;
  await page.mouse.move(
    galleryBox.x + galleryBox.width * 0.8,
    galleryBox.y + galleryBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    galleryBox.x + galleryBox.width * 0.2,
    galleryBox.y + galleryBox.height / 2,
    {
      steps: 12,
    },
  );
  await page.mouse.up();
  await expect.poll(() => gallery.getAttribute("data-gallery-index")).not.toBe(dragStartIndex);
  await productThumbnail(page, 4).click();
  await expect(gallery).toHaveAttribute("data-gallery-index", "4");
  await expect
    .poll(() => mainTrack.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(mainTransformBefore);
  await expect
    .poll(() => thumbnailTrack.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(thumbnailTransformBefore);
  await page.waitForTimeout(350);
  await gallery.focus();
  await page.keyboard.press("ArrowRight");
  await expect(gallery).toHaveAttribute("data-gallery-index", "5");
  await page.keyboard.press("Enter");
  const lightbox = page.getByRole("dialog", { name: "Product image preview" });
  await expect(lightbox).toBeVisible();
  const pausedWhileOpen = await gallery.getAttribute("data-gallery-index");
  await page.waitForTimeout(5_250);
  await expect(gallery).toHaveAttribute("data-gallery-index", pausedWhileOpen!);
  await expect(lightbox.locator("figcaption")).toContainText("Relaxed corduroy shirt");
  await expect(lightbox.locator("figcaption")).toContainText("6 of 6");
  await page.getByRole("button", { name: "Next preview image" }).click();
  await expect(lightbox.locator("figcaption")).toContainText("1 of 6");
  await page.getByRole("button", { name: "Previous preview image" }).click();
  await expect(lightbox.locator("figcaption")).toContainText("6 of 6");
  await page.getByRole("button", { name: "Previous preview image" }).click();
  await expect(lightbox.locator("figcaption")).toContainText("5 of 6");
  await page.getByRole("button", { name: "Next preview image" }).click();
  await expect(lightbox.locator("figcaption")).toContainText("6 of 6");
  await expect(page.getByRole("button", { name: "Close product image preview" })).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  const lightboxBox = await lightbox.boundingBox();
  expect(Math.abs(lightboxBox!.width - page.viewportSize()!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(lightboxBox!.height - page.viewportSize()!.height)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(lightbox).toBeHidden();
  await expect(gallery).toBeFocused();
  await expect(page.locator("body")).not.toHaveClass(/modal-open/);
  await gallery.evaluate((element) => (element as HTMLElement).blur());
  await expect
    .poll(() => gallery.getAttribute("data-gallery-index"), { timeout: 6_500 })
    .not.toBe(pausedWhileOpen);
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "product-gallery",
    branches: [
      { id: "pointer", outcome: true, viewportId: "desktop" },
      { id: "keyboard", outcome: true, viewportId: "desktop" },
    ],
    mode: "interaction",
  });
});

test("product lightbox load failure leaves the gallery usable and retryable", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Failure evidence runs once per engine.");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await prepareProduct(page);
  const gallery = page.locator(".product-image-slider");
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let blocked = false;
  await page.route("**/_nuxt/*.js", async (route) => {
    await route.abort();
    blocked = true;
  });

  await gallery.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => blocked).toBe(true);
  await expect(page.getByRole("dialog", { name: "Product image preview" })).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/modal-open/);
  const retry = page.getByRole("button", { name: "Reload and retry" });
  await expect(retry).toBeFocused();
  const before = await gallery.getAttribute("data-gallery-index");
  await page.keyboard.press("ArrowLeft");
  await expect(gallery).not.toHaveAttribute("data-gallery-index", before!);
  expect(pageErrors).toEqual([]);

  await page.unroute("**/_nuxt/*.js");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), retry.click()]);
  await page.locator("[data-fashion-store-product][data-runtime-status='ready']").waitFor();
  await page.evaluate(async () => document.fonts.ready);
  await gallery.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Product image preview" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/modal-open/);
});

function productThumbnail(page: Page, index: number) {
  return page.locator(".product-image-thumb button").nth(index);
}

test("product-size-m interaction: options and quantity dispatch one bounded update per action", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Interaction evidence runs once.");
  await prepareProduct(page);
  const product = page.locator("[data-fashion-store-product]");
  await page.locator("label[for='product-size-m']").click();
  await expect(product).toHaveAttribute("data-option-update-count", "1");
  await page.locator("#product-color-blue").focus();
  await page.keyboard.press("Space");
  await expect(product).toHaveAttribute("data-option-update-count", "2");
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.getByRole("spinbutton", { name: "Quantity" })).toHaveValue("2");
  await expect(product).toHaveAttribute("data-option-update-count", "3");
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "product-options",
    branches: [
      { id: "pointer", outcome: true, viewportId: "desktop" },
      { id: "keyboard", outcome: true, viewportId: "desktop" },
    ],
    mode: "interaction",
  });
});

test("Product fixture quantity normalization preserves bounded values without Commerce", async ({
  page,
}) => {
  const commerceRequests: string[] = [];
  await page.route(/\/api\/(?:cart|products)(?:[/?]|$)/, async (route) => {
    commerceRequests.push(`${route.request().method()} ${route.request().url()}`);
    await route.abort();
  });
  await prepareProduct(page);
  const product = page.locator("[data-fashion-store-product]");
  const quantity = page.getByRole("spinbutton", { name: "Quantity", exact: true });
  const cases = [
    { name: "empty at minimum", initial: 1, input: "", expected: 1 },
    { name: "non-numeric at minimum", initial: 1, input: "abc", expected: 1 },
    { name: "zero at minimum", initial: 1, input: "0", expected: 1 },
    { name: "negative at minimum", initial: 1, input: "-2", expected: 1 },
    { name: "fraction below minimum", initial: 1, input: "0.4", expected: 1 },
    { name: "fraction floors once", initial: 1, input: "3.8", expected: 3 },
    { name: "above maximum", initial: 1, input: "99", expected: 20 },
    { name: "above unchanged maximum", initial: 20, input: "99", expected: 20 },
  ];
  for (const sample of cases) {
    await test.step(sample.name, async () => {
      await quantity.fill(String(sample.initial));
      await quantity.press("Tab");
      await expect(quantity).toHaveValue(String(sample.initial));
      const before = Number(await product.getAttribute("data-option-update-count"));
      await quantity.fill(sample.input);
      await quantity.press("Tab");
      await expect.soft(quantity, sample.name).toHaveValue(String(sample.expected), {
        timeout: 1_000,
      });
      await expect
        .soft(product, sample.name)
        .toHaveAttribute(
          "data-option-update-count",
          String(before + Number(sample.expected !== sample.initial)),
        );
    });
  }
  expect(commerceRequests).toEqual([]);
});

test("Product fixture records cart intent without reaching Commerce", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Commerce evidence runs once.");
  await page.addInitScript(() => localStorage.setItem("shoppp.guest-cart-token", "cart-token"));
  let addRequests = 0;
  let requestBody: unknown;
  await page.route("**/cart", async (route) => {
    await route.fulfill({ contentType: "application/json", json: { data: cart(0) } });
  });
  await page.route("**/cart/lines", async (route) => {
    addRequests += 1;
    requestBody = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", json: { data: cart(2) } });
  });
  await prepareProduct(page);
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.locator(".product-info").getByRole("button", { name: "Add to wishlist" }).click();
  const addToCart = page.locator(".product-info .btn-cart");
  await addToCart.focus();
  await page.keyboard.press("Enter");
  expect(addRequests).toBe(0);
  await expect(page.locator("[data-fashion-store-product]")).toHaveAttribute(
    "data-cart-add-count",
    "0",
  );
  await expect(page).toHaveURL(new RegExp(`${productRoute}$`));
  expect(requestBody).toBeUndefined();
  await expect(page.locator("[data-fashion-store-product]")).toHaveAttribute(
    "data-preview-intent-count",
    "2",
  );
  await expect(page.getByRole("status")).toContainText(
    "Preview cart intent recorded. No Commerce cart was changed.",
  );
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "product-commerce-actions",
    branches: [
      { id: "pointer", outcome: true, viewportId: "desktop" },
      { id: "keyboard", outcome: true, viewportId: "desktop" },
    ],
    mode: "interaction",
  });
});

test("product-reviews-tab interaction: tabs are keyboard operable and review data stays local", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Interaction evidence runs once.");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });
  await prepareProduct(page);
  const description = page.getByRole("tab", { name: "Description" });
  await description.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Additional information" })).toBeFocused();
  await page.getByRole("tab", { name: "Reviews (3)" }).click();
  await expect(page.getByRole("tabpanel", { name: "Reviews (3)" })).toBeVisible();
  await page.getByLabel("Your name*").fill("Ada");
  await page.getByLabel("Your email address*").fill("ada@example.test");
  await page.getByLabel(/I accept the crafto/).check();
  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.locator("[data-fashion-store-product]")).toHaveAttribute(
    "data-review-attempt-count",
    "1",
  );
  expect(requests).toEqual([]);
  recordThemeBehaviorEvidence(testInfo, {
    actionOutcome: true,
    behaviorId: "product-tabs-reviews",
    branches: [
      { id: "pointer", outcome: true, viewportId: "desktop" },
      { id: "keyboard", outcome: true, viewportId: "desktop" },
    ],
    mode: "interaction",
  });
});

test("Product fallback, reduced motion, unknown slug, and remount remain readable", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Fallback evidence runs once.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepareProduct(page);
  const gallery = page.locator(".product-image-slider");
  await page.waitForTimeout(5_250);
  await expect(gallery).toHaveAttribute("data-gallery-index", "0");
  await expect(page.locator(".product-image-thumb button")).toHaveCount(6);
  await expect(page.locator(".fashion-product-tab-panel")).toHaveCount(4);
  await prepareProduct(page);
  await expect(gallery).toHaveAttribute("data-gallery-index", "0");
  await page.goto("/products/unknown-product", { waitUntil: "networkidle" });
  await expect(page.locator("[data-fashion-store-product]")).toHaveCount(0);
  await expect(page.getByText("Relaxed corduroy shirt")).toHaveCount(0);
  recordThemeBehaviorEvidence(
    testInfo,
    { actionOutcome: true, behaviorId: "product-gallery", mode: "fallback" },
    { actionOutcome: true, behaviorId: "product-options", mode: "fallback" },
    { actionOutcome: true, behaviorId: "product-commerce-actions", mode: "fallback" },
    { actionOutcome: true, behaviorId: "product-tabs-reviews", mode: "fallback" },
  );
});
