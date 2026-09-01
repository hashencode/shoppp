import { describe, expect, test } from "bun:test";

import {
  mapWithConcurrency,
  percentile95,
  runStagingLatencyProbe,
  type StagingLatencyConfig,
} from "./verify-staging-latency";

function stagingLatencyConfig(runId: string): StagingLatencyConfig {
  return {
    catalogReleaseId: "fashion-release",
    currency: "USD",
    previewCookie: "__Host-shoppp-preview=session-secret",
    previewOrigin: "https://shoppp-storefront-fashion-preview.example.com",
    productId: "product-stable",
    runId,
    sampleCount: 20,
    shippingConcurrency: 4,
    timeoutMs: 1_000,
  };
}

describe("staging latency verifier", () => {
  test("calculates p95 without treating the sample count as concurrency", () => {
    expect(percentile95(Array.from({ length: 20 }, (_, index) => index + 1))).toBe(19);
  });

  test("preserves result order while enforcing the configured concurrency", async () => {
    let active = 0;
    let maximumActive = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, value % 2 === 0 ? 2 : 1));
      active -= 1;
      return value * 2;
    });

    expect(maximumActive).toBe(3);
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  test("rejects invalid concurrency", async () => {
    await expect(mapWithConcurrency([1], 0, async (value) => value)).rejects.toThrow(
      "concurrency must be a positive integer",
    );
  });

  test("uses authenticated Preview APIs, excludes warmups, registers carts, and cleans up", async () => {
    const calls: { init: RequestInit | undefined; url: string }[] = [];
    let cartNumber = 0;
    const registered: string[] = [];
    let cleaned = false;
    const report = await runStagingLatencyProbe(
      stagingLatencyConfig("fashion-u8-run"),
      async (input, init) => {
        const url = String(input);
        calls.push({ init, url });
        if (url.endsWith("/api/cart") && init?.method === "POST") {
          cartNumber += 1;
          return Response.json({
            data: { cart: { id: `cart-${cartNumber}` }, token: `token-${cartNumber}` },
          });
        }
        return Response.json({ data: {} });
      },
      {
        cleanup: async () => {
          cleaned = true;
        },
        registerCart: async (cartId) => {
          registered.push(cartId);
        },
      },
      () => 1,
    );

    expect(report.sampleCount).toBe(20);
    expect(report.shippingConcurrency).toBe(4);
    expect(report.catalogDurationsMs).toHaveLength(20);
    expect(report.cartDurationsMs).toHaveLength(20);
    expect(report.shippingDurationsMs).toHaveLength(20);
    expect(registered).toHaveLength(21);
    expect(cleaned).toBe(true);
    expect(calls).toHaveLength(84);
    expect(
      calls.every(({ url }) =>
        url.startsWith("https://shoppp-storefront-fashion-preview.example.com/api/"),
      ),
    ).toBe(true);
    expect(
      calls.some(
        ({ init }) => init?.headers && JSON.stringify(init.headers).includes("session-secret"),
      ),
    ).toBe(true);
    expect(JSON.stringify(report)).not.toContain("session-secret");
    expect(JSON.stringify(report)).not.toContain("token-");
  });

  test("runs cleanup after a timed or unsuccessful sample without retrying", async () => {
    let calls = 0;
    let cleanupCount = 0;
    await expect(
      runStagingLatencyProbe(
        stagingLatencyConfig("fashion-u8-run"),
        async (input, init) => {
          calls += 1;
          if (String(input).endsWith("/api/cart") && init?.method === "POST") {
            return Response.json({
              data: { cart: { id: "cart-failure" }, token: "token-failure" },
            });
          }
          return new Response("downstream failed", { status: 503 });
        },
        {
          cleanup: async () => {
            cleanupCount += 1;
          },
          registerCart: async () => undefined,
        },
      ),
    ).rejects.toThrow(/catalog read failed with 503/);
    expect(calls).toBe(22);
    expect(cleanupCount).toBe(1);
  });

  test("uses authenticated bridge Commerce timing when the Preview response provides it", async () => {
    let cartNumber = 0;
    let wallClock = 0;
    const report = await runStagingLatencyProbe(
      stagingLatencyConfig("fashion-u8-bridge-timing"),
      async (input, init) => {
        const url = String(input);
        if (url.endsWith("/api/cart") && init?.method === "POST") {
          cartNumber += 1;
          return Response.json({
            data: { cart: { id: `cart-${cartNumber}` }, token: `token-${cartNumber}` },
          });
        }
        wallClock += 2_000;
        return Response.json(
          { data: {} },
          { headers: { "Server-Timing": "commerce;dur=125.500" } },
        );
      },
      { cleanup: async () => undefined, registerCart: async () => undefined },
      () => wallClock,
    );

    expect(report.catalogReadP95Ms).toBe(125.5);
    expect(report.cartReadP95Ms).toBe(125.5);
    expect(report.shippingMutationP95Ms).toBe(125.5);
  });

  test("waits through in-progress replay and registers the original cart after a lost response", async () => {
    const events: string[] = [];
    let cleanupCount = 0;
    let createCount = 0;
    await expect(
      runStagingLatencyProbe(
        stagingLatencyConfig("fashion-u8-lost-response"),
        async (_input, init) => {
          createCount += 1;
          const key = String(new Headers(init?.headers).get("Idempotency-Key"));
          events.push(`create:${key}`);
          if (createCount === 1) throw new Error("response lost after cart creation");
          if (createCount === 2) {
            return Response.json({ error: { code: "idempotency_in_progress" } }, { status: 409 });
          }
          return Response.json({
            data: { cart: { id: "cart-recovered" }, token: "token-recovered" },
          });
        },
        {
          cleanup: async () => {
            cleanupCount += 1;
          },
          registerCart: async (cartId) => {
            events.push(`register:${cartId}`);
          },
        },
      ),
    ).rejects.toThrow(/response lost after cart creation/);
    expect(events).toEqual([
      "create:fashion-u8-latency-cart-fashion-u8-lost-response-0",
      "create:fashion-u8-latency-cart-fashion-u8-lost-response-0",
      "create:fashion-u8-latency-cart-fashion-u8-lost-response-0",
      "register:cart-recovered",
    ]);
    expect(cleanupCount).toBe(1);
  });

  test("repeats an idempotent cart registration once for cleanup after its response is lost", async () => {
    let cleanupCount = 0;
    let registrationCount = 0;
    await expect(
      runStagingLatencyProbe(
        stagingLatencyConfig("fashion-u8-lost-registration"),
        async () =>
          Response.json({
            data: { cart: { id: "cart-registration-lost" }, token: "token-private" },
          }),
        {
          cleanup: async () => {
            cleanupCount += 1;
          },
          registerCart: async () => {
            registrationCount += 1;
            if (registrationCount === 1) throw new Error("registration response lost");
          },
        },
      ),
    ).rejects.toThrow(/registration response lost/);
    expect(registrationCount).toBe(2);
    expect(cleanupCount).toBe(1);
  });

  test("bounds in-progress cart recovery and still runs cleanup", async () => {
    let createCount = 0;
    let cleanupCount = 0;
    await expect(
      runStagingLatencyProbe(
        stagingLatencyConfig("fashion-u8-stuck-claim"),
        async () => {
          createCount += 1;
          if (createCount === 1) throw new Error("response lost after cart creation");
          return Response.json({ error: { code: "idempotency_in_progress" } }, { status: 409 });
        },
        {
          cleanup: async () => {
            cleanupCount += 1;
          },
          registerCart: async () => undefined,
        },
      ),
    ).rejects.toThrow(/cart creation and cleanup registration recovery both failed/);
    expect(createCount).toBe(4);
    expect(cleanupCount).toBe(1);
  });

  test("rejects read and shipping p95 values above their exact thresholds", async () => {
    const run = async (durations: { catalog: number; cart: number; shipping: number }) => {
      let clock = 0;
      let cartNumber = 0;
      let cleanupCount = 0;
      const promise = runStagingLatencyProbe(
        stagingLatencyConfig("fashion-u8-thresholds"),
        async (input, init) => {
          const url = String(input);
          if (url.endsWith("/api/cart") && init?.method === "POST") {
            cartNumber += 1;
            return Response.json({
              data: { cart: { id: `cart-${cartNumber}` }, token: `token-${cartNumber}` },
            });
          }
          clock += url.includes("/shipping")
            ? durations.shipping
            : url.includes("/catalog/")
              ? durations.catalog
              : durations.cart;
          return Response.json({ data: {} });
        },
        {
          cleanup: async () => {
            cleanupCount += 1;
          },
          registerCart: async () => undefined,
        },
        () => clock,
      );
      return { cleanupCount: () => cleanupCount, promise };
    };

    const slowRead = await run({ catalog: 501, cart: 100, shipping: 100 });
    await expect(slowRead.promise).rejects.toThrow(/read p95 exceeds 500 ms/);
    expect(slowRead.cleanupCount()).toBe(1);

    const slowShipping = await run({ catalog: 100, cart: 100, shipping: 801 });
    await expect(slowShipping.promise).rejects.toThrow(/shipping mutation p95 exceeds 800 ms/);
    expect(slowShipping.cleanupCount()).toBe(1);
  });
});
