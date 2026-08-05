import { expect, test } from "@playwright/test";
import { waitForNuxtHydration } from "./support/theme-fidelity";

test("new application routes reset scroll while history restores the saved position", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "no-js-desktop");
  await page.goto("/");
  await waitForNuxtHydration(page);
  const productLink = page.locator('a[href^="/products/"]').first();
  await expect(productLink).toBeVisible();
  await productLink.scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, -120));
  const savedHomePosition = await page.evaluate(() => scrollY);

  await productLink.click();
  await expect(page).toHaveURL(/\/products\//);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThanOrEqual(Math.max(0, savedHomePosition - 2));
});

test("hash navigation settles on the rendered target", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "no-js-desktop");
  await page.goto("/");
  await waitForNuxtHydration(page);
  const target = page.locator("#fashion-featured, #decor-products, #featured-heading").first();
  await expect(target).toBeAttached();
  const targetId = await target.getAttribute("id");
  expect(targetId).toBeTruthy();
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));

  await page.evaluate(async (hashTarget) => {
    const root = document.querySelector("#__nuxt") as HTMLElement & {
      __vue_app__?: {
        config: {
          globalProperties: {
            $router: { push(target: string): Promise<void> };
          };
        };
      };
    };
    await root.__vue_app__?.config.globalProperties.$router.push(`/#${hashTarget}`);
  }, targetId);

  await expect(page).toHaveURL(new RegExp(`#${targetId}$`));
  await expect
    .poll(() => target.evaluate((element) => Math.abs(element.getBoundingClientRect().top)))
    .toBeLessThanOrEqual(2);
});
