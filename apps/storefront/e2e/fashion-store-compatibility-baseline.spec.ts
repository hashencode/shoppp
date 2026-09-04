import { expect, test, type Page } from "@playwright/test";
import { fashionStorePageContracts } from "../app/themes/fashion-store/page-contracts";

// Opt-in characterization of the existing build, not historical-browser certification.
const routes = fashionStorePageContracts.filter(({ id }) =>
  ["home", "product", "shop-left", "cart", "checkout"].includes(id),
);

async function resourceSnapshot(page: Page) {
  return page.evaluate(() => {
    const resources = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .filter(({ name }) => /\.(?:js|css|woff2?|ttf|otf)(?:[?#]|$)/.test(name))
      .map(({ name, encodedBodySize, decodedBodySize, transferSize, initiatorType }) => ({
        url: name,
        encodedBodySize,
        decodedBodySize,
        transferSize,
        initiatorType,
      }));
    return {
      resources,
      // Includes repeat transfers; a cached response has zero transferSize.
      encodedBodyBytes: resources.reduce((sum, item) => sum + item.encodedBodySize, 0),
      transferBytes: resources.reduce((sum, item) => sum + item.transferSize, 0),
      origins: [...new Set(resources.map(({ url }) => new URL(url).origin))],
    };
  });
}

async function geometry(page: Page) {
  return page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    runtime: {
      status: document
        .querySelector("[data-fashion-store-source-parity]")
        ?.getAttribute("data-runtime-status"),
      error: document
        .querySelector("[data-fashion-store-source-parity]")
        ?.getAttribute("data-runtime-error"),
    },
    documentHeight: document.documentElement.scrollHeight,
    overflow: document.documentElement.scrollWidth - innerWidth,
    regions: [
      "header",
      "main",
      "footer",
      ".swiper.full-screen",
      ".shop-modern",
      ".header-cart",
    ].flatMap((selector) => {
      const element = document.querySelector(selector);
      if (!element) return [];
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return [
        {
          selector,
          x: rect.x + scrollX,
          y: rect.y + scrollY,
          width: rect.width,
          height: rect.height,
          font: style.font,
          color: style.color,
          backgroundColor: style.backgroundColor,
        },
      ];
    }),
  }));
}

for (const { id, path } of routes) {
  test(`compatibility baseline: ${id}`, async ({ page, browser }, testInfo) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) =>
      failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`),
    );
    type Snapshot = {
      geometry: Awaited<ReturnType<typeof geometry>>;
      network: Awaited<ReturnType<typeof resourceSnapshot>>;
    };
    let initial: Snapshot | undefined;
    let afterSharedInteraction: Snapshot | undefined;
    try {
      await page.goto(path, { waitUntil: "networkidle" });
      await page.evaluate(async () => document.fonts.ready);
      initial = { geometry: await geometry(page), network: await resourceSnapshot(page) };
      await page.screenshot({ path: testInfo.outputPath("initial.png"), fullPage: true });
      await expect(page.locator("header nav.navbar")).toBeVisible();
      await expect(page.locator("footer.footer-dark")).toBeVisible();
      await page.getByRole("link", { name: "Search", exact: true }).click();
      await expect(page.getByPlaceholder("Enter your keywords...")).toBeFocused();
      await page.screenshot({ path: testInfo.outputPath("search-open.png") });
      await page.keyboard.press("Escape");
      await expect(page.getByPlaceholder("Enter your keywords...")).not.toBeVisible();
      await page.locator("footer").scrollIntoViewIfNeeded();
      await page.waitForLoadState("networkidle");
      afterSharedInteraction = {
        geometry: await geometry(page),
        network: await resourceSnapshot(page),
      };
      expect(afterSharedInteraction.geometry.runtime.status).toBe(
        testInfo.project.use.reducedMotion === "reduce" ? "static" : "ready",
      );
      expect(afterSharedInteraction.geometry.runtime.error).toBeNull();
      expect(initial.geometry.overflow).toBeLessThanOrEqual(1);
      expect(consoleErrors).toEqual([]);
      expect(failedRequests).toEqual([]);
    } finally {
      await testInfo.attach("baseline.json", {
        body: JSON.stringify(
          {
            browserVersion: browser.version(),
            project: testInfo.project.name,
            mode: "fixture-preview",
            route: path,
            initial,
            afterSharedInteraction,
            consoleErrors,
            failedRequests,
            scope:
              "Cold document, search open/Escape and scroll to footer; not full commerce interaction coverage.",
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
    }
  });
}

test("compatibility baseline: home temporal loop and reduced motion", async ({
  page,
}, testInfo) => {
  test.setTimeout(40_000);
  await page.goto("/", { waitUntil: "networkidle" });
  // Wake the deliberately lazy reduced-motion Home through its existing control.
  await page.getByRole("link", { name: "Search", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.mouse.move(0, 0);
  await page
    .getByRole("link", { name: "Search", exact: true })
    .evaluate((element) => (element as HTMLElement).blur());
  const active = page.locator('.fashion-store-hero-slide[data-active="true"]');
  await expect(active).toHaveCount(1);
  const samples: { elapsedMs: number; text: string }[] = [];
  const start = Date.now();
  // Real time: more than one complete 3-slide, 4-second autoplay cycle.
  for (let index = 0; index < 9; index += 1) {
    samples.push({ elapsedMs: Date.now() - start, text: await active.innerText() });
    if (index < 8) await page.waitForTimeout(2_000);
  }
  await testInfo.attach("temporal.json", {
    body: JSON.stringify({ project: testInfo.project.name, samples }, null, 2),
    contentType: "application/json",
  });
  const states = new Set(samples.map(({ text }) => text));
  if (testInfo.project.use.reducedMotion === "reduce") expect(states.size).toBe(1);
  else {
    expect(states.size).toBe(3);
    expect(samples.slice(1).some(({ text }) => text !== samples[0]!.text)).toBe(true);
    expect(samples.slice(5).some(({ text }) => text === samples[0]!.text)).toBe(true);
  }
});

test("compatibility baseline: home without JavaScript", async ({ browser, baseURL }, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
    reducedMotion: testInfo.project.use.reducedMotion,
  });
  try {
    const page = await context.newPage();
    await page.goto(baseURL!, { waitUntil: "networkidle" });
    await expect(page.locator("header nav.navbar")).toBeVisible();
    await expect(page.locator(".fashion-store-hero-slide").first()).toBeVisible();
    await expect(page.locator("footer.footer-dark")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("no-js.png"), fullPage: true });
  } finally {
    await context.close();
  }
});
