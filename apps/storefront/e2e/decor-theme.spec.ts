import { expect, test } from "@playwright/test";

test("Decor fixture renders its independent home route", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".decor-header")).toHaveCount(1);
  await expect(page.locator(".decor-hero")).toHaveAttribute("data-motion-ready", "true");
  await expect(page.locator(".decor-footer")).toHaveCount(1);
  await expect(page.locator(".fashion-store-home")).toHaveCount(0);
});

test("Decor geometry remains continuous across the reported boundary pairs", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "decor-desktop");
  await page.goto("/");
  await expect(page.locator(".decor-hero")).toHaveAttribute("data-motion-ready", "true");

  const sample = async (width: number) => {
    await page.setViewportSize({ height: 900, width });
    await page.waitForTimeout(50);
    return page.evaluate(() => {
      const products = [...document.querySelectorAll(".decor-hero-product")].map((product) => {
        const box = product.getBoundingClientRect();
        return { width: box.width, x: box.x };
      });
      const categories = document.querySelector(".decor-category-icons")!.getBoundingClientRect();
      return {
        categoryWidth: categories.width,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        products,
      };
    });
  };

  const at769 = await sample(769);
  const at768 = await sample(768);
  for (const [index, product] of at769.products.entries()) {
    expect(Math.abs(product.x - at768.products[index]!.x)).toBeLessThan(2);
    expect(Math.abs(product.width - at768.products[index]!.width)).toBeLessThan(2);
  }

  const at576 = await sample(576);
  const at575 = await sample(575);
  for (const [index, product] of at576.products.entries()) {
    expect(Math.abs(product.x - at575.products[index]!.x)).toBeLessThan(2);
    expect(Math.abs(product.width - at575.products[index]!.width)).toBeLessThan(2);
  }
  expect(Math.abs(at576.categoryWidth - at575.categoryWidth)).toBeLessThan(24);
  expect(at576.overflow).toBeLessThanOrEqual(1);
  expect(at575.overflow).toBeLessThanOrEqual(1);
});

test("scroll-progress-visible scroll-fixed: Decor scroll chrome reports progress and returns to the top", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "decor-desktop");
  await page.goto("/");
  await expect(page.locator(".decor-hero")).toHaveAttribute("data-motion-ready", "true");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
  const progress = page.locator(".decor-scroll-progress");
  await expect(progress).toHaveAttribute("data-visible", "true");
  expect(Number(await progress.getAttribute("data-progress"))).toBeGreaterThan(0.2);
  await progress.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
});
