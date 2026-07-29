import * as z from "zod";

import { currencyCodeSchema, isoDateTimeSchema } from "./common";
import { fulfillmentStatusSchema, orderStatusSchema, paymentStatusSchema } from "./admin";

const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const reportingQuerySchema = z
  .object({
    currency: currencyCodeSchema,
    endDate: calendarDateSchema,
    startDate: calendarDateSchema,
    timeZone: z.string().trim().min(1).max(100),
  })
  .strict();

export const revenueMetricsSchema = z
  .object({
    averageOrderValue: z.int().nonnegative(),
    grossSales: z.int().nonnegative(),
    netSales: z.int(),
    orderCount: z.int().nonnegative(),
    refundTotal: z.int().nonnegative(),
  })
  .strict();

export const revenueSeriesPointSchema = z
  .object({
    date: calendarDateSchema,
    grossSales: z.int().nonnegative(),
    netSales: z.int(),
    orderCount: z.int().nonnegative(),
    refundTotal: z.int().nonnegative(),
  })
  .strict();

export const revenueReportSchema = z
  .object({
    comparison: z
      .object({
        endDate: calendarDateSchema,
        metrics: revenueMetricsSchema,
        startDate: calendarDateSchema,
      })
      .strict(),
    currency: currencyCodeSchema,
    current: z
      .object({
        endDate: calendarDateSchema,
        metrics: revenueMetricsSchema,
        series: z.array(revenueSeriesPointSchema),
        startDate: calendarDateSchema,
      })
      .strict(),
    definitions: z.record(z.string(), z.string()),
    timeZone: z.string().min(1),
  })
  .strict();

export const reportOrderRowSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    currency: currencyCodeSchema,
    email: z.email(),
    fulfillmentStatus: fulfillmentStatusSchema,
    grossContribution: z.int().nonnegative(),
    netContribution: z.int(),
    orderStatus: orderStatusSchema,
    paymentStatus: paymentStatusSchema,
    publicReference: z.string().regex(/^ORD-[A-Z0-9]{6,20}$/),
    refundContribution: z.int().nonnegative(),
  })
  .strict();

export const reportExportRequestSchema = reportingQuerySchema
  .extend({
    confirm: z.literal(true),
    query: z.string().trim().max(160).optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const reportExportSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    currency: currencyCodeSchema,
    endDate: calendarDateSchema,
    expiresAt: isoDateTimeSchema,
    id: z.string().min(1),
    rowCount: z.int().nonnegative().nullable().optional(),
    startDate: calendarDateSchema,
    status: z.enum(["pending", "processing", "ready", "failed", "expired"]),
    timeZone: z.string().min(1),
  })
  .strict();

export type ReportExport = z.infer<typeof reportExportSchema>;
export type ReportExportRequest = z.infer<typeof reportExportRequestSchema>;
export type ReportingQuery = z.infer<typeof reportingQuerySchema>;
export type ReportOrderRow = z.infer<typeof reportOrderRowSchema>;
export type RevenueMetrics = z.infer<typeof revenueMetricsSchema>;
export type RevenueReport = z.infer<typeof revenueReportSchema>;
export type RevenueSeriesPoint = z.infer<typeof revenueSeriesPointSchema>;
