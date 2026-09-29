import type { TrafficEvent, TrafficIdentityRequest } from "@shoppp/contracts";
import type { Context } from "hono";
import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { getPublicRelease, publicProductPath } from "../reporting/public-products";
import { authorizeTrafficEvent, issueTrafficTicket } from "./identity";
import { enforceTrafficVisitorQuota } from "./protection";

export async function initializeTraffic(
  context: Context<ApiEnvironment>,
  input: TrafficIdentityRequest,
) {
  if (!(await getPublicRelease(context.env, input.releaseId))) {
    throw new ApiError(403, "traffic_release_invalid", "A public storefront release is required.");
  }
  return issueTrafficTicket(context, input.releaseId);
}
export async function recordTraffic(
  context: Context<ApiEnvironment>,
  input: TrafficEvent,
): Promise<void> {
  const now = Date.now();
  const visitorDigest = await authorizeTrafficEvent(context, input.ticket, input.releaseId, now);
  await enforceTrafficVisitorQuota(context, visitorDigest);
  const release = await getPublicRelease(context.env, input.releaseId);
  if (
    !release ||
    (input.productId !== undefined && publicProductPath(release, input.productId) === null)
  ) {
    throw new ApiError(
      403,
      "traffic_release_invalid",
      "A public storefront product or release is required.",
    );
  }
  const bucket = new Date(Math.floor(now / 60_000) * 60_000).toISOString();
  // Migration 0039 atomically updates site/product PV and minute UV on insertion.
  // A duplicate does nothing; failure anywhere in the trigger rolls back all rows.
  await context.env.DB.prepare(
    `INSERT INTO traffic_event_dedup
    (environment, visitor_digest, event_id, bucket, product_id, release_id, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (environment, visitor_digest, event_id) DO NOTHING`,
  )
    .bind(
      context.env.ENVIRONMENT,
      visitorDigest,
      input.eventId,
      bucket,
      input.productId ?? "",
      input.releaseId,
      now + 2 * 60 * 60 * 1000,
    )
    .run();
}
export async function cleanupTraffic(db: D1Database, now = Date.now()): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM traffic_event_dedup WHERE rowid IN
    (SELECT rowid FROM traffic_event_dedup WHERE expires_at <= ? ORDER BY expires_at LIMIT 500)`,
    )
    .bind(now)
    .run();
  return result.meta.changes;
}
