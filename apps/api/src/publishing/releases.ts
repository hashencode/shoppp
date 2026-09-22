import { SignJWT } from "jose";
import type { Context } from "hono";

import { getProduct } from "../catalog/products";
import { getPublishedProductRevisions } from "../catalog/published-revisions";
import type { PublishedProductReleaseInput } from "../catalog/schemas";
import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";
import { actorTypeForPrincipal } from "../iam/permissions";
import { buildCatalogReleaseManifest } from "./build-manifest";
import type { CatalogBuildResult } from "@shoppp/contracts";

export interface BuildTriggerResult {
  correlationId: string;
}

const BUILD_HOOK_TIMEOUT_MS = 15_000;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type BuildTrigger = (input: {
  environment: string;
  releaseId: string;
  requestId: string;
}) => Promise<BuildTriggerResult>;

export async function createPreviewToken(
  productId: string,
  secret: string,
): Promise<{ expiresAt: string; token: string }> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1_000);
  const token = await new SignJWT({ productId, purpose: "catalog-preview" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1_000))
    .sign(new TextEncoder().encode(secret));
  return { expiresAt: expiresAt.toISOString(), token };
}

export function defaultBuildTrigger(env: ApiEnvironment["Bindings"]): BuildTrigger {
  return async (input) => {
    if (!env.STOREFRONT_BUILD_HOOK || !env.BUILD_HOOK_TOKEN) {
      throw new ApiError(
        500,
        "build_hook_not_configured",
        "The storefront build hook is not configured.",
      );
    }
    const response = await fetch(env.STOREFRONT_BUILD_HOOK, {
      body: JSON.stringify(input),
      headers: {
        Authorization: `Bearer ${env.BUILD_HOOK_TOKEN}`,
        "Content-Type": "application/json",
        "X-Request-Id": input.requestId,
      },
      method: "POST",
      signal: AbortSignal.timeout(BUILD_HOOK_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new ApiError(500, "build_hook_failed", "The storefront build could not be started.");
    }
    const body: { correlationId?: string } = await response
      .json<{ correlationId?: string }>()
      .catch(() => ({}));
    return {
      correlationId:
        body.correlationId ?? response.headers.get("x-build-correlation-id") ?? crypto.randomUUID(),
    };
  };
}

export async function recordCatalogBuildResult(
  context: Context<ApiEnvironment>,
  releaseId: string,
  result: CatalogBuildResult,
) {
  const current = await context.env.DB.prepare(
    "SELECT status, failure_code, deployed_at, product_revision_id FROM catalog_releases WHERE id = ?",
  )
    .bind(releaseId)
    .first<{
      deployed_at: string | null;
      failure_code: string | null;
      product_revision_id: string | null;
      status: string;
    }>();
  if (!current) {
    throw new ApiError(404, "catalog_release_not_found", "The catalog release was not found.");
  }
  if (current.status === result.status) {
    return {
      deployedAt: current.deployed_at,
      failureCode: current.failure_code,
      releaseId,
      status: current.status,
    };
  }
  if (current.status !== "building") {
    throw new ApiError(
      409,
      "catalog_build_transition_invalid",
      `A catalog release in ${current.status} cannot transition to ${result.status}.`,
    );
  }

  const now = new Date().toISOString();
  const revisionStatus = result.status === "deployed" ? "published" : "draft";
  const transition = context.env.DB.prepare(
    `UPDATE catalog_releases
        SET status = ?, deployed_at = ?, failure_code = ?, updated_at = ?,
            build_correlation_id = CASE
              WHEN build_correlation_id LIKE 'staging-proof:%'
                THEN substr(build_correlation_id, length('staging-proof:') + 1)
              ELSE build_correlation_id
            END
      WHERE id = ? AND status = 'building'
        AND (? IS NULL OR EXISTS (
          SELECT 1 FROM product_revisions
           WHERE id = ? AND status = ? AND updated_at = ?
        ))`,
  ).bind(
    result.status,
    result.status === "deployed" ? now : null,
    result.status === "failed" ? result.failureCode : null,
    now,
    releaseId,
    current.product_revision_id,
    current.product_revision_id,
    revisionStatus,
    now,
  );
  const audit = context.env.DB.prepare(
    `INSERT OR IGNORE INTO audit_events
       (id, actor_type, action, target_type, target_id, result, reason, request_id,
        metadata_json, created_at)
     SELECT ?, 'machine', 'catalog.build.result', 'catalog_release', ?,
            ?, ?, ?, ?, ?
       FROM catalog_releases
      WHERE id = ? AND status = ? AND updated_at = ?`,
  ).bind(
    `aud_catalog_build_${releaseId}`,
    releaseId,
    result.status === "deployed" ? "succeeded" : "failed",
    result.status === "failed" ? result.failureCode : null,
    context.get("requestId"),
    JSON.stringify({ status: result.status }),
    now,
    releaseId,
    result.status,
    now,
  );
  const revisionTransition = current.product_revision_id
    ? context.env.DB.prepare(
        `UPDATE product_revisions
            SET status = ?, published_at = ?, updated_at = ?
          WHERE id = ? AND status = 'building'`,
      ).bind(
        revisionStatus,
        result.status === "deployed" ? now : null,
        now,
        current.product_revision_id,
      )
    : null;
  const changes = await context.env.DB.batch([
    ...(revisionTransition ? [revisionTransition] : []),
    transition,
    audit,
  ]);
  const changed = changes[revisionTransition ? 1 : 0];
  if (!changed || changed.meta.changes !== 1) {
    const terminal = await context.env.DB.prepare(
      "SELECT status, failure_code, deployed_at FROM catalog_releases WHERE id = ?",
    )
      .bind(releaseId)
      .first<{ deployed_at: string | null; failure_code: string | null; status: string }>();
    if (terminal?.status === result.status) {
      return {
        deployedAt: terminal.deployed_at,
        failureCode: terminal.failure_code,
        releaseId,
        status: terminal.status,
      };
    }
    throw new ApiError(
      409,
      "catalog_build_transition_conflict",
      "The catalog release changed while the build result was recorded.",
    );
  }
  return {
    deployedAt: result.status === "deployed" ? now : null,
    failureCode: result.status === "failed" ? result.failureCode : null,
    releaseId,
    status: result.status,
  };
}

export async function publishProduct(
  context: Context<ApiEnvironment>,
  productId: string,
  trigger: BuildTrigger,
  reason: string,
  expectedVersion?: number,
) {
  const snapshot = await getProduct(context.env.DB, productId);
  if (!["draft", "scheduled"].includes(snapshot.product.status)) {
    throw new ApiError(409, "published_product_immutable", "Only editable Products can publish.");
  }
  if (
    !snapshot.product.seo_title ||
    !snapshot.product.seo_description ||
    snapshot.variants.length === 0 ||
    snapshot.prices.length === 0 ||
    snapshot.media.length === 0
  ) {
    throw new ApiError(
      422,
      "catalog_release_invalid",
      "A release needs SEO, an active variant, a price, and media.",
    );
  }
  const principal = context.get("principal");
  const releaseId = crypto.randomUUID();
  const now = new Date().toISOString();
  const sourceVersion = expectedVersion ?? snapshot.product.version;
  if (sourceVersion !== snapshot.product.version) {
    throw new ApiError(409, "stale_product_version", "The Product changed before publication.");
  }
  const freeze = await context.env.DB.prepare(
    `UPDATE products
        SET status = 'published', published_at = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND status IN ('draft', 'scheduled') AND version = ?`,
  )
    .bind(now, now, productId, sourceVersion)
    .run();
  if (freeze.meta.changes !== 1) {
    throw new ApiError(409, "stale_product_version", "The Product changed before publication.");
  }
  const frozenVersion = sourceVersion + 1;

  try {
    const manifest = await buildCatalogReleaseManifest(context.env.DB, {
      candidateProductId: productId,
      mediaOrigin: context.env.MEDIA_PUBLIC_ORIGIN,
      releaseId,
      storefrontOrigin: context.env.STOREFRONT_ORIGIN,
    });
    const manifestJson = JSON.stringify(manifest);
    const manifestDigest = await sha256(manifestJson);
    await context.env.DB.prepare(
      `INSERT INTO catalog_releases
        (id, status, manifest_json, approved_by, approved_at, product_id, purpose, environment,
         manifest_digest, created_at, updated_at)
       VALUES (?, 'approved', ?, ?, ?, ?, 'public', ?, ?, ?, ?)`,
    )
      .bind(
        releaseId,
        manifestJson,
        principal.id,
        now,
        productId,
        context.env.ENVIRONMENT,
        manifestDigest,
        now,
        now,
      )
      .run();
    const build = await trigger({
      environment: context.env.ENVIRONMENT,
      releaseId,
      requestId: context.get("requestId"),
    });
    await context.env.DB.batch([
      context.env.DB.prepare(
        `UPDATE catalog_releases
            SET status = 'building', build_correlation_id = ?, updated_at = ?
          WHERE id = ?`,
      ).bind(build.correlationId, new Date().toISOString(), releaseId),
      context.env.DB.prepare(
        `UPDATE collection_versions
            SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ?
          WHERE (collection_id, version) IN (
            SELECT cm.collection_id, cm.collection_version
              FROM collection_memberships cm
             WHERE cm.product_id = ?
               AND cm.collection_version = (
                 SELECT MAX(cv.version) FROM collection_versions cv
                  WHERE cv.collection_id = cm.collection_id
               )
          )`,
      ).bind(now, now, productId),
    ]);
    await recordAuditEvent(context.env.DB, {
      action: "catalog.publish",
      actorId: principal.id,
      actorType: actorTypeForPrincipal(principal),
      id: crypto.randomUUID(),
      metadata: { buildCorrelationId: build.correlationId },
      reason,
      requestId: context.get("requestId"),
      result: "succeeded",
      targetId: releaseId,
      targetType: "catalog_release",
    });
    return { buildCorrelationId: build.correlationId, releaseId, status: "building" };
  } catch (error) {
    await context.env.DB.prepare(
      "UPDATE catalog_releases SET status = 'failed', failure_code = ?, updated_at = ? WHERE id = ?",
    )
      .bind(
        error instanceof ApiError ? error.code : "build_hook_failed",
        new Date().toISOString(),
        releaseId,
      )
      .run();
    await context.env.DB.prepare(
      `UPDATE products
          SET status = ?, published_at = NULL, version = version + 1, updated_at = ?
        WHERE id = ? AND status = 'published' AND version = ?`,
    )
      .bind(snapshot.product.status, new Date().toISOString(), productId, frozenVersion)
      .run();
    throw error;
  }
}

export async function publishPublishedProductRevision(
  context: Context<ApiEnvironment>,
  productId: string,
  input: PublishedProductReleaseInput,
  trigger: BuildTrigger,
) {
  const db = context.env.DB;
  const state = await getPublishedProductRevisions(db, productId);
  if (state.productVersion !== input.expectedProductVersion) {
    throw new ApiError(409, "stale_product_version", "The Product changed before publication.");
  }
  if ((state.published?.id ?? null) !== input.expectedPublishedRevisionId) {
    throw new ApiError(409, "stale_product_revision", "A newer Product revision was published.");
  }
  if (
    input.revisionId &&
    (state.draft?.id !== input.revisionId ||
      state.draft.status !== "draft" ||
      state.draft.version !== input.expectedDraftVersion)
  ) {
    throw new ApiError(
      409,
      "stale_product_revision",
      "The staged Product revision is unavailable.",
    );
  }
  if (!input.revisionId && input.expectedDraftVersion !== null) {
    throw new ApiError(
      422,
      "product_revision_unexpected",
      "A review-only release has no draft version.",
    );
  }
  const now = new Date().toISOString();
  if (input.revisionId) {
    const claimed = await db
      .prepare(
        `UPDATE product_revisions SET status = 'building', updated_at = ?
          WHERE id = ? AND product_id = ? AND status = 'draft' AND version = ?
            AND base_product_version = ? AND base_published_revision_id IS ?
            AND EXISTS (SELECT 1 FROM products WHERE id = ? AND status = 'published' AND version = ?)
            AND COALESCE((SELECT id FROM product_revisions
              WHERE product_id = ? AND status = 'published'
              ORDER BY published_at DESC, id DESC LIMIT 1), '') = COALESCE(?, '')`,
      )
      .bind(
        now,
        input.revisionId,
        productId,
        input.expectedDraftVersion,
        input.expectedProductVersion,
        input.expectedPublishedRevisionId,
        productId,
        input.expectedProductVersion,
        productId,
        input.expectedPublishedRevisionId,
      )
      .run();
    if (claimed.meta.changes !== 1) {
      throw new ApiError(409, "stale_product_revision", "The staged Product revision changed.");
    }
  }

  const releaseId = crypto.randomUUID();
  try {
    const manifest = await buildCatalogReleaseManifest(db, {
      candidateProductId: productId,
      ...(input.revisionId ? { candidateRevisionId: input.revisionId } : {}),
      mediaOrigin: context.env.MEDIA_PUBLIC_ORIGIN,
      releaseId,
      storefrontOrigin: context.env.STOREFRONT_ORIGIN,
    });
    const manifestJson = JSON.stringify(manifest);
    const manifestDigest = await sha256(manifestJson);
    const started = await db
      .prepare(
        `INSERT INTO catalog_releases
          (id, status, manifest_json, approved_by, approved_at, product_id,
           product_revision_id, purpose, environment, manifest_digest, created_at, updated_at)
         VALUES (?, 'approved', ?, ?, ?, ?, ?, 'public', ?, ?, ?, ?)`,
      )
      .bind(
        releaseId,
        manifestJson,
        context.get("principal").id,
        now,
        productId,
        input.revisionId,
        context.env.ENVIRONMENT,
        manifestDigest,
        now,
        now,
      )
      .run();
    const build = await trigger({
      environment: context.env.ENVIRONMENT,
      releaseId,
      requestId: context.get("requestId"),
    });
    await db
      .prepare(
        `UPDATE catalog_releases SET status = 'building', build_correlation_id = ?, updated_at = ?
          WHERE id = ? AND status = 'approved'`,
      )
      .bind(build.correlationId, new Date().toISOString(), releaseId)
      .run();
    if (started.meta.changes !== 1) {
      throw new ApiError(409, "catalog_build_transition_conflict", "The Catalog release changed.");
    }
    await recordAuditEvent(db, {
      action: "catalog.publish",
      actorId: context.get("principal").id,
      actorType: actorTypeForPrincipal(context.get("principal")),
      id: crypto.randomUUID(),
      metadata: { buildCorrelationId: build.correlationId, revisionId: input.revisionId },
      reason: input.reason,
      requestId: context.get("requestId"),
      result: "succeeded",
      targetId: releaseId,
      targetType: "catalog_release",
    });
    return { buildCorrelationId: build.correlationId, releaseId, status: "building" };
  } catch (error) {
    await db
      .prepare(
        `UPDATE catalog_releases SET status = 'failed', failure_code = ?, updated_at = ?
          WHERE id = ? AND status IN ('approved', 'building')`,
      )
      .bind(
        error instanceof ApiError ? error.code : "build_hook_failed",
        new Date().toISOString(),
        releaseId,
      )
      .run();
    if (input.revisionId) {
      await db
        .prepare(
          `UPDATE product_revisions SET status = 'draft', updated_at = ?
            WHERE id = ? AND status = 'building'`,
        )
        .bind(new Date().toISOString(), input.revisionId)
        .run();
    }
    throw error;
  }
}
