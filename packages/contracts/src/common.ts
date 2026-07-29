import * as z from "zod";

export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);
export const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/);
export const publicIdSchema = z.union([z.string().regex(/^[a-z]+_[A-Z0-9]{20,32}$/i), z.uuid()]);
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const moneySchema = z
  .object({
    amount: z.int().nonnegative(),
    currency: currencyCodeSchema,
  })
  .strict();
export const pricingTotalsSchema = z
  .object({
    discountTotal: z.int().nonnegative(),
    grandTotal: z.int().nonnegative(),
    shippingTotal: z.int().nonnegative(),
    subtotal: z.int().nonnegative(),
    taxTotal: z.int().nonnegative(),
  })
  .strict();
