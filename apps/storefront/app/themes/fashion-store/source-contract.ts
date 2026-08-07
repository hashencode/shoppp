export interface FashionStoreSourceRegion {
  inventorySelector?: string;
  itemCount?: number;
  key: string;
  selector: string;
}

export {
  fashionStoreShopLeftSourceContract,
  fashionStoreShopLeftSourceRegions,
  fashionStoreShopNoneSourceContract,
  fashionStoreShopNoneSourceRegions,
  fashionStoreShopRightSourceContract,
  fashionStoreShopRightSourceRegions,
  fashionStoreShopSourcePages,
} from "./contracts/pages/shop";

export const fashionStoreSourceEntries = [
  "demo-fashion-store.html",
  "demo-fashion-store-about.html",
  "demo-fashion-store-account.html",
  "demo-fashion-store-blog-single-creative.html",
  "demo-fashion-store-cart.html",
  "demo-fashion-store-checkout.html",
  "demo-fashion-store-collection.html",
  "demo-fashion-store-contact.html",
  "demo-fashion-store-faq.html",
  "demo-fashion-store-magazine.html",
  "demo-fashion-store-no-sidebar.html",
  "demo-fashion-store-right-sidebar.html",
  "demo-fashion-store-shop.html",
  "demo-fashion-store-single-product.html",
  "demo-fashion-store-wishlist.html",
] as const;

export const fashionStoreShellSourceInventory = {
  conditionalRegions: {
    cookie: fashionStoreSourceEntries,
    scrollProgress: fashionStoreSourceEntries,
    stickySocialRail: ["demo-fashion-store.html"],
  },
  footer: {
    entryCount: 15,
    sha256: "fa45b97142f50e3b2a069f21aa86f4ba0abceed3dcbf05cbcdb6314f64e6a4d9",
  },
  header: {
    commonEntryCount: 14,
    commonSha256: "325a2a59cad2f8cb22353ad2c8ed413fc2d8e5c30fc2fa52e739bce17f7bdc8e",
    exceptions: [
      {
        difference: 'Search input adds source-only aria-label="text".',
        entry: "demo-fashion-store-checkout.html",
        sha256: "3ffb8a42c844a8cf43b3f2f219d9f24ff92c477b768a0711593ef4ea9b618382",
      },
    ],
  },
} as const;

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
