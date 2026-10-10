import { expect, type Page } from "@playwright/test";
import type { FormalPublicationContext } from "./formal-publication-context";

export async function beginFormalPublicationPurchase(
  page: Page,
  input: Pick<FormalPublicationContext, "product" | "variant"> & {
    canonicalOrigin: string;
    buyerEmail: string;
    baseUrl?: string;
  },
): Promise<void> {
  const { product, variant } = input;
  await page.goto(`${input.baseUrl ?? ""}/products/${product.slug}`, {
    waitUntil: "networkidle",
  });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${input.canonicalOrigin}/products/${product.slug}`,
  );
  const liveProduct = page.locator("[data-fashion-store-product]");
  const title = liveProduct.locator(".product-info > h4");
  await expect(title).toHaveText(product.name);
  await expect(title).toBeVisible();
  const cookies = page.getByRole("button", { name: "Allow cookies" });
  if (await cookies.isVisible()) await cookies.click();
  let focusStart = liveProduct.getByRole("spinbutton", { name: "Quantity", exact: true });
  for (const [option, value] of Object.entries(variant.optionValues)) {
    const groupName = `${option[0]!.toLocaleUpperCase()}${option.slice(1)}`;
    focusStart = liveProduct
      .getByRole("group", { name: groupName, exact: true })
      .getByRole("radio", { name: value, exact: true });
    await focusStart.check();
  }
  const add = liveProduct.getByRole("button", { name: "Add to cart", exact: true });
  await expect(add).toBeEnabled();
  await focusStart.focus();
  for (
    let step = 0;
    step < 12 && !(await add.evaluate((element) => element === document.activeElement));
    step++
  )
    await page.keyboard.press("Tab");
  await expect(add).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(liveProduct.locator("[data-live-product-status]")).toContainText(
    "was added to your cart",
  );
  await expect(page).toHaveURL(new RegExp(`/products/${product.slug}$`));
  await page.locator(".header-cart").hover();
  await page.locator(".header-cart").locator('a[href="/cart"]').click();
  await page.locator("[data-fashion-store-cart][data-runtime-status='ready']").waitFor();
  await page.getByRole("link", { name: "Proceed to checkout", exact: true }).click();
  const checkout = page.locator("[data-fashion-store-checkout][data-runtime-status='ready']");
  await checkout.waitFor();
  await checkout.getByLabel("First name *", { exact: true }).fill("Release");
  await checkout.getByLabel("Last name *", { exact: true }).fill("Buyer");
  await checkout.getByLabel("Country *", { exact: true }).selectOption("US");
  await checkout.getByLabel("Street address *", { exact: true }).fill("100 Market Street");
  await checkout.getByLabel("Town / City *", { exact: true }).fill("San Francisco");
  await checkout.getByLabel("State *", { exact: true }).selectOption("CA");
  await checkout.getByLabel("ZIP *", { exact: true }).fill("94105");
  await checkout.getByLabel("Email address *", { exact: true }).fill(input.buyerEmail);
  await expect(checkout.locator('input[name="shipping-method"]').first()).toBeChecked({
    timeout: 60_000,
  });
  await checkout.locator(".your-order-box .terms-condition-box label").click();
  await expect(
    checkout.locator(".your-order-box .terms-condition-box input[type='checkbox']"),
  ).toBeChecked();
  const placeOrder = checkout.getByRole("button", { name: "Place order", exact: true });
  await expect(placeOrder).toBeEnabled({ timeout: 60_000 });
  await placeOrder.click();
}
