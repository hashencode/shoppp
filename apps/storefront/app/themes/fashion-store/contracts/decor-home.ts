import type { PresentationViewModel } from "../../../theme-engine/view-models";
import { resolveFashionStoreMerchandising } from "./home-merchandising";

export interface FashionStoreDecorHomeModel {
  articleHref: string;
  collectionHref: string;
  merchandising: ReturnType<typeof resolveFashionStoreMerchandising>;
}

export function fashionStoreDecorProductsMessage(
  merchandising: FashionStoreDecorHomeModel["merchandising"],
  productCount: number,
): string {
  if (merchandising.state === "populated") {
    return productCount === 0 ? "No products are available in this collection." : "";
  }
  switch (merchandising.state) {
    case "loading":
      return "Products are loading…";
    case "empty":
      return "No products are available.";
    case "unavailable":
      return "Products are temporarily unavailable.";
    default:
      return "Products could not be loaded.";
  }
}

export function buildFashionStoreDecorHomeModel(
  viewModel: PresentationViewModel,
): FashionStoreDecorHomeModel {
  return {
    articleHref: "/magazine",
    collectionHref: "/collections",
    merchandising: resolveFashionStoreMerchandising(viewModel),
  };
}
