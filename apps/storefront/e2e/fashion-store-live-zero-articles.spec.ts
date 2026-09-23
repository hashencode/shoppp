import { expect, test } from "@playwright/test";

test("zero-Article Release exposes no sample Article in static no-JavaScript output", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    const response = await page.goto("/magazine/released-notes", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(404);
    expect(await response!.text()).not.toContain("Server-rendered released Article content.");
    await expect(page.locator("[data-fashion-store-released-content]")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Released notes" })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
