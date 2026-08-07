export interface FashionStoreSourceRegion {
  inventorySelector?: string;
  itemCount?: number;
  key: string;
  selector: string;
}

export const fashionStoreSourceRegions = [
  { inventorySelector: "header", key: "header", selector: "header.header-with-topbar" },
  {
    inventorySelector: "section:nth-of-type(1)",
    itemCount: 3,
    key: "hero",
    selector: "section:nth-of-type(1) .swiper-slide",
  },
  {
    inventorySelector: "section:nth-of-type(2)",
    itemCount: 4,
    key: "services",
    selector: "section:nth-of-type(2) .feature-box",
  },
  {
    inventorySelector: "section:nth-of-type(3)",
    itemCount: 4,
    key: "categories",
    selector: "section:nth-of-type(3) .categories-style-02",
  },
  {
    inventorySelector: "section:nth-of-type(4)",
    itemCount: 10,
    key: "best-sellers",
    selector: "section:nth-of-type(4) .grid-item",
  },
  { inventorySelector: "section:nth-of-type(5)", key: "promo", selector: "section:nth-of-type(5)" },
  {
    inventorySelector: "section:nth-of-type(6)",
    itemCount: 8,
    key: "collection",
    selector: "section:nth-of-type(6) .swiper-slide",
  },
  {
    inventorySelector: "section:nth-of-type(7)",
    itemCount: 5,
    key: "brands",
    selector: "section:nth-of-type(7) .col",
  },
  {
    inventorySelector: "section:nth-of-type(8)",
    itemCount: 5,
    key: "featured-products",
    selector: "section:nth-of-type(8) .grid-item",
  },
  {
    inventorySelector: "section:nth-of-type(9)",
    itemCount: 8,
    key: "marquee",
    selector: "section:nth-of-type(9) .swiper-slide",
  },
  {
    inventorySelector: "section:nth-of-type(10)",
    itemCount: 4,
    key: "magazine",
    selector: "section:nth-of-type(10) .grid-item",
  },
  { key: "footer", selector: "footer.footer-dark" },
  { key: "cookie", selector: ".cookie-message" },
  { key: "sticky", selector: ".sticky-wrap" },
  { key: "scroll-progress", selector: ".scroll-progress" },
] as const satisfies readonly FashionStoreSourceRegion[];

export const fashionStoreSourceRegionOrder = fashionStoreSourceRegions.map(({ key }) => key);

export const fashionStoreSourceContract = {
  behaviorContractPath: "./behavior-contract.ts",
  bodyMobileNavigationStyle: "classic",
  homeSectionCount: 10,
  htmlClassAfterHydration: "js",
  regionOrder: fashionStoreSourceRegionOrder,
  stylesheetOrder: [
    "css/vendors.min.css",
    "css/icon.min.css",
    "css/style.css",
    "css/responsive.css",
    "demos/fashion-store/fashion-store.css",
  ],
} as const;
