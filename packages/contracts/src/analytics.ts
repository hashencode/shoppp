import * as z from "zod";
import { currencyCodeSchema, isoDateTimeSchema } from "./common";
import { commerceFunnelPageRouteSchema } from "./platform";

export const analyticsCalendarDateSchema = z.iso.date();
export const analyticsTimeZoneSchema = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Expected a supported IANA time zone.");
const windowShape = {
  startDate: analyticsCalendarDateSchema,
  endDate: analyticsCalendarDateSchema,
  timeZone: analyticsTimeZoneSchema,
};
function validWindow(value: { startDate: string; endDate: string }): boolean {
  const days = (Date.parse(value.endDate) - Date.parse(value.startDate)) / 86_400_000;
  return days >= 0 && days <= 366;
}
export const trafficQuerySchema = z
  .object(windowShape)
  .strict()
  .refine(validWindow, "Expected an ordered window of at most 367 days.");
export const productSalesQuerySchema = z
  .object({ ...windowShape, currency: currencyCodeSchema })
  .strict()
  .refine(validWindow, "Expected an ordered window of at most 367 days.");

// No raw URL, account, order or visitor identifier crosses the ingestion boundary.
export const trafficEventSchema = z
  .object({
    eventId: z.uuid(),
    ticket: z.string().min(1).max(2048),
    releaseId: z.string().min(1).max(160),
    route: commerceFunnelPageRouteSchema,
    productId: z.string().min(1).max(160).optional(),
  })
  .strict()
  .refine(
    (value) => (value.route === "product") === (value.productId !== undefined),
    "Product routes require productId; other routes must omit it.",
  );
export const trafficIdentityRequestSchema = z
  .object({ releaseId: z.string().min(1).max(160) })
  .strict();
export const trafficIdentitySchema = z
  .object({ ticket: z.string().min(1).max(2048), expiresAt: isoDateTimeSchema })
  .strict();

export const analyticsProductPathSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^\/(?!\/)[A-Za-z0-9_\-/]*$/)
  .refine((value) => !value.includes(".."));
export const analyticsStorefrontOriginSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value && !url.username && !url.password;
  });
const productShape = {
  productId: z.string().min(1).max(160),
  name: z.string().min(1),
  path: analyticsProductPathSchema.nullable(),
};
const countsShape = { uniqueVisitors: z.int().nonnegative(), pageViews: z.int().nonnegative() };
export const trafficReportSchema = z
  .object({
    ...windowShape,
    ...countsShape,
    asOf: isoDateTimeSchema,
    collectionStartedAt: isoDateTimeSchema.nullable(),
    storefrontOrigin: analyticsStorefrontOriginSchema.nullable(),
    comparison: z
      .object({
        startDate: analyticsCalendarDateSchema,
        endDate: analyticsCalendarDateSchema,
        ...countsShape,
        available: z.boolean(),
      })
      .strict(),
    series: z
      .array(z.object({ date: analyticsCalendarDateSchema, ...countsShape }).strict())
      .max(367),
    products: z
      .array(z.object({ ...productShape, pageViews: z.int().nonnegative() }).strict())
      .max(10),
  })
  .strict();
export const productSalesReportSchema = z
  .object({
    ...windowShape,
    currency: currencyCodeSchema,
    storefrontOrigin: analyticsStorefrontOriginSchema.nullable(),
    products: z
      .array(z.object({ ...productShape, grossSales: z.int().nonnegative() }).strict())
      .max(10),
  })
  .strict();
export type TrafficQuery = z.infer<typeof trafficQuerySchema>;
export type TrafficEvent = z.infer<typeof trafficEventSchema>;
export type TrafficIdentity = z.infer<typeof trafficIdentitySchema>;
export type TrafficReport = z.infer<typeof trafficReportSchema>;
export type ProductSalesQuery = z.infer<typeof productSalesQuerySchema>;
export type ProductSalesReport = z.infer<typeof productSalesReportSchema>;

export type TrafficIdentityRequest = z.infer<typeof trafficIdentityRequestSchema>;
