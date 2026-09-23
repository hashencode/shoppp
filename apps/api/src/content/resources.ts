import {
  contentArticleSchema,
  contentPageSchema,
  type ContentArticle,
  type ContentArticleWriteRequest,
  type ContentPage,
  type ContentPageWriteRequest,
  type ContentTransitionRequest,
} from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { prepareAuditEvent, prepareConditionalAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";
import {
  filterStorefrontBacklinks,
  findArticleBacklinks,
  findPageBacklinks,
} from "../storefront-control/backlinks";

export type ContentKind = "article" | "page";
type ContentStatus = "archived" | "draft" | "published";
type ContentWriteRequest = ContentArticleWriteRequest | ContentPageWriteRequest;
type ContentResource = ContentArticle | ContentPage;

interface ContentRow {
  content_id: string;
  cover_asset_id: string | null;
  created_at: string;
  published_at: string | null;
  sections_json: string;
  seo_json: string;
  slug: string;
  status: ContentStatus;
  summary: string;
  title: string;
  updated_at: string;
  version: number;
}

const tableFor = (kind: ContentKind) =>
  kind === "page" ? "content_page_versions" : "content_article_versions";
const idColumnFor = (kind: ContentKind) => (kind === "page" ? "page_id" : "article_id");

export function contentRoute(kind: ContentKind, slug: string): string {
  if (kind === "page" && ["about", "contact", "faq", "magazine"].includes(slug)) {
    return `/${slug}`;
  }
  return kind === "article" ? `/magazine/${slug}` : `/pages/${slug}`;
}

function selectColumns(kind: ContentKind): string {
  return `${idColumnFor(kind)} AS content_id, version, slug, title, summary,
    ${kind === "article" ? "cover_asset_id" : "NULL AS cover_asset_id"},
    sections_json, seo_json, status, published_at, created_at, updated_at`;
}

function mapContent(kind: ContentKind, row: ContentRow): ContentResource {
  const value = {
    body: JSON.parse(row.sections_json),
    createdAt: row.created_at,
    id: row.content_id,
    ...(kind === "article" && row.cover_asset_id ? { coverAssetId: row.cover_asset_id } : {}),
    ...(row.published_at ? { publishedAt: row.published_at } : {}),
    seo: JSON.parse(row.seo_json),
    slug: row.slug,
    status: row.status,
    summary: row.summary,
    title: row.title,
    updatedAt: row.updated_at,
    version: row.version,
  };
  return kind === "page" ? contentPageSchema.parse(value) : contentArticleSchema.parse(value);
}

async function latestRow(
  db: D1Database,
  kind: ContentKind,
  id: string,
  version?: number,
): Promise<ContentRow | null> {
  return db
    .prepare(
      `SELECT ${selectColumns(kind)} FROM ${tableFor(kind)} WHERE ${idColumnFor(kind)} = ?
       ${version === undefined ? "ORDER BY version DESC LIMIT 1" : "AND version = ?"}`,
    )
    .bind(id, ...(version === undefined ? [] : [version]))
    .first<ContentRow>();
}

async function inclusion(db: D1Database, kind: ContentKind, resource: ContentResource) {
  const row = await db
    .prepare(
      `SELECT
        EXISTS(SELECT 1 FROM catalog_release_sources source
          JOIN catalog_releases release ON release.id = source.release_id
          WHERE source.source_kind = ? AND source.source_id = ? AND source.source_version = ?
            AND release.purpose = 'private-preview' AND release.candidate_status = 'succeeded') AS candidate,
        EXISTS(SELECT 1 FROM catalog_release_sources source
          JOIN catalog_releases release ON release.id = source.release_id
          WHERE source.source_kind = ? AND source.source_id = ?
            AND release.purpose = 'private-preview' AND release.candidate_status = 'succeeded') AS candidate_any,
        EXISTS(SELECT 1 FROM catalog_release_sources source
          JOIN catalog_releases release ON release.id = source.release_id
          WHERE source.source_kind = ? AND source.source_id = ? AND source.source_version = ?
            AND release.status = 'deployed') AS live,
        EXISTS(SELECT 1 FROM catalog_release_sources source
          JOIN catalog_releases release ON release.id = source.release_id
          WHERE source.source_kind = ? AND source.source_id = ?
            AND release.status = 'deployed') AS live_any`,
    )
    .bind(
      kind,
      resource.id,
      resource.version,
      kind,
      resource.id,
      kind,
      resource.id,
      resource.version,
      kind,
      resource.id,
    )
    .first<{ candidate: number; candidate_any: number; live: number; live_any: number }>();
  return Object.assign(resource, {
    inclusion: {
      candidate: row?.candidate === 1,
      candidateStale: row?.candidate !== 1 && row?.candidate_any === 1,
      live: row?.live === 1,
      liveStale: row?.live !== 1 && row?.live_any === 1,
    },
    route: contentRoute(kind, resource.slug),
  });
}

async function inclusions(db: D1Database, kind: ContentKind, resources: ContentResource[]) {
  if (resources.length === 0) return [];
  const ids = [...new Set(resources.map(({ id }) => id))];
  const rows = await db
    .prepare(
      `SELECT source.source_id, source.source_version, release.purpose,
              release.candidate_status, release.status
         FROM catalog_release_sources source
         JOIN catalog_releases release ON release.id = source.release_id
        WHERE source.source_kind = ?
          AND source.source_id IN (${ids.map(() => "?").join(",")})
          AND ((release.purpose = 'private-preview' AND release.candidate_status = 'succeeded')
            OR release.status = 'deployed')`,
    )
    .bind(kind, ...ids)
    .all<{
      candidate_status: string;
      purpose: string;
      source_id: string;
      source_version: number;
      status: string;
    }>();
  const byId = new Map<string, typeof rows.results>();
  for (const row of rows.results) {
    byId.set(row.source_id, [...(byId.get(row.source_id) ?? []), row]);
  }
  return resources.map((resource) => {
    const matches = byId.get(resource.id) ?? [];
    const candidateRows = matches.filter(
      ({ candidate_status, purpose }) =>
        purpose === "private-preview" && candidate_status === "succeeded",
    );
    const liveRows = matches.filter(({ status }) => status === "deployed");
    const candidate = candidateRows.some(
      ({ source_version }) => source_version === resource.version,
    );
    const live = liveRows.some(({ source_version }) => source_version === resource.version);
    return Object.assign(resource, {
      inclusion: {
        candidate,
        candidateStale: !candidate && candidateRows.length > 0,
        live,
        liveStale: !live && liveRows.length > 0,
      },
      route: contentRoute(kind, resource.slug),
    });
  });
}

export async function listContent(
  db: D1Database,
  kind: ContentKind,
  query: {
    page: number;
    pageSize: number;
    query?: string | undefined;
    status?: ContentStatus | undefined;
  },
) {
  const pattern = query.query ? `%${query.query}%` : null;
  const table = tableFor(kind);
  const idColumn = idColumnFor(kind);
  const where = `version = (SELECT MAX(version) FROM ${table} latest WHERE latest.${idColumn} = current.${idColumn})
    AND (? IS NULL OR status = ?) AND (? IS NULL OR title LIKE ? OR slug LIKE ?)`;
  const [rows, count] = await Promise.all([
    db
      .prepare(
        `SELECT ${selectColumns(kind)} FROM ${table} current WHERE ${where}
         ORDER BY updated_at DESC, ${idColumn} LIMIT ? OFFSET ?`,
      )
      .bind(
        query.status ?? null,
        query.status ?? null,
        pattern,
        pattern,
        pattern,
        query.pageSize,
        (query.page - 1) * query.pageSize,
      )
      .all<ContentRow>(),
    db
      .prepare(`SELECT COUNT(*) AS count FROM ${table} current WHERE ${where}`)
      .bind(query.status ?? null, query.status ?? null, pattern, pattern, pattern)
      .first<{ count: number }>(),
  ]);
  return {
    data: await inclusions(
      db,
      kind,
      rows.results.map((row) => mapContent(kind, row)),
    ),
    total: count?.count ?? 0,
  };
}

export async function getContent(db: D1Database, kind: ContentKind, id: string) {
  const row = await latestRow(db, kind, id);
  if (!row) throw new ApiError(404, "content_not_found", "The Content record was not found.");
  return inclusion(db, kind, mapContent(kind, row));
}

async function assertRouteAvailable(
  db: D1Database,
  kind: ContentKind,
  slug: string,
  exceptId?: string,
) {
  const duplicate = await db
    .prepare(
      `SELECT ${idColumnFor(kind)} AS id FROM ${tableFor(kind)}
       WHERE slug = ? AND status != 'archived' AND (? IS NULL OR ${idColumnFor(kind)} != ?)
       LIMIT 1`,
    )
    .bind(slug, exceptId ?? null, exceptId ?? null)
    .first<{ id: string }>();
  const path = contentRoute(kind, slug);
  const redirect = await db
    .prepare("SELECT content_id FROM content_route_redirects WHERE from_path = ? LIMIT 1")
    .bind(path)
    .first<{ content_id: string }>();
  if (duplicate || (redirect && redirect.content_id !== exceptId)) {
    throw new ApiError(409, "content_route_conflict", "That storefront route is already used.");
  }
}

async function assertAssets(
  db: D1Database,
  input: Pick<ContentWriteRequest, "body"> & { coverAssetId?: string | null | undefined },
) {
  const sectionIds = input.body.flatMap((section) =>
    section.kind === "image" ? [section.assetId] : [],
  );
  const coverId = "coverAssetId" in input ? input.coverAssetId : null;
  const ids = [...new Set([...(coverId ? [coverId] : []), ...sectionIds])];
  if (!ids.length) return;
  const found = await db
    .prepare(
      `SELECT media.id FROM product_media media
       JOIN products product ON product.id = media.product_id
       WHERE product.status = 'published'
         AND media.id IN (${ids.map(() => "?").join(",")})`,
    )
    .bind(...ids)
    .all<{ id: string }>();
  const foundIds = new Set(found.results.map(({ id }) => id));
  const missing = ids.filter((id) => !foundIds.has(id));
  if (missing.length) {
    throw new ApiError(422, "content_media_invalid", "Select approved media assets.", {
      assetIds: missing,
    });
  }
}

function values(kind: ContentKind, input: ContentWriteRequest) {
  return [
    input.slug,
    input.title,
    input.summary,
    ...(kind === "article" ? [(input as ContentArticleWriteRequest).coverAssetId] : []),
    JSON.stringify(input.body),
    JSON.stringify(input.seo),
  ];
}

export async function createContent(
  context: Context<ApiEnvironment>,
  kind: ContentKind,
  input: ContentWriteRequest,
) {
  if (input.expectedVersion !== undefined) {
    throw new ApiError(422, "validation_failed", "New Content cannot set expectedVersion.");
  }
  await Promise.all([
    assertRouteAvailable(context.env.DB, kind, input.slug),
    assertAssets(context.env.DB, input),
  ]);
  const id = `${kind}.${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const principal = context.get("principal");
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO ${tableFor(kind)}
          (${idColumnFor(kind)}, version, slug, title, summary,
           ${kind === "article" ? "cover_asset_id," : ""}
           sections_json, seo_json, status, created_at, updated_at)
         VALUES (?, 1, ?, ?, ?, ${kind === "article" ? "?," : ""} ?, ?, 'draft', ?, ?)`,
    ).bind(id, ...values(kind, input), now, now),
    prepareAuditEvent(context.env.DB, {
      action: `content.${kind}.create`,
      actorId: principal.id,
      actorType: actorTypeForPrincipal(principal),
      id: crypto.randomUUID(),
      metadata: { version: 1 },
      reason: input.reason,
      requestId: context.get("requestId"),
      result: "succeeded",
      targetId: id,
      targetType: kind,
    }),
  ]);
  return getContent(context.env.DB, kind, id);
}

export async function updateContent(
  context: Context<ApiEnvironment>,
  kind: ContentKind,
  id: string,
  input: ContentWriteRequest,
) {
  if (input.expectedVersion === undefined) {
    throw new ApiError(422, "validation_failed", "expectedVersion is required when editing.");
  }
  const current = await latestRow(context.env.DB, kind, id);
  if (!current) throw new ApiError(404, "content_not_found", "The Content record was not found.");
  if (current.version !== input.expectedVersion) {
    throw new ApiError(
      409,
      "content_conflict",
      "The Content record changed. Reload before saving.",
    );
  }
  await Promise.all([
    assertRouteAvailable(context.env.DB, kind, input.slug, id),
    assertAssets(context.env.DB, input),
  ]);
  const now = new Date().toISOString();
  const nextVersion = current.version + 1;
  const principal = context.get("principal");
  const auditId = crypto.randomUUID();
  let results: D1Result<unknown>[];
  try {
    results = await context.env.DB.batch([
      prepareConditionalAuditEvent(
        context.env.DB,
        {
          action: `content.${kind}.update`,
          actorId: principal.id,
          actorType: actorTypeForPrincipal(principal),
          id: auditId,
          metadata: { fromVersion: current.version, toVersion: nextVersion },
          reason: input.reason,
          requestId: context.get("requestId"),
          result: "succeeded",
          targetId: id,
          targetType: kind,
        },
        {
          bindings: [id, input.expectedVersion, id],
          sql: `SELECT 1 FROM ${tableFor(kind)}
                 WHERE ${idColumnFor(kind)} = ? AND version = ?
                   AND version = (
                     SELECT MAX(version) FROM ${tableFor(kind)}
                      WHERE ${idColumnFor(kind)} = ?
                   )`,
        },
      ),
      context.env.DB.prepare(
        `INSERT INTO ${tableFor(kind)}
            (${idColumnFor(kind)}, version, slug, title, summary,
             ${kind === "article" ? "cover_asset_id," : ""}
             sections_json, seo_json, status, created_at, updated_at)
           SELECT ${idColumnFor(kind)}, ?, ?, ?, ?, ${kind === "article" ? "?," : ""}
                  ?, ?, 'draft', ?, ?
             FROM ${tableFor(kind)} WHERE ${idColumnFor(kind)} = ? AND version = ?
               AND version = (SELECT MAX(version) FROM ${tableFor(kind)} WHERE ${idColumnFor(kind)} = ?)
               AND EXISTS (SELECT 1 FROM audit_events WHERE id = ?)`,
      ).bind(nextVersion, ...values(kind, input), now, now, id, input.expectedVersion, id, auditId),
    ]);
  } catch (error) {
    if ((await latestRow(context.env.DB, kind, id))?.version !== input.expectedVersion) {
      throw new ApiError(
        409,
        "content_conflict",
        "The Content record changed. Reload before saving.",
      );
    }
    throw error;
  }
  if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) {
    throw new ApiError(
      409,
      "content_conflict",
      "The Content record changed. Reload before saving.",
    );
  }
  return getContent(context.env.DB, kind, id);
}

async function backlinks(context: Context<ApiEnvironment>, kind: ContentKind, row: ContentRow) {
  const raw =
    kind === "page"
      ? await findPageBacklinks(
          context.env.DB,
          row.content_id,
          row.version,
          context.env.ENVIRONMENT,
        )
      : await findArticleBacklinks(
          context.env.DB,
          row.content_id,
          row.version,
          context.env.ENVIRONMENT,
        );
  return filterStorefrontBacklinks(raw, context.get("principal").permissions);
}

export async function transitionContent(
  context: Context<ApiEnvironment>,
  kind: ContentKind,
  id: string,
  input: ContentTransitionRequest,
  action: "archive" | "publish",
) {
  const current = await latestRow(context.env.DB, kind, id);
  if (!current) throw new ApiError(404, "content_not_found", "The Content record was not found.");
  if (current.version !== input.expectedVersion) {
    throw new ApiError(
      409,
      "content_conflict",
      "The Content record changed. Reload before continuing.",
    );
  }
  if (action === "publish" && current.status !== "draft") {
    throw new ApiError(409, "content_transition_invalid", "Only a draft can be published.");
  }
  if (action === "archive" && current.status === "archived") {
    throw new ApiError(
      409,
      "content_transition_invalid",
      "The Content record is already archived.",
    );
  }
  await assertRouteAvailable(context.env.DB, kind, current.slug, id);
  if (action === "publish") {
    await assertAssets(context.env.DB, mapContent(kind, current));
  }
  const previous =
    action === "publish"
      ? await context.env.DB.prepare(
          `SELECT ${selectColumns(kind)} FROM ${tableFor(kind)}
             WHERE ${idColumnFor(kind)} = ? AND status = 'published' ORDER BY version DESC LIMIT 1`,
        )
          .bind(id)
          .first<ContentRow>()
      : null;
  const archivePublished =
    action === "archive"
      ? await context.env.DB.prepare(
          `SELECT ${selectColumns(kind)} FROM ${tableFor(kind)}
             WHERE ${idColumnFor(kind)} = ? AND status = 'published' ORDER BY version DESC LIMIT 1`,
        )
          .bind(id)
          .first<ContentRow>()
      : null;
  const backlinkTargets = [action === "archive" ? (archivePublished ?? current) : null, previous]
    .filter((value): value is ContentRow => Boolean(value))
    .filter(
      (value, index, values) =>
        values.findIndex(
          ({ content_id, version }) => content_id === value.content_id && version === value.version,
        ) === index,
    );
  for (const target of backlinkTargets) {
    const references = await backlinks(context, kind, target);
    if (references.length) {
      throw new ApiError(
        409,
        "content_referenced",
        "Remove current references before continuing.",
        {
          backlinks: references,
        },
      );
    }
  }
  const now = new Date().toISOString();
  const principal = context.get("principal");
  const auditId = crypto.randomUUID();
  const committedMutationCondition = {
    bindings: [auditId] as const,
    sql: "SELECT 1 FROM audit_events WHERE id = ?",
  };
  // The conditional audit row is the transaction-local claim; every related write is gated by it.
  const statements: D1PreparedStatement[] = [
    prepareConditionalAuditEvent(
      context.env.DB,
      {
        action: `content.${kind}.${action}`,
        actorId: principal.id,
        actorType: actorTypeForPrincipal(principal),
        id: auditId,
        metadata: { version: current.version },
        reason: input.reason,
        requestId: context.get("requestId"),
        result: "succeeded",
        targetId: id,
        targetType: kind,
      },
      {
        bindings: [id, current.version, current.status, id],
        sql: `SELECT 1 FROM ${tableFor(kind)}
               WHERE ${idColumnFor(kind)} = ? AND version = ? AND status = ?
                 AND version = (
                   SELECT MAX(version) FROM ${tableFor(kind)}
                    WHERE ${idColumnFor(kind)} = ?
                 )`,
      },
    ),
  ];
  if (action === "publish" && previous) {
    statements.push(
      context.env.DB.prepare(
        `UPDATE ${tableFor(kind)} SET status = 'archived', updated_at = ?
           WHERE ${idColumnFor(kind)} = ? AND version = ? AND status = 'published'
             AND EXISTS (${committedMutationCondition.sql})`,
      ).bind(now, id, previous.version, ...committedMutationCondition.bindings),
    );
  }
  const transitionResultIndex = statements.length;
  if (action === "archive") {
    statements.push(
      context.env.DB.prepare(
        `UPDATE ${tableFor(kind)} SET status = 'archived', updated_at = ?
          WHERE ${idColumnFor(kind)} = ? AND status != 'archived'
            AND EXISTS (${committedMutationCondition.sql})`,
      ).bind(now, id, ...committedMutationCondition.bindings),
    );
  } else {
    statements.push(
      context.env.DB.prepare(
        `UPDATE ${tableFor(kind)} SET status = 'published', published_at = ?, updated_at = ?
          WHERE ${idColumnFor(kind)} = ? AND version = ? AND status = 'draft'
            AND EXISTS (${committedMutationCondition.sql})`,
      ).bind(now, now, id, current.version, ...committedMutationCondition.bindings),
    );
  }
  if (action === "publish" && previous) {
    const from = contentRoute(kind, previous.slug);
    const to = contentRoute(kind, current.slug);
    if (from !== to) {
      if (!input.redirectFromOldSlug) {
        throw new ApiError(
          409,
          "content_redirect_required",
          "Publishing a changed slug requires an explicit redirect.",
        );
      }
      statements.push(
        context.env.DB.prepare(
          `UPDATE content_route_redirects SET to_path = ?, content_version = ?
            WHERE environment = ? AND content_kind = ? AND content_id = ?
              AND EXISTS (${committedMutationCondition.sql})`,
        ).bind(
          to,
          current.version,
          context.env.ENVIRONMENT,
          kind,
          id,
          ...committedMutationCondition.bindings,
        ),
        context.env.DB.prepare(
          `INSERT INTO content_route_redirects
              (environment, from_path, to_path, content_kind, content_id, content_version, created_at)
             SELECT ?, ?, ?, ?, ?, ?, ?
              WHERE EXISTS (${committedMutationCondition.sql})
             ON CONFLICT(environment, from_path) DO UPDATE SET
               to_path = excluded.to_path,
               content_version = excluded.content_version
             WHERE content_route_redirects.content_id = excluded.content_id
               AND content_route_redirects.content_kind = excluded.content_kind`,
        ).bind(
          context.env.ENVIRONMENT,
          from,
          to,
          kind,
          id,
          current.version,
          now,
          ...committedMutationCondition.bindings,
        ),
      );
    }
  }
  if (action === "archive") {
    statements.push(
      context.env.DB.prepare(
        `DELETE FROM content_route_redirects
          WHERE environment = ? AND content_kind = ? AND content_id = ?
            AND EXISTS (${committedMutationCondition.sql})`,
      ).bind(context.env.ENVIRONMENT, kind, id, ...committedMutationCondition.bindings),
    );
  }
  let results: D1Result<unknown>[];
  try {
    results = await context.env.DB.batch(statements);
  } catch (error) {
    if ((await latestRow(context.env.DB, kind, id))?.status !== current.status) {
      throw new ApiError(
        409,
        "content_conflict",
        "The Content record changed. Reload before continuing.",
      );
    }
    throw error;
  }
  const claimed = results[0]?.meta.changes ?? 0;
  const changed = results[transitionResultIndex]?.meta.changes ?? 0;
  if (claimed !== 1 || changed < 1) {
    throw new ApiError(
      409,
      "content_conflict",
      "The Content record changed. Reload before continuing.",
    );
  }
  return getContent(context.env.DB, kind, id);
}
