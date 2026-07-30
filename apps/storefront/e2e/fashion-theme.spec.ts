import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
  test(`${route} renders complete Fashion fixture content`, async ({ page }, testInfo) => {
    await page.goto(route);

    await expect(page.locator("h1")).toBeVisible();
    if (["fashion-mobile", "fashion-reduced-motion"].includes(testInfo.project.name)) {
      await expect(page.locator("details > summary", { hasText: "Menu" })).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    }
    await expect(page.getByRole("navigation", { name: "Legal" })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("undefined");
    await expect(page.locator("body")).not.toContainText("Preview template unavailable");

    const images = await page.locator("img").evaluateAll((elements) =>
      elements.map((element) => ({
        alt: element.getAttribute("alt"),
        height: element.getAttribute("height"),
        width: element.getAttribute("width"),
      })),
    );
    expect(images.every(({ alt, height, width }) => alt && height && width)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (testInfo.project.name === "fashion-desktop") {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
      expect(
        results.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
      ).toEqual([]);
    }
  });
}

test("Fashion remains meaningful without JavaScript", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-no-js");
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Objects with a point of view." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the fixture collection" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Legal" })).toBeVisible();
});

test("Fashion uses native controls and honors reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-reduced-motion");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  );
  const menu = page.locator("details");
  await menu.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("open", "");
  await expect(page.locator(".fashion-hero")).toHaveCSS("animation-name", "none");
});

test("Fashion preview emits no prohibited runtime or external font request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  const html = (await page.content()).toLowerCase();

  expect(html).not.toMatch(/jquery|revolution|crafto|contact\.php/);
  expect(requests.filter((url) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);
});
