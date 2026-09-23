import * as z from "zod";
import type { InjectionKey } from "vue";

import {
  fixtureStateSchema,
  presentationProductSchema,
  productOptionDefinitionsSchema,
} from "@shoppp/contracts";
import type { PresentationProductCard, ProductPageModel } from "../../../theme-engine/view-models";
import { presentationProductCardSchema } from "../../../theme-engine/view-models";

/**
 * Explicit compatibility input for source-parity preview product cards.
 * Live commerce cards consume PresentationViewModel instead; FS-U10 owns
 * replacing this compatibility branch with one normalized card ViewModel.
 */
export interface FashionStoreLegacyProductCard {
  badge?: "Hot" | "New" | undefined;
  categories: readonly string[];
  colors: readonly string[];
  id: string;
  name: string;
  originalPrice: string;
  price: string;
  sizes: readonly string[];
  sourceImage: string;
  tags: readonly string[];
}

const productIdentifierSchema = z.string().trim().min(1).max(160);
const productSlugSchema = presentationProductSchema.shape.slug;
const productOptionGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    values: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
  })
  .strict();
const productVariantSchema = z
  .object({
    availability: z.enum(["in-stock", "out-of-stock"]).optional(),
    compareAtPriceLabel: z.string().trim().min(1).max(80).optional(),
    id: productIdentifierSchema,
    label: z.string().trim().min(1).max(160),
    optionValues: z.record(z.string().trim().min(1).max(80), z.string().trim().min(1).max(160)),
    priceLabel: z.string().trim().min(1).max(80).optional(),
    selected: z.boolean(),
    sku: z.string().trim().min(1).max(160).optional(),
  })
  .strict();
const productGalleryItemSchema = z.discriminatedUnion("kind", [
  z
    .object({
      alt: z.string().trim().min(1).max(300).optional(),
      kind: z.literal("theme-asset"),
      path: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      alt: z.string().trim().min(1).max(300),
      height: z.number().int().positive(),
      kind: z.literal("url"),
      src: z
        .string()
        .trim()
        .min(1)
        .max(2_000)
        .refine((value) => value.startsWith("https://") || /^\/(?!\/)/.test(value)),
      width: z.number().int().positive(),
    })
    .strict(),
]);
const productSpecificationSchema = z
  .object({
    label: z.string().trim().min(1).max(160),
    value: z.string().trim().min(1).max(1_000),
  })
  .strict();
const productReviewSchema = z
  .object({
    author: z.string().trim().min(1).max(160),
    date: z.string().trim().min(1).max(160),
    id: z.string().trim().min(1).max(100).optional(),
    media: productGalleryItemSchema.optional(),
    rating: z.number().int().min(1).max(5).optional(),
    text: z.string().trim().min(1).max(2_000),
  })
  .strict();
const productCardDestinationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      href: z.string().regex(/^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
      kind: z.literal("available"),
    })
    .strict(),
  z.object({ kind: z.literal("unavailable") }).strict(),
]);
const productActionStateSchema = z
  .object({
    kind: z.enum(["loading", "available", "pending", "unavailable", "retry", "succeeded"]),
    message: z.string().trim().min(1).max(240),
  })
  .strict();

export const fashionStoreProductCardPresentationSchema = z
  .object({
    actionState: productActionStateSchema,
    badge: z.enum(["Hot", "New"]).optional(),
    compareAtPriceLabel: z.string().trim().min(1).max(80).optional(),
    commerce: z
      .object({
        currency: presentationProductCardSchema.shape.currency,
        slug: presentationProductCardSchema.shape.slug,
        staticPurchase: presentationProductCardSchema.shape.staticPurchase,
      })
      .strict()
      .optional(),
    controls: z.array(z.enum(["add-to-cart", "quick-view", "wishlist"])).max(3),
    destination: productCardDestinationSchema,
    media: productGalleryItemSchema.optional(),
    name: z.string().trim().min(1).max(160),
    priceLabel: z.string().trim().min(1).max(80),
    productId: productIdentifierSchema,
    visualVariant: presentationProductCardSchema.shape.visualVariant.optional(),
  })
  .strict();

export type FashionStoreProductCardPresentation = z.infer<
  typeof fashionStoreProductCardPresentationSchema
>;

const productControlSchema = z
  .object({
    enabled: z.boolean(),
    label: z.string().trim().min(1).max(120),
    role: z.enum([
      "add-to-cart",
      "compare",
      "navigate",
      "question",
      "select-option",
      "share",
      "wishlist",
    ]),
  })
  .strict();

const unavailableProductRegions = {
  assurance: "hidden",
  delivery: "hidden",
  reviews: "source-shaped-empty",
  shipping: "source-shaped-empty",
  specifications: "source-shaped-empty",
  taxonomy: "hidden",
} as const;

const paymentBrandLabels = {
  visa: "Visa",
  mastercard: "Mastercard",
  "american-express": "American Express",
  discover: "Discover",
  "diners-club": "Diners Club",
  "union-pay": "UnionPay",
} as const;

export const fashionStoreProductPresentationSchema = z
  .object({
    controls: z.array(productControlSchema).max(8),
    assurance: z
      .object({
        categories: z.array(z.string().trim().min(1).max(160)).max(20),
        deliverySummary: z.string().trim().min(1).max(300).optional(),
        shippingReturnsSummary: z.string().trim().min(1).max(300).optional(),
        payments: z.array(productGalleryItemSchema).max(12),
        tags: z.array(z.string().trim().min(1).max(160)).max(20),
      })
      .strict()
      .optional(),
    brand: z.string().trim().min(1).max(160).optional(),
    purchaseStatus: z.enum(["unverified"]).optional(),
    compareAtPriceLabel: z.string().trim().min(1).max(80).optional(),
    currency: z.string().trim().length(3).toUpperCase(),
    description: z.string().trim().min(1).max(50_000),
    descriptionDetail: z
      .object({
        bullets: z.array(z.string().trim().min(1).max(500)).max(20),
        eyebrow: z.string().trim().min(1).max(160).optional(),
        heading: z.string().trim().min(1).max(300),
        media: productGalleryItemSchema.optional(),
        text: z.string().trim().min(1).max(20_000),
      })
      .strict(),
    gallery: z.array(productGalleryItemSchema).max(50),
    colorGalleries: z
      .record(z.string(), z.array(productGalleryItemSchema).min(1).max(50))
      .optional(),
    name: z.string().trim().min(1).max(300),
    optionDefinitions: productOptionDefinitionsSchema,
    optionGroups: z.array(productOptionGroupSchema).max(20),
    optionalRegions: z
      .object({
        assurance: z.enum(["hidden", "populated", "source-shaped-empty"]),
        delivery: z.enum(["hidden", "populated", "source-shaped-empty"]),
        reviews: z.enum(["hidden", "populated", "source-shaped-empty"]),
        shipping: z.enum(["hidden", "populated", "source-shaped-empty"]),
        specifications: z.enum(["hidden", "populated", "source-shaped-empty"]),
        taxonomy: z.enum(["hidden", "populated", "source-shaped-empty"]),
      })
      .strict(),
    priceLabel: z.string().trim().min(1).max(80),
    productId: productIdentifierSchema,
    publishedRoutes: z.array(z.string().startsWith("/")).max(10_000),
    relatedProducts: z.array(fashionStoreProductCardPresentationSchema).max(8),
    reviewSummary: z
      .object({
        averageRating: z.number().min(0).max(5).default(0),
        count: z.number().int().nonnegative(),
        label: z.string().trim().min(1).max(80),
        ratingBands: z
          .tuple([
            z.number().int().nonnegative(),
            z.number().int().nonnegative(),
            z.number().int().nonnegative(),
            z.number().int().nonnegative(),
            z.number().int().nonnegative(),
          ])
          .optional(),
      })
      .strict(),
    reviews: z.array(productReviewSchema).max(10_000),
    slug: productSlugSchema,
    siteName: z.string().trim().min(1).max(160),
    state: fixtureStateSchema.exclude(["success"]),
    shipping: z
      .object({
        returnBody: z.string().trim().min(1).max(2_000),
        standard: z.string().trim().min(1).max(2_000),
      })
      .strict()
      .optional(),
    specifications: z.array(productSpecificationSchema).max(30),
    taxonomy: z
      .object({
        categories: z.array(z.string().trim().min(1).max(160)).max(20),
        tags: z.array(z.string().trim().min(1).max(160)).max(20),
      })
      .strict(),
    variants: z.array(productVariantSchema).min(1).max(500),
  })
  .strict();

export type FashionStoreProductPresentation = z.infer<typeof fashionStoreProductPresentationSchema>;

export function normalizeFashionStoreLegacyProductCard(
  product: FashionStoreLegacyProductCard,
  href?: string,
): FashionStoreProductCardPresentation {
  return fashionStoreProductCardPresentationSchema.parse({
    actionState: { kind: "available", message: "This preview action is available locally." },
    badge: product.badge,
    compareAtPriceLabel: product.originalPrice,
    controls: ["add-to-cart", "quick-view", "wishlist"],
    destination: href ? { href, kind: "available" } : { kind: "unavailable" },
    media: { alt: product.name, kind: "theme-asset", path: product.sourceImage },
    name: product.name,
    priceLabel: product.price,
    productId: product.id,
  });
}

export function normalizeFashionStoreLiveProductCard(
  product: PresentationProductCard,
): FashionStoreProductCardPresentation {
  return fashionStoreProductCardPresentationSchema.parse({
    actionState: product.actionState,
    compareAtPriceLabel: product.compareAtPriceLabel,
    commerce: {
      currency: product.currency,
      slug: product.slug,
      staticPurchase: product.staticPurchase,
    },
    controls: [],
    destination: { href: product.href, kind: "available" },
    media: product.media ? { ...product.media, kind: "url" } : undefined,
    name: product.name,
    priceLabel: product.priceLabel,
    productId: product.productId,
    visualVariant: product.visualVariant,
  });
}

function liveControls(actions: ProductPageModel["actions"]) {
  return [
    ...actions.map((action) => ({
      enabled: true,
      label: action.label,
      role: action.intent === "variant.select" ? ("select-option" as const) : ("navigate" as const),
    })),
    { enabled: false, label: "Ask a question", role: "question" as const },
    { enabled: false, label: "Share", role: "share" as const },
    { enabled: false, label: "Add to wishlist", role: "wishlist" as const },
  ];
}

const fashionStoreThemeAssetPrefix = "/media/fashion-store-theme/";

function normalizeProductMedia(media: ProductPageModel["media"][number]) {
  if (media.src.startsWith(fashionStoreThemeAssetPrefix)) {
    const filename = media.src.slice(fashionStoreThemeAssetPrefix.length);
    if (/^[a-z0-9][a-z0-9._-]*$/i.test(filename)) {
      return { alt: media.alt, kind: "theme-asset" as const, path: `images/${filename}` };
    }
  }
  return { ...media, kind: "url" as const };
}

export function normalizeFashionStoreProductPresentation(
  input: ProductPageModel,
): FashionStoreProductPresentation {
  if (!input.resource) {
    throw new Error("Fashion Store live Product presentation requires a Catalog product resource.");
  }
  const optionDefinitions =
    input.optionDefinitions && input.optionDefinitions.length > 0
      ? input.optionDefinitions
      : input.optionGroups.map(({ name, values }) => ({
          name,
          presentation: "text" as const,
          values: values.map((label) => ({ label })),
        }));
  const paymentBrands = input.paymentBrands ?? [];
  return fashionStoreProductPresentationSchema.parse({
    assurance:
      paymentBrands.length || input.deliverySummary || input.shippingReturnsSummary
        ? {
            categories: input.taxonomy.categories,
            deliverySummary: input.deliverySummary,
            payments: paymentBrands.map((brand) => ({
              alt: paymentBrandLabels[brand],
              kind: "theme-asset" as const,
              path: `images/${brand}.svg`,
            })),
            tags: input.taxonomy.tags,
            shippingReturnsSummary: input.shippingReturnsSummary,
          }
        : undefined,
    brand: input.brand,
    purchaseStatus: input.purchaseStatus,
    controls: liveControls(input.actions),
    compareAtPriceLabel: input.compareAtPriceLabel,
    currency: input.resource.money.currency,
    description: input.description,
    descriptionDetail: {
      ...input.descriptionDetail,
      media: input.descriptionDetail.media
        ? normalizeProductMedia(input.descriptionDetail.media)
        : undefined,
    },
    gallery: input.media.map(normalizeProductMedia),
    colorGalleries: input.colorMedia
      ? Object.fromEntries(
          Object.entries(input.colorMedia).map(([color, media]) => [
            color,
            media.map(normalizeProductMedia),
          ]),
        )
      : undefined,
    name: input.heading,
    optionDefinitions,
    optionGroups: input.optionGroups,
    optionalRegions: {
      ...unavailableProductRegions,
      ...(paymentBrands.length || input.deliverySummary || input.shippingReturnsSummary
        ? { assurance: "populated" as const }
        : {}),
      ...(input.deliverySummary ? { delivery: "populated" as const } : {}),
      ...(input.shipping ? { shipping: "populated" as const } : {}),
      ...(input.specifications.length
        ? { specifications: "populated" as const }
        : { specifications: "source-shaped-empty" as const }),
      ...(input.reviewSummary.count > 0 || (input.reviews?.length ?? 0) > 0
        ? { reviews: "populated" as const }
        : { reviews: "source-shaped-empty" as const }),
      ...(input.taxonomy.categories.length || input.taxonomy.tags.length
        ? { taxonomy: "populated" as const }
        : {}),
    },
    priceLabel: input.priceLabel,
    productId: input.resource.id,
    publishedRoutes: input.publishedRoutes,
    relatedProducts: input.relatedProducts.map(normalizeFashionStoreLiveProductCard),
    reviewSummary: input.reviewSummary,
    reviews: input.reviews ?? [],
    slug: input.resource.slug,
    siteName: input.siteName,
    state: input.state === "success" ? "populated" : input.state,
    shipping: input.shipping
      ? {
          returnBody: input.shipping.returnBody,
          standard: input.shipping.standard,
        }
      : undefined,
    specifications: input.specifications,
    taxonomy: input.taxonomy,
    variants: input.variants,
  });
}

export interface FashionStoreProductActionInput {
  currency: string;
  media?: FashionStoreProductPresentation["gallery"][number];
  optionValues: Readonly<Record<string, string>>;
  priceLabel: string;
  productId: string;
  productName: string;
  quantity: number;
  slug: string;
  variantId: string;
}

export interface FashionStoreProductActionOutcome {
  kind: "succeeded" | "unavailable" | "incomplete" | "failed";
  message: string;
  priceLabel?: string;
}

export interface FashionStoreProductRuntimeState {
  availability: "in-stock" | "out-of-stock" | "unavailable";
  variants: FashionStoreProductPresentation["variants"];
}

export interface FashionStoreProductReviewInput {
  body: string;
  consentAccepted: true;
  displayName: string;
  email: string;
  rating: number;
}

/**
 * Components depend on this Fashion-owned port. Fixture and live adapters own
 * simulation and Commerce revalidation respectively, outside serializable render data.
 */
export interface FashionStoreProductActionPort {
  addToCart(input: FashionStoreProductActionInput): Promise<FashionStoreProductActionOutcome>;
  authoritative: boolean;
  perform(input: { label: string; role: "compare" | "question" | "share" | "wishlist" }): void;
  revalidate(): Promise<FashionStoreProductRuntimeState | null>;
  submitReview(
    input: FashionStoreProductReviewInput,
    idempotencyKey: string,
  ): Promise<{ message: string }>;
}

export const fashionStoreProductActionPortKey = Symbol(
  "fashion-store-product-action-port",
) as InjectionKey<FashionStoreProductActionPort>;
