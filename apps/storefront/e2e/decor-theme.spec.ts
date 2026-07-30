import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { assertThemeLayout, captureThemeEvidence } from "./support/theme-fidelity";

const routes = [
  "/",
  "/collections/travel-essentials",
  "/products/atlas-carry-on",
  "/cart",
  "/checkout",
  "/orders/fixture-order",
  "/policies/shipping",
];

for (const route of routes) {
  test(`${route} remains a complete Decor preview route`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    if ((page.viewportSize()?.width ?? 1200) <= 900)
      await expect(page.locator(".decor-mobile-menu > summary")).toBeVisible();
    else await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Legal" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Preview template unavailable");
    await assertThemeLayout(page);
  });
}

test("Decor home matches the furniture inventory and native interactions", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "decor-no-js");
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Corby sofas" })).toBeVisible();
  for (const selector of [
    ".decor-categories",
    ".decor-products",
    ".decor-marquee",
    ".decor-collection",
    ".decor-clients",
    ".decor-journal",
    ".decor-services",
    ".decor-footer",
  ]) {
    await expect(page.locator(selector)).toBeVisible();
  }
  await expect(page.locator(".decor-hero-product").first()).toHaveAttribute(
    "fetchpriority",
    "high",
  );
  await expect(page.locator(".decor-hero-product").nth(1)).toHaveAttribute("loading", "lazy");
  await expect(page.locator('.decor-actions button[aria-label="Search"] svg')).toHaveCount(1);
  await expect(page.locator('.decor-actions button[aria-label="Preview bag"] svg')).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Shop now" }).locator("svg")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Add to preview bag" }).first().locator("svg"),
  ).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Next furniture" }).locator("svg")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Next product" }).locator("svg")).toHaveCount(1);
  await expect(page.locator(".decor-footer-social svg")).toHaveCount(4);
  await page.locator(".decor-category-icon-list").scrollIntoViewIfNeeded();
  await page.locator(".decor-category-icon-list img").evaluateAll(async (images) => {
    await Promise.all(images.map((image) => (image as HTMLImageElement).decode()));
  });
  expect(
    await page.locator(".decor-category-icon-list img").evaluateAll((images) =>
      images.map((image) => {
        const element = image as HTMLImageElement;
        const box = element.getBoundingClientRect();
        return {
          height: element.getAttribute("height"),
          naturalHeight: element.naturalHeight,
          naturalWidth: element.naturalWidth,
          renderedHeight: box.height,
          renderedWidth: box.width,
          source: element.currentSrc,
          width: element.getAttribute("width"),
        };
      }),
    ),
  ).toEqual(
    ["01", "03", "02", "10", "04", "05"].map((id) =>
      expect.objectContaining({
        height: "65",
        naturalHeight: 65,
        naturalWidth: 65,
        renderedHeight: 65,
        renderedWidth: 65,
        source: expect.stringContaining(`icon-${id}`),
        width: "65",
      }),
    ),
  );
  await page.locator(".decor-services").scrollIntoViewIfNeeded();
  await page.locator(".decor-services img").evaluateAll(async (images) => {
    await Promise.all(images.map((image) => (image as HTMLImageElement).decode()));
  });
  expect(
    await page.locator(".decor-services img").evaluateAll((images) =>
      images.map((image) => {
        const element = image as HTMLImageElement;
        const box = element.getBoundingClientRect();
        return {
          height: element.getAttribute("height"),
          naturalHeight: element.naturalHeight,
          naturalWidth: element.naturalWidth,
          renderedHeight: box.height,
          renderedWidth: box.width,
          source: element.currentSrc,
          width: element.getAttribute("width"),
        };
      }),
    ),
  ).toEqual(
    ["06", "07", "08", "09"].map((id) =>
      expect.objectContaining({
        height: "50",
        naturalHeight: 50,
        naturalWidth: 60,
        renderedHeight: 50,
        renderedWidth: 60,
        source: expect.stringContaining(`icon-${id}`),
        width: "60",
      }),
    ),
  );
  expect(await page.locator("body").innerText()).not.toMatch(/[⌕▢▣＋←→◉◎]/);
  await page.waitForLoadState("networkidle");
  await captureThemeEvidence(page, testInfo, "decor");
  await page.getByRole("button", { name: "Next furniture" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Nordic chairs" })).toBeVisible();
  await expect(
    page.locator(".decor-hero-slide").nth(1).locator(".decor-hero-product"),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Best sellers" }).click();
  await expect(page.getByRole("tab", { name: "Best sellers" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("body")).not.toContainText("Atlas carry-on");
  expect(
    await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")].map(({ id }) => id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    }),
  ).toEqual([]);
  await assertThemeLayout(page);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("Decor product tabs expose roving keyboard semantics", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "decor-desktop");
  await page.goto("/");
  const bestSellers = page.getByRole("tab", { name: "Best sellers" });
  const newArrivals = page.getByRole("tab", { name: "New arrivals" });
  await bestSellers.focus();
  await page.keyboard.press("ArrowRight");
  await expect(newArrivals).toBeFocused();
  await expect(newArrivals).toHaveAttribute("aria-selected", "true");
  await expect(bestSellers).toHaveAttribute("tabindex", "-1");
  await page.keyboard.press("Home");
  await expect(bestSellers).toBeFocused();
  await expect(bestSellers).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "decor-tab-0");
});

test("Decor mobile menu stays attached to the header and grids match the reference", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "decor-mobile");
  await page.goto("/");
  await page.locator(".decor-mobile-menu > summary").click();
  const geometry = await page.evaluate(() => {
    const header = document.querySelector(".decor-nav")!.getBoundingClientRect();
    const menu = document.querySelector(".decor-mobile-menu nav")!.getBoundingClientRect();
    return { headerBottom: header.bottom, menuTop: menu.top };
  });
  expect(Math.abs(geometry.menuTop - geometry.headerBottom)).toBeLessThanOrEqual(2);
  expect(
    await page.evaluate(() =>
      [".decor-category-banners", ".decor-product-grid"].map(
        (selector) =>
          getComputedStyle(document.querySelector(selector)!).gridTemplateColumns.split(" ").length,
      ),
    ),
  ).toEqual([1, 1]);
  await assertThemeLayout(page);
});

test("Decor home has no serious accessibility violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "decor-desktop");
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
  ).toEqual([]);
});

test("Decor keeps the first furniture state and content without JavaScript", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "decor-no-js");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Corby sofas" })).toBeVisible();
  await expect(page.locator(".decor-categories img")).toHaveCount(9);
  await expect(page.locator(".decor-journal article")).toHaveCount(4);
});

test("Decor reduced motion stops the promotional marquee", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "decor-reduced-motion");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".decor-marquee div")).toHaveCSS("animation-name", "none");
});

test("Decor preview emits no commerce mutation or prohibited runtime request", async ({ page }) => {
  const requests: { method: string; url: string }[] = [];
  page.on("request", (request) => requests.push({ method: request.method(), url: request.url() }));
  await page.goto("/");
  await page.getByRole("button", { name: "Add to preview bag" }).first().click();
  const html = (await page.content()).toLowerCase();
  expect(html).not.toMatch(/jquery|revolution|contact\.php/);
  expect(requests.filter(({ method }) => method !== "GET")).toEqual([]);
  expect(requests.filter(({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);
});
