import * as z from "zod";
import type { InjectionKey } from "vue";

import { fixtureStateSchema, presentationProductSchema } from "@shoppp/contracts";
import type {
  PresentationProductCard,
  PresentationViewModel,
} from "../../../theme-engine/view-models";

/**
 * Explicit compatibility input for source-parity preview product cards.
 * Live commerce cards consume PresentationViewModel instead; FS-U10 owns
 * replacing this compatibility branch with one normalized card ViewModel.
 */
export interface FashionStoreLegacyProductCard {
  badge?: "Hot" | "New";
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
    label: z.string().trim().min(1).max(100),
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
    controls: z.array(z.enum(["add-to-cart", "quick-view", "wishlist"])).max(3),
    destination: productCardDestinationSchema,
    media: productGalleryItemSchema.optional(),
    name: z.string().trim().min(1).max(160),
    priceLabel: z.string().trim().min(1).max(80),
    productId: productIdentifierSchema,
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

export const fashionStoreProductPresentationSchema = z
  .object({
    controls: z.array(productControlSchema).max(8),
    compareAtPriceLabel: z.string().trim().min(1).max(80).optional(),
    currency: z.string().trim().length(3).toUpperCase(),
    description: z.string().trim().min(1).max(2_000),
    gallery: z.array(productGalleryItemSchema).max(12),
    name: z.string().trim().min(1).max(160),
    optionGroups: z.array(productOptionGroupSchema).max(20),
    optionalRegions: z
      .object({
        reviews: z.literal("empty"),
        specifications: z.literal("hidden"),
      })
      .strict(),
    priceLabel: z.string().trim().min(1).max(80),
    productId: productIdentifierSchema,
    relatedProducts: z.array(fashionStoreProductCardPresentationSchema).max(8),
    slug: productSlugSchema,
    state: fixtureStateSchema.exclude(["success"]),
    variants: z.array(productVariantSchema).min(1).max(30),
  })
  .strict();

export type FashionStoreProductPresentation = z.infer<typeof fashionStoreProductPresentationSchema>;

interface FashionStoreFixtureProductPresentationInput {
  data: {
    actions: Readonly<Record<string, { label: string }>>;
    gallery: readonly string[];
    options: {
      colors: readonly { id: string; label: string }[];
      sizes: readonly { id: string; label: string }[];
    };
    product: {
      description: string;
      name: string;
      originalPrice: string;
      price: string;
      sku?: string;
    };
    related: readonly FashionStoreLegacyProductCard[];
  };
  productId: string;
  slug: string;
  state?: FashionStoreProductPresentation["state"];
  variants: readonly {
    id: string;
    label: string;
    optionValues: Readonly<Record<string, string>>;
    selected: boolean;
    sku?: string;
  }[];
}

type LiveProductViewModel = Extract<PresentationViewModel, { kind: "product" }>;

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
    controls: [],
    destination: { href: product.href, kind: "available" },
    media: product.media ? { ...product.media, kind: "url" } : undefined,
    name: product.name,
    priceLabel: product.priceLabel,
    productId: product.productId,
  });
}

function fixtureControls(actions: FashionStoreFixtureProductPresentationInput["data"]["actions"]) {
  const roleByAction = {
    cart: "add-to-cart",
    compare: "compare",
    question: "question",
    share: "share",
    wishlist: "wishlist",
  } as const;
  return Object.entries(roleByAction).flatMap(([key, role]) => {
    const action = actions[key];
    return action ? [{ enabled: true, label: action.label, role }] : [];
  });
}

function liveControls(actions: LiveProductViewModel["actions"]) {
  return actions.map((action) => ({
    enabled: true,
    label: action.label,
    role: action.intent === "variant.select" ? ("select-option" as const) : ("navigate" as const),
  }));
}

export function normalizeFashionStoreFixtureProductPresentation(
  input: FashionStoreFixtureProductPresentationInput,
): FashionStoreProductPresentation {
  const { data } = input;
  return fashionStoreProductPresentationSchema.parse({
    controls: fixtureControls(data.actions),
    compareAtPriceLabel: data.product.originalPrice,
    currency: "USD",
    description: data.product.description,
    gallery: data.gallery.map((path) => ({ kind: "theme-asset", path })),
    name: data.product.name,
    optionGroups: [
      { name: "Color", values: data.options.colors.map(({ label }) => label) },
      { name: "Size", values: data.options.sizes.map(({ label }) => label) },
    ],
    optionalRegions: { reviews: "empty", specifications: "hidden" },
    priceLabel: data.product.price,
    productId: input.productId,
    relatedProducts: data.related
      .slice(0, 8)
      .map((product) => normalizeFashionStoreLegacyProductCard(product, `/products/${product.id}`)),
    slug: input.slug,
    state: input.state ?? "populated",
    variants: input.variants.map((variant) => ({
      ...variant,
      optionValues: { ...variant.optionValues },
      sku: variant.sku ?? data.product.sku,
    })),
  });
}

export function normalizeFashionStoreLiveProductPresentation(
  input: LiveProductViewModel,
): FashionStoreProductPresentation {
  if (!input.resource) {
    throw new Error("Fashion Store live Product presentation requires a Catalog product resource.");
  }
  return fashionStoreProductPresentationSchema.parse({
    controls: liveControls(input.actions),
    compareAtPriceLabel: input.compareAtPriceLabel,
    currency: input.resource.money.currency,
    description: input.description,
    gallery: input.media.map((media) => ({ ...media, kind: "url" })),
    name: input.heading,
    optionGroups: input.optionGroups,
    optionalRegions: { reviews: "empty", specifications: "hidden" },
    priceLabel: input.priceLabel,
    productId: input.resource.id,
    relatedProducts: input.relatedProducts.map(normalizeFashionStoreLiveProductCard),
    slug: input.resource.slug,
    state: input.state === "success" ? "populated" : input.state,
    variants: input.variants,
  });
}

function fixtureVariants(data: FashionStoreFixtureProductPresentationInput["data"]) {
  const colors = data.options.colors;
  const sizes = data.options.sizes;
  return colors.flatMap((color) =>
    sizes.map((size) => ({
      id: `preview-${color.id}-${size.id}`,
      label: `${color.label} / ${size.label}`,
      optionValues: { Color: color.label, Size: size.label },
      selected: color === colors.at(-1) && size === sizes.at(-1),
      sku: data.product.sku,
    })),
  );
}

/** Normalize either serializable Product source before it reaches the shared page. */
export function normalizeFashionStoreProductPresentation(
  input: PresentationViewModel,
): FashionStoreProductPresentation {
  if (input.kind === "product") return normalizeFashionStoreLiveProductPresentation(input);
  if (input.kind !== "theme-section") {
    throw new Error("Fashion Store Product requires a Product presentation source.");
  }
  const data = input.data as unknown as FashionStoreFixtureProductPresentationInput["data"];
  return normalizeFashionStoreFixtureProductPresentation({
    data,
    productId: "preview-relaxed-corduroy-shirt",
    slug: "relaxed-corduroy-shirt",
    state: input.state === "success" ? "populated" : input.state,
    variants: fixtureVariants(data),
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
  gallery: FashionStoreProductPresentation["gallery"];
  optionGroups: FashionStoreProductPresentation["optionGroups"];
  variants: FashionStoreProductPresentation["variants"];
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
}

export const fashionStoreProductActionPortKey = Symbol(
  "fashion-store-product-action-port",
) as InjectionKey<FashionStoreProductActionPort>;
