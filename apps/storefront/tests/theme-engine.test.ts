import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type {
  CanonicalCatalogRelease,
  CatalogReleaseV3,
  ExperienceSnapshot,
  PageTemplate,
  StorefrontThemeDescriptor,
} from "@shoppp/contracts";
import type { Component } from "vue";

import {
  experienceBuildInputSchema,
  prepareExperience,
  renderActiveExperienceModule,
  renderActiveThemeModule,
} from "../scripts/prepare-experience";
import { packagePreviewArtifact } from "../scripts/package-preview-artifact";
import {
  composeThemeRegistries,
  renderThemeTreePlan,
  renderTemplatePlan,
  type ThemeRegistry,
  validateThemeRegistryComposition,
} from "../app/theme-engine/registry";
import {
  composeExperienceShell,
  composePlatformRoutePresentation,
  composeExperienceRoute as composeExperienceRouteWithoutAdapter,
  composeProductPageModel,
  type ComposeExperienceRouteInput,
} from "../app/theme-engine/composer";
import {
  createFixturePresentationProvider,
  createLivePresentationProvider,
  selectLivePort,
  selectPresentationProvider,
} from "../app/theme-engine/providers";
import { resolveFixtureBinding, type PresentationViewModel } from "../app/theme-engine/view-models";
import {
  resolveThemeRoute,
  themeRoutePaths,
  type ResolvedThemeRouteContract,
} from "../app/theme-engine/routes";
import { normalizeFashionStoreProductPresentation } from "../app/themes/fashion-store/contracts/product-card";
import { fashionStoreCompositionAdapter } from "../app/themes/fashion-store/composition";
import { fashionStoreThemeRoutes } from "../app/themes/fashion-store/page-contracts";
import { fashionStorePreset } from "../app/themes/fashion-store/presets/source-parity";
import { fashionStoreSectionComposition } from "../app/themes/fashion-store/successor/composition";
import { resolveFashionStoreBlockReferenceHref } from "../app/themes/fashion-store/contracts/block-destinations";
import {
  createPreviewAccessHandler,
  normalizePreviewAssetPath,
  uploadPreviewArtifact,
  type PreviewArtifactBucket,
  type PreviewArtifactObject,
} from "../worker/preview-access";

const descriptor = {
  configurationSchemaVersion: 1,
  id: "synthetic",
  platformCompatibility: { maxExclusive: "2.0.0", min: "1.0.0" },
  platformContractVersion: "1.0.0",
  presets: ["editorial"],
  supportedPageTemplates: ["home"],
  themeVersion: "1.0.0",
} satisfies StorefrontThemeDescriptor;

function composeExperienceRoute(input: Omit<ComposeExperienceRouteInput, "adapter">) {
  return composeExperienceRouteWithoutAdapter({
    ...input,
    adapter: fashionStoreCompositionAdapter,
  });
}

function testRoute(
  pageType: PageTemplate["pageType"],
  path: string,
  parameters?: ResolvedThemeRouteContract["parameters"],
): ResolvedThemeRouteContract {
  return {
    id: path === "/" ? "home" : path.slice(1).replaceAll("/", "-"),
    pageType,
    path,
    ...(parameters ? { parameters } : {}),
    variant: "test",
  };
}

const template = {
  id: "home",
  pageType: "home",
  requiredCapabilities: ["legal.links"],
  sections: [
    {
      blocks: [
        {
          actions: [],
          capabilities: [],
          id: "hero-action",
          settings: { label: "Explore" },
          type: "core.action",
          visible: true,
        },
      ],
      capabilities: [],
      id: "hero",
      settings: { heading: "Editorial" },
      type: "synthetic.hero",
      visible: true,
    },
    {
      blocks: [],
      capabilities: [],
      id: "disabled",
      settings: {},
      type: "synthetic.editorial",
      visible: false,
    },
    {
      blocks: [],
      capabilities: ["legal.links"],
      id: "legal-footer",
      required: true,
      settings: {},
      type: "core.legal-footer",
      visible: true,
    },
  ],
} satisfies PageTemplate;

const snapshot = {
  approvedAt: "2026-07-30T01:00:00.000Z",
  approvedBy: "operator-1",
  bindings: [],
  configurationSchemaVersion: 1,
  experienceId: "experience-synthetic",
  id: "snapshot-synthetic-1",
  kind: "approved",
  overrides: [],
  platformContractVersion: "1.0.0",
  provenance: {
    approvedAt: "2026-07-30T00:00:00.000Z",
    approvedBy: "theme-team",
    license: "Internal",
    source: "internal://synthetic",
  },
  resolvedTemplates: [template],
  themeId: "synthetic",
  themeVersion: "1.0.0",
  version: 1,
} satisfies ExperienceSnapshot;

const previewInput = {
  environment: "preview",
  expectedOrigin: "https://preview.example.test",
  snapshot,
  themeId: "synthetic",
} as const;

const canonicalRelease = {
  collections: [
    {
      description: "Selected release collection",
      id: "col_01JTHEMEENGINE000000000001",
      name: "Selected collection",
      productIds: ["prod_01JTHEMEENGINE00000000001"],
      productSlugs: ["selected-product"],
      seoDescription: "Selected collection description",
      seoTitle: "Selected collection",
      slug: "selected-collection",
      status: "published",
    },
  ],
  generatedAt: "2026-08-11T00:00:00.000Z",
  policies: [
    {
      description: "Privacy policy",
      effectiveDate: "2026-08-11",
      sections: [{ body: "Policy body", heading: "Privacy" }],
      slug: "privacy",
      title: "Privacy",
    },
  ],
  products: [
    {
      collectionIds: ["col_01JTHEMEENGINE000000000001"],
      collectionSlugs: ["selected-collection"],
      description: "Selected release product",
      id: "prod_01JTHEMEENGINE00000000001",
      media: [
        {
          alt: "Selected product",
          height: 800,
          src: "https://media.example.test/catalog/selected-product.jpg",
          width: 600,
        },
      ],
      name: "Selected product",
      seoDescription: "Selected product description",
      seoTitle: "Selected product",
      slug: "selected-product",
      status: "published",
      variants: [
        {
          id: "var_01JTHEMEENGINE000000000001",
          optionValues: { size: "M" },
          prices: [{ amount: 6500, compareAtAmount: 8500, currency: "USD" }],
          sku: "SELECTED-M",
          status: "active",
          title: "Medium",
          weightGrams: 400,
        },
      ],
    },
  ],
  redirects: [],
  releaseId: "release-theme-engine-a",
  routes: ["/", "/collections/selected-collection", "/products/selected-product"],
  schemaVersion: 2,
  site: {
    defaultCurrency: "USD",
    freshnessHours: 24,
    name: "Theme Engine",
    origin: "https://shop.example.test",
  },
} satisfies CanonicalCatalogRelease;

const liveSnapshot = {
  ...snapshot,
  bindings: [
    {
      id: "featured-product",
      instanceId: "hero",
      kind: "catalog",
      reference: { id: canonicalRelease.products[0].id, kind: "product" },
      settingId: "featured-product-setting",
    },
  ],
  resolvedTemplates: [
    {
      id: "home",
      pageType: "home",
      requiredCapabilities: [],
      sections: [
        {
          blocks: [],
          capabilities: [],
          id: "hero",
          settings: {},
          type: "synthetic.product",
          visible: true,
        },
      ],
    },
  ],
} satisfies ExperienceSnapshot;

describe("selected storefront theme generation", () => {
  test("generates an unchanged fallback without importing a theme", () => {
    const source = renderActiveThemeModule({
      catalog: [],
      input: { environment: "production" },
      moduleAllowlist: {},
    });

    expect(source).toContain('"production-fallback"');
    expect(source).not.toContain("/themes/");
    expect(source).not.toContain("snapshot-synthetic-1");
  });

  test("generates one deterministic allowlisted import for a compatible preview", () => {
    const options = {
      catalog: [descriptor],
      input: previewInput,
      moduleAllowlist: {
        decor: "../themes/decor/registry",
        synthetic: "../themes/synthetic/registry",
      },
    };
    const first = renderActiveThemeModule(options);
    const second = renderActiveThemeModule(options);

    expect(second).toBe(first);
    expect(first).toContain('from "../themes/synthetic/registry"');
    expect(first).not.toContain("../themes/decor/registry");
    expect(first).toContain('"snapshot-synthetic-1"');
  });

  test("drives live provider selection from generated private input without importing fixtures", async () => {
    const liveInput = {
      catalogRelease: canonicalRelease,
      environment: "preview",
      expectedOrigin: "https://preview.example.test",
      inputIdentity: {
        catalogReleaseId: canonicalRelease.releaseId,
        experienceSnapshotId: liveSnapshot.id,
        experienceVersion: liveSnapshot.version,
        platformContractVersion: liveSnapshot.platformContractVersion,
        themeId: liveSnapshot.themeId,
        themeVersion: liveSnapshot.themeVersion,
      },
      mediaOrigins: ["https://media.example.test"],
      presentationMode: "live",
      snapshot: liveSnapshot,
      themeId: "synthetic",
    } as const;
    const liveThemeSource = renderActiveThemeModule({
      catalog: [descriptor],
      input: liveInput,
      moduleAllowlist: { synthetic: "../themes/synthetic/registry" },
    });
    const providerSource = renderActiveExperienceModule(liveInput);
    const productionProviderSource = renderActiveExperienceModule({ environment: "production" });
    const storefrontExperienceSource = await readFile(
      resolve(import.meta.dir, "../app/StorefrontExperience.vue"),
      "utf8",
    );

    expect(liveThemeSource).not.toContain("selectedThemeFixtures");
    expect(providerSource).toContain('mode: "live"');
    expect(providerSource).toContain(canonicalRelease.releaseId);
    expect(providerSource).toContain(liveSnapshot.id);
    expect(providerSource).toContain("activeCatalogSearchIndex");
    expect(providerSource).toContain("Selected product");
    expect(productionProviderSource).not.toContain("/themes/");
    expect(productionProviderSource).not.toContain(canonicalRelease.releaseId);
    expect(productionProviderSource).toContain("activeCatalogSearchIndex = null");
    expect(storefrontExperienceSource).toContain("activeExperienceProviderInput.mode");
    expect(storefrontExperienceSource).not.toContain("preview-context");
    expect(storefrontExperienceSource).not.toContain("/__preview/context");
    expect(storefrontExperienceSource).not.toContain("Private preview context");
  });

  test("rejects unknown, incompatible, unapproved, or caller-supplied module paths", () => {
    expect(() =>
      renderActiveThemeModule({
        catalog: [],
        input: previewInput,
        moduleAllowlist: { synthetic: "../themes/synthetic/registry" },
      }),
    ).toThrow("catalog");
    expect(() =>
      renderActiveThemeModule({
        catalog: [
          {
            ...descriptor,
            platformCompatibility: { maxExclusive: "3.0.0", min: "2.0.0" },
          },
        ],
        input: previewInput,
        moduleAllowlist: { synthetic: "../themes/synthetic/registry" },
      }),
    ).toThrow("compatible");
    expect(() =>
      renderActiveThemeModule({
        catalog: [{ ...descriptor, id: "rogue" }],
        input: { ...previewInput, snapshot: { ...snapshot, themeId: "rogue" }, themeId: "rogue" },
        moduleAllowlist: {},
      }),
    ).toThrow("allowlist");
    expect(
      experienceBuildInputSchema.safeParse({
        ...previewInput,
        modulePath: "../../attacker/module",
      }).success,
    ).toBe(false);
    expect(
      experienceBuildInputSchema.safeParse({
        ...previewInput,
        expectedOrigin: "https://preview.example.test/",
      }).success,
    ).toBe(false);
  });

  test("writes the generated module to a fixed output path", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "shoppp-active-theme-"));
    try {
      const outputPath = resolve(directory, "active-theme.ts");
      await prepareExperience({
        catalog: [descriptor],
        input: previewInput,
        moduleAllowlist: { synthetic: "../themes/synthetic/registry" },
        outputPath,
      });
      expect(await readFile(outputPath, "utf8")).toBe(
        renderActiveThemeModule({
          catalog: [descriptor],
          input: previewInput,
          moduleAllowlist: { synthetic: "../themes/synthetic/registry" },
        }),
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

test("routes Block references to the exact frozen collection and article candidates", () => {
  const viewModel = {
    featuredCollection: { href: "/collections/not-the-reference", id: "collection.fallback" },
    kind: "home",
    resourceDestinations: [
      { href: "/collections/first", id: "collection.first", kind: "collection" },
      { href: "/collections/exact-second", id: "collection.second", kind: "collection" },
      { href: "/magazine/exact-story", id: "article.exact", kind: "article" },
    ],
  } as unknown as PresentationViewModel;
  const instance = {
    blocks: [
      {
        actions: [],
        capabilities: [],
        id: "category-exact",
        settings: {
          collection: { id: "collection.second", kind: "collection" },
          image: { kind: "theme", path: "assets/images/category.jpg" },
          name: "Exact category",
        },
        type: "fashion-store.category",
        visible: true,
      },
      {
        actions: [],
        capabilities: [],
        id: "article-exact",
        settings: {
          article: { id: "article.exact", kind: "article" },
          image: { kind: "theme", path: "assets/images/article.jpg" },
          title: "Exact article",
        },
        type: "fashion-store.editorial-card",
        visible: true,
      },
    ],
  } as unknown as PageTemplate["sections"][number];
  expect(
    resolveFashionStoreBlockReferenceHref(
      viewModel as Extract<PresentationViewModel, { kind: "home" }>,
      instance.blocks[0]!,
      "collection",
      "collection",
    ),
  ).toBe("/collections/exact-second");
  expect(
    resolveFashionStoreBlockReferenceHref(
      viewModel as Extract<PresentationViewModel, { kind: "home" }>,
      instance.blocks[1]!,
      "article",
      "article",
    ),
  ).toBe("/magazine/exact-story");
});

describe("theme-neutral storefront composer", () => {
  test("resolves catalog route families only from the selected release manifest", () => {
    const routes = [
      {
        family: "catalog-product",
        id: "product",
        pageType: "product",
        path: "/products/:slug",
        variant: "product",
      },
      {
        family: "catalog-collection",
        id: "collection",
        pageType: "collection",
        path: "/collections/:slug",
        variant: "collection",
      },
    ] as const;

    expect(resolveThemeRoute("/products/selected-product", routes, canonicalRelease)).toMatchObject(
      {
        id: "product",
        parameters: { productId: canonicalRelease.products[0].id, slug: "selected-product" },
      },
    );
    expect(resolveThemeRoute("/products/missing", routes, canonicalRelease)).toBeUndefined();
    expect(
      resolveThemeRoute("/collections/selected-collection", routes, canonicalRelease),
    ).toMatchObject({
      id: "collection",
      parameters: {
        collectionId: canonicalRelease.collections[0].id,
        slug: "selected-collection",
      },
    });
  });

  test("resolves one Experience against the explicitly selected Catalog Release", () => {
    const secondRelease = structuredClone(canonicalRelease);
    secondRelease.releaseId = "release-theme-engine-b";
    secondRelease.products[0]!.name = "Product from release B";
    secondRelease.products[0]!.optionDefinitions = [
      {
        name: "size",
        presentation: "color",
        values: [{ label: "M", swatch: "#5881bf" }],
      },
    ];

    const first = composeExperienceRoute({
      experience: liveSnapshot,
      locale: "en-US",
      path: "/",
      release: canonicalRelease,
      route: testRoute("home", "/"),
    });
    const second = composeExperienceRoute({
      experience: liveSnapshot,
      locale: "en-US",
      path: "/",
      release: secondRelease,
      route: testRoute("home", "/"),
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.viewModels.hero).toMatchObject({
      compareAtPriceLabel: "$85.00",
      heading: "Selected product",
      kind: "product",
      optionDefinitions: [{ name: "size", presentation: "text", values: [{ label: "M" }] }],
      optionGroups: [{ name: "size", values: ["M"] }],
      resource: { id: canonicalRelease.products[0].id, kind: "product" },
      variants: [
        {
          id: canonicalRelease.products[0].variants[0].id,
          optionValues: { size: "M" },
          selected: true,
        },
      ],
    });
    expect(second.viewModels.hero).toMatchObject({
      heading: "Product from release B",
      kind: "product",
      optionDefinitions: [
        {
          name: "size",
          presentation: "color",
          values: [{ label: "M", swatch: "#5881bf" }],
        },
      ],
      optionGroups: [{ name: "size", values: ["M"] }],
      resource: { id: canonicalRelease.products[0].id, kind: "product" },
    });
  });

  test("preserves explicit release option and value order independently of variant insertion", () => {
    const release = structuredClone(canonicalRelease);
    release.products[0]!.variants = [
      {
        ...structuredClone(release.products[0]!.variants[0]!),
        id: "var_01JTHEMEENGINE000000000010",
        optionValues: { Color: "Blue", Size: "S" },
      },
      {
        ...structuredClone(release.products[0]!.variants[0]!),
        id: "var_01JTHEMEENGINE000000000011",
        optionValues: { Color: "Red", Size: "M" },
      },
    ];
    release.products[0]!.optionDefinitions = [
      {
        name: "Size",
        presentation: "text",
        values: [{ label: "M" }, { label: "S" }],
      },
      {
        name: "Color",
        presentation: "color",
        values: [
          { label: "Red", swatch: "#ff0000" },
          { label: "Blue", swatch: "#0000ff" },
        ],
      },
    ];

    const result = composeExperienceRoute({
      experience: liveSnapshot,
      locale: "en-US",
      path: "/",
      release,
      route: testRoute("home", "/"),
    });

    expect(result.ok).toBe(true);
    expect(result.viewModels.hero).toMatchObject({
      optionGroups: [
        { name: "Size", values: ["M", "S"] },
        { name: "Color", values: ["Red", "Blue"] },
      ],
    });
    expect(result.viewModels.hero).not.toHaveProperty("optionPresentationFallback");
  });

  test("uses the resolved product route instead of the template's representative binding", () => {
    const release = structuredClone(canonicalRelease);
    release.products.push({
      ...structuredClone(release.products[0]!),
      id: "prod_01JTHEMEENGINE00000000002",
      name: "Route-selected product",
      slug: "route-selected-product",
      variants: [
        {
          ...structuredClone(release.products[0]!.variants[0]!),
          id: "var_01JTHEMEENGINE000000000002",
        },
      ],
    });
    release.collections[0]!.productIds.push(release.products[1]!.id);
    release.collections[0]!.productSlugs.push(release.products[1]!.slug);
    release.routes.push("/products/route-selected-product");
    const productTemplate = {
      ...liveSnapshot,
      resolvedTemplates: [
        {
          id: "product-template",
          pageType: "product" as const,
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "hero",
              settings: {},
              type: "synthetic.product",
              visible: true,
            },
          ],
        },
      ],
    };

    const result = composeExperienceRoute({
      experience: productTemplate,
      locale: "en-US",
      path: "/products/route-selected-product",
      release,
      route: testRoute("product", "/products/route-selected-product", {
        productId: release.products[1]!.id,
        slug: "route-selected-product",
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.viewModels.hero).toMatchObject({
      heading: "Route-selected product",
      resource: { id: release.products[1]!.id, slug: "route-selected-product" },
    });
  });

  test("preserves every ordered release-owned image for the live product gallery", () => {
    const release = structuredClone(canonicalRelease);
    release.products[0]!.media = Array.from({ length: 6 }, (_, index) => ({
      alt: `Selected product view ${index + 1}`,
      height: 765,
      src: `https://media.example.test/catalog/selected-product-${index + 1}.jpg`,
      width: 600,
    }));
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        resolvedTemplates: [
          {
            id: "product-gallery-template",
            pageType: "product",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "hero",
                settings: {},
                type: "synthetic.product",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/products/selected-product",
      release,
      route: testRoute("product", "/products/selected-product", {
        productId: release.products[0]!.id,
        slug: release.products[0]!.slug,
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.viewModels.hero).toMatchObject({
      kind: "product",
      media: release.products[0]!.media,
    });
  });

  test("composes the complete ProductPageModel from released presentation authorities", () => {
    const release = structuredClone(canonicalRelease) as CanonicalCatalogRelease;
    const product = release.products[0]!;
    product.media = [
      { ...product.media[0]!, id: "med_01JTHEMEENGINE000000000001" },
      {
        alt: "Selected product detail",
        height: 900,
        id: "med_01JTHEMEENGINE000000000002",
        src: "https://media.example.test/catalog/selected-product-detail.jpg",
        width: 1200,
      },
    ];
    product.variants = [
      product.variants[0]!,
      {
        ...product.variants[0]!,
        id: "var_01JTHEMEENGINE000000000002",
        optionValues: { size: "L" },
        prices: [{ amount: 14_900, compareAtAmount: 16_900, currency: "USD" }],
        sku: "SELECTED-L",
        title: "Large",
      },
    ];
    product.presentation = {
      brand: "Released atelier",
      defaultVariantId: product.variants[1]!.id,
      detail: {
        body: "Released detail body",
        bullets: ["Released bullet one", "Released bullet two"],
        eyebrow: "Released eyebrow",
        heading: "Released detail heading",
      },
      detailMediaId: product.media[1]!.id,
      specifications: [
        { label: "Material", value: "Cotton" },
        { label: "Fit", value: "Relaxed" },
      ],
    };
    const related = {
      ...structuredClone(product),
      id: "prod_01JTHEMEENGINE00000000002",
      name: "Related product",
      presentation: undefined,
      slug: "related-product",
      variants: [
        {
          ...structuredClone(product.variants[0]!),
          id: "var_01JTHEMEENGINE000000000003",
          sku: "RELATED-M",
        },
      ],
    };
    release.products.push(related);
    release.collections[0]!.productIds.push(related.id);
    release.collections[0]!.productSlugs.push(related.slug);
    release.policies.push(
      {
        description: "Released standard shipping",
        effectiveDate: "2026-08-11",
        sections: [{ body: "Shipping body", heading: "Shipping" }],
        slug: "shipping",
        title: "Shipping",
      },
      {
        description: "Released return terms",
        effectiveDate: "2026-08-11",
        sections: [{ body: "Return body", heading: "Returns" }],
        slug: "returns",
        title: "Returns",
      },
    );

    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [],
        resolvedTemplates: [
          {
            id: "product-template",
            pageType: "product",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "product",
                settings: {},
                type: "fashion-store.product",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/products/selected-product",
      release,
      route: testRoute("product", "/products/selected-product", {
        productId: product.id,
        slug: product.slug,
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.viewModels.product).toMatchObject({
      actions: [{ value: product.variants[1]!.id }],
      brand: "Released atelier",
      descriptionDetail: {
        bullets: ["Released bullet one", "Released bullet two"],
        eyebrow: "Released eyebrow",
        heading: "Released detail heading",
        media: {
          alt: "Selected product detail",
          height: 900,
          src: "https://media.example.test/catalog/selected-product-detail.jpg",
          width: 1200,
        },
        text: "Released detail body",
      },
      relatedProducts: [{ name: "Related product" }],
      priceLabel: "$149.00",
      reviewSummary: { count: 0, label: "0 Reviews" },
      shipping: {
        returnBody: "Released return terms",
        standard: "Released standard shipping",
      },
      specifications: [
        { label: "Material", value: "Cotton" },
        { label: "Fit", value: "Relaxed" },
      ],
      taxonomy: { categories: ["Selected collection"], tags: [] },
      variants: [
        { id: product.variants[0]!.id, priceLabel: "$65.00", selected: false },
        {
          compareAtPriceLabel: "$169.00",
          id: product.variants[1]!.id,
          priceLabel: "$149.00",
          selected: true,
        },
      ],
    });
    expect(result.viewModels.product.media).toEqual([
      expect.objectContaining({ alt: product.media[0]!.alt }),
    ]);
  });

  test("renders every media item from a contract-valid 13-image release", () => {
    const release = structuredClone(canonicalRelease) as CanonicalCatalogRelease;
    const product = release.products[0]!;
    product.media = Array.from({ length: 13 }, (_, index) => ({
      ...product.media[0]!,
      alt: `Released image ${index + 1}`,
      id: `med_${String(index + 1).padStart(20, "0")}`,
      src: `https://media.example.test/catalog/released-image-${index + 1}.jpg`,
    }));

    const model = composeProductPageModel({
      locale: "en-US",
      productId: product.id,
      release,
      slug: product.slug,
    });

    expect(model.media).toHaveLength(13);
    expect(normalizeFashionStoreProductPresentation(model).gallery).toHaveLength(13);
  });

  test("projects only enabled public Product payment brands from Experience settings", () => {
    const release = structuredClone(canonicalRelease) as CanonicalCatalogRelease;
    const product = release.products[0]!;
    const experience = structuredClone(liveSnapshot) as ExperienceSnapshot;
    experience.bindings = [];
    experience.resolvedTemplates = [
      {
        id: "product-template",
        pageType: "product",
        requiredCapabilities: [],
        sections: [
          {
            blocks: [],
            capabilities: [],
            id: "product",
            settings: {
              "delivery-summary": "Timing confirmed at checkout",
              "shipping-returns-summary": "See published shipping and return policies",
              "payment-brand-visa": true,
              "payment-brand-american-express": false,
              "payment-brand-mastercard": true,
            },
            type: "fashion-store.product",
            visible: true,
          },
        ],
      },
    ];
    const result = composeExperienceRoute({
      experience,
      locale: "en-US",
      path: `/products/${product.slug}`,
      release,
      route: testRoute("product", `/products/${product.slug}`, {
        productId: product.id,
        slug: product.slug,
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.viewModels.product.paymentBrands).toEqual(["visa", "mastercard"]);
    expect(result.viewModels.product).toMatchObject({
      deliverySummary: "Timing confirmed at checkout",
      shippingReturnsSummary: "See published shipping and return policies",
    });
    expect(
      normalizeFashionStoreProductPresentation(result.viewModels.product).assurance,
    ).toMatchObject({
      deliverySummary: "Timing confirmed at checkout",
      shippingReturnsSummary: "See published shipping and return policies",
    });
    expect(
      normalizeFashionStoreProductPresentation(result.viewModels.product).assurance?.payments,
    ).toEqual([
      { kind: "theme-asset", path: "images/visa.svg", alt: "Visa" },
      { kind: "theme-asset", path: "images/mastercard.svg", alt: "Mastercard" },
    ]);
    expect(
      composeProductPageModel({
        locale: "en-US",
        productId: product.id,
        release,
        slug: product.slug,
      }).paymentBrands,
    ).toEqual([]);
    const existingSchemaTwoExperience = structuredClone(experience);
    existingSchemaTwoExperience.resolvedTemplates[0]!.sections[0]!.settings = {};
    const existingSchemaTwoPresentation = normalizeFashionStoreProductPresentation(
      composeProductPageModel({
        experience: existingSchemaTwoExperience,
        locale: "en-US",
        productId: product.id,
        release,
        slug: product.slug,
      }),
    );
    expect(existingSchemaTwoPresentation.assurance).toBeUndefined();
    expect(existingSchemaTwoPresentation.optionalRegions.delivery).toBe("hidden");
    expect(
      composeProductPageModel({
        experience,
        locale: "en-US",
        productId: product.id,
        release,
        slug: product.slug,
      }).paymentBrands,
    ).toEqual(["visa", "mastercard"]);
  });

  test("reads canonical commerce and policies without falling back to legacy Product claims", () => {
    const release = {
      ...canonicalRelease,
      commerce: {
        payment: { brands: ["visa", "american-express"], enabled: true, provider: "stripe" },
        shippingMethods: [
          {
            amount: 900,
            countryCodes: ["US"],
            currency: "USD",
            id: "ship_01JTHEMEENGINE00000000001",
            name: "Standard",
          },
        ],
      },
      content: [],
      environment: "staging",
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
      navigation: [],
      policies: [
        {
          ...canonicalRelease.policies[0]!,
          kind: "shipping",
          slug: "delivery-details",
          title: "Shipping policy",
        },
        {
          ...canonicalRelease.policies[0]!,
          kind: "returns",
          slug: "refund-rules",
          title: "Returns policy",
        },
      ],
      purpose: "private-preview",
      routeOutput: canonicalRelease.routes,
      schemaVersion: 3,
      sourceVersionVector: [
        { digest: "a".repeat(64), id: "identity.primary", kind: "store-identity", version: 1 },
      ],
    } satisfies CatalogReleaseV3;
    const experience = structuredClone(liveSnapshot) as ExperienceSnapshot;
    experience.configurationSchemaVersion = 3;
    experience.themeId = "fashion-store";
    experience.themeVersion = "1.2.0";
    experience.bindings = [];
    experience.resolvedTemplates = [
      {
        id: "home-template",
        pageType: "home",
        requiredCapabilities: [],
        sections: [
          {
            blocks: [],
            capabilities: [],
            id: "fashion-store-home-hero",
            settings: {
              "footer-contact-copy": "Legacy footer contact must not render",
              "footer-logo": {
                alt: "Legacy footer logo",
                height: 80,
                kind: "theme",
                path: "assets/legacy-footer.png",
                width: 160,
              },
              "footer-social-link": {
                label: "Legacy social",
                target: { kind: "external", url: "https://legacy.example.test" },
                targetBehavior: "new-window",
              },
              "header-contact-copy": "Legacy header contact must not render",
              "header-logo": {
                alt: "Legacy header logo",
                height: 80,
                kind: "theme",
                path: "assets/legacy-header.png",
                width: 160,
              },
            },
            type: "fashion-store.home",
            visible: true,
          },
        ],
      },
      {
        id: "product-template",
        pageType: "product",
        requiredCapabilities: [],
        sections: [
          {
            blocks: [],
            capabilities: [],
            id: "product",
            settings: {
              "delivery-summary": "Legacy delivery must not render",
              "shipping-returns-summary": "Legacy policy must not render",
              "payment-brand-mastercard": true,
            },
            type: "fashion-store.product",
            visible: true,
          },
        ],
      },
    ];
    const before = structuredClone(experience);

    const first = composeProductPageModel({
      experience,
      locale: "en-US",
      productId: release.products[0]!.id,
      release,
      slug: release.products[0]!.slug,
    });
    const second = composeProductPageModel({
      experience,
      locale: "en-US",
      productId: release.products[0]!.id,
      release,
      slug: release.products[0]!.slug,
    });

    expect(first).toMatchObject({
      deliverySummary: "Shipping options are confirmed for your destination at checkout.",
      paymentBrands: ["visa", "american-express"],
      shippingReturnsSummary: "See Shipping policy and Returns policy.",
    });
    expect(second).toEqual(first);
    expect(experience).toEqual(before);
    expect(JSON.stringify(first)).not.toContain("Legacy");
    expect(JSON.stringify(first)).not.toContain("mastercard");
    const shell = composeExperienceShell({
      adapter: fashionStoreCompositionAdapter,
      experience,
      release,
    });
    expect(shell?.header.logo).toBeUndefined();
    expect(shell?.header.contactCopy).toBeUndefined();
    expect(shell?.footer.logo).toBeUndefined();
    expect(shell?.footer.contactCopy).toBeUndefined();
    expect(shell?.footer.socialLink).toBeUndefined();
    expect(JSON.stringify(shell)).not.toContain("legacy");
    expect(() =>
      composeProductPageModel({
        experience,
        locale: "en-US",
        productId: canonicalRelease.products[0]!.id,
        release: canonicalRelease,
        slug: canonicalRelease.products[0]!.slug,
      }),
    ).toThrow("Unsupported Fashion Store reader tuple Release2/Config3/Package1.2.0");
  });

  test("uses the selected published related collection on both Product composition paths", () => {
    const release = structuredClone(canonicalRelease) as CanonicalCatalogRelease;
    const product = release.products[0]!;
    const selectedCollection = {
      ...structuredClone(release.collections[0]!),
      id: "col_01JTHEMEENGINE000000000002",
      name: "Editor's related edit",
      productIds: [],
      productSlugs: [],
      slug: "related-edit",
    };
    release.collections.push(selectedCollection);
    const experience = structuredClone(liveSnapshot) as ExperienceSnapshot;
    experience.bindings = [
      {
        id: "product-related",
        instanceId: "product",
        kind: "catalog",
        reference: { id: selectedCollection.id, kind: "collection" },
        settingId: "related-collection",
      },
    ];
    experience.resolvedTemplates = [
      {
        id: "product-template",
        pageType: "product",
        requiredCapabilities: [],
        sections: [
          {
            blocks: [],
            capabilities: [],
            id: "product",
            settings: {},
            type: "fashion-store.product",
            visible: true,
          },
        ],
      },
    ];

    const direct = composeProductPageModel({
      experience,
      locale: "en-US",
      productId: product.id,
      release,
      slug: product.slug,
    });
    const route = composeExperienceRoute({
      experience,
      locale: "en-US",
      path: `/products/${product.slug}`,
      release,
      route: testRoute("product", `/products/${product.slug}`, {
        productId: product.id,
        slug: product.slug,
      }),
    });

    expect(direct.relatedCollection?.id).toBe(selectedCollection.id);
    expect(direct.relatedProducts).toEqual([]);
    expect(direct.taxonomy.categories).toEqual([release.collections[0]!.name]);
    expect(route.ok).toBe(true);
    expect(route.viewModels.product.relatedCollection?.id).toBe(selectedCollection.id);
    expect(route.viewModels.product.relatedProducts).toEqual([]);
    expect(route.viewModels.product.taxonomy.categories).toEqual([release.collections[0]!.name]);

    experience.bindings[0]!.reference.id = "col_01JTHEMEENGINE000000000099";
    expect(() =>
      composeProductPageModel({
        experience,
        locale: "en-US",
        productId: product.id,
        release,
        slug: product.slug,
      }),
    ).toThrow("Selected related collection is not published in the Catalog Release.");
  });

  test("composes every generated Fashion Store product route without a product binding", () => {
    const apiValidSnapshot = {
      ...liveSnapshot,
      bindings: [
        {
          id: "home-featured-collection",
          instanceId: "fashion-store-home",
          kind: "catalog",
          reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
          settingId: "featured-collection",
        },
        {
          id: "collection-default-collection",
          instanceId: "fashion-store-collection",
          kind: "catalog",
          reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
          settingId: "default-collection",
        },
      ],
      resolvedTemplates: fashionStorePreset.templates.map((template) => ({
        ...template,
        sections: template.sections.map((section) => ({
          ...section,
          blocks: [...section.blocks],
          capabilities: [...section.capabilities],
          settings: { ...section.settings },
        })),
      })),
      themeId: "fashion-store",
    } satisfies ExperienceSnapshot;
    expect(apiValidSnapshot.bindings.some(({ reference }) => reference.kind === "product")).toBe(
      false,
    );

    const productPaths = themeRoutePaths(fashionStoreThemeRoutes, "live", canonicalRelease).filter(
      (path) => path.startsWith("/products/"),
    );
    expect(productPaths).toHaveLength(canonicalRelease.products.length);
    for (const path of productPaths) {
      const route = resolveThemeRoute(path, fashionStoreThemeRoutes, canonicalRelease, "live");
      expect(route).toBeDefined();
      const result = composeExperienceRoute({
        experience: apiValidSnapshot,
        locale: "en-US",
        path,
        release: canonicalRelease,
        route: route!,
      });
      expect(result.ok, path).toBe(true);
      expect(result.viewModels["fashion-store-product"]).toMatchObject({
        kind: "product",
        resource: { id: route!.parameters!.productId },
      });
    }
  });

  test("projects selected-release products into collection browse view models", () => {
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "selected-collection-binding",
            instanceId: "collection",
            kind: "catalog",
            reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
            settingId: "selected-collection-setting",
          },
        ],
        resolvedTemplates: [
          {
            id: "collection-template",
            pageType: "collection",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "collection",
                settings: {},
                type: "synthetic.collection",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/collections/selected-collection",
      release: canonicalRelease,
      route: testRoute("collection", "/collections/selected-collection", {
        collectionId: canonicalRelease.collections[0].id,
        slug: "selected-collection",
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.viewModels.collection).toMatchObject({
      kind: "collection-grid",
      products: [
        {
          href: "/products/selected-product",
          id: canonicalRelease.products[0].id,
          name: "Selected product",
          compareAtPriceLabel: "$85.00",
          priceLabel: "$65.00",
        },
      ],
      resource: { id: canonicalRelease.collections[0].id, kind: "collection" },
    });
  });

  test("composes the complete live Home sequence and normalized representative card", () => {
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "home-collection-binding",
            instanceId: "home",
            kind: "catalog",
            reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
            settingId: "featured-collection",
          },
        ],
        resolvedTemplates: [
          {
            id: "home-template",
            pageType: "home",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "home",
                settings: {
                  "announcement-text": "Editor announcement",
                  "hero-body": "Explore the selected release.",
                  "hero-eyebrow": "New collection",
                  "hero-image": {
                    alt: "Editor hero",
                    height: 600,
                    key: "catalog/editor-hero.webp",
                    kind: "catalog",
                    width: 800,
                  },
                  "hero-primary-link": {
                    label: "Open selected collection",
                    target: {
                      kind: "internal",
                      reference: {
                        id: canonicalRelease.collections[0].id,
                        kind: "collection",
                      },
                    },
                    targetBehavior: "same-window",
                  },
                  "hero-title": "Fashion for every day",
                  "merchandising-title": "Editor picks",
                },
                type: "fashion-store.home",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/",
      release: canonicalRelease,
      route: testRoute("home", "/"),
    });

    expect(result.ok).toBe(true);
    expect(result.viewModels.home).toMatchObject({
      announcement: "Editor announcement",
      hero: {
        body: "Explore the selected release.",
        eyebrow: "New collection",
        heading: "Fashion for every day",
        media: {
          alt: "Editor hero",
          height: 600,
          src: "https://media.example.test/catalog/editor-hero.webp",
          width: 800,
        },
        primaryLink: {
          href: "/collections/selected-collection",
          label: "Open selected collection",
          targetBehavior: "same-window",
        },
      },
      kind: "home",
      merchandisingTitle: "Editor picks",
      products: [
        {
          actionState: { kind: "available" },
          compareAtPriceLabel: "$85.00",
          href: "/products/selected-product",
          productId: canonicalRelease.products[0].id,
          staticPurchase: {
            kind: "direct-add",
            variantId: canonicalRelease.products[0].variants[0].id,
          },
          variantIds: [canonicalRelease.products[0].variants[0].id],
          visualVariant: "home",
        },
      ],
      sections: [
        { kind: "hero" },
        { kind: "services" },
        { kind: "categories" },
        { kind: "best-sellers" },
        { kind: "promotion" },
        { kind: "collection" },
        { kind: "brands" },
        { kind: "featured-products" },
        { kind: "marquee" },
        { kind: "magazine" },
      ],
    });
  });

  test("projects every Home shell control and independent Catalog reference into live rendering", () => {
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "home-featured-collection",
            instanceId: "home",
            kind: "catalog",
            reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
            settingId: "featured-collection",
          },
          {
            id: "home-featured-product",
            instanceId: "home",
            kind: "catalog",
            reference: { id: canonicalRelease.products[0].id, kind: "product" },
            settingId: "featured-product",
          },
        ],
        resolvedTemplates: [
          {
            id: "home-template",
            pageType: "home",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "home",
                settings: {
                  "announcement-link": {
                    label: "About the offer",
                    target: { kind: "internal", reference: { id: "page.about", kind: "page" } },
                    targetBehavior: "same-window",
                  },
                  "announcement-text": "Editor announcement",
                  "announcement-visible": false,
                  "footer-contact-copy": "Footer support",
                  "footer-legal-link": {
                    label: "Privacy",
                    target: {
                      kind: "internal",
                      reference: { id: "policy.privacy", kind: "policy" },
                    },
                    targetBehavior: "same-window",
                  },
                  "footer-logo": {
                    alt: "Footer editor logo",
                    height: 30,
                    key: "catalog/footer-logo.png",
                    kind: "catalog",
                    width: 140,
                  },
                  "footer-social-link": {
                    label: "Community",
                    target: { kind: "external", url: "https://social.example.test/profile" },
                    targetBehavior: "new-window",
                  },
                  "header-contact-copy": "Header support",
                  "header-highlight-page": { id: "page.about", kind: "page" },
                  "header-legal-link": {
                    label: "Privacy",
                    target: {
                      kind: "internal",
                      reference: { id: "policy.privacy", kind: "policy" },
                    },
                    targetBehavior: "same-window",
                  },
                  "header-logo": {
                    alt: "Header editor logo",
                    height: 34,
                    key: "catalog/header-logo.png",
                    kind: "catalog",
                    width: 155,
                  },
                  "header-social-link": {
                    label: "Follow us",
                    target: { kind: "external", url: "https://social.example.test/store" },
                    targetBehavior: "new-window",
                  },
                  "hero-secondary-link": {
                    label: "Our story",
                    target: { kind: "internal", reference: { id: "page.about", kind: "page" } },
                    targetBehavior: "same-window",
                  },
                  "merchandising-order": 7,
                },
                type: "fashion-store.home",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/",
      release: canonicalRelease,
      route: testRoute("home", "/"),
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.viewModels.home).toMatchObject({
      announcement: undefined,
      announcementLink: {
        href: "/about",
        label: "About the offer",
        targetBehavior: "same-window",
      },
      featuredProduct: { productId: canonicalRelease.products[0].id },
      hero: {
        secondaryLink: {
          href: "/about",
          label: "Our story",
          targetBehavior: "same-window",
        },
      },
      merchandisingOrder: 7,
      shell: {
        footer: {
          contactCopy: "Footer support",
          legalLink: { href: "/policies/privacy", label: "Privacy" },
          logo: { src: "https://media.example.test/catalog/footer-logo.png" },
          socialLink: { href: "https://social.example.test/profile", label: "Community" },
        },
        header: {
          contactCopy: "Header support",
          highlightLink: { href: "/about", label: "about" },
          legalLink: { href: "/policies/privacy", label: "Privacy" },
          logo: { src: "https://media.example.test/catalog/header-logo.png" },
          socialLink: { href: "https://social.example.test/store", label: "Follow us" },
        },
      },
    });
  });

  test("projects persisted Home shell settings for every live Fashion route", () => {
    const experience = {
      ...liveSnapshot,
      bindings: [],
      resolvedTemplates: [
        {
          id: "home-template",
          pageType: "home" as const,
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "home",
              settings: {
                "announcement-text": "One announcement across every route",
                "footer-contact-copy": "Global footer support",
                "header-contact-copy": "Global header support",
                "header-legal-link": {
                  label: "Privacy promise",
                  target: {
                    kind: "internal" as const,
                    reference: { id: "policy.privacy", kind: "policy" as const },
                  },
                  targetBehavior: "same-window" as const,
                },
              },
              type: "fashion-store.home",
              visible: true,
            },
          ],
        },
      ],
    } satisfies ExperienceSnapshot;

    expect(
      composeExperienceShell({
        adapter: fashionStoreCompositionAdapter,
        experience,
        release: canonicalRelease,
      }),
    ).toMatchObject({
      announcement: "One announcement across every route",
      footer: { contactCopy: "Global footer support" },
      header: {
        contactCopy: "Global header support",
        legalLink: {
          href: "/policies/privacy",
          label: "Privacy promise",
          targetBehavior: "same-window",
        },
      },
    });
  });

  test("resolves Theme Logo presentation against the stable Store Identity variant", () => {
    const release = {
      ...canonicalRelease,
      content: [],
      environment: "staging",
      identity: {
        faviconAssetId: null,
        id: "identity.primary",
        logoAssets: [
          {
            assetId: "asset_logo_primary",
            media: {
              alt: "Primary identity",
              height: 60,
              src: "/media/frozen-primary.webp",
              width: 180,
            },
            variant: "primary",
          },
          {
            assetId: "asset_logo_dark",
            media: { alt: "Dark identity", height: 64, src: "/media/frozen-dark.webp", width: 192 },
            variant: "dark",
          },
        ],
        seo: {},
        socialShareAssetId: null,
        storefrontName: "Shared Shoppp Identity",
        tagline: "",
        version: 3,
      },
      navigation: [],
      purpose: "private-preview",
      routeOutput: canonicalRelease.routes,
      schemaVersion: 3,
      sourceVersionVector: [
        {
          digest: "a".repeat(64),
          id: "identity.primary",
          kind: "store-identity",
          version: 3,
        },
      ],
    } satisfies CatalogReleaseV3;
    const experience = {
      ...liveSnapshot,
      bindings: [],
      resolvedTemplates: [
        {
          id: "home-template",
          pageType: "home" as const,
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "home",
              settings: {
                "header-logo": {
                  alt: "Competing Theme Logo",
                  height: 100,
                  kind: "theme" as const,
                  path: "assets/images/competing-logo.png",
                  width: 100,
                },
                "identity-logo-mobile-visible": false,
                "identity-logo-placement": "end",
                "identity-logo-spacing": 12,
                "identity-logo-variant": "dark",
                "identity-logo-visible": true,
                "identity-logo-width": 168,
              },
              type: "fashion-store.home",
              visible: true,
            },
          ],
        },
      ],
    } satisfies ExperienceSnapshot;

    const shell = composeExperienceShell({
      adapter: fashionStoreCompositionAdapter,
      experience,
      release,
    });
    expect(shell?.header).toMatchObject({
      logo: {
        alt: "Dark identity",
        source: "url",
        src: "/media/frozen-dark.webp",
      },
      logoPresentation: {
        assetId: "asset_logo_dark",
        mobileVisible: false,
        placement: "end",
        spacing: 12,
        variant: "dark",
        visible: true,
        width: 168,
      },
    });
    expect(shell?.footer.logoPresentation?.assetId).toBe("asset_logo_dark");
    expect(JSON.stringify(shell)).not.toContain("competing-logo.png");
  });

  test("reads historical schema-v3 Logo references without inventing media", () => {
    const release = {
      ...canonicalRelease,
      content: [],
      environment: "staging",
      identity: {
        faviconAssetId: null,
        id: "identity.primary",
        logoAssets: [{ assetId: "asset_logo_primary", variant: "primary" }],
        seo: {},
        socialShareAssetId: null,
        storefrontName: "Historical Shoppp Identity",
        tagline: "",
        version: 1,
      },
      navigation: [],
      purpose: "private-preview",
      routeOutput: canonicalRelease.routes,
      schemaVersion: 3,
      sourceVersionVector: [
        {
          digest: "a".repeat(64),
          id: "identity.primary",
          kind: "store-identity",
          version: 1,
        },
      ],
    } satisfies CatalogReleaseV3;
    const experience = {
      ...liveSnapshot,
      bindings: [],
      resolvedTemplates: [
        {
          id: "home-template",
          pageType: "home" as const,
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "home",
              settings: {
                "identity-logo-variant": "primary",
                "identity-logo-visible": true,
              },
              type: "fashion-store.home",
              visible: true,
            },
          ],
        },
      ],
    } satisfies ExperienceSnapshot;

    expect(
      composeExperienceShell({
        adapter: fashionStoreCompositionAdapter,
        experience,
        release,
      }),
    ).toMatchObject({
      header: { logo: undefined, logoPresentation: undefined },
    });
  });

  test("projects frozen contact to the live Contact route and both shell surfaces", () => {
    const publicContact = {
      supportEmail: "help@example.test",
      privacyEmail: null,
      publicPhone: null,
      serviceHours: null,
      timeZone: null,
      locations: [],
      socials: [
        {
          id: "09b4b33b-4522-45ab-8541-3f25b7fffc1b",
          platform: "instagram",
          label: "Instagram",
          url: "https://instagram.com/shoppp",
          visible: true,
        },
        {
          id: "c6590c62-30a7-4d88-8998-8cb57f7d3c9e",
          platform: "facebook",
          label: "Facebook",
          url: "https://facebook.com/shoppp",
          visible: true,
        },
      ],
    };
    const experience = {
      ...liveSnapshot,
      contact: { publicContact, version: "a".repeat(64) },
      bindings: [],
      resolvedTemplates: [
        {
          id: "home-template",
          pageType: "home" as const,
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "home",
              settings: {
                "footer-contact-copy": "Demo contact",
                "footer-social-link": {
                  label: "Demo",
                  target: { kind: "external" as const, url: "https://demo.example.test" },
                  targetBehavior: "new-window" as const,
                },
                "header-social-link": {
                  label: "Demo",
                  target: { kind: "external" as const, url: "https://demo.example.test" },
                  targetBehavior: "new-window" as const,
                },
              },
              type: "fashion-store.home",
              visible: true,
            },
          ],
        },
        {
          id: "content-template",
          pageType: "content" as const,
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "contact-content",
              settings: {
                "contact.heading": "Contact us",
                "contact.message": "Choose a way to reach us.",
              },
              type: "fashion-store.content",
              visible: true,
            },
          ],
        },
      ],
    } satisfies ExperienceSnapshot;
    const shell = composeExperienceShell({
      adapter: fashionStoreCompositionAdapter,
      experience,
      release: canonicalRelease,
    });
    expect(shell?.header.publicContact?.socials.map(({ label }) => label)).toEqual([
      "Instagram",
      "Facebook",
    ]);
    expect(shell?.footer.publicContact).toEqual(publicContact);
    expect(shell?.header.socialLink).toBeUndefined();
    expect(shell?.footer.socialLink).toBeUndefined();
    expect(shell?.footer.contactCopy).toBeUndefined();
    const route = composeExperienceRoute({
      experience,
      locale: "en-US",
      path: "/contact",
      release: canonicalRelease,
      route: testRoute("content", "/contact"),
    });
    expect(route.ok).toBe(true);
    expect(route.viewModels["contact-content"]).toMatchObject({
      contactVersion: "a".repeat(64),
      heading: "Contact us",
      kind: "state",
      message: "Choose a way to reach us.",
      publicContact,
      state: "populated",
    });
    const placeholderExperience = structuredClone(experience);
    const contentSection = placeholderExperience.resolvedTemplates.find(
      ({ pageType }) => pageType === "content",
    )?.sections[0];
    if (!contentSection) throw new Error("Missing Contact test section");
    contentSection.settings["contact.message"] = "Merchant contact details will appear here.";
    const placeholderRoute = composeExperienceRoute({
      experience: placeholderExperience,
      locale: "en-US",
      path: "/contact",
      release: canonicalRelease,
      route: testRoute("content", "/contact"),
    });
    expect(placeholderRoute.viewModels["contact-content"]).toMatchObject({
      message: "Choose a published channel below to reach us.",
      state: "populated",
    });
    const emptyRoute = composeExperienceRoute({
      experience: {
        ...experience,
        contact: {
          ...experience.contact,
          publicContact: { ...publicContact, supportEmail: null, socials: [] },
        },
      },
      locale: "en-US",
      path: "/contact",
      release: canonicalRelease,
      route: testRoute("content", "/contact"),
    });
    expect(emptyRoute.viewModels["contact-content"]).toMatchObject({
      kind: "state",
      state: "unavailable",
      publicContact: { supportEmail: null, socials: [] },
    });
  });

  test("projects successor Home shell settings from the renderer-owned source Section", () => {
    const experience = {
      ...liveSnapshot,
      bindings: [],
      resolvedTemplates: [
        {
          id: "home-template",
          pageType: "home" as const,
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "fashion-store-home-hero",
              settings: {
                "announcement-text": "Successor announcement across every route",
                "footer-contact-copy": "Successor footer support",
                "header-contact-copy": "Successor header support",
              },
              type: "fashion-store.hero",
              visible: true,
            },
          ],
        },
      ],
    } satisfies ExperienceSnapshot;

    expect(
      composeExperienceShell({
        adapter: fashionStoreCompositionAdapter,
        experience,
        release: canonicalRelease,
        sectionComposition: fashionStoreSectionComposition,
      }),
    ).toMatchObject({
      announcement: "Successor announcement across every route",
      footer: { contactCopy: "Successor footer support" },
      header: { contactCopy: "Successor header support" },
    });
  });

  test("projects all Experience-owned controls onto authoritative order and policy routes", () => {
    const release = structuredClone(canonicalRelease);
    release.policies.push({
      description: "Shipping policy",
      effectiveDate: "2026-08-11",
      sections: [{ body: "Shipping body", heading: "Shipping" }],
      slug: "shipping",
      title: "Shipping",
    });
    const experience = {
      ...liveSnapshot,
      bindings: [],
      resolvedTemplates: [
        {
          id: "content-template",
          pageType: "content" as const,
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "content",
              settings: {
                "order.help-copy": "Order assistance from Experience",
                "order.policy-link": {
                  label: "Order privacy",
                  target: {
                    kind: "internal" as const,
                    reference: { id: "policy.privacy", kind: "policy" as const },
                  },
                  targetBehavior: "same-window" as const,
                },
                "policy.document": { id: "policy.privacy", kind: "policy" as const },
                "policy.help-copy": "Policy assistance from Experience",
                "policy.related-link": {
                  label: "Shipping terms",
                  target: {
                    kind: "internal" as const,
                    reference: { id: "policy.shipping", kind: "policy" as const },
                  },
                  targetBehavior: "same-window" as const,
                },
              },
              type: "fashion-store.content",
              visible: true,
            },
          ],
        },
      ],
    } satisfies ExperienceSnapshot;

    expect(
      composePlatformRoutePresentation({
        adapter: fashionStoreCompositionAdapter,
        experience,
        path: "/orders/secure-token",
        release,
      }),
    ).toEqual({
      helpCopy: "Order assistance from Experience",
      kind: "order-presentation",
      policyLink: {
        href: "/policies/privacy",
        label: "Order privacy",
        targetBehavior: "same-window",
      },
    });
    expect(
      composePlatformRoutePresentation({
        adapter: fashionStoreCompositionAdapter,
        experience,
        path: "/policies/privacy",
        release,
      }),
    ).toEqual({
      documentLink: {
        href: "/policies/privacy",
        label: "Privacy",
        targetBehavior: "same-window",
      },
      helpCopy: "Policy assistance from Experience",
      kind: "policy-presentation",
      relatedLink: {
        href: "/policies/shipping",
        label: "Shipping terms",
        targetBehavior: "same-window",
      },
    });
  });

  test("projects content media and links plus Product related collection without binding ambiguity", () => {
    const about = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [],
        resolvedTemplates: [
          {
            id: "content-template",
            pageType: "content",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "content",
                settings: {
                  "about.heading": "Editor About",
                  "about.image": {
                    alt: "About editor image",
                    height: 600,
                    key: "catalog/about.webp",
                    kind: "catalog",
                    width: 800,
                  },
                  "about.link": {
                    label: "Read FAQs",
                    target: { kind: "internal", reference: { id: "page.faq", kind: "page" } },
                    targetBehavior: "same-window",
                  },
                  "about.message": "Editor About body",
                  "content-style": "editorial",
                },
                type: "fashion-store.content",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/about",
      release: canonicalRelease,
      route: testRoute("content", "/about"),
    });
    expect(about.viewModels.content).toMatchObject({
      action: { label: "Read FAQs", target: "/faq" },
      media: { src: "https://media.example.test/catalog/about.webp" },
      presentationStyle: "editorial",
    });

    const product = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "product-related",
            instanceId: "product",
            kind: "catalog",
            reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
            settingId: "related-collection",
          },
        ],
        resolvedTemplates: [
          {
            id: "product-template",
            pageType: "product",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "product",
                settings: { "presentation-copy": "Editor product copy" },
                type: "fashion-store.product",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/products/selected-product",
      release: canonicalRelease,
      route: testRoute("product", "/products/selected-product", {
        productId: canonicalRelease.products[0].id,
        slug: canonicalRelease.products[0].slug,
      }),
    });
    expect(product.ok).toBe(true);
    expect(product.viewModels.product).toMatchObject({
      description: "Selected release product",
      descriptionDetail: {
        bullets: [],
        heading: "Selected product",
        media: canonicalRelease.products[0].media.at(-1),
        text: "Selected release product",
      },
      reviewSummary: { count: 0, label: "0 Reviews" },
      relatedCollection: {
        href: "/collections/selected-collection",
        id: canonicalRelease.collections[0].id,
        name: "Selected collection",
      },
      specifications: [],
      taxonomy: { categories: ["Selected collection"], tags: [] },
      variants: [{ id: canonicalRelease.products[0].variants[0].id, selected: true }],
    });

    const productWithoutRelatedBinding = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [],
        resolvedTemplates: [
          {
            id: "product-template",
            pageType: "product",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "product",
                settings: { "presentation-copy": "Editor product copy" },
                type: "fashion-store.product",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/products/selected-product",
      release: canonicalRelease,
      route: testRoute("product", "/products/selected-product", {
        productId: canonicalRelease.products[0].id,
        slug: canonicalRelease.products[0].slug,
      }),
    });
    expect(productWithoutRelatedBinding.viewModels.product).toMatchObject({
      relatedCollection: {
        id: canonicalRelease.collections[0].id,
      },
      relatedProducts: expect.any(Array),
    });
  });

  test("bounds Home to the first 24 eligible products", () => {
    const release = structuredClone(canonicalRelease);
    const sourceProduct = release.products[0]!;
    release.products = Array.from({ length: 25 }, (_, index) => ({
      ...structuredClone(sourceProduct),
      id: `prod_01JTHEMEHOME${String(index).padStart(10, "0")}`,
      name: `Home product ${index}`,
      slug: `home-product-${index}`,
      variants: sourceProduct.variants.map((variant) => ({
        ...structuredClone(variant),
        id: `var_01JTHEMEHOME${String(index).padStart(11, "0")}`,
      })),
    }));
    release.collections[0]!.productIds = release.products.map(({ id }) => id);
    release.collections[0]!.productSlugs = release.products.map(({ slug }) => slug);
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "home-collection-binding",
            instanceId: "home",
            kind: "catalog",
            reference: { id: release.collections[0]!.id, kind: "collection" },
            settingId: "featured-collection",
          },
        ],
        resolvedTemplates: [
          {
            id: "home-template",
            pageType: "home",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "home",
                settings: {},
                type: "fashion-store.home",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/",
      release,
      route: testRoute("home", "/"),
    });
    const products = (result.viewModels.home as { products: Array<{ slug: string }> }).products;

    expect(result.ok).toBe(true);
    expect(products).toHaveLength(24);
    expect(products.at(-1)?.slug).toBe("home-product-23");
  });

  test("routes multi-variant cards to canonical option selection", () => {
    const release = structuredClone(canonicalRelease);
    release.products[0]!.variants.push({
      ...release.products[0]!.variants[0]!,
      id: "var_01JTHEMEENGINE000000000002",
      sku: "SELECTED-L",
      title: "Large",
    });
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "selected-collection-binding",
            instanceId: "collection",
            kind: "catalog",
            reference: { id: release.collections[0].id, kind: "collection" },
            settingId: "selected-collection-setting",
          },
        ],
        resolvedTemplates: [
          {
            id: "collection-template",
            pageType: "collection",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "collection",
                settings: {},
                type: "synthetic.collection",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/collections/selected-collection",
      release,
      route: testRoute("collection", "/collections/selected-collection", {
        collectionId: release.collections[0].id,
        slug: "selected-collection",
      }),
    });

    expect(result.viewModels.collection).toMatchObject({
      kind: "collection-grid",
      products: [
        {
          staticPurchase: {
            href: "/products/selected-product",
            kind: "choose-options",
          },
          variantIds: ["var_01JTHEMEENGINE000000000001", "var_01JTHEMEENGINE000000000002"],
        },
      ],
    });
  });

  test("does not publish a card when any active variant lacks the release currency", () => {
    const release = structuredClone(canonicalRelease);
    release.products[0]!.variants.push({
      ...structuredClone(release.products[0]!.variants[0]!),
      id: "var_01JTHEMEENGINE000000000002",
      prices: [{ amount: 6_500, currency: "EUR" }],
      sku: "SELECTED-EUR",
    });
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "selected-collection-binding",
            instanceId: "collection",
            kind: "catalog",
            reference: { id: release.collections[0].id, kind: "collection" },
            settingId: "selected-collection-setting",
          },
        ],
        resolvedTemplates: [
          {
            id: "collection-template",
            pageType: "collection",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "collection",
                settings: {},
                type: "synthetic.collection",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/collections/selected-collection",
      release,
      route: testRoute("collection", "/collections/selected-collection", {
        collectionId: release.collections[0].id,
        slug: "selected-collection",
      }),
    });

    expect(result.viewModels.collection).toMatchObject({
      kind: "collection-grid",
      products: [],
    });
  });

  test("fails product composition closed when the release currency is unavailable", () => {
    const release = structuredClone(canonicalRelease);
    release.products[0]!.variants[0]!.prices = [{ amount: 6_500, currency: "EUR" }];
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "selected-product-binding",
            instanceId: "product",
            kind: "catalog",
            reference: { id: release.products[0]!.id, kind: "product" },
            settingId: "selected-product-setting",
          },
        ],
        resolvedTemplates: [
          {
            id: "product-template",
            pageType: "product",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "product",
                settings: {},
                type: "synthetic.product",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/products/selected-product",
      release,
      route: testRoute("product", "/products/selected-product", {
        productId: release.products[0]!.id,
        slug: "selected-product",
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.viewModels.product).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "catalog-product-default-currency-missing",
        referenceId: release.products[0]!.id,
        sectionId: "product",
      }),
    );
  });

  test("composes collection aliases from the route registry contract", () => {
    const result = composeExperienceRoute({
      experience: {
        ...liveSnapshot,
        bindings: [
          {
            id: "selected-collection-binding",
            instanceId: "collection",
            kind: "catalog",
            reference: { id: canonicalRelease.collections[0].id, kind: "collection" },
            settingId: "selected-collection-setting",
          },
        ],
        resolvedTemplates: [
          {
            id: "collection-template",
            pageType: "collection",
            requiredCapabilities: [],
            sections: [
              {
                blocks: [],
                capabilities: [],
                id: "collection",
                settings: {},
                type: "synthetic.collection",
                visible: true,
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/shop/no-sidebar",
      release: canonicalRelease,
      route: {
        id: "shop-no-sidebar",
        pageType: "collection",
        path: "/shop/no-sidebar",
        variant: "no-sidebar",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.template?.pageType).toBe("collection");
  });

  test("composes cart and checkout shells without inventing catalog bindings", () => {
    for (const pageType of ["cart", "checkout"] as const) {
      const result = composeExperienceRoute({
        experience: {
          ...liveSnapshot,
          bindings: [],
          resolvedTemplates: [
            {
              id: `${pageType}-template`,
              pageType,
              requiredCapabilities: [],
              sections: [
                {
                  blocks: [],
                  capabilities: [],
                  id: pageType,
                  settings: {
                    "help-copy": `${pageType} editor help`,
                    "policy-link": {
                      label: "Privacy",
                      target: {
                        kind: "internal",
                        reference: { id: "policy.privacy", kind: "policy" },
                      },
                      targetBehavior: "same-window",
                    },
                  },
                  type: `synthetic.${pageType}`,
                  visible: true,
                },
              ],
            },
          ],
        },
        locale: "en-US",
        path: `/${pageType}`,
        release: canonicalRelease,
        route: testRoute(pageType, `/${pageType}`),
      });

      expect(result.ok).toBe(true);
      expect(result.diagnostics).toEqual([]);
      expect(result.viewModels[pageType]).toMatchObject({
        helpCopy: `${pageType} editor help`,
        kind: pageType,
        policyLink: { href: "/policies/privacy", label: "Privacy" },
        state: "populated",
      });
    }
  });

  test("composes truthful content states from Experience settings without catalog or fixture bindings", () => {
    const contentExperience = {
      ...liveSnapshot,
      bindings: [],
      resolvedTemplates: [
        {
          id: "content-template",
          pageType: "content",
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "content",
              settings: {
                "account.heading": "Member area",
                "account.message": "Sign in to continue.",
                "magazine.heading": "Journal",
                "magazine.featured-article": {
                  id: "article.marketing-tips-and-tricks",
                  kind: "article",
                },
                "magazine.message": "Stories selected by the merchant.",
                "wishlist.heading": "Saved products",
                "wishlist.message": "Your saved products.",
              },
              type: "synthetic.content",
              visible: true,
            },
          ],
        },
      ],
    } satisfies ExperienceSnapshot;

    const unavailable = composeExperienceRoute({
      experience: contentExperience,
      locale: "en-US",
      path: "/account",
      release: canonicalRelease,
      route: testRoute("content", "/account"),
    });
    expect(unavailable.ok).toBe(true);
    expect(unavailable.viewModels.content).toMatchObject({
      action: { label: "Continue shopping", target: "/shop" },
      heading: "Member area",
      kind: "state",
      message: "Sign in to continue.",
      state: "unavailable",
    });

    const wishlist = composeExperienceRoute({
      experience: contentExperience,
      locale: "en-US",
      path: "/wishlist",
      release: canonicalRelease,
      route: testRoute("content", "/wishlist"),
    });
    expect(wishlist.ok).toBe(true);
    expect(wishlist.viewModels.content).toMatchObject({
      description: "Your saved products.",
      heading: "Saved products",
      kind: "collection-grid",
      products: [
        expect.objectContaining({
          href: `/products/${canonicalRelease.products[0].slug}`,
          productId: canonicalRelease.products[0].id,
        }),
      ],
      state: "unavailable",
    });

    const releaseWithoutPublishedProducts = structuredClone(canonicalRelease);
    releaseWithoutPublishedProducts.products[0]!.status = "draft";
    const emptyWishlist = composeExperienceRoute({
      experience: contentExperience,
      locale: "en-US",
      path: "/wishlist",
      release: releaseWithoutPublishedProducts,
      route: testRoute("content", "/wishlist"),
    });
    expect(emptyWishlist.viewModels.content).toMatchObject({
      kind: "collection-grid",
      products: [],
      state: "unavailable",
    });

    const wishlistRelease = structuredClone(canonicalRelease);
    const wishlistProduct = wishlistRelease.products[0]!;
    wishlistRelease.collections = [];
    wishlistRelease.products = Array.from({ length: 8 }, (_, index) => ({
      ...structuredClone(wishlistProduct),
      collectionIds: [],
      collectionSlugs: [],
      id: `prod_01JTHEMEWISHLIST${String(index).padStart(8, "0")}`,
      slug: `wishlist-product-${index}`,
      status: index === 0 ? ("draft" as const) : wishlistProduct.status,
      variants: wishlistProduct.variants.map((variant) => ({
        ...variant,
        id: `var_01JTHEMEWISHLIST${String(index).padStart(9, "0")}`,
        prices:
          index === 2 ? [{ amount: 6_500, currency: "EUR" }] : structuredClone(variant.prices),
        status: index === 4 ? ("disabled" as const) : variant.status,
      })),
    }));
    const boundedWishlist = composeExperienceRoute({
      experience: contentExperience,
      locale: "en-US",
      path: "/wishlist",
      release: wishlistRelease,
      route: testRoute("content", "/wishlist"),
    });
    expect(
      (boundedWishlist.viewModels.content as { products: Array<{ slug: string }> }).products.map(
        ({ slug }) => slug,
      ),
    ).toEqual([
      "wishlist-product-1",
      "wishlist-product-3",
      "wishlist-product-5",
      "wishlist-product-6",
    ]);

    const configured = composeExperienceRoute({
      experience: contentExperience,
      locale: "en-US",
      path: "/magazine",
      release: canonicalRelease,
      route: testRoute("content", "/magazine"),
    });
    expect(configured.ok).toBe(true);
    expect(configured.viewModels.content).toMatchObject({
      heading: "Journal",
      kind: "state",
      message: "Stories selected by the merchant.",
      relatedAction: {
        label: "article",
        target: "/magazine/marketing-tips-and-tricks",
      },
      state: "populated",
    });
  });

  test("returns actionable diagnostics for every product and collection reference state", () => {
    const cases = [
      {
        label: "missing product",
        code: "catalog-reference-missing",
        reference: { id: "prod_01JTHEMEENGINEMISSING00001", kind: "product" } as const,
        release: canonicalRelease,
      },
      {
        label: "deleted collection",
        code: "catalog-reference-missing",
        reference: { id: canonicalRelease.collections[0].id, kind: "collection" } as const,
        release: {
          ...canonicalRelease,
          collections: [],
          products: [
            {
              ...canonicalRelease.products[0],
              collectionIds: [],
              collectionSlugs: [],
            },
          ],
        } satisfies CanonicalCatalogRelease,
      },
      {
        label: "product reference with collection ID",
        code: "catalog-reference-wrong-kind",
        reference: { id: canonicalRelease.collections[0].id, kind: "product" } as const,
        release: canonicalRelease,
      },
      {
        label: "collection reference with product ID",
        code: "catalog-reference-wrong-kind",
        reference: { id: canonicalRelease.products[0].id, kind: "collection" } as const,
        release: canonicalRelease,
      },
      {
        label: "draft product",
        code: "catalog-reference-unpublished",
        reference: { id: canonicalRelease.products[0].id, kind: "product" } as const,
        release: {
          ...canonicalRelease,
          products: [{ ...canonicalRelease.products[0], status: "draft" }],
        } satisfies CanonicalCatalogRelease,
      },
      {
        label: "archived collection",
        code: "catalog-reference-unpublished",
        reference: { id: canonicalRelease.collections[0].id, kind: "collection" } as const,
        release: {
          ...canonicalRelease,
          collections: [{ ...canonicalRelease.collections[0], status: "archived" }],
        } satisfies CanonicalCatalogRelease,
      },
      {
        label: "product with no active variant",
        code: "catalog-reference-unpublished",
        reference: { id: canonicalRelease.products[0].id, kind: "product" } as const,
        release: {
          ...canonicalRelease,
          products: [
            {
              ...canonicalRelease.products[0],
              variants: canonicalRelease.products[0].variants.map((variant) => ({
                ...variant,
                status: "disabled" as const,
              })),
            },
          ],
        } satisfies CanonicalCatalogRelease,
      },
    ];

    for (const entry of cases) {
      const result = composeExperienceRoute({
        experience: {
          ...liveSnapshot,
          bindings: [
            {
              id: "featured-product",
              instanceId: "hero",
              kind: "catalog",
              reference: entry.reference,
              settingId: "featured-product-setting",
            },
          ],
        },
        locale: "en-US",
        path: "/",
        release: entry.release,
        route: testRoute("home", "/"),
      });
      expect(result.ok, entry.label).toBe(false);
      expect(result.diagnostics[0], entry.label).toMatchObject({
        code: entry.code,
        pageId: "home",
        path: "/",
        referenceId: entry.reference.id,
        referenceKind: entry.reference.kind,
        sectionId: "hero",
        settingId: "featured-product-setting",
      });
    }

    const empty = composeExperienceRoute({
      experience: { ...liveSnapshot, bindings: [] },
      locale: "en-US",
      path: "/",
      release: canonicalRelease,
      route: testRoute("home", "/"),
    });
    expect(empty.diagnostics[0]).toMatchObject({
      code: "catalog-binding-missing",
      pageId: "home",
      path: "/",
      sectionId: "hero",
    });
  });

  test("keeps fixture and live providers isolated with no fallback or Commerce request", () => {
    const fixtureProvider = createFixturePresentationProvider({
      bindings: [
        {
          fixtureId: "fixture-home",
          id: "fixture-home-binding",
          instanceId: "hero",
          kind: "fixture",
          resource: "hero",
          state: "populated",
        },
      ],
      fixtures: {
        "fixture-home": {
          id: "fixture-home",
          label: "Fixture home",
          pageTypes: ["home"],
          shellViewModels: {
            hero: {
              footer: { contactCopy: "Fixture footer" },
              header: { contactCopy: "Fixture header" },
            },
          },
          viewModels: {
            hero: {
              body: "Fixture body",
              eyebrow: "Fixture",
              heading: "Fixture heading",
              kind: "hero",
              state: "populated",
            },
          },
        },
      },
    });
    const first = fixtureProvider.resolve({ instanceId: "hero" });
    const second = fixtureProvider.resolve({ instanceId: "hero" });
    expect(second).toEqual(first);
    expect(fixtureProvider.resolve({ expectedKind: "hero", instanceId: "hero" })).toEqual(first);
    expect(() => fixtureProvider.resolve({ expectedKind: "product", instanceId: "hero" })).toThrow(
      "does not match declared kind",
    );
    expect(fixtureProvider.resolveShell?.({ instanceId: "hero", resource: "hero" })).toEqual({
      footer: { contactCopy: "Fixture footer" },
      header: { contactCopy: "Fixture header" },
    });
    expect(selectPresentationProvider({ fixtureProvider, mode: "fixture-preview" })).toBe(
      fixtureProvider,
    );
    expect(selectPresentationProvider({ fixtureProvider, mode: "live" })).toBeUndefined();

    const commercePort = () => "commerce-called";
    expect(selectLivePort("fixture-preview", commercePort)).toBeUndefined();
    expect(selectLivePort("production", commercePort)).toBeUndefined();
    expect(selectLivePort("live", commercePort)).toBe(commercePort);

    const liveInput = {
      experience: { ...liveSnapshot, bindings: [] },
      locale: "en-US",
      path: "/",
      release: canonicalRelease,
      route: testRoute("home", "/"),
    };
    const liveProvider = createLivePresentationProvider(liveInput);
    expect(selectPresentationProvider({ fixtureProvider, liveInput, mode: "live" })).not.toBe(
      fixtureProvider,
    );
    expect(() => liveProvider.resolve({ instanceId: "hero" })).toThrow("catalog-binding-missing");
    expect(() =>
      resolveFixtureBinding(
        "hero",
        liveSnapshot.bindings.filter((binding) => binding.kind === "fixture"),
      ),
    ).toThrow("missing a fixture binding");
  });

  test("uses declared Section resolvers without inventing catalog bindings", () => {
    const decorativeDescriptor = {
      rendererShell: {
        fixtureResource: "decorative",
        liveResolver: "experience-shell",
        owner: "renderer",
        sourceSectionType: "synthetic.decorative",
      },
      sections: {
        "synthetic.decorative": {
          bindings: [],
          fixture: { kind: "theme-section" },
          live: { kind: "theme-section", resolver: "theme-section" },
          shell: "none",
        },
      },
    } as const;
    const decorativeExperience = {
      ...liveSnapshot,
      bindings: [],
      resolvedTemplates: [
        {
          id: "home",
          pageType: "home",
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "decorative",
              settings: { heading: "No catalog needed" },
              type: "synthetic.decorative",
              visible: true,
            },
          ],
        },
      ],
    } satisfies ExperienceSnapshot;
    const decorative = composeExperienceRouteWithoutAdapter({
      experience: decorativeExperience,
      locale: "en-US",
      path: "/",
      release: canonicalRelease,
      route: testRoute("home", "/"),
      sectionComposition: decorativeDescriptor,
    });

    expect(decorative.ok).toBe(true);
    expect(decorative.viewModels.decorative).toEqual({
      data: { settings: { heading: "No catalog needed" } },
      kind: "theme-section",
      state: "populated",
    });
    expect(decorative.shell).toBeDefined();
    const fixtureProvider = createFixturePresentationProvider({
      bindings: [
        {
          fixtureId: "decorative-fixture",
          id: "decorative-binding",
          instanceId: "decorative",
          kind: "fixture",
          resource: "decorative",
          state: "populated",
        },
      ],
      fixtures: {
        "decorative-fixture": {
          id: "decorative-fixture",
          label: "Decorative fixture",
          pageTypes: ["home"],
          shellViewModels: { decorative: decorative.shell! },
          viewModels: { decorative: decorative.viewModels.decorative! },
        },
      },
    });
    expect(fixtureProvider.resolve({ instanceId: "decorative" }).kind).toBe(
      decorative.viewModels.decorative?.kind,
    );
    expect(
      fixtureProvider.resolveShell?.({ instanceId: "decorative", resource: "decorative" }),
    ).toEqual(decorative.shell);

    const commerce = composeExperienceRouteWithoutAdapter({
      experience: {
        ...decorativeExperience,
        resolvedTemplates: [
          {
            ...decorativeExperience.resolvedTemplates[0],
            sections: [
              {
                ...decorativeExperience.resolvedTemplates[0]!.sections[0]!,
                type: "synthetic.collection",
              },
            ],
          },
        ],
      },
      locale: "en-US",
      path: "/",
      release: canonicalRelease,
      route: testRoute("home", "/"),
      sectionComposition: {
        sections: {
          "synthetic.collection": {
            bindings: [
              {
                cardinality: "required",
                name: "collection",
                referenceKind: "collection",
                settingId: "featured-collection",
              },
            ],
            fixture: { kind: "collection-grid" },
            live: { kind: "collection-grid", resolver: "collection" },
            shell: "none",
          },
        },
      },
    });

    expect(commerce.ok).toBe(false);
    expect(commerce.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "catalog-binding-missing",
        sectionId: "decorative",
        settingId: "featured-collection",
      }),
    );
  });
});

describe("typed theme registry", () => {
  const components = {
    action: {} as Component,
    footer: {} as Component,
    hero: {} as Component,
  };
  const core = {
    blocks: { "core.action": components.action },
    sections: { "core.legal-footer": components.footer },
  } satisfies ThemeRegistry;
  const synthetic = {
    blocks: {},
    sections: {
      "synthetic.editorial": {} as Component,
      "synthetic.hero": components.hero,
    },
  } satisfies ThemeRegistry;

  test("composes core and namespaced registries and keeps configured order", () => {
    const plan = renderTemplatePlan(template, composeThemeRegistries(core, synthetic));

    expect(plan.map(({ instance }) => instance.id)).toEqual(["hero", "legal-footer"]);
    expect(plan[0]?.component).toBe(components.hero);
    expect(plan[0]?.blocks.map(({ instance }) => instance.id)).toEqual(["hero-action"]);
    expect(plan[1]?.component).toBe(components.footer);
  });

  test("rejects duplicate registrations and unknown visible components", () => {
    expect(() =>
      composeThemeRegistries(core, {
        blocks: { "core.action": {} as Component },
        sections: {},
      }),
    ).toThrow("duplicate");
    expect(() =>
      renderTemplatePlan(
        {
          ...template,
          sections: [{ ...template.sections[0]!, type: "synthetic.unknown" }],
        },
        composeThemeRegistries(core, synthetic),
      ),
    ).toThrow("not registered");
  });

  test("keeps legacy registries unchanged and plans one renderer-owned shell around ordered Sections", () => {
    const shell = {} as Component;
    const sectionComponents = {
      editorial: {} as Component,
      hero: {} as Component,
      promotion: {} as Component,
    };
    const probeTemplate = {
      id: "probe-home",
      pageType: "home",
      requiredCapabilities: [],
      sections: [
        {
          blocks: [],
          capabilities: [],
          id: "probe-hero",
          settings: {},
          type: "probe.hero",
          visible: true,
        },
        {
          blocks: [],
          capabilities: [],
          id: "probe-promotion",
          settings: {},
          type: "probe.promotion",
          visible: true,
        },
        {
          blocks: [],
          capabilities: [],
          id: "probe-editorial",
          settings: {},
          type: "probe.editorial",
          visible: true,
        },
      ],
    } satisfies PageTemplate;
    const descriptor = {
      rendererShell: {
        fixtureResource: "shell",
        liveResolver: "experience-shell",
        owner: "renderer",
        sourceSectionType: "probe.hero",
      },
      sections: Object.fromEntries(
        ["probe.hero", "probe.promotion", "probe.editorial"].map((type) => [
          type,
          {
            bindings: [],
            fixture: { kind: "theme-section" },
            live: { kind: "theme-section", resolver: "theme-section" },
            shell: "none",
          },
        ]),
      ),
    } as const;
    const probe = {
      blocks: {},
      rendererShell: shell,
      sectionComposition: descriptor,
      sections: {
        "probe.editorial": sectionComponents.editorial,
        "probe.hero": sectionComponents.hero,
        "probe.promotion": sectionComponents.promotion,
      },
    } satisfies ThemeRegistry;

    const serverTree = renderThemeTreePlan(probeTemplate, probe);
    const hydrationTree = renderThemeTreePlan(structuredClone(probeTemplate), probe);
    expect(serverTree).toMatchObject({
      sections: [
        { component: sectionComponents.hero, expectedViewModelKind: "theme-section" },
        { component: sectionComponents.promotion, expectedViewModelKind: "theme-section" },
        { component: sectionComponents.editorial, expectedViewModelKind: "theme-section" },
      ],
      shell,
    });
    expect(hydrationTree.sections.map(({ instance }) => instance.id)).toEqual(
      serverTree.sections.map(({ instance }) => instance.id),
    );
    expect(new Set(serverTree.sections.map(({ instance }) => instance.id)).size).toBe(3);
    expect(hydrationTree.shell).toBe(serverTree.shell);
    expect(
      renderThemeTreePlan({ ...probeTemplate, sections: [] }, synthetic).shell,
    ).toBeUndefined();
  });

  test("rejects descriptor, registry, and shell ownership mismatches before rendering", () => {
    const section = {} as Component;
    const descriptor = {
      rendererShell: {
        fixtureResource: "shell",
        liveResolver: "experience-shell",
        owner: "renderer",
        sourceSectionType: "probe.hero",
      },
      sections: {
        "probe.hero": {
          bindings: [],
          fixture: { kind: "theme-section" },
          live: { kind: "theme-section", resolver: "theme-section" },
          shell: "none",
        },
      },
    } as const;

    expect(() =>
      validateThemeRegistryComposition(
        { blocks: {}, sectionComposition: descriptor, sections: { "probe.hero": section } },
        ["probe.hero"],
      ),
    ).toThrow("renderer shell");
    expect(() =>
      validateThemeRegistryComposition(
        {
          blocks: {},
          rendererShell: {} as Component,
          sectionComposition: descriptor,
          sections: {},
        },
        [],
      ),
    ).toThrow("registered manifest Section");
    expect(() =>
      renderThemeTreePlan(
        {
          id: "probe-home",
          pageType: "home",
          requiredCapabilities: [],
          sections: [
            {
              blocks: [],
              capabilities: [],
              id: "probe-hero",
              required: true,
              settings: {},
              type: "probe.hero",
              visible: true,
            },
          ],
        },
        {
          blocks: {},
          rendererShell: {} as Component,
          sectionComposition: {
            ...descriptor,
            sections: {
              "probe.hero": { ...descriptor.sections["probe.hero"], shell: "page" },
            },
          },
          sections: { "probe.hero": section },
        },
      ),
    ).toThrow("duplicate shell ownership");
  });

  test("applies renderer shell ownership only to templates covered by a partial descriptor", () => {
    const shell = {} as Component;
    const homeSection = {} as Component;
    const legacyPage = {} as Component;
    const registry = {
      blocks: {},
      rendererShell: shell,
      sectionComposition: {
        pageTypes: ["home"],
        rendererShell: {
          fixtureResource: "home",
          liveResolver: "experience-shell",
          owner: "renderer",
          sourceSectionType: "probe.hero",
        },
        sections: {
          "probe.hero": {
            bindings: [],
            fixture: { kind: "theme-section" },
            live: { kind: "theme-section", resolver: "theme-section" },
            shell: "none",
          },
        },
      },
      sections: { "probe.hero": homeSection, "probe.legacy": legacyPage },
    } as const satisfies ThemeRegistry;
    const home = {
      id: "home",
      pageType: "home",
      requiredCapabilities: [],
      sections: [
        {
          blocks: [],
          capabilities: [],
          id: "hero",
          required: true,
          settings: {},
          type: "probe.hero",
          visible: true,
        },
      ],
    } as const satisfies PageTemplate;
    const legacy = {
      ...home,
      id: "content",
      pageType: "content",
      sections: [{ ...home.sections[0], id: "legacy", type: "probe.legacy" }],
    } as const satisfies PageTemplate;

    expect(renderThemeTreePlan(home, registry).shell).toBe(shell);
    expect(renderThemeTreePlan(legacy, registry).shell).toBeUndefined();
    expect(
      renderThemeTreePlan(legacy, registry).sections[0]?.expectedViewModelKind,
    ).toBeUndefined();
    expect(() =>
      renderThemeTreePlan(
        {
          ...home,
          sections: [...home.sections, { ...home.sections[0], id: "mixed", type: "probe.legacy" }],
        },
        registry,
      ),
    ).toThrow("covered template");
  });
});

class MemoryBucket implements PreviewArtifactBucket {
  readonly objects = new Map<
    string,
    {
      body: Uint8Array;
      customMetadata?: Record<string, string>;
      httpMetadata?: { contentType?: string };
    }
  >();
  puts = 0;

  async get(key: string): Promise<PreviewArtifactObject | null> {
    const value = this.objects.get(key);
    if (!value) return null;
    return {
      body: value.body,
      customMetadata: value.customMetadata,
      httpMetadata: value.httpMetadata,
    };
  }

  async head(key: string): Promise<PreviewArtifactObject | null> {
    return this.get(key);
  }

  async put(
    key: string,
    body: Uint8Array,
    options: {
      customMetadata: Record<string, string>;
      httpMetadata: { contentType: string };
    },
  ): Promise<void> {
    this.puts += 1;
    this.objects.set(key, {
      body: structuredClone(body),
      customMetadata: options.customMetadata,
      httpMetadata: options.httpMetadata,
    });
  }
}

const previewFiles = [
  {
    body: new TextEncoder().encode("<!doctype html><h1>Preview</h1>"),
    contentType: "text/html; charset=utf-8",
    path: "index.html",
  },
  {
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    path: "_nuxt/image.png",
  },
];

describe("private preview artifacts", () => {
  test("uploads identical output idempotently and isolates snapshot prefixes", async () => {
    const bucket = new MemoryBucket();
    const first = await uploadPreviewArtifact(bucket, "snapshot-synthetic-1", previewFiles);
    const putCount = bucket.puts;
    const repeated = await uploadPreviewArtifact(bucket, "snapshot-synthetic-1", previewFiles);
    const other = await uploadPreviewArtifact(bucket, "snapshot-fashion-store", previewFiles);

    expect(repeated).toEqual(first);
    expect(bucket.puts).toBe(putCount + previewFiles.length + 1);
    expect(other.digest).toBe(first.digest);
    expect(other.prefix).not.toBe(first.prefix);
    await expect(
      uploadPreviewArtifact(bucket, "snapshot-synthetic-1", previewFiles, "0".repeat(64)),
    ).rejects.toThrow("digest");
  });

  test("binds live artifact storage to the selected Catalog Release", async () => {
    const bucket = new MemoryBucket();
    const artifact = await uploadPreviewArtifact(
      bucket,
      "snapshot-synthetic-1",
      previewFiles,
      undefined,
      "release-theme-engine-a",
    );

    expect(artifact.prefix).toBe(
      `snapshots/snapshot-synthetic-1/release-theme-engine-a/${artifact.digest}`,
    );
    expect(bucket.objects.get(`${artifact.prefix}/index.html`)?.customMetadata).toMatchObject({
      catalogReleaseId: "release-theme-engine-a",
      snapshotId: "snapshot-synthetic-1",
    });
  });

  test("normalizes assets and rejects traversal including encoded traversal", () => {
    expect(normalizePreviewAssetPath("/")).toBe("index.html");
    expect(normalizePreviewAssetPath("/products/")).toBe("products/index.html");
    expect(normalizePreviewAssetPath("/_nuxt/app.js")).toBe("_nuxt/app.js");
    for (const path of ["/../secret", "/%2e%2e/secret", "/%252e%252e/secret", "/a\\b"]) {
      expect(() => normalizePreviewAssetPath(path)).toThrow("path");
    }
  });

  test("packages complete static output with declared content types", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "shoppp-preview-output-"));
    try {
      const output = resolve(directory, "public");
      const manifestPath = resolve(directory, "artifact-manifest.json");
      await mkdir(resolve(output, "_nuxt"), { recursive: true });
      await Promise.all([
        writeFile(resolve(output, "index.html"), "<!doctype html><h1>Preview</h1>"),
        writeFile(resolve(output, "_nuxt/app.js"), "export {};\n"),
      ]);

      const artifact = await packagePreviewArtifact({
        manifestPath,
        outputRoot: output,
        snapshotId: "snapshot-synthetic-1",
      });

      expect(artifact.files.map(({ path }) => path)).toEqual(["_nuxt/app.js", "index.html"]);
      expect(artifact.files[0]?.contentType).toBe("text/javascript; charset=utf-8");
      expect(JSON.parse(await readFile(manifestPath, "utf8"))).toMatchObject({
        schemaVersion: 1,
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("serves only authorized exact-prefix objects with private security headers", async () => {
    const bucket = new MemoryBucket();
    const artifact = await uploadPreviewArtifact(bucket, "snapshot-synthetic-1", previewFiles);
    const auth = {
      fetch: async () =>
        Response.json({
          artifactPrefix: artifact.prefix,
          authorized: true,
          expiresAt: "2026-07-30T02:00:00.000Z",
          mediaOrigins: ["https://media.example.test"],
          origin: "https://preview.example.test",
        }),
    };
    const handler = createPreviewAccessHandler({
      now: () => new Date("2026-07-30T01:30:00.000Z"),
    });
    const response = await handler(
      new Request("https://preview.example.test/", {
        headers: { Cookie: `__Host-shoppp-preview=${"a".repeat(32)}` },
      }),
      {
        PREVIEW_ARTIFACTS: bucket,
        PREVIEW_AUTH: auth,
        PREVIEW_AUTH_TOKEN: "preview-auth-token-000000000000000001",
        PREVIEW_HANDOFF_ORIGIN: "https://admin.example.test",
        PREVIEW_ORIGIN: "https://preview.example.test",
      },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<h1>Preview</h1>");
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "https://preview.example.test",
    );
    expect(response.headers.get("Content-Security-Policy")).toContain("connect-src 'self'");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "img-src https://preview.example.test https://media.example.test",
    );
  });

  test("rejects malformed, duplicate, or over-broad media origins from preview authorization", async () => {
    const bucket = new MemoryBucket();
    const artifact = await uploadPreviewArtifact(bucket, "snapshot-synthetic-1", previewFiles);
    const handler = createPreviewAccessHandler({
      now: () => new Date("2026-07-30T01:30:00.000Z"),
    });
    for (const mediaOrigins of [
      ["http://media.example.test"],
      ["https://media.example.test/path"],
      ["https://user@media.example.test"],
      ["https://media.example.test", "https://media.example.test"],
      Array.from({ length: 9 }, (_, index) => `https://media-${index}.example.test`),
    ]) {
      const response = await handler(
        new Request("https://preview.example.test/", {
          headers: { Cookie: `__Host-shoppp-preview=${"a".repeat(32)}` },
        }),
        {
          PREVIEW_ARTIFACTS: bucket,
          PREVIEW_AUTH: {
            fetch: async () =>
              Response.json({
                artifactPrefix: artifact.prefix,
                authorized: true,
                expiresAt: "2026-07-30T02:00:00.000Z",
                mediaOrigins,
                origin: "https://preview.example.test",
              }),
          },
          PREVIEW_AUTH_TOKEN: "preview-auth-token-000000000000000001",
          PREVIEW_HANDOFF_ORIGIN: "https://admin.example.test",
          PREVIEW_ORIGIN: "https://preview.example.test",
        },
      );
      expect(response.status).toBe(403);
      for (const mediaOrigin of mediaOrigins) {
        expect(response.headers.get("Content-Security-Policy")).not.toContain(mediaOrigin);
      }
    }
  });

  test("redeems a grant only through POST and sets a strict host-only session cookie", async () => {
    const grant = "grant_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const authRequests: Request[] = [];
    const handler = createPreviewAccessHandler();
    const environment = {
      PREVIEW_ARTIFACTS: new MemoryBucket(),
      PREVIEW_AUTH: {
        fetch: async (request: Request) => {
          authRequests.push(request);
          return Response.json({
            data: {
              expiresAt: "2099-07-30T02:00:00.000Z",
              session: "session_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
            },
          });
        },
      },
      PREVIEW_AUTH_TOKEN: "preview-auth-token-000000000000000001",
      PREVIEW_HANDOFF_ORIGIN: "https://admin.example.test",
      PREVIEW_ORIGIN: "https://preview.example.test",
    };
    const rejected = await handler(
      new Request("https://preview.example.test/__preview/session", {
        body: new URLSearchParams({ grant }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://attacker.example.test",
        },
        method: "POST",
      }),
      environment,
    );
    expect(rejected.status).toBe(403);
    expect(authRequests).toHaveLength(0);
    const response = await handler(
      new Request("https://preview.example.test/__preview/session", {
        body: new URLSearchParams({ grant }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://admin.example.test",
        },
        method: "POST",
      }),
      environment,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/");
    expect(response.headers.get("Location")).not.toContain(grant);
    expect(response.headers.get("Set-Cookie")).toContain(
      "__Host-shoppp-preview=session_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    );
    expect(response.headers.get("Set-Cookie")).toContain("Path=/; Expires=");
    expect(response.headers.get("Set-Cookie")).toContain("Secure; HttpOnly; SameSite=Strict");
    expect(authRequests).toHaveLength(1);
    expect(authRequests[0]?.url).toBe("https://preview-auth.internal/internal/preview/redeem");
    expect(authRequests[0]?.headers.get("Authorization")).toBe(
      "Bearer preview-auth-token-000000000000000001",
    );
  });

  test("returns authorization or real 404 responses without crossing prefixes", async () => {
    const bucket = new MemoryBucket();
    const handler = createPreviewAccessHandler({
      now: () => new Date("2026-07-30T03:00:00.000Z"),
    });
    const environment = {
      PREVIEW_ARTIFACTS: bucket,
      PREVIEW_AUTH: {
        fetch: async () =>
          Response.json({
            artifactPrefix: `snapshots/snapshot-synthetic-1/${"a".repeat(64)}`,
            authorized: true,
            expiresAt: "2026-07-30T02:00:00.000Z",
            origin: "https://preview.example.test",
          }),
      },
      PREVIEW_AUTH_TOKEN: "preview-auth-token-000000000000000001",
      PREVIEW_HANDOFF_ORIGIN: "https://admin.example.test",
      PREVIEW_ORIGIN: "https://preview.example.test",
    };

    expect((await handler(new Request("https://preview.example.test/"), environment)).status).toBe(
      401,
    );
    expect(
      (
        await handler(
          new Request("https://preview.example.test/", {
            headers: { Cookie: `__Host-shoppp-preview=${"a".repeat(32)}` },
          }),
          environment,
        )
      ).status,
    ).toBe(403);

    const unexpired = {
      ...environment,
      PREVIEW_AUTH: {
        fetch: async () =>
          Response.json({
            artifactPrefix: `snapshots/snapshot-synthetic-1/${"a".repeat(64)}`,
            authorized: true,
            expiresAt: "2026-07-30T04:00:00.000Z",
            origin: "https://preview.example.test",
          }),
      },
    };
    expect(
      (
        await handler(
          new Request("https://preview.example.test/missing.html", {
            headers: { Cookie: `__Host-shoppp-preview=${"a".repeat(32)}` },
          }),
          unexpired,
        )
      ).status,
    ).toBe(404);
  });
});

test("production Wrangler configuration has no preview binding or entrypoint", async () => {
  const configuration = await readFile(resolve(import.meta.dir, "../wrangler.jsonc"), "utf8");

  expect(configuration).not.toContain("PREVIEW_ARTIFACTS");
  expect(configuration).not.toContain("preview-access.ts");
});
