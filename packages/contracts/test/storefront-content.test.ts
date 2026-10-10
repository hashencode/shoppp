import { describe, expect, test } from "bun:test";

import {
  collectionAuthoritySchema,
  navigationMenuSchema,
  navigationMenuWriteRequestSchema,
  navigationTransitionRequestSchema,
  policyAuthoritySchema,
  storeIdentitySchema,
  storefrontContentDocumentSchema,
  contentPageWriteRequestSchema,
  contentArticleWriteRequestSchema,
  contentTransitionRequestSchema,
  publishableContentDocumentSchema,
  createPolicyRequestSchema,
  updatePolicyRequestSchema,
  policyTransitionRequestSchema,
  updateStoreIdentityRequestSchema,
} from "../src/storefront-content";

const at = "2026-09-22T00:00:00.000Z";

describe("storefront content authority contracts", () => {
  test("accepts optional draft notes and defaults SEO titles without weakening transitions", () => {
    const page = {
      body: [{ id: "section.intro", kind: "paragraph", text: "Our story." }],
      seo: { description: "Our story" },
      slug: "our-story",
      summary: "",
      title: "Our story",
    };
    for (const reason of [undefined, "  ", "好", "ok"]) {
      expect(contentPageWriteRequestSchema.parse({ ...page, reason })).toMatchObject({
        reason: reason?.trim() ?? "",
        seo: { title: page.title },
      });
      expect(
        contentArticleWriteRequestSchema.parse({ ...page, coverAssetId: null, reason }).seo.title,
      ).toBe(page.title);
      expect(navigationMenuWriteRequestSchema.parse({ items: [], reason }).reason).toBe(
        reason?.trim() ?? "",
      );
      const policy = {
        effectiveDate: "2026-10-01",
        kind: "privacy",
        sections: [{ id: "section.intro", kind: "paragraph", text: "Privacy terms." }],
        slug: "privacy",
        title: "Privacy",
        reason,
      };
      expect(createPolicyRequestSchema.parse(policy).reason).toBe(reason?.trim() ?? "");
      expect(updatePolicyRequestSchema.parse({ ...policy, expectedVersion: 1 }).reason).toBe(
        reason?.trim() ?? "",
      );
      expect(
        updateStoreIdentityRequestSchema.parse({
          expectedVersion: null,
          faviconAssetId: null,
          logoAssets: [{ assetId: "asset.logo.primary", variant: "primary" }],
          reason,
          seo: { description: "Objects", title: "  " },
          socialShareAssetId: null,
          storefrontName: "Shoppp",
          tagline: "",
        }).seo.title,
      ).toBe("Shoppp");
      for (const schema of [
        contentTransitionRequestSchema,
        navigationTransitionRequestSchema,
        policyTransitionRequestSchema,
      ]) {
        expect(schema.safeParse({ confirm: true, expectedVersion: 1, reason }).success).toBe(false);
      }
    }
    expect(
      contentPageWriteRequestSchema.parse({ ...page, seo: { description: "", title: "Custom" } })
        .seo.title,
    ).toBe("Custom");
    expect(contentPageWriteRequestSchema.safeParse({ ...page, title: " " }).success).toBe(false);
    expect(
      contentPageWriteRequestSchema.safeParse({ ...page, reason: "x".repeat(501) }).success,
    ).toBe(false);
  });

  test("accepts typed identity with stable shared Logo asset IDs", () => {
    expect(
      storeIdentitySchema
        .parse({
          id: "identity.primary",
          version: 1,
          status: "published",
          storefrontName: "Shoppp",
          tagline: "Objects for everyday life",
          faviconAssetId: "asset.favicon",
          socialShareAssetId: "asset.social",
          logoAssets: [
            { assetId: "asset.logo.primary", variant: "primary" },
            { assetId: "asset.logo.dark", variant: "dark" },
          ],
          seo: { title: "Shoppp", description: "Objects for everyday life" },
          createdAt: at,
          updatedAt: at,
        })
        .logoAssets.map(({ assetId }) => assetId),
    ).toEqual(["asset.logo.primary", "asset.logo.dark"]);
  });

  test("accepts digit-leading Catalog UUIDs across all Identity media fields", () => {
    const assets = Array.from(
      { length: 6 },
      (_, index) => `0f0dd0ad-8eaf-4aae-8a3b-773e05a4560${index}`,
    );
    const media = {
      faviconAssetId: assets[4],
      logoAssets: (["primary", "light", "dark", "compact"] as const).map((variant, index) => ({
        assetId: assets[index],
        variant,
      })),
      socialShareAssetId: assets[5],
    };
    const editable = {
      ...media,
      seo: { title: "Shoppp", description: "Objects" },
      storefrontName: "Shoppp",
      tagline: "Objects",
    };
    expect(
      updateStoreIdentityRequestSchema.parse({ ...editable, expectedVersion: null }),
    ).toMatchObject(media);
    expect(
      storeIdentitySchema.parse({
        ...editable,
        createdAt: at,
        id: "identity.primary",
        status: "published",
        updatedAt: at,
        version: 1,
      }),
    ).toMatchObject(media);
  });

  test("rejects duplicate Logo variants and stable IDs", () => {
    const base = {
      id: "identity.primary",
      version: 1,
      status: "draft" as const,
      storefrontName: "Shoppp",
      tagline: "Objects for everyday life",
      logoAssets: [
        { assetId: "asset.logo.one", variant: "primary" as const },
        { assetId: "asset.logo.one", variant: "primary" as const },
      ],
      seo: { title: "Shoppp", description: "Objects for everyday life" },
      createdAt: at,
      updatedAt: at,
    };
    expect(storeIdentitySchema.safeParse(base).success).toBe(false);
    expect(
      storeIdentitySchema.safeParse({
        ...base,
        id: "identity.secondary",
        logoAssets: [{ assetId: "asset.logo.one", variant: "primary" }],
      }).success,
    ).toBe(false);
  });

  test("enforces Policy lifecycle evidence and bounded structured sections", () => {
    const published = {
      id: "policy.returns",
      version: 2,
      kind: "returns" as const,
      slug: "returns",
      title: "Returns",
      status: "published" as const,
      effectiveDate: "2026-09-22",
      sections: [{ id: "section.intro", kind: "paragraph" as const, text: "Return terms." }],
      approvedAt: at,
      approvedBy: "usr_00000000000000000000",
      approvalDigest: "a".repeat(64),
      publishedAt: at,
      createdAt: at,
      updatedAt: at,
    };
    expect(policyAuthoritySchema.parse(published).status).toBe("published");
    expect(
      policyAuthoritySchema.safeParse({ ...published, approvalDigest: undefined }).success,
    ).toBe(false);
    expect(
      storefrontContentDocumentSchema.safeParse([
        { id: "section.bad", kind: "paragraph", text: "<script>alert(1)</script>" },
      ]).success,
    ).toBe(false);
  });

  test("keeps Identity and Policy mutation contracts strict and server-owned", () => {
    const identity = {
      expectedVersion: null,
      faviconAssetId: null,
      logoAssets: [{ assetId: "asset.logo.primary", variant: "primary" }],
      reason: "Create store identity",
      seo: { description: "Objects", title: "Shoppp" },
      socialShareAssetId: null,
      storefrontName: "Shoppp",
      tagline: "Objects",
    };
    expect(updateStoreIdentityRequestSchema.safeParse(identity).success).toBe(true);
    expect(
      updateStoreIdentityRequestSchema.safeParse({ ...identity, status: "published" }).success,
    ).toBe(false);
    const policy = {
      effectiveDate: "2026-10-01",
      kind: "privacy",
      reason: "Create privacy policy",
      sections: [{ id: "section.intro", kind: "paragraph", text: "Privacy terms." }],
      slug: "privacy",
      title: "Privacy policy",
    };
    expect(createPolicyRequestSchema.safeParse(policy).success).toBe(true);
    expect(
      createPolicyRequestSchema.safeParse({ ...policy, approvalDigest: "a".repeat(64) }).success,
    ).toBe(false);
    expect(
      policyTransitionRequestSchema.safeParse({
        confirm: true,
        expectedVersion: 1,
        reason: "Approve exact policy",
      }).success,
    ).toBe(true);
  });

  test("rejects duplicate sibling order and unsafe Navigation links", () => {
    const menu = {
      id: "menu.header",
      version: 1,
      placement: "header" as const,
      status: "draft" as const,
      items: [
        {
          id: "nav.one",
          parentId: null,
          position: 0,
          label: "One",
          target: { kind: "external" as const, url: "https://example.test/one" },
        },
        {
          id: "nav.two",
          parentId: null,
          position: 0,
          label: "Two",
          target: { kind: "external" as const, url: "https://user:secret@example.test/two" },
        },
      ],
      createdAt: at,
      updatedAt: at,
    };
    expect(navigationMenuSchema.safeParse(menu).success).toBe(false);
  });

  test("keeps Navigation item identity and lifecycle fields server-owned", () => {
    const input = {
      expectedVersion: 2,
      items: [
        {
          id: "nav.shop",
          label: "Shop",
          parentId: null,
          position: 0,
          target: { kind: "route", path: "/collections/new-arrivals" },
        },
      ],
      reason: "Revise the Header menu",
    };
    expect(navigationMenuWriteRequestSchema.safeParse(input).success).toBe(true);
    expect(
      navigationMenuWriteRequestSchema.safeParse({ ...input, placement: "header" }).success,
    ).toBe(false);
    expect(
      navigationTransitionRequestSchema.safeParse({
        confirm: true,
        expectedVersion: 2,
        reason: "Publish the reviewed Header menu",
      }).success,
    ).toBe(true);
  });

  test("requires ordered unique Collection membership and optimistic versions", () => {
    const collection = {
      id: "collection_00000000000000000000",
      version: 1,
      slug: "new-arrivals",
      name: "New arrivals",
      description: "Recently added products",
      coverAssetId: null,
      seo: { title: "New arrivals", description: "Recently added products" },
      status: "draft" as const,
      memberships: [
        { productId: "product_000000000000000000001", position: 0 },
        { productId: "product_000000000000000000002", position: 1 },
      ],
      createdAt: at,
      updatedAt: at,
    };
    expect(collectionAuthoritySchema.parse(collection).memberships).toHaveLength(2);
    expect(
      collectionAuthoritySchema.safeParse({
        ...collection,
        memberships: [collection.memberships[0], { ...collection.memberships[1], position: 0 }],
      }).success,
    ).toBe(false);
    expect(collectionAuthoritySchema.safeParse({ ...collection, version: 0 }).success).toBe(false);
  });

  test("accepts only the bounded Page and Article v1 section set", () => {
    const document = [
      { id: "section.lead", kind: "paragraph", text: "A quiet introduction." },
      {
        id: "section.link",
        kind: "link",
        link: {
          label: "Read the returns policy",
          target: { kind: "internal", reference: { id: "policy.returns", kind: "policy" } },
          targetBehavior: "same-window",
        },
      },
    ];
    expect(publishableContentDocumentSchema.safeParse(document).success).toBe(true);
    expect(
      publishableContentDocumentSchema.safeParse([
        { id: "section.list", kind: "list", items: ["unsupported"] },
      ]).success,
    ).toBe(false);
    expect(
      publishableContentDocumentSchema.safeParse([
        {
          id: "section.external",
          kind: "link",
          link: {
            label: "Unsafe",
            target: { kind: "external", url: "https://user:secret@example.test/path" },
            targetBehavior: "new-window",
          },
        },
      ]).success,
    ).toBe(false);
  });

  test("keeps content lifecycle fields server-owned and optimistic", () => {
    const input = {
      body: [{ id: "section.intro", kind: "paragraph", text: "About our studio." }],
      expectedVersion: 3,
      reason: "Revise the About page",
      seo: { description: "About our studio", title: "About" },
      slug: "about",
      summary: "Our story",
      title: "About",
    };
    expect(contentPageWriteRequestSchema.safeParse(input).success).toBe(true);
    expect(contentPageWriteRequestSchema.safeParse({ ...input, status: "published" }).success).toBe(
      false,
    );
    expect(
      contentTransitionRequestSchema.safeParse({
        confirm: true,
        expectedVersion: 3,
        reason: "Publish the reviewed About page",
        redirectFromOldSlug: true,
      }).success,
    ).toBe(true);
  });

  test("accepts exact Content ceilings and rejects each max-plus-one boundary", () => {
    const input = {
      body: [{ id: "section.intro", kind: "paragraph" as const, text: "x".repeat(5_000) }],
      reason: "Verify exact boundaries",
      seo: { description: "d".repeat(320), title: "s".repeat(160) },
      slug: "s".repeat(160),
      summary: "u".repeat(500),
      title: "t".repeat(160),
    };
    expect(contentPageWriteRequestSchema.safeParse(input).success).toBe(true);
    for (const overflow of [
      { ...input, title: `${input.title}x` },
      { ...input, summary: `${input.summary}x` },
      { ...input, slug: `${input.slug}x` },
      { ...input, seo: { ...input.seo, title: `${input.seo.title}x` } },
      { ...input, seo: { ...input.seo, description: `${input.seo.description}x` } },
      { ...input, body: [{ ...input.body[0]!, text: `${input.body[0]!.text}x` }] },
    ]) {
      expect(contentPageWriteRequestSchema.safeParse(overflow).success).toBe(false);
    }

    const fortySections = Array.from({ length: 40 }, (_, index) => ({
      id: `section.p${index}`,
      kind: "paragraph" as const,
      text: "x",
    }));
    expect(publishableContentDocumentSchema.safeParse(fortySections).success).toBe(true);
    expect(
      publishableContentDocumentSchema.safeParse([
        ...fortySections,
        { id: "section.overflow", kind: "paragraph", text: "x" },
      ]).success,
    ).toBe(false);

    const links = Array.from({ length: 20 }, (_, index) => ({
      id: `section.link${index}`,
      kind: "link" as const,
      link: {
        label: "Link",
        target: { kind: "external" as const, url: `https://example.test/${index}` },
        targetBehavior: "same-window" as const,
      },
    }));
    expect(publishableContentDocumentSchema.safeParse(links).success).toBe(true);
    expect(
      publishableContentDocumentSchema.safeParse([
        ...links,
        { ...links[0]!, id: "section.link-overflow" },
      ]).success,
    ).toBe(false);

    const media = Array.from({ length: 20 }, (_, index) => ({
      alt: "Media",
      assetId: "media_01J00000000000000000000000",
      id: `section.media${index}`,
      kind: "image" as const,
    }));
    expect(publishableContentDocumentSchema.safeParse(media).success).toBe(true);
    expect(
      publishableContentDocumentSchema.safeParse([
        ...media,
        { ...media[0]!, id: "section.media-overflow" },
      ]).success,
    ).toBe(false);

    const byteLimited = Array.from({ length: 13 }, (_, index) => ({
      id: `section.bytes${index}`,
      kind: "paragraph" as const,
      text: "x".repeat(5_000),
    }));
    const encoder = new TextEncoder();
    const excess = encoder.encode(JSON.stringify(byteLimited)).byteLength - 64_000;
    byteLimited[byteLimited.length - 1]!.text = "x".repeat(5_000 - excess);
    expect(encoder.encode(JSON.stringify(byteLimited)).byteLength).toBe(64_000);
    expect(publishableContentDocumentSchema.safeParse(byteLimited).success).toBe(true);
    byteLimited[byteLimited.length - 1]!.text += "x";
    expect(publishableContentDocumentSchema.safeParse(byteLimited).success).toBe(false);
  });
});
