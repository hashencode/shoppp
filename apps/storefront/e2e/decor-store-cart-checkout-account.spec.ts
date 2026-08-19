import { expect, test } from "@playwright/test";
import { isDecorStoreBusinessRequest } from "./support/decor-store-network";

test("Cart quantity, removal, totals, and refresh remain local", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (isDecorStoreBusinessRequest(request)) requests.push(request.url());
  });
  await page.goto("/cart");
  await page.getByRole("button", { name: "Increase Table clock quantity" }).click();
  await expect(page.getByRole("status", { name: "Table clock quantity" })).toHaveText("2");
  await expect(page.getByText("$131.00", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Remove Ceramic mug" }).click();
  await expect(page.locator("[data-cart-line]")).toHaveCount(2);
  await expect(page.getByText("$116.00", { exact: true })).toHaveCount(2);
  await page.reload();
  await expect(page.locator("[data-cart-line]")).toHaveCount(3);
  expect(requests).toEqual([]);
});

test("Checkout accepts only non-sensitive ephemeral typing", async ({ page }) => {
  await page.goto("/checkout");
  await page.getByLabel("First name").fill("checkout-canary");
  await expect(page.getByLabel("Account password")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Place order" })).toBeDisabled();
  await page.goto("/cart");
  await page.goto("/checkout");
  await expect(page.getByLabel("First name")).toHaveValue("");
});

test("Account presentation collects no password and submits nothing", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (isDecorStoreBusinessRequest(request)) requests.push(request.url());
  });
  await page.goto("/account");
  await page
    .getByRole("form", { name: "Login presentation" })
    .getByLabel("Username or email address")
    .fill("account-canary@example.test");
  await expect(
    page.getByRole("form", { name: "Login presentation" }).getByLabel("Password"),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Login" })).toBeDisabled();
  expect(requests).toEqual([]);
});
