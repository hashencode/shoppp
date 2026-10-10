import { expect, test } from "@playwright/test";
import { requiredEnvironment } from "./support";
import { readFormalPublicationContext } from "./formal-publication-context";
import { beginFormalPublicationPurchase } from "./formal-publication-purchase-journey";

const context = readFormalPublicationContext();
test.describe.configure({ retries: 0 });
test("AE1-AE3: the exact approved public storefront buys the staged last unit through Stripe", async ({
  page,
}) => {
  const { product, variant, manifest } = context;
  const cardNumber = requiredEnvironment("E2E_STRIPE_TEST_CARD");
  const before = await page.request.get("/.well-known/shoppp-release");
  expect(before.ok()).toBe(true);
  const proof = JSON.parse(requiredEnvironment("STOREFRONT_PUBLICATION_PROOF")) as {
    observation: { workerVersionId: string };
  };
  expect(await before.json()).toMatchObject({
    sourceEnvironment: manifest.publication.environment,
    identity: manifest.publication.identity,
    workerVersionId: proof.observation.workerVersionId,
  });
  await beginFormalPublicationPurchase(page, {
    product,
    variant,
    canonicalOrigin: manifest.input.catalogRelease.site.origin,
    buyerEmail: requiredEnvironment("E2E_BUYER_EMAIL"),
  });
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
  await expect(page.getByText(/^Order reference: [A-Z]+-[A-Z0-9]+\.$/)).toBeVisible();
});
