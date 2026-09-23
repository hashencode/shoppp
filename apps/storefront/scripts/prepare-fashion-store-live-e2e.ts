import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  canonicalCatalogReleaseSchema,
  catalogReleaseV3Schema,
  experienceSnapshotSchema,
  type ExperienceSnapshot,
} from "@shoppp/contracts";
import {
  applyFashionStoreHomeComposition,
  parseFashionStoreHomeDevelopmentProfile,
} from "../app/themes/fashion-store/successor/home-development-profile";

const root = resolve(import.meta.dir, "..");
const fixtureRoot = resolve(root, "fixtures/experience/.generated");

interface FashionStoreFixtureInput {
  expectedOrigin: string;
  snapshot: ExperienceSnapshot;
  themeId: string;
}

interface FashionStoreReleaseFixture {
  collections: Array<{ productSlugs: string[]; slug: string } & Record<string, unknown>>;
  policies: Array<{ slug: string } & Record<string, unknown>>;
  products: Array<
    {
      collectionSlugs: string[];
      id: string;
      name: string;
      optionDefinitions?: Array<{
        name: string;
        presentation: "color" | "text";
        values: Array<{ label: string; swatch?: string }>;
      }>;
      seoTitle: string;
      slug: string;
      status: string;
      variants: Array<{ id: string; sku: string } & Record<string, unknown>>;
    } & Record<string, unknown>
  >;
  redirects: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

const selectedReleasePolicyProof = {
  description: "This notice exists only in the selected live preview Catalog Release.",
  effectiveDate: "2026-08-14",
  sections: [
    {
      body: "Selected-release policy content must never fall back to the generated default Catalog.",
      heading: "Selected release authority",
    },
  ],
  slug: "live-preview-policy-proof",
  title: "Live preview policy proof",
};

export function exactContentBoundaryDocument() {
  const body = Array.from({ length: 13 }, (_, index) => ({
    id: `section.bytes${index}`,
    kind: "paragraph" as const,
    text: "x".repeat(5_000),
  }));
  const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
  body.at(-1)!.text = "x".repeat(5_000 - (bytes(body) - 64_000));
  if (bytes(body) !== 64_000) throw new Error("Exact Content boundary fixture is not 64000 bytes.");
  return body;
}

export function exactTextBoundaryDocument() {
  return [{ id: "section.text", kind: "paragraph" as const, text: "x".repeat(5_000) }];
}

export function exactCardinalityBoundaryDocument(mediaId: string) {
  return [
    ...Array.from({ length: 20 }, (_, index) => ({
      id: `section.link${index}`,
      kind: "link" as const,
      link: {
        label: `Boundary link ${index + 1}`,
        target: { kind: "external" as const, url: `https://example.com/boundary/${index}` },
        targetBehavior: "same-window" as const,
      },
    })),
    ...Array.from({ length: 20 }, (_, index) => ({
      alt: `Boundary media ${index + 1}`,
      assetId: mediaId,
      id: `section.media${index}`,
      kind: "image" as const,
    })),
  ];
}

export function fashionStoreLiveBuildInput(
  fixtureInput: FashionStoreFixtureInput,
  releaseFixture: FashionStoreReleaseFixture,
  expectedOrigin = fixtureInput.expectedOrigin,
  options: { navigationCandidate?: boolean; zeroArticles?: boolean } = {},
) {
  const productIds = new Map(
    releaseFixture.products.map((product, index) => [
      product.slug,
      `prod_01JFASHIONLIVE${String(index + 1).padStart(10, "0")}`,
    ]),
  );
  const collectionIds = new Map(
    releaseFixture.collections.map((collection, index) => [
      collection.slug,
      `col_01JFASHIONLIVE${String(index + 1).padStart(11, "0")}`,
    ]),
  );
  const canonicalRelease = canonicalCatalogReleaseSchema.parse({
    ...releaseFixture,
    collections: releaseFixture.collections.map((collection) => ({
      ...collection,
      id: collectionIds.get(collection.slug),
      productIds: collection.productSlugs.map((slug) => productIds.get(slug)),
    })),
    generatedAt: "2026-08-12T00:00:00.000Z",
    products: releaseFixture.products.map((product) => ({
      ...product,
      collectionIds: product.collectionSlugs.map((slug) => collectionIds.get(slug)),
      id: productIds.get(product.slug),
    })),
    redirects: releaseFixture.redirects.map((redirect) => ({ ...redirect, status: 301 })),
    routes: [
      "/",
      ...releaseFixture.collections.map(({ slug }) => `/collections/${slug}`),
      ...releaseFixture.policies.map(({ slug }) => `/policies/${slug}`),
      ...releaseFixture.products.map(({ slug }) => `/products/${slug}`),
    ],
    schemaVersion: 2,
  });
  const boundaryMedia = canonicalRelease.products
    .flatMap(({ media }) => media)
    .find(({ id, src }) => Boolean(id) && src.startsWith("/"));
  if (!boundaryMedia?.id) {
    throw new Error("Fashion live preview requires one stable same-origin Product media asset.");
  }
  const releasedContent = [
    {
      digest: "b".repeat(64),
      id: "page.released-story",
      kind: "page" as const,
      payload: {
        sections: [
          { id: "section.heading", kind: "heading" as const, level: 2, text: "Released story" },
          {
            id: "section.body",
            kind: "paragraph" as const,
            text: "Server-rendered released Page content.",
          },
          {
            id: "section.safe-link",
            kind: "link" as const,
            link: {
              label: "Safe external reference",
              target: { kind: "external" as const, url: "https://example.com/released-story" },
              targetBehavior: "new-window" as const,
            },
          },
        ],
        seo: { title: "Released story" },
        summary: "A Release-backed Fashion Page.",
      },
      route: "/pages/released-story",
      slug: "released-story",
      title: "Released story",
      version: 1,
    },
    {
      digest: "d".repeat(64),
      id: "page.boundary-document",
      kind: "page" as const,
      payload: {
        sections: exactContentBoundaryDocument(),
        seo: { title: "Boundary document" },
        summary: "An exact 64000-byte released Content document.",
      },
      route: "/pages/boundary-document",
      slug: "boundary-document",
      title: "Boundary document",
      version: 1,
    },
    {
      digest: "e".repeat(64),
      id: "page.text-boundary",
      kind: "page" as const,
      payload: {
        sections: exactTextBoundaryDocument(),
        seo: { title: "Text boundary" },
        summary: "An exact 5000-character released Content paragraph.",
      },
      route: "/pages/text-boundary",
      slug: "text-boundary",
      title: "Text boundary",
      version: 1,
    },
    {
      digest: "f".repeat(64),
      id: "page.cardinality-boundary",
      kind: "page" as const,
      payload: {
        sections: exactCardinalityBoundaryDocument(boundaryMedia.id),
        seo: { title: "Cardinality boundary" },
        summary: "Exact 40-section, 20-link, and 20-media released Content.",
      },
      route: "/pages/cardinality-boundary",
      slug: "cardinality-boundary",
      title: "Cardinality boundary",
      version: 1,
    },
    {
      digest: "c".repeat(64),
      id: "article.released-notes",
      kind: "article" as const,
      payload: {
        sections: [
          {
            id: "section.body",
            kind: "paragraph" as const,
            text: "Server-rendered released Article content.",
          },
        ],
        seo: { title: "Released notes" },
        summary: "A Release-backed Fashion Article.",
      },
      route: "/magazine/released-notes",
      slug: "released-notes",
      title: "Released notes",
      version: 1,
    },
  ].filter(({ kind }) => !options.zeroArticles || kind !== "article");
  const routes = [...canonicalRelease.routes, ...releasedContent.map(({ route }) => route)];
  const navigation = options.navigationCandidate
    ? [
        {
          digest: "9".repeat(64),
          id: "menu.header",
          items: [
            {
              id: "navigation.catalog",
              label: "Catalog",
              parentId: null,
              position: 0,
              target: { kind: "route" as const, path: "/" },
            },
            {
              id: "navigation.travel",
              label: "Travel essentials",
              parentId: "navigation.catalog",
              position: 0,
              target: {
                kind: "internal" as const,
                reference: {
                  id: canonicalRelease.collections[0]!.id,
                  kind: "collection" as const,
                },
              },
            },
            {
              id: "navigation.guide",
              label: "External guide",
              parentId: "navigation.catalog",
              position: 1,
              target: { kind: "external" as const, url: "https://example.com/fashion-guide" },
            },
            {
              id: "navigation.community",
              label: "Community",
              parentId: null,
              position: 1,
              target: { kind: "external" as const, url: "https://example.com/community" },
            },
          ],
          placement: "header" as const,
          version: 3,
        },
      ]
    : [];
  const catalogRelease = catalogReleaseV3Schema.parse({
    ...canonicalRelease,
    content: releasedContent,
    environment: "development",
    identity: {
      faviconAssetId: null,
      id: "identity.primary",
      logoAssets: [],
      seo: {},
      socialShareAssetId: null,
      storefrontName: canonicalRelease.site.name,
      tagline: "",
      version: 1,
    },
    navigation,
    purpose: "private-preview",
    routeOutput: routes,
    routes,
    schemaVersion: 3,
    sourceVersionVector: [
      { digest: "a".repeat(64), id: "identity.primary", kind: "store-identity", version: 1 },
      ...releasedContent.map(({ digest, id, kind, version }) => ({ digest, id, kind, version })),
      ...(options.navigationCandidate
        ? [
            {
              digest: "9".repeat(64),
              id: "menu.header",
              kind: "navigation" as const,
              version: 3,
            },
          ]
        : []),
    ],
  });
  const collection = catalogRelease.collections.find(({ status }) => status === "published");
  const product = catalogRelease.products.find(
    ({ status, variants }) =>
      status === "published" && variants.some((variant) => variant.status === "active"),
  );
  if (!collection || !product) {
    throw new Error("Fashion live preview requires one published collection and product.");
  }
  const snapshot = experienceSnapshotSchema.parse({
    ...fixtureInput.snapshot,
    bindings: [
      {
        id: "fashion-store-live-home-binding",
        instanceId: "fashion-store-home",
        kind: "catalog",
        reference: { id: collection.id, kind: "collection" },
        settingId: "featured-collection",
      },
      {
        id: "fashion-store-live-collection-binding",
        instanceId: "fashion-store-collection",
        kind: "catalog",
        reference: { id: collection.id, kind: "collection" },
        settingId: "fashion-store-live-collection-resource",
      },
      {
        id: "fashion-store-live-product-binding",
        instanceId: "fashion-store-product",
        kind: "catalog",
        reference: { id: product.id, kind: "product" },
        settingId: "fashion-store-live-product-resource",
      },
    ],
    experienceId: "experience-fashion-store-live",
    id: "snapshot-fashion-store-live-1",
    contact: {
      publicContact: {
        supportEmail: "support@shoppp.example",
        privacyEmail: "privacy@shoppp.example",
        publicPhone: "+12025550123",
        serviceHours: {
          kind: "weekly",
          ranges: [
            {
              id: "799578d0-bfc7-4638-90ec-a791894251ee",
              startDay: "monday",
              endDay: "friday",
              startTime: "09:00",
              endTime: "18:00",
            },
          ],
        },
        timeZone: "Asia/Shanghai",
        locations: [
          {
            id: "c811317f-af70-4ee6-9750-4b594c527355",
            name: "Shoppp Demo Studio",
            city: "Shanghai",
            address: "100 Demo Road, Example District",
            phone: "+12025550124",
            email: "studio@shoppp.example",
            mapUrl: "https://example.com/shoppp-demo-map",
            visible: true,
          },
        ],
        socials: [
          {
            id: "09b4b33b-4522-45ab-8541-3f25b7fffc1b",
            platform: "instagram",
            label: "Instagram",
            url: "https://example.com/shoppp-instagram",
            visible: true,
          },
          {
            id: "c6590c62-30a7-4d88-8998-8cb57f7d3c9e",
            platform: "facebook",
            label: "Facebook",
            url: "https://example.com/shoppp-facebook",
            visible: true,
          },
        ],
      },
      version: "c".repeat(64),
    },
    resolvedTemplates: fixtureInput.snapshot.resolvedTemplates.map((template) => ({
      ...template,
      sections: template.sections.map((section) => ({
        ...section,
        settings: {
          ...section.settings,
          ...(template.pageType === "home"
            ? {
                "announcement-text": "Live Experience announcement",
                "footer-contact-copy": "Live Experience footer support",
                "footer-legal-link": {
                  label: "Footer privacy",
                  target: {
                    kind: "internal",
                    reference: { id: "policy.privacy", kind: "policy" },
                  },
                  targetBehavior: "same-window",
                },
                "footer-social-link": {
                  label: "Demo community",
                  target: { kind: "external", url: "https://example.com" },
                  targetBehavior: "new-window",
                },
                "header-contact-copy": "Live Experience header support",
              }
            : {}),
          ...(template.pageType === "content"
            ? {
                "order.help-copy": "Live Experience order help",
                "order.policy-link": {
                  label: "Order privacy policy",
                  target: {
                    kind: "internal",
                    reference: { id: "policy.privacy", kind: "policy" },
                  },
                  targetBehavior: "same-window",
                },
                "policy.document": { id: "policy.shipping", kind: "policy" },
                "policy.help-copy": "Live Experience policy help",
                "policy.related-link": {
                  label: "Related returns policy",
                  target: {
                    kind: "internal",
                    reference: { id: "policy.returns", kind: "policy" },
                  },
                  targetBehavior: "same-window",
                },
              }
            : {}),
        },
      })),
    })),
  });
  return {
    catalogRelease,
    environment: "preview" as const,
    expectedOrigin,
    inputIdentity: {
      catalogReleaseId: catalogRelease.releaseId,
      experienceSnapshotId: snapshot.id,
      experienceVersion: snapshot.version,
      platformContractVersion: snapshot.platformContractVersion,
      themeId: snapshot.themeId,
      themeVersion: snapshot.themeVersion,
    },
    mediaOrigins: [],
    presentationMode: "live" as const,
    snapshot,
    themeId: fixtureInput.themeId,
  };
}

async function main(): Promise<void> {
  const fixtureInput = JSON.parse(
    await readFile(resolve(fixtureRoot, "fashion-store-preview-input.json"), "utf8"),
  ) as FashionStoreFixtureInput;
  const releaseFixture = JSON.parse(
    await readFile(resolve(root, "fixtures/release.json"), "utf8"),
  ) as FashionStoreReleaseFixture;
  const emptyHome = process.argv.includes("--empty-home");
  const emptyProduct = process.argv.includes("--empty-product");
  const zeroArticles = process.argv.includes("--zero-articles");
  const navigationCandidate = process.argv.includes("--navigation-v3");
  const unifiedHome = process.argv.includes("--unified-home");
  if (
    [emptyHome, emptyProduct, navigationCandidate, unifiedHome, zeroArticles].filter(Boolean)
      .length > 1
  ) {
    throw new Error("Choose one Fashion Store live fixture profile.");
  }
  const preparedReleaseFixture = structuredClone(releaseFixture);
  preparedReleaseFixture.releaseId = "fashion-store-live-2026-09-16-v2-shopper-release";
  const reviewedProduct = preparedReleaseFixture.products.find(
    ({ slug }) => slug === "relaxed-corduroy-shirt",
  );
  if (!reviewedProduct) throw new Error("Fashion live preview requires the reviewed Product.");
  if (emptyProduct) {
    const presentation = reviewedProduct.presentation as Record<string, unknown> | undefined;
    if (!presentation) throw new Error("Fashion Product review fixture has no presentation.");
    delete presentation.reviewDisplay;
    preparedReleaseFixture.releaseId = "fashion-store-live-2026-09-16-empty-product";
  }
  reviewedProduct.optionDefinitions = [
    {
      name: "color",
      presentation: "color",
      values: [
        { label: "Gold", swatch: "#d4af37" },
        { label: "Blue", swatch: "#5881bf" },
        { label: "Green", swatch: "#87a968" },
      ],
    },
    {
      name: "size",
      presentation: "text",
      values: ["S", "M", "L", "XL"].map((label) => ({ label })),
    },
  ];
  if (unifiedHome) {
    const homeCollection = preparedReleaseFixture.collections.find(
      ({ status }) => status === "published",
    );
    const seedProduct = preparedReleaseFixture.products.find(
      ({ status, variants }) => status === "published" && variants.length > 0,
    );
    if (!homeCollection || !seedProduct) {
      throw new Error("Fashion unified Home requires a published collection and seed product.");
    }
    const initialProductCount = preparedReleaseFixture.products.length;
    for (let offset = 1; homeCollection.productSlugs.length < 8; offset += 1) {
      const index = initialProductCount + offset;
      const slug = `unified-home-fixture-${index}`;
      const product = structuredClone(seedProduct);
      product.id = `prod_01J000000000000000000000${index}`;
      product.slug = slug;
      product.name = `Unified Home fixture ${index}`;
      product.seoTitle = `${product.name} | Shoppp`;
      product.collectionSlugs = [...new Set([...product.collectionSlugs, homeCollection.slug])];
      product.variants = product.variants.map((variant, variantIndex) => ({
        ...variant,
        id: `var_01J00000000000000000${index}${String(variantIndex).padStart(3, "0")}`,
        sku: `UNIFIED-${index}-${variantIndex + 1}`,
      }));
      preparedReleaseFixture.products.push(product);
      homeCollection.productSlugs.push(slug);
    }
  }
  if (emptyHome) {
    const homeCollection = preparedReleaseFixture.collections.find(
      ({ status }) => status === "published",
    );
    if (!homeCollection) throw new Error("Fashion live preview requires a Home collection.");
    homeCollection.productSlugs = [];
    for (const product of preparedReleaseFixture.products) {
      product.collectionSlugs = product.collectionSlugs.filter(
        (collectionSlug) => collectionSlug !== homeCollection.slug,
      );
    }
  }
  const liveReleaseFixture = {
    ...preparedReleaseFixture,
    policies: [...releaseFixture.policies, selectedReleasePolicyProof],
    site: {
      ...(preparedReleaseFixture.site as Record<string, unknown>),
      name: "Shoppp live preview",
      origin: "https://live-policy.example.test",
    },
  } satisfies FashionStoreReleaseFixture;
  const productFixtureInput = emptyProduct
    ? {
        ...fixtureInput,
        snapshot: {
          ...fixtureInput.snapshot,
          resolvedTemplates: fixtureInput.snapshot.resolvedTemplates.map((template) =>
            template.pageType === "product"
              ? {
                  ...template,
                  sections: template.sections.map((section) => ({
                    ...section,
                    settings: Object.fromEntries(
                      Object.entries(section.settings).filter(
                        ([key]) =>
                          key !== "delivery-summary" &&
                          key !== "shipping-returns-summary" &&
                          !key.startsWith("payment-brand-"),
                      ),
                    ),
                  })),
                }
              : template,
          ),
        },
      }
    : fixtureInput;
  const input = fashionStoreLiveBuildInput(
    productFixtureInput,
    liveReleaseFixture,
    productFixtureInput.expectedOrigin,
    { navigationCandidate, zeroArticles },
  );
  const authoredHeroCount = Number(process.env.STOREFRONT_FASHION_AUTHORED_HERO_COUNT || 0);
  if (authoredHeroCount > 0) {
    const home = input.snapshot.resolvedTemplates.find(({ pageType }) => pageType === "home");
    const hero = home?.sections.find(({ type }) => type === "fashion-store.hero");
    const collection = input.catalogRelease.collections.find(({ status }) => status === "published");
    if (!hero || !collection) {
      throw new Error("Authored Hero live proof requires a Home Hero and one published Collection.");
    }
    for (const block of hero.blocks) {
      block.settings.destination = { id: collection.id, kind: "collection" };
    }
  }
  if (unifiedHome) {
    const profile = parseFashionStoreHomeDevelopmentProfile(
      process.env.STOREFRONT_FASHION_HOME_PROFILE,
    );
    const home = input.snapshot.resolvedTemplates.find(({ pageType }) => pageType === "home");
    if (!home) throw new Error("Fashion live preview requires a Home template.");
    applyFashionStoreHomeComposition(home, profile.composition);
  }
  await writeFile(
    resolve(
      fixtureRoot,
      unifiedHome
        ? "fashion-store-live-unified-home-e2e-input.json"
        : navigationCandidate
          ? "fashion-store-navigation-v3-e2e-input.json"
          : zeroArticles
            ? "fashion-store-live-zero-articles-e2e-input.json"
            : emptyHome
              ? "fashion-store-live-empty-e2e-input.json"
              : emptyProduct
                ? "fashion-store-live-empty-product-e2e-input.json"
                : "fashion-store-live-e2e-input.json",
    ),
    `${JSON.stringify(input, null, 2)}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
