import { trafficReportSchema, type TrafficQuery, type TrafficReport } from "@shoppp/contracts";
import type { ApiBindings } from "../http/context";
import { ApiError } from "../http/errors";
import { addCalendarDays, resolveReportingWindow } from "./revenue-metrics";
import { getPublicRelease, publicProductPath, publicStorefrontOrigin } from "./public-products";

const MAX_BUCKET_ROWS = 500_000;

async function assertBounded(
  db: D1Database,
  table: "traffic_uv_buckets" | "traffic_pv_buckets",
  environment: string,
  start: string,
  end: string,
) {
  const result = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM
    (SELECT 1 FROM ${table} WHERE environment = ? AND bucket >= ? AND bucket < ? LIMIT ?)`,
    )
    .bind(environment, start, end, MAX_BUCKET_ROWS + 1)
    .first<{ count: number }>();
  if ((result?.count ?? 0) > MAX_BUCKET_ROWS)
    throw new ApiError(422, "reporting_dataset_too_large", "Choose a shorter reporting period.");
}

async function counts(env: ApiBindings, start: string, end: string) {
  const [uv, pv] = await Promise.all([
    env.DB.prepare(
      "SELECT COUNT(DISTINCT visitor_digest) AS value FROM traffic_uv_buckets WHERE environment = ? AND bucket >= ? AND bucket < ?",
    )
      .bind(env.ENVIRONMENT, start, end)
      .first<{ value: number }>(),
    env.DB.prepare(
      "SELECT COALESCE(SUM(page_views), 0) AS value FROM traffic_pv_buckets WHERE environment = ? AND product_id = '' AND bucket >= ? AND bucket < ?",
    )
      .bind(env.ENVIRONMENT, start, end)
      .first<{ value: number }>(),
  ]);
  return { uniqueVisitors: uv?.value ?? 0, pageViews: pv?.value ?? 0 };
}

export async function getTrafficReport(
  env: ApiBindings,
  input: TrafficQuery,
): Promise<TrafficReport> {
  const window = resolveReportingWindow(input);
  const days =
    Math.round((Date.parse(input.endDate) - Date.parse(input.startDate)) / 86_400_000) + 1;
  const previous = resolveReportingWindow({
    ...input,
    startDate: addCalendarDays(input.startDate, -days),
    endDate: addCalendarDays(input.startDate, -1),
  });
  await Promise.all(
    ["traffic_uv_buckets", "traffic_pv_buckets"].map((table) =>
      assertBounded(
        env.DB,
        table as "traffic_uv_buckets" | "traffic_pv_buckets",
        env.ENVIRONMENT,
        previous.startUtc,
        window.endExclusiveUtc,
      ),
    ),
  );
  const [current, comparison, collection, publicRelease] = await Promise.all([
    counts(env, window.startUtc, window.endExclusiveUtc),
    counts(env, previous.startUtc, previous.endExclusiveUtc),
    env.DB.prepare("SELECT started_at FROM traffic_collection WHERE environment = ?")
      .bind(env.ENVIRONMENT)
      .first<{ started_at: string }>(),
    getPublicRelease(env),
  ]);
  // Each local day has its own UTC endpoints, including short/long DST days.
  // Query in bounded batches instead of loading visitor identities into the application.
  const series: TrafficReport["series"] = [];
  for (let offset = 0; offset < days; offset += 20) {
    const dayWindows = Array.from({ length: Math.min(20, days - offset) }, (_, index) => {
      const date = addCalendarDays(input.startDate, offset + index);
      return resolveReportingWindow({ startDate: date, endDate: date, timeZone: input.timeZone });
    });
    const values = dayWindows.map(() => "(?, ?, ?)").join(",");
    const chunk = await env.DB.prepare(
      `WITH days(date, start_utc, end_utc) AS (VALUES ${values})
      SELECT date,
        (SELECT COUNT(DISTINCT visitor_digest) FROM traffic_uv_buckets
         WHERE environment = ? AND bucket >= days.start_utc AND bucket < days.end_utc) AS uniqueVisitors,
        (SELECT COALESCE(SUM(page_views),0) FROM traffic_pv_buckets
         WHERE environment = ? AND product_id = '' AND bucket >= days.start_utc AND bucket < days.end_utc) AS pageViews
      FROM days ORDER BY date`,
    )
      .bind(
        ...dayWindows.flatMap((day) => [day.startDate, day.startUtc, day.endExclusiveUtc]),
        env.ENVIRONMENT,
        env.ENVIRONMENT,
      )
      .all<TrafficReport["series"][number]>();
    series.push(...chunk.results);
  }
  const ranked = await env.DB.prepare(
    `SELECT product_id, SUM(page_views) AS page_views, MAX(release_id) AS release_id
    FROM traffic_pv_buckets WHERE environment = ? AND product_id <> '' AND bucket >= ? AND bucket < ?
    GROUP BY product_id ORDER BY page_views DESC, product_id ASC LIMIT 10`,
  )
    .bind(env.ENVIRONMENT, window.startUtc, window.endExclusiveUtc)
    .all<{ product_id: string; page_views: number; release_id: string }>();
  const origin = publicStorefrontOrigin(env);
  const historicalReleases = new Map<string, ReturnType<typeof getPublicRelease>>();
  const historicalRelease = (id: string) => {
    let release = historicalReleases.get(id);
    if (!release) {
      release = getPublicRelease(env, id);
      historicalReleases.set(id, release);
    }
    return release;
  };
  const products = await Promise.all(
    ranked.results.map(async (row) => {
      const live = publicRelease?.products.find((product) => product.id === row.product_id);
      const historical = live ? null : await historicalRelease(row.release_id);
      const product = live ?? historical?.products.find((item) => item.id === row.product_id);
      const path = publicProductPath(publicRelease, row.product_id);
      return {
        productId: row.product_id,
        name: product?.name ?? `Archived product (${row.product_id.slice(0, 12)})`,
        path,
        pageViews: row.page_views,
      };
    }),
  );
  return trafficReportSchema.parse({
    ...input,
    ...current,
    asOf: new Date().toISOString(),
    collectionStartedAt: collection?.started_at ?? null,
    storefrontOrigin: origin,
    comparison: {
      startDate: previous.startDate,
      endDate: previous.endDate,
      ...comparison,
      available: !!collection && collection.started_at <= previous.startUtc,
    },
    series,
    products,
  });
}
