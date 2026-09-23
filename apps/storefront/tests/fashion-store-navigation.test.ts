import { describe, expect, test } from "bun:test";
import type { CatalogReleaseV3 } from "@shoppp/contracts";

import releaseFixture from "../fixtures/release.json";
import {
  resolveLegacyReleasedNavigation,
  resolveReleasedNavigation,
} from "../app/theme-engine/composer";
import {
  isLegacyNavigationItemVisible,
  legacyFashionStoreNavigationCharacterization,
  legacyFashionStoreReleasedNavigation,
  resolveLegacyNavigationHref,
} from "../app/themes/fashion-store/contracts/navigation-characterization";

const legacyLink = (id: string, label: string, href: string) => ({ href, id, label });
const legacyPlaceholder = (id: string, label: string) => ({ disabled: true, id, label });
const legacyNavigationGolden = {
  footer: {
    columns: [
      {
        id: "legacy.footer.categories",
        items: [
          legacyPlaceholder("legacy.footer.categories-men", "Men"),
          legacyPlaceholder("legacy.footer.categories-women", "Women"),
          legacyPlaceholder("legacy.footer.categories-accessories", "Accessories"),
          legacyPlaceholder("legacy.footer.categories-shoes", "Shoes"),
          legacyPlaceholder("legacy.footer.categories-dresses", "Dresses"),
        ],
        label: "Categories",
      },
      {
        id: "legacy.footer.information",
        items: [
          legacyLink("legacy.footer.about-us", "About us", "/about"),
          legacyLink("legacy.footer.contact-us", "Contact us", "/contact"),
          legacyLink("legacy.footer.terms", "Terms & conditions", "/policies/terms"),
          legacyLink("legacy.footer.shipping", "Shipping & delivery", "/policies/shipping"),
          legacyLink("legacy.footer.privacy", "Privacy policy", "/policies/privacy"),
        ],
        label: "Information",
      },
      {
        id: "legacy.footer.quick-links",
        items: [
          legacyLink("legacy.footer.account", "My account", "/account"),
          legacyPlaceholder("legacy.footer.orders", "Orders tracking"),
          legacyPlaceholder("legacy.footer.store", "Our store"),
          legacyPlaceholder("legacy.footer.size-guide", "Size guide"),
          legacyLink("legacy.footer.faq", "FAQs", "/faq"),
        ],
        label: "Quick links",
      },
    ],
    id: "menu.legacy-footer",
    primary: [
      legacyLink("legacy.footer.home", "Home", "/"),
      legacyLink("legacy.footer.shop", "Shop", "/shop"),
      legacyLink("legacy.footer.collection", "Collection", "/collections"),
      legacyLink("legacy.footer.magazine", "Magazine", "/magazine"),
      legacyLink("legacy.footer.about", "About", "/about"),
      legacyLink("legacy.footer.contact", "Contact", "/contact"),
    ],
    version: 1,
  },
  header: {
    id: "menu.legacy-header",
    left: [
      { ...legacyLink("legacy.header.home", "Home", "/"), kind: "link" },
      {
        ...legacyLink("legacy.header.shop", "Shop", "/shop"),
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
        groups: [
          ["Men", ["Jeans", "Trousers", "Swimwear", "Casual shirts", "Rain jackets", "Loungewear"]],
          [
            "Women",
            [
              "Dupattas",
              "Leggings",
              "Ethnic wear",
              "Kurtas & suits",
              "Western wear",
              "Dress materials",
            ],
          ],
          [
            "Kids",
            ["Dresses", "Jumpsuits", "Track pants", "Ethnic wear", "Value packs", "Loungewear"],
          ],
          ["Divided", ["Tops", "Dresses", "Shorts", "Swimwear", "Jeans", "Jackets"]],
          ["Accessories", ["Shoes", "Scarves", "Watches", "Wristwear", "Backpacks", "Sunglasses"]],
        ].map(([label, items], groupIndex) => ({
          id: `legacy.header.shop-group-${groupIndex + 1}`,
          items: (items as string[]).map((item, itemIndex) =>
            legacyPlaceholder(`legacy.header.shop-${groupIndex + 1}-${itemIndex + 1}`, item),
          ),
          label,
        })),
        kind: "grouped-menu",
      },
      {
        ...legacyLink("legacy.header.collection", "Collection", "/collections"),
        cards: [
          "Polo t-shirts",
          "Sunglasses",
          "Skinny blazer",
          "Casual shoes",
          "Winter jackets",
          "Men's shorts",
        ].map((label, index) => ({
          assetPath: `images/demo-fashion-store-menu-category-0${index + 1}.jpg`,
          disabled: true,
          id: `legacy.header.collection-${index + 1}`,
          label,
        })),
        kind: "card-menu",
      },
    ],
    right: [
      { ...legacyLink("legacy.header.magazine", "Magazine", "/magazine"), kind: "link" },
      {
        id: "legacy.header.pages",
        items: [
          legacyLink("legacy.header.about", "About", "/about"),
          legacyLink("legacy.header.faq", "Faq", "/faq"),
          legacyLink("legacy.header.wishlist", "Wishlist", "/wishlist"),
          legacyLink("legacy.header.account", "Account", "/account"),
          legacyLink("legacy.header.cart", "Cart", "/cart"),
          legacyLink("legacy.header.checkout", "Checkout", "/checkout"),
        ],
        kind: "menu",
        label: "Pages",
      },
      { ...legacyLink("legacy.header.contact", "Contact", "/contact"), kind: "link" },
    ],
    version: 1,
  },
} as const;

describe("Fashion Store released navigation", () => {
  test("retains the observed legacy Header, Mega Menu, and Footer source ledger", () => {
    expect(legacyFashionStoreNavigationCharacterization).toEqual({
      footerColumns: ["Categories", "Information", "Quick links"],
      footerPrimary: ["Home", "Shop", "Collection", "Magazine", "About", "Contact"],
      headerPrimary: ["Home", "Shop", "Collection", "Magazine", "Pages", "Contact"],
      megaMenuGroups: ["Men", "Women", "Kids", "Divided", "Accessories"],
      source: "fixed-vue-tree",
    });
    expect(legacyFashionStoreReleasedNavigation).toEqual(legacyNavigationGolden);
  });

  test("keeps schema-v2 navigation stable across a v3 preview and rollback", () => {
    const before = {
      footer: resolveLegacyReleasedNavigation(structuredClone(releaseFixture), "footer"),
      header: resolveLegacyReleasedNavigation(structuredClone(releaseFixture), "header"),
    };
    expect(before).toEqual(legacyNavigationGolden);
    expect(resolveReleasedNavigation(structuredClone(releaseFixture), "header")).toBeUndefined();
    const preview = {
      ...structuredClone(releaseFixture),
      content: [],
      navigation: [
        {
          id: "menu.header",
          items: [
            {
              id: "preview.only",
              label: "Preview only",
              parentId: null,
              position: 0,
              target: { kind: "route", path: "/" },
            },
          ],
          placement: "header",
          version: 9,
        },
      ],
      schemaVersion: 3,
    } as unknown as CatalogReleaseV3;
    expect(resolveReleasedNavigation(preview, "header")?.items.map(({ label }) => label)).toEqual([
      "Preview only",
    ]);
    expect(resolveLegacyReleasedNavigation(preview, "header")).toBeUndefined();
    const after = {
      footer: resolveLegacyReleasedNavigation(structuredClone(releaseFixture), "footer"),
      header: resolveLegacyReleasedNavigation(structuredClone(releaseFixture), "header"),
    };
    expect(after).toEqual(before);
    expect(after).toEqual(legacyNavigationGolden);
  });

  test("replays schema-v2 route availability and live capability branches", () => {
    const publishedRoutes = releaseFixture.routes;
    const projectLink = ({ href, id, label }: { href: string; id: string; label: string }) => ({
      disabled: resolveLegacyNavigationHref(href, publishedRoutes) ? undefined : true,
      href: resolveLegacyNavigationHref(href, publishedRoutes),
      id,
      label,
    });

    expect(legacyFashionStoreReleasedNavigation.header.left.map(projectLink)).toEqual([
      { disabled: undefined, href: "/", id: "legacy.header.home", label: "Home" },
      { disabled: true, href: undefined, id: "legacy.header.shop", label: "Shop" },
      {
        disabled: true,
        href: undefined,
        id: "legacy.header.collection",
        label: "Collection",
      },
    ]);
    expect(legacyFashionStoreReleasedNavigation.footer.primary.map(projectLink)).toEqual([
      { disabled: undefined, href: "/", id: "legacy.footer.home", label: "Home" },
      { disabled: true, href: undefined, id: "legacy.footer.shop", label: "Shop" },
      {
        disabled: true,
        href: undefined,
        id: "legacy.footer.collection",
        label: "Collection",
      },
      { disabled: true, href: undefined, id: "legacy.footer.magazine", label: "Magazine" },
      { disabled: true, href: undefined, id: "legacy.footer.about", label: "About" },
      { disabled: true, href: undefined, id: "legacy.footer.contact", label: "Contact" },
    ]);

    const pageIds = legacyFashionStoreReleasedNavigation.header.right[1].items.map(({ id }) => id);
    expect(
      pageIds.filter((id) =>
        isLegacyNavigationItemVisible(id, { account: false, wishlist: false }),
      ),
    ).toEqual([
      "legacy.header.about",
      "legacy.header.faq",
      "legacy.header.cart",
      "legacy.header.checkout",
    ]);
    expect(
      pageIds.filter((id) => isLegacyNavigationItemVisible(id, { account: true, wishlist: true })),
    ).toEqual(pageIds);
    expect(
      isLegacyNavigationItemVisible("legacy.footer.account", {
        account: false,
        wishlist: true,
      }),
    ).toBe(false);
    expect(
      isLegacyNavigationItemVisible("legacy.footer.account", {
        account: true,
        wishlist: false,
      }),
    ).toBe(true);
  });

  test("preserves exact released order and resolves typed targets without inventing an optional footer", () => {
    const release = {
      ...structuredClone(releaseFixture),
      content: [
        {
          digest: "b".repeat(64),
          id: "page.about",
          kind: "page",
          payload: { sections: [], seo: {}, summary: "About" },
          route: "/about-us",
          slug: "about",
          title: "About",
          version: 2,
        },
      ],
      environment: "development",
      identity: {
        faviconAssetId: null,
        id: "identity.primary",
        logoAssets: [],
        seo: {},
        socialShareAssetId: null,
        storefrontName: "Shoppp",
        tagline: "",
        version: 1,
      },
      navigation: [
        {
          id: "menu.header",
          items: [
            {
              id: "nav.second",
              label: "Second",
              parentId: null,
              position: 1,
              target: { kind: "external", url: "https://example.test/second" },
            },
            {
              id: "nav.child",
              label: "Child",
              parentId: "nav.first",
              position: 0,
              target: {
                kind: "internal",
                reference: { id: "page.about", kind: "page" },
              },
            },
            {
              id: "nav.first",
              label: "First",
              parentId: null,
              position: 0,
              target: { kind: "route", path: "/collections/new-arrivals" },
            },
          ],
          placement: "header",
          version: 7,
        },
      ],
      purpose: "private-preview",
      routeOutput: releaseFixture.routes,
      schemaVersion: 3,
      sourceVersionVector: [],
    } as CatalogReleaseV3;

    expect(resolveReleasedNavigation(release, "header")).toEqual({
      id: "menu.header",
      items: [
        {
          children: [
            {
              children: [],
              href: "/about-us",
              id: "nav.child",
              label: "Child",
              targetBehavior: "same-window",
            },
          ],
          href: "/collections/new-arrivals",
          id: "nav.first",
          label: "First",
          targetBehavior: "same-window",
        },
        {
          children: [],
          href: "https://example.test/second",
          id: "nav.second",
          label: "Second",
          targetBehavior: "new-window",
        },
      ],
      version: 7,
    });
    expect(resolveReleasedNavigation(release, "footer")).toBeUndefined();
  });
});
