import { describe, expect, test } from "vitest";

import {
  calculateRevenueMetrics,
  resolveReportingWindow,
  type ReportingOrderEvent,
  type ReportingRefundEvent,
} from "../../src/reporting/revenue-metrics";

const orders: ReportingOrderEvent[] = [
  {
    createdAt: "2026-03-08T06:00:00.000Z",
    currency: "USD",
    environment: "production",
    grossAmount: 1_000,
    id: "usd-paid",
    paymentStatus: "paid",
    testMode: false,
  },
  {
    createdAt: "2026-03-08T20:00:00.000Z",
    currency: "USD",
    environment: "production",
    grossAmount: 3_000,
    id: "usd-partial",
    paymentStatus: "partially_refunded",
    testMode: false,
  },
  {
    createdAt: "2026-03-08T20:00:00.000Z",
    currency: "EUR",
    environment: "production",
    grossAmount: 99_000,
    id: "eur-paid",
    paymentStatus: "paid",
    testMode: false,
  },
  {
    createdAt: "2026-03-08T20:00:00.000Z",
    currency: "USD",
    environment: "production",
    grossAmount: 50_000,
    id: "usd-test",
    paymentStatus: "paid",
    testMode: true,
  },
  {
    createdAt: "2026-03-08T20:00:00.000Z",
    currency: "USD",
    environment: "staging",
    grossAmount: 50_000,
    id: "usd-staging",
    paymentStatus: "paid",
    testMode: false,
  },
];

const refunds: ReportingRefundEvent[] = [
  {
    amount: 500,
    completedAt: "2026-03-08T21:00:00.000Z",
    currency: "USD",
    environment: "production",
    id: "refund-usd",
    status: "succeeded",
    testMode: false,
  },
  {
    amount: 10_000,
    completedAt: "2026-03-08T21:00:00.000Z",
    currency: "EUR",
    environment: "production",
    id: "refund-eur",
    status: "succeeded",
    testMode: false,
  },
];

describe("currency-safe revenue reporting", () => {
  test("keeps currencies and environments separate and uses integer minor units", () => {
    const window = resolveReportingWindow({
      endDate: "2026-03-08",
      startDate: "2026-03-08",
      timeZone: "America/New_York",
    });
    const result = calculateRevenueMetrics(orders, refunds, {
      currency: "USD",
      environment: "production",
      window,
    });

    expect(result).toEqual({
      averageOrderValue: 2_000,
      grossSales: 4_000,
      netSales: 3_500,
      orderCount: 2,
      refundTotal: 500,
    });
  });

  test("uses IANA day boundaries across daylight-saving transitions", () => {
    const spring = resolveReportingWindow({
      endDate: "2026-03-08",
      startDate: "2026-03-08",
      timeZone: "America/New_York",
    });
    expect(spring).toMatchObject({
      endExclusiveUtc: "2026-03-09T04:00:00.000Z",
      startUtc: "2026-03-08T05:00:00.000Z",
    });
    expect(Date.parse(spring.endExclusiveUtc) - Date.parse(spring.startUtc)).toBe(
      23 * 60 * 60 * 1_000,
    );

    const fall = resolveReportingWindow({
      endDate: "2026-11-01",
      startDate: "2026-11-01",
      timeZone: "America/New_York",
    });
    expect(Date.parse(fall.endExclusiveUtc) - Date.parse(fall.startUtc)).toBe(25 * 60 * 60 * 1_000);
  });

  test("rejects invalid time zones and reversed windows", () => {
    expect(() =>
      resolveReportingWindow({
        endDate: "2026-03-08",
        startDate: "2026-03-09",
        timeZone: "America/New_York",
      }),
    ).toThrow("reporting_window_invalid");
    expect(() =>
      resolveReportingWindow({
        endDate: "2026-03-08",
        startDate: "2026-03-08",
        timeZone: "Mars/Olympus",
      }),
    ).toThrow("reporting_timezone_invalid");
  });
});
