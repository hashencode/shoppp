import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

interface CatalogProduct {
  description: string;
  id: string;
  media: Array<{ sourcePath: string }>;
  name: string;
  presentation?: {
    colorMediaIds?: Record<string, string[]>;
    detailMediaId?: string;
    specifications: Array<{ label: string; value: string }>;
  };
  shopCardOrder: number | null;
  slug: string;
  variants: Array<{
    id: string;
    optionValues: Record<string, string>;
    price: { amount: number; currency: string };
    sku: string;
  }>;
}

async function installCharcoalDemoCommerce(page: Page, shirt: CatalogProduct) {
  await page.addInitScript(() =>
    localStorage.setItem("shoppp.guest-cart-token", "demo-cart-token"),
  );
  let addedVariantId: string | null = null;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (path.startsWith(`/catalog/products/by-id/${shirt.id}/live`)) {
      await route.fulfill({
        json: {
          data: {
            description: shirt.description,
            id: shirt.id,
            media: [],
            name: shirt.name,
            options: [
              { name: "color", values: ["Charcoal", "Gold", "Blue", "Green"] },
              { name: "size", values: ["S", "M", "L", "XL"] },
            ],
            slug: shirt.slug,
            status: "published",
            variants: shirt.variants.map((variant) => ({
              available: true,
              id: variant.id,
              options: variant.optionValues,
              price: variant.price,
              sku: variant.sku,
            })),
          },
        },
      });
      return;
    }
    if (path === "/cart" || path === "/cart/lines") {
      if (path === "/cart/lines") {
        addedVariantId = (route.request().postDataJSON() as { variantId: string }).variantId;
      }
      await route.fulfill({
        json: {
          data: {
            adjustments: [],
            canCheckout: true,
            currency: "USD",
            id: "cart_demo",
            lines: addedVariantId
              ? [
                  {
                    availableQuantity: 20,
                    lineTotal: { amount: 6500, currency: "USD" },
                    productName: shirt.name,
                    quantity: 1,
                    unitPrice: { amount: 6500, currency: "USD" },
                    variantId: addedVariantId,
                    variantName:
                      shirt.variants.find(({ id }) => id === addedVariantId)?.optionValues.color ??
                      "",
                  },
                ]
              : [],
            shippingMethods: [],
            totals: {
              discountTotal: 0,
              grandTotal: addedVariantId ? 6500 : 0,
              shippingTotal: 0,
              subtotal: addedVariantId ? 6500 : 0,
              taxTotal: 0,
            },
          },
        },
      });
      return;
    }
    await route.abort();
  });
  return () => addedVariantId;
}

test("all 13 Product routes show their own content, approved demo review state, and owned gallery", async ({
  page,
}) => {
  test.skip(
    process.env.STOREFRONT_FASHION_PRODUCT_CONTENT_CATALOG !== "1",
    "Product content profile is opt-in.",
  );
  test.setTimeout(120_000);
  const catalog = JSON.parse(
    await readFile(
      new URL("../../../tools/fashion-store-product-content-catalog.json", import.meta.url),
      "utf8",
    ),
  ) as { products: CatalogProduct[] };
  await page.setViewportSize({ width: 390, height: 844 });

  for (const product of catalog.products) {
    await page.goto(`/products/${product.slug}`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-fashion-store-product]").waitFor();
    await expect(page.locator(".product-info h4").first()).toHaveText(product.name);
    await expect(page.locator(".product-info")).toContainText(product.description);
    await expect(page.locator(".fashion-product-gallery img").first()).toBeVisible();
    const descriptionImage = page.locator("#product-panel-description img");
    await expect(descriptionImage).toHaveCount(1);
    await expect
      .poll(() =>
        descriptionImage.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await expect(page.locator(".fashion-product-thumb-control")).toHaveCount(
      product.presentation?.colorMediaIds?.Charcoal?.length ??
        product.media.length - (product.presentation?.detailMediaId ? 1 : 0),
    );
    if (
      product.shopCardOrder !== null &&
      product.media.some(({ sourcePath }) => sourcePath.includes("/fashion-store-generated/"))
    ) {
      const derivative = page
        .locator(".fashion-product-gallery img[src^='/media/fashion-store-generated/']")
        .first();
      await expect(derivative).toHaveAttribute("src", /product-\d+-detail-v1\.jpg/);
      await expect
        .poll(() =>
          derivative.evaluate(
            (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }
    if (product.shopCardOrder !== null) {
      await page.getByRole("tab", { name: "Additional information" }).click();
      for (const { label, value } of product.presentation?.specifications ?? []) {
        await expect(page.locator("#product-panel-information")).toContainText(label);
        await expect(page.locator("#product-panel-information")).toContainText(value);
      }
      await expect(page.getByRole("tab", { name: "Reviews (4)" })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  }
});

test("Product summary keeps stars together at every acceptance width", async ({ page }) => {
  test.skip(
    process.env.STOREFRONT_FASHION_PRODUCT_CONTENT_CATALOG !== "1",
    "Product content profile is opt-in.",
  );
  for (const width of [320, 390, 768, 992, 1024, 1100, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/products/bermuda-shorts-10", { waitUntil: "domcontentloaded" });
    await page.locator("[data-fashion-store-product]").waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const stars = page.locator(".fashion-product-rating-star-group");
    const box = await stars.boundingBox();
    expect(box?.width).toBeGreaterThan(60);
    expect(box?.height).toBeLessThan(35);
  }
});

test("Shop cards navigate to their own corrected Product record", async ({ page }) => {
  test.skip(
    process.env.STOREFRONT_FASHION_PRODUCT_CONTENT_CATALOG !== "1",
    "Product content profile is opt-in.",
  );
  await page.goto("/shop", { waitUntil: "domcontentloaded" });
  const card = page
    .locator("[data-fashion-store-product-card]")
    .filter({ hasText: "Navy single-button blazer" })
    .first();
  await expect(card).toBeVisible();
  await card.locator("a[href='/products/sequined-dress-09']").first().click();
  await expect(page).toHaveURL(/\/products\/sequined-dress-09$/);
  await expect(page.locator(".product-info h4").first()).toHaveText("Navy single-button blazer");
  await expect(page.locator(".product-info")).toContainText("SKU: FS-SEQUINED-DRESS-09");
});

test("shirt color swatches switch matching images and select the matching SKU", async ({
  page,
}) => {
  test.skip(
    process.env.STOREFRONT_FASHION_PRODUCT_CONTENT_CATALOG !== "1",
    "Product content profile is opt-in.",
  );
  const catalog = JSON.parse(
    await readFile(
      new URL("../../../tools/fashion-store-product-content-catalog.json", import.meta.url),
      "utf8",
    ),
  ) as { products: CatalogProduct[] };
  const shirt = catalog.products.find(({ slug }) => slug === "relaxed-corduroy-shirt")!;
  const addedVariantId = await installCharcoalDemoCommerce(page, shirt);
  await page.goto("/products/relaxed-corduroy-shirt", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".product-info h4").first()).toHaveText("Button-front shirt");
  await expect(page.locator(".fashion-product-thumb-control")).toHaveCount(4);
  await expect(page.locator("[data-product-option-swatch]")).toHaveCount(4);
  const gallerySources = await page
    .locator(".fashion-product-gallery img")
    .evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src));
  expect(gallerySources.some((source) => /product-detail-0[56]\.jpg/.test(source))).toBe(false);
  await expect(page.locator(".product-info")).not.toContainText(
    "Color and size options are being verified",
  );
  await expect(page.locator(".product-info .product-price")).toBeVisible();
  await expect(page.locator(".product-info .btn-cart")).toBeEnabled();
  await expect(page.locator(".product-info")).toContainText("DEMO-CHARCOAL-SHIRT-M");
  await expect(page.locator(".product-info .fashion-product-options")).toBeVisible();
  for (const color of ["Gold", "Blue", "Green"]) {
    await page.getByRole("radio", { name: color, exact: true }).check();
    await expect(page.locator(".fashion-product-gallery img").first()).toHaveAttribute(
      "src",
      new RegExp(`charcoal-shirt-${color.toLowerCase()}-front-v1\\.jpg`),
    );
    await expect(page.locator("#product-panel-description img")).toHaveAttribute(
      "src",
      new RegExp(`charcoal-shirt-${color.toLowerCase()}-front-v1\\.jpg`),
    );
    await expect
      .poll(() =>
        page
          .locator(".fashion-product-gallery img")
          .first()
          .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    await expect(page.locator(".fashion-product-thumb-control")).toHaveCount(1);
  }
  await page.getByRole("radio", { name: "Blue", exact: true }).check();
  await page.getByRole("radio", { name: "L", exact: true }).check();
  await expect(page.locator(".product-info")).toContainText("M492300-BLUE-L");
  await page.locator(".product-info .btn-cart").click();
  await expect
    .poll(addedVariantId)
    .toBe(
      shirt.variants.find(
        ({ optionValues }) => optionValues.color === "Blue" && optionValues.size === "L",
      )!.id,
    );
  await expect(page.locator(".product-info")).not.toContainText("Zalando");
  await page.getByRole("tab", { name: "Additional information" }).click();
  await expect(page.locator("#product-panel-information")).toContainText("Available colors");
  await expect(page.locator("#product-panel-information")).toContainText("Charcoal");
  await expect(page.locator("#product-panel-information")).not.toContainText(
    "Organic cotton twill",
  );
});

test("static Product preview keeps a compact cart action and omits template filler", async ({
  page,
}) => {
  test.skip(
    process.env.STOREFRONT_FASHION_PRODUCT_CONTENT_CATALOG !== "1",
    "Product content profile is opt-in.",
  );
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/products/relaxed-corduroy-shirt", { waitUntil: "networkidle" });
  await expect(page.locator("[data-live-product-status]")).toContainText("could not be verified");
  const cartButton = page.locator(".product-info .btn-cart");
  await expect(cartButton).toHaveText(/Add to cart/);
  await expect(cartButton).not.toContainText("Retry and add to cart");
  expect(
    await cartButton
      .locator(".btn-double-text")
      .evaluate((label) => getComputedStyle(label).whiteSpace),
  ).toBe("nowrap");
  await expect(page.locator(".fashion-product-secondary-actions")).not.toContainText("Compare");
  for (const path of ["/", "/shop", "/products/relaxed-corduroy-shirt"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("footer")).not.toContainText("Stay in touch.");
    await expect(page.locator("footer")).not.toContainText("Proudly Powered");
    await expect(page.locator("footer")).not.toContainText("reCAPTCHA");
    if (path === "/shop") {
      await expect(page.locator("body")).not.toContainText("Discover the latest edit.");
    }
  }
});
