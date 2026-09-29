import { expect, test } from "@playwright/test";

test("public build automatically records page entries, refreshes and product context once", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "no-js-desktop");
  const events: { eventId: string; route: string; productId?: string }[] = [];
  let initializations = 0;
  await page.route("**/api/platform/traffic/identity", async (route) => {
    initializations++;
    await route.fulfill({
      json: {
        data: {
          ticket: "browser-fixture-ticket",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
    });
  });
  await page.route("**/api/platform/traffic/events", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await page.goto("/products/atlas-carry-on");
  await expect.poll(() => events.length).toBe(1);
  expect(events[0]).toMatchObject({ route: "product", productId: expect.any(String) });
  await page.waitForTimeout(250);
  expect(events).toHaveLength(1);
  await page.reload();
  await expect.poll(() => events.length).toBe(2);
  expect(events[0]?.eventId).not.toBe(events[1]?.eventId);
  // The public product fallback has no navigation chrome; use its real Vue router.
  await page.evaluate(async () => {
    const root = document.querySelector("#__nuxt") as Element & {
      __vue_app__: {
        config: { globalProperties: { $router: { push: (path: string) => Promise<unknown> } } };
      };
    };
    await root.__vue_app__.config.globalProperties.$router.push("/");
  });
  await expect.poll(() => events.length).toBe(3);
  expect(events[2]).toMatchObject({ route: "home" });
  expect(events[2]?.productId).toBeUndefined();
  expect(initializations).toBe(2);
});

test("simultaneous tabs serialize initial identity creation and reuse the cookie", async ({
  context,
}, testInfo) => {
  test.skip(testInfo.project.name === "no-js-desktop");
  let newIdentities = 0;
  let events = 0;
  await context.route("**/api/platform/traffic/identity", async (route) => {
    const cookie = await route.request().headerValue("cookie");
    if (!cookie?.includes("__Host-shoppp-traffic=")) newIdentities++;
    await route.fulfill({
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "__Host-shoppp-traffic=fixture; Secure; HttpOnly; Path=/; SameSite=Lax",
      },
      body: JSON.stringify({
        data: { ticket: "signed-fixture", expiresAt: new Date(Date.now() + 60_000).toISOString() },
      }),
    });
  });
  await context.route("**/api/platform/traffic/events", async (route) => {
    events++;
    await route.fulfill({ status: 204 });
  });
  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([first.goto("/"), second.goto("/")]);
  await expect.poll(() => events).toBe(2);
  expect(newIdentities).toBe(1);
});
