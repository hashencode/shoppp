import { describe, expect, test } from "bun:test";

import {
  experienceSnapshotSchema,
  linkTargetSchema,
  themePackageSchema,
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
          type: "fashion.hero",
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
    id: "fashion",
    platformCompatibility: {
      maxExclusive: "2.0.0",
      min: "1.0.0",
    },
    platformContractVersion: "1.0.0",
    provenance: {
      approvedAt: "2026-07-30T00:00:00.000Z",
      approvedBy: "theme-team",
      license: "Internal",
      source: "internal://fashion",
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
              type: "fashion.hero",
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
  test("accepts a compatible bounded package with declared components and settings", () => {
    const parsed = themePackageSchema.parse(validThemePackage);

    expect(parsed.manifest.id).toBe("fashion");
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
                sections: [{ ...heroSection, type: "fashion.unknown" }],
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
          fixtureId: "fashion-populated",
          id: "home-products",
          instanceId: "hero",
          kind: "fixture",
          resource: "product-list",
          state: "populated",
        },
      ],
      configurationSchemaVersion: 1,
      experienceId: "experience-fashion",
      id: "snapshot-fashion-1",
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
      themeId: "fashion",
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
      experienceId: "experience-fashion",
      id: "snapshot-fashion-approved",
      kind: "approved",
      overrides: [],
      platformContractVersion: "1.0.0",
      provenance: validThemePackage.manifest.provenance,
      resolvedTemplates: editorialPreset.templates,
      themeId: "fashion",
      themeVersion: "1.0.0",
      version: 1,
    });

    expect(
      experienceSnapshotSchema.parse({
        ...approved,
        approvedAt: null,
        approvedBy: null,
        id: "snapshot-fashion-preview",
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
