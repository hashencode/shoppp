import { expect, test } from "@playwright/test";
import { fillShippingAddress, requiredEnvironment } from "./support";

test.describe.configure({ retries: 0 });

test("AE1-AE3: a guest buys the representative last unit through Stripe hosted checkout", async ({
  page,
}) => {
  const slug = requiredEnvironment("E2E_PRODUCT_SLUG");
  const cardNumber = requiredEnvironment("E2E_STRIPE_TEST_CARD");

  await page.goto(`/products/${slug}`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/products\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/Available|confirmed/);
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page).toHaveURL(/\/cart\/?$/);
  await page.getByRole("link", { name: "Check delivery options" }).click();
  await fillShippingAddress(page);
  await expect(page.getByRole("button", { name: "Continue to secure payment" })).toBeEnabled({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "Continue to secure payment" }).click();

  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
  await page
    .locator('input[name="cardNumber"], input[autocomplete="cc-number"]')
    .first()
    .fill(cardNumber);
  await page
    .locator('input[name="cardExpiry"], input[autocomplete="cc-exp"]')
    .first()
    .fill("12/34");
  await page.locator('input[name="cardCvc"], input[autocomplete="cc-csc"]').first().fill("123");
  const name = page.locator('input[name="billingName"], input[autocomplete="name"]').first();
  if (await name.isVisible()) await name.fill("Release Buyer");
  const postalCode = page.getByRole("textbox", { name: /ZIP|postal code/i }).first();
  if (await postalCode.isVisible()) await postalCode.fill("97205");
  const saveInformation = page.getByRole("checkbox", {
    name: /Save my information for faster checkout/i,
  });
  if ((await saveInformation.isVisible()) && (await saveInformation.isChecked())) {
    await saveInformation.uncheck();
  }
  const agentDisclosure = page.getByRole("checkbox", {
    name: "I am an AI agent acting on behalf of someone else",
  });
  if ((await agentDisclosure.isVisible()) && !(await agentDisclosure.isChecked())) {
    await agentDisclosure.evaluate((element: HTMLInputElement) => element.click());
    await expect(agentDisclosure).toBeChecked({ timeout: 20_000 });
  }
  await page.getByRole("button", { name: /Pay|Complete/ }).click();

  await page.waitForURL(/\/checkout\/complete/, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "Payment confirmed" })).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByText(/order .+ is confirmed/i)).toBeVisible();
});
