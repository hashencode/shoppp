import { themeViewports } from "./theme-viewports";

export type CaptureThemeId = "decor" | "fashion";
export type ImplementationCaptureThemeId = CaptureThemeId | "fashion-2";

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

export const fashion2ComparisonDescriptor = {
  artifactRoots: {
    implementation: "implementation/fashion-2",
    reference: "reference/fashion",
  },
  densities: [1, 2],
  id: "fashion-to-fashion-2",
  implementationPath: "/",
  implementationThemeId: "fashion-2",
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

export function resolveThemeComparison(
  referenceThemeId: string,
  implementationThemeId: string,
): ThemeComparisonDescriptor {
  if (referenceThemeId === "fashion-2") {
    throw new Error("fashion-2 is implementation-only and has no source entry filename.");
  }
  if (referenceThemeId === "fashion" && implementationThemeId === "fashion-2") {
    return fashion2ComparisonDescriptor;
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

export const deterministicCaptureCss = `
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
  #cookies-model, .cookie-message, .fashion-cookie-message, .decor-cookie-message, .scroll-progress,
  .theme-demos, .all-demo, .buy-theme, .mfp-wrap, .mfp-bg,
  .fashion-skip-link, .decor-sticky-actions, .decor-scroll-progress {
    display: none !important;
  }
`;

export const initialCarouselSelectors = {
  decor: [".decor-hero", ".decor-collection"],
  fashion: [".fashion-hero", ".fashion-collection-rail"],
  "fashion-2": [".swiper.full-screen"],
} as const satisfies Record<ImplementationCaptureThemeId, readonly string[]>;
