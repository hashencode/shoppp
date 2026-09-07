import { themeCompositionDescriptorSchema } from "@shoppp/contracts";

export const fashionStoreHomeSections = [
  { fixtureResource: "home", id: "fashion-store-home", required: true, type: "fashion-store.hero" },
  {
    fixtureResource: "services",
    id: "fashion-store-home-services",
    required: false,
    type: "fashion-store.services",
  },
  {
    fixtureResource: "categories",
    id: "fashion-store-home-categories",
    required: false,
    type: "fashion-store.categories",
  },
  {
    fixtureResource: "best-sellers",
    id: "fashion-store-home-best-sellers",
    required: false,
    type: "fashion-store.products",
  },
  {
    fixtureResource: "promotion",
    id: "fashion-store-home-promotion",
    required: false,
    type: "fashion-store.promotion",
  },
  {
    fixtureResource: "collection",
    id: "fashion-store-home-collection",
    required: false,
    type: "fashion-store.collection-feature",
  },
  {
    fixtureResource: "brands",
    id: "fashion-store-home-brands",
    required: false,
    type: "fashion-store.brand-strip",
  },
  {
    fixtureResource: "featured-products",
    id: "fashion-store-home-featured-products",
    required: false,
    type: "fashion-store.products",
  },
  {
    fixtureResource: "marquee",
    id: "fashion-store-home-marquee",
    required: false,
    type: "fashion-store.marquee",
  },
  {
    fixtureResource: "magazine",
    id: "fashion-store-home-magazine",
    required: false,
    type: "fashion-store.editorial",
  },
] as const;

export const fashionStoreHomeSectionTypes = [
  ...new Set(fashionStoreHomeSections.map(({ type }) => type)),
];

export type FashionStoreProductSectionVariant = "best-sellers" | "featured-products";

export function fashionStoreProductSectionVariant(
  instanceId: string,
): FashionStoreProductSectionVariant {
  const resource = fashionStoreHomeSections.find(({ id }) => id === instanceId)?.fixtureResource;
  if (resource === "best-sellers" || resource === "featured-products") return resource;
  throw new Error(`Unknown Fashion Store products Section instance ${instanceId}.`);
}

const homeBindings = [
  {
    cardinality: "required",
    name: "featured-collection",
    referenceKind: "collection",
    settingId: "featured-collection",
  },
  {
    cardinality: "optional",
    name: "featured-product",
    referenceKind: "product",
    settingId: "featured-product",
  },
] as const;

export const fashionStoreSectionComposition = themeCompositionDescriptorSchema.parse({
  pageTypes: ["home"],
  rendererShell: {
    fixtureResource: "home",
    liveResolver: "experience-shell",
    owner: "renderer",
    sourceSectionType: "fashion-store.hero",
  },
  sections: Object.fromEntries(
    fashionStoreHomeSectionTypes.map((type) => [
      type,
      {
        bindings: [...homeBindings],
        fixture: { kind: "theme-section" },
        live: { kind: "theme-section", resolver: "home-sections" },
        shell: "none",
      },
    ]),
  ),
});
