import { mkdir } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test("published Product without reviews or assurance keeps each visible state truthful", async ({
  page,
}) => {
  const captureDirectory = "test-results/fs-f11-u7/20260917T-live-empty";
  await mkdir(captureDirectory, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto("/products/relaxed-corduroy-shirt", { waitUntil: "domcontentloaded" });
    await page.locator("html.js").waitFor();

    const product = page.locator("[data-fashion-store-product]");
    await expect(product).toBeVisible();
    await expect(product.locator(".fashion-product-rating-count")).toHaveText("0 Reviews");
    const reviewsTab = product.getByRole("tab", { name: "Reviews (0)" });
    await expect(reviewsTab).toBeVisible();
    await expect(product.locator("[data-product-assurance]")).toContainText(
      "Delivery timing: Not available",
    );
    await expect(product.locator("[data-product-assurance]")).toContainText(
      "Shipping & returns: Not available",
    );
    await expect(product.locator(".fashion-product-payments")).toHaveText(
      "Payment methods are not available.",
    );
    await expect(product.locator(".fashion-product-payments img")).toHaveCount(0);
    await expect(product.locator("[data-product-assurance]")).not.toContainText(
      "Guarantee safe and secure checkout",
    );
    await page.screenshot({ path: `${captureDirectory}/product-${width}.png`, fullPage: true });

    await reviewsTab.click();
    const reviews = product.getByRole("tabpanel", { name: "Reviews (0)" });
    await expect(reviews).toBeVisible();
    await expect(product.locator("#product-panel-description")).toBeHidden();
    await expect(reviews).toContainText("No published reviews are available.");
    await expect(reviews.locator(".fashion-product-reviews")).toHaveCount(0);
    await expect(reviews.getByRole("button", { name: "Submit review" })).toBeVisible();
    await expect(reviews.locator(".fashion-product-rating-distribution")).toHaveCount(0);
    await product.locator(".fashion-product-tabs").screenshot({
      path: `${captureDirectory}/reviews-${width}.png`,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
  }
});
