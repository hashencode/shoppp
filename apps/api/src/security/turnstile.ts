import type { Context } from "hono";

import type { ApiEnvironment } from "../http/context";
import { ApiError } from "../http/errors";

export interface TurnstileVerification {
  readonly errorCodes?: readonly string[];
  readonly success: boolean;
}

export interface TurnstileVerificationInput {
  readonly action: string;
  readonly expectedHostnames: readonly string[];
  readonly idempotencyKey: string;
  readonly remoteIp?: string;
  readonly secret: string;
  readonly token: string;
}

export type TurnstileVerifier = (
  input: TurnstileVerificationInput,
) => Promise<TurnstileVerification>;

interface SiteverifyResponse {
  action?: string;
  "error-codes"?: string[];
  hostname?: string;
  success?: boolean;
}

export const verifyTurnstile: TurnstileVerifier = async (input) => {
  const body = new URLSearchParams({
    action: input.action,
    idempotency_key: input.idempotencyKey,
    secret: input.secret,
    response: input.token,
    ...(input.remoteIp ? { remoteip: input.remoteIp } : {}),
  });
  let response: Response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { errorCodes: ["siteverify_unavailable"], success: false };
  }
  if (!response.ok) {
    return { errorCodes: ["siteverify_unavailable"], success: false };
  }
  const result = (await response.json()) as SiteverifyResponse;
  const valid =
    result.success === true &&
    result.action === input.action &&
    typeof result.hostname === "string" &&
    input.expectedHostnames.includes(result.hostname);
  return {
    ...(result["error-codes"] ? { errorCodes: result["error-codes"] } : {}),
    success: valid,
  };
};

function required(context: Context<ApiEnvironment>, override?: boolean): boolean {
  return override ?? context.env.TURNSTILE_REQUIRED === "true";
}

export async function enforceTurnstile(
  context: Context<ApiEnvironment>,
  options: {
    required?: boolean;
    verifier?: TurnstileVerifier;
  },
): Promise<void> {
  if (!required(context, options.required)) return;
  const token = context.req.header("X-Turnstile-Token")?.trim() ?? "";
  const secret = context.env.TURNSTILE_SECRET?.trim() ?? "";
  const expectedHostnames = (context.env.TURNSTILE_HOSTNAMES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    !token ||
    token.length > 2_048 ||
    (!options.verifier && (!secret || expectedHostnames.length === 0))
  ) {
    throw new ApiError(403, "turnstile_required", "Complete the security check before continuing.");
  }
  const remoteIp = context.req.header("CF-Connecting-IP");
  const result = await (options.verifier ?? verifyTurnstile)({
    action: "checkout",
    expectedHostnames:
      expectedHostnames.length > 0
        ? expectedHostnames
        : [new URL(context.env.STOREFRONT_ORIGIN).hostname],
    idempotencyKey: crypto.randomUUID(),
    ...(remoteIp ? { remoteIp } : {}),
    secret: secret || "test-verifier-secret",
    token,
  });
  if (!result.success) {
    throw new ApiError(
      403,
      result.errorCodes?.includes("timeout-or-duplicate")
        ? "turnstile_reused"
        : "turnstile_invalid",
      "The security check is invalid or expired. Try again.",
    );
  }
}
