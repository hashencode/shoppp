import { describe, expect, test } from "bun:test";
import { catalogRelease } from "../app/generated/catalog";
import { breadcrumbStructuredData, canonicalUrl, productStructuredData } from "../app/utils/seo";

describe("storefront SEO", () => {
  test("uses one canonical origin and published snapshot for visible offer data", () => {
    const product = catalogRelease.products[0]!;
    const structured = productStructuredData(product, catalogRelease.site.origin);
    expect(canonicalUrl(catalogRelease.site.origin, `/products/${product.slug}`)).toBe(
      "https://shop.example.invalid/products/atlas-carry-on",
    );
    expect(structured).toMatchObject({
      "@type": "Product",
      name: "Atlas Carry-on",
      offers: {
        "@type": "Offer",
        price: "129.00",
        priceCurrency: "USD",
      },
    });
  });

  test("emits ordered breadcrumb structured data", () => {
    expect(
      breadcrumbStructuredData(
        [
          { name: "Home", path: "/" },
          { name: "Travel", path: "/collections/travel-essentials" },
        ],
        catalogRelease.site.origin,
      ).itemListElement,
    ).toHaveLength(2);
  });
});
