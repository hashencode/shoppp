import type { PreviewAction } from "../../../theme-engine/actions";
import { normalizeThemeRoutePath } from "../../../theme-engine/routes";
import type { PresentationViewModel } from "../../../theme-engine/view-models";
import type { FashionStoreShopLayout } from "./pages/shop";
import { resolveFashionStoreShopLayout } from "./pages/shop";
import {
  normalizeFashionStoreLegacyProductCard,
  normalizeFashionStoreLiveProductCard,
  type FashionStoreProductCardPresentation,
} from "./product-card";
import type {
  FashionStoreShopArrival,
  FashionStoreShopData,
  FashionStoreShopFilterGroup,
  FashionStoreShopFilterOption,
} from "../fixtures/pages/shop";
export type { FashionStoreShopFilterGroup } from "../fixtures/pages/shop";
import { fashionStoreRoutePaths } from "../page-contracts";

export interface FashionStoreCollectionCardPresentation {
  count?: string;
  destination: string;
  image?: { kind: "theme-asset"; path: string } | { alt: string; kind: "url"; src: string };
  label: string;
}

export interface FashionStoreCollectionLandingPresentation {
  announcement?: string;
  cards: readonly FashionStoreCollectionCardPresentation[];
  title: string;
  variant: "landing";
}

export interface FashionStoreCatalogGridItem {
  filters: Partial<Record<FashionStoreShopFilterGroup, readonly string[]>>;
  product: FashionStoreProductCardPresentation;
}

export interface FashionStoreCatalogGridPresentation {
  announcement?: string;
  arrivals: readonly (readonly FashionStoreShopArrival[])[];
  description?: string;
  emptyMessage: string;
  filters: Partial<
    Readonly<Record<FashionStoreShopFilterGroup, readonly FashionStoreShopFilterOption[]>>
  >;
  items: readonly FashionStoreCatalogGridItem[];
  layout: FashionStoreShopLayout;
  pagination: boolean;
  productActions?: Readonly<Record<"cart" | "quickView" | "wishlist", PreviewAction>>;
  title: string;
  variant: "grid";
}

export type FashionStoreCatalogPresentation =
  FashionStoreCollectionLandingPresentation | FashionStoreCatalogGridPresentation;

function fixtureData(viewModel: PresentationViewModel): FashionStoreShopData {
  if (viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store fixture catalog requires a theme-section source.");
  }
  return viewModel.data as unknown as FashionStoreShopData;
}

function fixtureGrid(
  data: FashionStoreShopData,
  path: string,
): FashionStoreCatalogGridPresentation {
  return {
    announcement: data.announcement,
    arrivals: data.arrivals,
    emptyMessage: "No products match the selected filters.",
    filters: data.filters,
    items: data.products.map((product) => ({
      filters: {
        category: product.categories,
        color: product.colors,
        size: product.sizes,
        tag: product.tags,
      },
      product: normalizeFashionStoreLegacyProductCard(product, fashionStoreRoutePaths.product),
    })),
    layout: resolveFashionStoreShopLayout(path).layout,
    pagination: true,
    productActions: data.productActions,
    title: "Shop",
    variant: "grid",
  };
}

function liveLanding(
  viewModel: Extract<PresentationViewModel, { kind: "collection-grid" }>,
): FashionStoreCollectionLandingPresentation {
  const leadProductImage = viewModel.products[0]?.media;
  return {
    cards: viewModel.collections.map((collection) => ({
      count:
        collection.id === viewModel.resource?.id
          ? `${viewModel.resource.productIds.length} ${
              viewModel.resource.productIds.length === 1 ? "item" : "items"
            }`
          : undefined,
      destination: collection.action.target ?? `/collections/${collection.id}`,
      image:
        collection.id === viewModel.resource?.id && leadProductImage
          ? { alt: leadProductImage.alt, kind: "url", src: leadProductImage.src }
          : undefined,
      label: collection.name,
    })),
    title: "Collection",
    variant: "landing",
  };
}

function liveGrid(
  viewModel: Extract<PresentationViewModel, { kind: "collection-grid" }>,
  path: string,
): FashionStoreCatalogGridPresentation {
  const shopPath = fashionStoreRoutePaths["shop-left"];
  const shopRoute = path === shopPath || path.startsWith(`${shopPath}/`);
  return {
    arrivals: [],
    description: viewModel.description,
    emptyMessage: "This collection does not have published products yet.",
    filters: {},
    items: viewModel.products.map((product) => ({
      filters: {},
      product: normalizeFashionStoreLiveProductCard(product),
    })),
    layout: shopRoute ? resolveFashionStoreShopLayout(path).layout : "none",
    pagination: false,
    title: shopRoute ? "Shop" : viewModel.heading,
    variant: "grid",
  };
}

export function normalizeFashionStoreCatalogPresentation(
  viewModel: PresentationViewModel,
  routePath: string,
): FashionStoreCatalogPresentation {
  const path = normalizeThemeRoutePath(routePath);
  const landing = path === fashionStoreRoutePaths.collection;
  if (viewModel.kind === "collection-grid") {
    return landing ? liveLanding(viewModel) : liveGrid(viewModel, path);
  }
  const data = fixtureData(viewModel);
  if (landing) {
    return {
      announcement: data.collection.announcement,
      cards: data.collection.cards.map(({ count, destination, label, sourceImage }) => ({
        count,
        destination,
        image: { kind: "theme-asset", path: sourceImage },
        label,
      })),
      title: "Collection",
      variant: "landing",
    };
  }
  return fixtureGrid(data, path);
}
