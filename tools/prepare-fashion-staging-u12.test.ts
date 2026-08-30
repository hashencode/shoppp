import { describe, expect, test } from "bun:test";

import { canonicalCatalogReleaseSchema } from "../packages/contracts/src";

import { createFashionStagingU12SeedPlan } from "./prepare-fashion-staging-u12";

describe("Fashion staging U12 one-time seed plan", () => {
  test("builds one deterministic canonical Catalog with all three Commerce archetypes", () => {
    const first = createFashionStagingU12SeedPlan();
    const second = createFashionStagingU12SeedPlan();

    expect(canonicalCatalogReleaseSchema.parse(first.catalogRelease)).toEqual(first.catalogRelease);
    expect(first.catalogRelease.products).toHaveLength(3);
    expect(first.catalogRelease.products.map(({ variants }) => variants.length)).toEqual([
      1, 12, 1,
    ]);
    expect(first.canonicalCatalogDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.seedManifestDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.canonicalCatalogDigest).toBe(second.canonicalCatalogDigest);
    expect(first.seedManifestDigest).toBe(second.seedManifestDigest);
  });

  test("fails closed on identity collisions before its bounded inserts", () => {
    const plan = createFashionStagingU12SeedPlan();

    expect(plan.preflightSql).toContain("AS conflict_count");
    expect(plan.preflightSql).toContain("catalog_releases");
    expect(plan.seedSql).not.toContain("BEGIN TRANSACTION");
    expect(plan.seedSql).not.toContain("COMMIT;");
    expect(plan.seedSql.indexOf("INSERT OR IGNORE INTO price_lists")).toBeLessThan(
      plan.seedSql.indexOf("INSERT OR IGNORE INTO products"),
    );
    expect(plan.seedSql).toContain("INSERT OR IGNORE INTO catalog_releases");
    expect(plan.preflightSql).toContain("catalog_releases WHERE id");
    expect(plan.preflightSql).toContain("AND NOT (status = 'deployed'");
    expect(plan.seedSql).not.toContain("DELETE");
    expect(plan.seedSql).not.toContain("UPDATE");
    expect(plan.verifySql).toContain("approved_snapshot_count");
    expect(plan.verifySql).not.toContain("building_build_count");
  });

  test("uses the approved snapshot path and publishes the exact protected variables", () => {
    const plan = createFashionStagingU12SeedPlan();

    expect(plan.experience.approvePathTemplate).toContain("/approve");
    expect(plan.experience.buildPathTemplate).toContain("/snapshots/{snapshotId}/build");
    expect(JSON.stringify(plan.experience)).not.toContain("/preview");
    expect(plan.expectedVariables).toMatchObject({
      FASHION_U12_MULTI_VARIANT_PRODUCT_ID: "prod_01JFASHIONLIVE0000000002",
      FASHION_U12_SINGLE_VARIANT_PRODUCT_ID: "prod_01JFASHIONLIVE0000000001",
      FASHION_U12_UNAVAILABLE_PRODUCT_ID: "prod_01JFASHIONLIVE0000000003",
      FASHION_U12_WAREHOUSE_ID: "warehouse_fashion_staging",
    });
  });
});
