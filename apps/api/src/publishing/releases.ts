import { SignJWT } from "jose";
import type { Context } from "hono";

import { getProduct } from "../catalog/products";
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
    "SELECT status, failure_code, deployed_at FROM catalog_releases WHERE id = ?",
  )
    .bind(releaseId)
    .first<{ deployed_at: string | null; failure_code: string | null; status: string }>();
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
  const transition = context.env.DB.prepare(
    `UPDATE catalog_releases
        SET status = ?, deployed_at = ?, failure_code = ?, updated_at = ?
      WHERE id = ? AND status = 'building'`,
  ).bind(
    result.status,
    result.status === "deployed" ? now : null,
    result.status === "failed" ? result.failureCode : null,
    now,
    releaseId,
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
  const [changed] = await context.env.DB.batch([transition, audit]);
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
) {
  const snapshot = await getProduct(context.env.DB, productId);
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
  const manifest = await buildCatalogReleaseManifest(context.env.DB, {
    candidateProductId: productId,
    mediaOrigin: context.env.MEDIA_PUBLIC_ORIGIN,
    releaseId,
    storefrontOrigin: context.env.STOREFRONT_ORIGIN,
  });
  await context.env.DB.prepare(
    `INSERT INTO catalog_releases
      (id, status, manifest_json, approved_by, approved_at, product_id, created_at, updated_at)
     VALUES (?, 'approved', ?, ?, ?, ?, ?, ?)`,
  )
    .bind(releaseId, JSON.stringify(manifest), principal.id, now, productId, now, now)
    .run();

  try {
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
        "UPDATE products SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?",
      ).bind(now, now, productId),
      context.env.DB.prepare(
        `UPDATE collections
            SET status = 'published', updated_at = ?
          WHERE id IN (SELECT collection_id FROM collection_products WHERE product_id = ?)`,
      ).bind(now, productId),
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
    throw error;
  }
}
