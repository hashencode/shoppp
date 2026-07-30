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
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Women's collection" })).toBeVisible();
  for (const selector of [
    ".fashion-categories",
    ".fashion-products",
    ".fashion-promo-band",
    ".fashion-collection",
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
  await expect(page.locator(".fashion-service-strip svg")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Next collections" }).locator("svg")).toHaveCount(
    1,
  );
  expect(await page.locator("body").innerText()).not.toMatch(/[⌕♙▢↗↺✓♡←→]/);
  await captureThemeEvidence(page, testInfo, "fashion");
  await page.getByRole("button", { name: "Show slide 2" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Men's collection" })).toBeVisible();
  await expect(page.locator(".fashion-hero-slide").nth(1).locator("img")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Atlas carry-on");
  await assertThemeLayout(page);
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
  await expect(page.locator(".fashion-categories img")).toHaveCount(6);
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
  await page.getByRole("button", { name: "Add to preview bag" }).first().click();
  const html = (await page.content()).toLowerCase();
  expect(html).not.toMatch(/jquery|revolution|contact\.php/);
  expect(requests.filter(({ method }) => method !== "GET")).toEqual([]);
  expect(requests.filter(({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);
});
