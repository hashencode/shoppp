import type { Context } from "hono";

import { collectionSeoSchema, type CollectionWriteRequest } from "@shoppp/contracts";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";
import {
  filterStorefrontBacklinks,
  findCollectionBacklinks,
  type StorefrontBacklinkDiagnostic,
} from "../storefront-control/backlinks";

type CatalogContext = Context<ApiEnvironment>;

interface CollectionVersionRow {
  collection_id: string;
  cover_asset_id: string | null;
  created_at: string;
  description: string;
  name: string;
  published_at: string | null;
  redirect_from_slug: string | null;
  seo_json: string;
  slug: string;
  status: "draft" | "published" | "archived";
  updated_at: string;
  version: number;
}

const latestCollectionSql = `
  SELECT cv.* FROM collection_versions cv
   WHERE cv.collection_id = ?
     AND cv.version = (SELECT MAX(version) FROM collection_versions WHERE collection_id = cv.collection_id)`;

function parseSeo(value: string): { description: string; title: string } {
  return collectionSeoSchema.parse(JSON.parse(value));
}

async function memberships(db: D1Database, id: string, version: number) {
  return (
    await db
      .prepare(
        `SELECT p.id, p.name, p.slug, cm.position
           FROM collection_memberships cm
           JOIN products p ON p.id = cm.product_id
          WHERE cm.collection_id = ? AND cm.collection_version = ?
          ORDER BY cm.position`,
      )
      .bind(id, version)
      .all<{ id: string; name: string; position: number; slug: string }>()
  ).results;
}

async function releaseState(
  db: D1Database,
  id: string,
  version: number,
  environment: "development" | "staging" | "production",
) {
  const rows = await db
    .prepare(
      `SELECT cr.id, cr.purpose, cr.status, cr.candidate_status,
              source.source_digest, source.source_version
         FROM catalog_release_sources source
         JOIN catalog_releases cr ON cr.id = source.release_id
        WHERE source.source_kind = 'collection' AND source.source_id = ?
          AND source.environment = ?
        ORDER BY cr.created_at DESC`,
    )
    .bind(id, environment)
    .all<{
      id: string;
      candidate_status: string | null;
      purpose: string;
      source_digest: string;
      source_version: number;
      status: string;
    }>();
  const candidate = rows.results.find(
    ({ candidate_status, purpose }) =>
      purpose === "private-preview" && candidate_status === "succeeded",
  );
  const live = rows.results.find(
    ({ purpose, status }) => purpose === "public" && status === "deployed",
  );
  return {
    candidateDigest: candidate?.source_version === version ? candidate.source_digest : null,
    candidateReleaseId: candidate?.source_version === version ? candidate.id : null,
    candidateStaleCause:
      candidate && candidate.source_version !== version ? "saved_version_newer" : null,
    liveDigest: live?.source_version === version ? live.source_digest : null,
    liveReleaseId: live?.source_version === version ? live.id : null,
    liveStaleCause: live && live.source_version !== version ? "saved_version_newer" : null,
  };
}

async function serializeCollection(
  db: D1Database,
  row: CollectionVersionRow,
  environment: "development" | "staging" | "production",
) {
  const products = await memberships(db, row.collection_id, row.version);
  return {
    candidate: await releaseState(db, row.collection_id, row.version, environment),
    coverAssetId: row.cover_asset_id,
    createdAt: row.created_at,
    description: row.description,
    id: row.collection_id,
    name: row.name,
    productIds: products.map(({ id }) => id),
    products,
    publishedAt: row.published_at,
    redirectFromOldSlug: Boolean(row.redirect_from_slug),
    seo: parseSeo(row.seo_json),
    slug: row.slug,
    status: row.status,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

export async function getCollection(
  db: D1Database,
  id: string,
  environment: "development" | "staging" | "production",
) {
  const row = await db.prepare(latestCollectionSql).bind(id).first<CollectionVersionRow>();
  if (!row) throw new ApiError(404, "collection_not_found", "The Collection was not found.");
  return serializeCollection(db, row, environment);
}

export async function listCollections(
  context: CatalogContext,
  input: {
    page: number;
    pageSize: number;
    productId?: string | undefined;
    query?: string | undefined;
    status?: string | undefined;
  },
) {
  const where: string[] = [
    "cv.version = (SELECT MAX(current.version) FROM collection_versions current WHERE current.collection_id = cv.collection_id)",
  ];
  const bindings: unknown[] = [];
  if (input.query) {
    where.push("(cv.name LIKE ? OR cv.slug LIKE ?)");
    bindings.push(`%${input.query}%`, `%${input.query}%`);
  }
  if (input.status) {
    where.push("cv.status = ?");
    bindings.push(input.status);
  }
  if (input.productId) {
    where.push(
      "EXISTS (SELECT 1 FROM collection_memberships cm WHERE cm.collection_id = cv.collection_id AND cm.collection_version = cv.version AND cm.product_id = ?)",
    );
    bindings.push(input.productId);
  }
  const predicate = ` WHERE ${where.join(" AND ")}`;
  const count = await context.env.DB.prepare(
    `SELECT COUNT(*) AS total FROM collection_versions cv${predicate}`,
  )
    .bind(...bindings)
    .first<{ total: number }>();
  const rows = await context.env.DB.prepare(
    `SELECT cv.* FROM collection_versions cv${predicate}
      ORDER BY cv.updated_at DESC, cv.collection_id ASC LIMIT ? OFFSET ?`,
  )
    .bind(...bindings, input.pageSize, (input.page - 1) * input.pageSize)
    .all<CollectionVersionRow>();
  const pageKeys = JSON.stringify(
    rows.results.map(({ collection_id: id, version }) => ({ id, version })),
  );
  const pageIds = JSON.stringify(rows.results.map(({ collection_id }) => collection_id));
  const [memberRows, releaseRows] = await Promise.all([
    context.env.DB.prepare(
      `SELECT cm.collection_id, cm.collection_version, p.id, p.name, p.slug, cm.position
           FROM json_each(?) page
           JOIN collection_memberships cm
             ON cm.collection_id = json_extract(page.value, '$.id')
            AND cm.collection_version = json_extract(page.value, '$.version')
           JOIN products p ON p.id = cm.product_id
          ORDER BY cm.collection_id, cm.position`,
    )
      .bind(pageKeys)
      .all<{
        collection_id: string;
        collection_version: number;
        id: string;
        name: string;
        position: number;
        slug: string;
      }>(),
    context.env.DB.prepare(
      `SELECT source.source_id, source.source_version, source.source_digest,
                cr.id, cr.purpose, cr.status, cr.candidate_status
           FROM catalog_release_sources source
           JOIN catalog_releases cr ON cr.id = source.release_id
          WHERE source.source_kind = 'collection'
            AND source.source_id IN (SELECT CAST(value AS TEXT) FROM json_each(?))
            AND source.environment = ?
          ORDER BY cr.created_at DESC`,
    )
      .bind(pageIds, context.env.ENVIRONMENT)
      .all<{
        id: string;
        candidate_status: string | null;
        purpose: string;
        source_digest: string;
        source_id: string;
        source_version: number;
        status: string;
      }>(),
  ]);
  const productsByCollection = new Map<string, typeof memberRows.results>();
  for (const product of memberRows.results) {
    const products = productsByCollection.get(product.collection_id) ?? [];
    products.push(product);
    productsByCollection.set(product.collection_id, products);
  }
  const releasesByCollection = new Map<string, typeof releaseRows.results>();
  for (const release of releaseRows.results) {
    const releases = releasesByCollection.get(release.source_id) ?? [];
    releases.push(release);
    releasesByCollection.set(release.source_id, releases);
  }
  return {
    data: rows.results.map((row) => {
      const products = (productsByCollection.get(row.collection_id) ?? []).filter(
        ({ collection_version }) => collection_version === row.version,
      );
      const releases = releasesByCollection.get(row.collection_id) ?? [];
      const candidate = releases.find(
        ({ candidate_status, purpose }) =>
          purpose === "private-preview" && candidate_status === "succeeded",
      );
      const live = releases.find(
        ({ purpose, status }) => purpose === "public" && status === "deployed",
      );
      const serializedProducts = products.map(({ id, name, position, slug }) => ({
        id,
        name,
        position,
        slug,
      }));
      return {
        candidate: {
          candidateDigest:
            candidate?.source_version === row.version ? candidate.source_digest : null,
          candidateReleaseId: candidate?.source_version === row.version ? candidate.id : null,
          candidateStaleCause:
            candidate && candidate.source_version !== row.version ? "saved_version_newer" : null,
          liveDigest: live?.source_version === row.version ? live.source_digest : null,
          liveReleaseId: live?.source_version === row.version ? live.id : null,
          liveStaleCause:
            live && live.source_version !== row.version ? "saved_version_newer" : null,
        },
        coverAssetId: row.cover_asset_id,
        createdAt: row.created_at,
        description: row.description,
        id: row.collection_id,
        name: row.name,
        productIds: serializedProducts.map(({ id }) => id),
        products: serializedProducts,
        publishedAt: row.published_at,
        redirectFromOldSlug: Boolean(row.redirect_from_slug),
        seo: parseSeo(row.seo_json),
        slug: row.slug,
        status: row.status,
        updatedAt: row.updated_at,
        version: row.version,
      };
    }),
    meta: {
      page: input.page,
      pageSize: input.pageSize,
      requestId: context.get("requestId"),
      total: count?.total ?? 0,
    },
  };
}

async function assertProducts(db: D1Database, productIds: readonly string[]) {
  if (!productIds.length) return;
  const rows = await db
    .prepare(
      `SELECT CAST(requested.value AS TEXT) AS id
         FROM json_each(?) requested
         LEFT JOIN products product ON product.id = CAST(requested.value AS TEXT)
        WHERE product.id IS NULL`,
    )
    .bind(JSON.stringify(productIds))
    .all<{ id: string }>();
  const missing = rows.results.map(({ id }) => id);
  if (missing.length) {
    throw new ApiError(
      422,
      "collection_product_invalid",
      "Select Products from this environment.",
      {
        productIds: missing,
      },
    );
  }
}

async function assertCoverAsset(db: D1Database, coverAssetId: string | null | undefined) {
  if (!coverAssetId) return;
  const row = await db
    .prepare("SELECT id FROM product_media_assets WHERE id = ?")
    .bind(coverAssetId)
    .first();
  if (!row) {
    throw new ApiError(
      422,
      "collection_cover_asset_invalid",
      "Select an approved media asset from this environment.",
    );
  }
}

async function legacyRedirects(db: D1Database): Promise<Array<{ from: string; to: string }>> {
  const row = await db
    .prepare("SELECT value_json FROM settings WHERE key = 'storefront.redirects'")
    .first<{ value_json: string }>();
  return row ? (JSON.parse(row.value_json) as Array<{ from: string; to: string }>) : [];
}

function visibleBacklinks(
  context: CatalogContext,
  diagnostics: readonly StorefrontBacklinkDiagnostic[],
) {
  return filterStorefrontBacklinks(diagnostics, context.get("principal").permissions).map(
    (diagnostic) => ({
      environment: diagnostic.environment,
      fieldPath: `items.${diagnostic.sourceItemId}.target`,
      href: `/storefront/navigation/${encodeURIComponent(diagnostic.sourceId)}`,
      id: diagnostic.sourceId,
      type: "navigation-menu" as const,
      version: diagnostic.sourceVersion,
    }),
  );
}

function isCandidateLocked(error: unknown): boolean {
  return error instanceof Error && /catalog_candidate_sources_locked/i.test(error.message);
}

function isUnique(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

export async function createCollection(context: CatalogContext, input: CollectionWriteRequest) {
  if (input.expectedVersion !== undefined) {
    throw new ApiError(
      422,
      "collection_expected_version_invalid",
      "New Collections have no version yet.",
    );
  }
  await Promise.all([
    assertProducts(context.env.DB, input.productIds),
    assertCoverAsset(context.env.DB, input.coverAssetId),
  ]);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const principal = context.get("principal");
  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare(
      `INSERT INTO collections (id, slug, name, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, input.slug, input.name, input.description, input.status, now, now),
    context.env.DB.prepare(
      `INSERT INTO collection_versions
        (collection_id, version, slug, name, description, cover_asset_id, seo_json, status, redirect_from_slug,
         published_at, created_at, updated_at)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    ).bind(
      id,
      input.slug,
      input.name,
      input.description,
      input.coverAssetId ?? null,
      JSON.stringify({ description: input.seoDescription, title: input.seoTitle }),
      input.status,
      input.status === "published" ? now : null,
      now,
      now,
    ),
    context.env.DB.prepare(
      `INSERT INTO collection_memberships
        (collection_id, collection_version, product_id, position)
       SELECT ?, 1, CAST(value AS TEXT), CAST(key AS INTEGER) FROM json_each(?)`,
    ).bind(id, JSON.stringify(input.productIds)),
    prepareAuditEvent(context.env.DB, {
      action: "collection.create",
      actorId: principal.id,
      actorType: actorTypeForPrincipal(principal),
      id: crypto.randomUUID(),
      metadata: { toVersion: 1 },
      reason: input.reason,
      requestId: context.get("requestId"),
      result: "succeeded",
      targetId: id,
      targetType: "collection",
    }),
  ];
  try {
    await context.env.DB.batch(statements);
  } catch (error) {
    if (isCandidateLocked(error)) {
      throw new ApiError(
        409,
        "catalog_candidate_sources_locked",
        "Catalog sources are frozen while a Preview candidate is being built. Retry shortly.",
      );
    }
    if (isUnique(error))
      throw new ApiError(409, "collection_conflict", "Collection slug already exists.");
    throw error;
  }
  return getCollection(context.env.DB, id, context.env.ENVIRONMENT);
}

export async function updateCollection(
  context: CatalogContext,
  id: string,
  input: CollectionWriteRequest,
) {
  const current = await context.env.DB.prepare(latestCollectionSql)
    .bind(id)
    .first<CollectionVersionRow>();
  if (!current) throw new ApiError(404, "collection_not_found", "The Collection was not found.");
  if (input.expectedVersion !== current.version) {
    throw new ApiError(
      409,
      "stale_collection_version",
      "The Collection changed before it was saved.",
    );
  }
  if (current.status !== "draft" && input.reason.trim().length < 3) {
    throw new ApiError(
      422,
      "collection_reason_required",
      "A reason of at least 3 characters is required when editing a published or archived Collection.",
    );
  }
  await Promise.all([
    assertProducts(context.env.DB, input.productIds),
    assertCoverAsset(context.env.DB, input.coverAssetId),
  ]);
  const changesRoute = input.slug !== current.slug;
  const publishedRows = await context.env.DB.prepare(
    "SELECT version FROM collection_versions WHERE collection_id = ? AND status = 'published'",
  )
    .bind(id)
    .all<{ version: number }>();
  const publishedBacklinks = (
    await Promise.all(
      publishedRows.results.map(({ version }) =>
        findCollectionBacklinks(context.env.DB, id, version, context.env.ENVIRONMENT),
      ),
    )
  ).flat();
  if ((input.status === "published" || input.status === "archived") && publishedBacklinks.length) {
    throw new ApiError(
      409,
      "collection_has_backlinks",
      input.status === "published"
        ? "Repair Collection references before publishing a successor."
        : "Repair Collection references before archiving.",
      { backlinks: visibleBacklinks(context, publishedBacklinks) },
    );
  }
  const redirectFromSlug = changesRoute
    ? input.redirectFromOldSlug
      ? (current.redirect_from_slug ?? current.slug)
      : null
    : input.redirectFromOldSlug
      ? current.redirect_from_slug
      : null;
  const redirectFrom = redirectFromSlug ? `/collections/${redirectFromSlug}` : null;
  const redirectTo = redirectFromSlug ? `/collections/${input.slug}` : null;
  if (redirectFrom && redirectTo) {
    const [legacy, normalized] = await Promise.all([
      legacyRedirects(context.env.DB),
      context.env.DB.prepare(
        `SELECT to_path FROM collection_route_redirects
            WHERE environment = ? AND from_path = ?`,
      )
        .bind(context.env.ENVIRONMENT, redirectFrom)
        .first<{ to_path: string }>(),
    ]);
    const collision = legacy.find(
      (redirect) => redirect.from === redirectFrom && redirect.to !== redirectTo,
    );
    if (collision || (normalized && normalized.to_path !== redirectTo)) {
      throw new ApiError(
        409,
        "collection_redirect_conflict",
        "The old Collection route already redirects elsewhere.",
      );
    }
  }
  if (changesRoute && input.redirectFromOldSlug && redirectFrom === redirectTo) {
    throw new ApiError(
      422,
      "collection_redirect_invalid",
      "The old and new Collection routes must differ.",
    );
  }
  if (changesRoute && !input.redirectFromOldSlug && current.status === "published") {
    const currentBacklinks = await findCollectionBacklinks(
      context.env.DB,
      id,
      current.version,
      context.env.ENVIRONMENT,
    );
    if (currentBacklinks.length) {
      throw new ApiError(
        409,
        "collection_has_backlinks",
        "Keep the current route or request a redirect before changing this Collection slug.",
        { backlinks: visibleBacklinks(context, currentBacklinks) },
      );
    }
  }
  const nextVersion = current.version + 1;
  const now = new Date().toISOString();
  const principal = context.get("principal");
  const guardKey = `collection_write_guard:${context.get("requestId")}`;
  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare(
      `INSERT INTO settings (key, value_json, updated_at)
       VALUES (?, CASE WHEN (SELECT MAX(version) FROM collection_versions WHERE collection_id = ?) = ?
                       THEN '{}' ELSE 'invalid' END, ?)`,
    ).bind(guardKey, id, current.version, now),
    context.env.DB.prepare(
      `UPDATE collections SET slug = ?, name = ?, description = ?, status = ?, updated_at = ? WHERE id = ?`,
    ).bind(input.slug, input.name, input.description, input.status, now, id),
    ...(input.status === "published" || input.status === "archived"
      ? [
          context.env.DB.prepare(
            `UPDATE collection_versions SET status = 'archived', updated_at = ?
              WHERE collection_id = ? AND status = 'published'`,
          ).bind(now, id),
        ]
      : []),
    context.env.DB.prepare(
      `INSERT INTO collection_versions
        (collection_id, version, slug, name, description, cover_asset_id, seo_json, status, redirect_from_slug,
         published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      nextVersion,
      input.slug,
      input.name,
      input.description,
      input.coverAssetId ?? null,
      JSON.stringify({ description: input.seoDescription, title: input.seoTitle }),
      input.status,
      redirectFromSlug,
      input.status === "published" ? now : null,
      now,
      now,
    ),
    context.env.DB.prepare(
      `INSERT INTO collection_memberships
        (collection_id, collection_version, product_id, position)
       SELECT ?, ?, CAST(value AS TEXT), CAST(key AS INTEGER) FROM json_each(?)`,
    ).bind(id, nextVersion, JSON.stringify(input.productIds)),
    ...(input.status === "published" && redirectFrom && redirectTo
      ? [
          context.env.DB.prepare(
            `INSERT INTO collection_route_redirects
              (environment, from_path, to_path, collection_id, collection_version, created_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(environment, from_path) DO UPDATE SET
               to_path = CASE
                 WHEN collection_route_redirects.to_path = excluded.to_path
                 THEN collection_route_redirects.to_path
                 ELSE NULL
               END`,
          ).bind(context.env.ENVIRONMENT, redirectFrom, redirectTo, id, nextVersion, now),
        ]
      : []),
    prepareAuditEvent(context.env.DB, {
      action: input.status === "archived" ? "collection.archive" : "collection.update",
      actorId: principal.id,
      actorType: actorTypeForPrincipal(principal),
      id: crypto.randomUUID(),
      metadata: { fromVersion: current.version, toVersion: nextVersion },
      reason: input.reason,
      requestId: context.get("requestId"),
      result: "succeeded",
      targetId: id,
      targetType: "collection",
    }),
    context.env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(guardKey),
  ];
  try {
    await context.env.DB.batch(statements);
  } catch (error) {
    const latest = await context.env.DB.prepare(latestCollectionSql)
      .bind(id)
      .first<CollectionVersionRow>();
    if (latest?.version !== current.version) {
      throw new ApiError(
        409,
        "stale_collection_version",
        "The Collection changed before it was saved.",
      );
    }
    if (isCandidateLocked(error)) {
      throw new ApiError(
        409,
        "catalog_candidate_sources_locked",
        "Catalog sources are frozen while a Preview candidate is being built. Retry shortly.",
      );
    }
    if (error instanceof Error && /resource_has_backlinks/i.test(error.message)) {
      throw new ApiError(
        409,
        "collection_has_backlinks",
        "Repair Collection references before changing published state.",
        { backlinks: visibleBacklinks(context, publishedBacklinks) },
      );
    }
    if (error instanceof Error && /collection_route_redirects/i.test(error.message)) {
      throw new ApiError(
        409,
        "collection_redirect_conflict",
        "The old Collection route already redirects elsewhere.",
      );
    }
    if (isUnique(error))
      throw new ApiError(409, "collection_conflict", "Collection slug already exists.");
    throw error;
  }
  return getCollection(context.env.DB, id, context.env.ENVIRONMENT);
}
