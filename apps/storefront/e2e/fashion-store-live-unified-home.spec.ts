import { expect, test } from "@playwright/test";

const approvedPresentations = {
  brands: "decor-continuous",
  categories: "decor-icons",
  collection: "decor-layered",
  magazine: "decor-journal",
  marquee: "decor-reverse",
  services: "decor-compact",
} as const;

test("renders approved Home presentations and switches authoritative product groups", async ({
  page,
}, testInfo) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const home = page.locator("[data-fashion-store-live-home]");
  await expect(home).toHaveCount(1);
  for (const [section, presentation] of Object.entries(approvedPresentations)) {
    await expect(home.locator(`[data-home-section="${section}"]`)).toHaveAttribute(
      "data-presentation-variant",
      presentation,
    );
  }

  const merchandising = home.locator('[data-home-section="product-merchandising"]');
  const selector = merchandising.locator(".fashion-store-merchandising-selector");
  const buttons = selector.getByRole("button");
  await expect(buttons).toHaveCount(3);
  await expect(buttons.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect(merchandising.locator("[data-fashion-store-product-card]")).toHaveCount(2);

  const bestSellers = selector.getByRole("button", { name: "Best sellers" });
  if (testInfo.project.name.includes("mobile")) {
    // Chromium's mobile emulation keeps a taller layout viewport than the
    // visible viewport after a long-page scroll. Align the control and convert
    // its layout-viewport coordinates into the coordinates used by CDP touch.
    await bestSellers.evaluate((button) => button.scrollIntoView({ block: "center" }));
    const touchPoint = await bestSellers.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - (visualViewport?.offsetLeft ?? 0),
        y: rect.top + rect.height / 2 - (visualViewport?.offsetTop ?? 0),
      };
    });
    await page.touchscreen.tap(touchPoint.x, touchPoint.y);
  } else {
    const featured = selector.getByRole("button", { name: "Featured" });
    await featured.click();
    await expect(featured).toHaveAttribute("aria-pressed", "true");

    await bestSellers.focus();
    await bestSellers.press("Space");
    await expect(bestSellers).toBeFocused();
    await expect(bestSellers).toHaveAttribute("aria-pressed", "true");

    const newArrivals = selector.getByRole("button", { name: "New arrivals" });
    await newArrivals.focus();
    await newArrivals.press("Enter");
    await expect(newArrivals).toHaveAttribute("aria-pressed", "true");

    await bestSellers.press("Enter");
  }
  await expect(bestSellers).toBeFocused();
  await expect(bestSellers).toHaveAttribute("aria-pressed", "true");
  await expect(merchandising.locator("[data-fashion-store-product-card]")).toHaveCount(2);
  await expect(merchandising.locator('[data-merchandising-panel="best-sellers"]')).toBeVisible();

  const selectorOverflow = await selector.evaluate(
    (element) => getComputedStyle(element).overflowX,
  );
  expect(selectorOverflow).toBe("auto");
  const categoriesRadius = await home
    .locator('[data-home-section="categories"] img')
    .first()
    .evaluate((element) => getComputedStyle(element).borderRadius);
  expect(categoriesRadius).toBe("50%");
  const collectionShadow = await home
    .locator('[data-home-section="collection"] img')
    .first()
    .evaluate((element) => getComputedStyle(element).boxShadow);
  expect(collectionShadow).not.toBe("none");

  const servicesBackground = await home
    .locator('[data-home-section="services"]')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(servicesBackground).not.toBe("rgba(0, 0, 0, 0)");
  const editorialBorder = await home
    .locator('[data-home-section="magazine"] article')
    .first()
    .evaluate((element) => getComputedStyle(element).borderTopStyle);
  expect(editorialBorder).toBe("solid");

  const brandTrack = home.locator('[data-home-section="brands"] .row');
  const brandAnimation = await brandTrack.evaluate(
    (element) => getComputedStyle(element).animationName,
  );
  const marqueeTrack = home.locator("[data-fashion-store-marquee]");
  const marqueeAnimation = await marqueeTrack.evaluate(
    (element) => getComputedStyle(element).animationName,
  );
  if (testInfo.project.name.includes("reduced")) {
    expect(brandAnimation).toBe("none");
    expect(marqueeAnimation).toBe("none");
    await expect(merchandising.locator(".fashion-store-merchandising-panel")).toHaveCSS(
      "transition-duration",
      "0s",
    );
  } else {
    expect(brandAnimation).toBe("fashion-store-brand-drift");
    expect(marqueeAnimation).toBe("fashion-store-marquee-reverse");
    await expect(brandTrack.locator("img")).toHaveCount(10);
    await expect(
      brandTrack.locator('.fashion-store-brand-sequence[aria-hidden="true"]'),
    ).toHaveCount(1);

    const brandMotion = await brandTrack.evaluate((element) => {
      const animation = element.getAnimations()[0];
      animation.pause();
      const duration = Number(animation.effect?.getComputedTiming().duration);
      animation.currentTime = 0;
      const startTransform = getComputedStyle(element).transform;
      const firstStart = element.querySelector("img")?.getBoundingClientRect().left;
      animation.currentTime = duration / 2;
      const middleTransform = getComputedStyle(element).transform;
      animation.currentTime = duration - 1;
      const duplicateEnd = element.querySelectorAll("img")[5]?.getBoundingClientRect().left;
      return { duplicateEnd, firstStart, middleTransform, startTransform };
    });
    expect(brandMotion.middleTransform).not.toBe(brandMotion.startTransform);
    expect(brandMotion.duplicateEnd).toBeCloseTo(brandMotion.firstStart ?? 0, 0);

    const marqueeMotion = await marqueeTrack.evaluate((element) => {
      const animation = element.getAnimations()[0];
      animation.pause();
      const duration = Number(animation.effect?.getComputedTiming().duration);
      animation.currentTime = 0;
      const start = getComputedStyle(element).transform;
      animation.currentTime = duration / 2;
      return { middle: getComputedStyle(element).transform, start };
    });
    expect(marqueeMotion.middle).not.toBe(marqueeMotion.start);
  }

  if (!testInfo.project.name.includes("mobile")) {
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

  await page.reload({ waitUntil: "networkidle" });
  const restored = page.locator('[data-home-section="product-merchandising"]');
  await expect(restored.getByRole("button", { name: "New arrivals" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(restored.locator("[data-fashion-store-product-card]")).toHaveCount(2);
});
