import type releaseFixture from "../../fixtures/release.json";

export type StorefrontProduct = (typeof releaseFixture.products)[number];
export type StorefrontCollection = (typeof releaseFixture.collections)[number];

export interface StorefrontProductPage {
  readonly collection: Pick<StorefrontCollection, "name" | "slug"> | null;
  readonly product: StorefrontProduct;
}

export interface StorefrontCollectionPage {
  readonly collection: StorefrontCollection;
  readonly products: StorefrontProduct[];
}
