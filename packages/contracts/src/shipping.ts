import * as z from "zod";

import { countryCodeSchema, currencyCodeSchema, publicIdSchema } from "./common";

const nullableMinorUnitsSchema = z.int().nonnegative().nullable();
const nullableWeightSchema = z.int().nonnegative().nullable();
const shippingMethodFields = {
  calculationType: z.enum(["flat", "weight"]),
  currency: currencyCodeSchema,
  freeThresholdAmount: nullableMinorUnitsSchema,
  maxWeightGrams: nullableWeightSchema,
  minWeightGrams: nullableWeightSchema,
  name: z.string().trim().min(1).max(120),
  priceAmount: z.int().nonnegative(),
  status: z.enum(["active", "disabled"]),
} as const;

export const shippingMethodConfigurationSchema = z
  .object({
    ...shippingMethodFields,
    id: publicIdSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minWeightGrams !== null &&
      value.maxWeightGrams !== null &&
      value.minWeightGrams > value.maxWeightGrams
    ) {
      context.addIssue({
        code: "custom",
        message: "Minimum weight cannot exceed maximum weight.",
        path: ["maxWeightGrams"],
      });
    }
  });

export const shippingZoneConfigurationSchema = z
  .object({
    countries: z.array(countryCodeSchema).min(1),
    id: publicIdSchema,
    methods: z.array(shippingMethodConfigurationSchema).min(1),
    name: z.string().trim().min(1).max(120),
    status: z.enum(["active", "disabled"]),
  })
  .strict();

const editableShippingMethodSchema = z
  .object({
    ...shippingMethodFields,
    id: publicIdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minWeightGrams !== null &&
      value.maxWeightGrams !== null &&
      value.minWeightGrams > value.maxWeightGrams
    ) {
      context.addIssue({
        code: "custom",
        message: "Minimum weight cannot exceed maximum weight.",
        path: ["maxWeightGrams"],
      });
    }
  });
const editableShippingZoneSchema = shippingZoneConfigurationSchema
  .omit({ id: true, methods: true })
  .extend({
    id: publicIdSchema.optional(),
    methods: z.array(editableShippingMethodSchema).min(1).max(50),
  })
  .superRefine((value, context) => {
    if (new Set(value.countries).size !== value.countries.length) {
      context.addIssue({
        code: "custom",
        message: "Shipping countries must be unique within a zone.",
        path: ["countries"],
      });
    }
    const methodIds = value.methods.flatMap((method) => (method.id ? [method.id] : []));
    if (new Set(methodIds).size !== methodIds.length) {
      context.addIssue({
        code: "custom",
        message: "Shipping method identifiers must be unique.",
        path: ["methods"],
      });
    }
  });

export const upsertShippingZoneRequestSchema = z
  .object({
    confirm: z.literal(true),
    reason: z.string().trim().min(3).max(500),
    zone: editableShippingZoneSchema,
  })
  .strict();

export type ShippingMethodConfiguration = z.infer<typeof shippingMethodConfigurationSchema>;
export type ShippingZoneConfiguration = z.infer<typeof shippingZoneConfigurationSchema>;
export type UpsertShippingZoneRequest = z.infer<typeof upsertShippingZoneRequestSchema>;
