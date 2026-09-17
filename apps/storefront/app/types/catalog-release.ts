import type {
  CanonicalCatalogRelease,
  CanonicalCatalogReleaseCollection,
  CanonicalCatalogReleaseProduct,
  LegacyCatalogReleaseCollection,
  LegacyCatalogReleaseProduct,
} from "@shoppp/contracts";

export type StorefrontProduct = CanonicalCatalogReleaseProduct | LegacyCatalogReleaseProduct;
export type StorefrontCollection =
  CanonicalCatalogReleaseCollection | LegacyCatalogReleaseCollection;
export type CanonicalStorefrontProduct = CanonicalCatalogReleaseProduct;
export type CanonicalStorefrontCollection = CanonicalCatalogReleaseCollection;

export interface StorefrontProductPage {
  readonly collection: Pick<StorefrontCollection, "name" | "slug"> | null;
  readonly product: CanonicalStorefrontProduct;
  readonly release: CanonicalCatalogRelease;
}

export interface StorefrontCollectionPage {
  readonly collection: StorefrontCollection;
  readonly products: StorefrontProduct[];
}
