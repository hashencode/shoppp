import * as z from "zod";

import {
  currencyCodeSchema,
  isoDateTimeSchema,
  orderReferenceSchema,
  pricingTotalsSchema,
} from "./common";
import { guestOrderLineSchema, shippingAddressSchema } from "./checkout";
import {
  blockDefinitionSchema,
  fixtureBindingSchema,
  sectionDefinitionSchema,
  storefrontIdentifierSchema,
  storefrontSemverSchema,
  storefrontThemeDescriptorSchema,
  themeOverrideSchema,
  themePresetSchema,
} from "./storefront-experience";

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
  "themes.read",
  "themes.write",
  "themes.approve",
  "themes.preview",
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

const experienceReasonSchema = z.string().trim().min(3).max(500);

export const adminStorefrontThemeSchema = z
  .object({
    ...storefrontThemeDescriptorSchema.shape,
    componentRegistry: z
      .object({
        blocks: z.array(blockDefinitionSchema).max(60),
        sections: z.array(sectionDefinitionSchema).max(60),
      })
      .strict(),
    fixtureBindings: z.array(fixtureBindingSchema).max(100),
    presetDefinitions: z.array(themePresetSchema).min(1).max(20),
  })
  .strict();

export const storefrontExperienceDraftInputSchema = z
  .object({
    bindings: z.array(fixtureBindingSchema).max(100),
    experienceId: storefrontIdentifierSchema,
    overrides: z.array(themeOverrideSchema).max(10),
    presetId: storefrontIdentifierSchema,
    themeId: storefrontIdentifierSchema,
    themeVersion: storefrontSemverSchema,
  })
  .strict();

export const createStorefrontExperienceDraftRequestSchema = z
  .object({
    draft: storefrontExperienceDraftInputSchema,
    reason: experienceReasonSchema,
  })
  .strict();

export const updateStorefrontExperienceDraftRequestSchema = z
  .object({
    bindings: z.array(fixtureBindingSchema).max(100),
    expectedVersion: z.int().positive(),
    overrides: z.array(themeOverrideSchema).max(10),
    reason: experienceReasonSchema,
  })
  .strict();

export const validateStorefrontExperienceDraftRequestSchema = z
  .object({
    expectedVersion: z.int().positive(),
    reason: experienceReasonSchema,
  })
  .strict();

export const resolveStorefrontExperienceDraftRequestSchema =
  validateStorefrontExperienceDraftRequestSchema;

export const approveStorefrontExperienceDraftRequestSchema = z
  .object({
    confirm: z.literal(true),
    expectedVersion: z.int().positive(),
    reason: experienceReasonSchema,
  })
  .strict();

export const storefrontExperienceMigrationDryRunRequestSchema = z
  .object({
    expectedVersion: z.int().positive(),
    reason: experienceReasonSchema,
    targetConfigurationSchemaVersion: z.int().positive(),
    targetThemeVersion: storefrontSemverSchema,
  })
  .strict();

export const approveStorefrontExperienceMigrationRequestSchema = z
  .object({
    confirm: z.literal(true),
    expectedVersion: z.int().positive(),
    migrationId: storefrontIdentifierSchema,
    reason: experienceReasonSchema,
  })
  .strict();

export const storefrontExperienceBuildResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      artifactDigest: z.string().regex(/^[a-f0-9]{64}$/),
      artifactPrefix: z.string().regex(/^snapshots\/[a-z][a-z0-9-]{2,99}\/[a-f0-9]{64}$/),
      expiresAt: isoDateTimeSchema,
      status: z.literal("deployed"),
    })
    .strict(),
  z
    .object({
      failureCode: storefrontIdentifierSchema,
      status: z.literal("failed"),
    })
    .strict(),
]);

export const createStorefrontPreviewGrantRequestSchema = z
  .object({
    origin: z.url().refine((value) => new URL(value).protocol === "https:"),
    reason: experienceReasonSchema,
  })
  .strict();

export const redeemStorefrontPreviewGrantRequestSchema = z
  .object({
    grant: z
      .string()
      .min(32)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/),
    origin: z.url().refine((value) => new URL(value).protocol === "https:"),
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
export type ApproveStorefrontExperienceDraftRequest = z.infer<
  typeof approveStorefrontExperienceDraftRequestSchema
>;
export type AdminStorefrontTheme = z.infer<typeof adminStorefrontThemeSchema>;
export type ApproveStorefrontExperienceMigrationRequest = z.infer<
  typeof approveStorefrontExperienceMigrationRequestSchema
>;
export type CreateStorefrontExperienceDraftRequest = z.infer<
  typeof createStorefrontExperienceDraftRequestSchema
>;
export type CreateStorefrontPreviewGrantRequest = z.infer<
  typeof createStorefrontPreviewGrantRequestSchema
>;
export type RedeemStorefrontPreviewGrantRequest = z.infer<
  typeof redeemStorefrontPreviewGrantRequestSchema
>;
export type ResolveStorefrontExperienceDraftRequest = z.infer<
  typeof resolveStorefrontExperienceDraftRequestSchema
>;
export type StorefrontExperienceBuildResult = z.infer<typeof storefrontExperienceBuildResultSchema>;
export type StorefrontExperienceDraftInput = z.infer<typeof storefrontExperienceDraftInputSchema>;
export type StorefrontExperienceMigrationDryRunRequest = z.infer<
  typeof storefrontExperienceMigrationDryRunRequestSchema
>;
export type UpdateStorefrontExperienceDraftRequest = z.infer<
  typeof updateStorefrontExperienceDraftRequestSchema
>;
export type ValidateStorefrontExperienceDraftRequest = z.infer<
  typeof validateStorefrontExperienceDraftRequestSchema
>;
