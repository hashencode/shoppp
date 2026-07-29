import * as z from "zod";

const priceSchema = z
  .object({
    amount: z.int().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    priceListCode: z.string().min(2).max(64),
  })
  .strict();

const variantSchema = z
  .object({
    optionValues: z.record(z.string(), z.string().min(1)).default({}),
    prices: z.array(priceSchema).min(1),
    sku: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(160),
    weightGrams: z.int().nonnegative(),
    dimensionsMm: z
      .object({
        height: z.int().nonnegative(),
        length: z.int().nonnegative(),
        width: z.int().nonnegative(),
      })
      .strict()
      .default({ height: 0, length: 0, width: 0 }),
  })
  .strict();

const mediaSchema = z
  .object({
    altText: z.string().trim().min(1).max(300),
    height: z.int().positive(),
    r2Key: z.string().regex(/^catalog\/[a-zA-Z0-9/_\-.]+$/),
    width: z.int().positive(),
  })
  .strict();

export const productDraftSchema = z
  .object({
    categories: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(160),
            slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          })
          .strict(),
      )
      .default([]),
    collections: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(160),
            slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          })
          .strict(),
      )
      .default([]),
    description: z.string().trim().min(1).max(20_000),
    media: z.array(mediaSchema).min(1).max(20),
    name: z.string().trim().min(1).max(200),
    seoDescription: z.string().trim().min(1).max(320),
    seoTitle: z.string().trim().min(1).max(70),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    publicationStatus: z.enum(["draft", "scheduled"]).default("draft"),
    scheduledAt: z.iso.datetime().nullable().default(null),
    variants: z.array(variantSchema).min(1).max(100),
  })
  .strict();

export const publicationSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

export type ProductDraftInput = z.infer<typeof productDraftSchema>;
