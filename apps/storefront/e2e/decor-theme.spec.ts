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
  expect(await page.locator("body").innerText()).not.toMatch(/[⌕▢▣＋←→◉♥◎]/);
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
  await expect(page.locator(".decor-categories img")).toHaveCount(6);
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
