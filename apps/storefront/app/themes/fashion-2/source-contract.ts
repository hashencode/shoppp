export interface Fashion2SourceRegion {
  itemCount?: number;
  key: string;
  selector: string;
}

export const fashion2SourceRegions = [
  { key: "header", selector: "header.header-with-topbar" },
  { itemCount: 3, key: "hero", selector: "section:nth-of-type(1) .swiper-slide" },
  { itemCount: 4, key: "services", selector: "section:nth-of-type(2) .feature-box" },
  { itemCount: 4, key: "categories", selector: "section:nth-of-type(3) .categories-style-02" },
  { itemCount: 10, key: "best-sellers", selector: "section:nth-of-type(4) .grid-item" },
  { key: "promo", selector: "section:nth-of-type(5)" },
  { itemCount: 8, key: "collection", selector: "section:nth-of-type(6) .swiper-slide" },
  { itemCount: 5, key: "brands", selector: "section:nth-of-type(7) .col" },
  { itemCount: 5, key: "featured-products", selector: "section:nth-of-type(8) .grid-item" },
  { itemCount: 8, key: "marquee", selector: "section:nth-of-type(9) .swiper-slide" },
  { itemCount: 4, key: "magazine", selector: "section:nth-of-type(10) .grid-item" },
  { key: "footer", selector: "footer.footer-dark" },
  { key: "cookie", selector: ".cookie-message" },
  { key: "sticky", selector: ".sticky-wrap" },
  { key: "scroll-progress", selector: ".scroll-progress" },
] as const satisfies readonly Fashion2SourceRegion[];

export const fashion2SourceRegionOrder = fashion2SourceRegions.map(({ key }) => key);

export const fashion2SourceContract = {
  bodyMobileNavigationStyle: "classic",
  homeSectionCount: 10,
  htmlClassAfterHydration: "js",
  regionOrder: fashion2SourceRegionOrder,
  stylesheetOrder: [
    "css/vendors.min.css",
    "css/icon.min.css",
    "css/style.css",
    "css/responsive.css",
    "demos/fashion-store/fashion-store.css",
  ],
} as const;
