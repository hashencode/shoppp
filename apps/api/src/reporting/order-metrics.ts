import type {
  ReportOrderRow,
  ReportingQuery,
  RevenueReport,
  RevenueSeriesPoint,
} from "@shoppp/contracts";

import {
  addCalendarDays,
  calculateRevenueMetrics,
  localReportingDate,
  resolveReportingWindow,
  type ReportingOrderEvent,
  type ReportingRefundEvent,
  type ReportingWindow,
} from "./revenue-metrics";

const MAX_REPORTING_EVENTS = 50_000;
const GROSS_PAYMENT_STATES = new Set(["paid", "partially_refunded", "refunded"]);

interface OrderMetricRow {
  created_at: string;
  currency: string;
  email: string;
  environment: string;
  fulfillment_status: ReportOrderRow["fulfillmentStatus"];
  grand_total_amount: number;
  id: string;
  order_status: ReportOrderRow["orderStatus"];
  payment_status: ReportOrderRow["paymentStatus"];
  public_reference: string;
  test_mode: number;
}

interface RefundMetricRow {
  amount: number;
  completed_at: string;
  currency: string;
  environment: string;
  id: string;
  order_id: string;
  status: string;
  test_mode: number;
}

export interface ReportOrderPage {
  readonly data: readonly ReportOrderRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface ReportOrderFilters extends ReportingQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly query?: string;
}

function inclusiveDayCount(startDate: string, endDate: string): number {
  let cursor = startDate;
  let count = 1;
  while (cursor !== endDate) {
    cursor = addCalendarDays(cursor, 1);
    count += 1;
  }
  return count;
}

function comparisonWindow(window: ReportingWindow): ReportingWindow {
  const days = inclusiveDayCount(window.startDate, window.endDate);
  return resolveReportingWindow({
    endDate: addCalendarDays(window.startDate, -1),
    startDate: addCalendarDays(window.startDate, -days),
    timeZone: window.timeZone,
  });
}

async function loadEvents(
  db: D1Database,
  environment: string,
  currency: string,
  startUtc: string,
  endExclusiveUtc: string,
): Promise<{ orders: OrderMetricRow[]; refunds: RefundMetricRow[] }> {
  const [orders, refunds] = await Promise.all([
    db
      .prepare(
        `SELECT id, public_reference, email, currency, grand_total_amount,
                payment_status, order_status, fulfillment_status, created_at,
                environment, test_mode
           FROM orders
          WHERE environment = ? AND test_mode = 0 AND currency = ?
            AND created_at >= ? AND created_at < ?
          ORDER BY created_at, id
          LIMIT ?`,
      )
      .bind(environment, currency, startUtc, endExclusiveUtc, MAX_REPORTING_EVENTS + 1)
      .all<OrderMetricRow>(),
    db
      .prepare(
        `SELECT r.id, r.order_id, r.amount, r.currency, r.status, r.completed_at,
                o.environment, o.test_mode
           FROM refunds r
           JOIN orders o ON o.id = r.order_id
          WHERE o.environment = ? AND o.test_mode = 0 AND r.currency = ?
            AND r.status = 'succeeded' AND r.completed_at IS NOT NULL
            AND r.completed_at >= ? AND r.completed_at < ?
          ORDER BY r.completed_at, r.id
          LIMIT ?`,
      )
      .bind(environment, currency, startUtc, endExclusiveUtc, MAX_REPORTING_EVENTS + 1)
      .all<RefundMetricRow>(),
  ]);
  if (
    orders.results.length > MAX_REPORTING_EVENTS ||
    refunds.results.length > MAX_REPORTING_EVENTS
  ) {
    throw new Error("reporting_dataset_too_large");
  }
  return { orders: orders.results, refunds: refunds.results };
}

function orderEvents(rows: readonly OrderMetricRow[]): ReportingOrderEvent[] {
  return rows.map((row) => ({
    createdAt: row.created_at,
    currency: row.currency,
    environment: row.environment,
    grossAmount: row.grand_total_amount,
    id: row.id,
    paymentStatus: row.payment_status,
    testMode: row.test_mode === 1,
  }));
}

function refundEvents(rows: readonly RefundMetricRow[]): ReportingRefundEvent[] {
  return rows.map((row) => ({
    amount: row.amount,
    completedAt: row.completed_at,
    currency: row.currency,
    environment: row.environment,
    id: row.id,
    status: row.status,
    testMode: row.test_mode === 1,
  }));
}

function series(
  orders: readonly ReportingOrderEvent[],
  refunds: readonly ReportingRefundEvent[],
  environment: string,
  currency: string,
  window: ReportingWindow,
): RevenueSeriesPoint[] {
  const result = new Map<string, RevenueSeriesPoint>();
  for (let date = window.startDate; ; date = addCalendarDays(date, 1)) {
    result.set(date, {
      date,
      grossSales: 0,
      netSales: 0,
      orderCount: 0,
      refundTotal: 0,
    });
    if (date === window.endDate) break;
  }
  for (const order of orders) {
    if (
      order.currency !== currency ||
      order.environment !== environment ||
      order.testMode ||
      !GROSS_PAYMENT_STATES.has(order.paymentStatus)
    ) {
      continue;
    }
    const date = localReportingDate(order.createdAt, window.timeZone);
    const point = result.get(date);
    if (!point) continue;
    result.set(date, {
      ...point,
      grossSales: point.grossSales + order.grossAmount,
      netSales: point.netSales + order.grossAmount,
      orderCount: point.orderCount + 1,
    });
  }
  for (const refund of refunds) {
    if (
      refund.currency !== currency ||
      refund.environment !== environment ||
      refund.testMode ||
      refund.status !== "succeeded"
    ) {
      continue;
    }
    const date = localReportingDate(refund.completedAt, window.timeZone);
    const point = result.get(date);
    if (!point) continue;
    result.set(date, {
      ...point,
      netSales: point.netSales - refund.amount,
      refundTotal: point.refundTotal + refund.amount,
    });
  }
  return [...result.values()];
}

export async function getRevenueReport(
  db: D1Database,
  environment: string,
  input: ReportingQuery,
): Promise<RevenueReport> {
  const currentWindow = resolveReportingWindow(input);
  const previousWindow = comparisonWindow(currentWindow);
  const events = await loadEvents(
    db,
    environment,
    input.currency,
    previousWindow.startUtc,
    currentWindow.endExclusiveUtc,
  );
  const orders = orderEvents(events.orders);
  const refunds = refundEvents(events.refunds);
  return {
    comparison: {
      endDate: previousWindow.endDate,
      metrics: calculateRevenueMetrics(orders, refunds, {
        currency: input.currency,
        environment,
        window: previousWindow,
      }),
      startDate: previousWindow.startDate,
    },
    currency: input.currency,
    current: {
      endDate: currentWindow.endDate,
      metrics: calculateRevenueMetrics(orders, refunds, {
        currency: input.currency,
        environment,
        window: currentWindow,
      }),
      series: series(orders, refunds, environment, input.currency, currentWindow),
      startDate: currentWindow.startDate,
    },
    definitions: {
      averageOrderValue:
        "Gross sales divided by paid order count, rounded to the nearest integer minor unit.",
      grossSales:
        "Order total recognized once when a paid order is created; later cancellation or refund does not rewrite gross sales.",
      netSales: "Gross sales minus successful refunds completed in the selected window.",
      orderCount:
        "Paid orders created in the selected window; failed checkout attempts and test-mode orders are excluded.",
      refundTotal:
        "Successful refund amounts at provider completion time, including partial and cancellation refunds.",
    },
    timeZone: input.timeZone,
  };
}

function inside(timestamp: string, window: ReportingWindow): boolean {
  return timestamp >= window.startUtc && timestamp < window.endExclusiveUtc;
}

export async function listReportOrders(
  db: D1Database,
  environment: string,
  input: ReportOrderFilters,
): Promise<ReportOrderPage> {
  const window = resolveReportingWindow(input);
  const events = await loadEvents(
    db,
    environment,
    input.currency,
    window.startUtc,
    window.endExclusiveUtc,
  );
  const refundByOrder = new Map<string, number>();
  for (const refund of events.refunds) {
    refundByOrder.set(refund.order_id, (refundByOrder.get(refund.order_id) ?? 0) + refund.amount);
  }

  // Include older orders refunded in-window so the drill-down reconciles to net sales.
  const refundOrderIds = [...refundByOrder.keys()].filter(
    (id) => !events.orders.some((order) => order.id === id),
  );
  let olderOrders: OrderMetricRow[] = [];
  if (refundOrderIds.length) {
    const placeholders = refundOrderIds.map(() => "?").join(", ");
    const rows = await db
      .prepare(
        `SELECT id, public_reference, email, currency, grand_total_amount,
                payment_status, order_status, fulfillment_status, created_at,
                environment, test_mode
           FROM orders
          WHERE environment = ? AND test_mode = 0 AND currency = ?
            AND id IN (${placeholders})`,
      )
      .bind(environment, input.currency, ...refundOrderIds)
      .all<OrderMetricRow>();
    olderOrders = rows.results;
  }

  const normalizedQuery = input.query?.trim().toLocaleLowerCase();
  const rows = [...events.orders, ...olderOrders]
    .filter(
      (order) =>
        !normalizedQuery ||
        order.public_reference.toLocaleLowerCase().includes(normalizedQuery) ||
        order.email.toLocaleLowerCase().includes(normalizedQuery),
    )
    .map((order): ReportOrderRow => {
      const grossContribution =
        inside(order.created_at, window) && GROSS_PAYMENT_STATES.has(order.payment_status)
          ? order.grand_total_amount
          : 0;
      const refundContribution = refundByOrder.get(order.id) ?? 0;
      return {
        createdAt: order.created_at,
        currency: order.currency,
        email: order.email,
        fulfillmentStatus: order.fulfillment_status,
        grossContribution,
        netContribution: grossContribution - refundContribution,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        publicReference: order.public_reference,
        refundContribution,
      };
    })
    .filter((row) => row.grossContribution !== 0 || row.refundContribution !== 0)
    .sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        right.publicReference.localeCompare(left.publicReference),
    );
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: rows.length,
  };
}

export function reportingLocalDate(timestamp: string, timeZone: string): string {
  return localReportingDate(timestamp, timeZone);
}
