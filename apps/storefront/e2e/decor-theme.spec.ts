import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
  test(`${route} renders complete Decor fixture content`, async ({ page }, testInfo) => {
    await page.goto(route);

    await expect(page.locator("h1")).toBeVisible();
    if (["decor-mobile", "decor-reduced-motion"].includes(testInfo.project.name)) {
      await expect(page.locator("details > summary", { hasText: "Explore" })).toBeVisible();
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
    if (testInfo.project.name === "decor-desktop") {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
      expect(
        results.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
      ).toEqual([]);
    }
  });
}

test("Decor keeps its layered content without JavaScript", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "decor-no-js");
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Rooms made for real life." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the fixture collection" })).toBeVisible();
  await expect(page.locator(".decor-layer")).toHaveCount(3);
});

test("Decor native menu and layered Hero honor reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "decor-reduced-motion");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const menu = page.locator("details");
  await menu.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("open", "");
  await expect(page.locator(".decor-layer").first()).toHaveCSS("animation-name", "none");
});

test("Decor preview excludes Fashion and prohibited runtime requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  const html = (await page.content()).toLowerCase();

  expect(html).not.toMatch(/jquery|revolution|crafto|contact\.php|fashion-/);
  expect(requests.filter((url) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);
});
