import * as z from "zod";

import { countryCodeSchema, currencyCodeSchema, publicIdSchema } from "./common";

export const shippingAddressSchema = z
  .object({
    city: z.string().min(1).max(120),
    countryCode: countryCodeSchema,
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    name: z.string().min(1).max(160),
    phone: z.string().max(40).optional(),
    postalCode: z.string().min(1).max(32),
    region: z.string().max(120).optional(),
  })
  .strict();
export const checkoutRequestSchema = z
  .object({
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

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
