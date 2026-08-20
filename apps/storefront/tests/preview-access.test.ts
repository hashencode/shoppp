import { describe, expect, test } from "bun:test";

import {
  createPreviewAccessHandler,
  normalizePreviewAssetPath,
  type PreviewAccessEnvironment,
} from "../worker/preview-access";

const PREVIEW_ORIGIN = "https://preview.example.test";
const SESSION = "session_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CATALOG_RELEASE_ID = "release-fashion-2026";

function environment(
  options: {
    auth?: PreviewAccessEnvironment["PREVIEW_AUTH"];
    commerce?: PreviewAccessEnvironment["COMMERCE_API"];
    themeId?: string;
  } = {},
): PreviewAccessEnvironment {
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
            previewContext: {
              contentDigest: "c".repeat(64),
              environment: "private-preview",
              expiresAt: "2099-08-12T00:00:00.000Z",
              generatedAt: "2026-08-14T08:00:00.000Z",
              returnUrl: "https://admin.example.test/storefront/themes/draft-fashion-1",
              snapshotId: "snapshot-fashion-1",
            },
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
  test("exposes authenticated, non-cacheable preview context without reading artifact files", async () => {
    const response = await createPreviewAccessHandler()(
      apiRequest("/__preview/context"),
      environment(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      contentDigest: "c".repeat(64),
      environment: "private-preview",
      expiresAt: "2099-08-12T00:00:00.000Z",
      generatedAt: "2026-08-14T08:00:00.000Z",
      returnUrl: "https://admin.example.test/storefront/themes/draft-fashion-1",
      snapshotId: "snapshot-fashion-1",
    });
  });

  test("authorizes and forwards an admitted cart mutation with rebuilt headers", async () => {
    const commerceRequests: Request[] = [];
    const handler = createPreviewAccessHandler();
    const response = await handler(
      apiRequest("/api/cart/lines", {
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
    expect(forwarded.url).toBe("https://commerce.internal/cart/lines");
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

    const missingSession = await handler(new Request(`${PREVIEW_ORIGIN}/api/cart`), env);
    expect(missingSession.status).toBe(401);
    expect(authorizationCalls).toBe(0);

    const unlisted = await handler(apiRequest("/api/admin/orders", { method: "POST" }), env);
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

  test("admits the complete checkout bridge while forwarding Turnstile only to checkout", async () => {
    const requests: Request[] = [];
    const env = environment({
      commerce: {
        fetch: async (request) => {
          requests.push(request);
          return Response.json({ data: { ok: true } });
        },
      },
    });
    const cartToken = `CartToken ${"c".repeat(40)}`;
    const mutation = (path: string, method: string) =>
      createPreviewAccessHandler()(
        apiRequest(`/api${path}`, {
          body: JSON.stringify({ accepted: true }),
          headers: {
            Authorization: cartToken,
            "Content-Type": "application/json",
            "Idempotency-Key": `fashion-u12-${path.replaceAll("/", "-")}`,
            Origin: PREVIEW_ORIGIN,
            "X-Turnstile-Token": "turnstile.accepted-token_1",
          },
          method,
        }),
        env,
      );

    for (const [path, method] of [
      ["/cart/adjustments/acknowledge", "POST"],
      ["/cart/reservations", "POST"],
      ["/checkout/sessions", "POST"],
    ] as const) {
      expect((await mutation(path, method)).status).toBe(200);
    }
    expect(
      (
        await createPreviewAccessHandler()(
          apiRequest(`/api/orders/${"o".repeat(40)}`, {
            headers: {
              Authorization: cartToken,
              "Content-Type": "application/json",
              "Idempotency-Key": "must-not-cross-on-order-read",
            },
          }),
          env,
        )
      ).status,
    ).toBe(200);
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/cart/adjustments/acknowledge",
      "/cart/reservations",
      "/checkout/sessions",
      `/orders/${"o".repeat(40)}`,
    ]);
    expect(requests[0]!.headers.get("X-Turnstile-Token")).toBeNull();
    expect(requests[1]!.headers.get("X-Turnstile-Token")).toBeNull();
    expect(requests[2]!.headers.get("X-Turnstile-Token")).toBe("turnstile.accepted-token_1");
    expect(requests[3]!.headers.get("Authorization")).toBeNull();
    expect(requests[3]!.headers.get("Content-Type")).toBeNull();
    expect(requests[3]!.headers.get("Idempotency-Key")).toBeNull();
  });

  test("rejects unexpected query state and oversized bodies before Commerce", async () => {
    let commerceCalls = 0;
    const env = environment({
      commerce: {
        fetch: async () => {
          commerceCalls += 1;
          return Response.json({});
        },
      },
    });
    const invalidQuery = await createPreviewAccessHandler()(
      apiRequest("/api/cart?admin=true"),
      env,
    );
    expect(invalidQuery.status).toBe(400);
    const invalidCurrency = await createPreviewAccessHandler()(
      apiRequest("/api/catalog/products/shirt/live?currency=usd"),
      env,
    );
    expect(invalidCurrency.status).toBe(400);
    const oversized = await createPreviewAccessHandler()(
      apiRequest("/api/checkout/sessions", {
        body: "x".repeat(64 * 1024 + 1),
        headers: { "Content-Type": "application/json", Origin: PREVIEW_ORIGIN },
        method: "POST",
      }),
      env,
    );
    expect(oversized.status).toBe(413);
    expect(commerceCalls).toBe(0);
  });

  test("serves root and extensionless route artifacts with only the exact Turnstile origins", async () => {
    expect(normalizePreviewAssetPath("/_headers")).toBe("_headers");
    const env = environment();
    const artifactKeys: string[] = [];
    const inlineScript = "window.__NUXT__ = { hydrated: true };";
    env.PREVIEW_ARTIFACTS.get = async (key) => {
      artifactKeys.push(key);
      return {
        body: `<!doctype html><script>${inlineScript}</script><script src="/_nuxt/entry.js"></script>`,
        httpMetadata: { contentType: "text/html; charset=utf-8" },
      };
    };
    const response = await createPreviewAccessHandler()(apiRequest("/"), env);
    const product = await createPreviewAccessHandler()(apiRequest("/products/atlas-carry-on"), env);
    const policy = response.headers.get("Content-Security-Policy") ?? "";
    expect(response.status).toBe(200);
    expect(product.status).toBe(200);
    expect(artifactKeys).toEqual([
      `snapshots/snapshot-fashion-1/${CATALOG_RELEASE_ID}/${"a".repeat(64)}/index.html`,
      `snapshots/snapshot-fashion-1/${CATALOG_RELEASE_ID}/${"a".repeat(64)}/products/atlas-carry-on/index.html`,
    ]);
    expect(policy).toContain(`script-src ${PREVIEW_ORIGIN} https://challenges.cloudflare.com`);
    const inlineDigest = btoa(
      String.fromCharCode(
        ...new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inlineScript)),
        ),
      ),
    );
    expect(policy).toContain(`'sha256-${inlineDigest}'`);
    const emptyScriptDigest = btoa(
      String.fromCharCode(
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(""))),
      ),
    );
    expect(policy).not.toContain(`'sha256-${emptyScriptDigest}'`);
    expect(policy.match(/script-src [^;]+/)?.[0]).not.toContain("'unsafe-inline'");
    expect(policy).toContain("frame-src https://challenges.cloudflare.com");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("form-action 'none'");
    expect(policy).not.toContain("*");
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
