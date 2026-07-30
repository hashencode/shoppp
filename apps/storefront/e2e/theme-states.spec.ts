import { expect, test } from "@playwright/test";

test("private commerce shells keep logical no-JavaScript focus and control order", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "no-js-desktop");
  await page.goto("/checkout");

  await expect(page.getByRole("heading", { level: 1, name: "Where should it go?" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh delivery options" })).toBeVisible();
  await expect(page.getByRole("checkbox")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to secure payment" })).toBeVisible();

  const orderedTags = await page
    .locator("form")
    .locator("h1, input, button")
    .evaluateAll((elements) => elements.map((element) => element.tagName.toLowerCase()));
  expect(orderedTags[0]).toBe("h1");
  expect(orderedTags.indexOf("input")).toBeLessThan(orderedTags.lastIndexOf("button"));
});

test("deployed fixture preview exposes non-indexable semantic states without JavaScript", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "no-js-desktop");
  test.skip(
    !process.env.STOREFRONT_PREVIEW_E2E_BASE_URL,
    "A deployed authenticated fixture preview was not supplied.",
  );
  await page.goto(process.env.STOREFRONT_PREVIEW_E2E_BASE_URL!);

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('[role="status"], [role="alert"]')).toHaveCount(1);
});
