import type { FidelityViewportId } from "../../../../tools/theme-fidelity-report";

export type NamedStateAction =
  | { kind: "cart" }
  | { kind: "category-hover" }
  | { kind: "client-pause" }
  | { index: number; kind: "collection" }
  | { kind: "collection-hover" }
  | { index: number; kind: "hero" }
  | { kind: "initial" }
  | { kind: "language" }
  | { kind: "navigation"; menu?: "Collection" | "Pages" | "Shop" }
  | { kind: "overlay" }
  | { kind: "pause" }
  | { kind: "promo-pause" }
  | { kind: "product-focus" }
  | { kind: "product-hover" }
  | { kind: "search" }
  | { kind: "tab-secondary" };

export interface NamedStateContract {
  action: NamedStateAction;
  capture: "element" | "viewport-top";
  id: string;
  implementationSelector: string;
  sourceSelector: string;
}

export function namedStatePixelThreshold(state: NamedStateContract): number {
  if (["cart-open", "search-open"].includes(state.id)) return 0.001;
  return 0.005;
}

export const fashionNamedStates: readonly NamedStateContract[] = [
  {
    action: { kind: "overlay" },
    capture: "element",
    id: "cookie-overlay",
    implementationSelector: ".fashion-cookie-message",
    sourceSelector: "#cookies-model",
  },
  {
    action: { kind: "navigation", menu: "Shop" },
    capture: "viewport-top",
    id: "navigation-open",
    implementationSelector: ".fashion-nav-shell",
    sourceSelector: "header .navbar",
  },
  {
    action: { kind: "navigation", menu: "Collection" },
    capture: "viewport-top",
    id: "collection-menu-open",
    implementationSelector: ".fashion-nav-shell",
    sourceSelector: "header .navbar",
  },
  {
    action: { kind: "navigation", menu: "Pages" },
    capture: "viewport-top",
    id: "pages-menu-open",
    implementationSelector: ".fashion-nav-shell",
    sourceSelector: "header .navbar",
  },
  {
    action: { kind: "search" },
    capture: "viewport-top",
    id: "search-open",
    implementationSelector: ".fashion-search-panel",
    sourceSelector: ".search-form-wrapper",
  },
  {
    action: { kind: "cart" },
    capture: "element",
    id: "cart-open",
    implementationSelector: ".fashion-cart-panel",
    sourceSelector: ".cart-item-list",
  },
  ...[0, 1, 2].map((index): NamedStateContract => ({
    action: { index, kind: "hero" },
    capture: "element",
    id: `hero-slide-${index + 1}`,
    implementationSelector: ".fashion-hero",
    sourceSelector: ".swiper.full-screen",
  })),
  {
    action: { kind: "initial" },
    capture: "element",
    id: "product-default",
    implementationSelector: ".fashion-product-media",
    sourceSelector: ".shop-modern .grid-item .shop-image",
  },
  {
    action: { kind: "product-hover" },
    capture: "element",
    id: "product-hover",
    implementationSelector: ".fashion-product-media",
    sourceSelector: ".shop-modern .grid-item .shop-image",
  },
  {
    action: { kind: "product-focus" },
    capture: "element",
    id: "product-focus",
    implementationSelector: ".fashion-product-media",
    sourceSelector: ".shop-modern .grid-item .shop-image",
  },
  ...[0, 1, 2, 3].map((index): NamedStateContract => ({
    action: { index, kind: "collection" },
    capture: "element",
    id: `collection-slide-${index + 1}`,
    implementationSelector: ".fashion-collection-rail",
    sourceSelector: ".swiper.slider-three-slide",
  })),
  {
    action: { kind: "collection-hover" },
    capture: "element",
    id: "collection-hover",
    implementationSelector: ".fashion-collection-track article",
    sourceSelector: ".swiper.slider-three-slide .swiper-slide-active",
  },
  {
    action: { kind: "pause" },
    capture: "element",
    id: "marquee-paused",
    implementationSelector: ".fashion-promises",
    sourceSelector: "section:nth-of-type(9)",
  },
  {
    action: { kind: "initial" },
    capture: "element",
    id: "footer",
    implementationSelector: ".fashion-footer",
    sourceSelector: "footer",
  },
] as const;

export const decorNamedStates: readonly NamedStateContract[] = [
  {
    action: { kind: "overlay" },
    capture: "element",
    id: "cookie-overlay",
    implementationSelector: ".decor-cookie-message",
    sourceSelector: "#cookies-model",
  },
  {
    action: { kind: "language" },
    capture: "viewport-top",
    id: "language-open",
    implementationSelector: ".decor-nav",
    sourceSelector: "header .navbar",
  },
  {
    action: { kind: "navigation" },
    capture: "viewport-top",
    id: "navigation-open",
    implementationSelector: ".decor-nav",
    sourceSelector: "header .navbar",
  },
  ...[0, 1, 2].map((index): NamedStateContract => ({
    action: { index, kind: "hero" },
    capture: "element",
    id: `hero-slide-${index + 1}`,
    implementationSelector: ".decor-hero",
    sourceSelector: "#decor-store-slider_wrapper",
  })),
  {
    action: { kind: "initial" },
    capture: "element",
    id: "category-default",
    implementationSelector: ".decor-category-icon-list a",
    sourceSelector: ".categories-style-01",
  },
  {
    action: { kind: "category-hover" },
    capture: "element",
    id: "category-hover",
    implementationSelector: ".decor-category-icon-list a",
    sourceSelector: ".categories-style-01",
  },
  {
    action: { kind: "initial" },
    capture: "element",
    id: "product-default",
    implementationSelector: ".decor-product-box",
    sourceSelector: ".shop-boxed .grid-item .shop-box",
  },
  {
    action: { kind: "product-hover" },
    capture: "element",
    id: "product-hover",
    implementationSelector: ".decor-product-box",
    sourceSelector: ".shop-boxed .grid-item .shop-box",
  },
  {
    action: { kind: "product-focus" },
    capture: "element",
    id: "product-focus",
    implementationSelector: ".decor-product-box",
    sourceSelector: ".shop-boxed .grid-item .shop-box",
  },
  {
    action: { kind: "tab-secondary" },
    capture: "element",
    id: "new-arrivals-tab",
    implementationSelector: ".decor-products",
    sourceSelector: "section:nth-of-type(3)",
  },
  ...[0, 1, 2].map((index): NamedStateContract => ({
    action: { index, kind: "collection" },
    capture: "element",
    id: `collection-slide-${index + 1}`,
    implementationSelector: ".decor-collection-product",
    sourceSelector: "section:nth-of-type(5) .swiper",
  })),
  {
    action: { kind: "promo-pause" },
    capture: "element",
    id: "promotional-marquee-paused",
    implementationSelector: ".decor-marquee",
    sourceSelector: "section:nth-of-type(4)",
  },
  {
    action: { kind: "client-pause" },
    capture: "element",
    id: "client-strip-paused",
    implementationSelector: ".decor-clients",
    sourceSelector: "section:nth-of-type(6)",
  },
  {
    action: { kind: "initial" },
    capture: "element",
    id: "footer",
    implementationSelector: ".decor-footer",
    sourceSelector: "footer",
  },
] as const;

export const namedStateViewportIds: readonly FidelityViewportId[] = [
  "desktop",
  "laptop",
  "tablet",
  "mobile",
];
