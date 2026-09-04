import { fashionStoreViewport, isFashionStoreViewport } from "./support/fashion-store-project";
import { expect, test, type Page } from "@playwright/test";

import { fashionStorePreviewRoutes } from "../app/themes/fashion-store/page-contracts";
import { recordThemeBehaviorEvidence } from "./support/theme-behavior-evidence";

const sourceOrigin = `http://127.0.0.1:${Number(
  process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427,
)}`;
const labels = [
  "Polo t-shirts",
  "Sunglasses",
  "Skinny blazer",
  "Casual shoes",
  "Winter jackets",
  "Men's shorts",
] as const;
const counts = ["8 items", "9 items", "8 items", "5 items", "7 items", "3 items"] as const;

async function prepareCollection(page: Page): Promise<void> {
  await page.goto("/collections", { waitUntil: "networkidle" });
  await page.locator("[data-fashion-store-collection][data-runtime-status='ready']").waitFor();
  await page.evaluate(async () => document.fonts.ready);
  await page.getByRole("button", { name: "Allow cookies" }).click();
}

test("Collection preserves source cards, imagery, counts, order, links, and responsive composition", async ({
  page,
}, testInfo) => {
  await prepareCollection(page);
  const collection = page.locator("[data-fashion-store-collection]");
  const cards = collection.locator(".categories-style-02");
  await expect(collection.getByRole("heading", { name: "Collection" })).toBeVisible();
  await expect(cards).toHaveCount(6);
  await expect(collection.locator(".shop-modern")).toHaveCount(0);
  await expect(cards.locator("img")).toHaveCount(6);
  expect(
    await cards
      .locator("img")
      .evaluateAll((images) =>
        images.map((image) => [image.getAttribute("width"), image.getAttribute("height")]),
      ),
  ).toEqual(Array.from({ length: 6 }, () => ["600", "450"]));

  for (const [index, label] of labels.entries()) {
    await expect(cards.nth(index)).toContainText(label);
    await expect(cards.nth(index)).toContainText(counts[index]!);
    await expect(cards.nth(index).getByRole("link", { name: label }).first()).toHaveAttribute(
      "href",
      "/shop",
    );
  }
  const imageSources = await cards
    .locator("img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("src")));
  expect(new Set(imageSources).size).toBe(6);

  const source = await page.context().newPage();
  try {
    await source.goto(`${sourceOrigin}/demo-fashion-store-collection.html`, {
      waitUntil: "networkidle",
    });
    await source.evaluate(async () => document.fonts.ready);
    const [sourceGrid, implementationGrid] = await Promise.all([
      source.locator("section:nth-of-type(2) .row").boundingBox(),
      collection.locator(".fashion-collection-grid").boundingBox(),
    ]);
    expect(sourceGrid).not.toBeNull();
    expect(implementationGrid).not.toBeNull();
    expect(Math.abs(sourceGrid!.x - implementationGrid!.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(sourceGrid!.width - implementationGrid!.width)).toBeLessThanOrEqual(2);
  } finally {
    await source.close();
  }
  expect(fashionStoreViewport(testInfo)).toBeDefined();
});

test("collection-card-focus interaction: cards expose pointer and keyboard state before Nuxt navigation", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Interaction evidence runs once.");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await prepareCollection(page);
  const firstCard = page.locator(".categories-style-02").first();
  const initial = await firstCard.boundingBox();
  await firstCard.hover();
  await expect.poll(async () => (await firstCard.boundingBox())?.y).toBeLessThan(initial!.y);
  const cardLink = firstCard.getByRole("link", { name: "Polo t-shirts" }).first();
  await cardLink.focus();
  await expect(cardLink).toBeFocused();
  await expect(firstCard).toHaveCSS("transform", /matrix\(1, 0, 0, 1, 0, -8\)/);

  const previewCart = page.getByRole("button", { name: "Open preview cart" });
  await previewCart.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".cart-item-list")).toBeVisible();
  await cardLink.click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.locator("[data-fashion-store-shop][data-layout='left']")).toBeVisible();
  await expect(page.locator(".cart-item-list")).toBeHidden();
  await page.goBack({ waitUntil: "networkidle" });
  const keyboardLink = page
    .locator("[data-fashion-store-collection] .categories-style-02")
    .first()
    .getByRole("link", { name: "Polo t-shirts" })
    .first();
  await keyboardLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/shop$/);

  recordThemeBehaviorEvidence(
    testInfo,
    {
      actionOutcome: true,
      behaviorId: "collection-card-state",
      branches: [
        { id: "pointer", outcome: true, viewportId: "desktop" },
        { id: "keyboard", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
    {
      actionOutcome: true,
      behaviorId: "collection-category-navigation",
      branches: [
        { id: "pointer", outcome: true, viewportId: "desktop" },
        { id: "keyboard", outcome: true, viewportId: "desktop" },
      ],
      mode: "interaction",
    },
  );
});

test("Shared header controls keep source styling on every consumer route", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "The shared shell matrix runs once.");
  for (const route of fashionStorePreviewRoutes) {
    await page.goto(route, { waitUntil: "networkidle" });
    const cartTrigger = page.getByRole("button", { name: "Open preview cart" });
    await expect(cartTrigger, `${route} cart trigger`).toHaveCSS("appearance", "none");
    await expect(cartTrigger, `${route} cart trigger`).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await expect(cartTrigger, `${route} cart trigger`).toHaveCSS("border-top-width", "0px");

    const closeControls = page.locator(".cart-item-list .close");
    await expect(closeControls).toHaveCount(2);
    expect(
      await closeControls.evaluateAll((controls) =>
        controls.every((control) => {
          const style = getComputedStyle(control);
          return (
            style.appearance === "none" &&
            style.backgroundColor === "rgba(0, 0, 0, 0)" &&
            style.borderTopWidth === "0px"
          );
        }),
      ),
      `${route} mini-cart close controls`,
    ).toBe(true);
  }
});

test("Collection reduced-motion, fallback content, teardown, and remount stay deterministic", async ({
  page,
}, testInfo) => {
  test.skip(!isFashionStoreViewport(testInfo, "desktop"), "Fallback evidence runs once.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepareCollection(page);
  const firstCard = page.locator(".categories-style-02").first();
  await firstCard.getByRole("link", { name: "Polo t-shirts" }).first().focus();
  await expect(firstCard).toHaveCSS("transform", "none");
  await expect(page.locator(".categories-style-02")).toHaveCount(6);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-fashion-store-collection]")).toHaveCount(1);
  await expect(page.locator(".categories-style-02")).toHaveCount(6);
  await expect(page.locator(".categories-style-02").last()).toContainText("Men's shorts");
  recordThemeBehaviorEvidence(
    testInfo,
    { actionOutcome: true, behaviorId: "collection-card-state", mode: "fallback" },
    {
      actionOutcome: true,
      behaviorId: "collection-category-navigation",
      mode: "fallback",
    },
  );
});
