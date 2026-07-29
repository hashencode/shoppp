import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";

export interface RateLimiter {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforceCheckoutRateLimit(
  context: Context<ApiEnvironment>,
  limiter: RateLimiter | undefined,
): Promise<void> {
  if (!limiter) return;
  const credential =
    context.req.header("authorization") ?? context.req.header("cf-connecting-ip") ?? "anonymous";
  const actorKey = await sha256(credential);
  const result = await limiter.limit({ key: `checkout:${actorKey}` });
  if (!result.success) {
    context.header("Retry-After", "60");
    throw new ApiError(
      429,
      "checkout_rate_limited",
      "Too many checkout attempts. Wait before trying again.",
    );
  }
}
