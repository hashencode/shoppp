export const legacyFashionStoreNavigationCharacterization = {
  footerColumns: ["Categories", "Information", "Quick links"],
  footerPrimary: ["Home", "Shop", "Collection", "Magazine", "About", "Contact"],
  headerPrimary: ["Home", "Shop", "Collection", "Magazine", "Pages", "Contact"],
  megaMenuGroups: ["Men", "Women", "Kids", "Divided", "Accessories"],
  source: "fixed-vue-tree",
} as const;

export function resolveLegacyNavigationHref(
  path: string,
  publishedRoutes?: readonly string[],
): string | undefined {
  return publishedRoutes && !publishedRoutes.includes(path) ? undefined : path;
}

export function isLegacyNavigationItemVisible(
  id: string,
  capabilities: { account: boolean; wishlist: boolean },
): boolean {
  if (id === "legacy.header.wishlist") return capabilities.wishlist;
  if (id === "legacy.header.account" || id === "legacy.footer.account") {
    return capabilities.account;
  }
  return true;
}

const link = (id: string, label: string, href: string) => ({ href, id, label });
const placeholder = (id: string, label: string) => ({ disabled: true as const, id, label });

const shopGroups = [
  ["Men", ["Jeans", "Trousers", "Swimwear", "Casual shirts", "Rain jackets", "Loungewear"]],
  [
    "Women",
    ["Dupattas", "Leggings", "Ethnic wear", "Kurtas & suits", "Western wear", "Dress materials"],
  ],
  ["Kids", ["Dresses", "Jumpsuits", "Track pants", "Ethnic wear", "Value packs", "Loungewear"]],
  ["Divided", ["Tops", "Dresses", "Shorts", "Swimwear", "Jeans", "Jackets"]],
  ["Accessories", ["Shoes", "Scarves", "Watches", "Wristwear", "Backpacks", "Sunglasses"]],
] as const;

const collectionLabels = [
  "Polo t-shirts",
  "Sunglasses",
  "Skinny blazer",
  "Casual shoes",
  "Winter jackets",
  "Men's shorts",
] as const;

/** Frozen pre-U6 schema-v2 shell output. It is never used for schema-v3 releases. */
export const legacyFashionStoreReleasedNavigation = {
  footer: {
    columns: [
      {
        id: "legacy.footer.categories",
        items: [
          placeholder("legacy.footer.categories-men", "Men"),
          placeholder("legacy.footer.categories-women", "Women"),
          placeholder("legacy.footer.categories-accessories", "Accessories"),
          placeholder("legacy.footer.categories-shoes", "Shoes"),
          placeholder("legacy.footer.categories-dresses", "Dresses"),
        ],
        label: "Categories",
      },
      {
        id: "legacy.footer.information",
        items: [
          link("legacy.footer.about-us", "About us", "/about"),
          link("legacy.footer.contact-us", "Contact us", "/contact"),
          link("legacy.footer.terms", "Terms & conditions", "/policies/terms"),
          link("legacy.footer.shipping", "Shipping & delivery", "/policies/shipping"),
          link("legacy.footer.privacy", "Privacy policy", "/policies/privacy"),
        ],
        label: "Information",
      },
      {
        id: "legacy.footer.quick-links",
        items: [
          link("legacy.footer.account", "My account", "/account"),
          placeholder("legacy.footer.orders", "Orders tracking"),
          placeholder("legacy.footer.store", "Our store"),
          placeholder("legacy.footer.size-guide", "Size guide"),
          link("legacy.footer.faq", "FAQs", "/faq"),
        ],
        label: "Quick links",
      },
    ],
    id: "menu.legacy-footer",
    primary: [
      link("legacy.footer.home", "Home", "/"),
      link("legacy.footer.shop", "Shop", "/shop"),
      link("legacy.footer.collection", "Collection", "/collections"),
      link("legacy.footer.magazine", "Magazine", "/magazine"),
      link("legacy.footer.about", "About", "/about"),
      link("legacy.footer.contact", "Contact", "/contact"),
    ],
    version: 1,
  },
  header: {
    id: "menu.legacy-header",
    left: [
      { ...link("legacy.header.home", "Home", "/"), kind: "link" as const },
      {
        ...link("legacy.header.shop", "Shop", "/shop"),
        banners: [
          {
            assetPath: "images/demo-fashion-store-menu-banner-01.jpg",
            id: "legacy.header.shop-banner-1",
          },
          {
            assetPath: "images/demo-fashion-store-menu-banner-02.jpg",
            id: "legacy.header.shop-banner-2",
          },
        ],
        groups: shopGroups.map(([label, items], groupIndex) => ({
          id: `legacy.header.shop-group-${groupIndex + 1}`,
          items: items.map((item, itemIndex) =>
            placeholder(`legacy.header.shop-${groupIndex + 1}-${itemIndex + 1}`, item),
          ),
          label,
        })),
        kind: "grouped-menu" as const,
      },
      {
        ...link("legacy.header.collection", "Collection", "/collections"),
        cards: collectionLabels.map((label, index) => ({
          assetPath: `images/demo-fashion-store-menu-category-0${index + 1}.jpg`,
          disabled: true as const,
          id: `legacy.header.collection-${index + 1}`,
          label,
        })),
        kind: "card-menu" as const,
      },
    ],
    right: [
      { ...link("legacy.header.magazine", "Magazine", "/magazine"), kind: "link" as const },
      {
        id: "legacy.header.pages",
        items: [
          link("legacy.header.about", "About", "/about"),
          link("legacy.header.faq", "Faq", "/faq"),
          link("legacy.header.wishlist", "Wishlist", "/wishlist"),
          link("legacy.header.account", "Account", "/account"),
          link("legacy.header.cart", "Cart", "/cart"),
          link("legacy.header.checkout", "Checkout", "/checkout"),
        ],
        kind: "menu" as const,
        label: "Pages",
      },
      { ...link("legacy.header.contact", "Contact", "/contact"), kind: "link" as const },
    ],
    version: 1,
  },
} as const;
