import { expect, test, type Page } from "@playwright/test";
import { decorStorePageContracts } from "../app/themes/decor-store/page-contracts";
import { decorStoreSecondaryPageSourceContracts } from "../app/themes/decor-store/source-contract";
import { recordThemeBehaviorEvidence } from "./support/theme-behavior-evidence";

const pages = decorStorePageContracts.filter(({ id }) => id !== "home");
const implementedRoutes = new Set(decorStorePageContracts.map(({ path }) => path));

async function exerciseInteraction(page: Page, interaction: string): Promise<void> {
  const root = page.locator("[data-decor-source-page]");
  if (interaction === "header-navigation") {
    const toggle = page.locator("button[aria-label='Toggle navigation']");
    const navigation = page.getByRole("navigation").getByRole("link").first();
    if (!(await navigation.isVisible()) && (await toggle.isVisible())) await toggle.click();
    await expect(navigation).toHaveAttribute("href");
    await navigation.focus();
    await expect(navigation).toBeFocused();
  } else if (interaction === "mobile-navigation") {
    const toggle = page.locator("button[aria-label='Toggle navigation']");
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    } else {
      await expect(toggle).toBeAttached();
    }
  } else if (interaction === "search-overlay") {
    await page.getByRole("button", { name: "Open search" }).click();
    await expect(page.locator(".search-form-wrapper")).toBeVisible();
    await page.keyboard.press("Escape");
  } else if (interaction === "mini-cart-overlay") {
    const cart = page.getByRole("button", { name: "Open cart preview" });
    await cart.click();
    await expect(cart).toHaveAttribute("aria-expanded", "true");
    await cart.click();
  } else if (interaction === "cookie-dismissal") {
    const cookie = page.getByRole("button", { name: "Allow cookies" });
    if (await cookie.isVisible()) await cookie.click();
    await expect(cookie).toHaveCount(0);
  } else if (interaction === "scroll-progress") {
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    const backToTop = page.getByRole("button", { name: "Back to top", includeHidden: true });
    if (await backToTop.isVisible()) await backToTop.click();
    else await expect(backToTop).toBeHidden();
  } else if (interaction === "filter-accordion") {
    const filter = page.getByRole("button", { name: "Furnitures", exact: true });
    await filter.click();
    await expect(filter).toHaveAttribute("aria-pressed", "true");
  } else if (interaction === "sort") {
    await page.getByLabel("Default sorting").selectOption("5");
    await expect(root.locator("[data-product-id]").first()).toHaveAttribute(
      "data-product-id",
      "wood-stool",
    );
  } else if (interaction.includes("pagination")) {
    const pageTwo = root.getByRole("button", { name: "2", exact: true });
    await pageTwo.click();
    await expect(pageTwo).toHaveAttribute("aria-current", "page");
  } else if (interaction.includes("hover")) {
    const card = root.locator(".grid-item:visible, .categories-box:visible").first();
    if (await page.evaluate(() => matchMedia("(hover: hover)").matches)) await card.hover();
    else await card.locator("a").first().focus();
    await expect(card).toBeVisible();
  } else if (interaction === "product-gallery" || interaction === "about-carousel") {
    const label = interaction === "product-gallery" ? "Next product image" : "Next story";
    await page.getByRole("button", { name: label }).click();
    await expect(root.locator("[data-decor-slide='2']").first()).toBeVisible();
  } else if (interaction === "product-options") {
    await page.getByLabel("Black").check();
    await expect(page.getByLabel("Black")).toBeChecked();
  } else if (interaction.includes("quantity")) {
    const increase = root
      .getByRole("button", { name: /Increase .*quantity|Increase quantity/ })
      .first();
    await increase.click();
    await expect(root.getByRole("status").first()).toContainText("2");
  } else if (interaction === "product-tabs") {
    const tab = root.getByRole("tab").nth(1);
    await tab.click();
    await expect(tab).toHaveClass(/active/);
  } else if (interaction === "account-tabs") {
    const registration = root.getByRole("form", { name: "Registration presentation" });
    await registration.getByRole("textbox").first().focus();
    await expect(registration.getByRole("textbox").first()).toBeFocused();
  } else if (interaction === "wishlist-toggle") {
    const wishlist = root.getByRole("button", { name: "Add product to wishlist" });
    await wishlist.click();
    await expect(wishlist).toHaveAttribute("aria-pressed", "true");
  } else if (interaction === "wishlist-remove" || interaction === "cart-remove") {
    const rows = root.locator(
      interaction === "cart-remove" ? "[data-cart-line]" : "[data-product-id]",
    );
    await expect(rows.first()).toBeAttached();
    const before = await rows.count();
    if (interaction === "wishlist-remove") {
      await rows.first().hover();
      await rows
        .first()
        .getByRole("button", { name: /Add .* to wishlist/ })
        .click();
    } else {
      await root
        .getByRole("button", { name: /Remove / })
        .first()
        .click();
    }
    await expect(rows).toHaveCount(before - 1);
  } else if (interaction.includes("navigation")) {
    await expect(root.locator("a[data-decor-store-route]").first()).toHaveAttribute("href", /^\//);
  } else if (interaction === "login-panel" || interaction === "coupon-panel") {
    const label =
      interaction === "login-panel" ? "Click here to login" : "Click here to enter your code";
    const control = root.getByRole("link", { name: label });
    const before = page.url();
    await control.click();
    expect(page.url()).toBe(before);
  } else if (interaction === "faq-accordion") {
    const question = root.getByRole("button", { name: /difficulty placing an order/ });
    await question.click();
    await expect(question).toHaveAttribute("aria-expanded", "true");
  } else if (interaction === "map-static") {
    await expect(root.getByRole("img", { name: "Store location map presentation" })).toBeVisible();
  } else if (interaction === "share-links") {
    await expect(root.locator("a[data-decor-local-action]").first()).toHaveAttribute("href", "#");
  } else if (interaction === "coupon-form-inert") {
    await expect(root.locator("form")).toHaveCount(0);
    const coupon = root.locator(".coupon-code-panel");
    await expect(coupon).toBeVisible();
    await expect(coupon.getByRole("link", { name: "Apply" })).toHaveAttribute("href", "#");
  } else if (interaction.includes("inert")) {
    await expect(root.locator("form")).toHaveCount(0);
    await expect(root.locator("[data-decor-inert-form]").first()).toHaveAttribute("role", "form");
  } else {
    await expect(root).toBeVisible();
  }
}

for (const { id, path: route } of pages) {
  test(`${id} route-ready static`, async ({ page }, testInfo) => {
    const diagnostics: string[] = [];
    const requests: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") diagnostics.push(message.text());
    });
    page.on("pageerror", (error) => diagnostics.push(error.message));
    page.on("request", (request) => {
      if (["fetch", "xhr"].includes(request.resourceType())) requests.push(request.url());
    });
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("[data-decor-store-secondary-shell]")).toHaveCount(1);
    const anchors = await page.locator("a").evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute("href"),
        route: link.hasAttribute("data-decor-store-route"),
      })),
    );
    const internalLinks = anchors.filter(({ href }) => href?.startsWith("/"));
    expect(internalLinks.length).toBeGreaterThan(0);
    expect(
      internalLinks.every(({ href, route: isRoute }) =>
        Boolean(isRoute && href && implementedRoutes.has(href)),
      ),
    ).toBe(true);
    expect(anchors.some(({ href }) => /demo-decor-store.*\.html/.test(href ?? ""))).toBe(false);
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      const headerGeometry = await page
        .locator("header[data-decor-secondary-header]")
        .evaluate((header) => {
          const topBar = header.querySelector<HTMLElement>(".header-top-bar");
          const navigation = header.querySelector<HTMLElement>(".navbar.disable-fixed");
          if (!topBar || !navigation) throw new Error("Decor Store secondary header is incomplete");
          return {
            navigationTop: navigation.getBoundingClientRect().top,
            topBarBottom: topBar.getBoundingClientRect().bottom,
          };
        });
      expect(headerGeometry.navigationTop).toBeCloseTo(headerGeometry.topBarBottom, 0);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(diagnostics).toEqual([]);
    expect(requests).toEqual([]);
    recordThemeBehaviorEvidence(testInfo, {
      actionOutcome: true,
      behaviorId: `${id}-ready`,
      mode: "static",
    });
  });

  const sourceContract = decorStoreSecondaryPageSourceContracts.find((page) => page.id === id)!;
  for (const interaction of sourceContract.interactions) {
    test(`${id} ${interaction} interaction`, async ({ page }, testInfo) => {
      await page.goto(route);
      await exerciseInteraction(page, interaction);
      recordThemeBehaviorEvidence(testInfo, {
        actionOutcome: true,
        behaviorId: `${id}-${interaction}`,
        mode: "interaction",
      });
    });
  }
}
