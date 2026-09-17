import { describe, expect, test } from "bun:test";

import { fashionStoreProductData } from "../apps/storefront/app/themes/fashion-store/fixtures/pages/product";
import { fashionStoreShopData } from "../apps/storefront/app/themes/fashion-store/fixtures/pages/shop";
import {
  catalogManifestDigest,
  createFashionStoreLiveCatalogMigrationPlan,
  FASHION_STORE_LIVE_CATALOG_RESET_TARGET,
  loadFashionStoreLiveCatalog,
  validateFashionStoreLiveCatalog,
  verifyFashionStoreLiveCatalogMedia,
  type FashionStoreLiveCatalog,
} from "./prepare-fashion-store-live-catalog";

const repositoryRoot = new URL("..", import.meta.url).pathname;
const reviewedResetPayloadDigest =
  "aa9ef56377f27035ad122a2640bf5ada6ca60c052d489a176b4cb041491e92fb";

function copyCatalog(catalog: FashionStoreLiveCatalog): FashionStoreLiveCatalog {
  return structuredClone(catalog);
}

describe("Fashion Store live catalog manifest", () => {
  test("freezes the accepted 13-product and 24-SKU catalog", async () => {
    const catalog = await loadFashionStoreLiveCatalog({ repositoryRoot });
    const variants = catalog.products.flatMap((product) => product.variants);
    const shopProducts = catalog.products.filter((product) => product.shopCardOrder !== null);
    const relaxed = catalog.products.find((product) => product.slug === "relaxed-corduroy-shirt");

    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.currency).toBe("USD");
    expect(catalog.products).toHaveLength(13);
    expect(variants).toHaveLength(24);
    expect(shopProducts).toHaveLength(12);
    expect(relaxed?.variants).toHaveLength(12);
    expect(relaxed?.optionDefinitions).toEqual([
      {
        name: "color",
        presentation: "color",
        values: [
          { label: "gold", swatch: "#d4af37" },
          { label: "blue", swatch: "#5881bf" },
          { label: "green", swatch: "#87a968" },
        ],
      },
      {
        name: "size",
        presentation: "text",
        values: [{ label: "S" }, { label: "M" }, { label: "L" }, { label: "XL" }],
      },
    ]);
    expect(
      catalog.products
        .filter(({ id }) => id !== relaxed?.id)
        .every(({ optionDefinitions }) =>
          optionDefinitions.every(({ presentation }) => presentation === "text"),
        ),
    ).toBe(true);
    expect(
      relaxed?.variants.map(
        (variant) => `${variant.optionValues.color}:${variant.optionValues.size}`,
      ),
    ).toEqual([
      "gold:S",
      "gold:M",
      "gold:L",
      "gold:XL",
      "blue:S",
      "blue:M",
      "blue:L",
      "blue:XL",
      "green:S",
      "green:M",
      "green:L",
      "green:XL",
    ]);
  });

  test("characterizes Shop cards without using arrivals to resolve prices", async () => {
    const catalog = await loadFashionStoreLiveCatalog({ repositoryRoot });
    const shopProducts = catalog.products
      .filter((product) => product.shopCardOrder !== null)
      .sort((left, right) => Number(left.shopCardOrder) - Number(right.shopCardOrder));

    expect(
      shopProducts.map((product) => ({
        compareAt: product.variants[0]?.price.compareAtAmount,
        fixtureId: product.source.fixtureId,
        image: product.media[0]?.sourcePath.split("/").at(-1),
        name: product.name,
        price: product.variants[0]?.price.amount,
        taxonomy: product.taxonomy,
      })),
    ).toEqual(
      fashionStoreShopData.products.map((product) => ({
        compareAt: Number(product.originalPrice.replace(/[$,.]/g, "")),
        fixtureId: product.id,
        image: product.sourceImage.split("/").at(-1),
        name: product.name,
        price: Number(product.price.replace(/[$,.]/g, "")),
        taxonomy: {
          categories: [...product.categories],
          colors: [...product.colors],
          sizes: [...product.sizes],
          tags: [...product.tags],
        },
      })),
    );

    const repeatedNames = shopProducts.filter((product) =>
      ["Textured sweater", "Traveller shirt"].includes(product.name),
    );
    expect(new Set(repeatedNames.map((product) => product.id)).size).toBe(4);
    expect(new Set(repeatedNames.map((product) => product.slug)).size).toBe(4);
    expect(
      new Set(repeatedNames.flatMap((product) => product.variants.map(({ sku }) => sku))).size,
    ).toBe(4);
  });

  test("pins exact product-owned image bytes and excludes editorial imagery", async () => {
    const catalog = await loadFashionStoreLiveCatalog({ repositoryRoot });
    const media = catalog.products.flatMap((product) => product.media);
    const relaxed = catalog.products.find((product) => product.slug === "relaxed-corduroy-shirt");

    expect(media).toHaveLength(18);
    expect(relaxed?.media).toHaveLength(fashionStoreProductData.gallery.length);
    expect(
      media.every(
        ({ height, mimeType, width }) =>
          height === 765 && width === 600 && mimeType === "image/jpeg",
      ),
    ).toBe(true);
    expect(media.some(({ sourcePath }) => sourcePath.endsWith("product-detail-07.jpg"))).toBe(
      false,
    );
    expect(new Set(media.map(({ r2Key }) => r2Key)).size).toBe(media.length);
  });

  test("fails closed on duplicate identities, invalid prices, inventory, and option matrices", async () => {
    const catalog = await loadFashionStoreLiveCatalog({ repositoryRoot });

    const duplicate = copyCatalog(catalog);
    duplicate.products[1]!.id = duplicate.products[0]!.id;
    expect(() => validateFashionStoreLiveCatalog(duplicate)).toThrow("duplicate product id");

    const badPrice = copyCatalog(catalog);
    badPrice.products[0]!.variants[0]!.price.compareAtAmount =
      badPrice.products[0]!.variants[0]!.price.amount;
    expect(() => validateFashionStoreLiveCatalog(badPrice)).toThrow("compare-at");

    const unavailable = copyCatalog(catalog);
    unavailable.products[0]!.variants[0]!.inventory.onHand = 0;
    expect(() => validateFashionStoreLiveCatalog(unavailable)).toThrow("positive inventory");

    const missingCombination = copyCatalog(catalog);
    const relaxed = missingCombination.products.find(
      (product) => product.slug === "relaxed-corduroy-shirt",
    );
    relaxed!.variants.at(-1)!.optionValues = { ...relaxed!.variants[0]!.optionValues };
    expect(() => validateFashionStoreLiveCatalog(missingCombination)).toThrow("option matrix");

    const missingMedia = copyCatalog(catalog);
    missingMedia.products[0]!.media[0]!.sourcePath += ".missing";
    await expect(verifyFashionStoreLiveCatalogMedia(missingMedia, repositoryRoot)).rejects.toThrow(
      "missing media",
    );

    const inferredColor = copyCatalog(catalog);
    inferredColor.products[0]!.optionDefinitions[0] = {
      name: "color",
      presentation: "color",
      values: [{ label: "Blue" }],
    };
    expect(() => validateFashionStoreLiveCatalog(inferredColor)).toThrow();
  });

  test("produces a stable digest for identical reviewed input", async () => {
    const first = await loadFashionStoreLiveCatalog({ repositoryRoot });
    const second = await loadFashionStoreLiveCatalog({ repositoryRoot });

    expect(catalogManifestDigest(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(catalogManifestDigest(first)).toBe(catalogManifestDigest(second));
  });

  test("builds separate complete shopper and unavailable acceptance releases", async () => {
    const catalog = await loadFashionStoreLiveCatalog({ repositoryRoot });
    const plan = createFashionStoreLiveCatalogMigrationPlan(catalog, {
      expectedIamFingerprint: "a".repeat(64),
      mediaPublicOrigin: "https://media.example.test/",
      storefrontOrigin: "https://storefront.example.test",
    });

    expect(plan.shopperRelease.products).toHaveLength(13);
    expect(plan.shopperRelease.products.flatMap(({ variants }) => variants)).toHaveLength(24);
    expect(
      plan.shopperRelease.products.find(({ slug }) => slug === "relaxed-corduroy-shirt")
        ?.optionDefinitions,
    ).toEqual(
      catalog.products.find(({ slug }) => slug === "relaxed-corduroy-shirt")?.optionDefinitions,
    );
    expect(plan.acceptanceRelease.products).toHaveLength(1);
    expect(plan.shopperRelease.products).not.toContainEqual(
      expect.objectContaining({ id: plan.applyInput.acceptanceProduct.id }),
    );
    expect(plan.mediaUploads).toHaveLength(18);
    expect(
      plan.mediaUploads.every(
        ({ r2Key, sha256 }) => r2Key.startsWith(catalog.r2Prefix) && /^[a-f0-9]{64}$/.test(sha256),
      ),
    ).toBe(true);
    expect(plan.applyInput.manifestDigest).toBe(catalogManifestDigest(catalog));
    expect(plan.applyInput.target).toEqual(FASHION_STORE_LIVE_CATALOG_RESET_TARGET);

    const reviewedPlan = createFashionStoreLiveCatalogMigrationPlan(catalog, {
      expectedIamFingerprint: "a".repeat(64),
      mediaPublicOrigin: FASHION_STORE_LIVE_CATALOG_RESET_TARGET.mediaOrigin,
      storefrontOrigin: "https://shoppp-storefront-fashion-preview.hashencode.workers.dev",
    });
    const { expectedIamFingerprint: _dynamicIamFingerprint, ...reviewedPayload } =
      reviewedPlan.applyInput;
    const canonicalize = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(canonicalize)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, entry]) => [key, canonicalize(entry)]),
            )
          : value;
    expect(
      new Bun.CryptoHasher("sha256")
        .update(JSON.stringify(canonicalize(reviewedPayload)))
        .digest("hex"),
    ).toBe(reviewedResetPayloadDigest);
  });
});
