import { expect, test } from "@playwright/test";
import { accessHeaders, adminContext, requiredEnvironment } from "./support";

test("AE5: authorized operator fulfills and partially refunds the staged order", async ({
  browser,
}) => {
  const reference = requiredEnvironment("E2E_ORDER_REFERENCE");
  const context = await adminContext(browser);
  const page = await context.newPage();
  await page.goto(`${requiredEnvironment("ADMIN_E2E_BASE_URL")}/orders/${reference}`);

  await expect(page.getByText(`Order ${reference}`)).toBeVisible();
  await page.getByRole("button", { name: "Mark picking" }).click();
  await page.getByRole("textbox", { name: "Reason" }).fill("Staging release fulfillment proof");
  await page.getByRole("button", { name: "Confirm operation" }).click();
  await expect(page.getByText("Fulfillment · picking")).toBeVisible();

  await page.getByRole("button", { name: "Refund" }).click();
  await page.getByRole("spinbutton", { name: /Amount in minor units/ }).fill("1");
  await page.getByRole("textbox", { name: "Reason" }).fill("Staging release partial refund proof");
  await page.getByRole("button", { name: "Confirm operation" }).click();
  await expect(page.getByText("Payment · partially_refunded")).toBeVisible();
  await context.close();
});

test("AE6: prohibited operator is denied by the API boundary", async ({ request }) => {
  const api = requiredEnvironment("API_E2E_BASE_URL");
  const reference = requiredEnvironment("E2E_ORDER_REFERENCE");
  const response = await request.post(`${api}/admin/orders/${reference}/refunds`, {
    headers: {
      ...accessHeaders("prohibited"),
      "Content-Type": "application/json",
      "Idempotency-Key": `prohibited-refund-${reference}`,
    },
    data: { amount: 1, confirm: true, reason: "This operation must be denied" },
  });
  expect(response.status()).toBe(403);
});
