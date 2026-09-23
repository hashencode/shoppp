import { expect, test } from "@playwright/test";

const expectedProducts = [1, 2, 3, 1, 2];
const expectedMobilePatterns = [2, 3, 1, 2, 3];

async function assertAuthoredHero(page: import("@playwright/test").Page): Promise<void> {
  const hero = page.locator("#fashion-store-decor-hero");
  const slides = hero.locator("[data-hero-slide]");
  await expect(slides).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    const slide = slides.nth(index);
    await expect(slide.locator("[data-hero-layer='title']")).toHaveText(
      `Authored Hero ${index + 1}`,
    );
    await expect(slide.locator("[data-hero-layer='product']")).toHaveAttribute(
      "src",
      new RegExp(`decor-hero-0${expectedProducts[index]}-product`),
    );
    await expect(slide.locator("picture source")).toHaveAttribute(
      "srcset",
      new RegExp(`decor-hero-0${expectedMobilePatterns[index]}-pattern-mobile`),
    );
    await expect(slide.locator("a[data-hero-layer='cta']")).toHaveAttribute(
      "href",
      "/collections/travel-essentials",
    );
  }
}

test("renders five distinct authored Hero tuples in exact order", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await assertAuthoredHero(page);
});

test("keeps five authored Hero tuples truthful without JavaScript", async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.metadata.fashionStoreViewport !== "desktop",
    "One no-JS viewport is sufficient.",
  );
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await assertAuthoredHero(page);
  } finally {
    await context.close();
  }
});

test("serializes all five authored Hero tuples into SSR HTML", async ({ request }, testInfo) => {
  test.skip(
    testInfo.project.metadata.fashionStoreViewport !== "desktop",
    "SSR bytes are viewport-independent.",
  );
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  for (let index = 0; index < 5; index += 1) {
    expect(html).toContain(`Authored Hero ${index + 1}`);
  }
  expect(html.match(/\/collections\/travel-essentials/g)?.length).toBeGreaterThanOrEqual(5);
  for (const mediaIndex of [1, 2, 3]) {
    expect(html).toContain(`decor-hero-0${mediaIndex}-product`);
    expect(html).toContain(`decor-hero-0${mediaIndex}-pattern-mobile`);
  }
});
