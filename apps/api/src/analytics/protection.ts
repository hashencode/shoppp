import type { Context, MiddlewareHandler } from "hono";
import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { sha256Hex } from "../orders/tokens";

async function enforceQuota(context: Context<ApiEnvironment>, key: string): Promise<void> {
  const limiter = context.env.TRAFFIC_RATE_LIMITER;
  if (!limiter) {
    if (context.env.ENVIRONMENT !== "development") {
      throw new ApiError(
        503,
        "traffic_rate_limit_unavailable",
        "Traffic collection is unavailable.",
      );
    }
    return;
  }
  if (!(await limiter.limit({ key })).success) {
    context.header("Retry-After", "60");
    throw new ApiError(429, "traffic_rate_limited", "Too many traffic requests.");
  }
}
export async function enforceTrafficVisitorQuota(
  context: Context<ApiEnvironment>,
  digest: string,
): Promise<void> {
  await enforceQuota(context, `traffic:visitor:${context.env.ENVIRONMENT}:${digest}`);
}
export function protectTraffic(): MiddlewareHandler<ApiEnvironment> {
  return async (context, next) => {
    context.header("Cache-Control", "no-store");
    if (context.env.TRAFFIC_ENABLED !== "true") {
      throw new ApiError(503, "traffic_disabled", "Traffic collection is unavailable.");
    }
    const origin = context.req.header("Origin");
    if (
      origin !== new URL(context.env.STOREFRONT_ORIGIN).origin ||
      origin === new URL(context.env.PREVIEW_ORIGIN).origin ||
      /(?:^|;\s*)__Host-shoppp-preview=/.test(context.req.header("Cookie") ?? "")
    ) {
      throw new ApiError(
        403,
        "traffic_origin_forbidden",
        "Traffic collection is unavailable for this source.",
      );
    }
    const tooLarge = () =>
      new ApiError(413, "traffic_body_too_large", "Traffic request is too large.");
    if (Number(context.req.header("Content-Length") ?? "0") > 4096) throw tooLarge();
    const reader = context.req.raw.clone().body?.getReader();
    if (reader) {
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 4096) throw tooLarge();
        }
      } finally {
        void reader.cancel();
        reader.releaseLock();
      }
    }
    // Cloudflare supplies this at the trusted edge. Never key on a user-chosen
    // Authorization value, cookie, event ID or forwarded-for header.
    const source = context.req.header("CF-Connecting-IP");
    if (!source && context.env.ENVIRONMENT !== "development") {
      throw new ApiError(403, "traffic_source_unavailable", "Traffic source is unavailable.");
    }
    const sourceDigest = await sha256Hex(source ?? "local-development");
    await enforceQuota(context, `traffic:source:${context.env.ENVIRONMENT}:${sourceDigest}`);
    await next();
  };
}
