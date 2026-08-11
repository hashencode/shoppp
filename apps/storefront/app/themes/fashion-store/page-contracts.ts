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

const allPresentationModes = ["fixture-preview", "live"] as const;

export const fashionStorePageContracts = [
  {
    canonicalPath: "/",
    id: "home",
    indexing: "index",
    modes: allPresentationModes,
    path: "/",
    pageType: "home",
    ready: true,
    sourceEntry: "demo-fashion-store.html",
    variant: "home",
  },
  {
    canonicalPath: "/shop",
    id: "shop-left",
    indexing: "index",
    modes: allPresentationModes,
    path: "/shop",
    pageType: "collection",
    ready: true,
    sourceEntry: "demo-fashion-store-shop.html",
    variant: "shop-left",
  },
  {
    canonicalPath: "/shop",
    id: "shop-none",
    indexing: "index",
    modes: allPresentationModes,
    path: "/shop/no-sidebar",
    pageType: "collection",
    ready: true,
    sourceEntry: "demo-fashion-store-no-sidebar.html",
    variant: "shop-none",
  },
  {
    canonicalPath: "/shop",
    id: "shop-right",
    indexing: "index",
    modes: allPresentationModes,
    path: "/shop/right-sidebar",
    pageType: "collection",
    ready: true,
    sourceEntry: "demo-fashion-store-right-sidebar.html",
    variant: "shop-right",
  },
  {
    canonicalPath: "/collections",
    id: "collection",
    indexing: "index",
    modes: allPresentationModes,
    path: "/collections",
    pageType: "collection",
    ready: true,
    sourceEntry: "demo-fashion-store-collection.html",
    variant: "collection",
  },
  {
    canonicalPath: "/products/relaxed-corduroy-shirt",
    id: "product",
    indexing: "index",
    modes: ["fixture-preview"],
    path: "/products/relaxed-corduroy-shirt",
    pageType: "product",
    ready: true,
    sourceEntry: "demo-fashion-store-single-product.html",
    variant: "product",
  },
  {
    canonicalPath: "/cart",
    id: "cart",
    indexing: "noindex",
    modes: allPresentationModes,
    path: "/cart",
    pageType: "cart",
    ready: true,
    sourceEntry: "demo-fashion-store-cart.html",
    variant: "cart",
  },
  {
    canonicalPath: "/checkout",
    id: "checkout",
    indexing: "noindex",
    modes: allPresentationModes,
    path: "/checkout",
    pageType: "checkout",
    ready: true,
    sourceEntry: "demo-fashion-store-checkout.html",
    variant: "checkout",
  },
  {
    canonicalPath: "/wishlist",
    id: "wishlist",
    indexing: "noindex",
    modes: allPresentationModes,
    path: "/wishlist",
    pageType: "content",
    ready: true,
    sourceEntry: "demo-fashion-store-wishlist.html",
    variant: "wishlist",
  },
  {
    canonicalPath: "/account",
    id: "account",
    indexing: "noindex",
    modes: allPresentationModes,
    path: "/account",
    pageType: "content",
    ready: true,
    sourceEntry: "demo-fashion-store-account.html",
    variant: "account",
  },
  {
    canonicalPath: "/magazine",
    id: "magazine",
    indexing: "index",
    modes: allPresentationModes,
    path: "/magazine",
    pageType: "content",
    ready: true,
    sourceEntry: "demo-fashion-store-magazine.html",
    variant: "magazine",
  },
  {
    canonicalPath: "/magazine/marketing-tips-and-tricks",
    id: "article",
    indexing: "index",
    modes: allPresentationModes,
    path: "/magazine/marketing-tips-and-tricks",
    pageType: "content",
    ready: true,
    sourceEntry: "demo-fashion-store-blog-single-creative.html",
    variant: "article",
  },
  {
    canonicalPath: "/about",
    id: "about",
    indexing: "index",
    modes: allPresentationModes,
    path: "/about",
    pageType: "content",
    ready: true,
    sourceEntry: "demo-fashion-store-about.html",
    variant: "about",
  },
  {
    canonicalPath: "/faq",
    id: "faq",
    indexing: "index",
    modes: allPresentationModes,
    path: "/faq",
    pageType: "content",
    ready: true,
    sourceEntry: "demo-fashion-store-faq.html",
    variant: "faq",
  },
  {
    canonicalPath: "/contact",
    id: "contact",
    indexing: "index",
    modes: allPresentationModes,
    path: "/contact",
    pageType: "content",
    ready: true,
    sourceEntry: "demo-fashion-store-contact.html",
    variant: "contact",
  },
] as const satisfies readonly FashionStorePageContract[];

export const fashionStoreEnabledPageContracts = fashionStorePageContracts.filter(
  ({ ready }) => ready,
);

export const fashionStorePreviewRoutes = fashionStoreEnabledPageContracts.map(({ path }) => path);

export const fashionStoreLiveRouteContracts = [
  {
    family: "catalog-product",
    id: "catalog-product",
    modes: ["live"],
    pageType: "product",
    path: "/products/:slug",
    variant: "product",
  },
  {
    family: "catalog-collection",
    id: "catalog-collection",
    modes: ["live"],
    pageType: "collection",
    path: "/collections/:slug",
    variant: "collection",
  },
] as const satisfies readonly ThemeRouteContract[];

export const fashionStoreThemeRoutes = [
  ...fashionStoreEnabledPageContracts,
  ...fashionStoreLiveRouteContracts,
] as const satisfies readonly ThemeRouteContract[];

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
