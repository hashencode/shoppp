import type { FidelityViewportId } from "../../../../tools/theme-fidelity-report";
import {
  fashionStoreBehaviorContract,
  fashionStoreFidelityStatesByRegion,
} from "../../app/themes/fashion-store/behavior-contract";
import {
  fashionStoreShopLeftBehaviorContract,
  fashionStoreShopNoneBehaviorContract,
  fashionStoreShopRightBehaviorContract,
} from "../../app/themes/fashion-store/contracts/pages/shop";
import { fashionStoreProductBehaviorContract } from "../../app/themes/fashion-store/contracts/pages/product";
import {
  fidelityStatesByRegionFromBehaviorContract,
  type ThemeBehaviorContract,
} from "./theme-behavior-contract";
import type { ThemeBehaviorDescriptor } from "./theme-behavior-descriptor";
import { themeViewportIds, themeViewports } from "./theme-viewports";

export type FidelityDensity = 1 | 2;
export type FidelityRegionKind = "component" | "control" | "full-page-smoke" | "section";
export type FidelityRouteId = string;
export type FidelityMatrixViewportId = FidelityViewportId;

export interface FidelityRegionContract {
  allowExpectedTopOcclusion?: boolean;
  geometryTolerancePx: number;
  id: string;
  imageAssetPolicy?: "implementation-original" | "source-match";
  implementationProbeSelector?: string;
  implementationSelector: string;
  kind: FidelityRegionKind;
  maxChangedPixelRatio: number;
  neutralizeImagePixels?: boolean;
  normalizeFractionalCaptureHeight?: boolean;
  pixelBudgetReason?:
    | "dense-source-font-antialiasing"
    | "source-accessibility-contrast-correction"
    | "source-font-antialiasing"
    | "source-image-subpixel-rasterization";
  probeRootStyles?: boolean;
  sourceProbeSelector?: string;
  sourceSelector: string;
  styleEquivalences?: Readonly<
    Record<
      string,
      readonly {
        implementation: string;
        reason: "source-accessibility-contrast-correction";
        reference: string;
      }[]
    >
  >;
  states: readonly string[];
  waiverId?: string;
}

export interface FidelityRouteContract {
  densities: readonly FidelityDensity[];
  id: FidelityRouteId;
  implementationPath: string;
  regions: readonly FidelityRegionContract[];
  sourcePath: string;
  viewports: readonly FidelityMatrixViewportId[];
}

export const fidelityMatrixViewports = themeViewports satisfies Record<
  FidelityMatrixViewportId,
  { height: number; width: number }
>;

const fashionStoreStates = (regionId: string, defaults: readonly string[] = ["initial"]) => [
  ...defaults,
  ...(fashionStoreFidelityStatesByRegion[regionId] ?? []),
];

const shopStates = (
  contract: ThemeBehaviorContract,
  regionId: string,
  defaults: readonly string[] = ["initial"],
) => [...defaults, ...(fidelityStatesByRegionFromBehaviorContract(contract)[regionId] ?? [])];

const region = (
  id: string,
  kind: FidelityRegionKind,
  sourceSelector: string,
  implementationSelector: string,
  states: readonly string[] = ["initial"],
  probes: Pick<FidelityRegionContract, "implementationProbeSelector" | "sourceProbeSelector"> = {},
): FidelityRegionContract => ({
  ...probes,
  geometryTolerancePx: kind === "component" ? 1 : 2,
  id,
  implementationSelector,
  kind,
  maxChangedPixelRatio: kind === "full-page-smoke" ? 0.01 : kind === "component" ? 0.004 : 0.005,
  sourceSelector,
  states,
});

export const themeFidelityMatrix: readonly FidelityRouteContract[] = [
  {
    densities: [1, 2] as const,
    id: "fashion-store-home",
    implementationPath: "/",
    regions: [
      region("header", "section", "header", "header", fashionStoreStates("header")),
      region(
        "hero",
        "component",
        ".swiper.full-screen",
        ".swiper.full-screen",
        fashionStoreStates("hero", ["initial", "reduced-motion"]),
        {
          implementationProbeSelector: ".fashion-store-hero-slide[data-active=true] .fs-120",
          sourceProbeSelector: ".swiper.full-screen .swiper-slide-active .fs-120",
        },
      ),
      region("categories", "component", "section:nth-of-type(3)", "section:nth-of-type(3)"),
      region(
        "best-sellers",
        "section",
        "section:nth-of-type(4)",
        "section:nth-of-type(4)",
        fashionStoreStates("best-sellers"),
      ),
      region(
        "collection",
        "section",
        "section:nth-of-type(6)",
        "section:nth-of-type(6)",
        fashionStoreStates("collection"),
      ),
      region(
        "marquee",
        "component",
        "section:nth-of-type(9)",
        "section:nth-of-type(9)",
        fashionStoreStates("marquee"),
      ),
      region("footer", "component", "footer", "footer", fashionStoreStates("footer")),
      region("sticky", "control", ".sticky-wrap", ".sticky-wrap", fashionStoreStates("sticky")),
      region(
        "scroll-progress",
        "control",
        ".scroll-progress",
        ".scroll-progress",
        fashionStoreStates("scroll-progress"),
      ),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store.html",
    viewports: themeViewportIds,
  },
  ...(
    [
      {
        behavior: fashionStoreShopLeftBehaviorContract,
        id: "fashion-store-shop-left",
        implementationPath: "/shop",
        layout: "left",
        sourcePath: "/demo-fashion-store-shop.html",
      },
      {
        behavior: fashionStoreShopNoneBehaviorContract,
        id: "fashion-store-shop-none",
        implementationPath: "/shop/no-sidebar",
        layout: "none",
        sourcePath: "/demo-fashion-store-no-sidebar.html",
      },
      {
        behavior: fashionStoreShopRightBehaviorContract,
        id: "fashion-store-shop-right",
        implementationPath: "/shop/right-sidebar",
        layout: "right",
        sourcePath: "/demo-fashion-store-right-sidebar.html",
      },
    ] as const
  ).map(({ behavior, id, implementationPath, layout, sourcePath }) => ({
    densities: [1, 2] as const,
    id,
    implementationPath,
    regions: [
      region("header", "section", "header", "header"),
      region("page-title", "component", "section:nth-of-type(1)", "section:nth-of-type(1)"),
      region(
        "product-grid",
        "section",
        "section:nth-of-type(2) .shop-modern",
        "section:nth-of-type(2) .shop-modern",
        shopStates(behavior, "product-grid"),
      ),
      ...(layout === "none"
        ? []
        : [region("sidebar", "section", ".shop-sidebar", ".shop-sidebar")]),
      region("pagination", "control", ".pagination", ".pagination"),
      region("footer", "component", "footer", "footer"),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath,
    viewports: themeViewportIds,
  })),
  {
    densities: [1, 2] as const,
    id: "fashion-store-product",
    implementationPath: "/products/relaxed-corduroy-shirt",
    regions: [
      region("header", "section", "header", "header"),
      region("breadcrumb", "component", "section:nth-of-type(1)", "section:nth-of-type(1)"),
      region(
        "gallery",
        "component",
        ".col-lg-7 .row.overflow-hidden",
        ".fashion-product-gallery .row.overflow-hidden",
        shopStates(fashionStoreProductBehaviorContract, "gallery"),
      ),
      region(
        "product-info",
        "section",
        ".product-info",
        ".product-info",
        shopStates(fashionStoreProductBehaviorContract, "product-info"),
      ),
      region(
        "tabs",
        "section",
        "#tab",
        "#tab",
        shopStates(fashionStoreProductBehaviorContract, "tabs"),
      ),
      region("related-products", "section", "section:nth-of-type(4)", ".fashion-product-related"),
      region("footer", "component", "footer", "footer"),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store-single-product.html",
    viewports: themeViewportIds,
  },
] as const;

type FidelityBehaviorDescriptor = Pick<
  ThemeBehaviorDescriptor,
  "contract" | "fidelityStatesByRegion"
>;

const defaultBehaviorDescriptors: readonly FidelityBehaviorDescriptor[] = [
  {
    contract: fashionStoreBehaviorContract,
    fidelityStatesByRegion: fashionStoreFidelityStatesByRegion,
  },
  ...[
    fashionStoreProductBehaviorContract,
    fashionStoreShopLeftBehaviorContract,
    fashionStoreShopNoneBehaviorContract,
    fashionStoreShopRightBehaviorContract,
  ].map((contract) => ({
    contract,
    fidelityStatesByRegion: fidelityStatesByRegionFromBehaviorContract(contract),
  })),
];

export function assertFidelityMatrixComplete(
  matrix = themeFidelityMatrix,
  behaviorDescriptors: readonly FidelityBehaviorDescriptor[] = defaultBehaviorDescriptors,
): void {
  const issues: string[] = [];
  const routeIds = new Set<FidelityRouteId>();
  const descriptorsByRoute = new Map(
    behaviorDescriptors.map((descriptor) => [descriptor.contract.routeId, descriptor] as const),
  );
  for (const route of matrix) {
    if (routeIds.has(route.id)) issues.push(`${route.id}: duplicate route contract`);
    routeIds.add(route.id);
    if (!route.densities.includes(1) || !route.densities.includes(2)) {
      issues.push(`${route.id}: both DPR 1 and DPR 2 are required`);
    }
    if (!route.viewports.includes("desktop") || !route.viewports.includes("mobile")) {
      issues.push(`${route.id}: desktop and mobile viewports are required`);
    }
    const descriptor = descriptorsByRoute.get(route.id);
    if (!descriptor) issues.push(`${route.id}: behavior descriptor is missing`);
    const regionIds = new Set<string>();
    for (const contractRegion of route.regions) {
      if (regionIds.has(contractRegion.id)) {
        issues.push(`${route.id}/${contractRegion.id}: duplicate region contract`);
      }
      regionIds.add(contractRegion.id);
      if (contractRegion.states.length === 0) {
        issues.push(`${route.id}/${contractRegion.id}: at least one state is required`);
      }
      if (descriptor) {
        const requiredBehaviorStates = descriptor.fidelityStatesByRegion[contractRegion.id] ?? [];
        for (const state of requiredBehaviorStates) {
          if (!contractRegion.states.includes(state))
            issues.push(`${route.id}/${contractRegion.id}: missing behavior state ${state}`);
        }
        const acceptedStates = new Set(["initial", "reduced-motion", ...requiredBehaviorStates]);
        for (const state of contractRegion.states) {
          if (!acceptedStates.has(state))
            issues.push(`${route.id}/${contractRegion.id}: unknown behavior state ${state}`);
        }
      }
    }
    for (const [regionId, states] of Object.entries(descriptor?.fidelityStatesByRegion ?? {})) {
      if (states.length > 0 && !regionIds.has(regionId))
        issues.push(`${route.id}/${regionId}: behavior region is absent from the fidelity matrix`);
    }
    if (!regionIds.has("full-page")) issues.push(`${route.id}: full-page smoke region is required`);
  }
  for (const descriptor of behaviorDescriptors) {
    if (!routeIds.has(descriptor.contract.routeId))
      issues.push(`${descriptor.contract.routeId}: missing route contract`);
  }
  if (issues.length > 0) throw new Error(`Incomplete fidelity matrix:\n${issues.join("\n")}`);
}
