import type { MiddlewareHandler } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { enforceAnalyticsRateLimit, type RateLimiter } from "./rate-limit";

const MAX_ANALYTICS_BODY_BYTES = 1_024;

export function protectAnalyticsSubmission(
  options: {
    readonly rateLimiter?: RateLimiter;
  } = {},
): MiddlewareHandler<ApiEnvironment> {
  return async (context, next) => {
    const origin = context.req.header("Origin");
    if (origin !== new URL(context.env.STOREFRONT_ORIGIN).origin) {
      throw new ApiError(403, "origin_forbidden", "The request origin is not allowed.");
    }
    const declaredLength = Number(context.req.header("Content-Length") ?? "0");
    if (
      (Number.isFinite(declaredLength) && declaredLength > MAX_ANALYTICS_BODY_BYTES) ||
      (await context.req.raw.clone().arrayBuffer()).byteLength > MAX_ANALYTICS_BODY_BYTES
    ) {
      throw new ApiError(413, "analytics_payload_too_large", "The analytics request is too large.");
    }
    await enforceAnalyticsRateLimit(
      context,
      options.rateLimiter ?? context.env.ANALYTICS_RATE_LIMITER,
    );
    await next();
  };
}
