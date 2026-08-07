import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  fashionStoreSourceContract,
  fashionStoreSourceRegions,
} from "../app/themes/fashion-store/source-contract";
import { fashionStoreHomeData } from "../app/themes/fashion-store/fixtures/home";
import { fashionStoreAssetId, themeAssets } from "../app/themes/fashion-store/resources";

const componentPath = new URL(
  "../app/themes/fashion-store/components/FashionStoreHome.vue",
  import.meta.url,
);
const regionMarkers: Readonly<Record<string, string>> = {
  cookie: "cookie-message",
  footer: "footer-dark",
  header: "header-with-topbar",
  "scroll-progress": "scroll-progress",
  sticky: "sticky-wrap",
};

describe("Fashion Store complete static source home", () => {
  test("keeps all declared regions and source sentinels in source order", async () => {
    const component = await readFile(componentPath, "utf8");
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
    expect(component).not.toContain("v-html");
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
