import { expect, test } from "@playwright/test";

test("production fallback keeps product selection local and makes no Commerce claim", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "no-js-desktop");
  const commerceRequests: string[] = [];
  page.on("request", (request) => {
    if (/^\/api\/(?:cart|catalog|checkout)(?:\/|$)/.test(new URL(request.url()).pathname)) {
      commerceRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto("/products/atlas-carry-on");
  await expect(page.getByRole("heading", { name: "Atlas Carry-on" })).toBeVisible();
  await expect(page.getByText("$129.00")).toBeVisible();
  await page.getByRole("button", { name: "Select variant" }).click();

  expect(new URL(page.url()).pathname).toBe("/products/atlas-carry-on");
  expect(commerceRequests).toEqual([]);
});
