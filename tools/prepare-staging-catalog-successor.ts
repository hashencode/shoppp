import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  canonicalCatalogReleaseSchema,
  legacyCatalogReleaseSchema,
  publicIdSchema,
  type CanonicalCatalogRelease,
} from "../packages/contracts/src";

interface CatalogIdentity {
  readonly id: string;
  readonly slug: string;
}

export interface StagingCatalogSuccessorInput {
  readonly collectionIdentities: readonly CatalogIdentity[];
  readonly generatedAt: string;
  readonly legacyRelease: unknown;
  readonly productIdentities: readonly CatalogIdentity[];
  readonly releaseId: string;
}

export interface StagingCatalogSuccessorSqlOptions {
  readonly correlationId: string;
  readonly createdAt: string;
  readonly productId: string;
}

function canonicalIdentity(identity: CatalogIdentity, kind: "collection" | "product"): string {
  if (publicIdSchema.safeParse(identity.id).success) return identity.id;
  const prefix = kind === "collection" ? "col" : "prod";
  const digest = new Bun.CryptoHasher("sha256")
    .update(`${kind}:${identity.slug}`)
    .digest("hex")
    .slice(0, 26)
    .toUpperCase();
  return `${prefix}_${digest}`;
}

function identityMap(
  values: readonly CatalogIdentity[],
  kind: "collection" | "product",
): Map<string, string> {
  const identities = new Map<string, string>();
  for (const value of values) {
    if (!value.id || !value.slug || identities.has(value.slug)) {
      throw new Error(`${kind} identity projection is invalid.`);
    }
    identities.set(value.slug, canonicalIdentity(value, kind));
  }
  return identities;
}

function requiredIdentity(
  identities: ReadonlyMap<string, string>,
  slug: string,
  kind: string,
): string {
  const identity = identities.get(slug);
  if (!identity) throw new Error(`Missing ${kind} identity for ${slug}.`);
  return identity;
}

export function createStagingCatalogSuccessor(
  input: StagingCatalogSuccessorInput,
): CanonicalCatalogRelease {
  const legacy = legacyCatalogReleaseSchema.parse(input.legacyRelease);
  if (legacy.releaseId === input.releaseId) {
    throw new Error("The canonical successor must use a new immutable release ID.");
  }
  const productIds = identityMap(input.productIdentities, "product");
  const collectionIds = identityMap(input.collectionIdentities, "collection");
  const products = legacy.products.map((product) => ({
    ...product,
    collectionIds: product.collectionSlugs.map((slug) =>
      requiredIdentity(collectionIds, slug, "collection"),
    ),
    id: requiredIdentity(productIds, product.slug, "product"),
  }));
  const collections = legacy.collections.map((collection) => ({
    ...collection,
    id: requiredIdentity(collectionIds, collection.slug, "collection"),
    productIds: collection.productSlugs.map((slug) =>
      requiredIdentity(productIds, slug, "product"),
    ),
  }));
  const publishedProducts = products.filter(({ status }) => status === "published");
  const publishedCollections = collections.filter(({ status }) => status === "published");
  const routes = [
    "/",
    ...publishedCollections.map(({ slug }) => `/collections/${slug}`),
    ...legacy.policies.map(({ slug }) => `/policies/${slug}`),
    ...publishedProducts.map(({ slug }) => `/products/${slug}`),
  ].sort((left, right) => (left === "/" ? -1 : right === "/" ? 1 : left.localeCompare(right)));

  return canonicalCatalogReleaseSchema.parse({
    ...legacy,
    collections,
    generatedAt: input.generatedAt,
    products,
    redirects: legacy.redirects.map((redirect) => ({ ...redirect, status: 301 })),
    releaseId: input.releaseId,
    routes,
    schemaVersion: 2,
  });
}

function sql(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildStagingCatalogSuccessorSql(
  release: CanonicalCatalogRelease,
  options: StagingCatalogSuccessorSqlOptions,
): string {
  const canonical = canonicalCatalogReleaseSchema.parse(release);
  if (!options.productId) throw new Error("The source product identity is invalid.");
  const guard = `_staging_catalog_successor_guard_${options.correlationId.replaceAll(
    /[^A-Za-z0-9]/g,
    "_",
  )}`;
  return [
    "PRAGMA foreign_keys = ON;",
    `CREATE TABLE ${guard} (invalid_count INTEGER NOT NULL CHECK (invalid_count = 0));`,
    `INSERT INTO ${guard} SELECT COUNT(*) FROM catalog_releases WHERE id = ${sql(canonical.releaseId)};`,
    `INSERT INTO catalog_releases (id, status, manifest_json, approved_at, build_correlation_id, product_id, created_at, updated_at) VALUES (${[
      canonical.releaseId,
      "building",
      JSON.stringify(canonical),
      options.createdAt,
      options.correlationId,
      options.productId,
      options.createdAt,
      options.createdAt,
    ]
      .map(sql)
      .join(", ")});`,
    `INSERT INTO audit_events (id, actor_type, action, target_type, target_id, result, reason, request_id, metadata_json, created_at) VALUES (${[
      `audit_${options.correlationId}`,
      "machine",
      "catalog.staging_successor.prepare",
      "catalog_release",
      canonical.releaseId,
      "succeeded",
      "Prepare an immutable canonical successor for CI-GH-U4 staging proof",
      options.correlationId,
      JSON.stringify({ correlationId: options.correlationId }),
      options.createdAt,
    ]
      .map(sql)
      .join(", ")});`,
    `DROP TABLE ${guard};`,
    "",
  ].join("\n");
}

interface CliInput {
  readonly correlationId: string;
  readonly generatedAt: string;
  readonly identities: string;
  readonly outputDirectory: string;
  readonly releaseId: string;
  readonly source: string;
}

function cliInput(): CliInput {
  const { values } = parseArgs({
    options: {
      "correlation-id": { type: "string" },
      "generated-at": { type: "string" },
      identities: { type: "string" },
      "output-dir": { type: "string" },
      "release-id": { type: "string" },
      source: { type: "string" },
    },
    strict: true,
  });
  if (
    !values["correlation-id"] ||
    !values["generated-at"] ||
    !values.identities ||
    !values["output-dir"] ||
    !values["release-id"] ||
    !values.source
  ) {
    throw new Error(
      "Provide --source, --identities, --release-id, --generated-at, --correlation-id, and --output-dir.",
    );
  }
  return {
    correlationId: values["correlation-id"],
    generatedAt: values["generated-at"],
    identities: resolve(values.identities),
    outputDirectory: resolve(values["output-dir"]),
    releaseId: values["release-id"],
    source: resolve(values.source),
  };
}

async function runCli(input: CliInput): Promise<void> {
  const legacyRelease = JSON.parse(await readFile(input.source, "utf8")) as unknown;
  const predecessor = legacyCatalogReleaseSchema.parse(legacyRelease);
  const identities = JSON.parse(await readFile(input.identities, "utf8")) as {
    collections?: CatalogIdentity[];
    products?: CatalogIdentity[];
  };
  const release = createStagingCatalogSuccessor({
    collectionIdentities: identities.collections ?? [],
    generatedAt: input.generatedAt,
    legacyRelease,
    productIdentities: identities.products ?? [],
    releaseId: input.releaseId,
  });
  const sourceProductId = identities.products?.find(
    ({ slug }) => slug === predecessor.products[0]?.slug,
  )?.id;
  if (!sourceProductId) throw new Error("The predecessor source product identity is missing.");
  const correlationId = input.correlationId;
  const sqlSource = buildStagingCatalogSuccessorSql(release, {
    correlationId,
    createdAt: input.generatedAt,
    productId: sourceProductId,
  });
  const manifest = `${JSON.stringify(release, null, 2)}\n`;
  const digest = new Bun.CryptoHasher("sha256").update(manifest).digest("hex");
  await mkdir(input.outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(resolve(input.outputDirectory, "manifest.json"), manifest),
    writeFile(resolve(input.outputDirectory, "seed.sql"), sqlSource),
    writeFile(
      resolve(input.outputDirectory, "receipt.json"),
      `${JSON.stringify(
        {
          collectionCount: release.collections.length,
          correlationId,
          generatedAt: input.generatedAt,
          manifestSha256: `sha256:${digest}`,
          predecessorId: predecessor.releaseId,
          productCount: release.products.length,
          releaseId: release.releaseId,
        },
        null,
        2,
      )}\n`,
    ),
  ]);
}

if (import.meta.main) await runCli(cliInput());
