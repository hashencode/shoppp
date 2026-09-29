import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, test } from "vitest";
import { getTrafficReport } from "../../src/reporting/traffic";

beforeAll(async () => {
  for (const [bucket, visitor, views] of [
    ["2026-09-28T18:15:00.000Z", "visitor-a", 5],
    ["2026-09-29T18:15:00.000Z", "visitor-a", 1],
    ["2026-09-29T18:16:00.000Z", "visitor-b", 2],
  ] as const) {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO traffic_uv_buckets(environment,bucket,visitor_digest) VALUES ('staging',?,?)",
      ).bind(bucket, visitor),
      env.DB.prepare(
        "INSERT INTO traffic_pv_buckets(environment,bucket,product_id,page_views,release_id) VALUES ('staging',?,'',?,'fixture')",
      ).bind(bucket, views),
    ]);
  }
  await env.DB.prepare(
    "INSERT INTO traffic_collection(environment,started_at) VALUES ('staging','2026-01-01T00:00:00.000Z')",
  ).run();
});

describe("traffic reports", () => {
  test("separates range UV from summed daily UV and respects quarter-hour local midnights", async () => {
    const result = await getTrafficReport(env, {
      startDate: "2026-09-29",
      endDate: "2026-09-30",
      timeZone: "Asia/Kathmandu",
    });
    expect(result.uniqueVisitors).toBe(2);
    expect(result.pageViews).toBe(8);
    expect(result.series).toEqual([
      { date: "2026-09-29", uniqueVisitors: 1, pageViews: 5 },
      { date: "2026-09-30", uniqueVisitors: 2, pageViews: 3 },
    ]);
    expect(result.comparison).toMatchObject({ uniqueVisitors: 0, pageViews: 0, available: true });
  });
  test("returns genuine empty zero and keeps historical records beyond 90 days", async () => {
    const empty = await getTrafficReport(env, {
      startDate: "2026-01-05",
      endDate: "2026-01-05",
      timeZone: "UTC",
    });
    expect(empty.uniqueVisitors).toBe(0);
    expect(empty.pageViews).toBe(0);
    expect(empty.products).toEqual([]);
    expect(empty.series).toEqual([{ date: "2026-01-05", uniqueVisitors: 0, pageViews: 0 }]);
    await env.DB.prepare(
      "INSERT INTO traffic_uv_buckets(environment,bucket,visitor_digest) VALUES ('staging','2025-01-01T00:00:00.000Z','old')",
    ).run();
    const old = await getTrafficReport(env, {
      startDate: "2025-01-01",
      endDate: "2025-01-01",
      timeZone: "UTC",
    });
    expect(old.uniqueVisitors).toBe(1);
    expect(old.comparison.available).toBe(false);
  });
  test("builds a daily series across DST and rejects invalid windows", async () => {
    const result = await getTrafficReport(env, {
      startDate: "2026-03-07",
      endDate: "2026-03-09",
      timeZone: "America/New_York",
    });
    expect(result.series.map((day) => day.date)).toEqual([
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
    ]);
    await expect(
      getTrafficReport(env, { startDate: "2026-09-30", endDate: "2026-09-29", timeZone: "UTC" }),
    ).rejects.toThrow();
  });
});
