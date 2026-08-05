import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  assertThemeLayout,
  captureThemeEvidence,
  waitForNuxtHydration,
} from "./support/theme-fidelity";
import { themeViewportIds, type ThemeViewportId } from "./support/theme-viewports";

interface ResponsiveRouteContract {
  grid?: {
    columns: Record<ThemeViewportId, number>;
    selector: string;
  };
  heading: string;
  path: string;
}

const responsiveRoutes: readonly ResponsiveRouteContract[] = [
  { heading: "Women's collection", path: "/" },
  {
    grid: {
      columns: { desktop: 3, laptop: 3, mobile: 1, tablet: 3 },
      selector: ".fashion-about-stories",
    },
    heading: "About",
    path: "/about",
  },
  {
    grid: {
      columns: { desktop: 2, laptop: 2, mobile: 1, tablet: 1 },
      selector: ".fashion-account-page",
    },
    heading: "My account",
    path: "/account",
  },
  {
    grid: {
      columns: { desktop: 3, laptop: 3, mobile: 1, tablet: 3 },
      selector: ".fashion-article-related > div",
    },
    heading: "Marketing tips and tricks for your creative website.",
    path: "/magazine/1",
  },
  {
    grid: {
      columns: { desktop: 2, laptop: 2, mobile: 1, tablet: 1 },
      selector: ".fashion-cart-layout",
    },
    heading: "Shopping cart",
    path: "/cart",
  },
  {
    grid: {
      columns: { desktop: 2, laptop: 2, mobile: 1, tablet: 1 },
      selector: ".fashion-checkout-layout",
    },
    heading: "Checkout",
    path: "/checkout",
  },
  {
    grid: {
      columns: { desktop: 3, laptop: 3, mobile: 1, tablet: 2 },
      selector: ".fashion-collection-page-grid",
    },
    heading: "Collection",
    path: "/collections/new-arrivals",
  },
  {
    grid: {
      columns: { desktop: 3, laptop: 3, mobile: 1, tablet: 2 },
      selector: ".fashion-contact-locations",
    },
    heading: "Contact",
    path: "/contact",
  },
  {
    grid: {
      columns: { desktop: 2, laptop: 2, mobile: 1, tablet: 1 },
      selector: ".fashion-faq-page",
    },
    heading: "FAQs",
    path: "/faq",
  },
  {
    grid: {
      columns: { desktop: 4, laptop: 4, mobile: 1, tablet: 2 },
      selector: ".fashion-magazine-page",
    },
    heading: "Magazine",
    path: "/magazine",
  },
  {
    grid: {
      columns: { desktop: 4, laptop: 4, mobile: 1, tablet: 2 },
      selector: ".fashion-shop-grid",
    },
    heading: "Shop",
    path: "/collections/all?layout=no-sidebar",
  },
  {
    grid: {
      columns: { desktop: 2, laptop: 2, mobile: 1, tablet: 1 },
      selector: ".fashion-shop-layout",
    },
    heading: "Shop",
    path: "/collections/all?layout=right-sidebar",
  },
  {
    grid: {
      columns: { desktop: 2, laptop: 2, mobile: 1, tablet: 1 },
      selector: ".fashion-shop-layout",
    },
    heading: "Shop",
    path: "/collections/all",
  },
  {
    grid: {
      columns: { desktop: 2, laptop: 2, mobile: 1, tablet: 1 },
      selector: ".fashion-product-main",
    },
    heading: "Textured sweater",
    path: "/products/textured-sweater",
  },
  {
    grid: {
      columns: { desktop: 4, laptop: 4, mobile: 1, tablet: 2 },
      selector: ".fashion-wishlist-page",
    },
    heading: "Wishlist",
    path: "/wishlist",
  },
];

for (const route of responsiveRoutes) {
  test(`${route.path} passes its four-size Fashion acceptance contract`, async ({
    page,
  }, testInfo) => {
    const viewport = testInfo.project.name.replace("fashion-", "") as ThemeViewportId;
    test.skip(!themeViewportIds.includes(viewport));

    await page.goto(route.path);
    await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
    if ((page.viewportSize()?.width ?? 1200) <= 991)
      await expect(page.locator(".fashion-mobile-menu > summary")).toBeVisible();
    else await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Legal" })).toBeVisible();
    if (route.path === "/cart") {
      await expect(page.getByRole("heading", { level: 1, name: "Shopping cart" })).toBeVisible();
      await expect(page.locator(".fashion-cart-products > article")).toHaveCount(3);
      await expect(page.locator('.fashion-cart-totals input[type="radio"]')).toHaveCount(3);
      await expect(page.getByRole("button", { name: "Empty cart" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Update cart" })).toBeVisible();
    }
    if (route.path === "/account")
      await expect(page.getByRole("heading", { level: 2, name: "Member login" })).toBeVisible();
    if (route.path === "/magazine") {
      await expect(page.locator(".fashion-magazine-page article")).toHaveCount(12);
      await expect(page.getByRole("heading", { level: 1, name: "Magazine" })).toBeVisible();
    }
    if (route.path === "/about") {
      await expect(page.locator(".fashion-about-page > section")).toHaveCount(5);
      await expect(page.locator(".fashion-about-page img")).toHaveCount(10);
    }
    if (route.path === "/faq")
      await expect(page.locator(".fashion-faq-page details")).toHaveCount(8);
    if (route.path === "/wishlist")
      await expect(page.locator(".fashion-wishlist-page > article")).toHaveCount(8);
    if (route.path === "/contact")
      await expect(page.locator(".fashion-contact-page > section")).toHaveCount(3);
    if (route.grid) {
      const columns = await page.locator(route.grid.selector).evaluate((element) => {
        const tracks = getComputedStyle(element).gridTemplateColumns;
        return tracks === "none" ? 1 : tracks.split(" ").filter(Boolean).length;
      });
      expect(columns, `${route.grid.selector} column count at ${viewport}`).toBe(
        route.grid.columns[viewport],
      );
    }
    const clippedText = await page.evaluate(() => {
      const root =
        document.querySelector("main") ??
        document.querySelector(".fashion-shop-page, .fashion-product-detail");
      if (!root) return ["missing page root"];
      return [
        ...root.querySelectorAll<HTMLElement>(
          "h1, h2, h3, h4, p, a, button, label, summary, dt, dd",
        ),
      ]
        .filter((element) => {
          if (element.closest('.sr-only, [aria-hidden="true"]')) return false;
          if (!element.textContent?.replaceAll(/\s+/g, "").length) return false;
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity || "1") === 0 ||
            box.width === 0 ||
            box.height === 0
          )
            return false;
          const clipsX = ["clip", "hidden"].includes(style.overflowX);
          const clipsY = ["clip", "hidden"].includes(style.overflowY);
          return (
            (clipsX && element.scrollWidth > element.clientWidth + 1) ||
            (clipsY && element.scrollHeight > element.clientHeight + 1)
          );
        })
        .map(
          (element) =>
            `${element.tagName}:${element.textContent?.replaceAll(/\s+/g, " ").trim().slice(0, 60)}`,
        );
    });
    expect(clippedText).toEqual([]);
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
  await expect(
    page
      .locator(
        'link[rel="preload"][as="image"][fetchpriority="high"][href*="demo-fashion-store-slider-01"]',
      )
      .first(),
  ).toBeAttached();
  await expect(page.locator(".fashion-hero-image").first()).toHaveCSS(
    "background-image",
    /demo-fashion-store-slider-01/,
  );
  await expect(
    page.locator('.fashion-nav-actions button[aria-label="Search"] .fashion-feather-search'),
  ).toHaveCount(1);
  await expect(
    page.locator(
      '.fashion-nav-actions a[aria-label="Account"][href="/account"] .fashion-feather-user',
    ),
  ).toHaveCount(1);
  await expect(
    page.locator(
      '.fashion-nav-actions button[aria-label="Preview bag"] .fashion-feather-shopping-bag',
    ),
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
          renderedHeight: Math.round(box.height * 1_000) / 1_000,
          renderedWidth: Math.round(box.width * 1_000) / 1_000,
          source: (image as HTMLImageElement).getAttribute("src"),
          width: image.getAttribute("width"),
        };
      }),
    ),
  ).toEqual([
    expect.objectContaining({
      height: "42",
      naturalHeight: 512,
      naturalWidth: 512,
      renderedHeight: 42,
      renderedWidth: 42,
      source: expect.stringContaining("service-box"),
      width: "42",
    }),
    expect.objectContaining({
      height: "42",
      naturalHeight: 512,
      naturalWidth: 512,
      renderedHeight: 42,
      renderedWidth: 42,
      source: expect.stringContaining("service-return"),
      width: "42",
    }),
    expect.objectContaining({
      height: "42",
      naturalHeight: 512,
      naturalWidth: 512,
      renderedHeight: 42,
      renderedWidth: 42,
      source: expect.stringContaining("service-payment"),
      width: "42",
    }),
    expect.objectContaining({
      height: "42",
      naturalHeight: 512,
      naturalWidth: 512,
      renderedHeight: 42,
      renderedWidth: 42,
      source: expect.stringContaining("service-support"),
      width: "42",
    }),
  ]);
  await expect(page.locator(".fashion-collection-track article")).toHaveCount(8);
  await expect(page.locator(".fashion-collection-controls")).toHaveCount(0);
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
  await expect(
    page.locator(".fashion-hero-slide").nth(1).locator(".fashion-hero-image"),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Atlas carry-on");
  await assertThemeLayout(page);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("Fashion section geometry stays inside the measured source contract", async ({
  page,
}, testInfo) => {
  const viewportId = testInfo.project.name.replace("fashion-", "");
  test.skip(!["desktop", "laptop", "mobile", "tablet"].includes(viewportId));
  await page.goto("/");
  const selectors = [
    ".fashion-header",
    ".fashion-hero",
    ".fashion-service-strip",
    ".fashion-categories",
    "#fashion-bestsellers",
    ".fashion-promo-band",
    ".fashion-collection",
    ".fashion-brands",
    "#fashion-featured",
    ".fashion-promises",
    ".fashion-magazine",
    ".fashion-footer",
  ];
  const contracts: Record<string, { documentHeight: number; heights: number[] }> = {
    desktop: {
      documentHeight: 5_218,
      heights: [
        118, 882, 196, 209.6875, 1_032.75, 63, 612, 173.75, 640.21875, 100, 729.859375, 460.75,
      ],
    },
    laptop: {
      documentHeight: 6_890,
      heights: [
        118, 782, 220, 706.90625, 1_372.90625, 63, 530, 173.75, 1_193.78125, 100, 1_094.296875,
        535.25,
      ],
    },
    mobile: {
      documentHeight: 15_230,
      heights: [
        79, 500, 409, 1_170, 5_883.4375, 129, 815.5, 239.25, 3_009.546875, 90, 1_935.125, 970,
      ],
    },
    tablet: {
      documentHeight: 6_972,
      heights: [
        118, 600, 247, 526.4375, 1_714.71875, 63, 745.234375, 133.75, 963.046875, 100, 1_042.453125,
        717.75,
      ],
    },
  };
  const contract = contracts[viewportId]!;
  const implementation = await page.evaluate((regionSelectors) => {
    return {
      documentHeight: document.documentElement.scrollHeight,
      regions: regionSelectors.map((selector) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return { height: rect?.height ?? 0, selector };
      }),
    };
  }, selectors);
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

test("Fashion fluid tablet layout and transient header states match the source", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.setViewportSize({ height: 900, width: 1024 });
  await page.goto("/");
  await waitForNuxtHydration(page);

  const collectionGeometry = await page.evaluate(() => {
    const box = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect() ?? new DOMRect();
    const copy = box(".fashion-collection-copy");
    const button = box(".fashion-collection-copy a");
    const rail = box(".fashion-collection-rail");
    return {
      buttonGap: rail.top - button.bottom,
      copyOverlap: Math.max(0, copy.bottom - rail.top),
    };
  });
  expect(collectionGeometry.copyOverlap).toBe(0);
  expect(collectionGeometry.buttonGap).toBeGreaterThanOrEqual(38);

  await page.setViewportSize({ height: 1000, width: 1440 });
  await page.reload();
  await waitForNuxtHydration(page);

  await page.getByRole("button", { name: "Search" }).click();
  const search = page.getByRole("search");
  await expect(search.getByRole("heading", { name: "What are you looking for?" })).toBeVisible();
  const searchGeometry = await search.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
  });
  expect(searchGeometry).toEqual({ height: 1000, left: 0, top: 0, width: 1440 });
  await page.getByRole("button", { name: "Close search" }).click();
  await expect(page.locator(".fashion-search-panel")).toHaveCount(1);
  await expect(page.locator(".fashion-search-panel")).toHaveCSS("transition-duration", "0.2s");
  await expect(page.locator(".fashion-search-panel")).toHaveCount(0, { timeout: 1_000 });

  await page.getByRole("button", { name: "Preview bag", exact: true }).hover();
  const cart = page.locator(".fashion-cart-panel");
  await expect(cart.getByRole("button", { name: /^Remove / })).toHaveCount(2);

  const shopToggle = page.getByRole("button", { name: "Open Shop menu" });
  await shopToggle.hover();
  await expect(page.locator(".fashion-shop-menu-panel")).toBeVisible();
  await expect(cart).toBeHidden();

  await page.mouse.move(0, 899);
  const pagesToggle = page.getByRole("button", { name: "Open Pages menu" });
  await pagesToggle.click();
  const pagesMenu = page.locator(".fashion-pages-menu");
  await expect(pagesMenu).toBeVisible();
  await expect(pagesMenu).toHaveCSS("width", "245px");
  await expect(pagesMenu).toHaveCSS("padding-top", "35px");
});

test("Fashion category and product-detail destinations preserve source interaction intent", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.goto("/");
  await waitForNuxtHydration(page);

  const categoryDestinations = await page
    .locator(".fashion-category-control")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(categoryDestinations).toEqual([
    "/collections/women",
    "/collections/men",
    "/collections/accessories",
    "/collections/kids",
  ]);
  await page.locator(".fashion-category-control").first().click();
  await expect(page).toHaveURL(/\/collections\/women\/?$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);

  const shopToggle = page.getByRole("button", { name: "Open Shop menu" });
  await shopToggle.click();
  const shopColumnDestinations = await page
    .locator(".fashion-shop-columns section")
    .evaluateAll((sections) =>
      sections.map((section) => section.querySelector("a")?.getAttribute("href")),
    );
  expect(shopColumnDestinations).toEqual([
    "/collections/men",
    "/collections/women",
    "/collections/kids",
    "/collections/divided",
    "/collections/accessories",
  ]);

  await page.goto("/products/textured-sweater");
  await expect(page.locator(".fashion-product-detail")).toBeVisible();
  await expect(page.locator(".fashion-product-thumbs button")).toHaveCount(6);
  await expect(page.locator(".fashion-product-gallery-stage")).toHaveAttribute(
    "aria-label",
    "Product image gallery",
  );
});

test("Fashion mega-menu hover states keep transparent surfaces and intrinsic text flow", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.goto("/");
  await waitForNuxtHydration(page);

  await page.getByRole("button", { name: "Open Collection menu" }).hover();
  const collectionItem = page.locator(".fashion-collection-menu > a").first();
  const collectionBefore = await collectionItem.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    labelFits: [...element.querySelectorAll<HTMLElement>(".fashion-collection-label > span")].every(
      (label) => label.scrollWidth <= label.clientWidth && label.scrollHeight <= label.clientHeight,
    ),
  }));
  await collectionItem.hover();
  expect(
    await collectionItem.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe(collectionBefore.background);
  expect(collectionBefore.labelFits).toBe(true);

  await page.getByRole("button", { name: "Open Shop menu" }).hover();
  const shopItem = page.locator(".fashion-shop-columns a").first();
  const shopBackground = await shopItem.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await shopItem.hover();
  expect(await shopItem.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    shopBackground,
  );
});

test("Fashion utility and editorial links navigate to dedicated pages", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.goto("/");
  await waitForNuxtHydration(page);

  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/?$/);
  await expect(page.getByRole("heading", { level: 2, name: "Member login" })).toBeVisible();

  await page.getByRole("link", { name: "Magazine", exact: true }).first().click();
  await expect(page).toHaveURL(/\/magazine\/?$/);
  await expect(page.locator(".fashion-magazine-page")).toBeVisible();
});

test("Fashion source-critical controls retain exact local geometry, color, and text layout", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-laptop");
  await page.goto("/");
  await waitForNuxtHydration(page);

  const categoryControl = page.locator(".fashion-category-control").first();
  await expect(categoryControl).toHaveCSS("height", "46px");
  await expect(categoryControl).toHaveCSS("border-radius", "4px");
  expect(
    await categoryControl.evaluate(
      (control) =>
        control.scrollWidth <= control.clientWidth && control.scrollHeight <= control.clientHeight,
    ),
  ).toBe(true);

  const newBadge = page.locator("#fashion-bestsellers .fashion-product-badge").first();
  await expect(newBadge).toHaveText("New");
  await expect(newBadge).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(newBadge).toHaveCSS("border-radius", "2px");

  const collectionLayout = await page.evaluate(() => {
    const copy = document.querySelector(".fashion-collection-copy")!.getBoundingClientRect();
    const rail = document.querySelector(".fashion-collection-rail")!.getBoundingClientRect();
    const actions = [
      ...document.querySelectorAll<HTMLElement>(
        ".fashion-collection-copy a, .fashion-collection-copy p",
      ),
    ];
    return {
      copyBottom: copy.bottom,
      overlap: actions.some((element) => element.getBoundingClientRect().bottom > rail.top + 1),
      railTop: rail.top,
    };
  });
  expect(collectionLayout.overlap).toBe(false);
  expect(collectionLayout.copyBottom).toBeLessThanOrEqual(collectionLayout.railTop + 1);

  await page.goto("/products/textured-sweater");
  await waitForNuxtHydration(page);
  const controls = await page.evaluate(() => {
    const color = document.querySelector<HTMLElement>(".fashion-product-colors label span")!;
    const size = document.querySelector<HTMLElement>(".fashion-product-sizes label span")!;
    const quantity = document.querySelector<HTMLElement>(".fashion-product-quantity")!;
    const quantityText = document.querySelector<HTMLElement>(".fashion-product-quantity output")!;
    const tabs = document.querySelector<HTMLElement>('.fashion-product-tabs [role="tablist"]')!;
    const tabButtons = [...tabs.querySelectorAll<HTMLElement>('[role="tab"]')];
    const colorAfter = getComputedStyle(color, "::after");
    const sizeAfter = getComputedStyle(size, "::after");
    return {
      colorAfter: {
        border: colorAfter.border,
        height: colorAfter.height,
        left: colorAfter.left,
        top: colorAfter.top,
        width: colorAfter.width,
      },
      quantity: {
        border: getComputedStyle(quantityText).border,
        borderRadius: getComputedStyle(quantityText).borderRadius,
        color: getComputedStyle(quantityText).color,
        height: quantity.getBoundingClientRect().height,
        width: quantity.getBoundingClientRect().width,
      },
      sizeAfter: {
        border: sizeAfter.border,
        height: sizeAfter.height,
        left: sizeAfter.left,
        top: sizeAfter.top,
        width: sizeAfter.width,
      },
      tabs: {
        clientWidth: tabs.clientWidth,
        allSingleLine: tabButtons.every(
          (button) =>
            button.scrollHeight <= button.clientHeight && button.scrollWidth <= button.clientWidth,
        ),
        scrollWidth: tabs.scrollWidth,
      },
    };
  });
  expect(controls.colorAfter).toEqual({
    border: "2px solid rgb(255, 255, 255)",
    height: "28px",
    left: "2px",
    top: "2px",
    width: "28px",
  });
  expect(controls.sizeAfter).toEqual({
    border: "1px solid rgb(35, 35, 35)",
    height: "37px",
    left: "-1px",
    top: "-1px",
    width: "37px",
  });
  expect(controls.quantity).toEqual({
    border: "1px solid rgb(228, 228, 228)",
    borderRadius: "5px",
    color: "rgb(35, 35, 35)",
    height: 54,
    width: 115,
  });
  expect(controls.tabs.allSingleLine).toBe(true);
  expect(controls.tabs.scrollWidth).toBeLessThanOrEqual(controls.tabs.clientWidth);
});

test("Fashion category routes render their requested source-equivalent shop context", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.goto("/collections/women");
  await waitForNuxtHydration(page);
  await expect(page.locator(".fashion-shop-page")).toBeVisible();
  await expect(page.locator(".fashion-shop-breadcrumb h1")).toHaveText("Shop");
  await expect(page.locator(".fashion-shop-page")).toHaveAttribute("data-collection", "women");
  await expect(page.locator(".fashion-shop-grid article")).toHaveCount(12);
  await expect(page.locator('.fashion-shop-grid a[href^="/products/"]').first()).toBeVisible();

  await page.goto("/collections/kids");
  await expect(page.locator(".fashion-shop-breadcrumb h1")).toHaveText("Shop");
  await expect(page.locator(".fashion-shop-page")).toHaveAttribute("data-collection", "kids");
});

test("Fashion collection and sidebar variants preserve their distinct source layouts", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");

  await page.goto("/collections/new-arrivals");
  await waitForNuxtHydration(page);
  await expect(page.locator(".fashion-shop-breadcrumb h1")).toHaveText("Collection");
  await expect(page.locator(".fashion-collection-page-grid article")).toHaveCount(6);
  await expect(page.locator(".fashion-shop-layout")).toHaveCount(0);

  await page.goto("/collections/all?layout=no-sidebar");
  await expect(page.locator(".fashion-shop-layout")).toHaveAttribute("data-layout", "no-sidebar");
  await expect(page.locator(".fashion-shop-sidebar")).toHaveCount(0);
  await expect(page.locator(".fashion-shop-grid article")).toHaveCount(12);

  await page.goto("/collections/all?layout=right-sidebar");
  await expect(page.locator(".fashion-shop-layout")).toHaveAttribute(
    "data-layout",
    "right-sidebar",
  );
  const rightSidebarGeometry = await page.evaluate(() => {
    const products = document.querySelector(".fashion-shop-products")?.getBoundingClientRect();
    const sidebar = document.querySelector(".fashion-shop-sidebar")?.getBoundingClientRect();
    return { productsX: products?.x ?? 0, sidebarX: sidebar?.x ?? 0 };
  });
  expect(rightSidebarGeometry.sidebarX).toBeGreaterThan(rightSidebarGeometry.productsX);
});

test("Fashion uses the original retina logo at DPR 2", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop-2x");
  await page.goto("/");
  await waitForNuxtHydration(page);
  const logo = page.locator(".fashion-brand img");
  await expect(logo).toHaveAttribute("srcset", /@2x/);
  expect(await logo.evaluate((image) => (image as HTMLImageElement).currentSrc)).toMatch(
    /logo-black@2x/,
  );
});

test("Fashion navigation keeps centered logo, split groups, and distinct destinations", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "fashion-no-js");
  await page.goto("/");
  await waitForNuxtHydration(page);
  const mobile = (page.viewportSize()?.width ?? 1_440) <= 991;
  const expectedDestinations = [
    "/",
    "/collections/all",
    "/collections/new-arrivals",
    "/magazine",
    "/about",
    "/contact",
  ];
  if (mobile) {
    const mobileMenu = page.locator(".fashion-mobile-menu");
    await mobileMenu.locator(":scope > summary").click();
    const links = page.locator(".fashion-mobile-menu nav > div > a:first-child");
    await expect(links).toHaveCount(6);
    expect(
      await links.evaluateAll((items) => items.map((item) => item.getAttribute("href"))),
    ).toEqual(expectedDestinations);
    await page.keyboard.press("Escape");
    await expect(mobileMenu).toHaveJSProperty("open", false);
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
  await page.mouse.move(0, (page.viewportSize()?.height ?? 1_000) - 1);
  await shopToggle.focus();
  await expect(shopToggle).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await expect(shopToggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(shopToggle).toHaveAttribute("aria-expanded", "false");
  await expect(shopToggle).toBeFocused();
});

test("Fashion product detail remains source-complete and responsive", async ({
  page,
}, testInfo) => {
  test.skip(["fashion-no-js", "fashion-reduced-motion"].includes(testInfo.project.name));
  await page.goto("/products/textured-sweater");
  await waitForNuxtHydration(page);

  await expect(page.locator(".fashion-product-thumbs button")).toHaveCount(6);
  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.locator(".fashion-product-payment-methods img")).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );

  if (testInfo.project.name !== "fashion-desktop") return;
  const stage = page.locator(".fashion-product-gallery-stage");
  await page.getByRole("button", { name: "Open product image preview" }).click();
  const lightbox = page.getByRole("dialog", { name: "Product image preview" });
  await expect(lightbox).toBeVisible();
  await page.waitForTimeout(2_200);
  await expect(stage).toHaveAttribute("data-motion-active-index", "0");
  await lightbox.getByRole("button", { name: "Close product image preview" }).click();
  await expect(lightbox).not.toBeVisible();
  await stage.hover();
  await page.locator(".fashion-product-thumbs button").nth(2).click();
  await expect(stage).toHaveAttribute("data-motion-active-index", "2");
  await page.waitForTimeout(2_200);
  await expect(stage).toHaveAttribute("data-motion-active-index", "2");
  await page.mouse.move(0, 0);
  await expect(stage).not.toHaveAttribute("data-motion-active-index", "2", { timeout: 3_000 });
});

test("Fashion search, cart, and membership affordances have complete source interactions", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.goto("/");
  await waitForNuxtHydration(page);

  const bag = page.getByRole("button", { name: "Preview bag", exact: true });
  await bag.hover();
  const cartPanel = page.locator(".fashion-cart-panel");
  await expect(cartPanel).toBeVisible();
  await expect(cartPanel.getByRole("link", { name: "View cart" })).toHaveAttribute("href", "/cart");
  await expect(cartPanel.getByRole("link", { name: "Checkout" })).toHaveAttribute(
    "href",
    "/checkout",
  );

  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.getByRole("button", { name: "Close search" }).click();
  await expect(page.getByRole("search")).toHaveCount(0);

  await page.waitForTimeout(1_050);
  const cookieButton = page.getByRole("button", { name: "Allow cookies" });
  if (await cookieButton.isVisible()) await cookieButton.click();
  const footer = page.locator(".fashion-footer");
  await footer.scrollIntoViewIfNeeded();
  const email = page.getByRole("textbox", { name: "Email address" });
  await email.fill("not-an-email");
  await page.getByRole("button", { name: "Submit membership email" }).click();
  await expect(page.locator(".fashion-newsletter-message")).toContainText(
    "Please enter a valid email address.",
  );
  await email.fill("preview@example.test");
  await page.getByRole("button", { name: "Submit membership email" }).click();
  await expect(page.locator(".fashion-newsletter-message")).toContainText(
    "ready for this preview membership",
  );
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
  await expect(page.getByRole("search")).toBeVisible();
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("search")).toHaveCount(0);

  await firstCard.locator(".fashion-product-link").click({ position: { x: 20, y: 20 } });
  await expect(page).toHaveURL(/\/products\/textured-sweater\/?$/);
  await expect(page.locator(".fashion-utility-message")).toHaveCount(0);
  await expect(page.locator(".fashion-product-detail")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Relaxed corduroy shirt" }),
  ).toBeVisible();
  await expect(page.locator(".fashion-product-secondary-actions button")).toHaveText([
    "Compare",
    "Ask a question",
    "Share",
  ]);
  await expect(page.locator(".fashion-product-payment-methods img")).toHaveCount(6);
  await expect(page.locator(".fashion-product-taxonomy")).toContainText(
    /Category:\s+Fashion,\s+Woman/,
  );
  await expect(page.locator(".fashion-product-taxonomy")).toContainText(
    "Tags: Shirts, Cotton, Printed",
  );
  await expect(page.getByRole("tab")).toHaveCount(4);
  expect(
    await page.locator(".fashion-product-primary-image").evaluate((image) => {
      return (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0;
    }),
  ).toBe(true);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.locator(".fashion-product-message")).toContainText(
    "1 × Relaxed corduroy shirt added to the preview bag",
  );
  const descriptionTab = page.getByRole("tab", { name: "Description" });
  await expect(page.getByText("We make you feel special")).toBeVisible();
  await descriptionTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Additional information" })).toBeFocused();
});

test("Fashion route changes start at top, Magazine is distinct, and history restores scroll", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.goto("/");
  await waitForNuxtHydration(page);

  const productLinks = page.locator("#fashion-bestsellers .fashion-product-link");
  await expect(productLinks).toHaveCount(10);
  const productLink = productLinks.first();
  await productLink.scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, -120));
  const savedPosition = await page.evaluate(() => scrollY);
  expect(savedPosition).toBeGreaterThan(0);

  await productLink.click({ force: true });
  await expect(page).toHaveURL(/\/products\/textured-sweater\/?$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(async () => Math.abs((await page.evaluate(() => scrollY)) - savedPosition))
    .toBeLessThanOrEqual(120);

  await page.goto("/products/textured-sweater");
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("link", { name: "Magazine", exact: true }).first().click();
  await expect(page).toHaveURL(/\/magazine\/?$/);
  await expect(page.locator(".fashion-magazine-page")).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

test("Fashion cookie and scroll progress follow their source lifecycle", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.goto("/");

  const cookie = page.locator(".fashion-cookie-message");
  await expect(cookie).toHaveCount(0);
  await expect(cookie).toBeVisible({ timeout: 1_500 });
  await cookie.getByRole("button", { name: "Allow cookies" }).click();
  await expect(cookie).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(1_050);
  await expect(cookie).toHaveCount(0);

  const progress = page.locator(".fashion-scroll-progress");
  await expect(progress).not.toHaveClass(/visible/);
  await page.evaluate(() => scrollTo(0, 800));
  await expect(progress).toHaveClass(/visible/);
  expect(Number(await progress.getAttribute("data-scroll-progress"))).toBeGreaterThan(0);
  await progress.getByRole("link", { name: "Back to top" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(progress).not.toHaveClass(/visible/);
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
  await page.evaluate(async () => {
    const wait = (milliseconds: number) =>
      new Promise<void>((resolvePromise) => setTimeout(resolvePromise, milliseconds));
    for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight * 0.75) {
      scrollTo(0, top);
      await wait(60);
    }
    scrollTo(0, document.documentElement.scrollHeight);
    await wait(1_800);
    scrollTo(0, 0);
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    // Crafto's source-exact 9px white-on-#2ebb79 New badge is decorative and
    // intentionally preserved; keep that audited exception narrower than the rule.
    .exclude(".fashion-product-badge")
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
  await expect(page.locator(".fashion-promises")).toHaveAttribute("data-motion-paused", "true");
  await expect(page.locator(".fashion-promises-track")).toHaveCSS("animation-name", "none");
});

test("Fashion hero follows the source timing, direction, parallax, and autoplay contract", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.clock.pauseAt(new Date("2026-07-31T08:00:00Z"));
  await page.goto("/");

  const hero = page.locator(".fashion-hero");
  await expect(hero).toHaveAttribute("data-motion-ready", "true");
  await expect(hero).toHaveAttribute("data-motion-direction", "vertical");
  await expect(hero).toHaveAttribute("data-motion-active-index", "0");
  await expect(hero).toHaveAttribute("data-motion-phase", "idle");

  await page.clock.fastForward(4_000);
  await expect(hero).toHaveAttribute("data-motion-active-index", "1");
  await expect(hero).toHaveAttribute("data-motion-phase", "transitioning");
  await page.clock.runFor(1_000);
  await expect(hero).toHaveAttribute("data-motion-phase", "idle");
  await hero.evaluate((element) => {
    for (const animation of element.getAnimations({ subtree: true })) animation.finish();
  });

  const settled = await page.locator(".fashion-hero-slide").evaluateAll((slides) =>
    slides.map((slide) => ({
      image: getComputedStyle(slide.querySelector(".fashion-hero-image")!).transform,
      slide: getComputedStyle(slide).transform,
    })),
  );
  expect(settled[1]).toEqual({
    image: "matrix(1, 0, 0, 1, 0, 0)",
    slide: "matrix(1, 0, 0, 1, 0, 0)",
  });
  expect(settled[0]?.image).toContain("500");

  await page.clock.fastForward(4_000);
  await expect(hero).toHaveAttribute("data-motion-active-index", "2");
});

test("Fashion collection preserves the source keyboard, swipe, autoplay, and loop behavior", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.clock.pauseAt(new Date("2026-07-31T08:00:00Z"));
  await page.goto("/");

  const rail = page.locator(".fashion-collection-rail");
  const track = page.locator(".fashion-collection-track");
  await expect(rail).toHaveAttribute("data-motion-ready", "true");
  await expect(rail).toHaveAttribute("data-motion-active-index", "0");
  await expect(rail).toHaveAttribute("data-motion-phase", "idle");

  await rail.focus();
  await page.keyboard.press("ArrowRight");
  await expect(rail).toHaveAttribute("data-motion-active-index", "1");
  await expect(rail).toHaveAttribute("data-motion-phase", "transitioning");
  const firstTranslation = await track.evaluate(
    (element) => (element as HTMLElement).style.transform,
  );
  expect(firstTranslation).not.toBe("translate3d(0px, 0, 0)");
  await page.clock.runFor(300);
  await expect(rail).toHaveAttribute("data-motion-phase", "idle");

  const bounds = await rail.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.75, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.25, bounds!.y + bounds!.height / 2);
  await page.mouse.up();
  await expect(rail).toHaveAttribute("data-motion-active-index", "2");
  await page.clock.runFor(300);
  await expect(rail).toHaveAttribute("data-motion-phase", "idle");

  await page.clock.fastForward(4_000);
  await expect(rail).toHaveAttribute("data-motion-active-index", "3");
  await page.clock.runFor(300);
  await page.clock.fastForward(4_000);
  await expect(rail).toHaveAttribute("data-motion-active-index", "0");
  await page.clock.runFor(300);
  await expect(rail).toHaveAttribute("data-motion-phase", "idle");
  await expect(track).toHaveAttribute("data-transition-enabled", "false");
  await page.clock.runFor(16);
  await expect(track).toHaveAttribute("data-transition-enabled", "true");
});

test("Fashion promise marquee continuously follows the source timing contract", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.goto("/");

  const marquee = page.locator(".fashion-promises");
  const track = page.locator(".fashion-promises-track");
  await expect(marquee).toHaveAttribute("data-motion-duration-ms", "10000");
  await expect(marquee).toHaveAttribute("data-motion-easing", "linear");
  await expect(marquee).toHaveAttribute("data-motion-paused", "false");
  await expect(track.locator(".fashion-promises-cycle")).toHaveCount(2);
  await expect(track.locator(".fashion-promises-cycle").first().locator("p")).toHaveCount(5);

  await track.evaluate((element) => {
    const animation = element.getAnimations()[0]!;
    animation.pause();
    animation.currentTime = 0;
  });
  const before = await track.evaluate((element) => getComputedStyle(element).transform);
  await track.evaluate((element) => {
    element.getAnimations()[0]!.currentTime = 5_000;
  });
  const midpoint = await track.evaluate((element) => getComputedStyle(element).transform);
  expect(midpoint).not.toBe(before);
  await track.evaluate((element) => {
    element.getAnimations()[0]!.currentTime = 50_000;
  });
  const looped = await track.evaluate((element) => getComputedStyle(element).transform);
  expect(looped).toBe(before);
});

test("Fashion body sections preserve source reveal transforms, timing, and stagger", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.goto("/");

  const magazine = page.locator(".fashion-magazine > div");
  const articles = magazine.locator(":scope > article");
  await expect(articles).toHaveCount(4);
  await expect(articles.first()).toHaveAttribute("data-source-reveal", "pending");
  expect(
    await articles.evaluateAll((items) =>
      items.map((item) => ({
        delay: (item as HTMLElement).style.getPropertyValue("--fashion-reveal-delay"),
        duration: (item as HTMLElement).style.getPropertyValue("--fashion-reveal-duration"),
        transform: (item as HTMLElement).style.getPropertyValue("--fashion-reveal-transform"),
      })),
    ),
  ).toEqual([
    { delay: "300ms", duration: "500ms", transform: "translate3d(-15px, 15px, 0)" },
    { delay: "600ms", duration: "500ms", transform: "translate3d(-15px, 15px, 0)" },
    { delay: "900ms", duration: "500ms", transform: "translate3d(-15px, 15px, 0)" },
    { delay: "1200ms", duration: "500ms", transform: "translate3d(-15px, 15px, 0)" },
  ]);

  await magazine.scrollIntoViewIfNeeded();
  await expect(articles.first()).toHaveAttribute("data-source-reveal", "revealed");
  await expect(articles.last()).toHaveCSS("opacity", "1", { timeout: 2_000 });
});

test("Fashion waits for approved fonts and keeps atomic utility labels on one line", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "fashion-desktop");
  await page.goto("/");
  const typography = await page.evaluate(async () => {
    await document.fonts.ready;
    const account = document.querySelector<HTMLButtonElement>(
      '.fashion-nav-actions button[aria-label="Account"]',
    )!;
    const label = account.querySelector<HTMLElement>(".fashion-action-label")!;
    const range = document.createRange();
    range.selectNodeContents(label);
    return {
      accountFamily: getComputedStyle(account).fontFamily,
      accountWhiteSpace: getComputedStyle(account).whiteSpace,
      fontsReady: document.fonts.status,
      labelLines: new Set([...range.getClientRects()].map(({ top }) => Math.round(top))).size,
      outfitLoaded: document.fonts.check("500 17px Outfit", "Account"),
    };
  });

  expect(typography).toEqual({
    accountFamily: "Outfit, sans-serif",
    accountWhiteSpace: "nowrap",
    fontsReady: "loaded",
    labelLines: 1,
    outfitLoaded: true,
  });
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
