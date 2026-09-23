import type {
  CanonicalCatalogReleaseCollection,
  CanonicalCatalogReleaseProduct,
  LegacyCatalogReleaseCollection,
  LegacyCatalogReleaseProduct,
} from "@shoppp/contracts";
import type { ProductPageModel } from "../theme-engine/view-models";

export type StorefrontProduct = CanonicalCatalogReleaseProduct | LegacyCatalogReleaseProduct;
export type StorefrontCollection =
  CanonicalCatalogReleaseCollection | LegacyCatalogReleaseCollection;
export type CanonicalStorefrontProduct = CanonicalCatalogReleaseProduct;
export type CanonicalStorefrontCollection = CanonicalCatalogReleaseCollection;

export interface StorefrontProductPage {
  readonly collection: Pick<StorefrontCollection, "name" | "slug"> | null;
  readonly product: CanonicalStorefrontProduct;
  readonly releaseId: string;
  readonly siteOrigin: string;
  readonly viewModel: ProductPageModel;
}

export interface StorefrontCollectionPage {
  readonly collection: StorefrontCollection;
  readonly products: StorefrontProduct[];
}
