import * as z from "zod";

import { currencyCodeSchema, isoDateTimeSchema, pricingTotalsSchema } from "./common";
import { guestOrderLineSchema, shippingAddressSchema } from "./checkout";

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
    email: z.email().optional(),
    fulfillmentStatus: fulfillmentStatusSchema,
    grandTotal: z.int().nonnegative(),
    orderStatus: orderStatusSchema,
    paymentStatus: paymentStatusSchema,
    publicReference: z.string().regex(/^ORD-[A-Z0-9]{6,20}$/),
  })
  .strict();

export const orderTimelineEntrySchema = z
  .object({
    actor: z.string().nullable().optional(),
    amount: z.int().nonnegative().optional(),
    createdAt: isoDateTimeSchema,
    id: z.string().min(1),
    kind: z.enum(["payment", "order", "fulfillment", "refund", "notification", "audit"]),
    label: z.string().min(1),
    reason: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
  })
  .strict();

export const adminOrderDetailSchema = z
  .object({
    allowedActions: z
      .object({
        cancel: z.boolean(),
        fulfill: z.array(z.enum(["picking", "packed", "shipped", "delivered"])),
        refundMaximum: z.int().nonnegative(),
      })
      .strict(),
    facts: z
      .object({
        createdAt: isoDateTimeSchema,
        currency: currencyCodeSchema,
        email: z.email(),
        fulfillmentStatus: fulfillmentStatusSchema,
        lines: z.array(guestOrderLineSchema).min(1),
        orderStatus: orderStatusSchema,
        paymentStatus: paymentStatusSchema,
        publicReference: z.string().regex(/^ORD-[A-Z0-9]{6,20}$/),
        shippingAddress: shippingAddressSchema,
        totals: pricingTotalsSchema,
      })
      .strict(),
    timeline: z.array(orderTimelineEntrySchema),
  })
  .strict();

export const fulfillmentTransitionRequestSchema = z
  .object({
    carrier: z.string().trim().min(1).max(120).optional(),
    confirm: z.literal(true),
    reason: z.string().trim().min(3).max(500),
    toStatus: z.enum(["picking", "packed", "shipped", "delivered"]),
    trackingNumber: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.toStatus === "shipped" && (!value.carrier || !value.trackingNumber)) {
      context.addIssue({
        code: "custom",
        message: "Carrier and tracking number are required to ship an order.",
        path: ["trackingNumber"],
      });
    }
    if (value.toStatus !== "shipped" && (value.carrier || value.trackingNumber)) {
      context.addIssue({
        code: "custom",
        message: "Tracking details are only accepted for shipment.",
        path: ["trackingNumber"],
      });
    }
  });

export const refundRequestSchema = z
  .object({
    amount: z.int().positive(),
    confirm: z.literal(true),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export const cancelOrderRequestSchema = z
  .object({
    confirm: z.literal(true),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export type AdminOrder = z.infer<typeof adminOrderSchema>;
export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;
export type CancelOrderRequest = z.infer<typeof cancelOrderRequestSchema>;
export type FulfillmentTransitionRequest = z.infer<typeof fulfillmentTransitionRequestSchema>;
export type OrderTimelineEntry = z.infer<typeof orderTimelineEntrySchema>;
export type RefundRequest = z.infer<typeof refundRequestSchema>;
