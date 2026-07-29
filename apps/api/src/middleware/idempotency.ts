import type { MiddlewareHandler } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function idempotency(scope: string): MiddlewareHandler<ApiEnvironment> {
  return async (context, next) => {
    const key = context.req.header("Idempotency-Key");
    if (!key || key.length < 16 || key.length > 160) {
      throw new ApiError(
        400,
        "invalid_idempotency_key",
        "A 16-160 character Idempotency-Key is required.",
      );
    }
    const body = await context.req.raw.clone().text();
    const requestHash = await sha256(`${context.req.method}:${context.req.path}:${body}`);
    const claimId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString();
    const inserted = await context.env.DB.prepare(
      `INSERT OR IGNORE INTO idempotency_claims
         (id, scope, key, request_hash, state, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'processing', ?, ?, ?)`,
    )
      .bind(claimId, scope, key, requestHash, expiresAt, now.toISOString(), now.toISOString())
      .run();

    if (inserted.meta.changes === 0) {
      const existing = await context.env.DB.prepare(
        "SELECT request_hash, response_status, response_body_json, state FROM idempotency_claims WHERE scope = ? AND key = ?",
      )
        .bind(scope, key)
        .first<{
          request_hash: string;
          response_body_json: string | null;
          response_status: number | null;
          state: string;
        }>();
      if (!existing) {
        throw new ApiError(409, "idempotency_unavailable", "Idempotency claim is unavailable.");
      }
      if (existing.request_hash !== requestHash) {
        throw new ApiError(
          409,
          "idempotency_payload_mismatch",
          "This idempotency key was already used with a different request.",
        );
      }
      if (
        existing.state === "completed" &&
        existing.response_status !== null &&
        existing.response_body_json !== null
      ) {
        context.res = new Response(existing.response_body_json, {
          headers: { "Content-Type": "application/json" },
          status: existing.response_status,
        });
        return;
      }
      throw new ApiError(
        409,
        "idempotency_in_progress",
        "A request with this idempotency key is still processing.",
      );
    }

    await next();
    const responseBody = await context.res.clone().text();
    if (context.res.status < 500) {
      await context.env.DB.prepare(
        `UPDATE idempotency_claims
         SET response_status = ?, response_body_json = ?, state = 'completed', updated_at = ?
         WHERE id = ?`,
      )
        .bind(context.res.status, responseBody, new Date().toISOString(), claimId)
        .run();
    }
  };
}
