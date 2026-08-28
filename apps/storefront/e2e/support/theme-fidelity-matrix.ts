import type { FidelityViewportId } from "../../../../tools/theme-fidelity-report";
import {
  decorBehaviorContract,
  decorFidelityStatesByRegion,
} from "../../app/themes/decor/behavior-contract";
import {
  decorStoreAboutBehaviorContract,
  decorStoreAccountBehaviorContract,
  decorStoreArticleBehaviorContract,
  decorStoreBehaviorContract,
  decorStoreBlogBehaviorContract,
  decorStoreCartBehaviorContract,
  decorStoreCheckoutBehaviorContract,
  decorStoreCollectionBehaviorContract,
  decorStoreContactBehaviorContract,
  decorStoreFaqBehaviorContract,
  decorStoreFidelityStatesByRegion,
  decorStoreProductBehaviorContract,
  decorStoreShopLeftBehaviorContract,
  decorStoreShopNoneBehaviorContract,
  decorStoreShopRightBehaviorContract,
  decorStoreWishlistBehaviorContract,
} from "../../app/themes/decor-store/behavior-contract";
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
import { fashionStoreCartBehaviorContract } from "../../app/themes/fashion-store/contracts/pages/cart";
import { fashionStoreCheckoutBehaviorContract } from "../../app/themes/fashion-store/contracts/pages/checkout";
import { fashionStoreCollectionBehaviorContract } from "../../app/themes/fashion-store/contracts/pages/collection";
import { fashionStoreAccountBehaviorContract } from "../../app/themes/fashion-store/contracts/pages/account";
import { fashionStoreWishlistBehaviorContract } from "../../app/themes/fashion-store/contracts/pages/wishlist";
import { fashionStoreArticleBehaviorContract } from "../../app/themes/fashion-store/contracts/pages/article";
import { fashionStoreAboutBehaviorContract } from "../../app/themes/fashion-store/contracts/pages/about";
import { fashionStoreContactBehaviorContract } from "../../app/themes/fashion-store/contracts/pages/contact";
import { fashionStoreFaqBehaviorContract } from "../../app/themes/fashion-store/contracts/pages/faq";
import { fashionStoreMagazineBehaviorContract } from "../../app/themes/fashion-store/contracts/pages/magazine";
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

const decorStates = (regionId: string, defaults: readonly string[] = ["initial"]) => [
  ...defaults,
  ...(decorFidelityStatesByRegion[regionId] ?? []),
];

const decorStoreStates = (regionId: string, defaults: readonly string[] = ["initial"]) => [
  ...defaults,
  ...(decorStoreFidelityStatesByRegion[regionId] ?? []),
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
    id: "decor-store-home",
    implementationPath: "/",
    regions: [
      region("header", "section", "header", "header", decorStoreStates("header")),
      region(
        "hero",
        "component",
        "#decor-store-slider",
        "#decor-store-slider",
        decorStoreStates("hero", ["initial", "reduced-motion"]),
      ),
      region(
        "featured-categories",
        "section",
        "body > section:nth-of-type(2)",
        "[data-decor-region='featured-categories']",
      ),
      region(
        "products",
        "section",
        "body > section:nth-of-type(3)",
        "[data-decor-region='products']",
        decorStoreStates("products"),
      ),
      region(
        "promotional-marquee",
        "component",
        "body > section:nth-of-type(4)",
        "[data-decor-region='promotional-marquee']",
        decorStoreStates("promotional-marquee"),
      ),
      region(
        "collection-carousel",
        "component",
        "body > section:nth-of-type(5)",
        "[data-decor-region='collection-carousel']",
        decorStoreStates("collection-carousel"),
      ),
      region(
        "client-marquee",
        "component",
        "body > section:nth-of-type(6)",
        "[data-decor-region='client-marquee']",
        decorStoreStates("client-marquee"),
      ),
      region(
        "journal",
        "section",
        "body > section:nth-of-type(7)",
        "[data-decor-region='journal']",
      ),
      region(
        "services",
        "section",
        "body > section:nth-of-type(8)",
        "[data-decor-region='services']",
      ),
      region("footer", "component", "footer", "footer"),
      region("cookie", "control", ".cookie-message", ".cookie-message", decorStoreStates("cookie")),
      region("sticky", "control", ".sticky-wrap", ".sticky-wrap", decorStoreStates("sticky")),
      region(
        "scroll-progress",
        "control",
        ".scroll-progress",
        ".scroll-progress",
        decorStoreStates("scroll-progress"),
      ),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-decor-store.html",
    viewports: themeViewportIds,
  },
  ...(
    [
      [decorStoreShopLeftBehaviorContract, "shop-left", "/shop", "/demo-decor-store-shop.html"],
      [
        decorStoreShopNoneBehaviorContract,
        "shop-none",
        "/shop/no-sidebar",
        "/demo-decor-store-no-sidebar.html",
      ],
      [
        decorStoreShopRightBehaviorContract,
        "shop-right",
        "/shop/right-sidebar",
        "/demo-decor-store-right-sidebar.html",
      ],
      [
        decorStoreCollectionBehaviorContract,
        "collection",
        "/collections",
        "/demo-decor-store-collections.html",
      ],
      [
        decorStoreProductBehaviorContract,
        "product",
        "/products/minimalist-wooden-chair",
        "/demo-decor-store-single-product.html",
      ],
      [
        decorStoreWishlistBehaviorContract,
        "wishlist",
        "/wishlist",
        "/demo-decor-store-wishlist.html",
      ],
      [decorStoreCartBehaviorContract, "cart", "/cart", "/demo-decor-store-cart.html"],
      [
        decorStoreCheckoutBehaviorContract,
        "checkout",
        "/checkout",
        "/demo-decor-store-checkout.html",
      ],
      [decorStoreAccountBehaviorContract, "account", "/account", "/demo-decor-store-account.html"],
      [decorStoreBlogBehaviorContract, "blog", "/blog", "/demo-decor-store-blog.html"],
      [
        decorStoreArticleBehaviorContract,
        "article",
        "/blog/best-influencers-for-decor-inspiration",
        "/demo-decor-store-blog-single-classic.html",
      ],
      [decorStoreAboutBehaviorContract, "about", "/about", "/demo-decor-store-about.html"],
      [decorStoreFaqBehaviorContract, "faq", "/faq", "/demo-decor-store-faq.html"],
      [decorStoreContactBehaviorContract, "contact", "/contact", "/demo-decor-store-contact.html"],
    ] as const
  ).map(([behavior, id, implementationPath, sourcePath]) => ({
    densities: [1, 2] as const,
    id: `decor-store-${id}`,
    implementationPath,
    regions: [
      {
        ...region("page", "section", "body", "body", shopStates(behavior, "page")),
        imageAssetPolicy: "implementation-original" as const,
        neutralizeImagePixels: true,
      },
      {
        ...region("full-page", "full-page-smoke", "body", "body"),
        imageAssetPolicy: "implementation-original" as const,
        neutralizeImagePixels: true,
      },
    ],
    sourcePath,
    viewports: themeViewportIds,
  })),
  {
    densities: [1, 2] as const,
    id: "decor-home",
    implementationPath: "/",
    regions: [
      region("header", "section", "header", ".decor-header"),
      region(
        "hero",
        "component",
        "#decor-store-slider",
        ".decor-hero",
        decorStates("hero", ["initial", "reduced-motion"]),
      ),
      region(
        "categories",
        "section",
        "section:nth-of-type(2)",
        ".decor-categories",
        decorStates("categories"),
      ),
      region(
        "marquee",
        "component",
        "section:nth-of-type(4)",
        ".decor-marquee",
        decorStates("marquee"),
      ),
      region(
        "collection",
        "section",
        "section:nth-of-type(5)",
        ".decor-collection",
        decorStates("collection"),
      ),
      region(
        "clients",
        "component",
        "section:nth-of-type(6)",
        ".decor-clients",
        decorStates("clients"),
      ),
      region("footer", "component", "footer", ".decor-footer"),
      region(
        "scroll-progress",
        "control",
        ".scroll-progress",
        ".decor-scroll-progress",
        decorStates("scroll-progress"),
      ),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-decor-store.html",
    viewports: themeViewportIds,
  },
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
    id: "fashion-store-collection",
    implementationPath: "/collections",
    regions: [
      region("header", "section", "header", "header"),
      region("page-title", "component", "section:nth-of-type(1)", "section:nth-of-type(1)"),
      region(
        "category-grid",
        "section",
        "section:nth-of-type(2) .row",
        ".fashion-collection-grid",
        shopStates(fashionStoreCollectionBehaviorContract, "category-grid"),
      ),
      region("footer", "component", "footer", "footer"),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store-collection.html",
    viewports: themeViewportIds,
  },
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
  {
    densities: [1, 2] as const,
    id: "fashion-store-cart",
    implementationPath: "/cart",
    regions: [
      region("header", "section", "header", "header"),
      region("breadcrumb", "component", "section:nth-of-type(1)", "section:nth-of-type(1)"),
      region(
        "cart-lines",
        "section",
        ".cart-products",
        ".cart-products",
        shopStates(fashionStoreCartBehaviorContract, "cart-lines"),
      ),
      region(
        "cart-controls",
        "control",
        "section:nth-of-type(2) .row.mt-20px",
        "section:nth-of-type(2) .row.mt-20px",
      ),
      region(
        "cart-totals",
        "section",
        ".total-price-table",
        ".total-price-table",
        shopStates(fashionStoreCartBehaviorContract, "cart-totals"),
      ),
      region("footer", "component", "footer", "footer"),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store-cart.html",
    viewports: themeViewportIds,
  },
  {
    densities: [1, 2] as const,
    id: "fashion-store-checkout",
    implementationPath: "/checkout",
    regions: [
      region("header", "section", "header", "header"),
      region("breadcrumb", "component", "section:nth-of-type(1)", "section:nth-of-type(1)"),
      region(
        "helper-controls",
        "control",
        "section:nth-of-type(2) > .container > .row.justify-content-center",
        ".fashion-checkout-helpers",
      ),
      region(
        "billing",
        "section",
        "section:nth-of-type(2) .col-lg-7",
        ".fashion-checkout-billing",
        shopStates(fashionStoreCheckoutBehaviorContract, "billing"),
      ),
      region(
        "order-summary",
        "section",
        ".your-order-box",
        ".your-order-box",
        shopStates(fashionStoreCheckoutBehaviorContract, "order-summary"),
      ),
      region(
        "payment",
        "control",
        ".your-order-box .checkout-accordion",
        ".your-order-box .checkout-accordion",
        shopStates(fashionStoreCheckoutBehaviorContract, "payment"),
      ),
      region("footer", "component", "footer", "footer"),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store-checkout.html",
    viewports: themeViewportIds,
  },
  {
    densities: [1, 2] as const,
    id: "fashion-store-wishlist",
    implementationPath: "/wishlist",
    regions: [
      region("header", "section", "header", "header"),
      region("page-title", "component", "section:nth-of-type(1)", "section:nth-of-type(1)"),
      region(
        "products",
        "section",
        "section:nth-of-type(2) .shop-modern",
        ".fashion-wishlist-grid",
        shopStates(fashionStoreWishlistBehaviorContract, "products"),
      ),
      region("footer", "component", "footer", "footer"),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store-wishlist.html",
    viewports: themeViewportIds,
  },
  {
    densities: [1, 2] as const,
    id: "fashion-store-account",
    implementationPath: "/account",
    regions: [
      region("header", "section", "header", "header"),
      region("page-title", "component", "section:nth-of-type(1)", "section:nth-of-type(1)"),
      region(
        "login",
        "section",
        "section:nth-of-type(2) .contact-form-style-04",
        ".contact-form-style-04",
        shopStates(fashionStoreAccountBehaviorContract, "login"),
      ),
      region(
        "register",
        "section",
        "section:nth-of-type(2) .box-shadow-extra-large",
        ".fashion-account-register-panel",
        shopStates(fashionStoreAccountBehaviorContract, "register"),
      ),
      region("footer", "component", "footer", "footer"),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store-account.html",
    viewports: themeViewportIds,
  },
  {
    densities: [1, 2] as const,
    id: "fashion-store-magazine",
    implementationPath: "/magazine",
    regions: [
      region("header", "section", "header", "header"),
      region("page-title", "component", "section:nth-of-type(1)", "section:nth-of-type(1)"),
      region(
        "posts",
        "section",
        "section:nth-of-type(2) .blog-classic",
        ".fashion-magazine-grid",
        shopStates(fashionStoreMagazineBehaviorContract, "posts"),
      ),
      region(
        "pagination",
        "control",
        "section:nth-of-type(2) .pagination",
        ".fashion-magazine-pagination",
        shopStates(fashionStoreMagazineBehaviorContract, "pagination"),
      ),
      region("footer", "component", "footer", "footer"),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store-magazine.html",
    viewports: themeViewportIds,
  },
  {
    densities: [1, 2] as const,
    id: "fashion-store-article",
    implementationPath: "/magazine/marketing-tips-and-tricks",
    regions: [
      region("header", "section", "header", "header"),
      region("article-title", "component", "section:nth-of-type(1)", "section:nth-of-type(1)"),
      region(
        "article-media",
        "section",
        "section:nth-of-type(2)",
        ".fashion-article-media:not(.fashion-article-media-secondary)",
      ),
      region("article-body", "section", "section:nth-of-type(3)", ".fashion-article-body"),
      region("article-quote", "section", "section:nth-of-type(5)", ".fashion-article-quote"),
      region(
        "article-conclusion",
        "section",
        "section:nth-of-type(7)",
        ".fashion-article-conclusion",
      ),
      region(
        "author-share",
        "section",
        "section.half-section.pt-0",
        ".fashion-article-author-share",
        shopStates(fashionStoreArticleBehaviorContract, "author-share"),
      ),
      region(
        "related",
        "section",
        "section.bg-very-light-gray",
        ".fashion-article-related",
        shopStates(fashionStoreArticleBehaviorContract, "related"),
      ),
      region("comments", "section", ".blog-comment", ".fashion-article-comments .blog-comment"),
      region(
        "comment-form",
        "control",
        "#comments form",
        ".fashion-article-comment-form form",
        shopStates(fashionStoreArticleBehaviorContract, "comment-form"),
      ),
      region("footer", "component", "footer", "footer"),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store-blog-single-creative.html",
    viewports: themeViewportIds,
  },
  {
    densities: [1, 2] as const,
    id: "fashion-store-about",
    implementationPath: "/about",
    regions: [
      region("header", "section", "header", "header"),
      region("page-title", "component", "section:nth-of-type(1)", "section:nth-of-type(1)"),
      region("hero", "section", "section:nth-of-type(2)", ".fashion-about-hero"),
      region("story", "section", "section:nth-of-type(3)", ".fashion-about-story"),
      region(
        "carousel",
        "section",
        "section:nth-of-type(4)",
        ".fashion-about-carousel-section",
        shopStates(fashionStoreAboutBehaviorContract, "carousel"),
      ),
      region("timeline", "section", "section:nth-of-type(5)", ".fashion-about-timeline"),
      region(
        "mission",
        "section",
        "section:nth-of-type(6)",
        ".fashion-about-mission",
        shopStates(fashionStoreAboutBehaviorContract, "mission"),
      ),
      region("footer", "component", "footer", "footer"),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store-about.html",
    viewports: themeViewportIds,
  },
  {
    densities: [1, 2] as const,
    id: "fashion-store-faq",
    implementationPath: "/faq",
    regions: [
      region("header", "section", "header", "header"),
      region("page-title", "component", "section:nth-of-type(1)", "section:nth-of-type(1)"),
      region(
        "categories",
        "control",
        "section:nth-of-type(2) .nav-tabs",
        ".fashion-faq-content [role='tablist']",
        shopStates(fashionStoreFaqBehaviorContract, "categories"),
      ),
      region(
        "questions",
        "section",
        "section:nth-of-type(2) .tab-content",
        ".fashion-faq-content .tab-content",
        shopStates(fashionStoreFaqBehaviorContract, "questions"),
      ),
      region("footer", "component", "footer", "footer"),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store-faq.html",
    viewports: themeViewportIds,
  },
  {
    densities: [1, 2] as const,
    id: "fashion-store-contact",
    implementationPath: "/contact",
    regions: [
      region("header", "section", "header", "header"),
      region("page-title", "component", "section:nth-of-type(1)", "section:nth-of-type(1)"),
      region("locations", "section", "section:nth-of-type(2)", ".fashion-contact-locations"),
      region(
        "map",
        "component",
        "section:nth-of-type(2) .outside-box-right-30",
        ".fashion-contact-map",
        shopStates(fashionStoreContactBehaviorContract, "map"),
      ),
      region("parallax", "section", "section:nth-of-type(3)", ".fashion-contact-parallax"),
      region(
        "form",
        "control",
        "section:nth-of-type(4) form",
        ".fashion-contact-form form",
        shopStates(fashionStoreContactBehaviorContract, "form"),
      ),
      region("footer", "component", "footer", "footer"),
      region("full-page", "full-page-smoke", "body", "body"),
    ],
    sourcePath: "/demo-fashion-store-contact.html",
    viewports: themeViewportIds,
  },
] as const;

type FidelityBehaviorDescriptor = Pick<
  ThemeBehaviorDescriptor,
  "contract" | "fidelityStatesByRegion"
>;

const defaultBehaviorDescriptors: readonly FidelityBehaviorDescriptor[] = [
  {
    contract: decorBehaviorContract,
    fidelityStatesByRegion: decorFidelityStatesByRegion,
  },
  {
    contract: decorStoreBehaviorContract,
    fidelityStatesByRegion: decorStoreFidelityStatesByRegion,
  },
  {
    contract: fashionStoreBehaviorContract,
    fidelityStatesByRegion: fashionStoreFidelityStatesByRegion,
  },
  ...[
    decorStoreAboutBehaviorContract,
    decorStoreAccountBehaviorContract,
    decorStoreArticleBehaviorContract,
    decorStoreBlogBehaviorContract,
    decorStoreCartBehaviorContract,
    decorStoreCheckoutBehaviorContract,
    decorStoreCollectionBehaviorContract,
    decorStoreContactBehaviorContract,
    decorStoreFaqBehaviorContract,
    decorStoreProductBehaviorContract,
    decorStoreShopLeftBehaviorContract,
    decorStoreShopNoneBehaviorContract,
    decorStoreShopRightBehaviorContract,
    decorStoreWishlistBehaviorContract,
    fashionStoreCartBehaviorContract,
    fashionStoreAboutBehaviorContract,
    fashionStoreAccountBehaviorContract,
    fashionStoreArticleBehaviorContract,
    fashionStoreContactBehaviorContract,
    fashionStoreFaqBehaviorContract,
    fashionStoreCheckoutBehaviorContract,
    fashionStoreCollectionBehaviorContract,
    fashionStoreProductBehaviorContract,
    fashionStoreMagazineBehaviorContract,
    fashionStoreShopLeftBehaviorContract,
    fashionStoreShopNoneBehaviorContract,
    fashionStoreShopRightBehaviorContract,
    fashionStoreWishlistBehaviorContract,
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
