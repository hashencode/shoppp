import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const criticalRoutes = ["/", "/collections/travel-essentials", "/products/atlas-carry-on"];

for (const route of criticalRoutes) {
  test(`${route} has no critical or serious WCAG 2.2 A/AA violation`, async ({ page }) => {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    const blocking = result.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}

test("keyboard users can skip navigation and reach purchase controls in document order", async ({
  page,
}) => {
  await page.goto("/products/atlas-carry-on");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Home", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByLabel("Breadcrumb").getByRole("link", { name: "Travel essentials" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Variant")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Currency")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Add to bag" })).toBeFocused();
});
