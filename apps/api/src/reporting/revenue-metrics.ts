export interface ReportingWindow {
  readonly endDate: string;
  readonly endExclusiveUtc: string;
  readonly startDate: string;
  readonly startUtc: string;
  readonly timeZone: string;
}

export interface ReportingOrderEvent {
  readonly createdAt: string;
  readonly currency: string;
  readonly environment: string;
  readonly grossAmount: number;
  readonly id: string;
  readonly paymentStatus: string;
  readonly testMode: boolean;
}

export interface ReportingRefundEvent {
  readonly amount: number;
  readonly completedAt: string;
  readonly currency: string;
  readonly environment: string;
  readonly id: string;
  readonly status: string;
  readonly testMode: boolean;
}

export interface RevenueMetrics {
  readonly averageOrderValue: number;
  readonly grossSales: number;
  readonly netSales: number;
  readonly orderCount: number;
  readonly refundTotal: number;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const GROSS_PAYMENT_STATES = new Set(["paid", "partially_refunded", "refunded"]);

function calendarDate(value: string): { day: number; month: number; year: number } {
  if (!DATE_PATTERN.test(value)) throw new Error("reporting_window_invalid");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month! - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("reporting_window_invalid");
  }
  return { day: day!, month: month!, year: year! };
}

export function addCalendarDays(value: string, days: number): string {
  const date = calendarDate(value);
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return `${shifted.getUTCFullYear().toString().padStart(4, "0")}-${(shifted.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}-${shifted.getUTCDate().toString().padStart(2, "0")}`;
}

function formatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone,
      year: "numeric",
    });
  } catch {
    throw new Error("reporting_timezone_invalid");
  }
}

function partsAt(timestamp: number, timeZone: string) {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
    month: parts.month!,
    second: parts.second!,
    year: parts.year!,
  };
}

function offsetAt(timestamp: number, timeZone: string): number {
  const parts = partsAt(timestamp, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - Math.floor(timestamp / 1_000) * 1_000;
}

function zonedMidnightUtc(value: string, timeZone: string): string {
  const date = calendarDate(value);
  const localMidnight = Date.UTC(date.year, date.month - 1, date.day);
  let instant = localMidnight;
  for (let index = 0; index < 4; index += 1) {
    instant = localMidnight - offsetAt(instant, timeZone);
  }
  return new Date(instant).toISOString();
}

export function resolveReportingWindow(input: {
  endDate: string;
  startDate: string;
  timeZone: string;
}): ReportingWindow {
  const start = calendarDate(input.startDate);
  const end = calendarDate(input.endDate);
  formatter(input.timeZone);
  const startOrdinal = Date.UTC(start.year, start.month - 1, start.day);
  const endOrdinal = Date.UTC(end.year, end.month - 1, end.day);
  if (endOrdinal < startOrdinal || endOrdinal - startOrdinal > 366 * 24 * 60 * 60 * 1_000) {
    throw new Error("reporting_window_invalid");
  }
  const endExclusiveDate = addCalendarDays(input.endDate, 1);
  return {
    endDate: input.endDate,
    endExclusiveUtc: zonedMidnightUtc(endExclusiveDate, input.timeZone),
    startDate: input.startDate,
    startUtc: zonedMidnightUtc(input.startDate, input.timeZone),
    timeZone: input.timeZone,
  };
}

function inside(timestamp: string, window: ReportingWindow): boolean {
  return timestamp >= window.startUtc && timestamp < window.endExclusiveUtc;
}

export function localReportingDate(timestamp: string, timeZone: string): string {
  const parts = partsAt(Date.parse(timestamp), timeZone);
  return `${parts.year.toString().padStart(4, "0")}-${parts.month
    .toString()
    .padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

export function calculateRevenueMetrics(
  orders: readonly ReportingOrderEvent[],
  refunds: readonly ReportingRefundEvent[],
  input: {
    currency: string;
    environment: string;
    window: ReportingWindow;
  },
): RevenueMetrics {
  const includedOrders = orders.filter(
    (order) =>
      order.currency === input.currency &&
      order.environment === input.environment &&
      !order.testMode &&
      GROSS_PAYMENT_STATES.has(order.paymentStatus) &&
      inside(order.createdAt, input.window),
  );
  const includedRefunds = refunds.filter(
    (refund) =>
      refund.currency === input.currency &&
      refund.environment === input.environment &&
      !refund.testMode &&
      refund.status === "succeeded" &&
      inside(refund.completedAt, input.window),
  );
  const grossSales = includedOrders.reduce((sum, order) => sum + order.grossAmount, 0);
  const refundTotal = includedRefunds.reduce((sum, refund) => sum + refund.amount, 0);
  const orderCount = includedOrders.length;
  return {
    averageOrderValue:
      orderCount === 0 ? 0 : Math.floor((grossSales + Math.floor(orderCount / 2)) / orderCount),
    grossSales,
    netSales: grossSales - refundTotal,
    orderCount,
    refundTotal,
  };
}
