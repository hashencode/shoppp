import * as z from "zod";

import { shippingAddressSchema } from "./checkout";
import {
  currencyCodeSchema,
  isoDateTimeSchema,
  moneySchema,
  pricingTotalsSchema,
  publicIdSchema,
} from "./common";

export const MAX_CART_LINE_QUANTITY = 20;

export const cartAdjustmentSchema = z
  .object({
    code: z.enum([
      "availability_changed",
      "destination_changed",
      "price_changed",
      "product_changed",
    ]),
    key: z.string().min(1),
    message: z.string().min(1),
    requiresAcknowledgement: z.boolean(),
    variantId: publicIdSchema.optional(),
  })
  .strict();
export const cartLineSchema = z
  .object({
    availableQuantity: z.int().nonnegative(),
    lineTotal: moneySchema,
    productName: z.string().min(1),
    quantity: z.int().positive().max(MAX_CART_LINE_QUANTITY),
    unitPrice: moneySchema,
    variantId: publicIdSchema,
    variantName: z.string().min(1),
  })
  .strict();
export const shippingMethodQuoteSchema = z
  .object({
    amount: z.int().nonnegative(),
    currency: currencyCodeSchema,
    id: publicIdSchema,
    name: z.string().min(1),
  })
  .strict();
export const cartSchema = z
  .object({
    adjustments: z.array(cartAdjustmentSchema),
    canCheckout: z.boolean(),
    currency: currencyCodeSchema,
    expiresAt: isoDateTimeSchema,
    id: publicIdSchema,
    lines: z.array(cartLineSchema),
    selectedShippingMethodId: publicIdSchema.nullable(),
    shippingAddress: shippingAddressSchema.nullable(),
    shippingMethods: z.array(shippingMethodQuoteSchema),
    totals: pricingTotalsSchema,
  })
  .strict();
export const createCartRequestSchema = z.object({ currency: currencyCodeSchema }).strict();
export const addCartLineRequestSchema = z
  .object({
    expectedUnitPrice: moneySchema.optional(),
    quantity: z.int().positive().max(MAX_CART_LINE_QUANTITY),
    releaseId: z.string().min(1).max(160).optional(),
    variantId: publicIdSchema,
  })
  .strict();
export const updateCartLineRequestSchema = z
  .object({ quantity: z.int().positive().max(MAX_CART_LINE_QUANTITY) })
  .strict();
export const acknowledgeCartAdjustmentsSchema = z
  .object({ codes: z.array(z.string().min(1)).min(1).max(100) })
  .strict();
export const shippingQuoteRequestSchema = z
  .object({
    shippingAddress: shippingAddressSchema,
    shippingMethodId: publicIdSchema.optional(),
  })
  .strict();

export type AddCartLineRequest = z.infer<typeof addCartLineRequestSchema>;
export type Cart = z.infer<typeof cartSchema>;
export type CartAdjustment = z.infer<typeof cartAdjustmentSchema>;
export type CreateCartRequest = z.infer<typeof createCartRequestSchema>;
export type ShippingMethodQuote = z.infer<typeof shippingMethodQuoteSchema>;
export type ShippingQuoteRequest = z.infer<typeof shippingQuoteRequestSchema>;
export type UpdateCartLineRequest = z.infer<typeof updateCartLineRequestSchema>;
