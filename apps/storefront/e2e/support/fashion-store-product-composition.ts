import { expect, type Page } from "@playwright/test";

const geometryTolerancePx = 2;

interface FashionStoreProductCompositionExpectation {
  assurance: "populated" | "source-shaped-empty";
  expectedSwatches: readonly string[];
  name: string;
  relatedProductCount: number;
  secondaryActionCount: number;
  viewport: "desktop" | "mobile";
}

export async function expectFashionStoreProductComposition(
  page: Page,
  expectation: FashionStoreProductCompositionExpectation,
): Promise<void> {
  const product = page.locator("[data-fashion-store-product]");
  await expect(product).toHaveAttribute("data-runtime-status", "ready");
  await expect(product.locator("h1")).toHaveText(expectation.name);
  await expect(
    product.locator(
      ".top-space-margin > .container-fluid > .row.align-items-center > .col-12.breadcrumb",
    ),
  ).toHaveCount(1);
  const secondaryActions = product.locator(".product-info .fashion-product-secondary-actions");
  await expect(secondaryActions).toHaveCount(1);
  await expect(secondaryActions.locator(".icon-with-text-style-08 .feature-box")).toHaveCount(
    expectation.secondaryActionCount,
  );
  await expect(
    product.locator(".fashion-product-options > fieldset:not(:last-child) > .d-flex.mb-20px"),
  ).toHaveCount(1);
  await expect(
    product.locator(".fashion-product-options > fieldset:last-child > .d-flex.mb-35px"),
  ).toHaveCount(1);

  const swatches = product.locator("[data-product-option-swatch]");
  await expect(swatches).toHaveCount(expectation.expectedSwatches.length);
  expect(
    await swatches.evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).backgroundColor),
    ),
  ).toEqual(
    expectation.expectedSwatches.map((swatch) => {
      const channels = swatch
        .slice(1)
        .match(/.{2}/g)!
        .map((channel) => Number.parseInt(channel, 16));
      return `rgb(${channels.join(", ")})`;
    }),
  );
  expect(
    await swatches.evaluateAll((elements) =>
      elements.every((element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return style.borderStyle === "none" && bounds.height >= 20 && bounds.width >= 20;
      }),
    ),
  ).toBe(true);

  await expect(product.locator("#tab > .container > .row > .col-12.tab-style-04")).toHaveCount(1);
  await expect(product.locator("#tab .tab-content > .tab-pane")).toHaveCount(4);
  await expect(
    product.locator(".fashion-product-related h2 .text-highlight > .bg-base-color"),
  ).toHaveCount(expectation.relatedProductCount > 0 ? 1 : 0);
  await expect(
    product.locator(".fashion-product-related > .container > ul > .grid-item"),
  ).toHaveCount(expectation.relatedProductCount);
  await expect(product.locator("[data-product-assurance]")).toHaveCount(1);
  await expect(product.locator("[data-product-assurance]")).toHaveAttribute(
    "data-product-region-state",
    "assurance",
  );
  if (expectation.assurance === "source-shaped-empty") {
    await expect(product.locator("[data-product-assurance]")).toContainText(
      "Delivery timing: Not available",
    );
    await expect(product.locator("[data-product-assurance]")).toContainText(
      "Shipping & returns: Not available",
    );
    await expect(product.locator("[data-product-assurance]")).not.toContainText(
      "Guarantee safe and secure checkout",
    );
    await expect(product.locator(".fashion-product-payments")).toContainText(
      "Payment methods are not available.",
    );
    await expect(product.locator(".fashion-product-payments img")).toHaveCount(0);
  } else {
    await expect(product.locator("[data-product-assurance]")).toContainText(
      "Delivery timing: Delivery timing is confirmed for your destination at checkout.",
    );
    await expect(product.locator("[data-product-assurance]")).toContainText(
      "Shipping & returns: Eligible unused items may be returned within 30 days of delivery.",
    );
    await expect(product.locator(".fashion-product-payments img")).toHaveCount(6);
  }

  const [breadcrumb, gallery, info, overflow] = await Promise.all([
    product.locator("section:nth-of-type(1)").boundingBox(),
    product.locator(".fashion-product-gallery .row.overflow-hidden").boundingBox(),
    product.locator(".product-info").boundingBox(),
    page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ]);
  expect(breadcrumb).not.toBeNull();
  expect(gallery).not.toBeNull();
  expect(info).not.toBeNull();
  expect(Math.round(breadcrumb!.y)).toBe(expectation.viewport === "desktop" ? 96 : 80);
  expect(overflow).toBeLessThanOrEqual(geometryTolerancePx);
  if (expectation.viewport === "desktop") {
    expect(gallery!.x).toBeLessThan(info!.x);
    expect(gallery!.width).toBeGreaterThan(info!.width);
  } else {
    expect(Math.abs(gallery!.x - info!.x)).toBeLessThanOrEqual(geometryTolerancePx);
    expect(gallery!.y).toBeLessThan(info!.y);
  }
}
