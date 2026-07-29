import * as z from "zod";

import { moneySchema, publicIdSchema } from "./common";

export const productStatusSchema = z.enum(["draft", "scheduled", "published", "archived"]);
export const catalogBuildResultSchema = z
  .object({
    failureCode: z.string().trim().min(3).max(120).optional(),
    status: z.enum(["deployed", "failed"]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "failed" && !value.failureCode) {
      context.addIssue({
        code: "custom",
        message: "A failure code is required for a failed catalog build.",
        path: ["failureCode"],
      });
    }
    if (value.status === "deployed" && value.failureCode) {
      context.addIssue({
        code: "custom",
        message: "A deployed catalog build cannot include a failure code.",
        path: ["failureCode"],
      });
    }
  });
export const productMediaSchema = z
  .object({
    alt: z.string().min(1),
    height: z.int().positive(),
    id: publicIdSchema,
    position: z.int().nonnegative(),
    src: z.url(),
    width: z.int().positive(),
  })
  .strict();
export const productVariantSchema = z
  .object({
    available: z.boolean(),
    id: publicIdSchema,
    options: z.record(z.string(), z.string()),
    price: moneySchema,
    sku: z.string().min(1).max(80),
  })
  .strict();
export const productSchema = z
  .object({
    description: z.string(),
    id: publicIdSchema,
    media: z.array(productMediaSchema),
    name: z.string().min(1),
    options: z.array(
      z
        .object({
          name: z.string().min(1),
          values: z.array(z.string().min(1)).min(1),
        })
        .strict(),
    ),
    seo: z
      .object({
        description: z.string().min(1),
        title: z.string().min(1),
      })
      .strict(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    status: productStatusSchema,
    variants: z.array(productVariantSchema).min(1),
  })
  .strict();

export type Product = z.infer<typeof productSchema>;
export type CatalogBuildResult = z.infer<typeof catalogBuildResultSchema>;
