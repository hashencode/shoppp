export type LegacyDisposition =
  | "fashion-reuse"
  | "fashion-visual-variant"
  | "fashion-unique-section"
  | "reference-only"
  | "retire";

interface DispositionRow {
  disposition: LegacyDisposition;
  targetOwner: string;
}

interface SourceDispositionRow extends DispositionRow {
  source: string;
}

export const legacyComponentDispositions = [
  {
    source: "decor/components/DecorCategoryShowcase.vue",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.categories",
  },
  {
    source: "decor/components/DecorClientStrip.vue",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.brands",
  },
  {
    source: "decor/components/DecorCollectionFeature.vue",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.collection",
  },
  {
    source: "decor/components/DecorFeature.vue",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.categories",
  },
  {
    source: "decor/components/DecorFooter.vue",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreFooter",
  },
  {
    source: "decor/components/DecorHeader.vue",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreHeader",
  },
  {
    source: "decor/components/DecorHeroCarousel.vue",
    disposition: "retire",
    targetOwner: "FashionStoreDecorHero",
  },
  {
    source: "decor/components/DecorJournal.vue",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.magazine",
  },
  {
    source: "decor/components/DecorLayeredHero.vue",
    disposition: "retire",
    targetOwner: "FashionStoreDecorHero",
  },
  {
    source: "decor/components/DecorMarquee.vue",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.marquee",
  },
  {
    source: "decor/components/DecorProductDetails.vue",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreProductPage",
  },
  {
    source: "decor/components/DecorProductTabs.vue",
    disposition: "fashion-unique-section",
    targetOwner: "fashion-store.product-merchandising",
  },
  {
    source: "decor/components/DecorServiceStrip.vue",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.services",
  },
  {
    source: "decor/components/DecorShop.vue",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreCollectionPage",
  },
  {
    source: "decor-store/components/DecorStoreHome.vue",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/components/pages/DecorStoreSecondaryPage.vue",
    disposition: "retire",
    targetOwner: "Fashion Store routes",
  },
  {
    source: "decor-store/components/pages/DecorStoreSourceReplicaPage.vue",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/components/shared/DecorStoreFooter.vue",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreFooter",
  },
  {
    source: "decor-store/components/shared/DecorStoreHeader.vue",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreHeader",
  },
  {
    source: "decor-store/components/shared/DecorStoreMiniCart.vue",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreMiniCart",
  },
  {
    source: "decor-store/components/shared/DecorStoreSearchOverlay.vue",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreSearchOverlay",
  },
  {
    source: "decor-store/components/shared/DecorStoreShell.vue",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreShell",
  },
] as const satisfies readonly SourceDispositionRow[];

export const legacyFixtureDispositions = [
  {
    source: "decor/fixtures/home.ts",
    disposition: "reference-only",
    targetOwner: "decor reference evidence",
  },
  {
    source: "decor-store/fixtures/home.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/fixtures/pages/commerce.ts",
    disposition: "retire",
    targetOwner: "Fashion Store Commerce fixtures",
  },
  {
    source: "decor-store/fixtures/pages/content.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/fixtures/pages/product.ts",
    disposition: "retire",
    targetOwner: "Fashion Store Product fixtures",
  },
  {
    source: "decor-store/fixtures/pages/shell.ts",
    disposition: "retire",
    targetOwner: "FashionStoreShell fixtures",
  },
  {
    source: "decor-store/fixtures/pages/shop.ts",
    disposition: "retire",
    targetOwner: "Fashion Store Collection fixtures",
  },
] as const satisfies readonly SourceDispositionRow[];

export const legacyRuntimeDispositions = [
  {
    source: "decor-store/runtime/revolution-loader.client.ts",
    disposition: "retire",
    targetOwner: "FashionStoreDecorHero",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/about.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/account.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/article.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/blog.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/cart.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/checkout.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/collection.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/contact.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/faq.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/index.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/product.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/shop-left.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/shop-none.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/shop-right.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/secondary-page-fragments/wishlist.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/source-fragments.generated.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    source: "decor-store/runtime/source-markup.ts",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
] as const satisfies readonly SourceDispositionRow[];

export const legacyRegistrySectionDispositions = [
  {
    identity: "decor",
    sourceType: "decor.category-showcase",
    capability: "categories",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.categories",
  },
  {
    identity: "decor",
    sourceType: "decor.client-strip",
    capability: "brands",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.brands",
  },
  {
    identity: "decor",
    sourceType: "decor.collection-feature",
    capability: "collection",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.collection",
  },
  {
    identity: "decor",
    sourceType: "decor.footer",
    capability: "shell",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreFooter",
  },
  {
    identity: "decor",
    sourceType: "decor.header",
    capability: "shell",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreHeader",
  },
  {
    identity: "decor",
    sourceType: "decor.hero-carousel",
    capability: "hero",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreDecorHero",
  },
  {
    identity: "decor",
    sourceType: "decor.journal",
    capability: "editorial",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.magazine",
  },
  {
    identity: "decor",
    sourceType: "decor.marquee",
    capability: "marquee",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.marquee",
  },
  {
    identity: "decor",
    sourceType: "decor.product-details",
    capability: "product",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreProductPage",
  },
  {
    identity: "decor",
    sourceType: "decor.product-tabs",
    capability: "product-merchandising",
    disposition: "fashion-unique-section",
    targetOwner: "fashion-store.product-merchandising",
  },
  {
    identity: "decor",
    sourceType: "decor.service-strip",
    capability: "services",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.services",
  },
  {
    identity: "decor",
    sourceType: "decor.shop",
    capability: "collection-route",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreCollectionPage",
  },
  {
    identity: "decor-store",
    sourceType: "decor-store.home",
    capability: "source-home-replica",
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    identity: "decor-store",
    sourceType: "decor-store.cart",
    capability: "cart",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreCartPage",
  },
  {
    identity: "decor-store",
    sourceType: "decor-store.checkout",
    capability: "checkout",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreCheckoutPage",
  },
  {
    identity: "decor-store",
    sourceType: "decor-store.collection",
    capability: "collection-route",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreCollectionPage",
  },
  {
    identity: "decor-store",
    sourceType: "decor-store.content",
    capability: "content-routes",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreContentPage",
  },
  {
    identity: "decor-store",
    sourceType: "decor-store.product",
    capability: "product",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreProductPage",
  },
] as const;

type LegacyRouteDisposition = DispositionRow & {
  id: string;
  pageRole: "home" | "commerce" | "content";
};

export const legacyRouteDispositions = [
  {
    id: "decor:home",
    pageRole: "home",
    disposition: "retire",
    targetOwner: "fashion-store unified Home",
  },
  {
    id: "decor-store:home",
    pageRole: "home",
    disposition: "retire",
    targetOwner: "fashion-store unified Home",
  },
  {
    id: "decor-store:shop-left",
    pageRole: "commerce",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreCollectionPage",
  },
  {
    id: "decor-store:shop-none",
    pageRole: "commerce",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreCollectionPage",
  },
  {
    id: "decor-store:shop-right",
    pageRole: "commerce",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreCollectionPage",
  },
  {
    id: "decor-store:collection",
    pageRole: "commerce",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreCollectionPage",
  },
  {
    id: "decor-store:product",
    pageRole: "commerce",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreProductPage",
  },
  {
    id: "decor-store:wishlist",
    pageRole: "commerce",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreWishlistPage",
  },
  {
    id: "decor-store:cart",
    pageRole: "commerce",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreCartPage",
  },
  {
    id: "decor-store:checkout",
    pageRole: "commerce",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreCheckoutPage",
  },
  {
    id: "decor-store:account",
    pageRole: "commerce",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreAccountPage",
  },
  {
    id: "decor-store:blog",
    pageRole: "content",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreMagazinePage",
  },
  {
    id: "decor-store:article",
    pageRole: "content",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreArticlePage",
  },
  {
    id: "decor-store:about",
    pageRole: "content",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreAboutPage",
  },
  {
    id: "decor-store:faq",
    pageRole: "content",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreFaqPage",
  },
  {
    id: "decor-store:contact",
    pageRole: "content",
    disposition: "fashion-reuse",
    targetOwner: "FashionStoreContactPage",
  },
] as const satisfies readonly LegacyRouteDisposition[];

export const legacySourceRegionDispositions = [
  { id: "header", disposition: "fashion-reuse", targetOwner: "FashionStoreHeader" },
  { id: "hero", disposition: "fashion-reuse", targetOwner: "FashionStoreDecorHero" },
  {
    id: "featured-categories",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.categories",
  },
  {
    id: "products",
    disposition: "fashion-unique-section",
    targetOwner: "fashion-store.product-merchandising",
  },
  {
    id: "promotional-marquee",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.marquee",
  },
  {
    id: "collection-carousel",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.collection",
  },
  {
    id: "client-marquee",
    disposition: "fashion-visual-variant",
    targetOwner: "fashion-store.brands",
  },
  { id: "journal", disposition: "fashion-visual-variant", targetOwner: "fashion-store.magazine" },
  { id: "services", disposition: "fashion-visual-variant", targetOwner: "fashion-store.services" },
  { id: "footer", disposition: "fashion-reuse", targetOwner: "FashionStoreFooter" },
  { id: "cookie", disposition: "fashion-reuse", targetOwner: "FashionStoreShell" },
  { id: "sticky", disposition: "fashion-reuse", targetOwner: "FashionStoreShell" },
  { id: "scroll-progress", disposition: "fashion-reuse", targetOwner: "FashionStoreShell" },
] as const;

const primaryInteractionDispositions = new Map<string, LegacyDisposition>([
  ["header-language", "reference-only"],
  ["header-navigation", "fashion-reuse"],
  ["header-search", "fashion-reuse"],
  ["header-commerce", "fashion-reuse"],
  ["hero-revolution", "fashion-reuse"],
  ["product-tabs", "fashion-unique-section"],
  ["product-card-actions", "fashion-reuse"],
  ["promotional-marquee", "fashion-visual-variant"],
  ["collection-carousel", "fashion-visual-variant"],
  ["client-marquee", "fashion-visual-variant"],
  ["cookie-notice", "fashion-reuse"],
  ["sticky-social", "fashion-reuse"],
  ["scroll-progress", "fashion-reuse"],
]);

const secondaryPageIds = new Set([
  "shop-left",
  "shop-none",
  "shop-right",
  "collection",
  "product",
  "wishlist",
  "cart",
  "checkout",
  "account",
  "blog",
  "article",
  "about",
  "faq",
  "contact",
]);
const secondaryReferenceOnlyInteractions = new Set([
  "billing-fields-inert",
  "comment-form-inert",
  "contact-form-inert",
  "coupon-form-inert",
  "login-form-inert",
  "map-static",
  "payment-options-inert",
  "register-form-inert",
  "review-form-inert",
]);
const secondaryFashionOwnedInteractions = new Set([
  "about-carousel",
  "account-tabs",
  "article-navigation",
  "blog-pagination",
  "cart-quantity",
  "cart-remove",
  "checkout-navigation",
  "collection-card-hover",
  "cookie-dismissal",
  "coupon-panel",
  "faq-accordion",
  "filter-accordion",
  "header-navigation",
  "login-panel",
  "mini-cart-overlay",
  "mobile-navigation",
  "pagination",
  "product-card-hover",
  "product-gallery",
  "product-options",
  "product-tabs",
  "quantity",
  "scroll-progress",
  "search-overlay",
  "share-links",
  "sort",
  "wishlist-product-navigation",
  "wishlist-remove",
  "wishlist-toggle",
]);

export function classifyLegacyInteraction(id: string): LegacyDisposition | undefined {
  const primary = primaryInteractionDispositions.get(id);
  if (primary) return primary;
  const separator = id.indexOf(":");
  if (separator < 1) return undefined;
  const pageId = id.slice(0, separator);
  const interaction = id.slice(separator + 1);
  if (!secondaryPageIds.has(pageId)) return undefined;
  if (secondaryReferenceOnlyInteractions.has(interaction)) return "reference-only";
  if (secondaryFashionOwnedInteractions.has(interaction)) return "fashion-reuse";
  return undefined;
}

export const legacyAssetGroups = [
  {
    id: "decor-presentation-images",
    source: "decor/assets/images/**",
    expectedCount: 82,
    disposition: "fashion-visual-variant",
    targetOwner: "approved Fashion Section assets",
  },
  {
    id: "decor-store-source-images",
    source: "decor-store/upstream/images/**",
    expectedCount: 94,
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    id: "decor-store-placeholder",
    source: "decor-store/assets/decor-store-placeholder.svg",
    expectedCount: 1,
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    id: "decor-store-fonts",
    source: "decor-store/upstream/fonts/**",
    expectedCount: 9,
    disposition: "reference-only",
    targetOwner: "decor-store reference evidence",
  },
  {
    id: "decor-store-runtime-styles",
    source: "decor-store/upstream/**/*.css",
    disposition: "retire",
    targetOwner: "Fashion scoped Section styles",
  },
  {
    id: "decor-store-runtime-scripts",
    source: "decor-store/upstream/{js,revolution}/**/*.js",
    expectedCount: 8,
    disposition: "retire",
    targetOwner: "Fashion shared runtime",
  },
] as const;

export const legacySelectableSurfaces = [
  { source: "tools/generate-storefront-theme-catalog.ts", identities: ["decor", "decor-store"] },
  {
    source: "apps/storefront/app/generated/theme-catalog.ts",
    identities: ["decor", "decor-store"],
  },
  {
    source: "apps/api/src/generated/storefront-theme-catalog.ts",
    identities: ["decor", "decor-store"],
  },
  { source: "apps/storefront/scripts/prepare-experience.ts", identities: ["decor", "decor-store"] },
  {
    source: "apps/storefront/scripts/prepare-theme-preview-fixture.ts",
    identities: ["decor", "decor-store"],
  },
  {
    source: "apps/storefront/scripts/resolve-prerender-routes.ts",
    identities: ["decor", "decor-store"],
  },
  { source: "apps/storefront/package.json", identities: ["decor", "decor-store"] },
  { source: "apps/storefront/nuxt.config.ts", identities: ["decor-store"] },
  { source: "tools/storefront-source-equivalence-policy.json", identities: ["decor-store"] },
] as const;

export const unifiedHomeSectionIA = [
  {
    id: "fashion-store-home",
    sectionType: "fashion-store.hero",
    adminLabel: "Hero",
    group: "Foundation",
    order: 10,
    required: true,
    visible: true,
    priorityRationale:
      "Retains the existing Home instance and binding IDs while protecting the inherited Hero.",
  },
  {
    id: "fashion-store-home-services",
    sectionType: "fashion-store.services",
    adminLabel: "Store services",
    group: "Trust",
    order: 20,
    required: false,
    visible: true,
    priorityRationale: "Keeps delivery, payment, returns, and support visible near the top.",
  },
  {
    id: "fashion-store-home-categories",
    sectionType: "fashion-store.categories",
    adminLabel: "Shop by category",
    group: "Discovery",
    order: 30,
    required: false,
    visible: true,
    priorityRationale:
      "Provides the primary collection-discovery path and owns the approved visual variant.",
  },
  {
    id: "fashion-store-home-best-sellers",
    sectionType: "fashion-store.products",
    adminLabel: "Best sellers",
    group: "Merchandising",
    order: 40,
    required: false,
    visible: true,
    priorityRationale: "Preserves the current Fashion catalog-bound product grid.",
  },
  {
    id: "fashion-store-home-promotion",
    sectionType: "fashion-store.promotion",
    adminLabel: "Collection promotion",
    group: "Campaigns",
    order: 50,
    required: false,
    visible: true,
    priorityRationale:
      "Keeps the current focused campaign callout separate from category discovery.",
  },
  {
    id: "fashion-store-home-collection",
    sectionType: "fashion-store.collection-feature",
    adminLabel: "Featured collection",
    group: "Discovery",
    order: 60,
    required: false,
    visible: true,
    priorityRationale:
      "Owns the existing collection carousel and the approved presentation variant.",
  },
  {
    id: "fashion-store-home-brands",
    sectionType: "fashion-store.brand-strip",
    adminLabel: "Brand strip",
    group: "Trust",
    order: 70,
    required: false,
    visible: true,
    priorityRationale:
      "Preserves the existing brand proof while allowing the approved motion treatment.",
  },
  {
    id: "fashion-store-home-featured-products",
    sectionType: "fashion-store.products",
    adminLabel: "Featured products",
    group: "Merchandising",
    order: 80,
    required: false,
    visible: true,
    priorityRationale:
      "Preserves the second current Fashion product presentation without duplicating product behavior.",
  },
  {
    id: "fashion-store-home-marquee",
    sectionType: "fashion-store.marquee",
    adminLabel: "Promotional marquee",
    group: "Campaigns",
    order: 90,
    required: false,
    visible: true,
    priorityRationale:
      "Owns shared Fashion motion with an approved Decor-derived visual/content variant.",
  },
  {
    id: "fashion-store-home-magazine",
    sectionType: "fashion-store.editorial",
    adminLabel: "Editorial stories",
    group: "Content",
    order: 100,
    required: false,
    visible: true,
    priorityRationale:
      "Reuses Fashion editorial cards and accepts the approved journal presentation variant.",
  },
  {
    id: "fashion-store-home-product-merchandising",
    sectionType: "fashion-store.product-merchandising",
    adminLabel: "Product groups",
    group: "Merchandising",
    order: 110,
    required: false,
    visible: false,
    priorityRationale:
      "Adds the one distinct Decor-derived interaction: switching among catalog-bound product groups.",
  },
] as const;
