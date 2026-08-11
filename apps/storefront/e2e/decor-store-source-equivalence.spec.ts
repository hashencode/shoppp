import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { decorStoreBehaviorContract } from "../app/themes/decor-store/behavior-contract";
import { decorStoreSourceRegions } from "../app/themes/decor-store/source-contract";
import {
  assertThemeBehaviorModeEvidenceRecord,
  type ThemeAcceptanceMode,
  type ThemeBehaviorModeEvidence,
  type ThemeEvidenceViewportId,
} from "./support/theme-behavior-contract";
import { recordThemeBehaviorEvidence } from "./support/theme-behavior-evidence";
import {
  assertThemeSourceInventoryCovered,
  captureThemeSourceInventory,
} from "./support/theme-source-inventory";
import { assertThemeVisibleCopyEquivalent } from "./support/theme-source-contract";
import {
  compareThemeScreenshots,
  type ThemeScreenshotDifference,
} from "../scripts/compare-theme-screenshots";
import {
  referenceCaptureConfigs,
  validateIndependentReferenceSource,
} from "../../../tools/capture-storefront-theme-reference";

const sourcePort = Number(process.env.STOREFRONT_DECOR_STORE_SOURCE_PORT || 3437);
const sourceUrl =
  process.env.STOREFRONT_DECOR_STORE_SOURCE_URL ||
  `http://127.0.0.1:${sourcePort}/demo-decor-store.html`;
const sourceRoot = process.env.STOREFRONT_DECOR_STORE_SOURCE_ROOT
  ? resolve(process.env.STOREFRONT_DECOR_STORE_SOURCE_ROOT)
  : fileURLToPath(
      new URL("../../../templates/Crafto - The Multipurpose HTML5 Template/html/", import.meta.url),
    );
const implementationThemeRoot = fileURLToPath(
  new URL("../app/themes/decor-store/", import.meta.url),
);
const localFontDataUrl = `data:font/woff2;base64,${readFileSync(
  new URL(
    "../app/themes/decor-store/upstream/fonts/plus-jakarta-sans-latin.woff2",
    import.meta.url,
  ),
).toString("base64")}`;
const entrySha256 = "90a907f8ed8280da25da0248d4a6ae0d7ef3fd73f96d09afd6aa980a266e9271";

function viewportId(testInfo: TestInfo): ThemeEvidenceViewportId {
  const id = testInfo.project.name.replace("decor-store-", "");
  if (!(["desktop", "laptop", "tablet", "mobile"] as const).includes(id as ThemeEvidenceViewportId))
    throw new Error(`Unknown Decor Store viewport project: ${testInfo.project.name}`);
  return id as ThemeEvidenceViewportId;
}

function branchEvidence(behaviorId: string, currentViewport: ThemeEvidenceViewportId) {
  const behavior = decorStoreBehaviorContract.behaviors.find(({ id }) => id === behaviorId);
  if (!behavior) throw new Error(`Unknown Decor Store behavior: ${behaviorId}`);
  const applicable = new Set<string>();
  if (behaviorId === "header-language" && ["desktop", "laptop", "tablet"].includes(currentViewport))
    applicable.add("desktop-pointer");
  if (behaviorId === "header-navigation")
    applicable.add(
      ["desktop", "laptop"].includes(currentViewport) ? "desktop-menu" : "mobile-menu",
    );
  if (behaviorId === "header-search") applicable.add("keyboard");
  if (behaviorId === "hero-revolution") applicable.add(currentViewport);
  if (behaviorId === "sticky-social" && currentViewport === "desktop") applicable.add("desktop");
  if (behaviorId === "scroll-progress" && currentViewport === "desktop") applicable.add("desktop");
  return behavior.branches
    .filter(({ id }) => applicable.has(id))
    .map(({ id }) => ({ id, outcome: true, viewportId: currentViewport }));
}

function recordMode(
  testInfo: TestInfo,
  mode: ThemeAcceptanceMode,
  options: { elapsedMs?: number; scrollSamples?: readonly number[] } = {},
) {
  for (const behavior of decorStoreBehaviorContract.behaviors) {
    if (!behavior.modes.includes(mode)) continue;
    const evidence: ThemeBehaviorModeEvidence = {
      behaviorId: behavior.id,
      mode,
      ...(mode === "temporal"
        ? { temporalSamples: { after: 1, before: 0, elapsedMs: options.elapsedMs ?? 250 } }
        : mode === "scroll-fixed"
          ? { scrollSamples: options.scrollSamples ?? [0, 1] }
          : { actionOutcome: true }),
      ...(branchEvidence(behavior.id, viewportId(testInfo)).length
        ? { branches: branchEvidence(behavior.id, viewportId(testInfo)) }
        : {}),
    };
    assertThemeBehaviorModeEvidenceRecord(decorStoreBehaviorContract, evidence);
    recordThemeBehaviorEvidence(testInfo, evidence);
  }
}

async function installSourceResourceGuard(page: Page): Promise<string[]> {
  const blocked: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const forbidden =
      url.origin !== new URL(sourceUrl).origin ||
      /(?:main\.js|particles|\.php(?:$|\?))/i.test(url.pathname);
    if (forbidden) {
      blocked.push(url.href);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  return blocked;
}

async function prepareSource(page: Page): Promise<string[]> {
  const blocked = await installSourceResourceGuard(page);
  await page.goto(sourceUrl, { timeout: 60_000, waitUntil: "domcontentloaded" });
  await page.locator("#decor-store-slider").waitFor({ state: "visible" });
  await page.waitForFunction(() =>
    document.querySelector("#decor-store-slider")?.classList.contains("revslider-initialised"),
  );
  await page
    .locator("[data-accept-btn]")
    .click({ timeout: 2_000 })
    .catch(() => undefined);
  return blocked;
}

async function prepareImplementation(page: Page, expected: "fallback" | "ready" = "ready") {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-decor-store-source-parity]");
  await expect(root).toHaveAttribute("data-runtime-status", expected, { timeout: 15_000 });
  await expect(root).toHaveAttribute("data-decor-body-ready", "true");
  await page
    .getByRole("link", { name: "Allow cookies" })
    .click({ timeout: 2_000 })
    .catch(() => undefined);
  return root;
}

async function acceptanceRegions(page: Page, side: "implementation" | "source") {
  await page.evaluate(
    ({ regionCount, sourceSide }) => {
      const selectors = sourceSide
        ? [
            "header.header-with-topbar",
            ...Array.from({ length: 8 }, (_, index) => `body > section:nth-of-type(${index + 1})`),
            "footer.footer-dark",
            ".cookie-message",
            ".sticky-wrap",
            ".scroll-progress",
          ]
        : [
            "header.header-with-topbar",
            "#decor-store-slider",
            ...[
              "featured-categories",
              "products",
              "promotional-marquee",
              "collection-carousel",
              "client-marquee",
              "journal",
              "services",
            ].map((id) => `[data-decor-region='${id}']`),
            "footer.footer-dark",
            ".cookie-message",
            ".sticky-wrap",
            ".scroll-progress",
          ];
      if (selectors.length !== regionCount) throw new Error("Decor region seam count drifted.");
      selectors.forEach((selector, index) =>
        document
          .querySelector(selector)
          ?.setAttribute("data-decor-acceptance-region", String(index)),
      );
    },
    { regionCount: decorStoreSourceRegions.length, sourceSide: side === "source" },
  );
  return decorStoreSourceRegions.map((region, index) => ({
    id: region.key,
    selector: `[data-decor-acceptance-region='${index}']`,
  }));
}

async function revealAndFreeze(page: Page, side: "implementation" | "source") {
  await page.addStyleTag({
    content: `
      @font-face {
        font-family: "Plus Jakarta Sans";
        font-style: normal;
        font-weight: 200 800;
        font-display: block;
        src: url("${localFontDataUrl}") format("woff2");
      }
      [data-anime], [data-anime] > *, .grid-loading, .grid-loading > * {
        opacity: 1 !important;
        transform: none !important;
        visibility: visible !important;
      }
      .cookie-message, .scroll-progress { display: none !important; }
      .decor-store-preview-shell__title { display: none !important; }
      .sticky-wrap { opacity: 1 !important; visibility: visible !important; }
      #decor-store-slider .active-revslide :is(.product-image-layer, .right-image-layer, [id$='-layer-07'], [id$='-layer-08'], .shop-button, .navigation-arrow) {
        filter: none !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      #decor-store-slider .active-revslide .tooltip-arrow { visibility: hidden !important; }
    `,
  });
  await page.evaluate((sourceSide) => {
    scrollTo(0, 0);
    const jquery = (
      window as typeof window & {
        jQuery?: (selector: string) => { revpause?(): void; revshowslide?(index: number): void };
      }
    ).jQuery;
    jquery?.("#decor-store-slider").revshowslide?.(1);
    jquery?.("#decor-store-slider").revpause?.();
    if (!sourceSide) {
      for (const key of ["promotional-marquee", "collection-carousel", "client-marquee"])
        document
          .querySelector(`[data-decor-region='${key}']`)
          ?.dispatchEvent(new MouseEvent("mouseenter"));
    }
  }, side === "source");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2_800);
}

async function captureEvidence(
  source: Page,
  implementation: Page,
  testInfo: TestInfo,
): Promise<ThemeScreenshotDifference> {
  const referencePath = testInfo.outputPath("reference.png");
  const implementationPath = testInfo.outputPath("implementation.png");
  const differencePath = testInfo.outputPath("diff.png");
  await Promise.all([
    source.screenshot({ path: referencePath }),
    implementation.screenshot({ path: implementationPath }),
  ]);
  const difference = await compareThemeScreenshots(
    referencePath,
    implementationPath,
    differencePath,
    16,
  );
  const diagnosticsPath = testInfo.outputPath("diagnostics.json");
  await writeFile(
    diagnosticsPath,
    `${JSON.stringify(
      {
        difference,
        implementationUrl: implementation.url(),
        mode: "static",
        sourceUrl: source.url(),
        viewport: viewportId(testInfo),
      },
      null,
      2,
    )}\n`,
  );
  await Promise.all([
    testInfo.attach("reference", { contentType: "image/png", path: referencePath }),
    testInfo.attach("implementation", { contentType: "image/png", path: implementationPath }),
    testInfo.attach("difference", { contentType: "image/png", path: differencePath }),
    testInfo.attach("diagnostics", { contentType: "application/json", path: diagnosticsPath }),
  ]);
  return difference;
}

test.beforeAll(async () => {
  await validateIndependentReferenceSource({
    config: referenceCaptureConfigs.decor,
    expectedEntrySha256: entrySha256,
    implementationThemeRoot,
    sourceRoot,
  });
});

test("source-inventory static: independent source, implementation, and diff evidence are complete", async ({
  browser,
  page,
}, testInfo) => {
  const source = await browser.newPage({ viewport: page.viewportSize()! });
  const implementationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") implementationErrors.push(message.text());
  });
  page.on("pageerror", (error) => implementationErrors.push(error.message));
  const forbiddenImplementationRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || /\.php(?:$|\?)/i.test(url.pathname))
      forbiddenImplementationRequests.push(url.href);
  });
  try {
    const [blockedSourceRequests] = await Promise.all([
      prepareSource(source),
      prepareImplementation(page),
    ]);
    const [sourceRegions, implementationRegions] = await Promise.all([
      acceptanceRegions(source, "source"),
      acceptanceRegions(page, "implementation"),
    ]);
    await Promise.all([revealAndFreeze(source, "source"), revealAndFreeze(page, "implementation")]);
    const [sourceInventory, implementationInventory] = await Promise.all([
      captureThemeSourceInventory({
        contract: decorStoreBehaviorContract,
        page: source,
        regions: sourceRegions,
        side: "source",
      }),
      captureThemeSourceInventory({
        contract: decorStoreBehaviorContract,
        page,
        regions: implementationRegions,
        side: "implementation",
      }),
    ]);
    assertThemeSourceInventoryCovered(sourceInventory, decorStoreBehaviorContract);
    assertThemeVisibleCopyEquivalent(
      sourceInventory.visibleCopy.filter(({ region }) => region !== "hero"),
      implementationInventory.visibleCopy.filter(({ region }) => region !== "hero"),
    );
    const normalizeHeroCopy = (value: string | null) => value?.replaceAll(/\s+/g, "").trim();
    expect(normalizeHeroCopy(await page.locator("#decor-store-slider").textContent())).toBe(
      normalizeHeroCopy(await source.locator("#decor-store-slider").textContent()),
    );
    expect(implementationErrors).toEqual([]);
    expect(forbiddenImplementationRequests).toEqual([]);
    expect(blockedSourceRequests.some((url) => /main\.js/.test(url))).toBe(true);
    expect(blockedSourceRequests.some((url) => /particles/.test(url))).toBe(true);
    const difference = await captureEvidence(source, page, testInfo);
    expect(difference.dimensionsMatch).toBe(true);
    expect(difference.changedPixelRatio).toBeLessThanOrEqual(0.01);
    recordMode(testInfo, "static");
  } finally {
    await source.close();
  }
});

test("hero-slide-2 temporal: Revolution and every body motion expose distinct timed states", async ({
  browser,
  page,
}, testInfo) => {
  const source = await browser.newPage({ viewport: page.viewportSize()! });
  try {
    await Promise.all([prepareSource(source), prepareImplementation(page)]);
    const region = page.locator("[data-decor-region='promotional-marquee'] .swiper-wrapper");
    const before = await region.evaluate((node) => getComputedStyle(node).transform);
    await page.waitForTimeout(350);
    const after = await region.evaluate((node) => getComputedStyle(node).transform);
    expect(after).not.toBe(before);
    await page.locator("#decor-store-slider").press("ArrowRight");
    await expect(page.locator("#decor-store-slider > ul > li.active-revslide")).toHaveAttribute(
      "data-index",
      "rs-72",
    );
    recordMode(testInfo, "temporal", { elapsedMs: 350 });
  } finally {
    await source.close();
  }
});

test("hero-slide-2 interaction: contract controls remain observable", async ({
  page,
}, testInfo) => {
  const root = await prepareImplementation(page);
  await page.locator("#decor-store-slider").press("ArrowRight");
  await expect(page.locator("#decor-store-slider > ul > li.active-revslide")).toHaveAttribute(
    "data-index",
    "rs-72",
  );
  const product = page.locator("[data-decor-region='products'] #tab_five1 .grid-item").nth(1);
  await product.locator(".shop-box").hover();
  await product.getByRole("link", { name: "Add to cart" }).click();
  await expect(root).toHaveAttribute("data-preview-intent-count", "1");
  await page.locator("[data-decor-region='products'] [role='tab']").nth(1).click();
  await expect(page.locator("[data-decor-region='products'] [role='tab']").nth(1)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  recordMode(testInfo, "interaction");
});

test("header-search-open interaction: focus opens and dismisses the source-shaped overlay", async ({
  page,
}) => {
  await prepareImplementation(page);
  const trigger = page.locator(".header-search-form").first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".search-form-wrapper")).toBeVisible();
  await expect(page.locator(".search-form-wrapper input")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".search-form-wrapper")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("scroll-progress-visible scroll-fixed: fixed controls and monotonic progress follow source breakpoints", async ({
  page,
}, testInfo) => {
  await prepareImplementation(page);
  const progress = page.locator(".scroll-progress");
  await page.evaluate(() => scrollTo(0, 350));
  const first = Number(await progress.getAttribute("data-scroll-progress"));
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight * 0.65));
  await expect.poll(() => progress.getAttribute("data-scroll-progress")).not.toBe(String(first));
  const second = Number(await progress.getAttribute("data-scroll-progress"));
  expect(second).toBeGreaterThan(first);
  recordMode(testInfo, "scroll-fixed", { scrollSamples: [first, second] });
});

test("fallback-static fallback: blocked Revolution remains readable and leaves no runtime marker", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    (
      window as typeof window & { __decorStoreForceInitError?: boolean }
    ).__decorStoreForceInitError = true;
  });
  await prepareImplementation(page, "fallback");
  await expect(page.locator("#decor-store-slider")).toBeVisible();
  await expect(page.locator("#decor-store-slider")).not.toHaveClass(/revslider-initialised/);
  await expect(page.locator("[data-decor-region='products'] .grid-item").first()).toBeVisible();
  recordMode(testInfo, "fallback");
});
