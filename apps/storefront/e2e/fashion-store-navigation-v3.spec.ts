import { expect, test } from "@playwright/test";

test("schema-v3 candidate renders exact released Navigation and truthful optional Footer", async ({
  page,
}, testInfo) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const mobile = testInfo.project.name.endsWith("mobile");
  if (mobile) {
    const navigationToggle = page.getByRole("button", { name: "Toggle navigation" });
    await navigationToggle.focus();
    await page.keyboard.press("Enter");
    await expect(navigationToggle).toHaveAttribute("aria-expanded", "true");
  }

  const navigation = page.locator("[data-released-header-navigation]");
  await expect(navigation.locator(":scope > .nav-item > .nav-link")).toHaveText([
    "Catalog",
    "Community",
  ]);
  const catalog = navigation.locator(":scope > .nav-item").first();
  const submenuToggle = catalog.getByRole("button", { name: "Toggle Catalog menu" });
  await submenuToggle.focus();
  await page.keyboard.press("Enter");
  await expect(submenuToggle).toHaveAttribute("aria-expanded", "true");
  await expect(catalog.locator(".dropdown-menu")).toBeVisible();
  await expect(catalog.locator(".dropdown-menu a")).toHaveText([
    "Travel essentials",
    "External guide",
  ]);

  const externalChild = catalog.getByRole("link", { name: "External guide" });
  await expect(externalChild).toHaveAttribute("href", "https://example.com/fashion-guide");
  await expect(externalChild).toHaveAttribute("target", "_blank");
  await expect(externalChild).toHaveAttribute("rel", "noopener noreferrer");
  const externalRoot = navigation.getByRole("link", { name: "Community" });
  await expect(externalRoot).toHaveAttribute("target", "_blank");
  await expect(externalRoot).toHaveAttribute("rel", "noopener noreferrer");

  await expect(page.locator("[data-released-footer-navigation]")).toHaveCount(0);
  const utilities = page.locator("[data-footer-utility-navigation]");
  await expect(utilities.getByRole("link", { name: "My account" })).toHaveAttribute(
    "href",
    "/account",
  );
  await expect(utilities.getByRole("link", { name: "Cart" })).toHaveAttribute("href", "/cart");
  await expect(utilities.getByRole("link", { name: "Checkout" })).toHaveAttribute(
    "href",
    "/checkout",
  );
});
