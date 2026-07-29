import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createApp } from "../../src/http/app";

const request = (path: string, init: RequestInit = {}) =>
  new Request(`https://api.example.test${path}`, {
    ...init,
    headers: {
      Authorization: "CartToken opaque-cart-token",
      "Content-Type": "application/json",
      "Idempotency-Key": "security-boundary-key-001",
      Origin: env.STOREFRONT_ORIGIN,
      "X-Turnstile-Token": "valid-turnstile-token",
      ...init.headers,
    },
  });

describe("public submission trust boundaries", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM idempotency_claims").run();
  });

  test("rejects forged origins, oversized bodies, and missing or reused Turnstile tokens", async () => {
    const verifier = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ errorCodes: ["timeout-or-duplicate"], success: false });
    const app = createApp({
      checkoutRateLimiter: { limit: vi.fn(async () => ({ success: true })) },
      turnstileRequired: true,
      turnstileVerifier: verifier,
    });
    const body = JSON.stringify({ invalid: true });

    expect(
      (
        await app.fetch(
          request("/checkout/sessions", {
            body,
            headers: { Origin: "https://forged.example.test" },
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await app.fetch(
          request("/checkout/sessions", {
            body,
            headers: { "Content-Length": "40000" },
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(413);
    expect(
      (
        await app.fetch(
          request("/checkout/sessions", {
            body,
            headers: { "X-Turnstile-Token": "" },
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await app.fetch(
          request("/checkout/sessions", {
            body,
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await app.fetch(
          request("/checkout/sessions", {
            body,
            method: "POST",
          }),
          env,
        )
      ).status,
    ).toBe(403);
  });

  test("limits abusive checkout bursts without applying the limiter to catalog reads", async () => {
    const limiter = {
      limit: vi
        .fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false }),
    };
    const app = createApp({
      checkoutRateLimiter: limiter,
      turnstileRequired: false,
    });
    const body = JSON.stringify({ invalid: true });
    expect(
      (await app.fetch(request("/checkout/sessions", { body, method: "POST" }), env)).status,
    ).toBe(401);
    const limited = await app.fetch(
      request("/checkout/sessions", {
        body,
        headers: { "Idempotency-Key": "security-boundary-key-002" },
        method: "POST",
      }),
      env,
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    const callsBeforeCatalog = limiter.limit.mock.calls.length;
    await app.fetch(request("/catalog/products/missing/live?currency=USD"), env);
    expect(limiter.limit).toHaveBeenCalledTimes(callsBeforeCatalog);
  });
});
