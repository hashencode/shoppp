import { expect, test } from "@playwright/test";

test("Blog reaches the frozen Article and preserves source copy", async ({ page }) => {
  await page.goto("/blog");
  await expect(page.getByRole("heading", { name: "Latest blog" })).toBeVisible();
  await page
    .getByRole("link", { name: "The best influencers to follow for sartorial inspiration" })
    .click();
  await expect(page).toHaveURL(/best-influencers-for-decor-inspiration/);
  await expect(page.getByRole("heading", { name: /The best influencers/ })).toBeVisible();
});

test("About carousel and FAQ accordion expose local accessible state", async ({ page }) => {
  await page.goto("/about");
  const story = page.getByRole("status");
  await expect(story).toHaveText("Commitment to quality product");
  await page.getByRole("button", { name: "Next story" }).click();
  await expect(story).toHaveText("Classic products");
  await page.goto("/faq");
  const question = page.getByRole("button", { name: "I am having difficulty placing an order?" });
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#decor-faq-1")).toBeVisible();
});

test("Contact canary clears on navigation and emits no request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (["fetch", "xhr"].includes(request.resourceType())) requests.push(request.url());
  });
  await page.goto("/contact");
  await page.getByLabel("Name").fill("contact-canary");
  await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
  await expect(page.getByRole("img", { name: "Store location map presentation" })).toBeVisible();
  await page.goto("/about");
  await page.goto("/contact");
  await expect(page.getByLabel("Name")).toHaveValue("");
  expect(requests).toEqual([]);
});
