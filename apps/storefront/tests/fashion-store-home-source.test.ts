import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  fashionStoreShellSourceInventory,
  fashionStoreSourceContract,
  fashionStoreSourceEntries,
  fashionStoreSourceRegions,
} from "../app/themes/fashion-store/source-contract";
import { fashionStoreHomeData } from "../app/themes/fashion-store/fixtures/home";
import { fashionStoreAssetId, themeAssets } from "../app/themes/fashion-store/resources";

const componentRoot = new URL("../app/themes/fashion-store/components/", import.meta.url);
const regionMarkers: Readonly<Record<string, string>> = {
  cookie: "cookie-message",
  footer: "footer-dark",
  header: "header-with-topbar",
  "scroll-progress": "scroll-progress",
  sticky: "sticky-wrap",
};

describe("Fashion Store complete static source home", () => {
  test("records the fifteen-entry shell inventory and its two source-driven differences", () => {
    expect(fashionStoreSourceEntries).toHaveLength(15);
    expect(fashionStoreShellSourceInventory.footer.entryCount).toBe(15);
    expect(fashionStoreShellSourceInventory.header.commonEntryCount).toBe(14);
    expect(fashionStoreShellSourceInventory.header.exceptions).toEqual([
      expect.objectContaining({ entry: "demo-fashion-store-checkout.html" }),
    ]);
    expect(fashionStoreShellSourceInventory.conditionalRegions.stickySocialRail).toEqual([
      "demo-fashion-store.html",
    ]);
  });

  test("extracts one reusable source shell without duplicating shell regions in home", async () => {
    const [home, shell, header, search, cart, footer] = await Promise.all(
      [
        "FashionStoreHome.vue",
        "shared/FashionStoreShell.vue",
        "shared/FashionStoreHeader.vue",
        "shared/FashionStoreSearchOverlay.vue",
        "shared/FashionStoreMiniCart.vue",
        "shared/FashionStoreFooter.vue",
      ].map((path) => readFile(new URL(path, componentRoot), "utf8")),
    );
    expect(home).toContain("<FashionStoreShell");
    expect(home).not.toContain('<header class="header-with-topbar"');
    expect(home).not.toContain('<footer class="footer-dark');
    expect(shell).toContain("<FashionStoreHeader");
    expect(shell).toContain("<FashionStoreFooter");
    expect(header).toMatch(/<header\s+class="header-with-topbar"/);
    expect(header).not.toContain('class="header-top-bar');
    expect(header).toContain("<FashionStoreSearchOverlay");
    expect(header).toContain("<FashionStoreMiniCart");
    expect(search).toContain('class="search-form-wrapper"');
    expect(cart).toContain('class="header-cart dropdown"');
    expect(footer).toContain('<footer class="footer-dark');
  });

  test("keeps all declared regions and source sentinels in source order", async () => {
    const component = (
      await Promise.all(
        [
          "shared/FashionStoreHeader.vue",
          "FashionStoreHome.vue",
          "shared/FashionStoreFooter.vue",
          "shared/FashionStoreShell.vue",
        ].map((path) => readFile(new URL(path, componentRoot), "utf8")),
      )
    ).join("\n");
    let cursor = -1;
    for (const region of fashionStoreSourceRegions) {
      const marker = regionMarkers[region.key] ?? "section class=";
      const next = component.indexOf(marker, cursor + 1);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(component.match(/<section\b/g)).toHaveLength(
      fashionStoreSourceContract.homeSectionCount,
    );
    expect(component).toContain("data-swiper-number-pagination-progress");
    expect(component).toContain("data-anime");
    expect(component).toContain('<noscript v-html="noScriptMarkup" />');
    expect(component.match(/\bv-html=/g)).toHaveLength(1);
    expect(component).not.toContain("<iframe");
  });

  test("pins fixture counts and ordering to the source contract", () => {
    expect(fashionStoreHomeData.services).toHaveLength(4);
    expect(fashionStoreHomeData.categories.map(({ name }) => name)).toEqual([
      "Women",
      "Men",
      "Accessories",
      "Kids",
    ]);
    expect(fashionStoreHomeData.bestSellers).toHaveLength(10);
    expect(fashionStoreHomeData.collection).toHaveLength(4);
    expect(fashionStoreHomeData.brands.map(({ name }) => name)).toEqual([
      "ASOS",
      "Chanel",
      "Gucci",
      "Celine",
      "Adidas",
    ]);
    expect(fashionStoreHomeData.featuredProducts).toHaveLength(5);
    expect(fashionStoreHomeData.marquee).toHaveLength(8);
    expect(fashionStoreHomeData.magazine).toHaveLength(4);
  });

  test("resolves every fixture image through a namespaced local resource ID", () => {
    const sourceImages = [
      ...fashionStoreHomeData.categories,
      ...fashionStoreHomeData.bestSellers,
      ...fashionStoreHomeData.collection,
      ...fashionStoreHomeData.brands,
      ...fashionStoreHomeData.featuredProducts,
      ...fashionStoreHomeData.magazine,
    ].map(({ sourceImage }) => sourceImage);
    for (const sourceImage of sourceImages) {
      const assetId = fashionStoreAssetId(sourceImage);
      expect(assetId).toStartWith("fashion-store.");
      expect(themeAssets[assetId]).toBeTruthy();
    }
  });
});
