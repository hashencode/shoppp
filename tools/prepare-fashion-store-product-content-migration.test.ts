import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";

import predecessor from "./fashion-store-live-catalog.json";
import successor from "./fashion-store-product-content-catalog.json";
import {
  applyFashionStoreProductContentMigration,
  buildFashionStoreProductContentMigrationPlan,
  buildFashionStoreProductContentMigrationStatements,
  buildFashionStoreProductContentMigrationSql,
} from "./prepare-fashion-store-product-content-migration";

const migrationOptions = {
  actorId: "local-product-content-migration",
  createdAt: "2026-09-22T00:00:00.000Z",
  requestId: "local-product-content-v4",
};

function seededDatabase(): Database {
  const database = new Database(":memory:");
  database.exec(`
    CREATE TABLE products (id TEXT PRIMARY KEY, slug TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE product_variants (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL, sku TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      option_values_json TEXT NOT NULL, weight_grams INTEGER NOT NULL, length_mm INTEGER NOT NULL,
      width_mm INTEGER NOT NULL, height_mm INTEGER NOT NULL, status TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE price_lists (
      id TEXT PRIMARY KEY, code TEXT NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL,
      starts_at TEXT, ends_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE prices (
      id TEXT PRIMARY KEY, price_list_id TEXT NOT NULL, variant_id TEXT NOT NULL,
      amount INTEGER NOT NULL, compare_at_amount INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE warehouses (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE inventory_items (
      variant_id TEXT NOT NULL, warehouse_id TEXT NOT NULL, on_hand_quantity INTEGER NOT NULL,
      reserved_quantity INTEGER NOT NULL, backordered_quantity INTEGER NOT NULL,
      oversell_limit INTEGER NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (variant_id, warehouse_id)
    );
    CREATE TABLE audit_events (
      id TEXT PRIMARY KEY, actor_type TEXT NOT NULL, actor_id TEXT, action TEXT NOT NULL,
      target_type TEXT NOT NULL, target_id TEXT, result TEXT NOT NULL, reason TEXT,
      request_id TEXT, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL
    );
  `);
  const createdAt = "2026-09-17T00:00:00.000Z";
  database
    .query(
      "INSERT INTO price_lists VALUES ('price-list-usd', 'FASHION-USD', 'USD', 'active', NULL, NULL, ?, ?)",
    )
    .run(createdAt, createdAt);
  database
    .query("INSERT INTO warehouses VALUES (?, 'FASHION-STAGING', 'Fashion staging', ?)")
    .run(predecessor.warehouse.id, createdAt);
  for (const product of predecessor.products) {
    database
      .query("INSERT INTO products (id, slug, status) VALUES (?, ?, 'published')")
      .run(product.id, product.slug);
    for (const variant of product.variants) {
      database
        .query(
          `INSERT INTO product_variants
             (id, product_id, sku, title, option_values_json, weight_grams, length_mm, width_mm,
              height_mm, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 'active', ?, ?)`,
        )
        .run(
          variant.id,
          product.id,
          variant.sku,
          variant.title,
          JSON.stringify(variant.optionValues),
          variant.weightGrams ?? 0,
          createdAt,
          createdAt,
        );
      database
        .query(
          `INSERT INTO prices
             (id, price_list_id, variant_id, amount, compare_at_amount, created_at, updated_at)
           VALUES (?, 'price-list-usd', ?, ?, ?, ?, ?)`,
        )
        .run(
          `price_${variant.id}`,
          variant.id,
          variant.price.amount,
          variant.price.compareAtAmount,
          createdAt,
          createdAt,
        );
      database
        .query(
          `INSERT INTO inventory_items
             (variant_id, warehouse_id, on_hand_quantity, reserved_quantity, backordered_quantity,
              oversell_limit, version, updated_at)
           VALUES (?, ?, ?, 0, 0, 0, 0, ?)`,
        )
        .run(variant.id, predecessor.warehouse.id, variant.inventory.onHand, createdAt);
    }
  }
  return database;
}

function executeAtomically(database: Database): void {
  const plan = buildFashionStoreProductContentMigrationPlan(predecessor, successor);
  const statements = buildFashionStoreProductContentMigrationStatements(plan, migrationOptions);
  database.transaction(() => {
    for (const statement of statements) database.query(statement).run();
  })();
}

describe("Fashion Store Product content migration", () => {
  test("preserves historical identities and plans only additive Variant rows", () => {
    const plan = buildFashionStoreProductContentMigrationPlan(predecessor, successor);

    expect(plan).toMatchObject({
      expected: {
        mediaCount: 30,
        productCount: 13,
        variantCount: 28,
      },
      predecessorCatalogVersion: predecessor.catalogVersion,
      successorCatalogVersion: successor.catalogVersion,
    });
    expect(plan.preservedProducts).toHaveLength(13);
    expect(plan.preservedVariants).toHaveLength(24);
    expect(plan).toMatchObject({ currency: "USD", warehouseId: predecessor.warehouse.id });
    expect(plan.addedVariants).toHaveLength(4);
    expect(plan.addedVariants.map(({ variant }) => variant.optionValues.color)).toEqual([
      "Charcoal",
      "Charcoal",
      "Charcoal",
      "Charcoal",
    ]);
    expect(plan.addedMedia).toHaveLength(14);
    expect(plan.removedMediaIds).toEqual([
      "media_01JFS8DETAIL000000000005",
      "media_01JFS8DETAIL000000000006",
    ]);
    expect(plan.revisions).toHaveLength(13);
    expect(
      plan.addedMedia.every(({ media, productId }) =>
        media.r2Key.startsWith(`catalog/products/${productId}/`),
      ),
    ).toBe(true);
  });

  test("builds a guarded additive D1 migration without rewriting historical rows", () => {
    const plan = buildFashionStoreProductContentMigrationPlan(predecessor, successor);
    const sql = buildFashionStoreProductContentMigrationSql(plan, {
      actorId: "local-product-content-migration",
      createdAt: "2026-09-22T00:00:00.000Z",
      requestId: "local-product-content-v4",
    });

    expect(sql.match(/INSERT INTO product_variants/g)).toHaveLength(4);
    expect(sql.match(/INSERT INTO prices/g)).toHaveLength(4);
    expect(sql.match(/INSERT INTO inventory_items/g)).toHaveLength(4);
    expect(sql).toContain("CHECK (invalid_count = 0)");
    expect(sql).toContain("catalog.product-content.migrate");
    expect(sql).not.toMatch(/\bUPDATE\b/);
    expect(sql).not.toMatch(/\bDELETE\b/);
  });

  test("applies the complete additive plan atomically and refuses a second application", () => {
    const database = seededDatabase();
    executeAtomically(database);

    expect(database.query("SELECT COUNT(*) AS count FROM product_variants").get()).toEqual({
      count: 28,
    });
    expect(
      database
        .query("SELECT sku FROM product_variants WHERE id = ?")
        .get(predecessor.products[0]!.variants[0]!.id),
    ).toEqual({ sku: predecessor.products[0]!.variants[0]!.sku });
    expect(database.query("SELECT COUNT(*) AS count FROM audit_events").get()).toEqual({
      count: 1,
    });
    expect(database.query("SELECT COUNT(*) AS count FROM prices").get()).toEqual({ count: 28 });
    expect(database.query("SELECT COUNT(*) AS count FROM inventory_items").get()).toEqual({
      count: 28,
    });
    expect(() => executeAtomically(database)).toThrow();
    database.close();
  });

  test("rolls back on a late collision and missing Commerce authorities", () => {
    const plan = buildFashionStoreProductContentMigrationPlan(predecessor, successor);
    const referenceVariantId = plan.addedVariants[0]!.referenceVariantId;
    const cases: Array<(database: Database) => void> = [
      (database) =>
        database
          .query("UPDATE product_variants SET sku = 'STALE-SKU' WHERE id = ?")
          .run(predecessor.products[0]!.variants[0]!.id),
      (database) =>
        database.query("DELETE FROM prices WHERE variant_id = ?").run(referenceVariantId),
      (database) =>
        database
          .query("DELETE FROM inventory_items WHERE variant_id = ? AND warehouse_id = ?")
          .run(referenceVariantId, predecessor.warehouse.id),
      (database) => {
        const late = plan.addedVariants[2]!.variant;
        database
          .query(
            `INSERT INTO product_variants VALUES (?, 'outside-scope', ?, 'collision', '{}', 0, 0, 0, 0, 'active', ?, ?)`,
          )
          .run(late.id, late.sku, migrationOptions.createdAt, migrationOptions.createdAt);
      },
    ];

    for (const arrange of cases) {
      const database = seededDatabase();
      arrange(database);
      const before = database.query("SELECT COUNT(*) AS count FROM product_variants").get();
      expect(() => executeAtomically(database)).toThrow();
      expect(database.query("SELECT COUNT(*) AS count FROM product_variants").get()).toEqual(
        before,
      );
      expect(database.query("SELECT COUNT(*) AS count FROM audit_events").get()).toEqual({
        count: 0,
      });
      database.close();
    }
  });

  test("submits the ordered migration through one D1 batch boundary", async () => {
    const plan = buildFashionStoreProductContentMigrationPlan(predecessor, successor);
    const prepared: string[] = [];
    const batches: unknown[][] = [];
    await applyFashionStoreProductContentMigration(
      {
        prepare(query) {
          prepared.push(query);
          return { query };
        },
        async batch(statements) {
          batches.push(statements);
          return [];
        },
      },
      plan,
      migrationOptions,
    );

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(prepared.length);
    expect(prepared.at(0)).toBe("PRAGMA foreign_keys = ON");
    expect(prepared.at(-1)).toMatch(/^DROP TABLE /);
  });

  test("rejects a successor that rewrites a historical SKU", () => {
    const changed = structuredClone(successor);
    const historicalVariantId = predecessor.products[0]!.variants[0]!.id;
    const historicalVariant = changed.products
      .flatMap(({ variants }) => variants)
      .find(({ id }) => id === historicalVariantId)!;
    historicalVariant.sku = "REWRITTEN-HISTORICAL-SKU";

    expect(() => buildFashionStoreProductContentMigrationPlan(predecessor, changed)).toThrow(
      /historical Variant/i,
    );
  });

  test("rejects a successor that changes the Commerce warehouse authority", () => {
    const changed = structuredClone(successor);
    changed.warehouse.id = "warehouse_other";

    expect(() => buildFashionStoreProductContentMigrationPlan(predecessor, changed)).toThrow(
      /currency and warehouse authority/i,
    );
  });

  test("rejects new media outside its Product-owned key prefix", () => {
    const changed = structuredClone(successor);
    const product = changed.products.find(({ slug }) => slug === "relaxed-corduroy-shirt")!;
    const media = product.media.find(({ id }) => id === "media_01JFS12SHIRTGOLDFRONT001")!;
    media.r2Key = "catalog/products/prod_wrong/cross-product.jpg";

    expect(() => buildFashionStoreProductContentMigrationPlan(predecessor, changed)).toThrow(
      /Product-owned/i,
    );
  });

  test("rejects rewritten metadata for surviving historical media", () => {
    const changed = structuredClone(successor);
    const historicalMediaId = predecessor.products[0]!.media[0]!.id;
    const historicalMedia = changed.products
      .flatMap(({ media }) => media)
      .find(({ id }) => id === historicalMediaId)!;
    historicalMedia.sha256 = "0".repeat(64);

    expect(() => buildFashionStoreProductContentMigrationPlan(predecessor, changed)).toThrow(
      /historical media/i,
    );
  });
});
