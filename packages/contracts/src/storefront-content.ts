import * as z from "zod";

import { isoDateTimeSchema, publicIdSchema } from "./common";
import {
  credentialFreeHttpsUrlSchema,
  storefrontResourceReferenceSchema,
  storefrontRoutePathSchema,
} from "./storefront-links";

const stableAuthorityIdSchema = z
  .string()
  .min(3)
  .max(160)
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);
const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const statusSchema = z.enum(["draft", "published", "archived"]);
const safeTextSchema = z
  .string()
  .max(10_000)
  .refine((value) => !/<\/?[a-z][^>]*>/i.test(value), "HTML markup is not allowed.");
const seoSchema = z
  .object({
    description: z.string().trim().max(320),
    title: z.string().trim().min(1).max(160),
  })
  .strict();
const authorityMetadata = {
  createdAt: isoDateTimeSchema,
  id: stableAuthorityIdSchema,
  updatedAt: isoDateTimeSchema,
  version: z.int().positive(),
};

export const storefrontContentSectionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: stableAuthorityIdSchema,
      kind: z.literal("heading"),
      level: z.int().min(2).max(3),
      text: safeTextSchema.trim().min(1).max(200),
    })
    .strict(),
  z
    .object({
      id: stableAuthorityIdSchema,
      kind: z.literal("paragraph"),
      text: safeTextSchema.trim().min(1).max(5_000),
    })
    .strict(),
  z
    .object({
      id: stableAuthorityIdSchema,
      kind: z.literal("list"),
      items: z.array(safeTextSchema.trim().min(1).max(500)).min(1).max(20),
    })
    .strict(),
  z
    .object({
      alt: z.string().trim().min(1).max(300),
      assetId: stableAuthorityIdSchema,
      caption: safeTextSchema.trim().max(500).optional(),
      id: stableAuthorityIdSchema,
      kind: z.literal("image"),
    })
    .strict(),
]);

export const storefrontContentDocumentSchema = z
  .array(storefrontContentSectionSchema)
  .max(40)
  .superRefine((sections, context) => {
    const ids = sections.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "Section IDs must be unique." });
    }
  });

export const storeIdentitySchema = z
  .object({
    ...authorityMetadata,
    faviconAssetId: stableAuthorityIdSchema.optional(),
    logoAssets: z
      .array(
        z
          .object({
            assetId: stableAuthorityIdSchema,
            variant: z.enum(["primary", "light", "dark", "compact"]),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    seo: seoSchema,
    socialShareAssetId: stableAuthorityIdSchema.optional(),
    status: statusSchema,
    storefrontName: z.string().trim().min(1).max(120),
    tagline: safeTextSchema.trim().max(240),
  })
  .strict()
  .superRefine((identity, context) => {
    if (identity.id !== "identity.primary") {
      context.addIssue({
        code: "custom",
        path: ["id"],
        message: "Store Identity uses the fixed identity.primary singleton ID.",
      });
    }
    const assetIds = identity.logoAssets.map(({ assetId }) => assetId);
    const variants = identity.logoAssets.map(({ variant }) => variant);
    if (new Set(assetIds).size !== assetIds.length) {
      context.addIssue({
        code: "custom",
        path: ["logoAssets"],
        message: "Logo asset IDs must be unique.",
      });
    }
    if (new Set(variants).size !== variants.length) {
      context.addIssue({
        code: "custom",
        path: ["logoAssets"],
        message: "Logo variants must be unique.",
      });
    }
  });

export const policyAuthoritySchema = z
  .object({
    ...authorityMetadata,
    approvalDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    approvedAt: isoDateTimeSchema.optional(),
    approvedBy: publicIdSchema.optional(),
    effectiveDate: z.iso.date(),
    kind: z.enum(["privacy", "returns", "shipping", "terms"]),
    publishedAt: isoDateTimeSchema.optional(),
    sections: storefrontContentDocumentSchema.min(1),
    slug: slugSchema,
    status: z.enum(["draft", "approved", "published", "archived"]),
    title: z.string().trim().min(1).max(160),
  })
  .strict()
  .superRefine((policy, context) => {
    if (["approved", "published"].includes(policy.status)) {
      for (const field of ["approvalDigest", "approvedAt", "approvedBy"] as const) {
        if (!policy[field])
          context.addIssue({
            code: "custom",
            path: [field],
            message: `${field} is required after approval.`,
          });
      }
    }
    if (policy.status === "published" && !policy.publishedAt) {
      context.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "publishedAt is required when published.",
      });
    }
  });

const contentAuthorityShape = {
  ...authorityMetadata,
  body: storefrontContentDocumentSchema,
  publishedAt: isoDateTimeSchema.optional(),
  seo: seoSchema,
  slug: slugSchema,
  status: statusSchema,
  summary: safeTextSchema.trim().max(500),
  title: z.string().trim().min(1).max(160),
};

export const contentPageSchema = z.object(contentAuthorityShape).strict();
export const contentArticleSchema = z
  .object({ ...contentAuthorityShape, coverAssetId: stableAuthorityIdSchema.optional() })
  .strict();

const navigationTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("internal"), reference: storefrontResourceReferenceSchema }).strict(),
  z.object({ kind: z.literal("route"), path: storefrontRoutePathSchema }).strict(),
  z.object({ kind: z.literal("external"), url: credentialFreeHttpsUrlSchema }).strict(),
]);

export const navigationMenuSchema = z
  .object({
    ...authorityMetadata,
    items: z
      .array(
        z
          .object({
            id: stableAuthorityIdSchema,
            label: z.string().trim().min(1).max(120),
            parentId: stableAuthorityIdSchema.nullable(),
            position: z.int().nonnegative(),
            target: navigationTargetSchema,
          })
          .strict(),
      )
      .max(100),
    placement: z.enum(["header", "footer"]),
    status: statusSchema,
  })
  .strict()
  .superRefine((menu, context) => {
    const ids = new Set(menu.items.map(({ id }) => id));
    if (ids.size !== menu.items.length)
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Navigation item IDs must be unique.",
      });
    const siblingPositions = menu.items.map(
      ({ parentId, position }) => `${parentId ?? "root"}:${position}`,
    );
    if (new Set(siblingPositions).size !== siblingPositions.length)
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Sibling positions must be unique.",
      });
    for (const [index, item] of menu.items.entries()) {
      if (
        item.parentId &&
        (!ids.has(item.parentId) || menu.items.find(({ id }) => id === item.parentId)?.parentId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "parentId"],
          message: "Navigation supports at most two levels and requires a declared parent.",
        });
      }
    }
  });

export const collectionAuthoritySchema = z
  .object({
    ...authorityMetadata,
    coverAssetId: stableAuthorityIdSchema.nullable(),
    description: safeTextSchema.trim().max(5_000),
    memberships: z
      .array(z.object({ position: z.int().nonnegative(), productId: publicIdSchema }).strict())
      .max(5_000),
    name: z.string().trim().min(1).max(160),
    seo: seoSchema,
    slug: slugSchema,
    status: statusSchema,
  })
  .strict()
  .superRefine((collection, context) => {
    const products = collection.memberships.map(({ productId }) => productId);
    const positions = collection.memberships.map(({ position }) => position);
    if (new Set(products).size !== products.length)
      context.addIssue({
        code: "custom",
        path: ["memberships"],
        message: "Products must be unique.",
      });
    if (new Set(positions).size !== positions.length)
      context.addIssue({
        code: "custom",
        path: ["memberships"],
        message: "Positions must be unique.",
      });
  });

export const authorityWriteRequestSchema = z
  .object({ expectedVersion: z.int().positive(), reason: z.string().trim().min(3).max(500) })
  .strict();

export type CollectionAuthority = z.infer<typeof collectionAuthoritySchema>;
export type NavigationMenu = z.infer<typeof navigationMenuSchema>;
export type PolicyAuthority = z.infer<typeof policyAuthoritySchema>;
export type StoreIdentity = z.infer<typeof storeIdentitySchema>;
