import { expect, test } from "@playwright/test";

test("production storefront exposes no preview route", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "no-js-desktop");
  const response = await request.get("/__theme-preview/snapshot-fashion-1");

  expect(response.status()).toBe(404);
  expect(await response.text()).toContain("Page not found");
});

test("private preview origin fails closed without a session", async ({ playwright }, testInfo) => {
  test.skip(testInfo.project.name !== "no-js-desktop");
  const previewOrigin = process.env.STOREFRONT_PREVIEW_E2E_BASE_URL;
  test.skip(!previewOrigin, "A deployed private preview origin was not supplied.");

  const request = await playwright.request.newContext({ baseURL: previewOrigin });
  const response = await request.get("/");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await request.dispose();
});
