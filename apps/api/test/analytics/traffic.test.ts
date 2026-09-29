import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { ApiBindings, ApiEnvironment } from "../../src/http/context";
import { ApiError } from "../../src/http/errors";
import { getTrafficReport } from "../../src/reporting/traffic";
import { protectTraffic } from "../../src/analytics/protection";
import { cleanupTraffic, initializeTraffic, recordTraffic } from "../../src/analytics/service";
import {
  canonicalCatalogReleaseSchema,
  trafficEventSchema,
  trafficIdentityRequestSchema,
} from "@shoppp/contracts";

beforeAll(async () => {
  const manifest = canonicalCatalogReleaseSchema.parse({
    releaseId: "public-release",
    schemaVersion: 2,
    generatedAt: "2026-01-01T00:00:00.000Z",
    collections: [],
    redirects: [],
    policies: [
      {
        description: "Privacy",
        effectiveDate: "2026-01-01",
        slug: "privacy",
        title: "Privacy",
        sections: [{ heading: "Privacy", body: "Policy" }],
      },
    ],
    products: ["prd_00000000000000000001", "prd_00000000000000000002"].map((id) => ({
      id,
      name: id,
      slug: id.replaceAll("_", "-"),
      description: "Product",
      collectionIds: [],
      collectionSlugs: [],
      media: [],
      seoTitle: "Product",
      seoDescription: "Product",
      status: "published",
      variants: [
        {
          id: crypto.randomUUID(),
          sku: id,
          title: "Default",
          status: "active",
          optionValues: {},
          prices: [{ amount: 100, currency: "USD" }],
          weightGrams: 0,
        },
      ],
    })),
    routes: [
      "/policies/privacy",
      "/products/prd-00000000000000000001",
      "/products/prd-00000000000000000002",
    ],
    site: {
      defaultCurrency: "USD",
      freshnessHours: 24,
      name: "Shop",
      origin: env.STOREFRONT_ORIGIN,
    },
  });
  await env.DB.prepare(
    `INSERT INTO catalog_releases
    (id, status, purpose, environment, manifest_json, approved_at, deployed_at, created_at, updated_at)
    VALUES ('public-release', 'deployed', 'public', 'staging', ?, ?, ?, ?, ?)`,
  )
    .bind(
      JSON.stringify(manifest),
      manifest.generatedAt,
      manifest.generatedAt,
      manifest.generatedAt,
      manifest.generatedAt,
    )
    .run();
});
const secret = "traffic-test-key-at-least-thirty-two-bytes-long";
function bindings(extra: Partial<ApiBindings> = {}): ApiBindings {
  return {
    ...env,
    MEDIA_PUBLIC_ORIGIN: "https://media.example.test",
    TAX_MODE: "zero",
    TRAFFIC_ENABLED: "true",
    TRAFFIC_KEYS_JSON: JSON.stringify({ first: secret }),
    TRAFFIC_ACTIVE_KEY_ID: "first",
    TRAFFIC_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ...extra,
  };
}
function app() {
  const server = new Hono<ApiEnvironment>();
  server.use("*", protectTraffic());
  server.onError((error, c) =>
    error instanceof ApiError
      ? c.json({ code: error.code }, error.status)
      : c.json({ code: "internal" }, 500),
  );
  server.post("/identity", async (c) =>
    c.json(await initializeTraffic(c, trafficIdentityRequestSchema.parse(await c.req.json()))),
  );
  server.post("/events", async (c) => {
    await recordTraffic(c, trafficEventSchema.parse(await c.req.json()));
    return c.json({ ok: true });
  });
  return server;
}
async function request(
  path: string,
  body: unknown,
  cookie = "",
  runtime = bindings(),
  extra: Record<string, string> = {},
) {
  return app().request(
    `https://api.example.test${path}`,
    {
      method: "POST",
      headers: {
        Origin: runtime.STOREFRONT_ORIGIN,
        "Content-Type": "application/json",
        Cookie: cookie,
        "CF-Connecting-IP": "203.0.113.10",
        ...extra,
      },
      body: JSON.stringify(body),
    },
    runtime,
  );
}
async function identity(runtime = bindings(), cookie = "") {
  const response = await request("/identity", { releaseId: "public-release" }, cookie, runtime);
  expect(response.status, await response.clone().text()).toBe(200);
  return {
    cookie: response.headers.get("Set-Cookie")?.split(";")[0] ?? cookie,
    ...((await response.json()) as { ticket: string; expiresAt: string }),
  };
}
function event(ticket: string, productId?: string) {
  return {
    eventId: crypto.randomUUID(),
    ticket,
    releaseId: "public-release",
    route: productId ? "product" : "home",
    ...(productId ? { productId } : {}),
  };
}
async function totals() {
  return (
    await env.DB.prepare(
      "SELECT product_id, SUM(page_views) AS pv FROM traffic_pv_buckets GROUP BY product_id ORDER BY product_id",
    ).all()
  ).results;
}
beforeEach(async () => {
  await env.DB.batch(
    ["traffic_event_dedup", "traffic_pv_buckets", "traffic_uv_buckets", "traffic_collection"].map(
      (name) => env.DB.prepare(`DELETE FROM ${name}`),
    ),
  );
});
describe("automatic traffic collection", () => {
  test("counts repeated visits while concurrent retries increment once and one identity remains one UV", async () => {
    const id = await identity();
    for (const product of [
      "prd_00000000000000000001",
      "prd_00000000000000000001",
      "prd_00000000000000000001",
      "prd_00000000000000000002",
      "prd_00000000000000000002",
    ]) {
      const input = event(id.ticket, product);
      const responses = await Promise.all([
        request("/events", input, id.cookie),
        request("/events", input, id.cookie),
      ]);
      expect(responses.map((r) => r.status)).toEqual([200, 200]);
    }
    expect(await totals()).toEqual([
      { product_id: "", pv: 5 },
      { product_id: "prd_00000000000000000001", pv: 3 },
      { product_id: "prd_00000000000000000002", pv: 2 },
    ]);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(DISTINCT visitor_digest) AS uv FROM traffic_uv_buckets",
      ).first("uv"),
    ).toBe(1);
    const date = new Date().toISOString().slice(0, 10);
    const report = await getTrafficReport(bindings(), {
      startDate: date,
      endDate: date,
      timeZone: "UTC",
    });
    expect({ uv: report.uniqueVisitors, pv: report.pageViews }).toEqual({ uv: 1, pv: 5 });
    expect(
      report.products.map((product) => ({
        id: product.productId,
        pv: product.pageViews,
        path: product.path,
      })),
    ).toEqual([
      { id: "prd_00000000000000000001", pv: 3, path: "/products/prd-00000000000000000001" },
      { id: "prd_00000000000000000002", pv: 2, path: "/products/prd-00000000000000000002" },
    ]);
    const second = await identity();
    expect((await request("/events", event(second.ticket), second.cookie)).status).toBe(200);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(DISTINCT visitor_digest) AS uv FROM traffic_uv_buckets",
      ).first("uv"),
    ).toBe(2);
  });
  test("the collector/report chain keeps cross-day UV distinct and sums actual PV", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-28T23:59:45Z"));
    try {
      const first = await identity();
      expect(
        (await request("/events", event(first.ticket, "prd_00000000000000000001"), first.cookie))
          .status,
      ).toBe(200);
      clock.mockReturnValue(Date.parse("2026-09-29T00:00:15Z"));
      expect(
        (await request("/events", event(first.ticket, "prd_00000000000000000001"), first.cookie))
          .status,
      ).toBe(200);
      const report = await getTrafficReport(bindings(), {
        startDate: "2026-09-28",
        endDate: "2026-09-29",
        timeZone: "UTC",
      });
      expect({ uv: report.uniqueVisitors, pv: report.pageViews }).toEqual({ uv: 1, pv: 2 });
      expect(report.series.map((day) => day.uniqueVisitors)).toEqual([1, 1]);
    } finally {
      clock.mockRestore();
    }
  });
  test("rejects absent, forged and mismatched cookies, wrong release and unpublished product", async () => {
    const id = await identity();
    const other = await identity();
    for (const cookie of ["", "__Host-shoppp-traffic=forged", other.cookie]) {
      expect((await request("/events", event(id.ticket), cookie)).status).toBe(403);
    }
    expect((await request("/identity", { releaseId: "preview-release" })).status).toBe(403);
    expect((await request("/events", event(id.ticket, "private-product"), id.cookie)).status).toBe(
      403,
    );
    expect(
      (await request("/events", { ...event(id.ticket), releaseId: "another-release" }, id.cookie))
        .status,
    ).toBe(403);
    expect(await totals()).toEqual([]);
  });
  test("key rotation preserves digest for an existing cookie and separates environment", async () => {
    const first = await identity();
    await request("/events", event(first.ticket), first.cookie);
    const rotated = bindings({
      TRAFFIC_KEYS_JSON: JSON.stringify({ first: secret, second: `${secret}-second` }),
      TRAFFIC_ACTIVE_KEY_ID: "second",
    });
    const next = await identity(rotated, first.cookie);
    await request("/events", event(next.ticket), next.cookie, rotated);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(DISTINCT visitor_digest) AS uv FROM traffic_uv_buckets",
      ).first("uv"),
    ).toBe(1);
    expect(
      (
        await request(
          "/events",
          event(first.ticket),
          first.cookie,
          bindings({ ENVIRONMENT: "production" }),
        )
      ).status,
    ).toBe(403);
  });
  test("rejects expired tickets, cleans only short-lived rows and preserves old totals", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-01T00:00:00Z"));
    try {
      const id = await identity();
      const input = event(id.ticket, "prd_00000000000000000001");
      expect((await request("/events", input, id.cookie)).status).toBe(200);
      clock.mockReturnValue(Date.parse("2026-09-29T00:00:00Z"));
      await cleanupTraffic(env.DB, Date.now());
      expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM traffic_event_dedup").first("n")).toBe(
        0,
      );
      expect((await request("/events", input, id.cookie)).status).toBe(403);
      expect(await totals()).toEqual([
        { product_id: "", pv: 1 },
        { product_id: "prd_00000000000000000001", pv: 1 },
      ]);
      expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM traffic_uv_buckets").first("n")).toBe(
        1,
      );
    } finally {
      clock.mockRestore();
    }
  });
  test("expired browser identity is renewed, and forged tickets cannot write", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2025-01-01T00:00:00Z"));
    try {
      const old = await identity();
      clock.mockReturnValue(Date.parse("2026-09-29T00:00:00Z"));
      const fresh = await identity(bindings(), old.cookie);
      expect(fresh.cookie).not.toBe(old.cookie);
      expect((await request("/events", event(`${fresh.ticket}x`), fresh.cookie)).status).toBe(403);
      expect((await request("/events", event(fresh.ticket), fresh.cookie)).status).toBe(200);
    } finally {
      clock.mockRestore();
    }
  });
  test("sustained new cohorts retire expired dedup without growing the backlog or losing counts", async () => {
    const start = Date.parse("2026-01-01T00:00:00.000Z");
    for (let cohort = 0; cohort < 4; cohort += 1) {
      // Each cohort exceeds a scheduled cleanup batch. Advance beyond the retry
      // lifetime without running cleanup, then submit the next equal cohort.
      const receivedAt = start + cohort * 3 * 60 * 60 * 1000;
      await env.DB.prepare(`WITH RECURSIVE seq(n) AS (
        SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 600
      )
      INSERT INTO traffic_event_dedup
        (environment, visitor_digest, event_id, bucket, product_id, release_id, expires_at)
      SELECT 'staging', 'same-visitor', ? || n, ?, 'prd_00000000000000000001',
             'public-release', ? FROM seq`)
        .bind(`cohort-${cohort}-`, new Date(receivedAt).toISOString(), receivedAt + 7200000)
        .run();
      expect(
        await env.DB.prepare("SELECT COUNT(*) AS n FROM traffic_event_dedup").first("n"),
      ).toBe(600);
      expect(
        await env.DB.prepare("SELECT MIN(expires_at) AS expiry FROM traffic_event_dedup")
          .first("expiry"),
      ).toBe(receivedAt + 7200000);
    }
    expect(await totals()).toEqual([
      { product_id: "", pv: 2400 },
      { product_id: "prd_00000000000000000001", pv: 2400 },
    ]);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS n FROM traffic_uv_buckets").first("n"),
    ).toBe(4);
    expect(
      await env.DB.prepare("SELECT COUNT(DISTINCT visitor_digest) AS n FROM traffic_uv_buckets")
        .first("n"),
    ).toBe(1);
  });
  test("cleanup caps a batch at 500 and never erases aggregates or UV", async () => {
    await env.DB.prepare(
      `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 501)
      INSERT INTO traffic_event_dedup(environment, visitor_digest, event_id, bucket, product_id, release_id, expires_at)
      SELECT 'staging', 'one-visitor', 'cleanup-' || n, '2026-01-01T00:00:00.000Z', '', 'public-release', 1 FROM seq`,
    ).run();
    expect(await cleanupTraffic(env.DB, 2)).toBe(500);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM traffic_event_dedup").first("n")).toBe(
      1,
    );
    expect(await totals()).toEqual([{ product_id: "", pv: 501 }]);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM traffic_uv_buckets").first("n")).toBe(1);
  });
  test("a failed aggregate insert rolls back dedup, site and UV writes together", async () => {
    const id = await identity();
    await env.DB.exec(
      "CREATE TRIGGER traffic_test_fail BEFORE INSERT ON traffic_pv_buckets WHEN NEW.product_id = 'prd_00000000000000000001' BEGIN SELECT RAISE(ABORT, 'injected'); END;",
    );
    try {
      expect(
        (await request("/events", event(id.ticket, "prd_00000000000000000001"), id.cookie)).status,
      ).toBe(500);
      expect(await totals()).toEqual([]);
      expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM traffic_event_dedup").first("n")).toBe(
        0,
      );
      expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM traffic_uv_buckets").first("n")).toBe(
        0,
      );
    } finally {
      await env.DB.exec("DROP TRIGGER traffic_test_fail;");
    }
  });
  test("trusted source quota ignores Authorization and cookie changes; fails closed without binding", async () => {
    const keys: string[] = [];
    const runtime = bindings({
      TRAFFIC_RATE_LIMITER: {
        limit: async ({ key }) => {
          keys.push(key);
          return { success: false };
        },
      },
    });
    for (const authorization of ["Bearer attacker-a", "Bearer attacker-b"]) {
      expect(
        (
          await request(
            "/identity",
            { releaseId: "public-release" },
            crypto.randomUUID(),
            runtime,
            { Authorization: authorization },
          )
        ).status,
      ).toBe(429);
    }
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).not.toContain("203.0.113.10");
    const noLimiter = bindings({ ENVIRONMENT: "staging" });
    delete noLimiter.TRAFFIC_RATE_LIMITER;
    expect(
      (await request("/identity", { releaseId: "public-release" }, "", noLimiter)).status,
    ).toBe(503);
  });
  test("rejects preview, disabled, wrong-origin and oversized requests before writes", async () => {
    expect(
      (await request("/identity", { releaseId: "public-release" }, "__Host-shoppp-preview=secret"))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          "/identity",
          { releaseId: "public-release" },
          "",
          bindings({ TRAFFIC_ENABLED: "false" }),
        )
      ).status,
    ).toBe(503);
    expect(
      (
        await request("/identity", { releaseId: "public-release" }, "", bindings(), {
          Origin: "https://attacker.example",
        })
      ).status,
    ).toBe(403);
    expect((await request("/identity", { releaseId: "x".repeat(5000) })).status).toBe(413);
    expect(await totals()).toEqual([]);
  });
});
