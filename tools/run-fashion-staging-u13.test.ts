import { describe, expect, test } from "bun:test";

import {
  loadFashionStagingU13Config,
  runFashionStagingU13,
  type FashionStagingU13Config,
  type FashionStagingU13Fetch,
} from "./run-fashion-staging-u13";

const identity = {
  catalogReleaseId: "release-fashion-u13",
  experienceSnapshotId: "snapshot-fashion-u13",
  experienceVersion: 7,
  platformContractVersion: "1.0.0",
  themeId: "fashion-store",
  themeVersion: "1.0.0",
} as const;

const config: FashionStagingU13Config = {
  authorityOrigin: "https://fashion-api.example.test",
  buildId: "preview-build-fashion-u13-1",
  currency: "USD",
  expectedInputIdentity: identity,
  handoffOrigin: "https://fashion-admin.example.test",
  previewOrigin: "https://fashion-preview.example.test",
  productId: "product-fashion-u13",
  runId: "run-101-attempt-1",
  serviceToken: "s".repeat(40),
  variantId: "variant-fashion-u13",
};

function response(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json", ...headers },
    status,
  });
}

function successfulFetch(requests: Request[], cartId = "cart-u13-fresh"): FashionStagingU13Fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request);
    const url = new URL(request.url);
    if (url.pathname.includes("/admin/storefront-experiences/builds/")) {
      return response({
        id: config.buildId,
        inputIdentity: identity,
        snapshotId: identity.experienceSnapshotId,
        status: "deployed",
      });
    }
    if (url.pathname.endsWith("/grants")) {
      return response(
        {
          grant: "g".repeat(40),
          inputIdentity: identity,
          redeemUrl: `${config.previewOrigin}/__preview/session`,
          snapshotId: identity.experienceSnapshotId,
        },
        201,
      );
    }
    if (url.pathname === "/__preview/session") {
      return new Response(null, {
        headers: {
          Location: "/",
          "Set-Cookie": `__Host-shoppp-preview=${"p".repeat(40)}; Path=/; Secure; HttpOnly; SameSite=Strict`,
        },
        status: 303,
      });
    }
    if (url.pathname === "/") {
      return new Response(
        `<aside>Catalog ${identity.catalogReleaseId} &middot; Experience ${identity.experienceSnapshotId} v<!-- -->${identity.experienceVersion} &middot; Theme ${identity.themeId} ${identity.themeVersion} &middot; Platform ${identity.platformContractVersion}</aside>`,
        { status: 200 },
      );
    }
    if (url.pathname.includes("/catalog/products/by-id/")) {
      return response({
        id: config.productId,
        variants: [{ id: config.variantId }],
      });
    }
    if (url.pathname === "/api/cart" && request.method === "POST") {
      return response({ cart: { id: cartId, lines: [] }, token: "c".repeat(40) }, 201);
    }
    if (url.pathname === "/api/cart/lines") {
      return response({
        id: cartId,
        lines: [{ quantity: 1, variantId: config.variantId }],
      });
    }
    return new Response("unexpected request", { status: 500 });
  }) as FashionStagingU13Fetch;
}

describe("Fashion staging U13 runner", () => {
  test("rejects incomplete protected-environment configuration before network access", () => {
    const base = {
      FASHION_U13_AUTHORITY_ORIGIN: config.authorityOrigin,
      FASHION_U13_BUILD_ID: config.buildId,
      FASHION_U13_CATALOG_RELEASE_ID: identity.catalogReleaseId,
      FASHION_U13_CURRENCY: config.currency,
      FASHION_U13_EXPERIENCE_VERSION: String(identity.experienceVersion),
      FASHION_U13_HANDOFF_ORIGIN: config.handoffOrigin,
      FASHION_U13_PLATFORM_CONTRACT_VERSION: identity.platformContractVersion,
      FASHION_U13_PREVIEW_ORIGIN: config.previewOrigin,
      FASHION_U13_PRODUCT_ID: config.productId,
      FASHION_U13_RUN_ID: config.runId,
      FASHION_U13_SERVICE_TOKEN: config.serviceToken,
      FASHION_U13_SNAPSHOT_ID: identity.experienceSnapshotId,
      FASHION_U13_THEME_ID: identity.themeId,
      FASHION_U13_THEME_VERSION: identity.themeVersion,
      FASHION_U13_VARIANT_ID: config.variantId,
    };

    for (const name of [
      "FASHION_U13_PREVIEW_ORIGIN",
      "FASHION_U13_CATALOG_RELEASE_ID",
      "FASHION_U13_VARIANT_ID",
      "FASHION_U13_SERVICE_TOKEN",
    ] as const) {
      expect(() => loadFashionStagingU13Config({ ...base, [name]: "" })).toThrow(name);
    }
    expect(() =>
      loadFashionStagingU13Config({
        ...base,
        FASHION_U13_PREVIEW_ORIGIN: "http://fashion-preview.example.test",
      }),
    ).toThrow(/HTTPS origin/);
  });

  test("fails closed when the automation principal cannot issue the exact grant", async () => {
    const requests: Request[] = [];
    await expect(
      runFashionStagingU13(config, async (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        if (new URL(request.url).pathname.includes("/admin/storefront-experiences/builds/")) {
          return response({
            id: config.buildId,
            inputIdentity: identity,
            snapshotId: identity.experienceSnapshotId,
            status: "deployed",
          });
        }
        return response({ code: "permission_denied" }, 403);
      }),
    ).rejects.toThrow(/grant.*403/i);
    expect(requests).toHaveLength(2);
    expect(
      requests.every(
        (request) => request.headers.get("Authorization") === `Bearer ${config.serviceToken}`,
      ),
    ).toBe(true);
  });

  test("proves the exact visible tuple before a fresh private-origin cart mutation", async () => {
    const requests: Request[] = [];
    const report = await runFashionStagingU13(config, successfulFetch(requests));

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      `/admin/storefront-experiences/builds/${config.buildId}`,
      `/admin/storefront-experiences/snapshots/${identity.experienceSnapshotId}/grants`,
      "/__preview/session",
      "/",
      `/api/catalog/products/by-id/${config.productId}/live`,
      "/api/cart",
      "/api/cart/lines",
    ]);
    expect(await requests[1]!.json()).toEqual({
      catalogReleaseId: identity.catalogReleaseId,
      origin: config.previewOrigin,
      reason: `Fashion staging U13 ${config.runId}`,
    });
    expect(requests[2]!.headers.get("Origin")).toBe(config.handoffOrigin);
    expect(
      requests
        .slice(3)
        .every((request) => request.headers.get("Cookie")?.includes("__Host-shoppp-preview=")),
    ).toBe(true);
    expect(requests[5]!.headers.get("Idempotency-Key")).toBe(`fashion-u13-cart-${config.runId}`);
    expect(requests[6]!.headers.get("Authorization")).toBe(`CartToken ${"c".repeat(40)}`);
    expect(requests[6]!.headers.get("Idempotency-Key")).toBe(`fashion-u13-line-${config.runId}`);
    expect(await requests[6]!.json()).toEqual({
      quantity: 1,
      releaseId: identity.catalogReleaseId,
      variantId: config.variantId,
    });
    expect(report).toEqual({
      buildId: config.buildId,
      cartId: "cart-u13-fresh",
      inputIdentity: identity,
      passed: true,
      previewOrigin: config.previewOrigin,
      previewOriginClassification: "fashion-staging-private",
      productId: config.productId,
      runId: config.runId,
      variantId: config.variantId,
    });
  });

  test("stops before cart creation when the authorized tuple is not exact", async () => {
    const requests: Request[] = [];
    const fetcher = successfulFetch(requests);
    await expect(
      runFashionStagingU13(
        {
          ...config,
          expectedInputIdentity: { ...identity, themeVersion: "2.0.0" },
        },
        fetcher,
      ),
    ).rejects.toThrow(/input identity/i);
    expect(requests).toHaveLength(1);
  });

  test("fails acceptance when the private Commerce bridge cannot add the exact line", async () => {
    const requests: Request[] = [];
    const base = successfulFetch(requests);
    await expect(
      runFashionStagingU13(config, async (input, init) => {
        if (new URL(input instanceof Request ? input.url : input).pathname === "/api/cart/lines") {
          requests.push(new Request(input, init));
          return response({ code: "commerce_unavailable" }, 503);
        }
        return base(input, init);
      }),
    ).rejects.toThrow(/cart line add.*503/i);
    expect(requests).toHaveLength(7);
  });

  test("retries under a new run ID with fresh cart evidence and no recovery state", async () => {
    const firstRequests: Request[] = [];
    const secondRequests: Request[] = [];
    const first = await runFashionStagingU13(config, successfulFetch(firstRequests, "cart-first"));
    const second = await runFashionStagingU13(
      { ...config, runId: "run-102-attempt-1" },
      successfulFetch(secondRequests, "cart-second"),
    );

    expect(first.cartId).toBe("cart-first");
    expect(second.cartId).toBe("cart-second");
    expect(firstRequests[5]!.headers.get("Idempotency-Key")).toBe(
      "fashion-u13-cart-run-101-attempt-1",
    );
    expect(secondRequests[5]!.headers.get("Idempotency-Key")).toBe(
      "fashion-u13-cart-run-102-attempt-1",
    );
  });
});
