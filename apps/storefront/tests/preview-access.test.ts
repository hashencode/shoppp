import { describe, expect, test } from "bun:test";

import {
  createPreviewAccessHandler,
  type PreviewAccessEnvironment,
} from "../worker/preview-access";

const PREVIEW_ORIGIN = "https://preview.example.test";
const SESSION = "session_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CATALOG_RELEASE_ID = "release-fashion-2026";

function environment(options: {
  auth?: PreviewAccessEnvironment["PREVIEW_AUTH"];
  commerce?: PreviewAccessEnvironment["COMMERCE_API"];
  themeId?: string;
} = {}): PreviewAccessEnvironment {
  return {
    COMMERCE_API:
      options.commerce ??
      ({
        fetch: async () => Response.json({ data: { ok: true } }),
      } satisfies PreviewAccessEnvironment["COMMERCE_API"]),
    PREVIEW_ARTIFACTS: {
      get: async () => null,
      head: async () => null,
      put: async () => undefined,
    },
    PREVIEW_AUTH:
      options.auth ??
      ({
        fetch: async () =>
          Response.json({
            artifactPrefix: `snapshots/snapshot-fashion-1/${CATALOG_RELEASE_ID}/${"a".repeat(64)}`,
            authorized: true,
            expiresAt: "2099-08-12T00:00:00.000Z",
            inputIdentity: {
              catalogReleaseId: CATALOG_RELEASE_ID,
              experienceSnapshotId: "snapshot-fashion-1",
              experienceVersion: 4,
              platformContractVersion: "1.0.0",
              themeId: options.themeId ?? "fashion-store",
              themeVersion: "1.0.0",
            },
            origin: PREVIEW_ORIGIN,
          }),
      } satisfies PreviewAccessEnvironment["PREVIEW_AUTH"]),
    PREVIEW_AUTH_TOKEN: "preview-auth-token-000000000000000001",
    PREVIEW_HANDOFF_ORIGIN: "https://admin.example.test",
    PREVIEW_ORIGIN,
  };
}

function apiRequest(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `__Host-shoppp-preview=${SESSION}; analytics=browser-only`);
  return new Request(`${PREVIEW_ORIGIN}${path}`, { ...init, headers });
}

describe("private Preview Commerce bridge", () => {
  test("authorizes and forwards an admitted cart mutation with rebuilt headers", async () => {
    const commerceRequests: Request[] = [];
    const handler = createPreviewAccessHandler();
    const response = await handler(
      apiRequest("/api/cart/lines?currency=USD", {
        body: JSON.stringify({ quantity: 1, variantId: "var_01J00000000000000000000001" }),
        headers: {
          Authorization: `CartToken ${"c".repeat(40)}`,
          "Content-Type": "application/json",
          Cookie: "browser-cookie=must-not-cross",
          Host: "attacker.example.test",
          "Idempotency-Key": "cart-add-0123456789abcdef",
          Origin: PREVIEW_ORIGIN,
          "X-Forwarded-For": "203.0.113.10",
          "X-Preview-Catalog-Release": "release-browser-substitution",
          "X-Request-Id": "request-fashion-1",
        },
        method: "POST",
      }),
      environment({
        commerce: {
          fetch: async (request) => {
            commerceRequests.push(request);
            return new Response(JSON.stringify({ data: { ok: true } }), {
              headers: {
                "Access-Control-Allow-Origin": "https://other.example.test",
                "Content-Security-Policy": "default-src *",
                "Content-Type": "application/json",
                "Set-Cookie": "upstream=secret",
                "X-Request-Id": "request-commerce-1",
              },
              status: 201,
            });
          },
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("X-Request-Id")).toBe("request-commerce-1");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(commerceRequests).toHaveLength(1);
    const forwarded = commerceRequests[0]!;
    expect(forwarded.url).toBe("https://commerce.internal/cart/lines?currency=USD");
    expect(forwarded.redirect).toBe("manual");
    expect(forwarded.headers.get("Authorization")).toBe(`CartToken ${"c".repeat(40)}`);
    expect(forwarded.headers.get("Content-Type")).toBe("application/json");
    expect(forwarded.headers.get("Idempotency-Key")).toBe("cart-add-0123456789abcdef");
    expect(forwarded.headers.get("Origin")).toBe(PREVIEW_ORIGIN);
    expect(forwarded.headers.get("X-Preview-Catalog-Release")).toBe(CATALOG_RELEASE_ID);
    expect(forwarded.headers.get("Cookie")).toBeNull();
    expect(forwarded.headers.get("X-Forwarded-For")).toBeNull();
    expect(await forwarded.json()).toEqual({
      quantity: 1,
      variantId: "var_01J00000000000000000000001",
    });
  });

  test("requires a valid session and denies unlisted or cross-origin mutations before Commerce", async () => {
    let authorizationCalls = 0;
    let commerceCalls = 0;
    const env = environment({
      auth: {
        fetch: async () => {
          authorizationCalls += 1;
          return environment().PREVIEW_AUTH.fetch(new Request(PREVIEW_ORIGIN));
        },
      },
      commerce: {
        fetch: async () => {
          commerceCalls += 1;
          return Response.json({});
        },
      },
    });
    const handler = createPreviewAccessHandler();

    const missingSession = await handler(
      new Request(`${PREVIEW_ORIGIN}/api/cart`),
      env,
    );
    expect(missingSession.status).toBe(401);
    expect(authorizationCalls).toBe(0);

    const unlisted = await handler(apiRequest("/api/checkout/sessions", { method: "POST" }), env);
    expect(unlisted.status).toBe(405);
    const wrongMethod = await handler(apiRequest("/api/cart/lines", { method: "PUT" }), env);
    expect(wrongMethod.status).toBe(405);
    const crossOrigin = await handler(
      apiRequest("/api/cart", {
        headers: { Origin: "https://attacker.example.test" },
        method: "POST",
      }),
      env,
    );
    expect(crossOrigin.status).toBe(403);
    const encoded = await handler(apiRequest("/api/cart/%252e%252e/orders"), env);
    expect(encoded.status).toBe(400);
    expect(authorizationCalls).toBe(4);
    expect(commerceCalls).toBe(0);
  });

  test("does not use theme identity to grant or deny an admitted action", async () => {
    const handler = createPreviewAccessHandler();
    for (const themeId of ["fashion-store", "decor-store", "component-composed-theme"]) {
      const response = await handler(apiRequest("/api/platform/config"), environment({ themeId }));
      expect(response.status).toBe(200);
    }
  });

  test("returns sanitized unavailable responses for binding failures and upstream redirects", async () => {
    const handler = createPreviewAccessHandler();
    const authUnavailable = await handler(
      apiRequest("/api/cart"),
      environment({
        auth: {
          fetch: async () => {
            throw new Error("private binding details");
          },
        },
      }),
    );
    expect(authUnavailable.status).toBe(503);
    expect(await authUnavailable.text()).not.toContain("private binding details");

    const commerceUnavailable = await handler(
      apiRequest("/api/cart"),
      environment({
        commerce: {
          fetch: async () => {
            throw new Error("upstream binding details");
          },
        },
      }),
    );
    expect(commerceUnavailable.status).toBe(503);
    expect(await commerceUnavailable.text()).not.toContain("upstream binding details");

    const redirect = await handler(
      apiRequest("/api/cart"),
      environment({
        commerce: {
          fetch: async () =>
            new Response(null, {
              headers: { Location: "https://attacker.example.test/collect" },
              status: 302,
            }),
        },
      }),
    );
    expect(redirect.status).toBe(502);
    expect(redirect.headers.get("Location")).toBeNull();
  });
});
