import { describe, expect, test } from "bun:test";

import {
  assetReferenceSchema,
  catalogResourceBindingSchema,
  catalogResourceReferenceSchema,
  experienceSnapshotSchema,
  linkTargetSchema,
  presentationProductSchema,
  settingDefinitionSchema,
  storefrontLinkSchema,
  storefrontResourceReferenceSchema,
  storefrontIntentActionSchema,
  themePackageSchema,
  type PresentationProduct,
  type ThemePackage,
} from "../src/storefront-experience";

const validThemePackage = {
  manifest: {
    approvedRemoteMediaHosts: ["cdn.example.test"],
    componentRegistry: {
      blocks: [
        {
          capabilities: ["product.action"],
          settings: [
            {
              default: "Add to bag",
              id: "label",
              kind: "text",
              maxLength: 80,
              required: true,
            },
          ],
          type: "core.product-action",
        },
      ],
      sections: [
        {
          allowedBlockTypes: ["core.product-action"],
          capabilities: ["product.details"],
          settings: [
            {
              default: "Seasonal edit",
              id: "heading",
              kind: "text",
              maxLength: 120,
              required: true,
            },
            {
              default: {
                alt: "Model wearing the seasonal edit",
                height: 1200,
                kind: "theme",
                path: "assets/hero.webp",
                width: 1600,
              },
              id: "media",
              kind: "asset",
              required: true,
            },
          ],
          type: "synthetic.hero",
        },
        {
          allowedBlockTypes: [],
          capabilities: ["legal.links"],
          settings: [],
          type: "core.legal-footer",
        },
      ],
    },
    configurationSchemaVersion: 1,
    designTokens: {
      "color-accent": "#111111",
      "font-body": "system-ui",
    },
    id: "synthetic",
    platformCompatibility: {
      maxExclusive: "2.0.0",
      min: "1.0.0",
    },
    platformContractVersion: "1.0.0",
    provenance: {
      approvedAt: "2026-07-30T00:00:00.000Z",
      approvedBy: "theme-team",
      license: "Internal",
      source: "internal://synthetic",
    },
    supportedPageTemplates: ["home"],
    themeVersion: "1.0.0",
  },
  presets: [
    {
      id: "editorial",
      label: "Editorial",
      templates: [
        {
          id: "home",
          pageType: "home",
          requiredCapabilities: ["legal.links", "product.action", "product.details"],
          sections: [
            {
              blocks: [
                {
                  actions: [
                    {
                      id: "open-product",
                      intent: "product.open",
                      kind: "intent",
                    },
                  ],
                  capabilities: ["product.action"],
                  id: "primary-action",
                  settings: { label: "Shop now" },
                  type: "core.product-action",
                  visible: true,
                },
              ],
              capabilities: ["product.details"],
              id: "hero",
              settings: {
                heading: "Seasonal edit",
                media: {
                  alt: "Model wearing the seasonal edit",
                  height: 1200,
                  kind: "theme",
                  path: "assets/hero.webp",
                  width: 1600,
                },
              },
              type: "synthetic.hero",
              visible: true,
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
        },
      ],
    },
  ],
} satisfies ThemePackage;

const editorialPreset = validThemePackage.presets[0]!;
const homeTemplate = editorialPreset.templates[0]!;
const heroSection = homeTemplate.sections[0]!;
const legalFooterSection = homeTemplate.sections[1]!;

describe("storefront experience contracts", () => {
  test("accepts stable catalog bindings independently from fixture bindings", () => {
    expect(
      catalogResourceBindingSchema.parse({
        id: "featured-product-binding",
        instanceId: "featured-product",
        kind: "catalog",
        reference: {
          id: "prd_01J00000000000000000000000",
          kind: "product",
        },
        settingId: "featured-product",
      }),
    ).toMatchObject({ reference: { kind: "product" } });
    expect(
      catalogResourceReferenceSchema.safeParse({
        collectionId: "col_01J00000000000000000000000",
        id: "prd_01J00000000000000000000000",
        kind: "product",
      }).success,
    ).toBe(false);
    expect(
      catalogResourceReferenceSchema.safeParse({
        id: "prd_01J00000000000000000000000",
        kind: "fixture",
      }).success,
    ).toBe(false);
  });

  test("declares catalog reference controls and keeps catalog media keys bounded", () => {
    expect(
      settingDefinitionSchema.parse({
        id: "featured-product",
        kind: "product-reference",
        required: true,
      }),
    ).toEqual({ id: "featured-product", kind: "product-reference", required: true });
    expect(
      settingDefinitionSchema.parse({
        id: "featured-collection",
        kind: "collection-reference",
        required: false,
      }),
    ).toEqual({ id: "featured-collection", kind: "collection-reference", required: false });
    expect(
      assetReferenceSchema.safeParse({
        alt: "Approved media",
        height: 600,
        key: "catalog/products/hero.webp",
        kind: "catalog",
        width: 800,
      }).success,
    ).toBe(true);
    expect(
      assetReferenceSchema.safeParse({
        alt: "Traversal",
        height: 600,
        key: "catalog/../secret.webp",
        kind: "catalog",
        width: 800,
      }).success,
    ).toBe(false);
  });

  test("persists every editor reference as one typed stable ID", () => {
    const references = [
      { id: "prd_01J00000000000000000000000", kind: "product" },
      { id: "col_01J00000000000000000000000", kind: "collection" },
      { id: "page.about", kind: "page" },
      { id: "article.marketing-tips-and-tricks", kind: "article" },
      { id: "policy.privacy", kind: "policy" },
    ] as const;

    for (const reference of references) {
      expect(storefrontResourceReferenceSchema.parse(reference)).toEqual(reference);
      expect(
        storefrontResourceReferenceSchema.safeParse({
          ...reference,
          name: "Copied mutable display data",
          price: { amount: 12_900, currency: "USD" },
          slug: "copied-slug",
        }).success,
      ).toBe(false);
      expect(
        settingDefinitionSchema.safeParse({
          cardinality: "one",
          helpText: `Choose one ${reference.kind} by stable ID.`,
          id: `${reference.kind}-destination`,
          kind: `${reference.kind}-reference`,
          label: `${reference.kind} destination`,
          required: false,
        }).success,
      ).toBe(true);
    }
  });

  test("requires labeled link values with explicit behavior and typed internal destinations", () => {
    const internal = {
      label: "Privacy policy",
      target: {
        kind: "internal",
        reference: { id: "policy.privacy", kind: "policy" },
      },
      targetBehavior: "same-window",
    } as const;
    const external = {
      label: "Editorial partner",
      target: { kind: "external", url: "https://example.test/editorial" },
      targetBehavior: "new-window",
    } as const;

    expect(storefrontLinkSchema.parse(internal)).toEqual(internal);
    expect(storefrontLinkSchema.parse(external)).toEqual(external);
    const optionalLinkDefinition = settingDefinitionSchema.parse({
      allowedTargets: ["page", "external"],
      helpText: "Choose a typed page or a credential-free HTTPS destination.",
      id: "primary-link",
      kind: "link",
      label: "Primary link",
      required: false,
    });
    expect(optionalLinkDefinition).toMatchObject({ allowedTargets: ["page", "external"] });
    expect("default" in optionalLinkDefinition).toBe(false);
    expect(
      settingDefinitionSchema.safeParse({
        allowedTargets: ["page"],
        default: external,
        id: "primary-link",
        kind: "link",
        required: false,
      }).success,
    ).toBe(false);
    expect(storefrontLinkSchema.safeParse({ ...internal, label: "" }).success).toBe(false);
    expect(storefrontLinkSchema.safeParse({ ...internal, targetBehavior: undefined }).success).toBe(
      false,
    );
    expect(
      storefrontLinkSchema.safeParse({
        ...internal,
        target: { kind: "internal", path: "/policies/privacy" },
      }).success,
    ).toBe(false);
    expect(
      storefrontLinkSchema.safeParse({
        ...external,
        target: { kind: "external", url: "http://example.test/editorial" },
      }).success,
    ).toBe(false);
    expect(
      storefrontLinkSchema.safeParse({
        ...external,
        target: { kind: "external", url: "https://user:secret@example.test/editorial" },
      }).success,
    ).toBe(false);

    const packageWithDisallowedLinkValue = {
      ...validThemePackage,
      manifest: {
        ...validThemePackage.manifest,
        componentRegistry: {
          ...validThemePackage.manifest.componentRegistry,
          sections: validThemePackage.manifest.componentRegistry.sections.map((section) =>
            section.type === "synthetic.hero"
              ? {
                  ...section,
                  settings: [
                    ...section.settings,
                    {
                      allowedTargets: ["page"],
                      id: "primary-link",
                      kind: "link",
                      required: false,
                    },
                  ],
                }
              : section,
          ),
        },
      },
      presets: validThemePackage.presets.map((preset) => ({
        ...preset,
        templates: preset.templates.map((template) => ({
          ...template,
          sections: template.sections.map((section) =>
            section.type === "synthetic.hero"
              ? { ...section, settings: { ...section.settings, "primary-link": external } }
              : section,
          ),
        })),
      })),
    };
    expect(themePackageSchema.safeParse(packageWithDisallowedLinkValue).success).toBe(false);
  });

  test("validates structured presentation money and explicit availability", () => {
    const product = {
      availability: "in-stock",
      id: "prd_01J00000000000000000000000",
      kind: "product",
      media: [],
      money: { amount: 12_900, currency: "USD" },
      name: "Carry-on",
      slug: "carry-on",
      variantIds: ["var_01J00000000000000000000000"],
    } satisfies PresentationProduct;

    expect(presentationProductSchema.parse(product)).toEqual(product);
    expect(
      presentationProductSchema.safeParse({
        ...product,
        money: { amount: "129.00", currency: "USD" },
      }).success,
    ).toBe(false);
    expect(presentationProductSchema.safeParse({ ...product, availability: true }).success).toBe(
      false,
    );
  });

  test("keeps commerce intent payloads identifier-only", () => {
    const action = {
      id: "add-to-cart",
      intent: {
        kind: "cart.add",
        productId: "prd_01J00000000000000000000000",
        quantity: 1,
        variantId: "var_01J00000000000000000000000",
      },
      label: "Add to bag",
    } as const;

    expect(storefrontIntentActionSchema.parse(action)).toEqual(action);
    expect(
      storefrontIntentActionSchema.safeParse({
        ...action,
        intent: {
          ...action.intent,
          expectedUnitPrice: { amount: 12_900, currency: "USD" },
          inventoryAvailable: true,
        },
      }).success,
    ).toBe(false);
  });

  test("accepts a compatible bounded package with declared components and settings", () => {
    const parsed = themePackageSchema.parse(validThemePackage);

    expect(parsed.manifest.id).toBe("synthetic");
    expect(parsed.presets[0]?.templates[0]?.sections.map(({ id }) => id)).toEqual([
      "hero",
      "legal-footer",
    ]);
  });

  test("rejects unknown components, settings, duplicate IDs, and excessive cardinality", () => {
    const template = homeTemplate;
    const invalidCases = [
      {
        ...validThemePackage,
        presets: [
          {
            ...editorialPreset,
            templates: [
              {
                ...template,
                sections: [{ ...heroSection, type: "synthetic.unknown" }],
              },
            ],
          },
        ],
      },
      {
        ...validThemePackage,
        presets: [
          {
            ...editorialPreset,
            templates: [
              {
                ...template,
                sections: [
                  {
                    ...heroSection,
                    settings: { ...heroSection.settings, rawCss: "body{}" },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        ...validThemePackage,
        presets: [
          {
            ...editorialPreset,
            templates: [
              {
                ...template,
                sections: [heroSection, { ...heroSection }],
              },
            ],
          },
        ],
      },
      {
        ...validThemePackage,
        presets: [
          {
            ...editorialPreset,
            templates: [
              {
                ...template,
                sections: Array.from({ length: 41 }, (_, index) => ({
                  ...heroSection,
                  id: `hero-${index}`,
                })),
              },
            ],
          },
        ],
      },
      {
        ...validThemePackage,
        presets: [
          {
            ...editorialPreset,
            templates: [
              {
                ...template,
                sections: [
                  {
                    ...heroSection,
                    blocks: [{ ...heroSection.blocks[0]!, id: "hero" }],
                  },
                  legalFooterSection,
                ],
              },
            ],
          },
        ],
      },
    ];

    for (const invalid of invalidCases) {
      expect(themePackageSchema.safeParse(invalid).success).toBe(false);
    }
  });

  test("rejects arbitrary code, unsafe links, raw data, and unapproved remote media", () => {
    const hero = heroSection;
    const withHeading = (heading: unknown) => ({
      ...validThemePackage,
      presets: [
        {
          ...editorialPreset,
          templates: [
            {
              ...homeTemplate,
              sections: [{ ...hero, settings: { ...hero.settings, heading } }, legalFooterSection],
            },
          ],
        },
      ],
    });
    const withMedia = (media: unknown) => ({
      ...validThemePackage,
      presets: [
        {
          ...editorialPreset,
          templates: [
            {
              ...homeTemplate,
              sections: [{ ...hero, settings: { ...hero.settings, media } }, legalFooterSection],
            },
          ],
        },
      ],
    });

    expect(
      themePackageSchema.safeParse(withHeading({ html: "<script>alert(1)</script>" })).success,
    ).toBe(false);
    expect(themePackageSchema.safeParse(withHeading("<script>alert(1)</script>")).success).toBe(
      false,
    );
    expect(themePackageSchema.safeParse(withHeading("javascript:alert(1)")).success).toBe(true);
    expect(
      linkTargetSchema.safeParse({ kind: "external", url: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(
      linkTargetSchema.safeParse({
        kind: "external",
        url: "https://user:secret@example.test/path",
      }).success,
    ).toBe(false);
    expect(
      themePackageSchema.safeParse(
        withMedia({
          alt: "Unsafe",
          height: 100,
          kind: "remote",
          url: "data:image/svg+xml,<svg onload=alert(1)>",
          width: 100,
        }),
      ).success,
    ).toBe(false);
    expect(
      themePackageSchema.safeParse(
        withMedia({
          alt: "Credentialed",
          height: 100,
          kind: "remote",
          url: "https://user:secret@cdn.example.test/image.webp",
          width: 100,
        }),
      ).success,
    ).toBe(false);
    expect(
      themePackageSchema.safeParse(
        withMedia({
          alt: "Unapproved",
          height: 100,
          kind: "remote",
          url: "https://unapproved.example.test/image.webp",
          width: 100,
        }),
      ).success,
    ).toBe(false);
  });

  test("rejects incompatible platform versions and removable required capabilities", () => {
    expect(
      themePackageSchema.safeParse({
        ...validThemePackage,
        manifest: {
          ...validThemePackage.manifest,
          platformCompatibility: { maxExclusive: "1.0.0", min: "1.0.0" },
        },
      }).success,
    ).toBe(false);
    expect(
      themePackageSchema.safeParse({
        ...validThemePackage,
        presets: [
          {
            ...editorialPreset,
            templates: [
              {
                ...homeTemplate,
                sections: [
                  heroSection,
                  {
                    ...legalFooterSection,
                    visible: false,
                  },
                ],
              },
            ],
          },
        ],
      }).success,
    ).toBe(false);
  });

  test("serializes and re-parses an immutable snapshot without contract loss", () => {
    const snapshot = experienceSnapshotSchema.parse({
      approvedAt: "2026-07-30T01:00:00.000Z",
      approvedBy: "operator-1",
      bindings: [
        {
          fixtureId: "synthetic-populated",
          id: "home-products",
          instanceId: "hero",
          kind: "fixture",
          resource: "product-list",
          state: "populated",
        },
      ],
      configurationSchemaVersion: 1,
      experienceId: "experience-synthetic",
      id: "snapshot-synthetic-1",
      kind: "approved",
      overrides: [
        {
          operations: [
            {
              instanceId: "hero",
              kind: "set-setting",
              settingId: "heading",
              value: "A new edit",
            },
          ],
          presetId: "editorial",
          schemaVersion: 1,
          templateId: "home",
        },
      ],
      platformContractVersion: "1.0.0",
      provenance: validThemePackage.manifest.provenance,
      resolvedTemplates: editorialPreset.templates,
      themeId: "synthetic",
      themeVersion: "1.0.0",
      version: 1,
    });

    expect(experienceSnapshotSchema.parse(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
  });

  test("distinguishes preview snapshots from explicitly approved snapshots", () => {
    const approved = experienceSnapshotSchema.parse({
      approvedAt: "2026-07-30T01:00:00.000Z",
      approvedBy: "operator-1",
      bindings: [],
      configurationSchemaVersion: 1,
      experienceId: "experience-synthetic",
      id: "snapshot-synthetic-approved",
      kind: "approved",
      overrides: [],
      platformContractVersion: "1.0.0",
      provenance: validThemePackage.manifest.provenance,
      resolvedTemplates: editorialPreset.templates,
      themeId: "synthetic",
      themeVersion: "1.0.0",
      version: 1,
    });

    expect(
      experienceSnapshotSchema.parse({
        ...approved,
        approvedAt: null,
        approvedBy: null,
        id: "snapshot-synthetic-preview",
        kind: "preview",
      }),
    ).toMatchObject({
      approvedAt: null,
      approvedBy: null,
      kind: "preview",
    });
    expect(() =>
      experienceSnapshotSchema.parse({
        ...approved,
        approvedAt: null,
        approvedBy: null,
      }),
    ).toThrow();
  });
});
