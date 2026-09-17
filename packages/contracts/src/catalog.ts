import * as z from "zod";

import { moneySchema, publicIdSchema } from "./common";

export const catalogPriceSchema = moneySchema
  .extend({ compareAtAmount: z.int().nonnegative().optional() })
  .superRefine((price, context) => {
    if (price.compareAtAmount !== undefined && price.compareAtAmount <= price.amount) {
      context.addIssue({
        code: "custom",
        message: "Compare-at amount must be greater than the current amount.",
        path: ["compareAtAmount"],
      });
    }
  });

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
    price: catalogPriceSchema,
    sku: z.string().min(1).max(80),
  })
  .strict();
export const productOptionValueSchema = z
  .object({
    label: z.string().trim().min(1).max(160),
    swatch: z
      .string()
      .regex(/^#[0-9a-f]{6}$/)
      .optional(),
  })
  .strict();
export const productOptionDefinitionSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    presentation: z.enum(["text", "color"]),
    values: z.array(productOptionValueSchema).min(1).max(100),
  })
  .strict()
  .superRefine((definition, context) => {
    const labels = new Set<string>();
    definition.values.forEach((value, index) => {
      if (labels.has(value.label)) {
        context.addIssue({
          code: "custom",
          message: "Option value labels must be unique within a definition.",
          path: ["values", index, "label"],
        });
      }
      labels.add(value.label);
      if (definition.presentation === "color" && !value.swatch) {
        context.addIssue({
          code: "custom",
          message: "Color-presented option values require a canonical opaque swatch.",
          path: ["values", index, "swatch"],
        });
      }
      if (definition.presentation === "text" && value.swatch) {
        context.addIssue({
          code: "custom",
          message: "Text-presented option values cannot carry a swatch.",
          path: ["values", index, "swatch"],
        });
      }
    });
  });
export const productOptionDefinitionsSchema = z
  .array(productOptionDefinitionSchema)
  .max(20)
  .superRefine((definitions, context) => {
    const names = new Set<string>();
    definitions.forEach((definition, index) => {
      if (names.has(definition.name)) {
        context.addIssue({
          code: "custom",
          message: "Option definition names must be unique within a product.",
          path: [index, "name"],
        });
      }
      names.add(definition.name);
    });
  });
export type ProductOptionDefinition = z.infer<typeof productOptionDefinitionSchema>;

export type ProductOptionDefinitionIssue = {
  message: string;
  path: Array<number | string>;
};

export function deriveTextProductOptionDefinitions(
  variants: readonly { optionValues: Readonly<Record<string, string>> }[],
): ProductOptionDefinition[] {
  const valuesByName = new Map<string, string[]>();
  for (const { optionValues } of variants) {
    for (const [name, value] of Object.entries(optionValues)) {
      const values = valuesByName.get(name) ?? [];
      if (!values.includes(value)) values.push(value);
      valuesByName.set(name, values);
    }
  }
  return [...valuesByName].map(([name, values]) => ({
    name,
    presentation: "text" as const,
    values: values.map((label) => ({ label })),
  }));
}

export function validateProductOptionDefinitions(
  definitions: readonly ProductOptionDefinition[],
  variants: readonly { optionValues: Readonly<Record<string, string>> }[],
): ProductOptionDefinitionIssue[] {
  const issues: ProductOptionDefinitionIssue[] = [];
  const expected = new Map(
    deriveTextProductOptionDefinitions(variants).map(({ name, values }) => [
      name,
      values.map(({ label }) => label),
    ]),
  );
  const signatures = new Map<string, number>();
  variants.forEach(({ optionValues }, variantIndex) => {
    const signature = JSON.stringify(
      Object.entries(optionValues).sort(([left], [right]) => left.localeCompare(right)),
    );
    const duplicateIndex = signatures.get(signature);
    if (duplicateIndex !== undefined) {
      issues.push({
        message: `Variant option combinations must be unique; duplicates variant ${duplicateIndex}.`,
        path: ["variants", variantIndex, "optionValues"],
      });
    } else {
      signatures.set(signature, variantIndex);
    }
  });
  definitions.forEach((definition, definitionIndex) => {
    const expectedValues = expected.get(definition.name);
    if (!expectedValues) {
      issues.push({
        message: "Option definition name is absent from every product variant.",
        path: ["optionDefinitions", definitionIndex, "name"],
      });
      return;
    }
    definition.values.forEach((value, valueIndex) => {
      if (!expectedValues.includes(value.label)) {
        issues.push({
          message: "Option value is absent from every product variant.",
          path: ["optionDefinitions", definitionIndex, "values", valueIndex, "label"],
        });
      }
    });
    expectedValues.forEach((value) => {
      if (!definition.values.some(({ label }) => label === value)) {
        issues.push({
          message: `Option definition does not cover variant value ${value}.`,
          path: ["optionDefinitions", definitionIndex, "values"],
        });
      }
    });
    expected.delete(definition.name);
  });
  for (const name of expected.keys()) {
    issues.push({
      message: `Option definitions do not cover variant option ${name}.`,
      path: ["optionDefinitions"],
    });
  }
  return issues;
}
export const productSpecificationSchema = z
  .object({
    label: z.string().trim().min(1).max(160),
    value: z.string().trim().min(1).max(1_000),
  })
  .strict();
export const productReviewDisplaySchema = z
  .object({
    averageRating: z.number().min(0).max(5),
    count: z.int().nonnegative().max(1_000_000_000),
    entries: z
      .array(
        z
          .object({
            author: z.string().trim().min(1).max(160),
            date: z.string().trim().min(1).max(160),
            id: publicIdSchema.optional(),
            rating: z.int().min(1).max(5).optional(),
            text: z.string().trim().min(1).max(2_000),
          })
          .strict(),
      )
      .max(10_000),
    ratingBands: z
      .tuple([
        z.int().nonnegative(),
        z.int().nonnegative(),
        z.int().nonnegative(),
        z.int().nonnegative(),
        z.int().nonnegative(),
      ])
      .optional(),
    provenance: z.string().trim().min(1).max(300),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((reviewDisplay, context) => {
    if (reviewDisplay.count === 0 && reviewDisplay.averageRating !== 0) {
      context.addIssue({
        code: "custom",
        message: "A zero-review snapshot must have a zero average rating.",
        path: ["averageRating"],
      });
    }
    if (reviewDisplay.entries.length > reviewDisplay.count) {
      context.addIssue({
        code: "custom",
        message: "Displayed review entries cannot exceed the published review count.",
        path: ["entries"],
      });
    }
    if (reviewDisplay.ratingBands) {
      if (
        reviewDisplay.ratingBands.reduce((total, count) => total + count, 0) !== reviewDisplay.count
      ) {
        context.addIssue({
          code: "custom",
          message: "Rating bands must total the review count.",
          path: ["ratingBands"],
        });
      }
      if (
        reviewDisplay.entries.length !== reviewDisplay.count ||
        reviewDisplay.entries.some((entry) => !entry.id || !entry.rating)
      ) {
        context.addIssue({
          code: "custom",
          message: "Modern review snapshots need every rated entry.",
          path: ["entries"],
        });
      }
      if (
        reviewDisplay.entries.length === reviewDisplay.count &&
        reviewDisplay.entries.every((entry) => entry.rating)
      ) {
        const derivedBands = [0, 0, 0, 0, 0];
        for (const entry of reviewDisplay.entries) derivedBands[entry.rating! - 1]! += 1;
        if (derivedBands.some((count, index) => count !== reviewDisplay.ratingBands![index])) {
          context.addIssue({
            code: "custom",
            message: "Rating bands must match published entries.",
            path: ["ratingBands"],
          });
        }
        const average =
          reviewDisplay.count === 0
            ? 0
            : Math.round(
                (reviewDisplay.entries.reduce((sum, entry) => sum + entry.rating!, 0) * 10) /
                  reviewDisplay.count,
              ) / 10;
        if (average !== reviewDisplay.averageRating) {
          context.addIssue({
            code: "custom",
            message: "Average rating must match published entries.",
            path: ["averageRating"],
          });
        }
      }
    }
  });
export type ProductReviewDisplay = z.infer<typeof productReviewDisplaySchema>;

export const submitProductReviewSchema = z
  .object({
    rating: z.int().min(1).max(5),
    displayName: z.string().trim().min(2).max(80),
    body: z.string().trim().min(10).max(2_000),
  })
  .strict();

export const moderateProductReviewSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export type SubmitProductReview = z.infer<typeof submitProductReviewSchema>;
export type ModerateProductReview = z.infer<typeof moderateProductReviewSchema>;
export const productPresentationSchema = z
  .object({
    brand: z.string().trim().min(1).max(160).optional(),
    purchaseStatus: z.enum(["unverified"]).optional(),
    defaultVariantId: publicIdSchema.optional(),
    detail: z
      .object({
        body: z.string().trim().min(1).max(20_000).optional(),
        bullets: z.array(z.string().trim().min(1).max(500)).max(20),
        eyebrow: z.string().trim().min(1).max(160).optional(),
        heading: z.string().trim().min(1).max(300).optional(),
      })
      .strict()
      .optional(),
    detailMediaId: publicIdSchema.optional(),
    colorMediaIds: z
      .record(z.string().trim().min(1).max(160), z.array(publicIdSchema).min(1).max(50))
      .optional(),
    reviewDisplay: productReviewDisplaySchema.optional(),
    specifications: z.array(productSpecificationSchema).max(30),
  })
  .strict()
  .superRefine((presentation, context) => {
    const labels = new Set<string>();
    presentation.specifications.forEach(({ label }, index) => {
      const normalized = label.toLocaleLowerCase();
      if (labels.has(normalized)) {
        context.addIssue({
          code: "custom",
          message: "Specification labels must be unique.",
          path: ["specifications", index, "label"],
        });
      }
      labels.add(normalized);
    });
  });
export type ProductPresentation = z.infer<typeof productPresentationSchema>;
export const productSchema = z
  .object({
    description: z.string(),
    id: publicIdSchema,
    media: z.array(productMediaSchema),
    name: z.string().min(1),
    optionDefinitions: productOptionDefinitionsSchema,
    presentation: productPresentationSchema.optional(),
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
    id: publicIdSchema.optional(),
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
    prices: z.array(catalogPriceSchema).min(1),
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
    optionDefinitions: productOptionDefinitionsSchema.optional(),
    presentation: productPresentationSchema.optional(),
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
    if (product.optionDefinitions) {
      for (const issue of validateProductOptionDefinitions(
        product.optionDefinitions,
        product.variants,
      )) {
        addCatalogReleaseIssue(context, ["products", productIndex, ...issue.path], issue.message);
      }
    }
    if (product.presentation?.defaultVariantId) {
      const defaultVariantIndex = product.variants.findIndex(
        ({ id }) => id === product.presentation?.defaultVariantId,
      );
      if (defaultVariantIndex < 0) {
        addCatalogReleaseIssue(
          context,
          ["products", productIndex, "presentation", "defaultVariantId"],
          "Product presentation references a default Variant outside the Product.",
        );
      }
    }
    if (product.presentation?.detailMediaId) {
      const detailMediaIndex = product.media.findIndex(
        ({ id }) => id === product.presentation?.detailMediaId,
      );
      if (detailMediaIndex < 0) {
        addCatalogReleaseIssue(
          context,
          ["products", productIndex, "presentation", "detailMediaId"],
          "Product presentation references detail media outside the Product.",
        );
      }
    }
    if (product.presentation?.colorMediaIds) {
      const colorValues = new Set(product.variants.map(({ optionValues }) => optionValues.color));
      const mediaIds = new Set(product.media.map(({ id }) => id));
      for (const [color, ids] of Object.entries(product.presentation.colorMediaIds)) {
        if (
          !colorValues.has(color) ||
          ids.some((id) => !mediaIds.has(id)) ||
          new Set(ids).size !== ids.length
        ) {
          addCatalogReleaseIssue(
            context,
            ["products", productIndex, "presentation", "colorMediaIds", color],
            "Color gallery must reference unique media owned by a Product color option.",
          );
        }
      }
    }
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
