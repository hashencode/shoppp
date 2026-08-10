import type { ThemeBehaviorContract } from "../../../../../e2e/support/theme-behavior-contract";
import { normalizeThemeRoutePath } from "../../../../theme-engine/routes";

export type FashionStoreShopLayout = "left" | "none" | "right";

export const fashionStoreShopSourcePages = [
  {
    id: "shop-left",
    layout: "left",
    route: "/shop",
    sourceEntry: "demo-fashion-store-shop.html",
    sourceSha256: "1efb50af3ca47307a3c214457dacebb1493e97fb610dad5c28cc6c639c149af3",
  },
  {
    id: "shop-none",
    layout: "none",
    route: "/shop/no-sidebar",
    sourceEntry: "demo-fashion-store-no-sidebar.html",
    sourceSha256: "b4b91a8b91aac11fe333a1618e2923be8db5dafca734431dc897830ad8c29bc6",
  },
  {
    id: "shop-right",
    layout: "right",
    route: "/shop/right-sidebar",
    sourceEntry: "demo-fashion-store-right-sidebar.html",
    sourceSha256: "54d681fffdb48e25c230264a3fa896c12a488d3b3d817581d73a49784b6afbe9",
  },
] as const;

export function resolveFashionStoreShopLayout(path: string) {
  const normalized = normalizeThemeRoutePath(path);
  const page = fashionStoreShopSourcePages.find(({ route }) => route === normalized);
  if (!page) throw new Error(`Unknown Fashion Store Shop route: ${normalized}.`);
  return page;
}

const sourceRegions = (sidebar: boolean) =>
  [
    { key: "header", selector: "header.header-with-topbar" },
    { key: "page-title", selector: "section:nth-of-type(1)" },
    { itemCount: 12, key: "product-grid", selector: "section:nth-of-type(2) .grid-item" },
    { key: "pagination", selector: ".pagination" },
    ...(sidebar ? [{ key: "sidebar", selector: ".shop-sidebar" }] : []),
    { key: "footer", selector: "footer.footer-dark" },
    { key: "cookie", selector: ".cookie-message" },
    { key: "scroll-progress", selector: ".scroll-progress" },
  ] as const;

export const fashionStoreShopLeftSourceRegions = sourceRegions(true);
export const fashionStoreShopNoneSourceRegions = sourceRegions(false);
export const fashionStoreShopRightSourceRegions = sourceRegions(true);

export const fashionStoreShopLeftSourceContract = {
  behaviorContractPath: "./shop.ts",
  layoutMode: "left",
  productCount: 12,
  regionOrder: fashionStoreShopLeftSourceRegions.map(({ key }) => key),
  sourceSha256: fashionStoreShopSourcePages[0].sourceSha256,
} as const;
export const fashionStoreShopNoneSourceContract = {
  behaviorContractPath: "./shop.ts",
  layoutMode: "none",
  productCount: 12,
  regionOrder: fashionStoreShopNoneSourceRegions.map(({ key }) => key),
  sourceSha256: fashionStoreShopSourcePages[1].sourceSha256,
} as const;
export const fashionStoreShopRightSourceContract = {
  behaviorContractPath: "./shop.ts",
  layoutMode: "right",
  productCount: 12,
  regionOrder: fashionStoreShopRightSourceRegions.map(({ key }) => key),
  sourceSha256: fashionStoreShopSourcePages[2].sourceSha256,
} as const;

const productBehavior = {
  actions: {
    implementation: { kind: "hover", selector: ".shop-modern .grid-item" },
    source: { kind: "hover", selector: ".shop-modern .grid-item" },
  },
  branches: [
    { id: "pointer", input: "mouse", outcome: "Product actions become visible." },
    { id: "keyboard", input: "keyboard", outcome: "Product actions receive visible focus." },
    { id: "touch", input: "touch", outcome: "Product actions remain operable." },
  ],
  disposition: { kind: "reproduced" },
  evidenceStates: [
    {
      fidelityState: "product-hover",
      namedState: {
        action: { kind: "product-hover" },
        capture: "element",
        id: "shop-product-hover",
        implementationSelector: ".shop-modern .grid-item .shop-image",
        sourceSelector: ".shop-modern .grid-item .shop-image",
      },
    },
  ],
  fallback: {
    outcome: "Product links and actions remain in source order.",
    strategy: "native-control",
  },
  id: "shop-product-actions",
  initialState: "actions visually recessed",
  modes: ["interaction", "fallback"],
  outcome: "Hover, focus, and touch expose the source product actions.",
  owner: "framework-adapter",
  region: "product-grid",
  role: "commerce-action",
  sourceCandidate: ".shop-modern .grid-item a, .shop-modern .shop-hover a",
  sourceSelector: ".shop-modern .grid-item",
  triggers: ["hover", "focus", "keyboard", "touch", "click"],
} as const;

const filterBehavior = {
  actions: {
    implementation: { kind: "click", selector: ".category-filter button" },
    source: { kind: "click", selector: ".category-filter a" },
  },
  branches: [
    { id: "pointer", input: "mouse", outcome: "The chosen source filter is active." },
    {
      id: "keyboard",
      input: "keyboard",
      outcome: "The chosen source filter is active and focused.",
    },
  ],
  disposition: {
    kind: "approved-adaptation",
    reason:
      "Source hash links are semantic buttons in the Nuxt implementation and filter only deterministic preview fixtures.",
  },
  evidenceStates: [
    {
      namedState: {
        action: { group: "category", kind: "shop-filter", label: "Jeans" },
        capture: "element",
        geometrySpace: "viewport",
        id: "shop-filter-category-jeans",
        implementationSelector: ".category-filter",
        sourceSelector: ".category-filter",
      },
    },
    {
      namedState: {
        action: { group: "tag", kind: "shop-filter", label: "Cotton" },
        capture: "element",
        geometrySpace: "viewport",
        id: "shop-filter-tag-cotton",
        implementationSelector: ".tag-cloud",
        sourceSelector: ".tag-cloud",
      },
    },
  ],
  fallback: {
    outcome: "All products and filter labels remain readable.",
    strategy: "native-control",
  },
  id: "shop-filters",
  initialState: "no filter active",
  modes: ["interaction", "fallback"],
  outcome: "Category, color, size, and tag controls filter the deterministic product set.",
  owner: "framework-adapter",
  region: "sidebar",
  role: "state-control",
  sourceCandidate: ".shop-sidebar .shop-filter a",
  sourceSelector: ".shop-sidebar .shop-filter a",
  triggers: ["click", "keyboard", "touch"],
} as const;

const arrivalBehavior = {
  actions: {
    implementation: { kind: "click", selector: ".slider-one-slide-next-1" },
    source: { kind: "click", selector: ".slider-one-slide-next-1" },
  },
  branches: [
    { id: "timer", outcome: "The next arrival group becomes active." },
    { id: "keyboard", input: "keyboard", outcome: "The next arrival group becomes active." },
  ],
  disposition: { kind: "reproduced" },
  evidenceStates: [
    {
      namedState: {
        action: { index: 1, kind: "shop-arrivals" },
        capture: "element",
        geometrySpace: "viewport",
        id: "shop-arrival-slide-1",
        implementationSelector: ".slider-one-slide",
        sourceSelector: ".slider-one-slide",
      },
    },
  ],
  fallback: {
    outcome: "Both source arrival groups remain readable in DOM order.",
    strategy: "static-stack",
  },
  id: "shop-new-arrivals",
  initialState: "first arrival group active",
  modes: ["temporal", "interaction", "fallback"],
  outcome:
    "The sidebar arrival track animates for 300ms, autoplays every 5000ms, pauses, and tears down with the page.",
  owner: "framework-adapter",
  region: "sidebar",
  role: "carousel",
  sourceCandidate: ".slider-one-slide, .slider-one-slide-prev-1, .slider-one-slide-next-1",
  sourceSelector: ".slider-one-slide",
  triggers: ["timer", "click", "keyboard", "touch"],
} as const;

const shopBehaviorContract = (routeId: string, sidebar: boolean): ThemeBehaviorContract => ({
  behaviors: sidebar ? [filterBehavior, productBehavior, arrivalBehavior] : [productBehavior],
  customAdapters: [],
  routeId,
  suppressions: [
    {
      candidate: "a[href]:not([data-bs-toggle]):not([onclick])",
      reason:
        "Plain source anchors are covered by route, copy, and absence parity rather than in-page behavior ownership.",
    },
  ],
  themeId: "fashion-store",
});

export const fashionStoreShopLeftBehaviorContract = shopBehaviorContract(
  "fashion-store-shop-left",
  true,
);
export const fashionStoreShopNoneBehaviorContract = shopBehaviorContract(
  "fashion-store-shop-none",
  false,
);
export const fashionStoreShopRightBehaviorContract = shopBehaviorContract(
  "fashion-store-shop-right",
  true,
);
