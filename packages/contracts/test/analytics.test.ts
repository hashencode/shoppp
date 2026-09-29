import { expect, test } from "bun:test";
import {
  trafficQuerySchema,
  trafficEventSchema,
  trafficReportSchema,
  productSalesReportSchema,
} from "../src/analytics";
const window = { startDate: "2026-09-01", endDate: "2026-09-29", timeZone: "Asia/Kathmandu" };
test("traffic windows reject invalid dates, zones, reversed and excessive windows and currency", () => {
  expect(trafficQuerySchema.safeParse(window).success).toBe(true);
  for (const change of [
    { startDate: "2026-02-30" },
    { timeZone: "Fake/Zone" },
    { startDate: "2026-10-01" },
    { startDate: "2024-01-01" },
    { currency: "USD" },
  ]) {
    expect(trafficQuerySchema.safeParse({ ...window, ...change }).success).toBe(false);
  }
});
test("ingestion allows only bounded anonymous public dimensions", () => {
  const event = {
    eventId: crypto.randomUUID(),
    ticket: "signed-ticket",
    releaseId: "release-1",
    route: "product",
    productId: "product-1",
  };
  expect(trafficEventSchema.safeParse(event).success).toBe(true);
  for (const change of [
    { route: "search" },
    { productId: undefined },
    { route: "home" },
    { url: "https://private.example/" },
    { email: "x@example.com" },
    { ticket: "" },
  ]) {
    expect(trafficEventSchema.safeParse({ ...event, ...change }).success).toBe(false);
  }
});
test("UV and PV stay distinct, product paths cannot escape the public origin", () => {
  const report = {
    ...window,
    asOf: "2026-09-29T12:00:00Z",
    collectionStartedAt: null,
    storefrontOrigin: "https://shop.example",
    uniqueVisitors: 1,
    pageViews: 6,
    comparison: {
      startDate: "2026-08-03",
      endDate: "2026-08-31",
      uniqueVisitors: 0,
      pageViews: 0,
      available: false,
    },
    series: [
      { date: "2026-09-28", uniqueVisitors: 1, pageViews: 5 },
      { date: "2026-09-29", uniqueVisitors: 1, pageViews: 1 },
    ],
    products: [{ productId: "a", name: "A", path: "/products/a", pageViews: 4 }],
  };
  expect(trafficReportSchema.parse(report).uniqueVisitors).toBe(1);
  for (const path of [
    "//evil.example",
    "/\\evil",
    "/products/../admin",
    "/products/%2e%2e/admin",
    "/products/a?token=x",
  ]) {
    expect(
      trafficReportSchema.safeParse({ ...report, products: [{ ...report.products[0], path }] })
        .success,
    ).toBe(false);
  }
  expect(
    productSalesReportSchema.safeParse({
      ...window,
      currency: "USD",
      storefrontOrigin: null,
      products: [{ productId: "a", name: "Archived A", path: null, grossSales: 100 }],
    }).success,
  ).toBe(true);
});
