import type { MiddlewareHandler } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";
import { enforceCheckoutRateLimit, enforceReviewRateLimit, type RateLimiter } from "./rate-limit";
import { enforceTurnstile, type TurnstileVerifier } from "./turnstile";

const MAX_CHECKOUT_BODY_BYTES = 32 * 1_024;

export function protectCheckoutSubmission(options: {
  readonly rateLimiter?: RateLimiter;
  readonly turnstileRequired?: boolean;
  readonly turnstileVerifier?: TurnstileVerifier;
}): MiddlewareHandler<ApiEnvironment> {
  return async (context, next) => {
    const origin = context.req.header("Origin");
    if (origin && origin !== new URL(context.env.STOREFRONT_ORIGIN).origin) {
      throw new ApiError(403, "origin_forbidden", "The request origin is not allowed.");
    }
    const declaredLength = Number(context.req.header("Content-Length") ?? "0");
    if (
      (Number.isFinite(declaredLength) && declaredLength > MAX_CHECKOUT_BODY_BYTES) ||
      (await context.req.raw.clone().arrayBuffer()).byteLength > MAX_CHECKOUT_BODY_BYTES
    ) {
      throw new ApiError(413, "checkout_payload_too_large", "The checkout request is too large.");
    }
    await enforceCheckoutRateLimit(
      context,
      options.rateLimiter ?? context.env.CHECKOUT_RATE_LIMITER,
    );
    await enforceTurnstile(context, {
      ...(options.turnstileRequired === undefined ? {} : { required: options.turnstileRequired }),
      ...(options.turnstileVerifier ? { verifier: options.turnstileVerifier } : {}),
    });
    await next();
  };
}

export function protectReviewSubmission(options: {
  readonly rateLimiter?: RateLimiter;
}): MiddlewareHandler<ApiEnvironment> {
  return async (context, next) => {
    if (context.req.header("Origin") !== new URL(context.env.STOREFRONT_ORIGIN).origin) {
      throw new ApiError(403, "origin_forbidden", "The request origin is not allowed.");
    }
    const declaredLength = Number(context.req.header("Content-Length") ?? "0");
    if (
      (Number.isFinite(declaredLength) && declaredLength > 8 * 1_024) ||
      (await context.req.raw.clone().arrayBuffer()).byteLength > 8 * 1_024
    ) {
      throw new ApiError(413, "review_payload_too_large", "The review request is too large.");
    }
    await enforceReviewRateLimit(context, options.rateLimiter ?? context.env.CHECKOUT_RATE_LIMITER);
    await next();
  };
}
