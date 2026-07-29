import * as z from "zod";

import {
  currencyCodeSchema,
  isoDateTimeSchema,
  orderReferenceSchema,
  pricingTotalsSchema,
} from "./common";
import { guestOrderLineSchema, shippingAddressSchema } from "./checkout";

export const adminRoleSchema = z.enum([
  "admin",
  "catalog_manager",
  "operations",
  "support",
  "analyst",
]);

export const adminPermissionSchema = z.enum([
  "catalog.read",
  "catalog.write",
  "catalog.publish",
  "inventory.read",
  "inventory.adjust",
  "orders.read",
  "orders.fulfill",
  "orders.cancel",
  "orders.refund",
  "reporting.read",
  "reporting.export",
  "audit.read",
  "settings.read",
  "settings.write",
  "privacy.manage",
  "operations.replay",
  "operations.jobs.read",
]);

export const adminSessionSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160),
    email: z.email(),
    permissions: z.array(adminPermissionSchema),
    role: adminRoleSchema,
  })
  .strict();

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
    publicReference: orderReferenceSchema,
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
        publicReference: orderReferenceSchema,
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

export const notificationJobStatusSchema = z.enum([
  "pending",
  "processing",
  "sent",
  "failed",
  "dead_letter",
]);

export const notificationAttemptSchema = z
  .object({
    attemptNumber: z.int().positive(),
    completedAt: isoDateTimeSchema,
    errorCode: z.string().nullable().optional(),
    id: z.string().min(1),
    providerMessageId: z.string().nullable().optional(),
    result: z.enum(["sent", "retryable_failure", "permanent_failure", "exhausted"]),
    startedAt: isoDateTimeSchema,
  })
  .strict();

export const notificationJobSchema = z
  .object({
    attemptCount: z.int().nonnegative(),
    attempts: z.array(notificationAttemptSchema),
    createdAt: isoDateTimeSchema,
    deadLetteredAt: isoDateTimeSchema.nullable().optional(),
    id: z.string().min(1),
    kind: z.enum(["notification", "provider_recovery"]),
    lastErrorCode: z.string().nullable().optional(),
    maxAttempts: z.int().positive(),
    nextAttemptAt: isoDateTimeSchema.nullable().optional(),
    orderReference: orderReferenceSchema.nullable().optional(),
    recipient: z.string().min(3),
    replayCount: z.int().nonnegative(),
    sentAt: isoDateTimeSchema.nullable().optional(),
    status: notificationJobStatusSchema,
    type: z.enum([
      "order_receipt",
      "payment_failed",
      "cancellation",
      "refund",
      "shipment",
      "payment_reconciliation",
    ]),
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const replayNotificationJobRequestSchema = z
  .object({
    confirm: z.literal(true),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export type AdminOrder = z.infer<typeof adminOrderSchema>;
export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;
export type AdminPermission = z.infer<typeof adminPermissionSchema>;
export type AdminRole = z.infer<typeof adminRoleSchema>;
export type AdminSession = z.infer<typeof adminSessionSchema>;
export type CancelOrderRequest = z.infer<typeof cancelOrderRequestSchema>;
export type FulfillmentTransitionRequest = z.infer<typeof fulfillmentTransitionRequestSchema>;
export type NotificationAttempt = z.infer<typeof notificationAttemptSchema>;
export type NotificationJob = z.infer<typeof notificationJobSchema>;
export type NotificationJobStatus = z.infer<typeof notificationJobStatusSchema>;
export type OrderTimelineEntry = z.infer<typeof orderTimelineEntrySchema>;
export type RefundRequest = z.infer<typeof refundRequestSchema>;
export type ReplayNotificationJobRequest = z.infer<typeof replayNotificationJobRequestSchema>;
