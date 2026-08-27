import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import releaseFixture from "../apps/storefront/fixtures/release.json";
import {
  buildStagingCatalogSuccessorSql,
  createStagingCatalogSuccessor,
} from "./prepare-staging-catalog-successor";

const legacyRelease = {
  ...releaseFixture,
  collections: releaseFixture.collections.map(
    ({ id: _id, productIds: _productIds, ...value }) => value,
  ),
  products: releaseFixture.products.map(
    ({ collectionIds: _collectionIds, id: _id, ...value }) => value,
  ),
  redirects: releaseFixture.redirects.map(({ status: _status, ...value }) => value),
  generatedAt: undefined,
  routes: undefined,
  schemaVersion: undefined,
};

describe("ordinary staging canonical Catalog Release successor", () => {
  test("upgrades a legacy manifest with exact database identities without changing its predecessor", () => {
    const successor = createStagingCatalogSuccessor({
      collectionIdentities: [{ id: "col_01JSTAGING000000000000001", slug: "travel-essentials" }],
      generatedAt: "2026-08-27T12:00:00.000Z",
      legacyRelease,
      productIdentities: [
        { id: "prod_01JSTAGING00000000000001", slug: "atlas-carry-on" },
        { id: "prod_01JSTAGING00000000000002", slug: "relaxed-corduroy-shirt" },
      ],
      releaseId: "staging-canonical-2026-08-27",
    });

    expect(successor).toMatchObject({
      generatedAt: "2026-08-27T12:00:00.000Z",
      releaseId: "staging-canonical-2026-08-27",
      schemaVersion: 2,
    });
    expect(successor.products.map(({ id }) => id)).toEqual([
      "prod_01JSTAGING00000000000001",
      "prod_01JSTAGING00000000000002",
    ]);
    expect(successor.collections[0]?.productIds).toEqual([
      "prod_01JSTAGING00000000000001",
      "prod_01JSTAGING00000000000002",
    ]);
    expect(successor.redirects).toEqual([
      { from: "/products/carry-on", status: 301, to: "/products/atlas-carry-on" },
    ]);
  });

  test("builds a collision-refusing insert instead of updating an existing release", () => {
    const successor = createStagingCatalogSuccessor({
      collectionIdentities: [{ id: "col_01JSTAGING000000000000001", slug: "travel-essentials" }],
      generatedAt: "2026-08-27T12:00:00.000Z",
      legacyRelease,
      productIdentities: [
        { id: "prod_01JSTAGING00000000000001", slug: "atlas-carry-on" },
        { id: "prod_01JSTAGING00000000000002", slug: "relaxed-corduroy-shirt" },
      ],
      releaseId: "staging-canonical-2026-08-27",
    });
    const sql = buildStagingCatalogSuccessorSql(successor, {
      correlationId: "staging-catalog-successor-123-1",
      createdAt: "2026-08-27T12:00:00.000Z",
      productId: successor.products[0]!.id,
    });

    expect(sql).toContain("CHECK (invalid_count = 0)");
    expect(sql).toContain("SELECT COUNT(*) FROM catalog_releases WHERE id =");
    expect(sql).toContain("INSERT INTO catalog_releases");
    expect(sql).not.toContain("UPDATE catalog_releases");
    expect(sql).toContain("'building'");
  });

  test("refuses incomplete identity projections", () => {
    expect(() =>
      createStagingCatalogSuccessor({
        collectionIdentities: [],
        generatedAt: "2026-08-27T12:00:00.000Z",
        legacyRelease,
        productIdentities: [],
        releaseId: "staging-canonical-2026-08-27",
      }),
    ).toThrow(/identity/i);
  });

  test("keeps preparation inside the protected staging boundary with a retained backup", async () => {
    const workflow = await readFile(
      new URL("../.github/workflows/prepare-staging-catalog-successor.yml", import.meta.url),
      "utf8",
    );

    expect(workflow).toContain("environment: staging");
    expect(workflow).toContain("d1 export shoppp-staging --env staging --remote");
    expect(workflow).toContain("retention-days: 7");
    expect(workflow).toContain("retention-days: 90");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).not.toContain("environment: production");
    expect(workflow).not.toContain("shoppp-production");
    expect(workflow).not.toMatch(/uses:\s+[^\s@]+@(?![a-f0-9]{40}\b)/);
    expect(workflow.slice(0, workflow.indexOf("    steps:"))).not.toContain("secrets.");
  });
});
