import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { adminContext, requiredEnvironment } from "./support";

test("critical storefront routes have no serious automated accessibility violations", async ({
  page,
}) => {
  const slug = requiredEnvironment("E2E_PRODUCT_SLUG");
  for (const route of ["/", `/products/${slug}`, "/cart", "/checkout"]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((violation) =>
        violation.impact ? ["critical", "serious"].includes(violation.impact) : false,
      ),
    ).toEqual([]);
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
  }
});

test("admin order actions expose focusable confirmation and restore focus", async ({ browser }) => {
  const context = await adminContext(browser);
  const page = await context.newPage();
  await page.goto(
    `${requiredEnvironment("ADMIN_E2E_BASE_URL")}/orders/${requiredEnvironment("E2E_ORDER_REFERENCE")}`,
  );
  const refund = page.getByRole("button", { name: "Refund" });
  await refund.focus();
  await refund.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(refund).toBeFocused();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
  await context.close();
});
