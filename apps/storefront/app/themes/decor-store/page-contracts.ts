import type { PageTemplate } from "@shoppp/contracts";

import { normalizeThemeRoutePath, type ThemeRouteContract } from "../../theme-engine/routes";

export type DecorStorePageId =
  | "home"
  | "shop-left"
  | "shop-none"
  | "shop-right"
  | "collection"
  | "product"
  | "wishlist"
  | "cart"
  | "checkout"
  | "account"
  | "blog"
  | "article"
  | "about"
  | "faq"
  | "contact";

export type DecorStorePageVariant = DecorStorePageId;

export const decorStoreTemplatePageTypes = [
  "home",
  "collection",
  "product",
  "cart",
  "checkout",
  "content",
] as const satisfies readonly PageTemplate["pageType"][];

export interface DecorStorePageContract extends ThemeRouteContract {
  firstReferenceAsset: string;
  fixtureId: string;
  id: DecorStorePageId;
  pageType: PageTemplate["pageType"];
  ready: boolean;
  readinessEvidence: readonly string[];
  sourceEntry: string;
  sourceEntrySha256: string;
  variant: DecorStorePageVariant;
}

const sourceEntrySha256ByEntry: Readonly<Record<string, string>> = Object.freeze({
  "demo-decor-store.html": "90a907f8ed8280da25da0248d4a6ae0d7ef3fd73f96d09afd6aa980a266e9271",
  "demo-decor-store-shop.html": "065d95c8a46c2251677d560fecf68177bfac19d1a499180eeb0d6c9f33e39371",
  "demo-decor-store-no-sidebar.html":
    "38b1e80adf4f7eb4dcc27e20048aaf30455e30bf0aa8da0b5d1cc0d0576bb4f3",
  "demo-decor-store-right-sidebar.html":
    "c610ddcb1e7bf98dec9a0bce716c69c34104a1769035af7f4ad2cfd887a55592",
  "demo-decor-store-collections.html":
    "4c7e88b0cdb2522db60f94bcad37e9dd9801bc7af530d1a33e430ef177beae27",
  "demo-decor-store-single-product.html":
    "0cc641e5bbaf8fc99b49f48a3018ee53c21da8e708322b02af92f44752a0cfc4",
  "demo-decor-store-wishlist.html":
    "20c2605c62a68a75246025f0b65ccf17d13c3f288aea31665f99a4afd7fc2f0a",
  "demo-decor-store-cart.html": "763274d2143c4c88a43887e96125005a545d14db95155058f4d2c5f2f7414415",
  "demo-decor-store-checkout.html":
    "9c2449fa59420fb9a7914fb25889f89f1020ace405206e3465bbd1d48180b7ad",
  "demo-decor-store-account.html":
    "a31db714f1108752d90644cff0db073ba007f562306a3714065849a45f8366d9",
  "demo-decor-store-blog.html": "c4c0a4e9df57465d0832d550c237e462b9e06c6659f01708e14790e56f200ec8",
  "demo-decor-store-blog-single-classic.html":
    "b6abf777b80763160368ee2a0e026b44bca9281bb1a01bb7978c986842ce98f0",
  "demo-decor-store-about.html": "7bda4259daa489b5cccdb2e0e597c19133668e28d2efe122942bcdf491068512",
  "demo-decor-store-faq.html": "548c9596e15be40b23552773c7be731721f02b67bfa9525e07a6acf5c7cdcb5a",
  "demo-decor-store-contact.html":
    "603623c9ed2e0dbe50074a8a576493caf26e9978536720ae1cf46a4de443b088",
});

const contract = (
  value: Omit<
    DecorStorePageContract,
    "firstReferenceAsset" | "fixtureId" | "readinessEvidence" | "sourceEntrySha256" | "variant"
  > &
    Partial<Pick<DecorStorePageContract, "fixtureId" | "readinessEvidence" | "variant">>,
): DecorStorePageContract => ({
  firstReferenceAsset: "images/demo-decor-store-logo-black.png",
  fixtureId: `decor-store-${value.id}`,
  readinessEvidence: [],
  variant: value.id,
  sourceEntrySha256: sourceEntrySha256ByEntry[value.sourceEntry] ?? "",
  ...value,
});

export const decorStorePageContracts = [
  contract({
    fixtureId: "decor-store-home",
    id: "home",
    pageType: "home",
    path: "/",
    ready: true,
    readinessEvidence: ["accepted-home-baseline@0c2cdb86"],
    sourceEntry: "demo-decor-store.html",
  }),
  contract({
    fixtureId: "decor-store-collection",
    id: "shop-left",
    pageType: "collection",
    path: "/shop",
    ready: true,
    readinessEvidence: ["decor-store-shop-unit", "decor-store-shop-browser"],
    sourceEntry: "demo-decor-store-shop.html",
  }),
  contract({
    fixtureId: "decor-store-collection",
    id: "shop-none",
    pageType: "collection",
    path: "/shop/no-sidebar",
    ready: true,
    readinessEvidence: ["decor-store-shop-unit", "decor-store-shop-browser"],
    sourceEntry: "demo-decor-store-no-sidebar.html",
  }),
  contract({
    fixtureId: "decor-store-collection",
    id: "shop-right",
    pageType: "collection",
    path: "/shop/right-sidebar",
    ready: true,
    readinessEvidence: ["decor-store-shop-unit", "decor-store-shop-browser"],
    sourceEntry: "demo-decor-store-right-sidebar.html",
  }),
  contract({
    id: "collection",
    pageType: "collection",
    path: "/collections",
    ready: true,
    readinessEvidence: ["decor-store-collection-unit", "decor-store-collection-browser"],
    sourceEntry: "demo-decor-store-collections.html",
  }),
  contract({
    fixtureId: "decor-store-product",
    id: "product",
    pageType: "product",
    path: "/products/minimalist-wooden-chair",
    ready: true,
    readinessEvidence: ["decor-store-product-unit", "decor-store-product-browser"],
    sourceEntry: "demo-decor-store-single-product.html",
  }),
  contract({
    fixtureId: "decor-store-content",
    id: "wishlist",
    pageType: "content",
    path: "/wishlist",
    ready: true,
    readinessEvidence: ["decor-store-wishlist-unit", "decor-store-product-browser"],
    sourceEntry: "demo-decor-store-wishlist.html",
  }),
  contract({
    id: "cart",
    pageType: "cart",
    path: "/cart",
    ready: false,
    sourceEntry: "demo-decor-store-cart.html",
  }),
  contract({
    id: "checkout",
    pageType: "checkout",
    path: "/checkout",
    ready: false,
    sourceEntry: "demo-decor-store-checkout.html",
  }),
  contract({
    id: "account",
    pageType: "content",
    path: "/account",
    ready: false,
    sourceEntry: "demo-decor-store-account.html",
  }),
  contract({
    id: "blog",
    pageType: "content",
    path: "/blog",
    ready: false,
    sourceEntry: "demo-decor-store-blog.html",
  }),
  contract({
    id: "article",
    pageType: "content",
    path: "/blog/best-influencers-for-decor-inspiration",
    ready: false,
    sourceEntry: "demo-decor-store-blog-single-classic.html",
  }),
  contract({
    id: "about",
    pageType: "content",
    path: "/about",
    ready: false,
    sourceEntry: "demo-decor-store-about.html",
  }),
  contract({
    id: "faq",
    pageType: "content",
    path: "/faq",
    ready: false,
    sourceEntry: "demo-decor-store-faq.html",
  }),
  contract({
    id: "contact",
    pageType: "content",
    path: "/contact",
    ready: false,
    sourceEntry: "demo-decor-store-contact.html",
  }),
] as const satisfies readonly DecorStorePageContract[];

const expectedSourceEntryById = new Map<DecorStorePageId, string>(
  decorStorePageContracts.map(({ id, sourceEntry }) => [id, sourceEntry]),
);

export function assertDecorStorePageContracts(
  contracts: readonly DecorStorePageContract[],
  fixtureIds: readonly string[],
): void {
  const ids = new Set<DecorStorePageId>();
  const paths = new Set<string>();
  const fixtures = new Set(fixtureIds);
  for (const page of contracts) {
    if (ids.has(page.id)) throw new Error(`${page.id} duplicate page id`);
    ids.add(page.id);
    if (paths.has(page.path)) throw new Error(`${page.id} duplicate route path`);
    paths.add(page.path);
    if (expectedSourceEntryById.get(page.id) !== page.sourceEntry)
      throw new Error(`${page.id} source entry does not match frozen authority`);
    if (!/^[a-f0-9]{64}$/.test(page.sourceEntrySha256))
      throw new Error(`${page.id} source entry digest is missing`);
    if (page.ready && !fixtures.has(page.fixtureId))
      throw new Error(`${page.id} fixture binding is missing`);
    if (page.ready && page.readinessEvidence.length === 0)
      throw new Error(`${page.id} readiness evidence is missing`);
  }
}

assertDecorStorePageContracts(decorStorePageContracts, [
  "decor-store-home",
  "decor-store-collection",
  "decor-store-product",
  "decor-store-content",
]);

export const decorStoreEnabledPageContracts = decorStorePageContracts.filter(({ ready }) => ready);

export const decorStorePreviewRoutes = decorStoreEnabledPageContracts.map(({ path }) => path);

export const decorStoreRoutePaths = Object.freeze(
  Object.fromEntries(decorStorePageContracts.map(({ id, path }) => [id, path])) as Record<
    DecorStorePageId,
    string
  >,
);

export function resolveDecorStorePage(
  path: string,
  options: { includeDisabled?: boolean } = {},
): DecorStorePageContract | undefined {
  const normalized = normalizeThemeRoutePath(path);
  const contracts = options.includeDisabled
    ? decorStorePageContracts
    : decorStoreEnabledPageContracts;
  return contracts.find((page) => page.path === normalized);
}
