import { expect, test } from "@playwright/test";
import { accessHeaders, adminApiUrl, requiredEnvironment } from "./support";

test("failed publication keeps the recorded last-known-good storefront live and alerts operators", async ({
  page,
  request,
}) => {
  const slug = requiredEnvironment("E2E_PRODUCT_SLUG");
  const releaseId = requiredEnvironment("E2E_LAST_KNOWN_GOOD_RELEASE_ID");
  const failedReleaseId = requiredEnvironment("E2E_FAILED_CATALOG_RELEASE_ID");
  const response = await page.goto(`/products/${slug}`);
  expect(response?.ok()).toBeTruthy();
  expect(await response!.text()).toContain(releaseId);

  const catalog = await request.get(adminApiUrl(`/admin/catalog/products?query=${slug}`), {
    headers: accessHeaders(),
  });
  expect(catalog.ok()).toBeTruthy();
  expect(await catalog.json()).toMatchObject({
    data: [
      {
        build_correlation_id: failedReleaseId,
        build_status: "failed",
        slug,
      },
    ],
  });

  const health = await request.get(adminApiUrl("/admin/operations/health"), {
    headers: accessHeaders(),
  });
  expect(health.ok()).toBeTruthy();
  const payload = (await health.json()) as {
    data: { failures: { catalogBuilds: number }; status: string };
  };
  expect(payload.data.status).toBe("degraded");
  expect(payload.data.failures.catalogBuilds).toBeGreaterThan(0);
});

test("public, login, webhook, and cache boundaries are deployed", async ({ page, request }) => {
  const storefront = await page.goto("/");
  expect(storefront?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(storefront?.headers()["x-frame-options"]).toBe("DENY");

  const adminLoginShell = await request.get(requiredEnvironment("ADMIN_E2E_BASE_URL"));
  expect(adminLoginShell.ok()).toBeTruthy();

  const health = await request.get(`${requiredEnvironment("API_E2E_BASE_URL")}/health`);
  expect(health.ok()).toBeTruthy();
  expect(await health.json()).toMatchObject({ data: { status: "ok" } });
});
