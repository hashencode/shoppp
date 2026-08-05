export type CaptureThemeId = "decor" | "fashion";

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
} as const satisfies Record<CaptureThemeId, readonly string[]>;
