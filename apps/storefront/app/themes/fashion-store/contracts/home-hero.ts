export type FashionStoreDecorHeroAsset =
  | `fashion-store.decor-hero-${1 | 2 | 3}-pattern-desktop`
  | `fashion-store.decor-hero-${1 | 2 | 3}-pattern-mobile`
  | `fashion-store.decor-hero-${1 | 2 | 3}-product`
  | `fashion-store.decor-hero-${1 | 2 | 3}-thumb`;

export interface FashionStoreDecorHeroSlide {
  background: string;
  href: "/shop";
  id: `decor-hero-${1 | 2 | 3}`;
  patternDesktop: FashionStoreDecorHeroAsset;
  patternMobile: FashionStoreDecorHeroAsset;
  price: string;
  product: FashionStoreDecorHeroAsset;
  thumb: FashionStoreDecorHeroAsset;
  title: string;
}

export const fashionStoreDecorHeroSlides = [
  {
    background: "#e5eff3",
    href: "/shop",
    id: "decor-hero-1",
    patternDesktop: "fashion-store.decor-hero-1-pattern-desktop",
    patternMobile: "fashion-store.decor-hero-1-pattern-mobile",
    price: "$199.00",
    product: "fashion-store.decor-hero-1-product",
    thumb: "fashion-store.decor-hero-1-thumb",
    title: "Corby sofas",
  },
  {
    background: "#f7eee3",
    href: "/shop",
    id: "decor-hero-2",
    patternDesktop: "fashion-store.decor-hero-2-pattern-desktop",
    patternMobile: "fashion-store.decor-hero-2-pattern-mobile",
    price: "$259.00",
    product: "fashion-store.decor-hero-2-product",
    thumb: "fashion-store.decor-hero-2-thumb",
    title: "Verona sofas",
  },
  {
    background: "#e9fafb",
    href: "/shop",
    id: "decor-hero-3",
    patternDesktop: "fashion-store.decor-hero-3-pattern-desktop",
    patternMobile: "fashion-store.decor-hero-3-pattern-mobile",
    price: "$259.00",
    product: "fashion-store.decor-hero-3-product",
    thumb: "fashion-store.decor-hero-3-thumb",
    title: "Lewis sofas",
  },
] as const satisfies readonly FashionStoreDecorHeroSlide[];

export const fashionStoreDecorHeroContract = {
  autoplayMs: 9_000,
  breakpoints: [1240, 1024, 778, 480] as const,
  busyInput: "reject",
  firstSlideEntrance: "static-complete",
  lazyPreloadPrevNext: 1,
  moreInformation: "omitted-all-viewports",
  sourceEntry: "demo-decor-store.html",
  sourceLines: "310-1462",
  stopAfterReturnToFirst: true,
  swipeThresholdPx: 75,
  transitionMs: 300,
} as const;

export const fashionStoreDecorHeroLayerTimeline = [
  { delayMs: 500, durationMs: 300, ease: "power3.inOut", role: "pattern" },
  { delayMs: 900, durationMs: 500, ease: "back.out", role: "shape" },
  { delayMs: 1_000, durationMs: 800, ease: "power3.inOut", role: "product" },
  { delayMs: 1_200, durationMs: 1_000, ease: "power3.inOut", role: "title" },
  { delayMs: 1_500, durationMs: 1_000, ease: "power3.inOut", role: "price" },
  { delayMs: 1_700, durationMs: 1_000, ease: "power3.inOut", role: "cta" },
  { delayMs: 2_200, durationMs: 1_000, ease: "power3.inOut", role: "next" },
  { delayMs: 2_600, durationMs: 1_000, ease: "power4.inOut", role: "thumbnail" },
] as const;

export interface FashionStoreDecorHeroSourceTiming {
  autoplayMs: number;
  stopAfterReturnToFirst: boolean;
  swipeThresholdPx: number;
  transitionMs: number;
  layers: readonly {
    delayMs: number;
    durationMs: number;
    role: (typeof fashionStoreDecorHeroLayerTimeline)[number]["role"];
  }[];
}

export function assertFashionStoreDecorHeroSourceTiming(
  observed: FashionStoreDecorHeroSourceTiming,
): void {
  const expected = {
    autoplayMs: fashionStoreDecorHeroContract.autoplayMs,
    layers: fashionStoreDecorHeroLayerTimeline.map(({ delayMs, durationMs, role }) => ({
      delayMs,
      durationMs,
      role,
    })),
    stopAfterReturnToFirst: fashionStoreDecorHeroContract.stopAfterReturnToFirst,
    swipeThresholdPx: fashionStoreDecorHeroContract.swipeThresholdPx,
    transitionMs: fashionStoreDecorHeroContract.transitionMs,
  };
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new Error("The Fashion Hero timing ledger does not match the observed Decor source.");
  }
}
