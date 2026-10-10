import {
  catalogReleaseV3Schema,
  catalogPaymentCapabilitiesSchema,
  launchConfigurationSchema,
  type CatalogReleaseEnvironment,
  type CatalogReleaseSource,
  type CatalogReleaseV3,
} from "@shoppp/contracts";
import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { normalizeAuditReason } from "../security/audit-reason";
import { contentRoute } from "../content/resources";
import { buildCatalogReleaseManifest } from "./build-manifest";
import { candidateLedgerChunks, stableCandidateJson } from "./candidate-ledger";

type SourceStatus = "approved" | "archived" | "draft" | "published";

export interface CandidateSnapshotSource extends CatalogReleaseSource {
  currentDigest: string;
  currentKind?: CatalogReleaseSource["kind"];
  currentStatus: SourceStatus;
  currentVersion: number;
  environment: CatalogReleaseEnvironment;
}

export interface CatalogCandidateSnapshot {
  environment: CatalogReleaseEnvironment;
  redirects: Array<{ from: string; to: string }>;
  routes: string[];
  sources: CandidateSnapshotSource[];
}

function lifecycleError(code: string, message: string): never {
  throw new ApiError(409, code, `${code}: ${message}`);
}

export function validateCatalogCandidateSnapshot(snapshot: CatalogCandidateSnapshot): void {
  const routes = new Set<string>();
  for (const route of snapshot.routes) {
    if (routes.has(route)) {
      lifecycleError("storefront_route_conflict", `Duplicate route ${route}.`);
    }
    routes.add(route);
  }
  const redirectSources = new Set<string>();
  for (const redirect of snapshot.redirects) {
    if (!redirect.from.startsWith("/") || !redirect.to.startsWith("/")) {
      lifecycleError("storefront_redirect_invalid", "Redirects must remain storefront-local.");
    }
    if (
      redirect.from === redirect.to ||
      routes.has(redirect.from) ||
      redirectSources.has(redirect.from)
    ) {
      lifecycleError(
        "storefront_route_conflict",
        `Redirect source ${redirect.from} must be unique and cannot also be a live route.`,
      );
    }
    redirectSources.add(redirect.from);
  }
  for (const redirect of snapshot.redirects) {
    if (!routes.has(redirect.to) || redirectSources.has(redirect.to)) {
      lifecycleError(
        "storefront_redirect_invalid",
        `Redirect target ${redirect.to} must resolve directly to a live route.`,
      );
    }
  }
  for (const source of snapshot.sources) {
    if (source.currentKind && source.currentKind !== source.kind) {
      lifecycleError("catalog_source_kind_mismatch", `Source ${source.id} changed kind.`);
    }
    if (source.environment !== snapshot.environment) {
      lifecycleError(
        "catalog_source_environment_mismatch",
        `Source ${source.id} belongs to another environment.`,
      );
    }
    if (source.currentStatus !== "published") {
      lifecycleError("catalog_source_unpublished", `Source ${source.id} is not published.`);
    }
    if (source.currentVersion !== source.version || source.currentDigest !== source.digest) {
      lifecycleError("catalog_source_drift", `Source ${source.id} changed during freeze.`);
    }
  }
}

export type CatalogReleaseOperation =
  | "candidate-abandon"
  | "candidate-manifest-read"
  | "candidate-status"
  | "deploy"
  | "private-preview"
  | "private-preview-build"
  | "public-build"
  | "public-build-status"
  | "public-manifest-read";

export function assertCatalogReleaseLifecycle(
  release: {
    candidateStatus?: string | null;
    environment: CatalogReleaseEnvironment;
    purpose: "private-preview" | "public";
    schemaVersion?: number;
    status: string;
  },
  request: {
    environment: CatalogReleaseEnvironment;
    operation: CatalogReleaseOperation;
    principalKind?: "human" | "service";
  },
): void {
  if (
    release.environment !== request.environment &&
    (release.purpose === "private-preview" || release.schemaVersion === 3)
  ) {
    lifecycleError("catalog_release_environment_mismatch", "Release environment does not match.");
  }
  if (release.purpose === "private-preview") {
    if (
      ["deploy", "public-build", "public-build-status", "public-manifest-read"].includes(
        request.operation,
      )
    ) {
      lifecycleError(
        "catalog_candidate_private",
        "Private candidates cannot enter public build flows.",
      );
    }
    if (request.principalKind === "service" && request.operation !== "private-preview-build") {
      lifecycleError("human_principal_required", "Private candidates require a human operator.");
    }
    if (request.operation === "candidate-status" || request.operation === "candidate-abandon") {
      return;
    }
    if (release.candidateStatus !== "succeeded") {
      lifecycleError("catalog_candidate_unavailable", "Private candidate is not selectable.");
    }
    return;
  }
  if (request.operation === "private-preview") return;
  if (request.operation === "public-build" && release.status !== "approved") {
    lifecycleError("catalog_release_not_approved", "Only approved public releases can build.");
  }
}

export function parsePrivateCatalogCandidate(input: unknown): CatalogReleaseV3 {
  const release = catalogReleaseV3Schema.parse(input);
  if (release.purpose !== "private-preview") {
    lifecycleError("catalog_candidate_purpose_invalid", "Expected a private Preview candidate.");
  }
  return release;
}

async function sha256Bytes(value: ArrayBuffer | string): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface AuthorityRow {
  readonly id: string;
  readonly kind: CatalogReleaseSource["kind"];
  readonly row: Record<string, unknown>;
  readonly status: SourceStatus;
  readonly version: number;
}

async function authorityRows(db: D1Database): Promise<AuthorityRow[]> {
  const [identity, policies, pages, articles, navigation, collections, products] =
    await Promise.all([
      db
        .prepare(
          `SELECT identity_id AS id, version, status, storefront_name, tagline, favicon_asset_id,
              social_share_asset_id, seo_json
         FROM store_identity_versions WHERE status = 'published' ORDER BY version DESC LIMIT 1`,
        )
        .all<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT policy_id AS id, version, status, kind, slug, title, effective_date, sections_json,
              approval_digest, approval_environment
         FROM policy_versions WHERE status = 'published' ORDER BY policy_id, version`,
        )
        .all<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT page_id AS id, version, status, slug, title, summary, sections_json, seo_json
         FROM content_page_versions WHERE status = 'published' ORDER BY page_id, version`,
        )
        .all<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT article_id AS id, version, status, slug, title, summary, cover_asset_id,
              sections_json, seo_json
         FROM content_article_versions WHERE status = 'published' ORDER BY article_id, version`,
        )
        .all<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT menu_id AS id, version, status, placement
         FROM navigation_menu_versions WHERE status = 'published' ORDER BY menu_id, version`,
        )
        .all<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT collection_id AS id, version, status, slug, name, description, cover_asset_id, seo_json
         FROM collection_versions WHERE status = 'published' ORDER BY collection_id, version`,
        )
        .all<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT id, version, status, slug, name, description, seo_title, seo_description,
              option_definitions_json, presentation_json
         FROM products WHERE status = 'published' ORDER BY id`,
        )
        .all<Record<string, unknown>>(),
    ]);
  const groups: Array<[CatalogReleaseSource["kind"], Record<string, unknown>[]]> = [
    ["store-identity", identity.results],
    ["policy", policies.results],
    ["page", pages.results],
    ["article", articles.results],
    ["navigation", navigation.results],
    ["collection", collections.results],
    ["product", products.results],
  ];
  return groups.flatMap(([kind, rows]) =>
    rows.map((row) => ({
      id: String(row.id),
      kind,
      row,
      status: String(row.status) as SourceStatus,
      version: Number(row.version),
    })),
  );
}

async function sourceVector(
  db: D1Database,
  environment: CatalogReleaseEnvironment,
): Promise<{ authorities: AuthorityRow[]; sources: CatalogReleaseSource[] }> {
  const authorities = await authorityRows(db);
  const identity = authorities.filter(({ kind }) => kind === "store-identity");
  const policies = authorities.filter(({ kind }) => kind === "policy");
  const products = authorities.filter(({ kind }) => kind === "product");
  if (identity.length !== 1) {
    lifecycleError(
      "catalog_identity_unpublished",
      "Exactly one published Store Identity is required.",
    );
  }
  if (products.length === 0) {
    lifecycleError("catalog_products_unpublished", "At least one published Product is required.");
  }
  const requiredPolicyKinds = ["privacy", "returns", "shipping", "terms"];
  const publishedPolicyKinds = new Set(
    policies
      .filter(({ row }) => row.approval_environment === environment && row.approval_digest)
      .map(({ row }) => String(row.kind)),
  );
  const missingPolicyKinds = requiredPolicyKinds.filter((kind) => !publishedPolicyKinds.has(kind));
  if (missingPolicyKinds.length) {
    lifecycleError(
      "catalog_required_policies_unpublished",
      `Approved published Policies are required: ${missingPolicyKinds.join(", ")}.`,
    );
  }
  const sources = await Promise.all(
    authorities.map(async ({ id, kind, row, version }) => ({
      digest: await sha256Bytes(stableCandidateJson(row)),
      id,
      kind,
      version,
    })),
  );
  validateCatalogCandidateSnapshot({
    environment,
    redirects: [],
    routes: [],
    sources: sources.map((source) => ({
      ...source,
      currentDigest: source.digest,
      currentKind: source.kind,
      currentStatus: "published",
      currentVersion: source.version,
      environment,
    })),
  });
  return { authorities, sources };
}

async function validatePublishedNavigationReferences(
  db: D1Database,
  environment: CatalogReleaseEnvironment,
): Promise<void> {
  const rows = await db
    .prepare(
      `SELECT 'policy' AS kind, reference.policy_id AS target_id,
            reference.environment, target.status, item.target_json,
            reference.menu_id, reference.menu_version, reference.item_id
       FROM navigation_policy_references reference
       JOIN navigation_menu_versions menu
         ON menu.menu_id = reference.menu_id AND menu.version = reference.menu_version
       JOIN navigation_items item
         ON item.menu_id = reference.menu_id AND item.menu_version = reference.menu_version
        AND item.item_id = reference.item_id
       JOIN policy_versions target
         ON target.policy_id = reference.policy_id AND target.version = reference.policy_version
      WHERE menu.status = 'published'
     UNION ALL
     SELECT 'page', reference.page_id, reference.environment, target.status, item.target_json,
            reference.menu_id, reference.menu_version, reference.item_id
       FROM navigation_page_references reference
       JOIN navigation_menu_versions menu
         ON menu.menu_id = reference.menu_id AND menu.version = reference.menu_version
       JOIN navigation_items item
         ON item.menu_id = reference.menu_id AND item.menu_version = reference.menu_version
        AND item.item_id = reference.item_id
       JOIN content_page_versions target
         ON target.page_id = reference.page_id AND target.version = reference.page_version
      WHERE menu.status = 'published'
     UNION ALL
     SELECT 'article', reference.article_id, reference.environment, target.status, item.target_json,
            reference.menu_id, reference.menu_version, reference.item_id
       FROM navigation_article_references reference
       JOIN navigation_menu_versions menu
         ON menu.menu_id = reference.menu_id AND menu.version = reference.menu_version
       JOIN navigation_items item
         ON item.menu_id = reference.menu_id AND item.menu_version = reference.menu_version
        AND item.item_id = reference.item_id
       JOIN content_article_versions target
         ON target.article_id = reference.article_id AND target.version = reference.article_version
      WHERE menu.status = 'published'
     UNION ALL
     SELECT 'collection', reference.collection_id, reference.environment, target.status, item.target_json,
            reference.menu_id, reference.menu_version, reference.item_id
       FROM navigation_collection_references reference
       JOIN navigation_menu_versions menu
         ON menu.menu_id = reference.menu_id AND menu.version = reference.menu_version
       JOIN navigation_items item
         ON item.menu_id = reference.menu_id AND item.menu_version = reference.menu_version
        AND item.item_id = reference.item_id
       JOIN collection_versions target
         ON target.collection_id = reference.collection_id AND target.version = reference.collection_version
      WHERE menu.status = 'published'
     UNION ALL
     SELECT 'product', reference.product_id, reference.environment, target.status, item.target_json,
            reference.menu_id, reference.menu_version, reference.item_id
       FROM navigation_product_references reference
       JOIN navigation_menu_versions menu
         ON menu.menu_id = reference.menu_id AND menu.version = reference.menu_version
       JOIN navigation_items item
         ON item.menu_id = reference.menu_id AND item.menu_version = reference.menu_version
        AND item.item_id = reference.item_id
       JOIN products target
         ON target.id = reference.product_id AND target.version = reference.product_version
      WHERE menu.status = 'published'`,
    )
    .all<{
      environment: string;
      item_id: string;
      kind: string;
      menu_id: string;
      menu_version: number;
      status: string;
      target_id: string;
      target_json: string;
    }>();
  const relationKeys = new Set(
    rows.results.map((row) => `${row.menu_id}@${row.menu_version}/${row.item_id}`),
  );
  const publishedItems = await db
    .prepare(
      `SELECT item.menu_id, item.menu_version, item.item_id, item.target_json
       FROM navigation_items item
       JOIN navigation_menu_versions menu
         ON menu.menu_id = item.menu_id AND menu.version = item.menu_version
      WHERE menu.status = 'published'`,
    )
    .all<{
      item_id: string;
      menu_id: string;
      menu_version: number;
      target_json: string;
    }>();
  for (const item of publishedItems.results) {
    let target: { reference?: { kind?: string } } = {};
    try {
      target = JSON.parse(item.target_json) as typeof target;
    } catch {
      lifecycleError("catalog_source_kind_mismatch", `Navigation item ${item.item_id} is invalid.`);
    }
    if (
      target.reference?.kind &&
      ["policy", "page", "article", "collection", "product"].includes(target.reference.kind) &&
      !relationKeys.has(`${item.menu_id}@${item.menu_version}/${item.item_id}`)
    ) {
      lifecycleError(
        "catalog_source_missing",
        `Navigation backlink ${item.menu_id}@${item.menu_version}/${item.item_id} is missing.`,
      );
    }
  }
  for (const row of rows.results) {
    let declared: { reference?: { id?: string; kind?: string } } = {};
    try {
      declared = JSON.parse(row.target_json) as typeof declared;
    } catch {
      lifecycleError("catalog_source_kind_mismatch", `Navigation item ${row.item_id} is invalid.`);
    }
    const backlink = `${row.menu_id}@${row.menu_version}/${row.item_id}`;
    if (
      declared.reference?.kind !== row.kind ||
      (declared.reference.id !== undefined && declared.reference.id !== row.target_id)
    ) {
      lifecycleError(
        "catalog_source_kind_mismatch",
        `Navigation backlink ${backlink} does not match ${row.kind}:${row.target_id}.`,
      );
    }
    if (row.environment !== environment) {
      lifecycleError(
        "catalog_source_environment_mismatch",
        `Navigation backlink ${backlink} crosses environments.`,
      );
    }
    if (row.status !== "published") {
      lifecycleError(
        "catalog_source_unpublished",
        `Navigation backlink ${backlink} targets unpublished ${row.kind}:${row.target_id}.`,
      );
    }
  }
}

interface FrozenMedia {
  readonly bytes: ArrayBuffer;
  readonly byteSize: number;
  readonly digest: string;
  readonly frozenKey: string;
  readonly httpMetadata?: R2HTTPMetadata;
  readonly sourceKey: string;
}

export type CatalogCandidateFreezeEvent = {
  readonly candidateId: string;
  readonly frozenKey?: string;
  readonly phase:
    | "before-pending"
    | "after-pending"
    | "before-media-copy"
    | "after-media-copy"
    | "before-success";
  readonly sourceKey?: string;
};

async function planCandidateMedia(
  bucket: R2Bucket,
  manifest: CatalogReleaseV3,
  mediaOrigin: string,
): Promise<FrozenMedia[]> {
  const prefix = `${mediaOrigin.replace(/\/$/, "")}/`;
  const ledger = new Map<string, FrozenMedia>();
  for (const product of manifest.products) {
    for (const media of product.media) {
      if (!media.src.startsWith(prefix)) {
        lifecycleError("catalog_media_origin_invalid", `Media ${media.id} has an invalid origin.`);
      }
      const sourceKey = decodeURIComponent(media.src.slice(prefix.length));
      const source = await bucket.get(sourceKey);
      if (!source) lifecycleError("catalog_media_missing", `Media ${media.id} is unavailable.`);
      const bytes = await source.arrayBuffer();
      const digest = await sha256Bytes(bytes);
      const frozenKey = `catalog-release-media/sha256/${digest}`;
      media.src = `${prefix}${frozenKey}`;
      ledger.set(sourceKey, {
        bytes,
        byteSize: bytes.byteLength,
        digest,
        frozenKey,
        ...(source.httpMetadata ? { httpMetadata: source.httpMetadata } : {}),
        sourceKey,
      });
    }
  }
  const frozenSource = (assetId: string) =>
    manifest.products.flatMap(({ media }) => media).find(({ id }) => id === assetId)?.src;
  for (const logo of manifest.identity.logoAssets) {
    if (logo.media) {
      const src = frozenSource(logo.assetId);
      if (!src)
        lifecycleError(
          "catalog_identity_logo_media_missing",
          `Logo ${logo.assetId} is unavailable.`,
        );
      logo.media.src = src;
    }
  }
  if (manifest.identity.faviconAssetId && manifest.identity.faviconMedia) {
    const src = frozenSource(manifest.identity.faviconAssetId);
    if (!src)
      lifecycleError("catalog_identity_favicon_media_missing", "Favicon media is unavailable.");
    manifest.identity.faviconMedia.src = src;
  }
  return [...ledger.values()];
}

async function copyCandidateMedia(
  bucket: R2Bucket,
  media: FrozenMedia[],
  candidateId: string,
  hook?: (event: CatalogCandidateFreezeEvent) => Promise<void>,
): Promise<void> {
  for (const item of media) {
    await hook?.({
      candidateId,
      frozenKey: item.frozenKey,
      phase: "before-media-copy",
      sourceKey: item.sourceKey,
    });
    const existing = await bucket.get(item.frozenKey);
    if (existing) {
      const existingDigest = await sha256Bytes(await existing.arrayBuffer());
      if (existingDigest !== item.digest) {
        lifecycleError(
          "catalog_media_digest_collision",
          `Frozen media key ${item.digest} differs.`,
        );
      }
    } else {
      await bucket.put(item.frozenKey, item.bytes, {
        customMetadata: { digest: item.digest, immutable: "catalog-release-v3" },
        ...(item.httpMetadata ? { httpMetadata: item.httpMetadata } : {}),
      });
    }
    await hook?.({
      candidateId,
      frozenKey: item.frozenKey,
      phase: "after-media-copy",
      sourceKey: item.sourceKey,
    });
    const verified = await bucket.get(item.frozenKey);
    if (!verified || (await sha256Bytes(await verified.arrayBuffer())) !== item.digest) {
      lifecycleError("catalog_media_digest_collision", `Frozen media key ${item.digest} differs.`);
    }
  }
}

async function assembleCandidateManifest(
  db: D1Database,
  environment: CatalogReleaseEnvironment,
  mediaOrigin: string,
  storefrontOrigin: string,
  releaseId: string,
  paymentCapabilitiesJson: string | undefined,
): Promise<{
  manifest: CatalogReleaseV3;
  sources: Awaited<ReturnType<typeof sourceVector>>;
}> {
  await validatePublishedNavigationReferences(db, environment);
  const sources = await sourceVector(db, environment);
  const product = sources.sources.find(({ kind }) => kind === "product")!;
  const policyAuthorities = sources.authorities.filter(({ kind }) => kind === "policy");
  const policies = policyAuthorities.map(({ row }) => {
    const sections = JSON.parse(String(row.sections_json)) as Array<{
      alt?: string;
      caption?: string;
      items?: string[];
      kind: string;
      text?: string;
    }>;
    const title = String(row.title);
    return {
      description:
        sections
          .flatMap((section) => section.text ?? section.items ?? section.caption ?? [])
          .join(" ")
          .slice(0, 2_000) || title,
      effectiveDate: String(row.effective_date),
      kind: String(row.kind) as "privacy" | "returns" | "shipping" | "terms",
      sections: sections.map((section) => ({
        body: section.text ?? section.items?.join("\n") ?? section.caption ?? section.alt ?? title,
        heading: section.kind === "heading" && section.text ? section.text : title,
      })),
      slug: String(row.slug),
      title,
    };
  });
  const v2 = await buildCatalogReleaseManifest(db, {
    aggregatePublishedCatalog: true,
    candidateProductId: product.id,
    environment,
    mediaOrigin,
    policies,
    releaseId,
    storefrontOrigin,
  });
  const records = await Promise.all(
    sources.authorities
      .filter(({ kind }) => ["policy", "page", "article"].includes(kind))
      .map(async ({ id, kind, row, version }) => ({
        digest: await sha256Bytes(stableCandidateJson(row)),
        id,
        kind: kind as "policy" | "page" | "article",
        payload: {
          ...(kind === "policy" ? { effectiveDate: String(row.effective_date) } : {}),
          sections: JSON.parse(String(row.sections_json)),
          ...(kind === "page" || kind === "article"
            ? {
                ...(kind === "article" && row.cover_asset_id
                  ? { coverAssetId: String(row.cover_asset_id) }
                  : {}),
                seo: JSON.parse(String(row.seo_json)),
                summary: String(row.summary),
              }
            : {}),
        },
        route:
          kind === "policy"
            ? `/policies/${String(row.slug)}`
            : contentRoute(kind as "page" | "article", String(row.slug)),
        slug: String(row.slug),
        title: String(row.title),
        version,
      })),
  );
  const releasedMediaIds = new Set(
    v2.products.flatMap(({ media }) => media.flatMap(({ id }) => (id ? [id] : []))),
  );
  const publishedReferences = new Set(sources.sources.map(({ id, kind }) => `${kind}:${id}`));
  for (const record of records) {
    if (record.kind !== "page" && record.kind !== "article") continue;
    const sections = record.payload.sections as Array<{
      assetId?: string;
      kind?: string;
      link?: { target?: { kind?: string; reference?: { id?: string; kind?: string } } };
    }>;
    const mediaIds = [
      ...(record.payload.coverAssetId ? [record.payload.coverAssetId] : []),
      ...sections.flatMap(({ assetId, kind }) => (kind === "image" && assetId ? [assetId] : [])),
    ];
    for (const assetId of mediaIds) {
      if (!releasedMediaIds.has(assetId)) {
        lifecycleError(
          "catalog_content_media_unpublished",
          `${record.kind}:${record.id} references media ${assetId} outside the published catalog.`,
        );
      }
    }
    for (const section of sections) {
      const reference = section.link?.target?.reference;
      if (
        section.kind === "link" &&
        section.link?.target?.kind === "internal" &&
        reference?.id &&
        reference.kind &&
        !publishedReferences.has(`${reference.kind}:${reference.id}`)
      ) {
        lifecycleError(
          "catalog_content_reference_unpublished",
          `${record.kind}:${record.id} links to unpublished ${reference.kind}:${reference.id}.`,
        );
      }
    }
  }
  const navigation = await Promise.all(
    sources.authorities
      .filter(({ kind }) => kind === "navigation")
      .map(async ({ id, row, version }) => {
        const items = await db
          .prepare(
            `SELECT item_id AS id, parent_item_id AS parentId, position, label, target_json AS target
               FROM navigation_items WHERE menu_id = ? AND menu_version = ? ORDER BY position, item_id`,
          )
          .bind(id, version)
          .all<Record<string, unknown>>();
        return {
          digest: await sha256Bytes(stableCandidateJson({ row, items: items.results })),
          id,
          items: items.results.map((item) => ({
            ...item,
            id: String(item.id),
            target: JSON.parse(String(item.target)),
          })),
          placement: String(row.placement) as "header" | "footer",
          version,
        };
      }),
  );
  const identityAuthority = sources.authorities.find(({ kind }) => kind === "store-identity")!;
  const identityLogos = await db
    .prepare(
      `SELECT asset_id AS assetId, variant FROM store_identity_logo_assets
        WHERE identity_id = ? AND identity_version = ? ORDER BY variant`,
    )
    .bind(identityAuthority.id, identityAuthority.version)
    .all<{ assetId: string; variant: "primary" | "light" | "dark" | "compact" }>();
  const identityMedia = (assetId: string, kind: "logo" | "favicon") => {
    const media = v2.products.flatMap((product) => product.media).find(({ id }) => id === assetId);
    if (!media) {
      lifecycleError(
        `catalog_identity_${kind}_media_missing`,
        `Store Identity ${kind} ${assetId} is absent from the frozen product media release.`,
      );
    }
    const { id: _id, ...frozenMedia } = media;
    return frozenMedia;
  };
  const faviconAssetId =
    typeof identityAuthority.row.favicon_asset_id === "string"
      ? identityAuthority.row.favicon_asset_id
      : null;
  const frozenIdentity = {
    faviconAssetId,
    ...(faviconAssetId ? { faviconMedia: identityMedia(faviconAssetId, "favicon") } : {}),
    id: "identity.primary" as const,
    logoAssets: identityLogos.results.map((logo) => ({
      ...logo,
      media: identityMedia(logo.assetId, "logo"),
    })),
    seo: JSON.parse(String(identityAuthority.row.seo_json)),
    socialShareAssetId:
      typeof identityAuthority.row.social_share_asset_id === "string"
        ? identityAuthority.row.social_share_asset_id
        : null,
    storefrontName: String(identityAuthority.row.storefront_name),
    tagline: String(identityAuthority.row.tagline),
    version: identityAuthority.version,
  };
  const routes = [
    ...new Set([
      ...v2.routes,
      ...records.map(({ route }) => route),
      "/account",
      "/cart",
      "/checkout",
    ]),
  ].sort((left, right) => (left === "/" ? -1 : right === "/" ? 1 : left.localeCompare(right)));
  const availableRoutes = new Set(routes);
  for (const menu of navigation) {
    for (const item of menu.items) {
      if (item.target.kind === "route" && !availableRoutes.has(item.target.path)) {
        lifecycleError(
          "catalog_navigation_route_unavailable",
          `${menu.id}@${menu.version}/${String(item.id)} targets unavailable route ${item.target.path}.`,
        );
      }
    }
  }
  const contentRedirects = await db
    .prepare(
      `SELECT from_path AS "from", to_path AS "to" FROM content_route_redirects
       WHERE environment = ? ORDER BY from_path`,
    )
    .bind(environment)
    .all<{ from: string; to: string }>();
  const redirects = [
    ...v2.redirects,
    ...contentRedirects.results.map((redirect) => ({ ...redirect, status: 301 as const })),
  ];
  const launchSetting = await db
    .prepare("SELECT value_json FROM settings WHERE key = 'launch_configuration'")
    .first<{ value_json: string }>();
  const launch = launchSetting
    ? launchConfigurationSchema.parse(JSON.parse(launchSetting.value_json))
    : null;
  const shippingMethodCountries = launch
    ? await db
        .prepare(
          `SELECT sm.id, sm.name, sm.price_amount AS amount, sm.currency, szc.country_code
             FROM shipping_methods sm
             JOIN shipping_zones sz ON sz.id = sm.zone_id
             JOIN shipping_zone_countries szc ON szc.zone_id = sz.id
            WHERE sm.status = 'active' AND sz.status = 'active'
              AND sm.id IN (SELECT value FROM json_each(?))
              AND szc.country_code IN (SELECT value FROM json_each(?))
            ORDER BY sm.id, szc.country_code`,
        )
        .bind(JSON.stringify(launch.shippingMethodIds), JSON.stringify(launch.shippingCountries))
        .all<{
          amount: number;
          country_code: string;
          currency: string;
          id: string;
          name: string;
        }>()
    : {
        results: [] as Array<{
          amount: number;
          country_code: string;
          currency: string;
          id: string;
          name: string;
        }>,
      };
  const shippingMethods = [...new Set(shippingMethodCountries.results.map(({ id }) => id))].map(
    (id) => {
      const rows = shippingMethodCountries.results.filter((row) => row.id === id);
      const method = rows[0]!;
      return {
        amount: method.amount,
        countryCodes: rows.map(({ country_code }) => country_code),
        currency: method.currency,
        id,
        name: method.name,
      };
    },
  );
  let parsedCapabilities: ReturnType<typeof catalogPaymentCapabilitiesSchema.safeParse> | null =
    null;
  if (paymentCapabilitiesJson) {
    try {
      parsedCapabilities = catalogPaymentCapabilitiesSchema.safeParse(
        JSON.parse(paymentCapabilitiesJson),
      );
    } catch {
      lifecycleError(
        "catalog_payment_capabilities_invalid",
        "The configured public payment capability snapshot is invalid.",
      );
    }
  }
  if (paymentCapabilitiesJson && !parsedCapabilities?.success) {
    lifecycleError(
      "catalog_payment_capabilities_invalid",
      "The configured public payment capability snapshot is invalid.",
    );
  }
  const payment =
    launch && parsedCapabilities?.success
      ? parsedCapabilities.data
      : { brands: [], enabled: false, provider: "stripe" as const };
  const commerce = {
    payment,
    shippingMethods,
  };
  validateCatalogCandidateSnapshot({
    environment,
    redirects,
    routes,
    sources: sources.sources.map((source) => ({
      ...source,
      currentDigest: source.digest,
      currentKind: source.kind,
      currentStatus: "published" as const,
      currentVersion: source.version,
      environment,
    })),
  });
  return {
    manifest: catalogReleaseV3Schema.parse({
      ...v2,
      commerce,
      content: records,
      environment,
      identity: frozenIdentity,
      navigation,
      purpose: "private-preview",
      redirects,
      routeOutput: routes,
      routes,
      schemaVersion: 3,
      site: { ...v2.site, name: frozenIdentity.storefrontName },
      sourceVersionVector: sources.sources,
    }),
    sources,
  };
}

function canonicalSourcePayload(manifest: CatalogReleaseV3): string {
  const { generatedAt: _generatedAt, releaseId: _releaseId, ...stable } = manifest;
  return stableCandidateJson(stable);
}

async function expirePrivateCatalogCandidates(db: D1Database, now: string): Promise<void> {
  await db
    .prepare(
      `UPDATE catalog_releases
          SET candidate_status = 'expired', updated_at = ?
        WHERE purpose = 'private-preview'
          AND candidate_status IN ('pending', 'succeeded', 'failed')
          AND candidate_expires_at <= ?`,
    )
    .bind(now, now)
    .run();
}

async function failPrivateCatalogCandidate(
  db: D1Database,
  id: string,
  error: unknown,
): Promise<void> {
  const code = error instanceof ApiError ? error.code : "catalog_candidate_build_failed";
  await db
    .prepare(
      `UPDATE catalog_releases
          SET candidate_status = 'failed', candidate_failure_json = ?, updated_at = ?
        WHERE id = ? AND purpose = 'private-preview' AND candidate_status = 'pending'`,
    )
    .bind(JSON.stringify([{ code }]), new Date().toISOString(), id)
    .run();
}

export async function buildPrivateCatalogCandidate(
  context: Context<ApiEnvironment>,
  reason: string,
  options: {
    beforeCommit?: () => Promise<void>;
    freezeHook?: (event: CatalogCandidateFreezeEvent) => Promise<void>;
  } = {},
): Promise<{
  environment: CatalogReleaseEnvironment;
  id: string;
  manifestDigest: string;
  purpose: "private-preview";
  sourceDigest: string;
  sources: CatalogReleaseSource[];
  status: "succeeded";
}> {
  const principal = context.get("principal");
  if (principal.principalKind !== "human") {
    throw new ApiError(403, "human_principal_required", "A human operator must build candidates.");
  }
  const auditReason = normalizeAuditReason(reason);
  const environment = context.env.ENVIRONMENT;
  const now = new Date().toISOString();
  await expirePrivateCatalogCandidates(context.env.DB, now);
  let releaseId: string = crypto.randomUUID();
  const captured = await assembleCandidateManifest(
    context.env.DB,
    environment,
    context.env.MEDIA_PUBLIC_ORIGIN,
    context.env.STOREFRONT_ORIGIN,
    releaseId,
    context.env.STRIPE_PUBLIC_CAPABILITIES_JSON,
  );
  const capturedPayload = canonicalSourcePayload(captured.manifest);
  const manifest = structuredClone(captured.manifest);
  const media = await planCandidateMedia(
    context.env.MEDIA,
    manifest,
    context.env.MEDIA_PUBLIC_ORIGIN,
  );
  const sourceDigest = await sha256Bytes(
    stableCandidateJson({
      media: media.map(({ digest, sourceKey }) => ({ digest, sourceKey })),
      payload: capturedPayload,
    }),
  );
  await options.freezeHook?.({ candidateId: releaseId, phase: "before-pending" });
  const manifestJson = JSON.stringify(catalogReleaseV3Schema.parse(manifest));
  const manifestDigest = await sha256Bytes(manifestJson);
  let committedManifestDigest = manifestDigest;
  const existing = await context.env.DB.prepare(
    `SELECT id, manifest_digest, candidate_status FROM catalog_releases
        WHERE purpose = 'private-preview' AND environment = ? AND source_digest = ?
          AND candidate_status IN ('pending', 'succeeded', 'failed')`,
  )
    .bind(environment, sourceDigest)
    .first<{
      candidate_status: "pending" | "succeeded" | "failed";
      id: string;
      manifest_digest: string;
    }>();
  if (existing?.candidate_status === "succeeded") {
    return {
      environment,
      id: existing.id,
      manifestDigest: existing.manifest_digest,
      purpose: "private-preview",
      sourceDigest,
      sources: captured.sources.sources,
      status: "succeeded",
    };
  }
  if (existing?.candidate_status === "pending") {
    lifecycleError("catalog_candidate_pending", `Candidate ${existing.id} is already building.`);
  }
  if (existing?.candidate_status === "failed") {
    releaseId = existing.id;
    committedManifestDigest = existing.manifest_digest;
    const resumed = await context.env.DB.prepare(
      `UPDATE catalog_releases
            SET candidate_status = 'pending', candidate_failure_json = NULL,
                candidate_expires_at = ?, updated_at = ?
          WHERE id = ? AND candidate_status = 'failed'`,
    )
      .bind(new Date(Date.now() + 2 * 60 * 1_000).toISOString(), now, releaseId)
      .run();
    if (resumed.meta.changes !== 1) {
      lifecycleError(
        "catalog_candidate_transition_conflict",
        "Candidate retry lost its state race.",
      );
    }
  } else {
    try {
      await context.env.DB.batch([
        context.env.DB.prepare(
          `INSERT INTO catalog_releases
            (id, status, manifest_json, approved_by, approved_at, purpose, environment,
             manifest_digest, source_digest, candidate_status, candidate_expires_at, created_at, updated_at)
           VALUES (?, 'building', ?, ?, ?, 'private-preview', ?, ?, ?, 'pending', ?, ?, ?)`,
        ).bind(
          releaseId,
          manifestJson,
          principal.id,
          now,
          environment,
          manifestDigest,
          sourceDigest,
          new Date(Date.now() + 2 * 60 * 1_000).toISOString(),
          now,
          now,
        ),
      ]);
    } catch {
      lifecycleError(
        "catalog_candidate_transition_conflict",
        "Candidate creation lost its tuple race.",
      );
    }
  }
  await options.freezeHook?.({ candidateId: releaseId, phase: "after-pending" });
  try {
    const current = await assembleCandidateManifest(
      context.env.DB,
      environment,
      context.env.MEDIA_PUBLIC_ORIGIN,
      context.env.STOREFRONT_ORIGIN,
      releaseId,
      context.env.STRIPE_PUBLIC_CAPABILITIES_JSON,
    );
    if (canonicalSourcePayload(current.manifest) !== capturedPayload) {
      lifecycleError("catalog_source_drift", "A source payload changed before candidate freeze.");
    }
    await copyCandidateMedia(context.env.MEDIA, media, releaseId, options.freezeHook);
    await options.beforeCommit?.();
    await options.freezeHook?.({ candidateId: releaseId, phase: "before-success" });
    const completedAt = new Date().toISOString();
    const results = await context.env.DB.batch([
      context.env.DB.prepare(
        `UPDATE catalog_releases
            SET status = 'approved', approved_at = ?, candidate_status = 'succeeded',
                candidate_expires_at = ?, updated_at = ?
          WHERE id = ? AND candidate_status = 'pending' AND candidate_expires_at > ?`,
      ).bind(
        completedAt,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString(),
        completedAt,
        releaseId,
        completedAt,
      ),
      ...candidateLedgerChunks(captured.sources.sources).map((sources) =>
        context.env.DB.prepare(
          `INSERT INTO catalog_release_sources
            (release_id, source_kind, source_id, source_version, source_digest, environment, created_at)
           SELECT ?, json_extract(value, '$.kind'), json_extract(value, '$.id'),
                  json_extract(value, '$.version'), json_extract(value, '$.digest'), ?, ?
             FROM json_each(?) WHERE EXISTS
             (SELECT 1 FROM catalog_releases WHERE id = ? AND candidate_status = 'succeeded')
           ON CONFLICT(release_id, source_kind, source_id) DO NOTHING`,
        ).bind(releaseId, environment, completedAt, JSON.stringify(sources), releaseId),
      ),
      ...candidateLedgerChunks(media).map((items) =>
        context.env.DB.prepare(
          `INSERT INTO catalog_release_media_ledger
            (release_id, source_key, frozen_key, digest, byte_size, created_at)
           SELECT ?, json_extract(value, '$.sourceKey'), json_extract(value, '$.frozenKey'),
                  json_extract(value, '$.digest'), json_extract(value, '$.byteSize'), ?
             FROM json_each(?) WHERE EXISTS
             (SELECT 1 FROM catalog_releases WHERE id = ? AND candidate_status = 'succeeded')
           ON CONFLICT(release_id, source_key) DO NOTHING`,
        ).bind(releaseId, completedAt, JSON.stringify(items), releaseId),
      ),
    ]);
    if (results[0]?.meta.changes !== 1) {
      lifecycleError(
        "catalog_candidate_transition_conflict",
        "Candidate completion lost its state race.",
      );
    }
  } catch (error) {
    await failPrivateCatalogCandidate(context.env.DB, releaseId, error);
    throw error;
  }
  await recordAuditEvent(context.env.DB, {
    action: "catalog.candidate.build",
    actorId: principal.id,
    actorType: "admin",
    id: crypto.randomUUID(),
    metadata: {
      environment,
      manifestDigest: committedManifestDigest,
      sourceDigest,
      sourceCount: captured.sources.sources.length,
    },
    reason: auditReason,
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: releaseId,
    targetType: "catalog_release",
  });
  return {
    environment,
    id: releaseId,
    manifestDigest: committedManifestDigest,
    purpose: "private-preview",
    sourceDigest,
    sources: captured.sources.sources,
    status: "succeeded",
  };
}

export async function getPrivateCatalogCandidate(
  db: D1Database,
  id: string,
  environment: CatalogReleaseEnvironment,
): Promise<{ manifest: CatalogReleaseV3; manifestDigest: string; sourceDigest: string }> {
  await expirePrivateCatalogCandidates(db, new Date().toISOString());
  const row = await db
    .prepare(
      `SELECT status, purpose, environment, manifest_json, manifest_digest, source_digest,
            candidate_status, candidate_expires_at
       FROM catalog_releases WHERE id = ?`,
    )
    .bind(id)
    .first<{
      environment: CatalogReleaseEnvironment;
      candidate_status: string | null;
      candidate_expires_at: string | null;
      manifest_digest: string;
      manifest_json: string;
      purpose: "private-preview" | "public";
      source_digest: string;
      status: string;
    }>();
  if (!row) throw new ApiError(404, "catalog_release_not_found", "Candidate was not found.");
  if (!row.candidate_expires_at || row.candidate_expires_at <= new Date().toISOString()) {
    lifecycleError("catalog_candidate_expired", "Private candidate has expired.");
  }
  assertCatalogReleaseLifecycle(
    { ...row, candidateStatus: row.candidate_status },
    { environment, operation: "private-preview", principalKind: "human" },
  );
  return {
    manifest: parsePrivateCatalogCandidate(JSON.parse(row.manifest_json)),
    manifestDigest: row.manifest_digest,
    sourceDigest: row.source_digest,
  };
}

export type CatalogCandidateStatus = "pending" | "succeeded" | "failed" | "abandoned" | "expired";

export async function getPrivateCatalogCandidateStatus(
  db: D1Database,
  id: string,
  environment: CatalogReleaseEnvironment,
): Promise<{
  environment: CatalogReleaseEnvironment;
  failures: Array<{ code: string }>;
  id: string;
  manifestDigest: string;
  purpose: "private-preview";
  sourceDigest: string;
  status: CatalogCandidateStatus;
}> {
  await expirePrivateCatalogCandidates(db, new Date().toISOString());
  const row = await db
    .prepare(
      `SELECT id, environment, purpose, manifest_digest, source_digest, candidate_status,
              candidate_failure_json, status
         FROM catalog_releases WHERE id = ? AND purpose = 'private-preview'`,
    )
    .bind(id)
    .first<{
      candidate_failure_json: string | null;
      candidate_status: CatalogCandidateStatus;
      environment: CatalogReleaseEnvironment;
      id: string;
      manifest_digest: string;
      purpose: "private-preview";
      source_digest: string;
      status: string;
    }>();
  if (!row) throw new ApiError(404, "catalog_release_not_found", "Candidate was not found.");
  if (row.environment !== environment) {
    lifecycleError("catalog_release_environment_mismatch", "Release environment does not match.");
  }
  assertCatalogReleaseLifecycle(
    { ...row, candidateStatus: row.candidate_status },
    { environment, operation: "candidate-status", principalKind: "human" },
  );
  let failures: Array<{ code: string }> = [];
  if (row.candidate_failure_json) {
    try {
      failures = JSON.parse(row.candidate_failure_json) as Array<{ code: string }>;
    } catch {
      failures = [{ code: "catalog_candidate_failure_invalid" }];
    }
  }
  return {
    environment: row.environment,
    failures,
    id: row.id,
    manifestDigest: row.manifest_digest,
    purpose: "private-preview",
    sourceDigest: row.source_digest,
    status: row.candidate_status,
  };
}

export async function abandonPrivateCatalogCandidate(
  context: Context<ApiEnvironment>,
  id: string,
  reason: string,
): Promise<Awaited<ReturnType<typeof getPrivateCatalogCandidateStatus>>> {
  const principal = context.get("principal");
  if (principal.principalKind !== "human") {
    throw new ApiError(
      403,
      "human_principal_required",
      "A human operator must abandon candidates.",
    );
  }
  const auditReason = normalizeAuditReason(reason);
  const now = new Date().toISOString();
  const retained = await context.env.DB.prepare(
    "SELECT id FROM storefront_publications WHERE catalog_release_id = ? LIMIT 1",
  )
    .bind(id)
    .first<{ id: string }>();
  if (retained) {
    throw new ApiError(
      409,
      "catalog_publication_retained",
      "This candidate is retained for an authorized storefront publication.",
    );
  }
  await expirePrivateCatalogCandidates(context.env.DB, now);
  const current = await getPrivateCatalogCandidateStatus(
    context.env.DB,
    id,
    context.env.ENVIRONMENT,
  );
  assertCatalogReleaseLifecycle(
    {
      candidateStatus: current.status,
      environment: current.environment,
      purpose: current.purpose,
      status: "building",
    },
    {
      environment: context.env.ENVIRONMENT,
      operation: "candidate-abandon",
      principalKind: "human",
    },
  );
  const changed = await context.env.DB.prepare(
    `UPDATE catalog_releases
          SET candidate_status = 'abandoned', updated_at = ?
        WHERE id = ? AND purpose = 'private-preview' AND environment = ?
          AND candidate_status IN ('pending', 'succeeded', 'failed')`,
  )
    .bind(now, id, context.env.ENVIRONMENT)
    .run();
  if (changed.meta.changes !== 1) {
    lifecycleError("catalog_candidate_transition_conflict", "Candidate cannot be abandoned now.");
  }
  await recordAuditEvent(context.env.DB, {
    action: "catalog.candidate.abandon",
    actorId: principal.id,
    actorType: "admin",
    id: crypto.randomUUID(),
    metadata: { environment: context.env.ENVIRONMENT },
    reason: auditReason,
    requestId: context.get("requestId"),
    result: "succeeded",
    targetId: id,
    targetType: "catalog_release",
  });
  return getPrivateCatalogCandidateStatus(context.env.DB, id, context.env.ENVIRONMENT);
}
