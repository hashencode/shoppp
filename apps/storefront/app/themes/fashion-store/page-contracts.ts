import type { PageTemplate } from "@shoppp/contracts";

import { normalizeThemeRoutePath, type ThemeRouteContract } from "../../theme-engine/routes";

export type FashionStorePageId =
  | "home"
  | "shop-left"
  | "shop-none"
  | "shop-right"
  | "collection"
  | "product"
  | "cart"
  | "checkout"
  | "wishlist"
  | "account"
  | "magazine"
  | "article"
  | "about"
  | "faq"
  | "contact";

export type FashionStorePageVariant = FashionStorePageId;

export const fashionStoreTemplatePageTypes = [
  "home",
  "collection",
  "product",
  "cart",
  "checkout",
  "content",
] as const satisfies readonly PageTemplate["pageType"][];

export interface FashionStorePageContract extends ThemeRouteContract {
  id: FashionStorePageId;
  pageType: PageTemplate["pageType"];
  ready: boolean;
  sourceEntry: string;
  variant: FashionStorePageVariant;
}

export const fashionStorePageContracts = [
  {
    id: "home",
    path: "/",
    pageType: "home",
    ready: true,
    sourceEntry: "demo-fashion-store.html",
    variant: "home",
  },
  {
    id: "shop-left",
    path: "/shop",
    pageType: "collection",
    ready: true,
    sourceEntry: "demo-fashion-store-shop.html",
    variant: "shop-left",
  },
  {
    id: "shop-none",
    path: "/shop/no-sidebar",
    pageType: "collection",
    ready: true,
    sourceEntry: "demo-fashion-store-no-sidebar.html",
    variant: "shop-none",
  },
  {
    id: "shop-right",
    path: "/shop/right-sidebar",
    pageType: "collection",
    ready: true,
    sourceEntry: "demo-fashion-store-right-sidebar.html",
    variant: "shop-right",
  },
  {
    id: "collection",
    path: "/collections",
    pageType: "collection",
    ready: false,
    sourceEntry: "demo-fashion-store-collection.html",
    variant: "collection",
  },
  {
    id: "product",
    path: "/products/relaxed-corduroy-shirt",
    pageType: "product",
    ready: true,
    sourceEntry: "demo-fashion-store-single-product.html",
    variant: "product",
  },
  {
    id: "cart",
    path: "/cart",
    pageType: "cart",
    ready: true,
    sourceEntry: "demo-fashion-store-cart.html",
    variant: "cart",
  },
  {
    id: "checkout",
    path: "/checkout",
    pageType: "checkout",
    ready: true,
    sourceEntry: "demo-fashion-store-checkout.html",
    variant: "checkout",
  },
  {
    id: "wishlist",
    path: "/wishlist",
    pageType: "content",
    ready: false,
    sourceEntry: "demo-fashion-store-wishlist.html",
    variant: "wishlist",
  },
  {
    id: "account",
    path: "/account",
    pageType: "content",
    ready: false,
    sourceEntry: "demo-fashion-store-account.html",
    variant: "account",
  },
  {
    id: "magazine",
    path: "/magazine",
    pageType: "content",
    ready: false,
    sourceEntry: "demo-fashion-store-magazine.html",
    variant: "magazine",
  },
  {
    id: "article",
    path: "/magazine/marketing-tips-and-tricks",
    pageType: "content",
    ready: false,
    sourceEntry: "demo-fashion-store-blog-single-creative.html",
    variant: "article",
  },
  {
    id: "about",
    path: "/about",
    pageType: "content",
    ready: false,
    sourceEntry: "demo-fashion-store-about.html",
    variant: "about",
  },
  {
    id: "faq",
    path: "/faq",
    pageType: "content",
    ready: false,
    sourceEntry: "demo-fashion-store-faq.html",
    variant: "faq",
  },
  {
    id: "contact",
    path: "/contact",
    pageType: "content",
    ready: false,
    sourceEntry: "demo-fashion-store-contact.html",
    variant: "contact",
  },
] as const satisfies readonly FashionStorePageContract[];

export const fashionStoreEnabledPageContracts = fashionStorePageContracts.filter(
  ({ ready }) => ready,
);

export const fashionStorePreviewRoutes = fashionStoreEnabledPageContracts.map(({ path }) => path);

export const fashionStoreRoutePaths = Object.freeze(
  Object.fromEntries(fashionStorePageContracts.map(({ id, path }) => [id, path])) as Record<
    FashionStorePageId,
    string
  >,
);

export function resolveFashionStorePage(
  path: string,
  options: { includeDisabled?: boolean } = {},
): FashionStorePageContract | undefined {
  const normalized = normalizeThemeRoutePath(path);
  const contracts = options.includeDisabled
    ? fashionStorePageContracts
    : fashionStoreEnabledPageContracts;
  return contracts.find((contract) => contract.path === normalized);
}
