import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  fashion2SourceContract,
  fashion2SourceRegions,
} from "../app/themes/fashion-2/source-contract";
import { fashion2HomeData } from "../app/themes/fashion-2/fixtures/home";
import { fashion2AssetId, themeAssets } from "../app/themes/fashion-2/resources";

const componentPath = new URL(
  "../app/themes/fashion-2/components/Fashion2Home.vue",
  import.meta.url,
);
const regionMarkers: Readonly<Record<string, string>> = {
  cookie: "cookie-message",
  footer: "footer-dark",
  header: "header-with-topbar",
  "scroll-progress": "scroll-progress",
  sticky: "sticky-wrap",
};

describe("Fashion 2 complete static source home", () => {
  test("keeps all declared regions and source sentinels in source order", async () => {
    const component = await readFile(componentPath, "utf8");
    let cursor = -1;
    for (const region of fashion2SourceRegions) {
      const marker = regionMarkers[region.key] ?? "section class=";
      const next = component.indexOf(marker, cursor + 1);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
    expect(component.match(/<section\b/g)).toHaveLength(fashion2SourceContract.homeSectionCount);
    expect(component).toContain("data-swiper-number-pagination-progress");
    expect(component).toContain("data-anime");
    expect(component).not.toContain("v-html");
    expect(component).not.toContain("<iframe");
  });

  test("pins fixture counts and ordering to the source contract", () => {
    expect(fashion2HomeData.services).toHaveLength(4);
    expect(fashion2HomeData.categories.map(({ name }) => name)).toEqual([
      "Women",
      "Men",
      "Accessories",
      "Kids",
    ]);
    expect(fashion2HomeData.bestSellers).toHaveLength(10);
    expect(fashion2HomeData.collection).toHaveLength(4);
    expect(fashion2HomeData.brands.map(({ name }) => name)).toEqual([
      "ASOS",
      "Chanel",
      "Gucci",
      "Celine",
      "Adidas",
    ]);
    expect(fashion2HomeData.featuredProducts).toHaveLength(5);
    expect(fashion2HomeData.marquee).toHaveLength(8);
    expect(fashion2HomeData.magazine).toHaveLength(4);
  });

  test("resolves every fixture image through a namespaced local resource ID", () => {
    const sourceImages = [
      ...fashion2HomeData.categories,
      ...fashion2HomeData.bestSellers,
      ...fashion2HomeData.collection,
      ...fashion2HomeData.brands,
      ...fashion2HomeData.featuredProducts,
      ...fashion2HomeData.magazine,
    ].map(({ sourceImage }) => sourceImage);
    for (const sourceImage of sourceImages) {
      const assetId = fashion2AssetId(sourceImage);
      expect(assetId).toStartWith("fashion-2.");
      expect(themeAssets[assetId]).toBeTruthy();
    }
  });
});
