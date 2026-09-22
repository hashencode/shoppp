import { describe, expect, test } from "bun:test";

import {
  collectionAuthoritySchema,
  navigationMenuSchema,
  policyAuthoritySchema,
  storeIdentitySchema,
  storefrontContentDocumentSchema,
  createPolicyRequestSchema,
  policyTransitionRequestSchema,
  updateStoreIdentityRequestSchema,
} from "../src/storefront-content";

const at = "2026-09-22T00:00:00.000Z";

describe("storefront content authority contracts", () => {
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
});
