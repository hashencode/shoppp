export interface FixtureProduct {
  readonly description: string;
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface FixtureVariant {
  readonly id: string;
  readonly priceAmount: number;
  readonly productId: string;
  readonly sku: string;
  readonly title: string;
  readonly weightGrams: number;
}

export interface RepresentativeCatalogFixture {
  readonly products: readonly FixtureProduct[];
  readonly variants: readonly FixtureVariant[];
}

function padded(value: number, width = 4): string {
  return value.toString().padStart(width, "0");
}

export function createRepresentativeCatalogFixture(): RepresentativeCatalogFixture {
  const products: FixtureProduct[] = [];
  const variants: FixtureVariant[] = [];

  for (let productNumber = 1; productNumber <= 1_000; productNumber += 1) {
    const productSuffix = padded(productNumber);
    const productId = `prd_fixture_${productSuffix}`;
    products.push({
      description: `Representative fixture product ${productSuffix}.`,
      id: productId,
      name: `Fixture Product ${productSuffix}`,
      slug: `fixture-product-${productSuffix}`,
    });

    for (let variantNumber = 1; variantNumber <= 5; variantNumber += 1) {
      variants.push({
        id: `var_fixture_${productSuffix}_${variantNumber}`,
        priceAmount: 1_000 + productNumber * 10 + variantNumber,
        productId,
        sku: `FIX-${productSuffix}-${variantNumber}`,
        title: `Option ${variantNumber}`,
        weightGrams: 100 + variantNumber * 25,
      });
    }
  }

  return { products, variants };
}
