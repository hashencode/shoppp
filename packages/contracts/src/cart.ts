import * as z from "zod";

import {
  currencyCodeSchema,
  isoDateTimeSchema,
  moneySchema,
  pricingTotalsSchema,
  publicIdSchema,
} from "./common";

export const cartLineSchema = z
  .object({
    lineTotal: moneySchema,
    productName: z.string().min(1),
    quantity: z.int().positive(),
    variantId: publicIdSchema,
    variantName: z.string().min(1),
  })
  .strict();
export const cartSchema = z
  .object({
    currency: currencyCodeSchema,
    expiresAt: isoDateTimeSchema,
    id: publicIdSchema,
    lines: z.array(cartLineSchema),
    totals: pricingTotalsSchema,
  })
  .strict();

export type Cart = z.infer<typeof cartSchema>;
