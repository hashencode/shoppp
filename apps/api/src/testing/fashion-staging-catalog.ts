import {
  canonicalCatalogReleaseSchema,
  catalogReleaseDigestInput,
  experienceSnapshotSchema,
  type CanonicalCatalogRelease,
  type ExperienceSnapshot,
  type ProductOptionDefinition,
  type ProductPresentation,
} from "@shoppp/contracts";

import { fashionStoreEnabledPageContracts } from "../../../storefront/app/themes/fashion-store/page-contracts";
import { fashionStoreManifest } from "../../../storefront/app/themes/fashion-store/successor/manifest";
import { fashionStorePreset } from "../../../storefront/app/themes/fashion-store/successor/presets/source-parity";
import { catalogMediaOrigins } from "../storefront-experience/media-origins";

const IAM_TABLES = [
  ["settings", "key"],
  ["admin_permission_definitions", "permission_key"],
  ["admin_roles", "id"],
  ["admin_role_permissions", "role_id, permission_key"],
  ["admin_identities", "id"],
  ["admin_invitations", "id"],
  ["admin_password_credentials", "identity_id"],
  ["admin_sessions", "id"],
  ["admin_password_reset_tokens", "id"],
  ["admin_login_throttles", "key_hash"],
  ["admin_service_credentials", "id"],
] as const;

export const FASHION_STAGING_CATALOG_RESET_TARGET = {
  cloudflareAccountId: "449e7f42fe4c4e55d5c674e2e7c57c8d",
  d1DatabaseId: "eb1ca4ef-3121-4d02-b20e-e619eac1cecc",
  d1DatabaseName: "shoppp-fashion-staging",
  mediaOrigin: "https://pub-4e1c398c57fa4b9f9781bc1abcb507a5.r2.dev",
  r2BucketName: "shoppp-fashion-staging-media",
  resourceNamespace: "shoppp-fashion-staging",
  workerName: "shoppp-api-fashion-staging",
} as const;

export const FASHION_STAGING_REVIEWED_MANIFEST_DIGEST =
  "bf116620e09d1ce40623a7dd596b09da80939e8a74c1a4efba2792913ba63ba8";

const BOOT_CRITICAL_TABLES = ["d1_migrations", "fashion_staging_catalog_reset_locks"] as const;

const DISPOSABLE_TABLES = [
  "audit_events",
  "cart_lines",
  "carts",
  "catalog_release_media_ledger",
  "catalog_release_sources",
  "catalog_releases",
  "categories",
  "checkout_attempts",
  "collection_products",
  "collection_memberships",
  "collection_versions",
  "collection_route_redirects",
  "collections",
  "content_article_versions",
  "content_page_versions",
  "content_route_redirects",
  "d1_backup_runs",
  "fashion_staging_acceptance_resources",
  "fashion_staging_acceptance_runs",
  "fashion_staging_catalog_migrations",
  "fashion_staging_operator_runs",
  "fulfillment_events",
  "idempotency_claims",
  "inventory_items",
  "inventory_reservation_events",
  "inventory_reservation_groups",
  "inventory_reservations",
  "notification_attempts",
  "notification_jobs",
  "navigation_article_references",
  "navigation_collection_references",
  "navigation_page_references",
  "navigation_policy_references",
  "navigation_items",
  "navigation_menu_versions",
  "order_addresses",
  "order_events",
  "order_lines",
  "orders",
  "payment_events",
  "price_lists",
  "prices",
  "policy_versions",
  "privacy_request_events",
  "privacy_requests",
  "product_categories",
  "product_media",
  "product_media_assets",
  "product_reviews",
  "product_revisions",
  "product_variants",
  "products",
  "refund_events",
  "refunds",
  "report_exports",
  "shipping_methods",
  "shipping_zone_countries",
  "shipping_zones",
  "stock_ledger_entries",
  "store_identity_logo_assets",
  "store_identity_versions",
  "storefront_experience_drafts",
  "storefront_experience_migrations",
  "storefront_experience_snapshots",
  "storefront_experience_validations",
  "storefront_preview_builds",
  "storefront_preview_grants",
  "storefront_preview_sessions",
  "warehouses",
] as const;

export type FashionStagingCatalogResetTarget = typeof FASHION_STAGING_CATALOG_RESET_TARGET;

const PRICE_LIST_ID = "price_list_fashion_store_live_usd";
const PRICE_LIST_CODE = "FASHION-STORE-LIVE-USD";
const MIGRATION_ACTOR = "fashion-staging-catalog-migration";
const SHOPPER_EXPERIENCE_ID = "experience-fashion-store-live-catalog";

interface CatalogPrice {
  amount: number;
  compareAtAmount: number;
  currency: "USD";
}

interface CatalogVariant {
  id: string;
  inventory: { onHand: number; oversellLimit: number };
  optionValues: Record<string, string>;
  price: CatalogPrice;
  sku: string;
  status: "active";
  title: string;
  weightGrams: number | null;
}

interface CatalogMedia {
  alt: string;
  height: number;
  id: string;
  mimeType: "image/jpeg";
  order: number;
  r2Key: string;
  sha256: string;
  width: number;
}

interface CatalogProduct {
  description: string;
  id: string;
  media: CatalogMedia[];
  name: string;
  optionDefinitions: ProductOptionDefinition[];
  presentation?: ProductPresentation;
  slug: string;
  status: "published";
  taxonomy: { categories: string[]; tags: string[] };
  variants: CatalogVariant[];
}

interface CatalogInput {
  catalogVersion: string;
  collection: { id: string; name: string; slug: string };
  products: CatalogProduct[];
  r2Prefix: string;
  schemaVersion: 1;
  warehouse: { code: string; id: string; name: string };
}

export interface FashionStagingCatalogApplyInput {
  acceptanceProduct: { id: string; slug: string; variantId: string; sku: string };
  acceptanceRelease: CanonicalCatalogRelease;
  catalog: CatalogInput;
  environment: "fashion-staging";
  expectedIamFingerprint: string;
  manifestDigest: string;
  shopperRelease: CanonicalCatalogRelease;
  target: FashionStagingCatalogResetTarget;
}

export interface FashionStagingCatalogReceipt {
  acceptanceReleaseId: string;
  catalogVersion: string;
  iamFingerprint: string;
  manifestDigest: string;
  mediaCount: number;
  productCount: number;
  shopperReleaseId: string;
  status: "applied" | "already_applied";
  variantCount: number;
}

export interface FashionStagingCatalogVerification extends FashionStagingCatalogReceipt {
  activeArtifactDigest: string | null;
  activeArtifactPrefix: string | null;
  activeBuildId: string | null;
  dimensionsVerified: number;
  foreignKeyViolations: number;
  releaseDigest: string;
  sellableVariantCount: number;
}

export interface FashionStagingCatalogResetReceipt extends FashionStagingCatalogReceipt {
  deletedMediaCount: number;
  deletedTableCount: number;
}

export interface FashionStagingCatalogMediaPreflight {
  missingKeys: string[];
  presentKeys: string[];
}

export interface FashionStagingCatalogTerminalActivation {
  activeArtifactDigest: string;
  activeArtifactPrefix: string;
  activeBuildId: string;
  catalogVersion: string;
  manifestDigest: string;
  shopperReleaseId: string;
}

export interface FashionStagingCatalogResumableActivation {
  activeBuildId: string;
  catalogVersion: string;
  manifestDigest: string;
  shopperReleaseId: string;
}

export interface FashionStagingCatalogActivationPreparation {
  buildId: string;
  buildInput: {
    catalogRelease: CanonicalCatalogRelease;
    environment: "preview";
    expectedOrigin: "https://shoppp-storefront-fashion-preview.hashencode.workers.dev";
    inputIdentity: {
      catalogReleaseId: string;
      experienceSnapshotId: string;
      experienceVersion: number;
      platformContractVersion: string;
      themeId: "fashion-store";
      themeVersion: string;
    };
    mediaOrigins: string[];
    presentationMode: "live";
    snapshot: ExperienceSnapshot;
    themeId: "fashion-store";
  };
  shopperReleaseId: string;
  snapshotId: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function fashionStagingCatalogReviewedPayloadDigest(
  rawInput: unknown,
): Promise<string> {
  const input = rawInput as FashionStagingCatalogApplyInput;
  const { expectedIamFingerprint: _dynamicIamFingerprint, ...reviewedPayload } = input;
  return sha256(JSON.stringify(canonicalize(reviewedPayload)));
}

export async function fashionStagingIamFingerprint(db: D1Database): Promise<string> {
  const snapshot: Array<{ rows: unknown[]; table: string }> = [];
  for (const [table, order] of IAM_TABLES) {
    const result = await db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all();
    snapshot.push({ rows: result.results, table });
  }
  return sha256(JSON.stringify(canonicalize(snapshot)));
}

export async function getFashionStagingCatalogPreflight(db: D1Database): Promise<{
  activeWorkCount: number;
  iamFingerprint: string;
}> {
  const [acceptance, operator, releases, builds, iamFingerprint] = await Promise.all([
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM fashion_staging_acceptance_runs WHERE status IN ('acquired', 'running', 'cleanup_pending')",
      )
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM fashion_staging_operator_runs WHERE status IN ('awaiting_operator', 'approved')",
      )
      .first<{ count: number }>(),
    db
      .prepare("SELECT COUNT(*) AS count FROM catalog_releases WHERE status = 'building'")
      .first<{ count: number }>(),
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM storefront_preview_builds WHERE status IN ('pending', 'building')",
      )
      .first<{ count: number }>(),
    fashionStagingIamFingerprint(db),
  ]);
  return {
    activeWorkCount:
      Number(acceptance?.count ?? 0) +
      Number(operator?.count ?? 0) +
      Number(releases?.count ?? 0) +
      Number(builds?.count ?? 0),
    iamFingerprint,
  };
}

function assertSafeSchemaName(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error("fashion_catalog_reset_schema_invalid");
  return value;
}

export async function getFashionStagingCatalogResetInventory(db: D1Database): Promise<{
  bootCritical: string[];
  disposable: string[];
  missing: string[];
  preserved: string[];
  unknown: string[];
}> {
  const rows = await db
    .prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all<{ name: string }>();
  const actual = rows.results.map(({ name }) => name).filter((name) => !name.startsWith("_cf_"));
  const preserved = IAM_TABLES.map(([table]) => table).sort();
  const bootCritical = [...BOOT_CRITICAL_TABLES].sort();
  const disposable = [...DISPOSABLE_TABLES].sort();
  const expected = new Set<string>([...preserved, ...bootCritical, ...disposable]);
  const actualSet = new Set(actual);
  return {
    bootCritical,
    disposable,
    missing: [...expected].filter((table) => !actualSet.has(table)).sort(),
    preserved,
    unknown: actual.filter((table) => !expected.has(table)).sort(),
  };
}

function assertResetTarget(target: unknown): asserts target is FashionStagingCatalogResetTarget {
  if (
    !target ||
    typeof target !== "object" ||
    Object.entries(FASHION_STAGING_CATALOG_RESET_TARGET).some(
      ([key, expected]) => (target as Record<string, unknown>)[key] !== expected,
    ) ||
    Object.keys(target).length !== Object.keys(FASHION_STAGING_CATALOG_RESET_TARGET).length
  ) {
    throw new Error("fashion_catalog_reset_target_mismatch");
  }
}

async function obsoleteCatalogMediaKeys(
  bucket: R2Bucket,
  currentPrefix: string,
): Promise<string[]> {
  const root = "catalog/fashion-store/";
  if (!currentPrefix.startsWith(root) || currentPrefix.split("/").length !== 3) {
    throw new Error("fashion_catalog_reset_prefix_invalid");
  }
  const obsolete: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list(cursor ? { cursor, prefix: root } : { prefix: root });
    for (const object of page.objects) {
      if (!object.key.startsWith(root) || object.key.slice(root.length).split("/").length < 2) {
        throw new Error(`fashion_catalog_reset_prefix_inventory_invalid:${object.key}`);
      }
      if (!object.key.startsWith(`${currentPrefix}/`)) obsolete.push(object.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return obsolete.sort();
}

async function clearFashionStagingBusinessTables(db: D1Database): Promise<number> {
  const inventory = await getFashionStagingCatalogResetInventory(db);
  if (inventory.unknown.length > 0 || inventory.missing.length > 0) {
    throw new Error(
      `fashion_catalog_reset_schema_drift:unknown=${inventory.unknown.join(",")};missing=${inventory.missing.join(",")}`,
    );
  }
  const placeholders = inventory.disposable.map(() => "?").join(", ");
  const triggerRows = await db
    .prepare(
      `SELECT name, sql FROM sqlite_schema
        WHERE type = 'trigger' AND tbl_name IN (${placeholders})
        ORDER BY name`,
    )
    .bind(...inventory.disposable)
    .all<{ name: string; sql: string }>();
  const statements: D1PreparedStatement[] = [db.prepare("PRAGMA defer_foreign_keys = ON")];
  for (const trigger of triggerRows.results) {
    statements.push(db.prepare(`DROP TRIGGER ${assertSafeSchemaName(trigger.name)}`));
  }
  for (const table of inventory.disposable) {
    statements.push(db.prepare(`DELETE FROM ${assertSafeSchemaName(table)}`));
  }
  for (const trigger of triggerRows.results) {
    if (!trigger.sql?.startsWith("CREATE TRIGGER ")) {
      throw new Error(`fashion_catalog_reset_trigger_invalid:${trigger.name}`);
    }
    statements.push(db.prepare(trigger.sql));
  }
  await db.batch(statements);
  return inventory.disposable.length;
}

const RESET_LOCK_ID = "fashion-staging-catalog-reset";

async function acquireFashionStagingCatalogResetLock(
  db: D1Database,
  requestId: string,
  now: Date,
): Promise<void> {
  const result = await db
    .prepare(
      `INSERT INTO fashion_staging_catalog_reset_locks (id, owner_request_id, created_at)
       SELECT ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM fashion_staging_catalog_reset_locks WHERE id = ?)
          AND NOT EXISTS (
            SELECT 1 FROM audit_events
             WHERE action = 'catalog.fashion-staging.activation' AND result = 'succeeded'
          )
          AND NOT EXISTS (
            SELECT 1 FROM fashion_staging_acceptance_runs
             WHERE status IN ('acquired', 'running', 'cleanup_pending')
          )
          AND NOT EXISTS (
            SELECT 1 FROM fashion_staging_operator_runs
             WHERE status IN ('awaiting_operator', 'approved')
          )
          AND NOT EXISTS (SELECT 1 FROM catalog_releases WHERE status = 'building')
          AND NOT EXISTS (
            SELECT 1 FROM storefront_preview_builds WHERE status IN ('pending', 'building')
          )`,
    )
    .bind(RESET_LOCK_ID, requestId, now.toISOString(), RESET_LOCK_ID)
    .run();
  if (Number(result.meta.changes ?? 0) === 1) return;

  if (await isFashionStagingCatalogResetClosed(db)) {
    throw new Error("fashion_catalog_reset_closed");
  }
  const preflight = await getFashionStagingCatalogPreflight(db);
  if (preflight.activeWorkCount > 0) throw new Error("fashion_catalog_active_work");
  throw new Error("fashion_catalog_reset_in_progress");
}

async function releaseFashionStagingCatalogResetLock(
  db: D1Database,
  requestId: string,
): Promise<void> {
  await db
    .prepare(
      "DELETE FROM fashion_staging_catalog_reset_locks WHERE id = ? AND owner_request_id = ?",
    )
    .bind(RESET_LOCK_ID, requestId)
    .run();
}

function assertInput(input: FashionStagingCatalogApplyInput): void {
  if (input.environment !== "fashion-staging")
    throw new Error("fashion_catalog_environment_required");
  if (!/^[a-f0-9]{64}$/.test(input.manifestDigest))
    throw new Error("fashion_catalog_digest_invalid");
  if (!/^[a-f0-9]{64}$/.test(input.expectedIamFingerprint)) {
    throw new Error("fashion_catalog_iam_fingerprint_invalid");
  }
  const variants = input.catalog.products.flatMap(({ variants }) => variants);
  const media = input.catalog.products.flatMap((product) => product.media);
  if (input.catalog.schemaVersion !== 1 || input.catalog.products.length !== 13) {
    throw new Error("fashion_catalog_product_count_invalid");
  }
  if (variants.length !== 24) throw new Error("fashion_catalog_variant_count_invalid");
  if (media.length !== 18) throw new Error("fashion_catalog_media_count_invalid");
  if (new Set(input.catalog.products.map(({ id }) => id)).size !== 13) {
    throw new Error("fashion_catalog_product_identity_invalid");
  }
  if (new Set(variants.map(({ id }) => id)).size !== 24) {
    throw new Error("fashion_catalog_variant_identity_invalid");
  }
  if (new Set(media.map(({ r2Key }) => r2Key)).size !== 18) {
    throw new Error("fashion_catalog_media_identity_invalid");
  }
  for (const product of input.catalog.products) {
    for (const variant of product.variants) {
      if (
        variant.price.currency !== "USD" ||
        variant.price.amount <= 0 ||
        variant.price.compareAtAmount <= variant.price.amount ||
        variant.inventory.onHand <= 0 ||
        variant.inventory.oversellLimit !== 0
      ) {
        throw new Error("fashion_catalog_variant_value_invalid");
      }
    }
    for (const mediaItem of product.media) {
      if (
        mediaItem.mimeType !== "image/jpeg" ||
        !mediaItem.r2Key.startsWith(`${input.catalog.r2Prefix}/`) ||
        !/^[a-f0-9]{64}$/.test(mediaItem.sha256)
      ) {
        throw new Error("fashion_catalog_media_value_invalid");
      }
    }
  }
  const shopper = canonicalCatalogReleaseSchema.parse(input.shopperRelease);
  const acceptance = canonicalCatalogReleaseSchema.parse(input.acceptanceRelease);
  if (
    shopper.releaseId !== `${input.catalog.catalogVersion}-shopper-release` ||
    acceptance.releaseId !== `${input.catalog.catalogVersion}-acceptance-release` ||
    shopper.products.length !== 13 ||
    shopper.products.flatMap(({ variants }) => variants).length !== 24 ||
    acceptance.products.length !== 1 ||
    acceptance.products[0]?.id !== input.acceptanceProduct.id ||
    shopper.products.some(({ id }) => id === input.acceptanceProduct.id)
  ) {
    throw new Error("fashion_catalog_release_shape_invalid");
  }
  for (const product of input.catalog.products) {
    const released = shopper.products.find(({ id }) => id === product.id);
    if (
      !released ||
      released.slug !== product.slug ||
      JSON.stringify(released.variants.map(({ id }) => id).sort()) !==
        JSON.stringify(product.variants.map(({ id }) => id).sort()) ||
      released.media.length !== product.media.length
    ) {
      throw new Error("fashion_catalog_release_identity_mismatch");
    }
    for (const variant of product.variants) {
      const releasedVariant = released.variants.find(({ id }) => id === variant.id);
      const price = releasedVariant?.prices.find(({ currency }) => currency === "USD");
      if (
        !releasedVariant ||
        releasedVariant.sku !== variant.sku ||
        price?.amount !== variant.price.amount ||
        price.compareAtAmount !== variant.price.compareAtAmount
      ) {
        throw new Error("fashion_catalog_release_price_mismatch");
      }
    }
    product.media.forEach((media, index) => {
      const releasedMedia = released.media[index];
      if (
        !releasedMedia ||
        !releasedMedia.src.endsWith(`/${media.r2Key}`) ||
        releasedMedia.alt !== media.alt ||
        releasedMedia.width !== media.width ||
        releasedMedia.height !== media.height
      ) {
        throw new Error("fashion_catalog_release_media_mismatch");
      }
    });
  }
}

async function assertMedia(bucket: R2Bucket, catalog: CatalogInput): Promise<void> {
  for (const media of catalog.products.flatMap((product) => product.media)) {
    const object = await bucket.get(media.r2Key);
    if (!object) throw new Error(`fashion_catalog_media_missing:${media.r2Key}`);
    const objectDigest = await sha256(await object.arrayBuffer());
    if (
      object.httpMetadata?.contentType !== media.mimeType ||
      (object.customMetadata?.sha256 !== undefined &&
        object.customMetadata.sha256 !== media.sha256) ||
      objectDigest !== media.sha256
    ) {
      throw new Error(`fashion_catalog_media_mismatch:${media.r2Key}`);
    }
  }
}

export async function preflightFashionStagingCatalogMedia(
  db: D1Database,
  bucket: R2Bucket,
  rawInput: unknown,
  reviewedPayloadDigest = FASHION_STAGING_REVIEWED_MANIFEST_DIGEST,
): Promise<FashionStagingCatalogMediaPreflight> {
  const input = rawInput as FashionStagingCatalogApplyInput;
  assertResetTarget(input?.target);
  assertInput(input);
  const computedDigest = await sha256(JSON.stringify(canonicalize(input.catalog)));
  if (computedDigest !== input.manifestDigest) throw new Error("fashion_catalog_digest_mismatch");
  if ((await fashionStagingCatalogReviewedPayloadDigest(input)) !== reviewedPayloadDigest) {
    throw new Error("fashion_catalog_reset_manifest_not_reviewed");
  }
  const resetPreflight = await getFashionStagingCatalogPreflight(db);
  if (resetPreflight.activeWorkCount > 0) throw new Error("fashion_catalog_active_work");
  if (resetPreflight.iamFingerprint !== input.expectedIamFingerprint) {
    throw new Error("fashion_catalog_iam_drift");
  }

  const expected = new Map(
    input.catalog.products
      .flatMap((product) => product.media)
      .map((media) => [media.r2Key, media] as const),
  );
  const presentKeys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list(
      cursor
        ? { cursor, prefix: `${input.catalog.r2Prefix}/` }
        : { prefix: `${input.catalog.r2Prefix}/` },
    );
    for (const listed of page.objects) {
      const media = expected.get(listed.key);
      if (!media) throw new Error(`fashion_catalog_media_unexpected:${listed.key}`);
      const object = await bucket.get(listed.key);
      if (
        !object ||
        object.httpMetadata?.contentType !== media.mimeType ||
        (object.customMetadata?.sha256 !== undefined &&
          object.customMetadata.sha256 !== media.sha256) ||
        (await sha256(await object.arrayBuffer())) !== media.sha256
      ) {
        throw new Error(`fashion_catalog_media_mismatch:${listed.key}`);
      }
      presentKeys.push(listed.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const present = new Set(presentKeys);
  return {
    missingKeys: [...expected.keys()].filter((key) => !present.has(key)).sort(),
    presentKeys: presentKeys.sort(),
  };
}

async function countMatches(
  db: D1Database,
  table: string,
  column: string,
  values: string[],
): Promise<number> {
  if (values.length === 0) return 0;
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM ${table} WHERE ${column} IN (${values.map(() => "?").join(", ")})`,
    )
    .bind(...values)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function bindInsert(db: D1Database, sql: string, values: unknown[]): D1PreparedStatement {
  return db.prepare(sql).bind(...values);
}

export async function applyFashionStagingCatalog(
  db: D1Database,
  mediaBucket: R2Bucket,
  rawInput: unknown,
  requestId: string,
  now = new Date(),
): Promise<FashionStagingCatalogReceipt> {
  const input = rawInput as FashionStagingCatalogApplyInput;
  assertInput(input);
  const computedDigest = await sha256(JSON.stringify(canonicalize(input.catalog)));
  if (computedDigest !== input.manifestDigest) throw new Error("fashion_catalog_digest_mismatch");

  const existing = await db
    .prepare("SELECT * FROM fashion_staging_catalog_migrations WHERE catalog_version = ?")
    .bind(input.catalog.catalogVersion)
    .first<Record<string, string | number>>();
  if (existing) {
    if (
      existing.manifest_digest !== input.manifestDigest ||
      existing.iam_fingerprint_before !== input.expectedIamFingerprint
    ) {
      throw new Error("fashion_catalog_version_collision");
    }
    const currentIam = await fashionStagingIamFingerprint(db);
    if (currentIam !== existing.iam_fingerprint_after) throw new Error("fashion_catalog_iam_drift");
    return {
      acceptanceReleaseId: String(existing.acceptance_release_id),
      catalogVersion: input.catalog.catalogVersion,
      iamFingerprint: currentIam,
      manifestDigest: input.manifestDigest,
      mediaCount: Number(existing.media_count),
      productCount: Number(existing.product_count),
      shopperReleaseId: String(existing.shopper_release_id),
      status: "already_applied",
      variantCount: Number(existing.variant_count),
    };
  }

  const preflight = await getFashionStagingCatalogPreflight(db);
  if (preflight.activeWorkCount > 0) throw new Error("fashion_catalog_active_work");
  if (preflight.iamFingerprint !== input.expectedIamFingerprint) {
    throw new Error("fashion_catalog_iam_drift");
  }
  await assertMedia(mediaBucket, input.catalog);

  const products = input.catalog.products;
  const variants = products.flatMap((product) => product.variants);
  const media = products.flatMap((product) => product.media);
  const categoryNames = [
    ...new Set(
      products.flatMap((product) => [...product.taxonomy.categories, ...product.taxonomy.tags]),
    ),
  ];
  const categoryIds = categoryNames.map((name) => `cat_fs8_${slug(name)}`);
  const categorySlugs = categoryNames.map((name) => `fashion-store-${slug(name)}`);
  const warehouseIdentity = await db
    .prepare("SELECT id, code FROM warehouses WHERE id = ? OR code = ?")
    .bind(input.catalog.warehouse.id, input.catalog.warehouse.code)
    .all<{ id: string; code: string }>();
  if (
    warehouseIdentity.results.some(
      ({ code, id }) => id !== input.catalog.warehouse.id || code !== input.catalog.warehouse.code,
    )
  ) {
    throw new Error("fashion_catalog_warehouse_collision");
  }
  const collisionCounts = await Promise.all([
    countMatches(db, "products", "id", [
      ...products.map(({ id }) => id),
      input.acceptanceProduct.id,
    ]),
    countMatches(db, "products", "slug", [
      ...products.map(({ slug }) => slug),
      input.acceptanceProduct.slug,
    ]),
    countMatches(db, "product_variants", "id", [
      ...variants.map(({ id }) => id),
      input.acceptanceProduct.variantId,
    ]),
    countMatches(db, "product_variants", "sku", [
      ...variants.map(({ sku }) => sku),
      input.acceptanceProduct.sku,
    ]),
    countMatches(db, "prices", "id", [
      ...variants.map(({ id }) => `price_${id}`),
      `price_${input.acceptanceProduct.variantId}`,
    ]),
    countMatches(
      db,
      "product_media",
      "id",
      media.map(({ id }) => id),
    ),
    countMatches(
      db,
      "product_media",
      "r2_key",
      media.map(({ r2Key }) => r2Key),
    ),
    countMatches(db, "catalog_releases", "id", [
      input.shopperRelease.releaseId,
      input.acceptanceRelease.releaseId,
    ]),
    countMatches(db, "collections", "id", [input.catalog.collection.id]),
    countMatches(db, "collections", "slug", [input.catalog.collection.slug]),
    countMatches(db, "categories", "id", categoryIds),
    countMatches(db, "categories", "slug", categorySlugs),
    countMatches(db, "price_lists", "id", [PRICE_LIST_ID]),
    countMatches(db, "price_lists", "code", [PRICE_LIST_CODE]),
  ]);
  if (collisionCounts.some((count) => count > 0))
    throw new Error("fashion_catalog_identity_collision");

  const at = now.toISOString();
  const statements: D1PreparedStatement[] = [];
  statements.push(
    bindInsert(
      db,
      `INSERT INTO price_lists (id, code, currency, status, created_at, updated_at)
       VALUES (?, ?, 'USD', 'active', ?, ?)`,
      [PRICE_LIST_ID, PRICE_LIST_CODE, at, at],
    ),
    bindInsert(
      db,
      "INSERT INTO warehouses (id, code, name, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
      [input.catalog.warehouse.id, input.catalog.warehouse.code, input.catalog.warehouse.name, at],
    ),
    bindInsert(
      db,
      `INSERT INTO collections (id, slug, name, description, status, created_at, updated_at)
       VALUES (?, ?, ?, '', 'published', ?, ?)`,
      [
        input.catalog.collection.id,
        input.catalog.collection.slug,
        input.catalog.collection.name,
        at,
        at,
      ],
    ),
    bindInsert(
      db,
      `INSERT INTO collection_versions
        (collection_id, version, slug, name, description, status, created_at, updated_at, published_at)
       VALUES (?, 1, ?, ?, '', 'published', ?, ?, ?)`,
      [
        input.catalog.collection.id,
        input.catalog.collection.slug,
        input.catalog.collection.name,
        at,
        at,
        at,
      ],
    ),
  );
  for (const name of categoryNames) {
    const categorySlug = `fashion-store-${slug(name)}`;
    statements.push(
      bindInsert(
        db,
        "INSERT INTO categories (id, parent_id, slug, name, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?)",
        [`cat_fs8_${slug(name)}`, categorySlug, name, at, at],
      ),
    );
  }
  products.forEach((product, productIndex) => {
    statements.push(
      bindInsert(
        db,
        `INSERT INTO products
           (id, slug, name, description, option_definitions_json, presentation_json, status, seo_title, seo_description, published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)`,
        [
          product.id,
          product.slug,
          product.name,
          product.description,
          JSON.stringify(product.optionDefinitions),
          product.presentation ? JSON.stringify(product.presentation) : null,
          `${product.name} | Shoppp`,
          product.description,
          at,
          at,
          at,
        ],
      ),
      bindInsert(
        db,
        `INSERT INTO collection_memberships
          (collection_id, collection_version, product_id, position) VALUES (?, 1, ?, ?)`,
        [input.catalog.collection.id, product.id, productIndex],
      ),
    );
    for (const name of new Set([...product.taxonomy.categories, ...product.taxonomy.tags])) {
      statements.push(
        bindInsert(db, "INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)", [
          product.id,
          `cat_fs8_${slug(name)}`,
        ]),
      );
    }
    for (const variant of product.variants) {
      statements.push(
        bindInsert(
          db,
          `INSERT INTO product_variants
             (id, product_id, sku, title, option_values_json, weight_grams, length_mm, width_mm, height_mm, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 'active', ?, ?)`,
          [
            variant.id,
            product.id,
            variant.sku,
            variant.title,
            JSON.stringify(variant.optionValues),
            variant.weightGrams ?? 0,
            at,
            at,
          ],
        ),
        bindInsert(
          db,
          `INSERT INTO prices
             (id, price_list_id, variant_id, amount, compare_at_amount, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            `price_${variant.id}`,
            PRICE_LIST_ID,
            variant.id,
            variant.price.amount,
            variant.price.compareAtAmount,
            at,
            at,
          ],
        ),
        bindInsert(
          db,
          `INSERT INTO inventory_items
             (variant_id, warehouse_id, on_hand_quantity, reserved_quantity, backordered_quantity, oversell_limit, version, updated_at)
           VALUES (?, ?, ?, 0, 0, 0, 0, ?)`,
          [variant.id, input.catalog.warehouse.id, variant.inventory.onHand, at],
        ),
      );
    }
    for (const item of product.media) {
      statements.push(
        bindInsert(
          db,
          `INSERT INTO product_media
             (id, product_id, variant_id, r2_key, alt_text, width, height, position, created_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
          [item.id, product.id, item.r2Key, item.alt, item.width, item.height, item.order - 1, at],
        ),
      );
    }
  });
  statements.push(
    bindInsert(
      db,
      `INSERT INTO products
         (id, slug, name, description, status, seo_title, seo_description, published_at, created_at, updated_at)
       VALUES (?, ?, 'Unavailable acceptance product', 'Protected acceptance-only identity.', 'draft', '', '', NULL, ?, ?)`,
      [input.acceptanceProduct.id, input.acceptanceProduct.slug, at, at],
    ),
    bindInsert(
      db,
      `INSERT INTO product_variants
         (id, product_id, sku, title, option_values_json, weight_grams, length_mm, width_mm, height_mm, status, created_at, updated_at)
       VALUES (?, ?, ?, 'Unavailable', '{"state":"unavailable"}', 0, 0, 0, 0, 'active', ?, ?)`,
      [
        input.acceptanceProduct.variantId,
        input.acceptanceProduct.id,
        input.acceptanceProduct.sku,
        at,
        at,
      ],
    ),
    bindInsert(
      db,
      `INSERT INTO prices (id, price_list_id, variant_id, amount, compare_at_amount, created_at, updated_at)
       VALUES (?, ?, ?, 100, NULL, ?, ?)`,
      [
        `price_${input.acceptanceProduct.variantId}`,
        PRICE_LIST_ID,
        input.acceptanceProduct.variantId,
        at,
        at,
      ],
    ),
    bindInsert(
      db,
      `INSERT INTO inventory_items
         (variant_id, warehouse_id, on_hand_quantity, reserved_quantity, backordered_quantity, oversell_limit, version, updated_at)
       VALUES (?, ?, 0, 0, 0, 0, 0, ?)`,
      [input.acceptanceProduct.variantId, input.catalog.warehouse.id, at],
    ),
  );
  for (const release of [input.shopperRelease, input.acceptanceRelease]) {
    statements.push(
      bindInsert(
        db,
        `INSERT INTO catalog_releases
           (id, status, manifest_json, approved_at, created_at, updated_at)
         VALUES (?, 'approved', ?, ?, ?, ?)`,
        [release.releaseId, JSON.stringify(release), at, at, at],
      ),
    );
  }
  const auditEventId = `audit_fashion_catalog_${requestId}`;
  statements.push(
    bindInsert(
      db,
      `INSERT INTO audit_events
         (id, actor_type, actor_id, action, target_type, target_id, result, reason, request_id, metadata_json, created_at)
       VALUES (?, 'machine', ?, 'catalog.fashion-staging.migrate', 'catalog_version', ?, 'succeeded',
               'Apply reviewed Fashion Store live catalog', ?, ?, ?)`,
      [
        auditEventId,
        MIGRATION_ACTOR,
        input.catalog.catalogVersion,
        requestId,
        JSON.stringify({ manifestDigest: input.manifestDigest }),
        at,
      ],
    ),
    bindInsert(
      db,
      `INSERT INTO fashion_staging_catalog_migrations
         (catalog_version, manifest_digest, catalog_manifest_json,
          iam_fingerprint_before, iam_fingerprint_after,
          shopper_release_id, acceptance_release_id, product_count, variant_count, media_count,
          actor_id, audit_event_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 13, 24, 18, ?, ?, ?)`,
      [
        input.catalog.catalogVersion,
        input.manifestDigest,
        JSON.stringify(input.catalog),
        preflight.iamFingerprint,
        preflight.iamFingerprint,
        input.shopperRelease.releaseId,
        input.acceptanceRelease.releaseId,
        MIGRATION_ACTOR,
        auditEventId,
        at,
      ],
    ),
  );
  await db.batch(statements);
  const afterIam = await fashionStagingIamFingerprint(db);
  if (afterIam !== preflight.iamFingerprint) throw new Error("fashion_catalog_iam_changed");
  return {
    acceptanceReleaseId: input.acceptanceRelease.releaseId,
    catalogVersion: input.catalog.catalogVersion,
    iamFingerprint: afterIam,
    manifestDigest: input.manifestDigest,
    mediaCount: media.length,
    productCount: products.length,
    shopperReleaseId: input.shopperRelease.releaseId,
    status: "applied",
    variantCount: variants.length,
  };
}

export async function isFashionStagingCatalogResetClosed(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'catalog.fashion-staging.activation' AND result = 'succeeded'",
    )
    .first<{ count: number }>();
  return Number(row?.count ?? 0) > 0;
}

export async function getFashionStagingCatalogTerminalActivation(
  db: D1Database,
): Promise<FashionStagingCatalogTerminalActivation | null> {
  const row = await db
    .prepare(
      `SELECT m.catalog_version, m.manifest_digest, m.shopper_release_id,
              b.id AS active_build_id, b.artifact_digest AS active_artifact_digest,
              b.artifact_prefix AS active_artifact_prefix
         FROM audit_events a
         JOIN storefront_preview_builds b
           ON b.id = a.target_id AND b.status = 'deployed'
         JOIN fashion_staging_catalog_migrations m
           ON m.shopper_release_id = b.catalog_release_id
        WHERE a.action = 'catalog.fashion-staging.activation'
          AND a.result = 'succeeded'
        ORDER BY a.created_at DESC
        LIMIT 1`,
    )
    .first<{
      active_artifact_digest: string;
      active_artifact_prefix: string;
      active_build_id: string;
      catalog_version: string;
      manifest_digest: string;
      shopper_release_id: string;
    }>();
  if (!row) return null;
  return {
    activeArtifactDigest: row.active_artifact_digest,
    activeArtifactPrefix: row.active_artifact_prefix,
    activeBuildId: row.active_build_id,
    catalogVersion: row.catalog_version,
    manifestDigest: row.manifest_digest,
    shopperReleaseId: row.shopper_release_id,
  };
}

export async function getFashionStagingCatalogResumableActivation(
  db: D1Database,
): Promise<FashionStagingCatalogResumableActivation | null> {
  const migrations = await db
    .prepare(
      `SELECT catalog_version, manifest_digest, shopper_release_id
         FROM fashion_staging_catalog_migrations
        ORDER BY created_at`,
    )
    .all<{
      catalog_version: string;
      manifest_digest: string;
      shopper_release_id: string;
    }>();
  if (migrations.results.length !== 1) return null;
  const migration = migrations.results[0]!;
  const expectedSnapshotId = "snapshot-fashion-store-live-catalog-v1";
  const inputToken = (await sha256(migration.shopper_release_id)).slice(0, 16);
  const expectedBuildId = `preview-build-${expectedSnapshotId.slice(-24)}-${inputToken}-1`;
  const build = await db
    .prepare(
      `SELECT id
         FROM storefront_preview_builds
        WHERE id = ? AND snapshot_id = ? AND catalog_release_id = ? AND status = 'building'`,
    )
    .bind(expectedBuildId, expectedSnapshotId, migration.shopper_release_id)
    .first<{ id: string }>();
  if (!build) return null;
  return {
    activeBuildId: build.id,
    catalogVersion: migration.catalog_version,
    manifestDigest: migration.manifest_digest,
    shopperReleaseId: migration.shopper_release_id,
  };
}

export async function closeFashionStagingCatalogReset(
  db: D1Database,
  buildId: string,
  requestId: string,
  now = new Date(),
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO audit_events
         (id, actor_type, actor_id, action, target_type, target_id, result, reason, request_id, metadata_json, created_at)
       VALUES (?, 'machine', ?, 'catalog.fashion-staging.activation', 'storefront_preview_build', ?, 'succeeded',
               'Fashion staging catalog reset activation completed', ?, '{}', ?)`,
    )
    .bind(
      `audit_fashion_catalog_activation_${buildId}`,
      "fashion-staging-catalog-reset",
      buildId,
      requestId,
      now.toISOString(),
    )
    .run();
}

function shopperExperienceSnapshot(
  release: CanonicalCatalogRelease,
  approvedAt: string,
  actorId: string,
): ExperienceSnapshot {
  const collection = release.collections.find(({ status }) => status === "published");
  if (!collection) throw new Error("fashion_catalog_activation_collection_missing");
  const enabledPages = new Set(fashionStoreEnabledPageContracts.map(({ pageType }) => pageType));
  return experienceSnapshotSchema.parse({
    approvedAt,
    approvedBy: actorId,
    bindings: [
      {
        id: "catalog-fashion-store-live-home-collection",
        instanceId: "fashion-store-home",
        kind: "catalog",
        reference: { id: collection.id, kind: "collection" },
        settingId: "featured-collection",
      },
      {
        id: "catalog-fashion-store-live-default-collection",
        instanceId: "fashion-store-collection",
        kind: "catalog",
        reference: { id: collection.id, kind: "collection" },
        settingId: "default-collection",
      },
    ],
    configurationSchemaVersion: fashionStoreManifest.configurationSchemaVersion,
    experienceId: SHOPPER_EXPERIENCE_ID,
    id: "snapshot-fashion-store-live-catalog-v1",
    kind: "approved",
    overrides: [],
    platformContractVersion: fashionStoreManifest.platformContractVersion,
    provenance: fashionStoreManifest.provenance,
    resolvedTemplates: fashionStorePreset.templates.filter(({ pageType }) =>
      enabledPages.has(pageType),
    ),
    themeId: "fashion-store",
    themeVersion: fashionStoreManifest.themeVersion,
    version: 1,
  });
}

async function soleCatalogMigration(db: D1Database) {
  const rows = await db
    .prepare(
      `SELECT catalog_version, manifest_digest, shopper_release_id
         FROM fashion_staging_catalog_migrations
        ORDER BY created_at`,
    )
    .all<{
      catalog_version: string;
      manifest_digest: string;
      shopper_release_id: string;
    }>();
  if (rows.results.length !== 1) throw new Error("fashion_catalog_activation_reset_missing");
  return rows.results[0]!;
}

export async function prepareFashionStagingCatalogActivation(
  db: D1Database,
  requestId: string,
  now = new Date(),
): Promise<FashionStagingCatalogActivationPreparation> {
  const migration = await soleCatalogMigration(db);
  const releaseRow = await db
    .prepare("SELECT status, manifest_json FROM catalog_releases WHERE id = ?")
    .bind(migration.shopper_release_id)
    .first<{ manifest_json: string; status: string }>();
  if (!releaseRow || !new Set(["approved", "deployed"]).has(releaseRow.status)) {
    throw new Error("fashion_catalog_activation_release_unavailable");
  }
  const release = canonicalCatalogReleaseSchema.parse(JSON.parse(releaseRow.manifest_json));
  if (release.releaseId !== migration.shopper_release_id || release.products.length !== 13) {
    throw new Error("fashion_catalog_activation_release_mismatch");
  }
  const actor = await db
    .prepare(
      `SELECT id
         FROM admin_identities
        WHERE enabled = 1
        ORDER BY CASE principal_kind WHEN 'service' THEN 0 ELSE 1 END, id
        LIMIT 1`,
    )
    .first<{ id: string }>();
  if (!actor) throw new Error("fashion_catalog_activation_actor_missing");
  const at = now.toISOString();
  const snapshot = shopperExperienceSnapshot(release, release.generatedAt, actor.id);
  const draftId = "draft-fashion-store-live-catalog-v1";
  const validationId = "validation-fashion-store-live-catalog-v1";
  const deduplicationKey = `${draftId}:1:${release.releaseId}:approved:${snapshot.themeVersion}:${snapshot.configurationSchemaVersion}`;
  const inputToken = (await sha256(release.releaseId)).slice(0, 16);
  const buildId = `preview-build-${snapshot.id.slice(-24)}-${inputToken}-1`;
  const mediaOrigins = catalogMediaOrigins(release);
  const contentDigest = await sha256(JSON.stringify(canonicalize(snapshot)));
  await db.batch([
    db
      .prepare(
        `UPDATE catalog_releases
            SET status = 'deployed', deployed_at = COALESCE(deployed_at, ?), updated_at = ?
          WHERE id = ? AND status IN ('approved', 'deployed')`,
      )
      .bind(at, at, release.releaseId),
    db
      .prepare(
        `INSERT OR IGNORE INTO storefront_experience_drafts
           (id, experience_id, theme_id, theme_version, configuration_schema_version,
            preset_id, bindings_json, overrides_json, version, created_by, updated_by,
            created_at, updated_at)
         VALUES (?, ?, 'fashion-store', ?, ?, ?, ?, '[]', 1, ?, ?, ?, ?)`,
      )
      .bind(
        draftId,
        SHOPPER_EXPERIENCE_ID,
        snapshot.themeVersion,
        snapshot.configurationSchemaVersion,
        fashionStorePreset.id,
        JSON.stringify(snapshot.bindings),
        actor.id,
        actor.id,
        at,
        at,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO storefront_experience_validations
           (id, draft_id, draft_version, catalog_release_id, status, issues_json,
            resolved_templates_json, validated_by, created_at)
         VALUES (?, ?, 1, ?, 'valid', '[]', ?, ?, ?)`,
      )
      .bind(
        validationId,
        draftId,
        release.releaseId,
        JSON.stringify(snapshot.resolvedTemplates),
        actor.id,
        at,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO storefront_experience_snapshots
           (id, deduplication_key, experience_id, source_draft_id, source_draft_version,
            source_validation_id, migration_id, kind, theme_id, theme_version,
            configuration_schema_version, snapshot_json, content_digest, created_by, approved_by,
            approved_at, created_at)
         VALUES (?, ?, ?, ?, 1, ?, NULL, 'approved', 'fashion-store', ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        snapshot.id,
        deduplicationKey,
        SHOPPER_EXPERIENCE_ID,
        draftId,
        validationId,
        snapshot.themeVersion,
        snapshot.configurationSchemaVersion,
        JSON.stringify(snapshot),
        contentDigest,
        actor.id,
        actor.id,
        at,
        at,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO storefront_preview_builds
           (id, snapshot_id, catalog_release_id, experience_version, theme_id, theme_version,
            platform_contract_version, media_origins_json, attempt, status, correlation_id,
            created_at, updated_at)
         VALUES (?, ?, ?, 1, 'fashion-store', ?, ?, ?, 1, 'building', ?, ?, ?)`,
      )
      .bind(
        buildId,
        snapshot.id,
        release.releaseId,
        snapshot.themeVersion,
        snapshot.platformContractVersion,
        JSON.stringify(mediaOrigins),
        `local-fashion-catalog-reset:${requestId}`,
        at,
        at,
      ),
  ]);
  const persisted = await db
    .prepare(
      `SELECT b.status, b.snapshot_id, b.catalog_release_id, r.status AS release_status
         FROM storefront_preview_builds b
         JOIN catalog_releases r ON r.id = b.catalog_release_id
        WHERE b.id = ?`,
    )
    .bind(buildId)
    .first<{
      catalog_release_id: string;
      release_status: string;
      snapshot_id: string;
      status: string;
    }>();
  if (
    !persisted ||
    persisted.status !== "building" ||
    persisted.release_status !== "deployed" ||
    persisted.snapshot_id !== snapshot.id ||
    persisted.catalog_release_id !== release.releaseId
  ) {
    throw new Error("fashion_catalog_activation_prepare_failed");
  }
  return {
    buildId,
    buildInput: {
      catalogRelease: release,
      environment: "preview",
      expectedOrigin: "https://shoppp-storefront-fashion-preview.hashencode.workers.dev",
      inputIdentity: {
        catalogReleaseId: release.releaseId,
        experienceSnapshotId: snapshot.id,
        experienceVersion: snapshot.version,
        platformContractVersion: snapshot.platformContractVersion,
        themeId: "fashion-store",
        themeVersion: snapshot.themeVersion,
      },
      mediaOrigins,
      presentationMode: "live",
      snapshot,
      themeId: "fashion-store",
    },
    shopperReleaseId: release.releaseId,
    snapshotId: snapshot.id,
  };
}

export async function assertFashionStagingCatalogActivationBuild(
  db: D1Database,
  buildId: string,
): Promise<void> {
  const migration = await soleCatalogMigration(db);
  const expectedSnapshotId = "snapshot-fashion-store-live-catalog-v1";
  const inputToken = (await sha256(migration.shopper_release_id)).slice(0, 16);
  const expectedBuildId = `preview-build-${expectedSnapshotId.slice(-24)}-${inputToken}-1`;
  const row = await db
    .prepare(
      `SELECT status, snapshot_id, catalog_release_id
         FROM storefront_preview_builds
        WHERE id = ?`,
    )
    .bind(buildId)
    .first<{ catalog_release_id: string; snapshot_id: string; status: string }>();
  if (
    buildId !== expectedBuildId ||
    !row ||
    !new Set(["building", "deployed"]).has(row.status) ||
    row.snapshot_id !== expectedSnapshotId ||
    row.catalog_release_id !== migration.shopper_release_id
  ) {
    throw new Error("fashion_catalog_activation_build_mismatch");
  }
}

export async function resetFashionStagingCatalog(
  db: D1Database,
  mediaBucket: R2Bucket,
  rawInput: unknown,
  requestId: string,
  now = new Date(),
  reviewedPayloadDigest = FASHION_STAGING_REVIEWED_MANIFEST_DIGEST,
): Promise<FashionStagingCatalogResetReceipt> {
  const input = rawInput as FashionStagingCatalogApplyInput;
  assertResetTarget(input?.target);
  assertInput(input);
  const computedDigest = await sha256(JSON.stringify(canonicalize(input.catalog)));
  if (computedDigest !== input.manifestDigest) throw new Error("fashion_catalog_digest_mismatch");
  const computedReviewedPayloadDigest = await fashionStagingCatalogReviewedPayloadDigest(input);
  if (computedReviewedPayloadDigest !== reviewedPayloadDigest) {
    throw new Error("fashion_catalog_reset_manifest_not_reviewed");
  }
  const preflight = await getFashionStagingCatalogPreflight(db);
  if (preflight.activeWorkCount > 0) throw new Error("fashion_catalog_active_work");
  if (preflight.iamFingerprint !== input.expectedIamFingerprint) {
    throw new Error("fashion_catalog_iam_drift");
  }
  await assertMedia(mediaBucket, input.catalog);
  await acquireFashionStagingCatalogResetLock(db, requestId, now);
  try {
    const lockedPreflight = await getFashionStagingCatalogPreflight(db);
    if (lockedPreflight.activeWorkCount > 0) throw new Error("fashion_catalog_active_work");
    if (lockedPreflight.iamFingerprint !== input.expectedIamFingerprint) {
      throw new Error("fashion_catalog_iam_drift");
    }
    const obsoleteMedia = await obsoleteCatalogMediaKeys(mediaBucket, input.catalog.r2Prefix);
    const deletedTableCount = await clearFashionStagingBusinessTables(db);
    const afterClearIam = await fashionStagingIamFingerprint(db);
    if (afterClearIam !== preflight.iamFingerprint) throw new Error("fashion_catalog_iam_changed");
    if (obsoleteMedia.length > 0) await mediaBucket.delete(obsoleteMedia);
    const applied = await applyFashionStagingCatalog(db, mediaBucket, input, requestId, now);
    await db.batch([
      db
        .prepare(
          `INSERT INTO audit_events
         (id, actor_type, actor_id, action, target_type, target_id, result, reason, request_id, metadata_json, created_at)
       VALUES (?, 'machine', ?, 'catalog.fashion-staging.reset', 'catalog_version', ?, 'succeeded',
               'One-time destructive Fashion staging catalog reset', ?, ?, ?)`,
        )
        .bind(
          `audit_fashion_catalog_reset_${requestId}`,
          "fashion-staging-catalog-reset",
          input.catalog.catalogVersion,
          requestId,
          JSON.stringify({
            deletedMediaCount: obsoleteMedia.length,
            deletedTableCount,
            manifestDigest: input.manifestDigest,
            reviewedPayloadDigest,
          }),
          now.toISOString(),
        ),
      db
        .prepare(
          "DELETE FROM fashion_staging_catalog_reset_locks WHERE id = ? AND owner_request_id = ?",
        )
        .bind(RESET_LOCK_ID, requestId),
    ]);
    return {
      ...applied,
      deletedMediaCount: obsoleteMedia.length,
      deletedTableCount,
    };
  } catch (error) {
    await releaseFashionStagingCatalogResetLock(db, requestId);
    throw error;
  }
}

export async function verifyFashionStagingCatalog(
  db: D1Database,
  mediaBucket: R2Bucket,
  catalogVersion: string,
): Promise<FashionStagingCatalogVerification> {
  const migration = await db
    .prepare("SELECT * FROM fashion_staging_catalog_migrations WHERE catalog_version = ?")
    .bind(catalogVersion)
    .first<Record<string, string | number>>();
  if (!migration) throw new Error("fashion_catalog_migration_missing");
  const catalog = JSON.parse(String(migration.catalog_manifest_json)) as CatalogInput;
  await assertMedia(mediaBucket, catalog);
  const productIds = catalog.products.map(({ id }) => id);
  const variantIds = catalog.products.flatMap((product) => product.variants.map(({ id }) => id));
  const productCount = await countMatches(db, "products", "id", productIds);
  const variantCount = await countMatches(db, "product_variants", "id", variantIds);
  const mediaCount = await countMatches(
    db,
    "product_media",
    "id",
    catalog.products.flatMap((product) => product.media.map(({ id }) => id)),
  );
  const sellable = await db
    .prepare(
      `SELECT COUNT(*) AS count
         FROM inventory_items
        WHERE variant_id IN (${variantIds.map(() => "?").join(", ")})
          AND on_hand_quantity + oversell_limit - reserved_quantity - backordered_quantity > 0`,
    )
    .bind(...variantIds)
    .first<{ count: number }>();
  const releaseRow = await db
    .prepare(
      "SELECT manifest_json FROM catalog_releases WHERE id = ? AND status IN ('approved', 'deployed')",
    )
    .bind(String(migration.shopper_release_id))
    .first<{ manifest_json: string }>();
  if (!releaseRow) throw new Error("fashion_catalog_shopper_release_missing");
  const release = canonicalCatalogReleaseSchema.parse(JSON.parse(releaseRow.manifest_json));
  const activeBuild = await db
    .prepare(
      `SELECT id, artifact_digest, artifact_prefix
         FROM storefront_preview_builds
        WHERE catalog_release_id = ? AND status = 'deployed'
        ORDER BY completed_at DESC
        LIMIT 1`,
    )
    .bind(String(migration.shopper_release_id))
    .first<{ artifact_digest: string; artifact_prefix: string; id: string }>();
  const foreignKeys = await db.prepare("PRAGMA foreign_key_check").all();
  const currentIam = await fashionStagingIamFingerprint(db);
  if (
    productCount !== 13 ||
    variantCount !== 24 ||
    mediaCount !== 18 ||
    Number(sellable?.count ?? 0) !== 24 ||
    foreignKeys.results.length !== 0 ||
    currentIam !== migration.iam_fingerprint_after
  ) {
    throw new Error("fashion_catalog_verification_failed");
  }
  return {
    acceptanceReleaseId: String(migration.acceptance_release_id),
    activeArtifactDigest: activeBuild?.artifact_digest ?? null,
    activeArtifactPrefix: activeBuild?.artifact_prefix ?? null,
    activeBuildId: activeBuild?.id ?? null,
    catalogVersion,
    dimensionsVerified: mediaCount,
    foreignKeyViolations: foreignKeys.results.length,
    iamFingerprint: currentIam,
    manifestDigest: String(migration.manifest_digest),
    mediaCount,
    productCount,
    releaseDigest: await sha256(catalogReleaseDigestInput(release)),
    sellableVariantCount: Number(sellable?.count ?? 0),
    shopperReleaseId: String(migration.shopper_release_id),
    status: "already_applied",
    variantCount,
  };
}
