import * as z from "zod";

import { currencyCodeSchema, isoDateTimeSchema } from "./common";

export const paymentStatusSchema = z.enum([
  "pending",
  "authorized",
  "paid",
  "failed",
  "canceled",
  "partially_refunded",
  "refunded",
]);
export const orderStatusSchema = z.enum([
  "checkout_pending",
  "confirmed",
  "processing",
  "completed",
  "canceled",
]);
export const fulfillmentStatusSchema = z.enum([
  "unfulfilled",
  "picking",
  "packed",
  "shipped",
  "delivered",
  "canceled",
]);
export const adminOrderSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    currency: currencyCodeSchema,
    fulfillmentStatus: fulfillmentStatusSchema,
    grandTotal: z.int().nonnegative(),
    orderStatus: orderStatusSchema,
    paymentStatus: paymentStatusSchema,
    publicReference: z.string().regex(/^ORD-[A-Z0-9]{6,20}$/),
  })
  .strict();

export type AdminOrder = z.infer<typeof adminOrderSchema>;
