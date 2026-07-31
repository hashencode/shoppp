import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { assertThemeLayout, captureThemeEvidence } from "./support/theme-fidelity";

const routes = [
  "/",
  "/collections/travel-essentials",
  "/products/textured-sweater",
  "/cart",
  "/checkout",
  "/orders/fixture-order",
  "/policies/shipping",
];

for (const route of routes) {
  test(`${route} remains a complete Fashion preview route`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    if ((page.viewportSize()?.width ?? 1200) <= 900)
      await expect(page.locator(".fashion-mobile-menu > summary")).toBeVisible();
    else await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Legal" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Preview template unavailable");
    await assertThemeLayout(page);
  });
}

test("Fashion home matches the reference inventory and native interactions", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "fashion-no-js");
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Women's collection" })).toBeVisible();
  for (const selector of [
    ".fashion-categories",
    ".fashion-products",
    ".fashion-promo-band",
    ".fashion-collection",
    ".fashion-brands",
    ".fashion-promises",
    ".fashion-magazine",
    ".fashion-footer",
  ]) {
    await expect(page.locator(selector).first()).toBeVisible();
  }
  await expect(page.locator(".fashion-hero-slide img").first()).toHaveAttribute(
    "fetchpriority",
    "high",
  );
  await expect(page.locator(".fashion-hero-slide img").nth(1)).toHaveAttribute("loading", "lazy");
  await expect(page.locator('.fashion-nav-actions button[aria-label="Search"] svg')).toHaveCount(1);
  await expect(page.locator('.fashion-nav-actions button[aria-label="Account"] svg')).toHaveCount(
    1,
  );
  await expect(
    page.locator('.fashion-nav-actions button[aria-label="Preview bag"] svg'),
  ).toHaveCount(1);
  const serviceIcons = page.locator(".fashion-service-strip img");
  await expect(serviceIcons).toHaveCount(4);
  expect(
    await serviceIcons.evaluateAll((images) =>
      images.map((image) => {
        const box = image.getBoundingClientRect();
        return {
          height: image.getAttribute("height"),
          naturalHeight: (image as HTMLImageElement).naturalHeight,
          naturalWidth: (image as HTMLImageElement).naturalWidth,
          renderedHeight: box.height,
          renderedWidth: box.width,
          source: (image as HTMLImageElement).getAttribute("src"),
          width: image.getAttribute("width"),
        };
      }),
    ),
  ).toEqual([
    expect.objectContaining({
      height: "48",
      naturalHeight: 512,
      naturalWidth: 512,
      renderedHeight: 48,
      renderedWidth: 48,
      source: expect.stringContaining("service-box"),
      width: "48",
    }),
    expect.objectContaining({
      height: "48",
      naturalHeight: 512,
      naturalWidth: 512,
      renderedHeight: 48,
      renderedWidth: 48,
      source: expect.stringContaining("service-return"),
      width: "48",
    }),
    expect.objectContaining({
      height: "48",
      naturalHeight: 512,
      naturalWidth: 512,
      renderedHeight: 48,
      renderedWidth: 48,
      source: expect.stringContaining("service-payment"),
      width: "48",
    }),
    expect.objectContaining({
      height: "48",
      naturalHeight: 512,
      naturalWidth: 512,
      renderedHeight: 48,
      renderedWidth: 48,
      source: expect.stringContaining("service-support"),
      width: "48",
    }),
  ]);
  await expect(page.getByRole("button", { name: "Next collections" }).locator("svg")).toHaveCount(
    1,
  );
  expect(await page.locator("body").innerText()).not.toMatch(/[⌕♙▢↗↺✓♡←→]/);
  expect(
    await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")].map(({ id }) => id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    }),
  ).toEqual([]);
  await expect(page.locator("#fashion-bestsellers")).toHaveCount(1);
  await expect(page.locator("#fashion-featured")).toHaveCount(1);
  await expect(page.locator('a[href="#"]')).toHaveCount(0);
  await captureThemeEvidence(page, testInfo, "fashion");
  await page.getByRole("button", { name: "Show slide 2" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Men's collection" })).toBeVisible();
  await expect(page.locator(".fashion-hero-slide").nth(1).locator("img")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Atlas carry-on");
  await assertThemeLayout(page);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("Fashion navigation keeps centered logo, split groups, and distinct destinations", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "fashion-no-js");
  await page.goto("/");
  const mobile = (page.viewportSize()?.width ?? 1_440) <= 900;
  const expectedDestinations = [
    "/",
    "/#fashion-bestsellers",
    "/#fashion-categories",
    "/#fashion-magazine",
    "/#fashion-footer",
    "/#fashion-contact",
  ];
  if (mobile) {
    await page.locator(".fashion-mobile-menu > summary").click();
    const links = page.locator(".fashion-mobile-menu nav a");
    await expect(links).toHaveCount(6);
    expect(
      await links.evaluateAll((items) => items.map((item) => item.getAttribute("href"))),
    ).toEqual(expectedDestinations);
    return;
  }

  await expect(
    page.locator(".fashion-nav-left > .fashion-nav-item > .fashion-nav-link"),
  ).toHaveText(["Home", "Shop", "Collection"]);
  await expect(
    page.locator(".fashion-nav-right > .fashion-nav-item > .fashion-nav-link"),
  ).toHaveText(["Magazine", "Pages", "Contact"]);
  const links = page.locator(".fashion-desktop-nav .fashion-nav-link");
  expect(
    await links.evaluateAll((items) => items.map((item) => item.getAttribute("href"))),
  ).toEqual(expectedDestinations);
  const geometry = await page.evaluate(() => {
    const box = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect() ?? new DOMRect();
    const left = box(".fashion-nav-left");
    const logo = box(".fashion-brand");
    const right = box(".fashion-nav-right");
    return {
      centeredDelta: Math.abs(logo.left + logo.width / 2 - innerWidth / 2),
      leftBeforeLogo: left.right <= logo.left,
      rightAfterLogo: right.left >= logo.right,
    };
  });
  expect(geometry.centeredDelta).toBeLessThanOrEqual(2);
  expect(geometry.leftBeforeLogo).toBe(true);
  expect(geometry.rightAfterLogo).toBe(true);

  const shopToggle = page.getByRole("button", { name: "Open Shop menu" });
  await shopToggle.focus();
  await page.keyboard.press("Enter");
  await expect(shopToggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(shopToggle).toHaveAttribute("aria-expanded", "false");
  await expect(shopToggle).toBeFocused();
});

test("Fashion products keep distinct destinations, reference typography, and hover actions", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.goto("/");
  const cards = page.locator("#fashion-bestsellers .fashion-product-card");
  await expect(cards).toHaveCount(10);
  const destinations = await cards
    .locator(".fashion-product-link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(new Set(destinations).size).toBe(10);
  expect(destinations).not.toContain("/products/atlas-carry-on");

  const firstCard = cards.first();
  await firstCard.hover();
  await expect(
    firstCard.getByRole("button", { name: "Add Textured sweater to preview bag" }),
  ).toBeVisible();
  await expect(firstCard.getByRole("button", { name: "Save Textured sweater" })).toBeVisible();
  await expect(firstCard.getByRole("link", { name: "Quick shop Textured sweater" })).toBeVisible();
  await expect(firstCard.locator("h3")).toHaveCSS("font-size", "19px");
  await expect(firstCard.locator("h3")).toHaveCSS("font-weight", "500");
  await expect(page.locator(".fashion-nav-link").first()).toHaveCSS("font-size", "19px");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("status")).toContainText("Search is available");

  await firstCard.locator(".fashion-product-link").click();
  await expect(page).toHaveURL(/\/products\/textured-sweater\/?$/);
  await expect(page.locator(".fashion-utility-message")).toHaveCount(0);
  await expect(page.locator(".fashion-product-detail")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Textured sweater" })).toBeVisible();
  expect(
    await page.locator(".fashion-product-primary-image").evaluate((image) => {
      return (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0;
    }),
  ).toBe(true);
  await page.getByRole("button", { name: "Add to preview bag" }).click();
  await expect(page.locator(".fashion-product-message")).toContainText(
    "Textured sweater added to the preview bag",
  );
  const descriptionTab = page.getByRole("tab", { name: "Description" });
  await descriptionTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Additional information" })).toBeFocused();
});

test("Fashion mobile category and product grids follow the single-column reference", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"));
  await page.goto("/");
  const columns = await page.evaluate(() => ({
    categories: getComputedStyle(document.querySelector(".fashion-categories")!)
      .gridTemplateColumns,
    products: getComputedStyle(document.querySelector(".fashion-product-grid")!)
      .gridTemplateColumns,
  }));
  expect(columns.categories.split(" ")).toHaveLength(1);
  expect(columns.products.split(" ")).toHaveLength(1);
  await expect(
    page
      .locator("#fashion-bestsellers .fashion-product-card")
      .first()
      .getByRole("button", { name: "Add Textured sweater to preview bag" }),
  ).toBeVisible();
});

test("Fashion home has no serious accessibility violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
  ).toEqual([]);
});

test("Fashion keeps the first collection and full content without JavaScript", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-no-js");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Women's collection" })).toBeVisible();
  await expect(page.locator(".fashion-categories img")).toHaveCount(4);
  await expect(page.locator(".fashion-magazine article")).toHaveCount(4);
});

test("Fashion reduced motion disables decorative transitions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-reduced-motion");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".fashion-categories img").first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
});

test("Fashion preview emits no commerce mutation or prohibited runtime request", async ({
  page,
}) => {
  const requests: { method: string; url: string }[] = [];
  page.on("request", (request) => requests.push({ method: request.method(), url: request.url() }));
  await page.goto("/");
  await page.getByRole("button", { name: "Add Textured sweater to preview bag" }).first().click();
  const html = (await page.content()).toLowerCase();
  expect(html).not.toMatch(/jquery|revolution|contact\.php/);
  expect(requests.filter(({ method }) => method !== "GET")).toEqual([]);
  expect(requests.filter(({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);
});
