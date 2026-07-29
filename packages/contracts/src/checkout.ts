import * as z from "zod";

import {
  countryCodeSchema,
  currencyCodeSchema,
  isoDateTimeSchema,
  pricingTotalsSchema,
  publicIdSchema,
} from "./common";

export const shippingAddressSchema = z
  .object({
    city: z.string().min(1).max(120),
    countryCode: countryCodeSchema,
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    name: z.string().min(1).max(160),
    phone: z.string().max(40).optional(),
    postalCode: z
      .string()
      .min(3)
      .max(32)
      .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*[A-Za-z0-9]$/),
    region: z.string().max(120).optional(),
  })
  .strict();
export const checkoutRequestSchema = z
  .object({
    acceptTerms: z.literal(true),
    cartId: publicIdSchema,
    countryCode: countryCodeSchema,
    currency: currencyCodeSchema,
    email: z.email(),
    idempotencyKey: z.string().min(16).max(160),
    shippingAddress: shippingAddressSchema,
    shippingMethodId: publicIdSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.countryCode !== value.shippingAddress.countryCode) {
      context.addIssue({
        code: "custom",
        message: "Checkout country must match the shipping address country.",
        path: ["countryCode"],
      });
    }
  });

export const checkoutSessionSchema = z
  .object({
    attemptId: publicIdSchema,
    checkoutUrl: z.url(),
    expiresAt: isoDateTimeSchema,
    orderAccessToken: z.string().regex(/^[A-Za-z0-9_-]{40,160}$/),
    status: z.literal("payment_pending"),
  })
  .strict();
export const guestOrderLineSchema = z
  .object({
    currency: currencyCodeSchema,
    discountAmount: z.int().nonnegative(),
    lineTotalAmount: z.int().nonnegative(),
    productName: z.string().min(1),
    quantity: z.int().positive(),
    sku: z.string().min(1),
    taxAmount: z.int().nonnegative(),
    unitPriceAmount: z.int().nonnegative(),
    variantName: z.string().min(1),
  })
  .strict();
export const guestOrderSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    currency: currencyCodeSchema,
    email: z.email(),
    fulfillmentStatus: z.enum([
      "unfulfilled",
      "picking",
      "packed",
      "shipped",
      "delivered",
      "canceled",
    ]),
    lines: z.array(guestOrderLineSchema).min(1),
    orderStatus: z.enum(["checkout_pending", "confirmed", "processing", "completed", "canceled"]),
    paymentStatus: z.enum([
      "pending",
      "authorized",
      "paid",
      "failed",
      "canceled",
      "partially_refunded",
      "refunded",
    ]),
    publicReference: z.string().regex(/^ORD-[A-Z0-9]{6,20}$/),
    shippingAddress: shippingAddressSchema,
    totals: pricingTotalsSchema,
  })
  .strict();
export const orderAccessSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }).strict(),
  z.object({ status: z.literal("failed") }).strict(),
  z.object({ status: z.literal("expired") }).strict(),
  z.object({ order: guestOrderSchema, status: z.literal("paid") }).strict(),
]);

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CheckoutSession = z.infer<typeof checkoutSessionSchema>;
export type GuestOrder = z.infer<typeof guestOrderSchema>;
export type OrderAccess = z.infer<typeof orderAccessSchema>;
