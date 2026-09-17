import { describe, expect, test } from "bun:test";

import {
  createFashionStoreLiveCatalogMigrationPlan,
  loadFashionStoreLiveCatalog,
  validateFashionStoreLiveCatalog,
} from "./prepare-fashion-store-live-catalog";

const repositoryRoot = new URL("..", import.meta.url).pathname;

describe("Fashion Store Product content successor catalog", () => {
  test("retains Product/Variant identity and price while correcting visually verifiable facts", async () => {
    const [original, successor] = await Promise.all([
      loadFashionStoreLiveCatalog({ repositoryRoot }),
      loadFashionStoreLiveCatalog({
        repositoryRoot,
        manifestPath: "tools/fashion-store-product-content-catalog.json",
      }),
    ]);
    expect(successor.products).toHaveLength(13);
    expect(successor.products.flatMap(({ variants }) => variants)).toHaveLength(28);
    expect(successor.products.flatMap(({ media }) => media)).toHaveLength(30);

    for (const [index, product] of successor.products.entries()) {
      const before = original.products[index]!;
      expect(product.id).toBe(before.id);
      expect(product.slug).toBe(before.slug);
      if (product.shopCardOrder === null) {
        expect(before.variants).toHaveLength(12);
        expect(product.variants).toHaveLength(16);
        expect(product.taxonomy.colors).toEqual(["Charcoal", "Gold", "Blue", "Green"]);
        expect(product.variants.slice(0, 4).map(({ optionValues }) => optionValues)).toEqual(
          ["S", "M", "L", "XL"].map((size) => ({ color: "Charcoal", size })),
        );
        expect(
          product.variants.slice(0, 4).every(({ sku }) => sku.startsWith("DEMO-CHARCOAL-SHIRT-")),
        ).toBe(true);
        expect(product.variants.slice(4).map(({ id, sku }) => ({ id, sku }))).toEqual(
          before.variants.map(({ id, sku }) => ({ id, sku })),
        );
        continue;
      }
      expect(
        product.variants.map(({ id, sku, price, inventory }) => ({ id, sku, price, inventory })),
      ).toEqual(
        before.variants.map(({ id, sku, price, inventory }) => ({ id, sku, price, inventory })),
      );
      expect(product.presentation?.specifications.length).toBeGreaterThanOrEqual(4);
      expect(product.variants[0]?.optionValues.color).toBe(product.taxonomy.colors[0]);
      expect(product.media[0]?.sha256).toBe(before.media[0]?.sha256);
      for (const media of product.media.slice(1)) {
        expect(media.r2Key.startsWith(`catalog/products/${product.id}/`)).toBe(true);
      }
    }
    const lead = successor.products.find(({ shopCardOrder }) => shopCardOrder === null)!;
    expect(lead.media).toHaveLength(7);
    expect(
      lead.media.slice(0, 4).every(({ sourcePath }) => /detail-0[1-4]\.jpg$/.test(sourcePath)),
    ).toBe(true);
    expect(lead.name).toBe("Button-front shirt");
    expect(lead.optionDefinitions[0]?.values.map(({ swatch }) => swatch)).toEqual([
      "#393a3d",
      "#b28a46",
      "#4f7391",
      "#6d7653",
    ]);
    expect(Object.keys(lead.presentation?.colorMediaIds ?? {})).toEqual(lead.taxonomy.colors);
    expect(lead.presentation?.purchaseStatus).toBeUndefined();
    expect(lead.presentation?.defaultVariantId).toBe(lead.variants[1]?.id);
    expect(lead.presentation?.brand).toBeUndefined();
    expect(lead.presentation?.reviewDisplay).toBeUndefined();
  });

  test("rejects a generated image assigned to another Product", async () => {
    const successor = await loadFashionStoreLiveCatalog({
      repositoryRoot,
      manifestPath: "tools/fashion-store-product-content-catalog.json",
    });
    const wrong = structuredClone(successor);
    wrong.products[0]!.media[1]!.r2Key = `catalog/products/${wrong.products[1]!.id}/fashion-store-f12/wrong.jpg`;
    expect(() => validateFashionStoreLiveCatalog(wrong)).toThrow("Product-owned R2 prefix");
  });

  test("rejects a color gallery that references another Product's media", async () => {
    const successor = await loadFashionStoreLiveCatalog({
      repositoryRoot,
      manifestPath: "tools/fashion-store-product-content-catalog.json",
    });
    const wrong = structuredClone(successor);
    const lead = wrong.products.find(({ shopCardOrder }) => shopCardOrder === null)!;
    lead.presentation!.colorMediaIds!.Blue = [wrong.products[0]!.media[0]!.id];
    expect(() => validateFashionStoreLiveCatalog(wrong)).toThrow(
      "Blue gallery media must belong to the Product",
    );
  });

  test("builds all 13 Product routes with distinct content and owned media", async () => {
    const catalog = await loadFashionStoreLiveCatalog({
      repositoryRoot,
      manifestPath: "tools/fashion-store-product-content-catalog.json",
    });
    const release = createFashionStoreLiveCatalogMigrationPlan(catalog, {
      expectedIamFingerprint: "0".repeat(64),
      mediaPublicOrigin: "https://media.example.test",
      storefrontOrigin: "https://shop.example.test",
    }).shopperRelease;
    expect(release.generatedAt).toBe("2026-09-17T00:00:00.000Z");
    expect(release.products).toHaveLength(13);
    expect(release.routes.filter((route) => route.startsWith("/products/"))).toHaveLength(13);
    expect(new Set(release.products.map(({ name }) => name)).size).toBe(13);
    expect(
      release.products.filter(({ presentation }) => presentation?.specifications.length),
    ).toHaveLength(13);
  });
});
