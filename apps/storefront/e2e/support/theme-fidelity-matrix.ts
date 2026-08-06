import type { FidelityViewportId } from "../../../../tools/theme-fidelity-report";
import { themeViewportIds, themeViewports } from "./theme-viewports";

export type FidelityDensity = 1 | 2;
export type FidelityRegionKind = "component" | "control" | "full-page-smoke" | "section";
export type FidelityRouteId =
  | "decor-collection"
  | "decor-home"
  | "decor-product"
  | "fashion-about"
  | "fashion-account"
  | "fashion-article"
  | "fashion-cart"
  | "fashion-checkout"
  | "fashion-collection"
  | "fashion-collection-showcase"
  | "fashion-contact"
  | "fashion-faq"
  | "fashion-home"
  | "fashion-magazine-page"
  | "fashion-no-sidebar"
  | "fashion-product"
  | "fashion-right-sidebar"
  | "fashion-wishlist"
  | "fashion-2-home";

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
  waiverId?: string;
  states: readonly string[];
}

export interface FidelityRouteContract {
  densities: readonly FidelityDensity[];
  id: FidelityRouteId;
  implementationPath: string;
  regions: readonly FidelityRegionContract[];
  sourcePath: string;
  viewports: readonly FidelityMatrixViewportId[];
}

export type FidelityMatrixViewportId = FidelityViewportId;

export const fidelityMatrixViewports = themeViewports satisfies Record<
  FidelityMatrixViewportId,
  { height: number; width: number }
>;

const region = (
  id: string,
  kind: FidelityRegionKind,
  sourceSelector: string,
  implementationSelector: string,
  states: readonly string[] = ["initial"],
  options: Partial<
    Pick<
      FidelityRegionContract,
      | "allowExpectedTopOcclusion"
      | "geometryTolerancePx"
      | "implementationProbeSelector"
      | "imageAssetPolicy"
      | "maxChangedPixelRatio"
      | "neutralizeImagePixels"
      | "normalizeFractionalCaptureHeight"
      | "pixelBudgetReason"
      | "probeRootStyles"
      | "sourceProbeSelector"
      | "styleEquivalences"
      | "waiverId"
    >
  > = {},
): FidelityRegionContract => ({
  ...options,
  geometryTolerancePx:
    options.geometryTolerancePx ?? (kind === "section" || kind === "full-page-smoke" ? 2 : 1),
  id,
  implementationSelector,
  kind,
  maxChangedPixelRatio:
    options.maxChangedPixelRatio ??
    (kind === "control" ? 0.06 : kind === "component" ? 0.004 : kind === "section" ? 0.005 : 0.01),
  sourceSelector,
  states,
});

const standardViewports = themeViewportIds satisfies readonly FidelityMatrixViewportId[];
const homeViewports = standardViewports;
const secondaryViewports = standardViewports;
const productViewports = standardViewports;

const accessibleMediumGrayEquivalences = (implementation: string) =>
  Object.fromEntries(
    [
      "border-color",
      "border-bottom-color",
      "border-left-color",
      "border-right-color",
      "border-top-color",
      "color",
    ].map((property) => [
      property,
      [
        {
          implementation,
          reason: "source-accessibility-contrast-correction" as const,
          reference: "rgb(136, 142, 149)",
        },
      ],
    ]),
  );

const fashionFooterRegion = (): FidelityRegionContract =>
  region("footer", "component", "footer", ".fashion-footer", ["initial"], {
    implementationProbeSelector: ".fashion-footer-top nav a:first-child",
    maxChangedPixelRatio: 0.028,
    pixelBudgetReason: "source-font-antialiasing",
    sourceProbeSelector: "footer .footer-navbar li:first-child a",
  });

const fashionSecondaryRoute = ({
  bodySelector,
  breadcrumbSelector = ".fashion-page-breadcrumb",
  id,
  implementationPath,
  sourceBodySelector = "section:nth-of-type(2)",
  sourcePath,
}: {
  bodySelector: string;
  breadcrumbSelector?: string;
  id: FidelityRouteId;
  implementationPath: string;
  sourceBodySelector?: string;
  sourcePath: string;
}): FidelityRouteContract => ({
  densities: [1, 2],
  id,
  implementationPath,
  regions: [
    region("header", "section", "header", ".fashion-header"),
    region("breadcrumb", "section", "section:nth-of-type(1)", breadcrumbSelector),
    region("page-body", "section", sourceBodySelector, bodySelector, ["initial"], {
      neutralizeImagePixels: true,
    }),
    fashionFooterRegion(),
    region("full-page", "full-page-smoke", "body", "body"),
  ],
  sourcePath,
  viewports: secondaryViewports,
});

const decorFooterRegion = (): FidelityRegionContract =>
  region("footer", "component", "footer", ".decor-footer", ["initial"], {
    imageAssetPolicy: "source-match",
    implementationProbeSelector: ".decor-footer-heading, .decor-legal > p small",
    maxChangedPixelRatio: 0.03,
    neutralizeImagePixels: true,
    pixelBudgetReason: "source-font-antialiasing",
    probeRootStyles: true,
    sourceProbeSelector: "footer span.fs-16.alt-font.fw-500, footer .lh-26.alt-font.d-block",
  });

export const themeFidelityMatrix: readonly FidelityRouteContract[] = [
  {
    densities: [1, 2],
    id: "fashion-home",
    implementationPath: "/",
    regions: [
      region("header", "section", "header", ".fashion-header", [
        "initial",
        "shop-menu-open",
        "collection-menu-open",
        "pages-menu-open",
        "mobile-menu-open",
      ]),
      region("search", "component", ".search-form-wrapper", ".fashion-search-panel", [
        "closed",
        "open",
        "focused",
      ]),
      region("bag", "component", ".cart-item-list", ".fashion-cart-panel", [
        "closed",
        "hover",
        "keyboard-open",
      ]),
      region(
        "hero",
        "component",
        ".swiper.full-screen",
        ".fashion-hero",
        [
          "slide-1-initial",
          "slide-1-midpoint",
          "slide-2-settled",
          "slide-3-settled",
          "autoplay-boundary",
          "reduced-motion",
        ],
        {
          implementationProbeSelector: '.fashion-hero-slide[data-current="true"] h1',
          maxChangedPixelRatio: 0.009,
          pixelBudgetReason: "source-font-antialiasing",
          sourceProbeSelector: ".swiper.full-screen .swiper-slide-active .alt-font.fs-120",
        },
      ),
      region(
        "categories",
        "component",
        "section:nth-of-type(3)",
        ".fashion-categories",
        ["initial"],
        {
          implementationProbeSelector: ".fashion-category-control:first-of-type",
          maxChangedPixelRatio: 0.012,
          pixelBudgetReason: "source-font-antialiasing",
          sourceProbeSelector: "section:nth-of-type(3) .btn.btn-white:first-of-type",
        },
      ),
      region(
        "category-control",
        "control",
        "section:nth-of-type(3) .btn.btn-white",
        ".fashion-category-control",
        ["initial", "hover", "focus"],
      ),
      region("best-seller-products", "section", "section:nth-of-type(4)", "#fashion-bestsellers"),
      region(
        "product-badge",
        "control",
        "section:nth-of-type(4) .lable.new",
        '#fashion-bestsellers .fashion-product-badge[data-kind="new"]',
      ),
      region(
        "promo-band",
        "component",
        "section:nth-of-type(5)",
        ".fashion-promo-band",
        ["initial"],
        {
          geometryTolerancePx: 2,
          implementationProbeSelector: ".fashion-promo-band > span",
          maxChangedPixelRatio: 0.03,
          pixelBudgetReason: "source-font-antialiasing",
          sourceProbeSelector: "section:nth-of-type(5) span.fs-15",
        },
      ),
      region(
        "new-arrival-collection",
        "component",
        "section:nth-of-type(6)",
        "#fashion-collection",
        ["initial", "slide-2", "hover", "focus"],
        {
          implementationProbeSelector: ".fashion-collection-copy h2",
          maxChangedPixelRatio: 0.009,
          pixelBudgetReason: "source-font-antialiasing",
          sourceProbeSelector: "section:nth-of-type(6) h2",
        },
      ),
      region("brands", "section", "section:nth-of-type(7)", ".fashion-brands"),
      region("featured-products", "section", "section:nth-of-type(8)", "#fashion-featured"),
      region(
        "promise-strip",
        "component",
        "section:nth-of-type(9)",
        ".fashion-promises",
        ["initial"],
        {
          implementationProbeSelector: ".fashion-promises-cycle:first-child p:nth-child(2)",
          maxChangedPixelRatio: 0.03,
          pixelBudgetReason: "source-font-antialiasing",
          sourceProbeSelector: "section:nth-of-type(9) .swiper-slide:nth-child(2) > div",
        },
      ),
      region("magazine", "component", "section:nth-of-type(10)", ".fashion-magazine", ["initial"], {
        implementationProbeSelector: ".fashion-magazine h3",
        maxChangedPixelRatio: 0.018,
        neutralizeImagePixels: true,
        pixelBudgetReason: "source-font-antialiasing",
        sourceProbeSelector: "section:nth-of-type(10) .card-title",
      }),
      fashionFooterRegion(),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store.html",
    viewports: homeViewports,
  },
  {
    densities: [1, 2],
    id: "fashion-2-home",
    implementationPath: "/",
    regions: [
      region("header", "section", "header", "header", ["initial", "navigation-open"]),
      region(
        "hero",
        "component",
        ".swiper.full-screen",
        ".swiper.full-screen",
        ["initial", "slide-1", "slide-2", "slide-3", "reduced-motion"],
        {
          implementationProbeSelector: ".fashion-2-hero-slide[data-active=true] .fs-120",
          sourceProbeSelector: ".swiper.full-screen .swiper-slide-active .fs-120",
        },
      ),
      region("categories", "component", "section:nth-of-type(3)", "section:nth-of-type(3)"),
      region("best-sellers", "section", "section:nth-of-type(4)", "section:nth-of-type(4)", [
        "initial",
        "product-hover",
        "product-focus",
      ]),
      region("collection", "section", "section:nth-of-type(6)", "section:nth-of-type(6)", [
        "initial",
        "slide-1",
        "slide-2",
        "slide-3",
        "slide-4",
      ]),
      region("marquee", "component", "section:nth-of-type(9)", "section:nth-of-type(9)", [
        "initial",
        "paused",
      ]),
      region("footer", "component", "footer", "footer", ["initial", "sticky-visible"]),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store.html",
    viewports: homeViewports,
  },
  {
    densities: [1, 2],
    id: "fashion-collection",
    implementationPath: "/collections/women",
    regions: [
      region("header", "section", "header", ".fashion-header"),
      region(
        "breadcrumb",
        "component",
        "section:nth-of-type(1)",
        ".fashion-shop-breadcrumb",
        ["initial"],
        {
          implementationProbeSelector: ".fashion-shop-breadcrumb h1",
          maxChangedPixelRatio: 0.009,
          pixelBudgetReason: "source-font-antialiasing",
          sourceProbeSelector: "section:nth-of-type(1) h1",
        },
      ),
      region(
        "product-grid",
        "component",
        ".shop-modern",
        ".fashion-shop-grid",
        ["initial", "product-hover", "product-focus"],
        {
          imageAssetPolicy: "source-match",
          implementationProbeSelector: ".fashion-shop-grid article:first-child h2 a",
          maxChangedPixelRatio: 0.01,
          neutralizeImagePixels: true,
          pixelBudgetReason: "source-font-antialiasing",
          sourceProbeSelector: ".shop-modern .grid-item:nth-child(2) .shop-footer > a",
        },
      ),
      region(
        "pagination-control",
        "component",
        "div.w-100.d-flex.mt-4.justify-content-center",
        ".fashion-shop-pagination",
        ["initial", "hover", "focus"],
        {
          implementationProbeSelector: ".fashion-shop-pagination button:nth-child(2)",
          maxChangedPixelRatio: 0.007,
          pixelBudgetReason: "source-font-antialiasing",
          sourceProbeSelector: ".pagination-style-01 .page-item:nth-child(2) .page-link",
        },
      ),
      region(
        "filter-panel",
        "component",
        ".shop-sidebar",
        ".fashion-shop-sidebar",
        ["initial", "category-selected", "color-selected", "size-selected"],
        {
          imageAssetPolicy: "implementation-original",
          implementationProbeSelector:
            ".fashion-shop-sidebar > section:first-child li:first-child button",
          maxChangedPixelRatio: 0.036,
          neutralizeImagePixels: true,
          pixelBudgetReason: "dense-source-font-antialiasing",
          sourceProbeSelector: ".shop-sidebar > div:first-child li:first-child a",
        },
      ),
      fashionFooterRegion(),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store-shop.html",
    viewports: secondaryViewports,
  },
  {
    densities: [1, 2],
    id: "fashion-product",
    implementationPath: "/products/textured-sweater",
    regions: [
      region("header", "section", "header", ".fashion-header"),
      region(
        "breadcrumb",
        "component",
        "section:nth-of-type(1)",
        ".fashion-product-breadcrumb",
        ["initial"],
        {
          implementationProbeSelector: ".fashion-product-breadcrumb li:first-child a",
          maxChangedPixelRatio: 0.034,
          pixelBudgetReason: "dense-source-font-antialiasing",
          sourceProbeSelector: "section:nth-of-type(1) li:first-child a",
        },
      ),
      region(
        "gallery",
        "section",
        ".product-image-slider",
        ".fashion-product-gallery-stage",
        ["initial", "thumbnail-2", "lightbox-open"],
        { imageAssetPolicy: "source-match", neutralizeImagePixels: true },
      ),
      region(
        "gallery-thumbnails",
        "section",
        ".product-image-thumb",
        ".fashion-product-thumbs",
        ["initial", "thumbnail-2"],
        { imageAssetPolicy: "source-match", neutralizeImagePixels: true },
      ),
      region("product-info", "component", ".product-info", ".fashion-product-info", ["initial"], {
        implementationProbeSelector: ".fashion-product-price > span",
        maxChangedPixelRatio: 0.026,
        pixelBudgetReason: "source-font-antialiasing",
        sourceProbeSelector: ".product-info .product-price span",
      }),
      region("color-control", "control", ".shop-color", ".fashion-product-color-list", [
        "initial",
        "selected",
        "focus",
      ]),
      region("size-control", "control", ".shop-size", ".fashion-product-size-list", [
        "initial",
        "selected",
        "focus",
      ]),
      region("quantity-control", "control", ".quantity", ".fashion-product-quantity", [
        "initial",
        "incremented",
        "focus",
      ]),
      region(
        "tabs",
        "component",
        "#tab",
        "#fashion-product-tabs",
        ["description", "additional-information", "shipping-and-return", "reviews"],
        {
          implementationProbeSelector: ".fashion-product-description-panel h2",
          maxChangedPixelRatio: 0.014,
          pixelBudgetReason: "source-font-antialiasing",
          sourceProbeSelector: "#tab_five1 h4",
        },
      ),
      region(
        "related-products",
        "component",
        "section:nth-of-type(4)",
        ".fashion-related-products",
        ["initial", "product-hover", "product-focus"],
        {
          imageAssetPolicy: "implementation-original",
          implementationProbeSelector: ".fashion-related-products h2 > span",
          maxChangedPixelRatio: 0.008,
          neutralizeImagePixels: true,
          pixelBudgetReason: "source-font-antialiasing",
          sourceProbeSelector: "section:nth-of-type(4) h2 > span",
        },
      ),
      fashionFooterRegion(),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store-single-product.html",
    viewports: secondaryViewports,
  },
  fashionSecondaryRoute({
    bodySelector: ".fashion-about-page",
    id: "fashion-about",
    implementationPath: "/about",
    sourcePath: "/demo-fashion-store-about.html",
  }),
  fashionSecondaryRoute({
    bodySelector: ".fashion-account-page",
    id: "fashion-account",
    implementationPath: "/account",
    sourcePath: "/demo-fashion-store-account.html",
  }),
  fashionSecondaryRoute({
    bodySelector: ".fashion-article-page",
    id: "fashion-article",
    implementationPath: "/magazine/1",
    sourcePath: "/demo-fashion-store-blog-single-creative.html",
  }),
  fashionSecondaryRoute({
    bodySelector: ".fashion-cart-layout",
    id: "fashion-cart",
    implementationPath: "/cart",
    sourcePath: "/demo-fashion-store-cart.html",
  }),
  fashionSecondaryRoute({
    bodySelector: ".fashion-checkout-layout",
    id: "fashion-checkout",
    implementationPath: "/checkout",
    sourcePath: "/demo-fashion-store-checkout.html",
  }),
  fashionSecondaryRoute({
    bodySelector: ".fashion-collection-page-grid",
    breadcrumbSelector: ".fashion-shop-breadcrumb",
    id: "fashion-collection-showcase",
    implementationPath: "/collections/new-arrivals",
    sourcePath: "/demo-fashion-store-collection.html",
  }),
  fashionSecondaryRoute({
    bodySelector: ".fashion-contact-page",
    id: "fashion-contact",
    implementationPath: "/contact",
    sourcePath: "/demo-fashion-store-contact.html",
  }),
  fashionSecondaryRoute({
    bodySelector: ".fashion-faq-page",
    id: "fashion-faq",
    implementationPath: "/faq",
    sourcePath: "/demo-fashion-store-faq.html",
  }),
  fashionSecondaryRoute({
    bodySelector: ".fashion-magazine-page",
    id: "fashion-magazine-page",
    implementationPath: "/magazine",
    sourcePath: "/demo-fashion-store-magazine.html",
  }),
  fashionSecondaryRoute({
    bodySelector: ".fashion-shop-layout",
    breadcrumbSelector: ".fashion-shop-breadcrumb",
    id: "fashion-no-sidebar",
    implementationPath: "/collections/all?layout=no-sidebar",
    sourcePath: "/demo-fashion-store-no-sidebar.html",
  }),
  fashionSecondaryRoute({
    bodySelector: ".fashion-shop-layout",
    breadcrumbSelector: ".fashion-shop-breadcrumb",
    id: "fashion-right-sidebar",
    implementationPath: "/collections/all?layout=right-sidebar",
    sourcePath: "/demo-fashion-store-right-sidebar.html",
  }),
  fashionSecondaryRoute({
    bodySelector: ".fashion-wishlist-page",
    id: "fashion-wishlist",
    implementationPath: "/wishlist",
    sourcePath: "/demo-fashion-store-wishlist.html",
  }),
  {
    densities: [1, 2],
    id: "decor-home",
    implementationPath: "/",
    regions: [
      region("header", "section", "header", ".decor-header", [
        "initial",
        "navigation-open",
        "language-open",
        "mobile-menu-open",
      ]),
      region(
        "hero",
        "component",
        "#decor-store-slider_wrapper",
        ".decor-hero",
        [
          "slide-1-initial",
          "slide-1-midpoint",
          "slide-2-settled",
          "slide-3-settled",
          "reduced-motion",
        ],
        {
          allowExpectedTopOcclusion: true,
          imageAssetPolicy: "implementation-original",
          implementationProbeSelector: '.decor-hero-slide[data-state="active"] h1',
          maxChangedPixelRatio: 0.01,
          neutralizeImagePixels: true,
          pixelBudgetReason: "source-font-antialiasing",
          sourceProbeSelector: "#slide-1-layer-07",
        },
      ),
      region(
        "categories",
        "component",
        "section:nth-of-type(2)",
        ".decor-categories",
        ["initial", "category-hover", "category-focus"],
        {
          imageAssetPolicy: "source-match",
          implementationProbeSelector: ".decor-category-icons h2",
          neutralizeImagePixels: true,
          sourceProbeSelector: "section:nth-of-type(2) h6",
        },
      ),
      region(
        "product-tabs",
        "component",
        "section:nth-of-type(3)",
        ".decor-products",
        ["best-sellers", "new-arrivals", "product-hover", "product-focus"],
        {
          imageAssetPolicy: "source-match",
          implementationProbeSelector: '.decor-products [role="tab"][aria-selected="true"]',
          neutralizeImagePixels: true,
          sourceProbeSelector: "section:nth-of-type(3) .nav-tabs .nav-link.active",
        },
      ),
      region(
        "marquee",
        "component",
        "section:nth-of-type(4)",
        ".decor-marquee",
        ["initial", "paused"],
        {
          implementationProbeSelector: ".decor-marquee span:nth-child(4)",
          maxChangedPixelRatio: 0.014,
          pixelBudgetReason: "source-font-antialiasing",
          sourceProbeSelector:
            'section:nth-of-type(4) .swiper-slide[data-swiper-slide-index="0"] .fs-50',
        },
      ),
      region(
        "collection",
        "component",
        "section:nth-of-type(5)",
        ".decor-collection",
        ["slide-1", "slide-2", "slide-3", "hover", "focus"],
        {
          imageAssetPolicy: "implementation-original",
          implementationProbeSelector:
            '.decor-collection-banner h2, .decor-collection-banner a, .decor-collection-product article[data-state="active"] h3 span, .decor-collection-product article[data-state="active"] .decor-collection-price',
          neutralizeImagePixels: true,
          sourceProbeSelector:
            "section:nth-of-type(5) h1, section:nth-of-type(5) .row > div:first-child a.btn, section:nth-of-type(5) .swiper-slide-active a.fs-20, section:nth-of-type(5) .swiper-slide-active .d-inline-block.align-middle.fs-18",
        },
      ),
      region(
        "clients",
        "component",
        "section:nth-of-type(6)",
        ".decor-clients",
        ["initial", "paused"],
        {
          imageAssetPolicy: "source-match",
          implementationProbeSelector: ".decor-clients [data-fidelity-client]",
          maxChangedPixelRatio: 0.015,
          neutralizeImagePixels: true,
          pixelBudgetReason: "source-image-subpixel-rasterization",
          sourceProbeSelector: "section:nth-of-type(6) [data-fidelity-client]",
        },
      ),
      region("journal", "component", "section:nth-of-type(7)", ".decor-journal", ["initial"], {
        imageAssetPolicy: "source-match",
        implementationProbeSelector:
          ".decor-journal h2, .decor-journal article small strong, .decor-journal article small span",
        maxChangedPixelRatio: 0.01,
        neutralizeImagePixels: true,
        pixelBudgetReason: "source-accessibility-contrast-correction",
        sourceProbeSelector:
          "section:nth-of-type(7) h4, section:nth-of-type(7) .categories-text, section:nth-of-type(7) .blog-date",
        styleEquivalences: accessibleMediumGrayEquivalences("rgb(105, 115, 123)"),
        waiverId: "decor-home-journal-accessible-contrast",
      }),
      region("services", "component", "section:nth-of-type(8)", ".decor-services", ["initial"], {
        imageAssetPolicy: "source-match",
        implementationProbeSelector: ".decor-service-detail",
        maxChangedPixelRatio: 0.041,
        neutralizeImagePixels: true,
        pixelBudgetReason: "source-accessibility-contrast-correction",
        sourceProbeSelector: "section:nth-of-type(8) .feature-box-content > span:last-child",
        styleEquivalences: accessibleMediumGrayEquivalences("rgb(113, 117, 128)"),
        waiverId: "decor-home-services-accessible-contrast",
      }),
      region("footer", "component", "footer", ".decor-footer", ["initial"], {
        imageAssetPolicy: "source-match",
        implementationProbeSelector: ".decor-footer-heading, .decor-legal > p small",
        maxChangedPixelRatio: 0.03,
        neutralizeImagePixels: true,
        pixelBudgetReason: "source-font-antialiasing",
        probeRootStyles: true,
        sourceProbeSelector: "footer span.fs-16.alt-font.fw-500, footer .lh-26.alt-font.d-block",
      }),
      region("full-page", "full-page-smoke", "body", ".decor-theme-page"),
    ],
    sourcePath: "/demo-decor-store.html",
    viewports: homeViewports,
  },
  {
    densities: [1, 2],
    id: "decor-collection",
    implementationPath: "/collections/all",
    regions: [
      region("header", "section", "header", ".decor-header", [
        "initial",
        "navigation-open",
        "language-open",
        "mobile-menu-open",
      ]),
      region("title", "section", "section:nth-of-type(1)", ".decor-shop-title", ["initial"], {
        allowExpectedTopOcclusion: true,
        implementationProbeSelector: ".decor-shop-title h1",
        sourceProbeSelector: "section:nth-of-type(1) h1",
      }),
      region(
        "toolbar",
        "control",
        ".toolbar-wrapper",
        ".decor-shop-toolbar",
        ["initial", "sort-open"],
        {
          imageAssetPolicy: "implementation-original",
          implementationProbeSelector: ".decor-shop-toolbar > span, .decor-shop-toolbar select",
          neutralizeImagePixels: true,
          sourceProbeSelector: ".toolbar-wrapper > div:nth-child(2), .toolbar-wrapper select",
        },
      ),
      region(
        "product-grid",
        "component",
        ".shop-wrapper",
        ".decor-shop-grid",
        ["initial", "product-hover", "product-focus"],
        {
          imageAssetPolicy: "implementation-original",
          implementationProbeSelector: ".decor-shop-grid > article:first-child h2 a",
          maxChangedPixelRatio: 0.012,
          neutralizeImagePixels: true,
          pixelBudgetReason: "source-image-subpixel-rasterization",
          sourceProbeSelector: ".shop-wrapper > .grid-item:nth-of-type(2) .shop-footer > a",
        },
      ),
      region(
        "pagination",
        "control",
        ".shop-wrapper + .w-100",
        ".decor-shop-pagination",
        ["initial"],
        {
          implementationProbeSelector: ".decor-shop-pagination button:nth-child(2)",
          sourceProbeSelector: ".shop-wrapper + .w-100 li:nth-child(2) a",
        },
      ),
      region(
        "sidebar",
        "component",
        ".shop-sidebar",
        ".decor-shop-sidebar",
        ["initial", "filter-selected", "arrival-next"],
        {
          imageAssetPolicy: "implementation-original",
          implementationProbeSelector:
            ".decor-shop-sidebar > section:first-child h2, .decor-shop-sidebar > section:nth-child(3) li:first-child, .decor-shop-arrivals article:first-of-type p a, .decor-shop-tags a:first-of-type",
          maxChangedPixelRatio: 0.04,
          neutralizeImagePixels: true,
          pixelBudgetReason: "dense-source-font-antialiasing",
          sourceProbeSelector:
            ".shop-sidebar > div:first-child > span, .shop-sidebar .fabric-filter li:first-child, .shop-sidebar .slider-one-slide .swiper-slide:first-child .new-arribals > div:first-child > .col > a, .shop-sidebar .tag-cloud a:first-child",
        },
      ),
      decorFooterRegion(),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-decor-store-shop.html",
    viewports: secondaryViewports,
  },
  {
    densities: [1, 2],
    id: "decor-product",
    implementationPath: "/products/table-clock",
    regions: [
      region("header", "section", "header", ".decor-header", [
        "initial",
        "navigation-open",
        "language-open",
        "mobile-menu-open",
      ]),
      region(
        "breadcrumb",
        "component",
        "section:nth-of-type(1)",
        ".decor-product-breadcrumb",
        ["initial"],
        {
          implementationProbeSelector:
            ".decor-product-breadcrumb li:nth-child(1) a, .decor-product-breadcrumb li:nth-child(2) a, .decor-product-breadcrumb li:nth-child(3)",
          maxChangedPixelRatio: 0.02,
          pixelBudgetReason: "source-font-antialiasing",
          sourceProbeSelector:
            "section:nth-of-type(1) .breadcrumb li:nth-child(1) a, section:nth-of-type(1) .breadcrumb li:nth-child(2) a, section:nth-of-type(1) .breadcrumb li:nth-child(3)",
        },
      ),
      region(
        "gallery",
        "component",
        ".product-image-slider",
        ".decor-product-gallery-stage",
        ["initial", "next", "previous", "lightbox-open"],
        {
          imageAssetPolicy: "implementation-original",
          implementationProbeSelector: ".decor-product-primary-image",
          neutralizeImagePixels: true,
          sourceProbeSelector: ".product-image-slider .swiper-slide:first-child img",
        },
      ),
      region(
        "thumbnails",
        "control",
        ".product-image-thumb",
        ".decor-product-thumbs",
        ["initial", "selected"],
        {
          imageAssetPolicy: "implementation-original",
          implementationProbeSelector: ".decor-product-thumbs button:first-child img",
          neutralizeImagePixels: true,
          sourceProbeSelector: ".product-image-thumb .swiper-slide:first-child img",
        },
      ),
      region("product-info", "component", ".product-info", ".decor-product-info", ["initial"], {
        implementationProbeSelector:
          ".decor-product-vendor, .decor-product-info h1, .decor-product-description, .decor-product-meta > a, .decor-product-colors > .decor-product-option-label",
        maxChangedPixelRatio: 0.005,
        normalizeFractionalCaptureHeight: true,
        pixelBudgetReason: "source-font-antialiasing",
        sourceProbeSelector:
          ".product-info > span, .product-info > h5, .product-info > p, .product-info > .d-block.d-sm-flex > a, .product-info > .d-flex.align-items-center.mb-35px > label",
      }),
      region(
        "color",
        "control",
        ".product-info > .d-flex.align-items-center.mb-35px",
        ".decor-product-colors",
        ["initial", "selected"],
        {
          implementationProbeSelector: ".decor-product-colors label:first-of-type > span",
          sourceProbeSelector: ".shop-color li:first-child label span",
        },
      ),
      region(
        "quantity",
        "control",
        ".product-info > .d-flex.align-items-center.flex-column",
        ".decor-product-purchase",
        ["initial", "incremented", "decremented"],
        {
          implementationProbeSelector: ".decor-product-quantity input",
          sourceProbeSelector: ".qty-text",
        },
      ),
      region(
        "tabs",
        "component",
        "#tab_five1",
        ".decor-product-description-panel",
        ["description", "additional-information", "shipping-and-return", "reviews"],
        {
          imageAssetPolicy: "implementation-original",
          implementationProbeSelector: ".decor-product-description-panel h2",
          maxChangedPixelRatio: 0.02,
          neutralizeImagePixels: true,
          pixelBudgetReason: "source-image-subpixel-rasterization",
          sourceProbeSelector: "#tab_five1 h4",
        },
      ),
      region(
        "related-products",
        "component",
        "section:nth-of-type(4) > .container",
        ".decor-related-container",
        ["initial", "product-hover", "product-focus"],
        {
          imageAssetPolicy: "implementation-original",
          implementationProbeSelector: ".decor-related-products h2",
          maxChangedPixelRatio: 0.02,
          neutralizeImagePixels: true,
          pixelBudgetReason: "source-image-subpixel-rasterization",
          sourceProbeSelector: "section:nth-of-type(4) h4",
        },
      ),
      decorFooterRegion(),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-decor-store-single-product.html",
    viewports: productViewports,
  },
] as const;

export function assertFidelityMatrixComplete(matrix = themeFidelityMatrix): void {
  const issues: string[] = [];
  const routeIds = new Set<FidelityRouteId>();
  for (const route of matrix) {
    if (routeIds.has(route.id)) issues.push(`${route.id}: duplicate route contract`);
    routeIds.add(route.id);
    if (!route.densities.includes(1) || !route.densities.includes(2)) {
      issues.push(`${route.id}: both DPR 1 and DPR 2 are required`);
    }
    if (!route.viewports.includes("desktop") || !route.viewports.includes("mobile")) {
      issues.push(`${route.id}: desktop and mobile viewports are required`);
    }
    const regionIds = new Set<string>();
    for (const contractRegion of route.regions) {
      if (regionIds.has(contractRegion.id)) {
        issues.push(`${route.id}/${contractRegion.id}: duplicate region contract`);
      }
      regionIds.add(contractRegion.id);
      if (contractRegion.states.length === 0) {
        issues.push(`${route.id}/${contractRegion.id}: at least one state is required`);
      }
      if (
        contractRegion.imageAssetPolicy === "implementation-original" &&
        !contractRegion.neutralizeImagePixels
      ) {
        issues.push(
          `${route.id}/${contractRegion.id}: implementation-original assets require neutralized layout comparison`,
        );
      }
      const hasAuditedRasterBudget =
        contractRegion.kind === "component" &&
        Boolean(contractRegion.pixelBudgetReason) &&
        Boolean(contractRegion.sourceProbeSelector) &&
        Boolean(contractRegion.implementationProbeSelector);
      const maximumRegionalRatio =
        contractRegion.kind === "control"
          ? 0.06
          : hasAuditedRasterBudget
            ? contractRegion.pixelBudgetReason === "dense-source-font-antialiasing"
              ? 0.04
              : contractRegion.pixelBudgetReason === "source-accessibility-contrast-correction"
                ? 0.045
                : contractRegion.pixelBudgetReason === "source-image-subpixel-rasterization"
                  ? 0.02
                  : 0.03
            : 0.005;
      if (
        contractRegion.kind !== "full-page-smoke" &&
        contractRegion.maxChangedPixelRatio > maximumRegionalRatio
      ) {
        issues.push(`${route.id}/${contractRegion.id}: regional pixel gate exceeds 0.5%`);
      }
    }
    if (!regionIds.has("full-page")) issues.push(`${route.id}: full-page smoke region is required`);
  }
  for (const id of [
    "fashion-home",
    "fashion-2-home",
    "fashion-collection",
    "fashion-product",
    "decor-home",
    "decor-collection",
    "decor-product",
  ] as const) {
    if (!routeIds.has(id)) issues.push(`${id}: missing route contract`);
  }
  if (issues.length > 0) throw new Error(`Incomplete fidelity matrix:\n${issues.join("\n")}`);
}
