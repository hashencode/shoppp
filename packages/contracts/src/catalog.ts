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

export const stableCatalogReferenceSchema = z.discriminatedUnion("kind", [
  z.object({ id: publicIdSchema, kind: z.literal("collection") }).strict(),
  z.object({ id: publicIdSchema, kind: z.literal("product") }).strict(),
]);

const catalogSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const catalogRouteSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^\/(?!\/)[^\s]*$/);
const releaseIdentifierSchema = z.string().trim().min(1).max(160);
const catalogMediaSchema = z
  .object({
    alt: z.string().trim().min(1).max(300),
    height: z.int().positive().max(16_384),
    src: z
      .string()
      .min(1)
      .max(2_000)
      .refine((value) => {
        if (/^\/(?!\/)[^\s]*$/.test(value)) return !value.includes("..");
        try {
          const url = new URL(value);
          return url.protocol === "https:" && !url.username && !url.password;
        } catch {
          return false;
        }
      }, "Catalog media must use a safe local path or credential-free HTTPS URL."),
    width: z.int().positive().max(16_384),
  })
  .strict();
const catalogReleaseVariantSchema = z
  .object({
    id: publicIdSchema,
    optionValues: z.record(z.string().min(1).max(80), z.string().min(1).max(160)),
    prices: z.array(moneySchema).min(1),
    sku: z.string().trim().min(1).max(80),
    status: z.enum(["active", "disabled"]),
    title: z.string().trim().min(1).max(160),
    weightGrams: z.int().nonnegative(),
  })
  .strict();
const catalogReleaseProductBaseSchema = z
  .object({
    collectionSlugs: z.array(catalogSlugSchema),
    description: z.string().max(50_000),
    media: z.array(catalogMediaSchema).max(50),
    name: z.string().trim().min(1).max(300),
    seoDescription: z.string().trim().min(1).max(500),
    seoTitle: z.string().trim().min(1).max(300),
    slug: catalogSlugSchema,
    status: productStatusSchema,
    variants: z.array(catalogReleaseVariantSchema).min(1).max(500),
  })
  .strict();
const catalogReleaseCollectionBaseSchema = z
  .object({
    description: z.string().max(50_000),
    name: z.string().trim().min(1).max(300),
    productSlugs: z.array(catalogSlugSchema),
    seoDescription: z.string().trim().max(500),
    seoTitle: z.string().trim().min(1).max(300),
    slug: catalogSlugSchema,
    status: z.enum(["draft", "published", "archived"]),
  })
  .strict();
const catalogReleasePolicySchema = z
  .object({
    description: z.string().trim().min(1).max(2_000),
    effectiveDate: z.iso.date(),
    sections: z
      .array(
        z
          .object({
            body: z.string().trim().min(1).max(20_000),
            heading: z.string().trim().min(1).max(300),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    slug: catalogSlugSchema,
    title: z.string().trim().min(1).max(300),
  })
  .strict();
const catalogReleaseSiteSchema = z
  .object({
    defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
    freshnessHours: z.int().positive().max(720),
    name: z.string().trim().min(1).max(200),
    origin: z.url({ protocol: /^https$/ }),
  })
  .strict();
const canonicalRedirectSchema = z
  .object({
    from: catalogRouteSchema,
    status: z.literal(301),
    to: catalogRouteSchema,
  })
  .strict();
const legacyRedirectSchema = z
  .object({
    from: catalogRouteSchema,
    status: z.literal(301).optional(),
    to: catalogRouteSchema,
  })
  .strict();

export const canonicalCatalogReleaseProductSchema = catalogReleaseProductBaseSchema.extend({
  collectionIds: z.array(publicIdSchema),
  id: publicIdSchema,
});
export const legacyCatalogReleaseProductSchema = catalogReleaseProductBaseSchema;
export const canonicalCatalogReleaseCollectionSchema = catalogReleaseCollectionBaseSchema.extend({
  id: publicIdSchema,
  productIds: z.array(publicIdSchema),
});
export const legacyCatalogReleaseCollectionSchema = catalogReleaseCollectionBaseSchema;

const catalogReleaseDocumentBase = {
  policies: z.array(catalogReleasePolicySchema).min(1).max(30),
  releaseId: releaseIdentifierSchema,
  site: catalogReleaseSiteSchema,
};

function addCatalogReleaseIssue(
  context: z.RefinementCtx,
  path: PropertyKey[],
  message: string,
): void {
  context.addIssue({ code: "custom", message, path });
}

function validateUniqueReleaseValues(
  values: readonly string[],
  context: z.RefinementCtx,
  path: PropertyKey[],
  message: string,
): void {
  if (new Set(values).size !== values.length) addCatalogReleaseIssue(context, path, message);
}

function validateCanonicalCatalogRelease(
  release: {
    collections: Array<z.infer<typeof canonicalCatalogReleaseCollectionSchema>>;
    products: Array<z.infer<typeof canonicalCatalogReleaseProductSchema>>;
    routes: string[];
  },
  context: z.RefinementCtx,
): void {
  validateUniqueReleaseValues(
    release.products.map(({ id }) => id),
    context,
    ["products"],
    "Catalog Release product IDs must be unique.",
  );
  validateUniqueReleaseValues(
    release.products.map(({ slug }) => slug),
    context,
    ["products"],
    "Catalog Release product slugs must be unique.",
  );
  validateUniqueReleaseValues(
    release.collections.map(({ id }) => id),
    context,
    ["collections"],
    "Catalog Release collection IDs must be unique.",
  );
  validateUniqueReleaseValues(
    release.collections.map(({ slug }) => slug),
    context,
    ["collections"],
    "Catalog Release collection slugs must be unique.",
  );
  validateUniqueReleaseValues(
    release.products.flatMap(({ variants }) => variants.map(({ id }) => id)),
    context,
    ["products"],
    "Catalog Release variant IDs must be unique.",
  );
  validateUniqueReleaseValues(
    release.routes,
    context,
    ["routes"],
    "Catalog Release routes must be unique.",
  );

  const productsById = new Map(release.products.map((product) => [product.id, product]));
  const collectionsById = new Map(
    release.collections.map((collection) => [collection.id, collection]),
  );
  release.products.forEach((product, productIndex) => {
    validateUniqueReleaseValues(
      product.collectionIds,
      context,
      ["products", productIndex, "collectionIds"],
      "Product collection IDs must be unique.",
    );
    if (product.collectionIds.length !== product.collectionSlugs.length) {
      addCatalogReleaseIssue(
        context,
        ["products", productIndex, "collectionSlugs"],
        "Product collection IDs and slugs must have equal length.",
      );
    }
    product.collectionIds.forEach((collectionId, collectionIndex) => {
      const collection = collectionsById.get(collectionId);
      if (!collection) {
        addCatalogReleaseIssue(
          context,
          ["products", productIndex, "collectionIds", collectionIndex],
          "Product references an unknown collection ID.",
        );
        return;
      }
      if (product.collectionSlugs[collectionIndex] !== collection.slug) {
        addCatalogReleaseIssue(
          context,
          ["products", productIndex, "collectionSlugs", collectionIndex],
          "Product collection ID and slug order must match.",
        );
      }
      if (!collection.productIds.includes(product.id)) {
        addCatalogReleaseIssue(
          context,
          ["products", productIndex, "collectionIds", collectionIndex],
          "Product and collection membership references must be reciprocal.",
        );
      }
    });
  });
  release.collections.forEach((collection, collectionIndex) => {
    validateUniqueReleaseValues(
      collection.productIds,
      context,
      ["collections", collectionIndex, "productIds"],
      "Collection product IDs must be unique.",
    );
    if (collection.productIds.length !== collection.productSlugs.length) {
      addCatalogReleaseIssue(
        context,
        ["collections", collectionIndex, "productSlugs"],
        "Collection product IDs and slugs must have equal length.",
      );
    }
    collection.productIds.forEach((productId, productIndex) => {
      const product = productsById.get(productId);
      if (!product) {
        addCatalogReleaseIssue(
          context,
          ["collections", collectionIndex, "productIds", productIndex],
          "Collection references an unknown product ID.",
        );
        return;
      }
      if (collection.productSlugs[productIndex] !== product.slug) {
        addCatalogReleaseIssue(
          context,
          ["collections", collectionIndex, "productSlugs", productIndex],
          "Collection product ID and slug order must match.",
        );
      }
      if (!product.collectionIds.includes(collection.id)) {
        addCatalogReleaseIssue(
          context,
          ["collections", collectionIndex, "productIds", productIndex],
          "Collection and product membership references must be reciprocal.",
        );
      }
    });
  });
}

export const canonicalCatalogReleaseSchema = z
  .object({
    ...catalogReleaseDocumentBase,
    collections: z.array(canonicalCatalogReleaseCollectionSchema),
    generatedAt: z.iso.datetime(),
    products: z.array(canonicalCatalogReleaseProductSchema),
    redirects: z.array(canonicalRedirectSchema),
    routes: z.array(catalogRouteSchema),
    schemaVersion: z.literal(2),
  })
  .strict()
  .superRefine(validateCanonicalCatalogRelease);

export const legacyCatalogReleaseSchema = z
  .object({
    ...catalogReleaseDocumentBase,
    collections: z.array(legacyCatalogReleaseCollectionSchema),
    generatedAt: z.iso.datetime().optional(),
    products: z.array(legacyCatalogReleaseProductSchema),
    redirects: z.array(legacyRedirectSchema),
    routes: z.array(catalogRouteSchema).optional(),
    schemaVersion: z.literal(1).optional(),
  })
  .strict();

export const catalogReleaseSchema = z.union([
  canonicalCatalogReleaseSchema,
  legacyCatalogReleaseSchema,
]);

export type CanonicalCatalogRelease = z.infer<typeof canonicalCatalogReleaseSchema>;
export type CanonicalCatalogReleaseCollection = z.infer<
  typeof canonicalCatalogReleaseCollectionSchema
>;
export type CanonicalCatalogReleaseProduct = z.infer<typeof canonicalCatalogReleaseProductSchema>;
export type LegacyCatalogRelease = z.infer<typeof legacyCatalogReleaseSchema>;
export type LegacyCatalogReleaseCollection = z.infer<typeof legacyCatalogReleaseCollectionSchema>;
export type LegacyCatalogReleaseProduct = z.infer<typeof legacyCatalogReleaseProductSchema>;
export type CatalogRelease = z.infer<typeof catalogReleaseSchema>;

export type ParsedCatalogRelease =
  | { compatibility: "canonical"; release: CanonicalCatalogRelease }
  | { compatibility: "legacy"; release: LegacyCatalogRelease };

export function parseCatalogRelease(input: unknown): ParsedCatalogRelease {
  const canonical = canonicalCatalogReleaseSchema.safeParse(input);
  if (canonical.success) return { compatibility: "canonical", release: canonical.data };
  return { compatibility: "legacy", release: legacyCatalogReleaseSchema.parse(input) };
}

export function catalogReleaseSupportsStableReferences(
  release: CatalogRelease,
): release is CanonicalCatalogRelease {
  return canonicalCatalogReleaseSchema.safeParse(release).success;
}

function canonicalizeCatalogReleaseValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeCatalogReleaseValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalizeCatalogReleaseValue(entry)]),
  );
}

export function catalogReleaseDigestInput(release: CanonicalCatalogRelease): string {
  const parsed = canonicalCatalogReleaseSchema.parse(release);
  return JSON.stringify(canonicalizeCatalogReleaseValue(parsed));
}

export type StableCatalogReference = z.infer<typeof stableCatalogReferenceSchema>;

export function resolveStableCatalogReference(
  release: CatalogRelease,
  reference: StableCatalogReference,
): CanonicalCatalogReleaseCollection | CanonicalCatalogReleaseProduct {
  const parsedReference = stableCatalogReferenceSchema.parse(reference);
  if (!catalogReleaseSupportsStableReferences(release)) {
    throw new Error("Stable catalog references require a canonical ID-bearing Catalog Release.");
  }
  const values = parsedReference.kind === "product" ? release.products : release.collections;
  const resolved = values.find(({ id }) => id === parsedReference.id);
  if (!resolved) {
    throw new Error(`Catalog ${parsedReference.kind} ${parsedReference.id} is missing.`);
  }
  return resolved;
}
