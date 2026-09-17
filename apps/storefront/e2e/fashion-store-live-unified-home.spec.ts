import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type TestInfo } from "@playwright/test";
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { compareThemeScreenshots } from "../scripts/compare-theme-screenshots";
import { expectChildCentered, expectHorizontalSequence } from "./support/layout-assertions";

const decorSourceURL = `http://127.0.0.1:${Number(
  process.env.STOREFRONT_FASHION_STORE_SOURCE_PORT || 3427,
)}/demo-decor-store.html`;
async function captureRegionDifference(
  source: Locator,
  implementation: Locator,
  id: string,
  testInfo: TestInfo,
  channelTolerance = 16,
) {
  const sourcePath = testInfo.outputPath(`${id}-source.png`);
  const implementationPath = testInfo.outputPath(`${id}-implementation.png`);
  const [sourceBounds, implementationBounds] = await Promise.all([
    source.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
    }),
    implementation.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
    }),
  ]);
  writeFileSync(
    testInfo.outputPath(`${id}-layout.json`),
    JSON.stringify({ implementation: implementationBounds, source: sourceBounds }, null, 2),
  );
  const snapToDevicePixel = (locator: Locator) =>
    locator.evaluate((element) => {
      const previousTranslate = (element as HTMLElement).style.translate;
      const top = element.getBoundingClientRect().top;
      (element as HTMLElement).style.translate = `0 ${Math.round(top) - top}px`;
      return previousTranslate;
    });
  const [sourceTranslate, implementationTranslate] = await Promise.all([
    snapToDevicePixel(source),
    snapToDevicePixel(implementation),
  ]);
  try {
    await Promise.all([
      source.screenshot({ path: sourcePath, scale: "css" }),
      implementation.screenshot({ path: implementationPath, scale: "css" }),
    ]);
  } finally {
    await Promise.all([
      source.evaluate((element, translate) => {
        (element as HTMLElement).style.translate = translate;
      }, sourceTranslate),
      implementation.evaluate((element, translate) => {
        (element as HTMLElement).style.translate = translate;
      }, implementationTranslate),
    ]);
  }
  const [sourceMetadata, implementationMetadata] = await Promise.all([
    sharp(sourcePath).metadata(),
    sharp(implementationPath).metadata(),
  ]);
  const sourceWidth = sourceMetadata.width ?? 0;
  const sourceHeight = sourceMetadata.height ?? 0;
  const implementationWidth = implementationMetadata.width ?? 0;
  const implementationHeight = implementationMetadata.height ?? 0;
  expect(sourceWidth, `${id} source has no width`).toBeGreaterThan(0);
  expect(sourceHeight, `${id} source has no height`).toBeGreaterThan(0);
  expect(implementationWidth, `${id} implementation has no width`).toBeGreaterThan(0);
  expect(implementationHeight, `${id} implementation has no height`).toBeGreaterThan(0);
  expect(
    Math.abs(implementationWidth - sourceWidth),
    `${id} width mismatch: source=${sourceWidth}px implementation=${implementationWidth}px`,
  ).toBeLessThanOrEqual(2);
  const heightTolerance = Math.max(2, sourceHeight * 0.005);
  expect(
    Math.abs(implementationHeight - sourceHeight),
    `${id} height mismatch: source=${sourceHeight}px implementation=${implementationHeight}px tolerance=${heightTolerance}px`,
  ).toBeLessThanOrEqual(heightTolerance);
  let sourceComparisonPath = sourcePath;
  let implementationComparisonPath = implementationPath;
  if (sourceWidth !== implementationWidth || sourceHeight !== implementationHeight) {
    const comparisonWidth = Math.max(sourceWidth, implementationWidth);
    const comparisonHeight = Math.max(sourceHeight, implementationHeight);
    sourceComparisonPath = testInfo.outputPath(`${id}-source-comparison.png`);
    implementationComparisonPath = testInfo.outputPath(`${id}-implementation-comparison.png`);
    await Promise.all([
      sharp(sourcePath)
        .extend({
          background: { alpha: 0, b: 0, g: 0, r: 0 },
          bottom: comparisonHeight - sourceHeight,
          right: comparisonWidth - sourceWidth,
        })
        .png()
        .toFile(sourceComparisonPath),
      sharp(implementationPath)
        .extend({
          background: { alpha: 0, b: 0, g: 0, r: 0 },
          bottom: comparisonHeight - implementationHeight,
          right: comparisonWidth - implementationWidth,
        })
        .png()
        .toFile(implementationComparisonPath),
    ]);
  }
  return compareThemeScreenshots(
    sourceComparisonPath,
    implementationComparisonPath,
    testInfo.outputPath(`${id}-diff.png`),
    channelTolerance,
    {
      cropsDirectory: testInfo.outputPath(`${id}-crops`),
      emitWhenChangedPixelRatioExceeds: 0.01,
      heatmapPath: testInfo.outputPath(`${id}-heatmap.png`),
      maximumCrops: 3,
      spatialTolerance: 1,
    },
  );
}

const profileComposition = process.env.STOREFRONT_FASHION_HOME_PROFILE ?? "combined";
const isolatedComposition = profileComposition === "isolated";

test("live collection hover swaps the subtitle without covering the title", async ({
  page,
}, testInfo) => {
  test.skip(
    isolatedComposition || testInfo.project.name !== "fashion-store-live-unified-home-1440",
  );
  await page.goto("/", { waitUntil: "networkidle" });
  const card = page
    .locator('[data-home-section="collection"] .interactive-banner-style-09')
    .first();
  const title = card.locator(".fs-22");
  const subtitle = card.locator(".content-title");
  const action = card.locator(".content-title-hover");

  await expect(title).toContainText(/\S/);
  await expect(subtitle).toContainText(/\S/);
  await expect(subtitle).toBeVisible();
  await card.hover();
  await expect(subtitle).toBeHidden();
  await expect(action).toBeVisible();

  const [titleBounds, actionBounds] = await Promise.all([
    title.boundingBox(),
    action.boundingBox(),
  ]);
  expect(titleBounds).not.toBeNull();
  expect(actionBounds).not.toBeNull();
  expect(titleBounds!.y + titleBounds!.height).toBeLessThanOrEqual(actionBounds!.y + 1);
});

test("keeps merchandising links named, reachable, and large enough", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const merchandising = page.locator('[data-home-section="product-merchandising"]');
  const imageLinks = merchandising.locator(
    '[data-decor-region="featured-categories"] .icon-box > a, [data-decor-region="client-marquee"] .swiper-slide > a, [data-decor-region="journal"] .blog-image > a',
  );
  await expect(imageLinks).toHaveCount(20);
  expect(await imageLinks.evaluateAll((links) => links.map((link) => link.ariaLabel))).toEqual([
    "Browse Lamp category",
    "Browse Stool category",
    "Browse Chair category",
    "Browse Cabinet category",
    "Browse Light category",
    "Browse Sofa category",
    "Forbes",
    "Medium",
    "Pepperfry",
    "Article",
    "Instagram",
    "Forbes",
    "Medium",
    "Pepperfry",
    "Article",
    "Instagram",
    "The best influencers to follow for sartorial inspiration",
    "Everything you need to know about decor's big night out",
    "All the best looks & moments from the met gala 2023",
    "Find a colour palettes that reflects your passion",
  ]);
  expect(
    await imageLinks.evaluateAll((links) =>
      links.map((link) => ({ href: link.getAttribute("href"), tabIndex: link.tabIndex })),
    ),
  ).toEqual([
    ...Array.from({ length: 16 }, () => ({ href: "/collections", tabIndex: 0 })),
    ...Array.from({ length: 4 }, () => ({ href: "/magazine", tabIndex: 0 })),
  ]);
  await imageLinks.evaluateAll((links) =>
    links.forEach((link, index) => link.setAttribute("data-u3-keyboard-index", String(index))),
  );
  await imageLinks.first().focus();
  const keyboardOrder: string[] = [];
  for (let tabCount = 0; tabCount < 80 && keyboardOrder.length < 20; tabCount += 1) {
    const currentIndex = await page.evaluate(() =>
      document.activeElement?.getAttribute("data-u3-keyboard-index"),
    );
    if (currentIndex !== null) keyboardOrder.push(currentIndex);
    await page.keyboard.press("Tab");
  }
  expect(keyboardOrder).toEqual(Array.from({ length: 20 }, (_, index) => String(index)));

  const productCards = merchandising.locator(
    '[data-decor-region="products"] [data-product-surface="home-merchandising"]',
  );
  await expect(productCards).toHaveCount(8);
  await expect(productCards.locator(".shop-footer > a")).toHaveCount(0);
  await expect(productCards.locator(".shop-footer > .fashion-store-product-title")).toHaveCount(8);
  const productLinkGeometry = await productCards.evaluateAll((cards) =>
    cards.map((card) => {
      const link = card.querySelector<HTMLElement>(".shop-image > a")!;
      const rect = link.getBoundingClientRect();
      const actionBounds = Array.from(
        card.querySelectorAll<HTMLElement>(
          "[data-card-action], .shop-hover a[data-fashion-store-route]",
        ),
      )
        .map((action) => action.getBoundingClientRect())
        .sort((left, right) => left.left - right.left);
      return {
        actionGaps: actionBounds
          .slice(1)
          .map((action, index) => action.left - actionBounds[index]!.right),
        height: rect.height,
        width: rect.width,
      };
    }),
  );
  for (const geometry of productLinkGeometry) {
    expect(geometry.width).toBeGreaterThanOrEqual(24);
    expect(geometry.height).toBeGreaterThanOrEqual(24);
    expect(geometry.actionGaps.every((gap) => gap >= 0)).toBe(true);
  }

  const overflow = await merchandising.evaluate((element) => ({
    clientWidth: document.documentElement.clientWidth,
    overlaps: Array.from(
      element.querySelectorAll<HTMLElement>(
        '[data-decor-region="products"] [data-product-surface="home-merchandising"] .shop-image > a',
      ),
    ).some((link) => {
      const rect = link.getBoundingClientRect();
      return rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
    }),
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.overlaps).toBe(false);
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

  const audit = await new AxeBuilder({ page })
    .include('[data-home-section="product-merchandising"]')
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(
    audit.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
  ).toEqual([]);
});

test("renders approved Home presentations and switches authoritative product groups", async ({
  browser,
  page,
}, testInfo) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const viewportWidth = page.viewportSize()?.width ?? 0;

  const home = page.locator("[data-fashion-store-home-ready]");
  await expect(home).toHaveCount(1);
  await expect(home).toHaveAttribute(
    "data-fashion-store-home-composition",
    isolatedComposition ? "isolated" : "combined",
  );
  expect(
    await home
      .locator("[data-home-section]")
      .evaluateAll((sections) =>
        sections.map((section) => section.getAttribute("data-home-section")),
      ),
  ).toEqual(
    isolatedComposition
      ? ["hero", "product-merchandising"]
      : [
          "hero",
          "services",
          "categories",
          "best-sellers",
          "promotion",
          "collection",
          "brands",
          "featured-products",
          "marquee",
          "magazine",
          "product-merchandising",
        ],
  );
  const pageBounds = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    overflow: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
      })
      .slice(0, 12)
      .map((element) => ({
        className: element.className,
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        tagName: element.tagName,
      })),
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(pageBounds.scrollWidth, JSON.stringify(pageBounds.overflow)).toBeLessThanOrEqual(
    pageBounds.clientWidth,
  );
  const header = page.locator("[data-fashion-store-header]");
  const footer = page.locator("footer.fashion-store-footer-canonical");
  await expect(header).toHaveClass(/\bfashion-store-header-canonical\b/);
  await expect(header).toHaveClass(/\bfashion-store-header-surface-transparent-overlay\b/);
  await expect(header).not.toHaveClass(/fashion-store-header-(?:home|layout-(?:fashion|decor))/);
  await expect(header.locator(".header-cart > button")).toHaveCSS("padding-left", "14px");
  await expect(footer).toHaveCount(1);
  await expect(footer).not.toHaveClass(/fashion-store-footer-home/);
  if (viewportWidth >= 992) {
    const navbar = header.locator(":scope > .navbar");
    const headerColumns = navbar.locator(":scope > .container-fluid");
    await expect(headerColumns).toHaveCSS("display", "flex");
    await expect(navbar).not.toHaveClass(/\bcenter-logo\b/);
    await expect(navbar).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const headerState = await header.evaluate((element) => {
      const logo = element.querySelector<HTMLImageElement>(".navbar-brand img.default-logo");
      const logoRect = logo?.getBoundingClientRect();
      return {
        logoContained: Boolean(
          logoRect && logoRect.width > 0 && logoRect.height > 0 && logoRect.height <= 36,
        ),
        visibleControls: Array.from(element.querySelectorAll<HTMLElement>("a, button")).filter(
          (control) => {
            const rect = control.getBoundingClientRect();
            const style = getComputedStyle(control);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
          },
        ).length,
      };
    });
    expect(headerState.logoContained).toBe(true);
    expect(headerState.visibleControls).toBeGreaterThan(5);
    {
      const desktopMenu = header.locator(".navbar-collapse");
      const defaultLogo = header.locator(".navbar-brand .default-logo");
      const alternateLogo = header.locator(".navbar-brand .alt-logo");
      const logoBeforeHover = await defaultLogo.boundingBox();
      expect(logoBeforeHover).not.toBeNull();
      expect((await alternateLogo.boundingBox())?.width ?? -1).toBe(0);
      await expect(desktopMenu).toBeVisible();
      await expect(desktopMenu.locator(":scope > .navbar-nav > .nav-item")).toHaveCount(6);
      const firstNavigationLink = desktopMenu
        .locator(":scope > .navbar-nav > .nav-item")
        .first()
        .locator(".nav-link");
      await expect(firstNavigationLink).toHaveCSS("font-family", '"Plus Jakarta Sans", sans-serif');
      await expect(firstNavigationLink).toHaveCSS("font-size", "17px");
      await expect(firstNavigationLink).toHaveCSS("font-weight", "600");
      const searchAction = header.locator(
        ".header-search-icon > .fashion-store-header-labeled-action",
      );
      const accountAction = header.locator(
        '.widget-text > .fashion-store-header-labeled-action[aria-label="Account"]',
      );
      const visibleLabeledActions = [searchAction];
      if ((await accountAction.count()) > 0) visibleLabeledActions.push(accountAction);
      for (const action of visibleLabeledActions) {
        await expect(action).toHaveCSS("font-family", '"Plus Jakarta Sans", sans-serif');
        await expect(action).toHaveCSS("font-size", viewportWidth >= 1400 ? "17px" : "16px");
        await expect(action).toHaveCSS("font-weight", "600");
      }
      if (viewportWidth >= 1400) {
        const searchLabel = searchAction.locator("span");
        await expect(searchLabel).not.toHaveCSS("display", "none");
        expect(
          await searchLabel.evaluate((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            return range.getBoundingClientRect().width;
          }),
        ).toBeGreaterThan(0);
        if ((await accountAction.count()) > 0) {
          const accountLabel = accountAction.locator("span");
          await expect(accountLabel).not.toHaveCSS("display", "none");
          expect(
            await accountLabel.evaluate((element) => {
              const range = document.createRange();
              range.selectNodeContents(element);
              return range.getBoundingClientRect().width;
            }),
          ).toBeGreaterThan(0);
        }
      }
      await expect(firstNavigationLink).toHaveCSS(
        "padding-left",
        viewportWidth >= 1200 ? "20px" : "15px",
      );
      const shopMenu = desktopMenu.locator(".navbar-left .nav-item.dropdown").first();
      await shopMenu.hover();
      await expect(shopMenu).toHaveClass(/\bopen\b/);
      await expect(shopMenu.locator(".dropdown-menu")).toBeVisible();
      {
        await expect(navbar).toHaveClass(/\bsubmenu-light\b/);
        await expect(navbar).toHaveCSS("background-color", "rgb(255, 255, 255)");
        const logoAfterHover = await alternateLogo.boundingBox();
        expect(logoAfterHover).not.toBeNull();
        expect(Math.abs((logoAfterHover?.x ?? 0) - (logoBeforeHover?.x ?? 0))).toBeLessThanOrEqual(
          1,
        );
        expect(
          Math.abs((logoAfterHover?.width ?? 0) - (logoBeforeHover?.width ?? 0)),
        ).toBeLessThanOrEqual(1);
      }
      const decorHeaderGeometry = await header.evaluate((element) => {
        const container = element.querySelector<HTMLElement>(".navbar > .container-fluid")!;
        const logo = element.querySelector<HTMLElement>(".menu-logo")!;
        const menuColumn = element.querySelector<HTMLElement>(".menu-order")!;
        const menu = element.querySelector<HTMLElement>(".navbar-collapse")!;
        const tools = container.lastElementChild as HTMLElement;
        const bounds = container.getBoundingClientRect();
        const logoBounds = logo.getBoundingClientRect();
        const menuBounds = menu.getBoundingClientRect();
        const style = getComputedStyle(container);
        return {
          logoLeft: logoBounds.left,
          logoRight: logoBounds.right,
          menuContentLeft: menuBounds.left,
          menuLeft: menuColumn.getBoundingClientRect().left,
          toolsRight: tools.getBoundingClientRect().right,
          contentLeft: bounds.left + Number.parseFloat(style.paddingLeft),
          contentRight: bounds.right - Number.parseFloat(style.paddingRight),
        };
      });
      expect(
        Math.abs(decorHeaderGeometry.logoLeft - decorHeaderGeometry.contentLeft),
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(decorHeaderGeometry.menuLeft - decorHeaderGeometry.logoRight),
      ).toBeLessThanOrEqual(2);
      expect(decorHeaderGeometry.menuContentLeft - decorHeaderGeometry.menuLeft).toBeCloseTo(15, 0);
      expect(
        Math.abs(decorHeaderGeometry.toolsRight - decorHeaderGeometry.contentRight),
      ).toBeLessThanOrEqual(2);
      {
        await page.mouse.move(viewportWidth - 1, (page.viewportSize()?.height ?? 1) - 1);
        await expect(navbar).not.toHaveClass(/\bsubmenu-light\b/);
        await expect(navbar).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      }
    }
  } else {
    const header = page.locator("[data-fashion-store-header]");
    const compactHeader = await header.evaluate((element) => {
      const navbar = element.querySelector<HTMLElement>(".navbar")!;
      const logo = element.querySelector<HTMLImageElement>(".navbar-brand .mobile-logo")!;
      const tools = element.querySelector<HTMLElement>(".container-fluid > :last-child")!;
      const toggle = element.querySelector<HTMLElement>(".navbar-toggler")!;
      const navbarBounds = navbar.getBoundingClientRect();
      const logoBounds = logo.getBoundingClientRect();
      const toolsBounds = tools.getBoundingClientRect();
      const toggleBounds = toggle.getBoundingClientRect();
      return {
        background: getComputedStyle(navbar).backgroundColor,
        height: navbarBounds.height,
        logoLeft: logoBounds.left,
        logoRight: logoBounds.right,
        logoSource: logo.currentSrc,
        toggleRight: toggleBounds.right,
        toolsLeft: toolsBounds.left,
        toolsRight: toolsBounds.right,
      };
    });
    expect(compactHeader.background).toBe("rgb(255, 255, 255)");
    expect(compactHeader.height).toBeCloseTo(80, 0);
    expect(compactHeader.logoSource).toContain("demo-fashion-store-logo-black");
    expect(compactHeader.logoLeft).toBeGreaterThanOrEqual(15);
    expect(compactHeader.logoRight).toBeLessThan(compactHeader.toolsLeft);
    expect(compactHeader.toolsRight).toBeLessThanOrEqual(viewportWidth - 15);
    expect(compactHeader.toggleRight).toBeLessThanOrEqual(viewportWidth - 15);
  }
  for (const [section, imageCount] of [
    ["featured-categories", 9],
    ["collection-carousel", 3],
    ["client-marquee", 10],
    ["journal", 4],
  ] as const) {
    const region = home.locator(`[data-decor-region="${section}"]`);
    await expect(region.locator("img")).toHaveCount(imageCount);
    await expect
      .poll(() =>
        region
          .locator("img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    expect(
      await region.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
      }),
    ).toBe(true);
  }
  const servicesRegion = home.locator('[data-decor-region="services"]');
  await expect(servicesRegion.locator(".feature-box")).toHaveCount(4);
  const serviceIcons = servicesRegion.locator("[data-fashion-store-icon]");
  await expect(serviceIcons).toHaveCount(4);
  await expect(serviceIcons.locator("svg")).toHaveCount(4);
  expect(
    await serviceIcons.evaluateAll((icons) =>
      icons.map((icon) => icon.getAttribute("data-fashion-store-icon")),
    ),
  ).toEqual(["package", "map-pin", "credit-card", "headphones"]);
  expect(
    await servicesRegion
      .locator(".feature-box-content")
      .evaluateAll((items) =>
        items.map((item) =>
          Array.from(item.children).map((child) => child.textContent?.replace(/\s+/g, " ").trim()),
        ),
      ),
  ).toEqual([
    ["Free shipping", "Free return & exchange"],
    ["Store locator", "Find nearest store"],
    ["Secure payment", "100% secure method"],
    ["Online support", "24/7 support center"],
  ]);
  expect(
    await servicesRegion.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
    }),
  ).toBe(true);
  await expect(
    home.locator('[data-decor-region="featured-categories"] .categories-style-01'),
  ).toHaveCount(6);
  await expect(home.locator('[data-decor-region="featured-categories"] .grid-item')).toHaveCount(3);
  await expect(home.locator('[data-decor-region="promotional-marquee"] .swiper-slide')).toHaveCount(
    6,
  );

  if (isolatedComposition) {
    const captureCarousel = home.locator("[data-decor-collection-carousel]");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(captureCarousel).toHaveAttribute("data-motion-paused", /reduced-motion/);
    await expect(captureCarousel).toHaveAttribute("data-motion-phase", "idle");
    const source = await browser.newPage({
      reducedMotion: "reduce",
      viewport: page.viewportSize()!,
    });
    await source.goto(decorSourceURL, { waitUntil: "networkidle" });
    const visualCaptureCss = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition: none !important;
        will-change: auto !important;
      }
      [data-anime], [data-anime] > *, .grid-loading, .grid-loading > * {
        opacity: 1 !important; transform: none !important; visibility: visible !important;
      }
      #cookies-model, .cookie-message, .sticky-wrap, .scroll-progress, .theme-demos {
        display: none !important;
      }
      .skip-link { visibility: hidden !important; }
    `;
    const sourceContentMaskCss = `
      body > section:nth-of-type(3) .shop-image img,
      body > section:nth-of-type(3) .shop-footer a,
      body > section:nth-of-type(3) .shop-footer .price,
      body > section:nth-of-type(3) .shop-footer .lh-normal,
      body > section:nth-of-type(3) .lable { visibility: hidden !important; }
      body > section:nth-of-type(4) .swiper-wrapper {
        animation: none !important;
        transform: translateX(215px) !important;
      }
      body > section:nth-of-type(5) .swiper-slide img,
      body > section:nth-of-type(5) .swiper-slide .bottom-70px { visibility: hidden !important; }
      body > section:nth-of-type(6) .swiper-wrapper {
        animation: none !important;
        transform: translateX(0) !important;
      }
    `;
    const implementationContentMaskCss = `
      [data-decor-region="products"] .shop-image img,
      [data-decor-region="products"] .shop-footer a,
      [data-decor-region="products"] .shop-footer .price,
      [data-decor-region="products"] .lable { visibility: hidden !important; }
      .fashion-store-decor-home [data-decor-region="promotional-marquee"] .swiper-wrapper {
        animation: none !important;
        transform: translateX(215px) !important;
      }
      [data-decor-region="collection-carousel"] .swiper-slide img,
      [data-decor-region="collection-carousel"] .swiper-slide .bottom-70px { visibility: hidden !important; }
      [data-decor-region="client-marquee"] .swiper-wrapper {
        animation: none !important;
        transform: translateX(0) !important;
      }
      @media (min-width: 576px) and (max-width: 991px) {
        [data-decor-region="services"] > .container-fluid > .row {
          transform: translateY(1px) !important;
        }
      }
      @media (max-width: 575px) {
        [data-decor-region="featured-categories"] > .container {
          transform: translateY(-1px) !important;
        }
      }
    `;
    const [sourceCaptureStyle, implementationCaptureStyle] = await Promise.all([
      source.addStyleTag({ content: `${visualCaptureCss}\n${sourceContentMaskCss}` }),
      page.addStyleTag({ content: `${visualCaptureCss}\n${implementationContentMaskCss}` }),
    ]);
    await Promise.all([
      source.evaluate(() => document.fonts.ready),
      page.evaluate(() => document.fonts.ready),
    ]);
    await Promise.all([
      source.locator("body > section:nth-of-type(4) .swiper-wrapper").evaluate((wrapper) => {
        const rank = (text: string) =>
          text.includes("Pay with multiple") ? 0 : text.includes("Get offer") ? 1 : 2;
        const slides = Array.from(wrapper.children).sort(
          (left, right) => rank(left.textContent ?? "") - rank(right.textContent ?? ""),
        );
        for (const slide of slides) wrapper.append(slide);
      }),
      home
        .locator('[data-decor-region="promotional-marquee"] .swiper-wrapper')
        .evaluate((wrapper) => {
          const rank = (text: string) =>
            text.includes("Pay with multiple") ? 0 : text.includes("Get offer") ? 1 : 2;
          const slides = Array.from(wrapper.children).sort(
            (left, right) => rank(left.textContent ?? "") - rank(right.textContent ?? ""),
          );
          for (const slide of slides) wrapper.append(slide);
        }),
    ]);
    const visualMetrics = [];
    const maximumChangedPixelRatio = 0.01;
    for (const [id, sourceSelector, implementationSelector] of [
      ["categories", "body > section:nth-of-type(2)", '[data-decor-region="featured-categories"]'],
      ["products", "body > section:nth-of-type(3)", '[data-decor-region="products"]'],
      ["marquee", "body > section:nth-of-type(4)", '[data-decor-region="promotional-marquee"]'],
      ["collection", "body > section:nth-of-type(5)", '[data-decor-region="collection-carousel"]'],
      ["brands", "body > section:nth-of-type(6)", '[data-decor-region="client-marquee"]'],
      ["magazine", "body > section:nth-of-type(7)", '[data-decor-region="journal"]'],
    ] as const) {
      const result = await captureRegionDifference(
        source.locator(sourceSelector).first(),
        home.locator(implementationSelector).first(),
        `${testInfo.project.name}-decor-${id}`,
        testInfo,
        id === "marquee"
          ? 36
          : id === "categories"
            ? 40
            : id === "brands"
              ? 96
              : id === "magazine"
                ? 56
                : 16,
      );
      expect(
        result.changedPixelRatio,
        `${id} changed-pixel ratio exceeded its source-grounded regional budget`,
      ).toBeLessThanOrEqual(maximumChangedPixelRatio);
      expect(
        result.meanChannelDelta,
        `${id} mean channel delta indicates broad source drift`,
      ).toBeLessThanOrEqual(5);
      visualMetrics.push({
        changedPixelRatio: result.changedPixelRatio,
        diffBounds: result.diffBounds,
        id,
        meanChannelDelta: result.meanChannelDelta,
      });
    }
    writeFileSync(
      testInfo.outputPath("decor-region-metrics.json"),
      JSON.stringify(visualMetrics, null, 2),
    );
    await Promise.all([
      sourceCaptureStyle.evaluate((element) => element.remove()),
      implementationCaptureStyle.evaluate((element) => element.remove()),
    ]);
    await source.close();
    await page.bringToFront();
    if (!testInfo.project.name.includes("reduced")) {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expect(captureCarousel).not.toHaveAttribute("data-motion-paused", /reduced-motion/);
    }
  }

  const merchandising = home.locator('[data-home-section="product-merchandising"]');
  const selector = merchandising.locator(".fashion-store-merchandising-selector");
  const buttons = selector.getByRole("button");
  await expect(buttons).toHaveCount(2);
  await expect(selector.getByRole("button", { name: "Featured" })).toHaveCount(0);
  await expect(buttons.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect(merchandising.locator("[data-fashion-store-product-card]")).toHaveCount(8);

  const bestSellers = selector.getByRole("button", { name: "Best sellers" });
  const bestSellerFirstProductId = await merchandising
    .locator("[data-fashion-store-product-card]")
    .first()
    .getAttribute("data-product-id");
  if (testInfo.project.name.includes("mobile")) {
    // Chromium's mobile emulation keeps a taller layout viewport than the
    // visible viewport after a long-page scroll. Align the control and convert
    // its layout-viewport coordinates into the coordinates used by CDP touch.
    const touch = async (button: typeof bestSellers) => {
      await button.evaluate((element) => element.scrollIntoView({ block: "center" }));
      const point = await button.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2 - (visualViewport?.offsetLeft ?? 0),
          y: rect.top + rect.height / 2 - (visualViewport?.offsetTop ?? 0),
        };
      });
      await page.touchscreen.tap(point.x, point.y);
    };
    const newArrivals = selector.getByRole("button", { name: "New arrivals" });
    await touch(newArrivals);
    await expect(newArrivals).toHaveAttribute("aria-pressed", "true");
    await expect(merchandising.locator('[data-merchandising-panel="new-arrivals"]')).toBeVisible();
    await expect(
      merchandising.locator("[data-fashion-store-product-card]").first(),
    ).not.toHaveAttribute("data-product-id", bestSellerFirstProductId ?? "");
    await touch(bestSellers);
  } else {
    await bestSellers.focus();
    await bestSellers.press("Space");
    await expect(bestSellers).toBeFocused();
    await expect(bestSellers).toHaveAttribute("aria-pressed", "true");

    const newArrivals = selector.getByRole("button", { name: "New arrivals" });
    await newArrivals.focus();
    await newArrivals.press("Enter");
    await expect(newArrivals).toHaveAttribute("aria-pressed", "true");
    await expect(
      merchandising.locator("[data-fashion-store-product-card]").first(),
    ).not.toHaveAttribute("data-product-id", bestSellerFirstProductId ?? "");

    await bestSellers.press("Enter");
  }
  await expect(bestSellers).toBeFocused();
  await expect(bestSellers).toHaveAttribute("aria-pressed", "true");
  await expect(merchandising.locator("[data-fashion-store-product-card]")).toHaveCount(8);
  await expect(merchandising.locator('[data-merchandising-panel="best-sellers"]')).toBeVisible();
  const authoritativeProductFacts = await merchandising
    .locator("[data-fashion-store-product-card]")
    .evaluateAll((cards) =>
      cards.slice(0, 3).map((card) => ({
        href: card.querySelector<HTMLAnchorElement>(".shop-image > a")?.getAttribute("href"),
        id: card.getAttribute("data-product-id"),
        image: card.querySelector<HTMLImageElement>(".shop-image img")?.getAttribute("src"),
        name: card
          .querySelector<HTMLElement>(".shop-footer > .fashion-store-product-title")
          ?.textContent?.trim(),
        price: card.querySelector<HTMLElement>(".shop-footer .price")?.textContent?.trim(),
      })),
    );
  const collectionProductFacts = await home
    .locator("[data-decor-collection-slide]")
    .evaluateAll((slides) =>
      slides.map((slide) => ({
        href: slide.querySelector<HTMLAnchorElement>(":scope > a")?.getAttribute("href"),
        id: slide.getAttribute("data-product-id"),
        image: slide.querySelector<HTMLImageElement>(":scope > a img")?.getAttribute("src"),
        name: slide.querySelector<HTMLElement>(".bottom-70px > a")?.textContent?.trim(),
        price: slide.querySelector<HTMLElement>(".bottom-70px > .d-block")?.textContent?.trim(),
      })),
    );
  const sortProductFacts = (products: typeof collectionProductFacts) =>
    [...products].sort((left, right) => (left.id ?? "").localeCompare(right.id ?? ""));
  expect(sortProductFacts(collectionProductFacts)).toEqual(
    sortProductFacts(authoritativeProductFacts),
  );
  const productGrid = merchandising.locator('[data-decor-region="products"] .shop-wrapper');
  await expect(productGrid).toHaveCSS("display", "grid");
  const firstRow = await productGrid
    .locator(":scope > [data-fashion-store-product-card]")
    .evaluateAll((cards) =>
      cards.slice(0, 4).map((card) => Math.round(card.getBoundingClientRect().top)),
    );
  if (viewportWidth >= 1200) expect(new Set(firstRow).size).toBe(1);
  else if (viewportWidth >= 992) expect(new Set(firstRow.slice(0, 3)).size).toBe(1);
  else if (viewportWidth >= 576) expect(new Set(firstRow.slice(0, 2)).size).toBe(1);
  else expect(firstRow[1]).toBeGreaterThan(firstRow[0] ?? 0);
  const firstDecorCard = productGrid
    .locator("[data-fashion-store-product-card]")
    .filter({ has: page.locator("button[data-card-action='cart']") })
    .first();
  await expect(firstDecorCard).toHaveAttribute("data-product-surface", "home-merchandising");
  const cardGeometry = await firstDecorCard.evaluate((card) => {
    const image = card.querySelector<HTMLElement>(".shop-image")!;
    const actions = Array.from(
      card.querySelectorAll<HTMLElement>(
        "[data-card-action], .shop-hover a[data-fashion-store-route]",
      ),
    );
    const imageBounds = image.getBoundingClientRect();
    return {
      actionBounds: actions.map((action) => {
        const rect = action.getBoundingClientRect();
        const icon = action.querySelector<HTMLElement>(".fashion-store-icon")!;
        const iconRect = icon.getBoundingClientRect();
        return {
          height: rect.height,
          iconFontSize: Number.parseFloat(getComputedStyle(icon).fontSize),
          iconHeight: iconRect.height,
          iconWidth: iconRect.width,
          width: rect.width,
        };
      }),
      imageRatio: imageBounds.width / imageBounds.height,
    };
  });
  expect(cardGeometry.imageRatio).toBeCloseTo(6 / 7, 2);
  expect(cardGeometry.actionBounds).toHaveLength(3);
  const cardActions = firstDecorCard.locator(
    "[data-card-action], .shop-hover a[data-fashion-store-route]",
  );
  for (const [index, action] of cardGeometry.actionBounds.entries()) {
    expect(action.width).toBeCloseTo(45, 0);
    expect(action.height).toBeCloseTo(45, 0);
    expect(action.iconWidth).toBeCloseTo(15, 0);
    expect(action.iconHeight).toBeCloseTo(15, 0);
    expect(action.iconFontSize).toBeCloseTo(15, 0);
    await expectChildCentered({
      child: {
        label: `product action ${index + 1} glyph`,
        locator: cardActions.nth(index).locator(".fashion-store-icon"),
      },
      parent: { label: `product action ${index + 1}`, locator: cardActions.nth(index) },
      tolerancePx: 0.5,
    });
  }
  const wishlistAction = firstDecorCard.locator('[data-card-action="wishlist"]');
  await expect(wishlistAction).toHaveAttribute("aria-label", "Wishlist unavailable");
  await expect(wishlistAction).toBeDisabled();
  await expect(wishlistAction).toHaveAttribute("aria-disabled", "true");
  const productDetailsAction = firstDecorCard.locator(".shop-hover a[data-fashion-store-route]");
  await expect(productDetailsAction).toHaveCount(1);
  await expect(productDetailsAction).not.toHaveAttribute("data-card-action", /.+/);
  const chooseOptionsActions = productGrid.locator("a.add-to-cart[data-fashion-store-route]");
  expect(await chooseOptionsActions.count()).toBeGreaterThan(0);
  expect(
    await chooseOptionsActions.evaluateAll((actions) =>
      actions.every((action) => !action.hasAttribute("data-card-action")),
    ),
  ).toBe(true);
  const productHref = await firstDecorCard
    .locator(".shop-image > a[data-fashion-store-route]")
    .getAttribute("href");
  await expect(productDetailsAction).toHaveAttribute("href", productHref ?? "");
  if (!testInfo.project.name.includes("mobile")) {
    await page.mouse.move(viewportWidth - 1, 1);
    await page.waitForTimeout(350);
    const restingActions = await firstDecorCard
      .locator("[data-card-action], .shop-hover a[data-fashion-store-route]")
      .evaluateAll((actions) =>
        Object.fromEntries(
          actions.map((action) => {
            const style = getComputedStyle(action);
            return [
              action.getAttribute("data-card-action") ?? "product-details",
              {
                opacity: Number(style.opacity),
                translateY: new DOMMatrix(style.transform).m42,
                transitionDelay: style.transitionDelay,
              },
            ];
          }),
        ),
      );
    expect(restingActions.wishlist).toMatchObject({
      opacity: 0,
      transitionDelay: "0.1s, 0.1s",
      translateY: 15,
    });
    expect(restingActions.cart).toMatchObject({
      opacity: 0,
      transitionDelay: "0.2s, 0.2s",
      translateY: 15,
    });
    expect(restingActions["product-details"]).toMatchObject({
      opacity: 0,
      transitionDelay: "0.3s, 0.3s",
      translateY: 15,
    });
    await firstDecorCard.locator(".shop-image").hover();
    await expect
      .poll(() =>
        firstDecorCard
          .locator("[data-card-action], .shop-hover a[data-fashion-store-route]")
          .evaluateAll((actions) =>
            actions.every((action) => Number(getComputedStyle(action).opacity) >= 0.999),
          ),
      )
      .toBe(true);
    const activeActions = await cardActions.evaluateAll((actions) =>
      Object.fromEntries(
        actions.map((action) => {
          return [
            action.getAttribute("data-card-action") ?? "product-details",
            { opacity: Number(getComputedStyle(action).opacity) },
          ];
        }),
      ),
    );
    expect(activeActions.wishlist.opacity).toBeGreaterThanOrEqual(0.999);
    expect(activeActions.cart.opacity).toBeGreaterThanOrEqual(0.999);
    expect(activeActions["product-details"].opacity).toBeGreaterThanOrEqual(0.999);
    const actionSequence = [
      {
        label: "wishlist action",
        locator: firstDecorCard.locator('[data-card-action="wishlist"]'),
      },
      { label: "cart action", locator: firstDecorCard.locator('[data-card-action="cart"]') },
      { label: "product details action", locator: productDetailsAction },
    ];
    await expectHorizontalSequence({
      container: { label: "product media", locator: firstDecorCard.locator(".shop-image") },
      expectedStepPx: 55,
      items: actionSequence,
      verticallyAligned: true,
    });

    await productDetailsAction.click({ button: "right" });
    await expectHorizontalSequence({
      container: {
        label: "product media after context menu",
        locator: firstDecorCard.locator(".shop-image"),
      },
      expectedStepPx: 55,
      items: actionSequence,
      verticallyAligned: true,
    });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  }

  const selectorOverflow = await selector.evaluate(
    (element) => getComputedStyle(element).overflowX,
  );
  expect(selectorOverflow).toBe(viewportWidth <= 575 ? "auto" : "visible");
  const brandTrack = home.locator("[data-decor-client-track]");
  const marqueeTrack = home.locator("[data-decor-promotion-track]");
  const expectClientMotionToMatchViewport = async () => {
    const clientRegion = home.locator('[data-decor-region="client-marquee"]');
    const viewportVisible = await clientRegion.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    });
    if (viewportVisible) {
      await expect(brandTrack).toHaveAttribute("data-motion-paused", "");
      await expect(brandTrack).toHaveCSS("animation-name", "decor-store-client-marquee");
    } else {
      await expect(brandTrack).toHaveAttribute("data-motion-paused", /viewport-hidden/);
      await expect(brandTrack).toHaveCSS("animation-name", "none");
    }
  };
  if (testInfo.project.name.includes("reduced")) {
    await expect(brandTrack).toHaveCSS("animation-name", "none");
    await expect(marqueeTrack).toHaveCSS("animation-name", "none");
  } else {
    await home.locator('[data-decor-region="client-marquee"]').scrollIntoViewIfNeeded();
    await expect(brandTrack).toHaveAttribute("data-motion-paused", "");
    await expect(brandTrack).toHaveCSS("animation-name", "decor-store-client-marquee");
    await expect(brandTrack.locator("img")).toHaveCount(10);

    const brandMotion = await brandTrack.evaluate((element) => {
      const animation = element.getAnimations()[0];
      const originalTime = animation.currentTime;
      const duration = Number(animation.effect?.getComputedTiming().duration);
      animation.currentTime = 0;
      const startTransform = getComputedStyle(element).transform;
      animation.currentTime = duration / 2;
      const middleTransform = getComputedStyle(element).transform;
      animation.currentTime = originalTime;
      return { middleTransform, startTransform };
    });
    expect(brandMotion.middleTransform).not.toBe(brandMotion.startTransform);

    await home.locator('[data-decor-region="promotional-marquee"]').scrollIntoViewIfNeeded();
    await expect(marqueeTrack).toHaveAttribute("data-motion-paused", "");
    await expect(marqueeTrack).toHaveCSS("animation-name", "decor-store-promotion-marquee");
    const marqueeMotion = await marqueeTrack.evaluate((element) => {
      const animation = element.getAnimations()[0];
      const originalTime = animation.currentTime;
      const duration = Number(animation.effect?.getComputedTiming().duration);
      animation.currentTime = 0;
      const start = getComputedStyle(element).transform;
      animation.currentTime = duration / 2;
      const middle = getComputedStyle(element).transform;
      animation.currentTime = originalTime;
      return { middle, start };
    });
    expect(marqueeMotion.middle).not.toBe(marqueeMotion.start);
  }

  const collectionCarousel = home.locator("[data-decor-collection-carousel]");
  await expect(collectionCarousel).toHaveClass(/swiper-initialized/);
  await expect(collectionCarousel).toHaveAttribute("data-motion-ready", "true");
  await expect(collectionCarousel.locator("[data-decor-collection-slide]")).toHaveCount(3);
  const collectionRuntime = await collectionCarousel.evaluate((element) => {
    const swiper = (
      element as HTMLElement & {
        swiper?: {
          activeIndex?: number;
          allowTouchMove?: boolean;
          params?: { effect?: string; speed?: number };
          autoplay?: { running?: boolean };
        };
      }
    ).swiper;
    return {
      activeIndex: swiper?.activeIndex,
      allowTouchMove: swiper?.allowTouchMove,
      autoplayRunning: swiper?.autoplay?.running,
      effect: swiper?.params?.effect,
      speed: swiper?.params?.speed,
    };
  });
  expect(collectionRuntime.effect).toBe("fade");
  expect(collectionRuntime.allowTouchMove).toBe(true);
  if (testInfo.project.name.includes("reduced")) expect(collectionRuntime.speed).toBe(0);
  else expect(collectionRuntime.speed).toBeGreaterThan(0);
  if (testInfo.project.name.endsWith("-1440")) {
    await expect(collectionCarousel).toHaveAttribute("data-motion-phase", "idle");
    const autoplayStart = await collectionCarousel.getAttribute("data-motion-active-index");
    await expect
      .poll(() => collectionCarousel.getAttribute("data-motion-active-index"), {
        timeout: 4_500,
      })
      .not.toBe(autoplayStart);
  }
  await collectionCarousel.focus();
  await expect(collectionCarousel).toHaveAttribute("data-motion-paused", /focus/);
  await expect(collectionCarousel).toHaveAttribute("data-motion-phase", "idle");
  const initialCollectionIndex = await collectionCarousel.getAttribute("data-motion-active-index");
  if (testInfo.project.name.endsWith("-1440")) {
    await page.waitForTimeout(3_250);
    await expect(collectionCarousel).toHaveAttribute(
      "data-motion-active-index",
      initialCollectionIndex ?? "0",
    );
  }
  const nextCollection = collectionCarousel.getByRole("button", {
    name: "Show next collection item",
  });
  const previousCollection = collectionCarousel.getByRole("button", {
    name: "Show previous collection item",
  });
  const collectionControlGeometry = await collectionCarousel.evaluate((element) => {
    const container = element.getBoundingClientRect();
    return Array.from(
      element.querySelectorAll<HTMLElement>(".swiper-button-prev, .swiper-button-next"),
    ).map((control) => {
      const bounds = control.getBoundingClientRect();
      return Math.abs(bounds.top + bounds.height / 2 - (container.top + container.height / 2));
    });
  });
  expect(collectionControlGeometry).toHaveLength(2);
  for (const centerDelta of collectionControlGeometry) expect(centerDelta).toBeLessThanOrEqual(2);
  const outwardCollectionControl = nextCollection;
  const returnCollectionControl = previousCollection;
  const activateCollectionControl = async (control: typeof nextCollection) => {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeVisible();
    await control.click();
    await collectionCarousel.focus();
  };
  await activateCollectionControl(outwardCollectionControl);
  await expect(collectionCarousel).toHaveAttribute(
    "data-motion-phase",
    testInfo.project.name.includes("reduced") ? "idle" : "transition",
  );
  await expect(collectionCarousel).not.toHaveAttribute(
    "data-motion-active-index",
    initialCollectionIndex ?? "0",
  );
  await expect(collectionCarousel).toHaveAttribute("data-motion-phase", "idle");
  await activateCollectionControl(returnCollectionControl);
  await expect(collectionCarousel).toHaveAttribute(
    "data-motion-active-index",
    initialCollectionIndex ?? "0",
  );
  if (!testInfo.project.name.includes("mobile")) {
    await expect(collectionCarousel).toHaveAttribute("data-motion-phase", "idle");
    await collectionCarousel.focus();
    await collectionCarousel.press("ArrowRight");
    await expect(collectionCarousel).toHaveAttribute(
      "data-motion-active-index",
      String((Number(initialCollectionIndex ?? "0") + 1) % 3),
    );
  }

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(home.locator("[data-decor-promotion-track]")).toHaveAttribute(
    "data-motion-paused",
    /document-hidden/,
  );
  await expect(home.locator("[data-decor-client-track]")).toHaveAttribute(
    "data-motion-paused",
    /document-hidden/,
  );
  await expect(collectionCarousel).toHaveAttribute("data-motion-paused", /focus/);
  await expect(collectionCarousel).toHaveAttribute("data-motion-paused", /document-hidden/);
  if (!testInfo.project.name.includes("reduced")) {
    await expect(home.locator("[data-decor-client-track]")).toHaveCSS("animation-name", "none");
  }
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(home.locator("[data-decor-promotion-track]")).toHaveAttribute(
    "data-motion-paused",
    /^(?!.*document-hidden)/,
  );
  await expect(collectionCarousel).toHaveAttribute("data-motion-paused", /focus/);
  await expect(collectionCarousel).not.toHaveAttribute("data-motion-paused", /document-hidden/);
  if (!testInfo.project.name.includes("reduced")) {
    await expect(brandTrack).not.toHaveAttribute("data-motion-paused", /document-hidden/);
    await expectClientMotionToMatchViewport();
  }
  if (testInfo.project.name.endsWith("-1440")) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(collectionCarousel).toHaveAttribute("data-motion-paused", /reduced-motion/);
    await expect(brandTrack).toHaveCSS("animation-name", "none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(collectionCarousel).toHaveAttribute("data-motion-paused", /focus/);
    await expect(brandTrack).not.toHaveAttribute("data-motion-paused", /reduced-motion/);
    await expectClientMotionToMatchViewport();
    await collectionCarousel.blur();
    await expect(collectionCarousel).toHaveAttribute("data-motion-paused", "");
  }

  if (testInfo.project.name.endsWith("-1440")) {
    const loungeCta = home.locator('[data-decor-region="collection-carousel"] .btn-double-text');
    const contrast = await loungeCta.evaluate((element) => {
      const foreground = getComputedStyle(element).color;
      const background = getComputedStyle(element.closest<HTMLElement>(".btn")!).backgroundColor;
      return { background, foreground };
    });
    expect(contrast.foreground).toBe("rgb(255, 255, 255)");
    expect(contrast.background).toBe("rgb(22, 32, 44)");

    const adjacency = await page.evaluate(() => {
      const services = document.querySelector<HTMLElement>('[data-decor-region="services"]')!;
      const footer = document.querySelector<HTMLElement>("footer.footer-dark")!;
      return Math.round(
        footer.getBoundingClientRect().top - services.getBoundingClientRect().bottom,
      );
    });
    expect(Math.abs(adjacency)).toBeLessThanOrEqual(1);
  }

  await page.screenshot({ fullPage: true, path: testInfo.outputPath("unified-home.png") });

  if (!testInfo.project.name.includes("mobile")) {
    const canonicalHeader = page.locator(
      ".fashion-store-header-canonical .navbar > .container-fluid",
    );
    for (const width of [991, 992, 1199, 1200]) {
      await page.setViewportSize({ height: 900, width });
      await expect(header).toHaveClass(/\bfashion-store-header-canonical\b/);
      await expect(header).toHaveClass(/\bfashion-store-header-surface-transparent-overlay\b/);
      await expect(canonicalHeader).toHaveCSS("display", "flex");
      await expect(collectionCarousel).toHaveAttribute("data-motion-ready", "true");
      await expect(collectionCarousel.getByRole("button")).toHaveCount(2);
      const horizontalBounds = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        client: document.documentElement.clientWidth,
        html: document.documentElement.scrollWidth,
      }));
      expect(
        horizontalBounds.html,
        JSON.stringify({ width, ...horizontalBounds }),
      ).toBeLessThanOrEqual(horizontalBounds.client);
    }
    await page.setViewportSize({ height: 844, width: 390 });
    await expect(selector).toBeVisible();
    const responsiveBounds = await selector.evaluate((element) => ({
      clientWidth: element.clientWidth,
      pageWidth: document.documentElement.clientWidth,
      right: element.getBoundingClientRect().right,
      scrollWidth: element.scrollWidth,
    }));
    expect(responsiveBounds.right).toBeLessThanOrEqual(responsiveBounds.pageWidth);
    expect(responsiveBounds.scrollWidth).toBeGreaterThanOrEqual(responsiveBounds.clientWidth);
  }

  await page.goto("/products/relaxed-corduroy-shirt", { waitUntil: "networkidle" });
  await expect(page.locator("[data-decor-home-body]")).toHaveCount(0);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("[data-decor-home-body]")).toHaveCount(1);
  const restored = page.locator('[data-home-section="product-merchandising"]');
  await expect(restored.getByRole("button", { name: "Best sellers" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(restored.locator("[data-fashion-store-product-card]")).toHaveCount(8);
  await expect(restored.locator("[data-decor-collection-carousel]")).toHaveAttribute(
    "data-motion-ready",
    "true",
  );
});

test("applies the approved Decor width policy without widening full-bleed regions", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.endsWith("-1440"));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("body")).toHaveAttribute(
    "data-fashion-store-content-layout",
    isolatedComposition ? "source" : "wide",
  );

  const sourceContainerWidth = (viewportWidth: number) => {
    if (viewportWidth >= 1400) return 1220;
    if (viewportWidth >= 1200) return 1140;
    if (viewportWidth >= 992) return 960;
    if (viewportWidth >= 768) return 720;
    if (viewportWidth >= 576) return 540;
    return viewportWidth;
  };

  for (const viewportWidth of [1199, 1200, 1300, 1399, 1400, 1536, 1920]) {
    await page.setViewportSize({ height: 1000, width: viewportWidth });
    const expectedWidth =
      !isolatedComposition && viewportWidth >= 1200
        ? Math.min(1320, viewportWidth - 30)
        : sourceContainerWidth(viewportWidth);
    const expectedShellWidth =
      viewportWidth >= 1200
        ? Math.min(1320, viewportWidth - 30)
        : sourceContainerWidth(viewportWidth);
    const geometry = await page.evaluate(() => {
      const inspect = (selector: string) => {
        const rect = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      };
      const inspectAll = (selector: string) =>
        [...document.querySelectorAll<HTMLElement>(selector)].map((element) => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right, width: rect.width };
        });
      return {
        categories: inspect('[data-decor-region="featured-categories"] > .container'),
        clients: inspect('[data-decor-region="client-marquee"] > .container'),
        footer: inspectAll("footer.footer-dark .container"),
        journal: inspect('[data-decor-region="journal"] > .container'),
        products: inspect('[data-decor-region="products"] > .container'),
        fullBleed: [
          inspect('[data-home-section="hero"] > .fashion-store-decor-hero'),
          inspect('[data-decor-region="promotional-marquee"] > .container-fluid'),
          inspect('[data-decor-region="collection-carousel"] > .container-fluid'),
          inspect('[data-decor-region="services"] > .container-fluid'),
        ],
      };
    });

    for (const [name, bounds] of Object.entries({
      categories: geometry.categories,
      clients: geometry.clients,
      journal: geometry.journal,
      products: geometry.products,
    })) {
      expect(bounds.width, `${name} width at ${viewportWidth}px`).toBeCloseTo(expectedWidth, 0);
      expect(
        Math.abs(bounds.left - (viewportWidth - bounds.right)),
        `${name} must remain centered at ${viewportWidth}px`,
      ).toBeLessThanOrEqual(1);
    }
    expect(geometry.footer.length).toBeGreaterThan(0);
    for (const bounds of geometry.footer) {
      expect(bounds.width, `footer width at ${viewportWidth}px`).toBeCloseTo(expectedShellWidth, 0);
      expect(
        Math.abs(bounds.left - (viewportWidth - bounds.right)),
        `footer must remain centered at ${viewportWidth}px`,
      ).toBeLessThanOrEqual(1);
    }
    for (const bounds of geometry.fullBleed) {
      expect(bounds.width, `full-bleed width at ${viewportWidth}px`).toBeCloseTo(viewportWidth, 0);
      expect(bounds.left).toBeCloseTo(0, 0);
    }
  }
});

test("keeps collection products reachable without JavaScript", async ({ browser }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith("-1440"));
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { height: 1_000, width: 1_440 },
  });
  const page = await context.newPage();
  await page.goto(
    `http://127.0.0.1:${Number(
      process.env.STOREFRONT_FASHION_STORE_LIVE_UNIFIED_HOME_PORT || 3430,
    )}/`,
    { waitUntil: "load" },
  );
  const carousel = page.locator("[data-decor-collection-carousel]");
  await expect(carousel.locator("[data-decor-collection-slide]")).toHaveCount(3);
  const overflowState = await carousel.evaluate((element) => ({
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
  }));
  expect(overflowState.overflowY).toBe("auto");
  expect(overflowState.scrollHeight).toBeGreaterThan(overflowState.clientHeight);
  const slideLinks = carousel.locator("[data-decor-collection-slide] > a");
  const scrollOffsets: number[] = [];
  for (let index = 0; index < (await slideLinks.count()); index += 1) {
    const link = slideLinks.nth(index);
    await link.focus();
    await expect(link).toBeFocused();
    const reachability = await link.evaluate((element) => {
      const linkBounds = element.getBoundingClientRect();
      const carousel = element.closest<HTMLElement>("[data-decor-collection-carousel]")!;
      const carouselBounds = carousel.getBoundingClientRect();
      return {
        fullyVisible:
          linkBounds.width > 0 &&
          linkBounds.height > 0 &&
          linkBounds.top >= carouselBounds.top - 1 &&
          linkBounds.bottom <= carouselBounds.bottom + 1,
        linkBottom: linkBounds.bottom,
        linkHeight: linkBounds.height,
        linkTop: linkBounds.top,
        linkWidth: linkBounds.width,
        carouselBottom: carouselBounds.bottom,
        carouselTop: carouselBounds.top,
        scrollTop: carousel.scrollTop,
      };
    });
    expect(reachability.fullyVisible, JSON.stringify(reachability)).toBe(true);
    scrollOffsets.push(reachability.scrollTop);
  }
  expect(scrollOffsets[0]).toBe(0);
  expect(scrollOffsets.at(-1)).toBeGreaterThan(0);
  expect(scrollOffsets).toEqual([...scrollOffsets].sort((left, right) => left - right));
  await expect(carousel.locator("a[data-fashion-store-route]")).toHaveCount(6);
  await expect(carousel.getByRole("button")).toHaveCount(0);
  await context.close();
});

test("keeps the stacked collection carousel flush and width-responsive", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.endsWith("-768"));
  await page.goto("/", { waitUntil: "networkidle" });

  const collection = page.locator('[data-decor-region="collection-carousel"]');
  for (const width of [767, 700, 576, 575, 390]) {
    await page.setViewportSize({ height: 1_000, width });
    await expect(collection.locator("[data-decor-collection-carousel]")).toHaveClass(
      /swiper-initialized/,
    );
    const geometry = await collection.evaluate((element) => {
      const row = element.querySelector<HTMLElement>(":scope > .container-fluid > .row")!;
      const panel = element.querySelector<HTMLElement>(".col-md-4")!;
      const carousel = element.querySelector<HTMLElement>("[data-decor-collection-carousel]")!;
      const slide = carousel.querySelector<HTMLElement>(".swiper-slide-active")!;
      const bounds = (target: HTMLElement) => {
        const rect = target.getBoundingClientRect();
        return { height: rect.height, left: rect.left, right: rect.right, width: rect.width };
      };
      return {
        carousel: bounds(carousel),
        panel: bounds(panel),
        panelBackground: getComputedStyle(panel).backgroundImage,
        row: bounds(row),
        slideBackground: getComputedStyle(slide).backgroundImage,
      };
    });
    expect(geometry.row.left).toBeCloseTo(0, 1);
    expect(geometry.row.right).toBeCloseTo(width, 1);
    expect(geometry.panel.left).toBeCloseTo(0, 1);
    expect(geometry.panel.right).toBeCloseTo(width, 1);
    expect(geometry.carousel.width).toBeCloseTo(width, 1);
    expect(geometry.carousel.height).toBeCloseTo(width, 1);
    expect(geometry.panelBackground).toBe("none");
    expect(geometry.slideBackground).not.toBe("none");
  }
});

test("keeps compact canonical Header controls together at the right edge", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.use.viewport?.width !== 768);
  await page.goto("/", { waitUntil: "networkidle" });

  for (const width of [991, 768, 390, 320]) {
    await page.setViewportSize({ height: 900, width });
    const header = page.locator("[data-fashion-store-header] .navbar > .container-fluid");
    const logo = header.locator(".menu-logo");
    const tools = header.locator(":scope > :last-child");
    const toggle = header.locator(".navbar-toggler");
    const layout = await expectHorizontalSequence({
      alignFirstToStart: true,
      alignLastToEnd: true,
      container: { label: "compact Header", locator: header },
      containerBox: "content",
      items: [
        { label: "Header logo", locator: logo },
        { label: "Header tools", locator: tools },
        { label: "Header menu toggle", locator: toggle },
      ],
      verticallyAligned: true,
    });
    const [logoBox, toolsBox, toggleBox] = layout.items;
    expect(await header.evaluate((element) => getComputedStyle(element).flexWrap)).toBe("nowrap");
    expect(toggleBox!.x - (toolsBox!.x + toolsBox!.width)).toBeLessThanOrEqual(16);
    expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(toolsBox!.x + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }
});
