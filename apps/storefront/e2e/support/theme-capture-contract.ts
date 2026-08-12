import { themeViewports } from "./theme-viewports";
import type { NamedStateContract, ThemeAcceptanceMode } from "./theme-behavior-contract";
import { decorSourceRegions } from "../../app/themes/decor/source-contract";

export type CaptureThemeId = "decor" | "fashion";
export type ImplementationCaptureThemeId = "decor" | "fashion-store";

export interface ThemeComparisonDescriptor {
  artifactRoots: {
    implementation: string;
    reference: string;
  };
  densities: readonly [1, 2];
  id: string;
  implementationPath: string;
  implementationThemeId: ImplementationCaptureThemeId;
  namedStates: readonly string[];
  referenceEntry: string;
  referenceThemeId: CaptureThemeId;
  selectors: Readonly<Record<string, { implementation: string; reference: string }>>;
  viewports: typeof themeViewports;
}

export const fashionStoreComparisonDescriptor = {
  artifactRoots: {
    implementation: "implementation/fashion-store",
    reference: "reference/fashion",
  },
  densities: [1, 2],
  id: "fashion-to-fashion-store",
  implementationPath: "/",
  implementationThemeId: "fashion-store",
  namedStates: [
    "initial-home",
    "navigation-open",
    "hero-slide-1",
    "hero-slide-2",
    "hero-slide-3",
    "product-hover",
    "product-focus",
    "collection-slide-1",
    "marquee-paused",
    "footer-sticky",
  ],
  referenceEntry: "demo-fashion-store.html",
  referenceThemeId: "fashion",
  selectors: {
    collection: {
      implementation: ".swiper.slider-three-slide",
      reference: ".swiper.slider-three-slide",
    },
    footer: { implementation: "footer", reference: "footer" },
    header: { implementation: "header", reference: "header" },
    hero: { implementation: ".swiper.full-screen", reference: ".swiper.full-screen" },
    marquee: { implementation: ".swiper-width-auto", reference: ".swiper-width-auto" },
    product: {
      implementation: ".shop-modern .grid-item .shop-image",
      reference: ".shop-modern .grid-item .shop-image",
    },
  },
  viewports: themeViewports,
} as const satisfies ThemeComparisonDescriptor;

const decorCaptureRegionIds = [
  "clients",
  "collection",
  "footer",
  "header",
  "hero",
  "marquee",
] as const;
const decorRegionById = new Map(decorSourceRegions.map((region) => [region.id, region] as const));
const decorCaptureSelectors = Object.fromEntries(
  decorCaptureRegionIds.map((id) => {
    const region = decorRegionById.get(id);
    if (!region) throw new Error(`Missing Decor source region: ${id}`);
    return [id, { implementation: region.selector, reference: region.inventorySelector }];
  }),
) as ThemeComparisonDescriptor["selectors"];

export const decorComparisonDescriptor = {
  artifactRoots: {
    implementation: "implementation/decor",
    reference: "reference/decor",
  },
  densities: [1, 2],
  id: "decor-to-decor",
  implementationPath: "/",
  implementationThemeId: "decor",
  namedStates: [
    "initial-home",
    "hero-slide-1",
    "hero-slide-2",
    "hero-slide-3",
    "collection-slide-1",
    "scroll-progress-visible",
  ],
  referenceEntry: "demo-decor-store.html",
  referenceThemeId: "decor",
  selectors: decorCaptureSelectors,
  viewports: themeViewports,
} as const satisfies ThemeComparisonDescriptor;

export function resolveThemeComparison(
  referenceThemeId: string,
  implementationThemeId: string,
): ThemeComparisonDescriptor {
  if (referenceThemeId === "fashion-store") {
    throw new Error("fashion-store is implementation-only and has no source entry filename.");
  }
  if (referenceThemeId === "decor" && implementationThemeId === "decor") {
    return decorComparisonDescriptor;
  }
  if (referenceThemeId === "fashion" && implementationThemeId === "fashion-store") {
    return fashionStoreComparisonDescriptor;
  }
  throw new Error(`Unsupported theme comparison: ${referenceThemeId} -> ${implementationThemeId}.`);
}

export interface CaptureGeometryBox {
  height: number;
  pageX: number;
  pageY: number;
  width: number;
  x: number;
  y: number;
}

export type CaptureGeometrySpace = "document" | "viewport";

export function captureGeometryIssues(
  stateId: string,
  reference: CaptureGeometryBox,
  implementation: CaptureGeometryBox,
  space: CaptureGeometrySpace,
  tolerance = 2,
): string[] {
  const referenceLeft = space === "document" ? reference.pageX : reference.x;
  const referenceTop = space === "document" ? reference.pageY : reference.y;
  const implementationLeft = space === "document" ? implementation.pageX : implementation.x;
  const implementationTop = space === "document" ? implementation.pageY : implementation.y;
  const measurements = {
    bottom: [referenceTop + reference.height, implementationTop + implementation.height],
    height: [reference.height, implementation.height],
    left: [referenceLeft, implementationLeft],
    right: [referenceLeft + reference.width, implementationLeft + implementation.width],
    top: [referenceTop, implementationTop],
    width: [reference.width, implementation.width],
  } as const;

  return Object.entries(measurements).flatMap(([edge, [expected, received]]) =>
    Math.abs(expected - received) > tolerance
      ? [`${stateId} ${edge}: expected ${expected}px, received ${received}px`]
      : [],
  );
}

const captureBaseCss = `
  *, *::before, *::after {
    caret-color: transparent !important;
  }
  [data-anime], [data-anime] > *, .appear, .anime-complete, [data-source-reveal] {
    opacity: 1 !important;
    visibility: visible !important;
  }
  #cookies-model, .cookie-message, .fashion-cookie-message, .decor-cookie-message,
  .theme-demos, .all-demo, .buy-theme, .mfp-wrap, .mfp-bg,
  .fashion-skip-link, .decor-sticky-actions {
    display: none !important;
  }
`;

const frozenCaptureCss = `
  *, *::before, *::after {
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
    transition: none !important;
  }
  [data-anime], [data-anime] > *, .appear, .anime-complete, [data-source-reveal] {
    opacity: 1 !important;
    transform: none !important;
    visibility: visible !important;
  }
`;

const staticOnlyChromeCss = `
  .scroll-progress, .sticky-wrap, .decor-scroll-progress { display: none !important; }
`;

export function captureCssForMode(mode: ThemeAcceptanceMode): string {
  if (mode === "temporal") return captureBaseCss;
  if (mode === "interaction" || mode === "scroll-fixed")
    return `${captureBaseCss}\n${frozenCaptureCss}`;
  return `${captureBaseCss}\n${frozenCaptureCss}\n${staticOnlyChromeCss}`;
}

export function captureModePreservesTarget(mode: ThemeAcceptanceMode, selector: string): boolean {
  if (mode !== "static" && mode !== "fallback") return true;
  return !/[.]?(scroll-progress|sticky-wrap|decor-scroll-progress)/.test(selector);
}

export function captureModeForNamedState(state: NamedStateContract): ThemeAcceptanceMode {
  if (state.id === "footer-sticky") return "scroll-fixed";
  if (
    [
      "cart",
      "cart-coupon",
      "cart-quantity",
      "cart-shipping",
      "checkout-account",
      "checkout-payment",
      "collection-card",
      "collection-hover",
      "navigation",
      "pause",
      "product-focus",
      "product-gallery",
      "product-hover",
      "product-option",
      "product-tab",
      "search",
      "shop-arrivals",
      "shop-filter",
    ].includes(state.action.kind)
  )
    return "interaction";
  return "static";
}

export function captureModeForRegion(regionId: string): ThemeAcceptanceMode {
  return regionId === "sticky" || regionId === "scroll-progress" ? "scroll-fixed" : "static";
}

export const deterministicCaptureCss = captureCssForMode("static");

export const initialCarouselSelectors = {
  decor: [".decor-hero", ".decor-collection"],
  "fashion-store": [".swiper.full-screen"],
} as const satisfies Record<ImplementationCaptureThemeId, readonly string[]>;
