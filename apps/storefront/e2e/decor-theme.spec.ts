import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  assertThemeLayout,
  captureThemeEvidence,
  waitForNuxtHydration,
} from "./support/theme-fidelity";

const routes = [
  "/",
  "/collections/travel-essentials",
  "/products/table-clock",
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
    if (route === "/cart")
      await expect(page.getByRole("heading", { level: 1, name: "Preview bag" })).toBeVisible();
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
  await expect(
    page.locator('.decor-actions button[aria-label="Search"] > .decor-feather-search'),
  ).toHaveCount(1);
  await expect(
    page.locator('.decor-actions button[aria-label="Preview bag"] > .decor-feather-shopping-bag'),
  ).toHaveCount(1);
  if (testInfo.project.name === "decor-desktop") {
    await expect(page.getByRole("button", { name: "Account" })).toContainText("My account");
    await expect(page.locator(".decor-account-icon")).not.toBeVisible();
    expect(
      await page
        .locator(".decor-actions button")
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label"))),
    ).toEqual(["Search", "Preview bag", "Account"]);
  }
  await expect(
    page.getByRole("link", { name: "Shop now" }).locator(".decor-feather-shopping-bag"),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole("button", { name: "Add Table clock to preview bag" })
      .first()
      .locator(".decor-feather-shopping-bag"),
  ).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Next furniture" }).locator("svg")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Next product" }).locator(".decor-bootstrap-arrow-right"),
  ).toHaveCount(1);
  await expect(page.locator(".decor-footer-social .decor-brand-icon")).toHaveCount(4);
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
  await expect(page.locator('a[href="#"]')).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  await captureThemeEvidence(page, testInfo, "decor");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Verona sofas" })).toBeVisible();
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
  await waitForNuxtHydration(page);
  await page.waitForLoadState("networkidle");
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

test("Decor product detail preserves the complete source contract", async ({ page }, testInfo) => {
  test.skip(
    !["decor-desktop", "decor-laptop", "decor-tablet", "decor-mobile"].includes(
      testInfo.project.name,
    ),
  );
  await page.goto("/products/ceramic-pot");
  await waitForNuxtHydration(page);
  await expect(page.locator(".decor-product-thumbs button")).toHaveCount(7);
  await expect(page.locator(".decor-product-gallery-stage")).toHaveAttribute(
    "aria-label",
    "Product image gallery",
  );
  await expect(page.locator(".decor-product-secondary-actions button")).toHaveText([
    "Compare",
    "Ask a question",
    "Share",
  ]);
  await expect(page.locator(".decor-product-payment-methods img")).toHaveCount(6);
  await expect(page.locator(".decor-product-taxonomy")).toContainText(
    "Category: Decor, Minimalist",
  );
  await expect(page.locator(".decor-product-taxonomy")).toContainText(
    "Tags: Chair, Modern, Wooden",
  );
  await expect(page.locator(".decor-product-meta")).toContainText("165 Reviews");
  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.getByText("Designer thoughts")).toBeVisible();
  await expect(page.locator(".decor-product-gallery-stage")).toHaveAttribute(
    "data-motion-active-index",
    "0",
  );
  if (testInfo.project.name === "decor-desktop") {
    await page.getByRole("button", { name: "Open product image preview" }).click();
    const lightbox = page.getByRole("dialog", { name: "Product image preview" });
    await expect(lightbox).toBeVisible();
    await lightbox.getByRole("button", { name: "Next preview image" }).click();
    await expect(page.locator(".decor-product-gallery-stage")).toHaveAttribute(
      "data-motion-active-index",
      "1",
    );
    await expect(page.locator(".decor-product-gallery-stage")).toHaveAttribute(
      "data-motion-phase",
      "idle",
    );
    await lightbox.getByRole("button", { name: "Close product image preview" }).click();
    await expect(lightbox).not.toBeVisible();
    await page.getByRole("button", { name: "Previous product image" }).click();
    await expect(page.locator(".decor-product-gallery-stage")).toHaveAttribute(
      "data-motion-active-index",
      "0",
    );
    await expect(page.locator(".decor-product-gallery-stage")).toHaveAttribute(
      "data-motion-phase",
      "idle",
    );
  }
  await page.waitForTimeout(450);
  await expect(page.locator(".decor-product-gallery-stage")).toHaveAttribute(
    "data-motion-active-index",
    "0",
  );
  await page.getByRole("button", { name: "Next product image" }).click();
  await expect(page.locator(".decor-product-gallery-stage")).toHaveAttribute(
    "data-motion-active-index",
    "1",
  );
  await expect(page.locator(".decor-product-gallery-stage")).toHaveAttribute(
    "data-motion-phase",
    "idle",
  );
  await page.locator(".decor-product-gallery-stage").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".decor-product-gallery-stage")).toHaveAttribute(
    "data-motion-active-index",
    "0",
  );
  await expect(page.locator(".decor-product-gallery-stage")).toHaveAttribute(
    "data-motion-phase",
    "idle",
  );
  await page.getByRole("button", { name: "Show Ceramic pot view 7" }).click();
  await expect(page.locator(".decor-product-gallery-stage")).toHaveAttribute(
    "data-motion-active-index",
    "6",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test("Decor section geometry stays inside the measured source contract", async ({
  page,
}, testInfo) => {
  const viewportId = testInfo.project.name.replace("decor-", "");
  test.skip(!["desktop", "laptop", "mobile", "tablet"].includes(viewportId));
  await page.goto("/");
  const selectors = [
    ".decor-hero",
    ".decor-categories",
    ".decor-products",
    ".decor-marquee",
    ".decor-collection",
    ".decor-clients",
    ".decor-journal",
    ".decor-services",
    ".decor-footer",
  ];
  const contracts: Record<string, { documentHeight: number; heights: number[] }> = {
    desktop: {
      documentHeight: 4_905,
      heights: [1_000, 915.2, 845, 172, 541.6, 190, 648, 145, 400.2],
    },
    laptop: {
      documentHeight: 5_730,
      heights: [900, 764.8, 1_478.2, 172, 464.5, 190, 1_055.2, 175, 492.9],
    },
    mobile: {
      documentHeight: 10_796,
      heights: [750, 1_306.3, 4_385, 109, 728.4, 130, 1_947.4, 580, 845.5],
    },
    tablet: {
      documentHeight: 7_503,
      heights: [1_024, 1_656.5, 2_116.3, 140.5, 402.6, 150, 1_055.4, 290, 640],
    },
  };
  const contract = contracts[viewportId]!;
  const implementation = await page.evaluate(
    (regionSelectors) => ({
      documentHeight: document.documentElement.scrollHeight,
      regions: regionSelectors.map((selector) => ({
        height: document.querySelector(selector)?.getBoundingClientRect().height ?? 0,
        selector,
      })),
    }),
    selectors,
  );
  for (const [index, region] of implementation.regions.entries()) {
    expect(
      Math.abs(region.height - contract.heights[index]!),
      `${region.selector} differs from the original computed height`,
    ).toBeLessThanOrEqual(2);
  }
  expect(
    Math.abs(implementation.documentHeight - contract.documentHeight) / contract.documentHeight,
  ).toBeLessThanOrEqual(0.005);
});

test("Decor navigation, overlays, and sliders preserve the source interaction states", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "decor-desktop");
  await page.goto("/");
  await waitForNuxtHydration(page);

  const shopToggle = page.getByRole("button", { name: "Open Shop menu" });
  await shopToggle.focus();
  await page.keyboard.press("Enter");
  await expect(shopToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("heading", { level: 2, name: "Furniture" })).toBeVisible();
  await expect(page.getByText("Dining tabl", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(shopToggle).toHaveAttribute("aria-expanded", "false");
  await expect(shopToggle).toBeFocused();

  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("search")).toHaveCount(0);

  await page.getByRole("button", { name: "Preview bag", exact: true }).click();
  const bag = page.locator(".decor-cart-panel");
  await expect(bag).toContainText("Table clock");
  await expect(bag).toContainText("Ceramic mug");
  await expect(bag).toContainText("$199.99");
  await expect(bag.getByRole("link", { name: "View cart" })).toHaveAttribute("href", "/cart");
  await expect(bag.getByRole("link", { name: "Checkout" })).toHaveAttribute("href", "/checkout");
  await page.keyboard.press("Escape");
  await expect(bag).toHaveCount(0);

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Verona sofas" })).toBeVisible();
  const collection = page.locator(".decor-collection");
  const currentProductIndex = Number(await collection.getAttribute("data-motion-active-index"));
  const expectedProductName = ["Wooden cabinet", "Modern chair", "Classic stools"][
    (currentProductIndex + 1) % 3
  ]!;
  await page.getByRole("button", { name: "Next product" }).click();
  await expect(page.getByRole("heading", { level: 3, name: expectedProductName })).toBeVisible();

  const cookieNotice = page.getByRole("complementary", { name: "Cookie notice" });
  await expect(cookieNotice).toBeVisible();
  await cookieNotice.getByRole("button", { name: "Allow cookies" }).click();
  await expect(cookieNotice).toHaveCount(0);

  const newsletter = page.getByRole("textbox", { name: "Email address" });
  await newsletter.scrollIntoViewIfNeeded();
  await newsletter.fill("not-an-email");
  await page.getByRole("button", { name: "Submit newsletter email" }).click();
  await expect(page.locator(".decor-newsletter-message")).toContainText(
    "Please enter a valid email address.",
  );
  await newsletter.fill("preview@example.test");
  await page.getByRole("button", { name: "Submit newsletter email" }).click();
  await expect(page.locator(".decor-newsletter-message")).toContainText(
    "Thanks for joining our newsletter.",
  );
});

test("Decor language selector preserves the four source rows and keyboard lifecycle", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "decor-desktop");
  await page.goto("/");
  await waitForNuxtHydration(page);
  const trigger = page.getByRole("button", {
    name: "Select language, current English",
  });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  const options = page.getByRole("menuitemradio");
  await expect(options).toHaveCount(4);
  await expect(options.first()).toBeFocused();
  await expect(options.first().locator("img")).toHaveAttribute("src", /flag-usa/);
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(options.nth(3)).toBeFocused();
  await page.keyboard.press("Home");
  await expect(options.first()).toBeFocused();
  await options.nth(1).click();
  await expect(page.getByRole("button", { name: "Select language, current France" })).toBeFocused();
  await expect(page.getByRole("menu", { name: "Languages" })).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Select language, current English" }),
  ).toBeVisible();
});

test("Decor hero preserves the Revolution fade, layered entry, autoplay, and pause contract", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "decor-desktop");
  await page.clock.pauseAt(new Date("2026-07-31T08:00:00Z"));
  await page.goto("/");
  const hero = page.locator(".decor-hero");
  await expect(hero).toHaveAttribute("data-motion-ready", "true");
  await expect(hero).toHaveAttribute("data-motion-autoplay-ms", "9000");
  await expect(hero).toHaveAttribute("data-motion-duration-ms", "300");
  await expect(hero).toHaveAttribute("data-motion-active-index", "0");
  await expect(hero).toHaveAttribute("data-motion-phase", "idle");

  const firstLayerStyles = await page
    .locator('.decor-hero-slide[data-state="active"]')
    .evaluate((slide) => {
      const accent = getComputedStyle(slide.querySelector(".decor-hero-accent")!);
      const product = getComputedStyle(slide.querySelector(".decor-hero-product")!);
      const heading = getComputedStyle(slide.querySelector("h1")!);
      return {
        accent: [accent.animationDelay, accent.animationDuration],
        heading: [heading.animationDelay, heading.animationDuration],
        product: [product.animationDelay, product.animationDuration],
      };
    });
  expect(firstLayerStyles).toEqual({
    accent: ["0.5s", "0.3s"],
    heading: ["1.2s", "1s"],
    product: ["1s", "0.8s"],
  });

  await page.clock.fastForward(9_000);
  await expect(hero).toHaveAttribute("data-motion-active-index", "1");
  await expect(hero).toHaveAttribute("data-motion-phase", "transitioning");
  await expect(page.locator('.decor-hero-slide[data-state="entering"] h1')).toHaveText(
    "Verona sofas",
  );
  await page.clock.runFor(300);
  await expect(hero).toHaveAttribute("data-motion-phase", "idle");
  await expect(hero).toHaveAttribute("data-current-index", "1");

  await hero.hover();
  await expect(hero).toHaveAttribute("data-motion-paused", /hover/);
  await page.clock.fastForward(9_000);
  await expect(hero).toHaveAttribute("data-current-index", "1");
  await page.mouse.move(0, 0);
  await expect(hero).toHaveAttribute("data-motion-paused", "");
  await page.clock.fastForward(9_000);
  await expect(hero).toHaveAttribute("data-motion-active-index", "2");
});

test("Decor collection and continuous strips preserve the source Swiper timing contracts", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "decor-desktop");
  await page.clock.pauseAt(new Date("2026-07-31T08:00:00Z"));
  await page.goto("/");

  const collection = page.locator(".decor-collection");
  await expect(collection).toHaveAttribute("data-motion-ready", "true");
  await expect(collection).toHaveAttribute("data-motion-autoplay-ms", "3000");
  await expect(collection).toHaveAttribute("data-motion-duration-ms", "300");
  await expect(collection).toHaveAttribute("data-motion-active-index", "0");
  await expect(collection).toHaveAttribute("data-motion-phase", "idle");

  await page.clock.fastForward(3_000);
  await expect(collection).toHaveAttribute("data-motion-active-index", "1");
  await expect(collection).toHaveAttribute("data-motion-phase", "transitioning");
  await expect(
    collection.locator('.decor-collection-product article[data-state="entering"] h3'),
  ).toHaveText("Modern chair");
  await page.clock.runFor(300);
  await expect(collection).toHaveAttribute("data-current-index", "1");
  await expect(collection).toHaveAttribute("data-motion-phase", "idle");

  await collection.hover();
  await expect(collection).toHaveAttribute("data-motion-paused", /hover/);
  await page.clock.fastForward(3_000);
  await expect(collection).toHaveAttribute("data-current-index", "1");
  await page.mouse.move(0, 0);
  await expect(collection).toHaveAttribute("data-motion-paused", "");

  const marquee = page.locator(".decor-marquee");
  await expect(marquee).toHaveAttribute("data-motion-duration-ms", "8000");
  await expect(marquee.locator(".decor-marquee-track")).toHaveCSS("animation-duration", "8s");
  const clients = page.locator(".decor-clients");
  await expect(clients).toHaveAttribute("data-motion-duration-ms", "3000");
  await expect(clients.locator(".decor-clients-track")).toHaveCSS("animation-duration", "15s");
});

test("Decor products keep distinct destinations, reference typography, and hover actions", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "decor-desktop");
  await page.goto("/");
  await waitForNuxtHydration(page);
  const cards = page.locator("#decor-product-panel .decor-product-card");
  await expect(cards).toHaveCount(8);
  const destinations = await cards
    .locator(".decor-product-link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(new Set(destinations).size).toBe(8);
  expect(destinations).not.toContain("/products/atlas-carry-on");

  const firstCard = cards.first();
  await firstCard.hover();
  await expect(firstCard.getByRole("button", { name: "Save Table clock" })).toBeVisible();
  await expect(
    firstCard.getByRole("button", { name: "Add Table clock to preview bag" }),
  ).toBeVisible();
  await expect(firstCard.getByRole("link", { name: "Quick shop Table clock" })).toBeVisible();
  await expect(firstCard.locator("h3")).toHaveCSS("font-size", "17px");
  await expect(firstCard.locator("h3")).toHaveCSS("font-weight", "600");
  await expect(page.locator(".decor-nav > nav a").first()).toHaveCSS("font-size", "17px");
  await expect(page.locator(".decor-nav > nav a").first()).toHaveCSS("font-weight", "600");
  expect(
    await page
      .locator(".decor-nav > nav > .decor-nav-item > a")
      .evaluateAll((items) => items.map((item) => item.getAttribute("href"))),
  ).toEqual([
    "/",
    "/#decor-products",
    "/#decor-categories",
    "/#decor-footer",
    "/#decor-journal",
    "/#decor-contact",
  ]);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("searchbox")).toBeFocused();

  await firstCard.locator(".decor-product-link").click();
  await expect(page).toHaveURL(/\/products\/table-clock\/?$/);
  await expect(page.locator(".decor-utility-message")).toHaveCount(0);
  await expect(page.locator(".decor-product-detail")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Minimalist wooden chair" }),
  ).toBeVisible();
  expect(
    await page.locator(".decor-product-primary-image").evaluate((image) => {
      return (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0;
    }),
  ).toBe(true);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.locator(".decor-product-message")).toContainText("added to the preview bag");
  const descriptionTab = page.getByRole("tab", { name: "Description" });
  await descriptionTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Additional information" })).toBeFocused();
});

test("Decor route changes start at top, hashes settle, and history restores scroll", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "decor-desktop");
  await page.goto("/");
  await waitForNuxtHydration(page);

  const productLink = page.locator("#decor-product-panel .decor-product-link").first();
  await productLink.scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, -120));
  const savedPosition = await page.evaluate(() => scrollY);
  expect(savedPosition).toBeGreaterThan(0);

  await productLink.click({ force: true });
  await expect(page).toHaveURL(/\/products\/table-clock\/?$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(async () => Math.abs((await page.evaluate(() => scrollY)) - savedPosition))
    .toBeLessThanOrEqual(120);

  await page.goto("/products/table-clock");
  await waitForNuxtHydration(page);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: {
          globalProperties: {
            $router: { push(target: string): Promise<void> };
          };
        };
      };
    };
    await root.__vue_app__?.config.globalProperties.$router.push("/#decor-journal");
  });
  const journal = page.locator("#decor-journal");
  await expect(page).toHaveURL(/#decor-journal$/);
  await expect
    .poll(() => journal.evaluate((element) => Math.abs(element.getBoundingClientRect().top)))
    .toBeLessThanOrEqual(2);
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
  await expect(
    page
      .locator("#decor-product-panel .decor-product-card")
      .first()
      .getByRole("button", { name: "Add Table clock to preview bag" }),
  ).toBeVisible();
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
  await expect(page.locator(".decor-marquee-track")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".decor-hero")).toHaveAttribute("data-motion-paused", /reduced-motion/);
  await expect(page.locator(".decor-collection")).toHaveAttribute(
    "data-motion-paused",
    /reduced-motion/,
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".decor-hero")).not.toHaveAttribute(
    "data-motion-paused",
    /reduced-motion/,
  );
  await expect(page.locator(".decor-collection")).not.toHaveAttribute(
    "data-motion-paused",
    /reduced-motion/,
  );
});

test("Decor preview emits no commerce mutation or prohibited runtime request", async ({ page }) => {
  const requests: { method: string; url: string }[] = [];
  page.on("request", (request) => requests.push({ method: request.method(), url: request.url() }));
  await page.goto("/");
  await page.getByRole("button", { name: "Add Table clock to preview bag" }).first().click();
  const html = (await page.content()).toLowerCase();
  expect(html).not.toMatch(/jquery|revolution|contact\.php/);
  expect(requests.filter(({ method }) => method !== "GET")).toEqual([]);
  expect(requests.filter(({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url))).toEqual([]);
});
