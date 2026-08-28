import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { decorStorePageContracts } from "../app/themes/decor-store/page-contracts";
import { decorStoreSecondaryPageSourceContracts } from "../app/themes/decor-store/source-contract";
import {
  assertThemeScreenshotDifference,
  compareThemeScreenshots,
} from "../scripts/compare-theme-screenshots";

const sourcePort = Number(process.env.STOREFRONT_DECOR_STORE_SOURCE_PORT || 3437);
const sourceOrigin =
  process.env.STOREFRONT_DECOR_STORE_SOURCE_URL?.replace(/\/[^/]*$/, "") ||
  `http://127.0.0.1:${sourcePort}`;
const transparentPixel = Buffer.from(
  "<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>",
);
const pages = decorStorePageContracts.filter(({ id }) => id !== "home");

function normalizedCopy(value: string | null): string[] {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);
}

async function freezePresentation(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation: none !important; transition: none !important; }
      [data-anime], [data-anime] > *, .grid-loading, .grid-loading > * {
        opacity: 1 !important; transform: none !important; visibility: visible !important;
      }
      header, footer, .cookie-message, .sticky-wrap, .scroll-progress,
      .decor-store-preview-shell__title { display: none !important; }
    `,
  });
}

for (const contract of pages) {
  test(`${contract.id} source copy, regions, and viewport image remain equivalent`, async ({
    browser,
    page,
  }, testInfo) => {
    const source = await browser.newPage({ viewport: testInfo.project.use.viewport });
    await source.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "via.placeholder.com") {
        await route.fulfill({ body: transparentPixel, contentType: "image/svg+xml" });
        return;
      }
      if (url.origin !== sourceOrigin) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    await Promise.all([
      source.goto(`${sourceOrigin}/${contract.sourceEntry}`, { waitUntil: "domcontentloaded" }),
      page.goto(contract.path, { waitUntil: "domcontentloaded" }),
    ]);
    await expect(page.locator(`[data-decor-source-page='${contract.id}']`)).toBeVisible();
    await Promise.all([freezePresentation(source), freezePresentation(page)]);

    const sourceSections = source.locator("body > section");
    const implementationSections = page.locator("[data-decor-source-page] > section");
    const sourceContract = decorStoreSecondaryPageSourceContracts.find(
      ({ id }) => id === contract.id,
    );
    expect(sourceContract).toBeDefined();
    await expect(sourceSections).toHaveCount(sourceContract!.sectionCount);
    await expect(implementationSections).toHaveCount(sourceContract!.sectionCount);
    const [sourceCopy, implementationCopy] = await Promise.all([
      sourceSections.allTextContents().then((text) => text.join(" ")),
      implementationSections.evaluateAll((sections) => {
        const container = document.createElement("div");
        sections.forEach((section) => container.append(section.cloneNode(true)));
        container
          .querySelectorAll(".decor-store-source-status")
          .forEach((status) => status.remove());
        return container.textContent ?? "";
      }),
    ]);
    expect(normalizedCopy(implementationCopy)).toEqual(normalizedCopy(sourceCopy));

    await Promise.all([
      sourceSections.first().scrollIntoViewIfNeeded(),
      implementationSections.first().scrollIntoViewIfNeeded(),
    ]);
    const referencePath = testInfo.outputPath(`${contract.id}-source.png`);
    const implementationPath = testInfo.outputPath(`${contract.id}-implementation.png`);
    const differencePath = testInfo.outputPath(`${contract.id}-difference.png`);
    await mkdir(dirname(referencePath), { recursive: true });
    await Promise.all([
      source.screenshot({ path: referencePath }),
      page.screenshot({ path: implementationPath }),
    ]);
    const difference = await compareThemeScreenshots(
      referencePath,
      implementationPath,
      differencePath,
      24,
    );
    assertThemeScreenshotDifference(difference, 0.35);
    await source.close();
  });
}
