import { SignJWT } from "jose";
import type { Context } from "hono";

import { getProduct } from "../catalog/products";
import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { recordAuditEvent } from "../iam/audit";

export interface BuildTriggerResult {
  correlationId: string;
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
  const manifest = {
    generatedAt: now,
    product: snapshot,
    releaseId,
    schemaVersion: 1,
  };
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
    ]);
    await recordAuditEvent(context.env.DB, {
      action: "catalog.publish",
      actorId: principal.id,
      actorType: "admin",
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
