import {
  fixtureStateSchema,
  pageTypeSchema,
  presentationCollectionSchema,
  presentationMediaSchema,
  presentationProductSchema,
  productOptionDefinitionsSchema,
  publicIdSchema,
  publicContactSchema,
  storefrontLinkTargetBehaviorSchema,
  storefrontIdentifierSchema,
  themeAssetReferenceSchema,
  type FixtureBinding,
  type PresentationCollection,
  type PresentationProduct,
} from "@shoppp/contracts";
import * as z from "zod";

import { previewActionSchema } from "./actions";

const stateShape = {
  state: fixtureStateSchema,
};
const headingSchema = z.string().trim().min(1).max(300);
const copySchema = z.string().trim().min(1).max(2_000);
const safeMediaSourceSchema = z
  .string()
  .min(1)
  .max(2_000)
  .refine((value) => {
    if (/^\/media\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(value)) {
      return !value.includes("..") && !value.includes("//");
    }
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  });
const mediaSchema = presentationMediaSchema.extend({ src: safeMediaSourceSchema });
const editorMediaSchema = z.discriminatedUnion("source", [
  mediaSchema.extend({ source: z.literal("url") }),
  presentationMediaSchema.omit({ src: true }).extend({
    source: z.literal("theme"),
    themePath: themeAssetReferenceSchema.shape.path,
  }),
]);
const presentationLinkSchema = z
  .object({
    href: z.string().min(1).max(2_000),
    label: z.string().trim().min(1).max(120),
    targetBehavior: storefrontLinkTargetBehaviorSchema,
  })
  .strict();
const shellNavigationChildSchema = z
  .object({
    children: z.array(z.never()).max(0).default([]),
    href: z.string().min(1).max(2_000),
    id: storefrontIdentifierSchema,
    label: z.string().trim().min(1).max(120),
    targetBehavior: storefrontLinkTargetBehaviorSchema,
  })
  .strict();
const shellNavigationItemSchema = shellNavigationChildSchema.extend({
  children: z.array(shellNavigationChildSchema).max(100).default([]),
});
const shellNavigationSchema = z
  .object({
    id: storefrontIdentifierSchema,
    items: z.array(shellNavigationItemSchema).max(100),
    version: z.int().positive(),
  })
  .strict();
const legacyNavigationLinkSchema = z
  .object({
    href: z.string().min(1).max(2_000),
    id: storefrontIdentifierSchema,
    label: z.string().trim().min(1).max(120),
  })
  .strict();
const legacyNavigationPlaceholderSchema = z
  .object({
    disabled: z.literal(true),
    id: storefrontIdentifierSchema,
    label: z.string().trim().min(1).max(120),
  })
  .strict();
const legacyNavigationEntrySchema = z.union([
  legacyNavigationLinkSchema,
  legacyNavigationPlaceholderSchema,
]);
const legacyHeaderLinkSchema = legacyNavigationLinkSchema.extend({ kind: z.literal("link") });
const legacyHeaderGroupedMenuSchema = legacyNavigationLinkSchema.extend({
  banners: z.array(
    z.object({ assetPath: z.string().min(1), id: storefrontIdentifierSchema }).strict(),
  ),
  groups: z.array(
    z
      .object({
        id: storefrontIdentifierSchema,
        items: z.array(legacyNavigationPlaceholderSchema),
        label: z.string().trim().min(1).max(120),
      })
      .strict(),
  ),
  kind: z.literal("grouped-menu"),
});
const legacyHeaderCardMenuSchema = legacyNavigationLinkSchema.extend({
  cards: z.array(
    z
      .object({
        assetPath: z.string().min(1),
        disabled: z.literal(true),
        id: storefrontIdentifierSchema,
        label: z.string().trim().min(1).max(120),
      })
      .strict(),
  ),
  kind: z.literal("card-menu"),
});
const legacyHeaderMenuSchema = z
  .object({
    id: storefrontIdentifierSchema,
    items: z.array(legacyNavigationLinkSchema),
    kind: z.literal("menu"),
    label: z.string().trim().min(1).max(120),
  })
  .strict();
const legacyHeaderNavigationSchema = z
  .object({
    id: storefrontIdentifierSchema,
    left: z.array(
      z.discriminatedUnion("kind", [
        legacyHeaderLinkSchema,
        legacyHeaderGroupedMenuSchema,
        legacyHeaderCardMenuSchema,
      ]),
    ),
    right: z.array(z.discriminatedUnion("kind", [legacyHeaderLinkSchema, legacyHeaderMenuSchema])),
    version: z.literal(1),
  })
  .strict();
const legacyFooterNavigationSchema = z
  .object({
    columns: z.array(
      z
        .object({
          id: storefrontIdentifierSchema,
          items: z.array(legacyNavigationEntrySchema),
          label: z.string().trim().min(1).max(120),
        })
        .strict(),
    ),
    id: storefrontIdentifierSchema,
    primary: z.array(legacyNavigationLinkSchema),
    version: z.literal(1),
  })
  .strict();
const shellContactSchema = z
  .object({
    contactVersion: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    contactCopy: copySchema.optional(),
    legalLink: presentationLinkSchema.optional(),
    logo: editorMediaSchema.optional(),
    logoPresentation: z
      .object({
        assetId: z.string().min(1).max(160),
        mobileVisible: z.boolean(),
        placement: z.enum(["start", "center", "end"]),
        spacing: z.number().int().min(0).max(80),
        variant: z.enum(["primary", "light", "dark", "compact"]),
        visible: z.boolean(),
        width: z.number().int().min(48).max(320),
      })
      .strict()
      .optional(),
    legacyNavigation: legacyFooterNavigationSchema.optional(),
    navigation: shellNavigationSchema.optional(),
    publicContact: publicContactSchema.optional(),
    socialLink: presentationLinkSchema.optional(),
  })
  .strict();
export const presentationShellViewModelSchema = z
  .object({
    announcement: copySchema.optional(),
    announcementLink: presentationLinkSchema.optional(),
    footer: shellContactSchema,
    header: shellContactSchema.extend({
      highlightLink: presentationLinkSchema.optional(),
      legacyNavigation: legacyHeaderNavigationSchema.optional(),
    }),
    publishedRoutes: z.array(z.string().startsWith("/")).max(10_000).optional(),
    siteName: headingSchema,
  })
  .strict();
export const presentationShellRenderViewModelSchema = presentationShellViewModelSchema.partial();
export const platformRoutePresentationViewModelSchema = z.discriminatedUnion("kind", [
  z
    .object({
      helpCopy: copySchema.optional(),
      kind: z.literal("order-presentation"),
      policyLink: presentationLinkSchema.optional(),
    })
    .strict(),
  z
    .object({
      documentLink: presentationLinkSchema.optional(),
      helpCopy: copySchema.optional(),
      kind: z.literal("policy-presentation"),
      relatedLink: presentationLinkSchema.optional(),
    })
    .strict(),
]);
const productSummarySchema = z
  .object({
    compareAtPriceLabel: z.string().trim().min(1).max(80).optional(),
    href: z.string().regex(/^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
    id: z.union([storefrontIdentifierSchema, publicIdSchema]),
    media: mediaSchema.optional(),
    name: headingSchema,
    priceLabel: z.string().trim().min(1).max(80),
  })
  .strict();

export const publicPaymentBrands = [
  "visa",
  "mastercard",
  "american-express",
  "discover",
  "diners-club",
  "union-pay",
] as const;

export const presentationProductCardSchema = z
  .object({
    actionState: z
      .object({
        kind: z.enum(["loading", "available", "pending", "unavailable", "retry", "succeeded"]),
        message: z.string().trim().min(1).max(240),
      })
      .strict(),
    currency: z.string().trim().length(3).toUpperCase(),
    compareAtPriceLabel: z.string().trim().min(1).max(80).optional(),
    href: z.string().regex(/^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
    id: publicIdSchema,
    media: mediaSchema.optional(),
    name: headingSchema,
    priceLabel: z.string().trim().min(1).max(80),
    productId: publicIdSchema,
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    staticPurchase: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("direct-add"),
          label: z.string().trim().min(1).max(80),
          productId: publicIdSchema,
          variantId: publicIdSchema,
        })
        .strict(),
      z
        .object({
          href: z.string().regex(/^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
          kind: z.literal("choose-options"),
          label: z.string().trim().min(1).max(80),
          productId: publicIdSchema,
        })
        .strict(),
    ]),
    variantIds: z.array(publicIdSchema).min(1).max(500),
    visualVariant: z.enum(["default", "home"]),
  })
  .strict();

const homeSectionSequenceSchema = z.tuple([
  z.object({ kind: z.literal("hero") }).strict(),
  z.object({ kind: z.literal("services") }).strict(),
  z.object({ kind: z.literal("categories") }).strict(),
  z.object({ kind: z.literal("best-sellers") }).strict(),
  z.object({ kind: z.literal("promotion") }).strict(),
  z.object({ kind: z.literal("collection") }).strict(),
  z.object({ kind: z.literal("brands") }).strict(),
  z.object({ kind: z.literal("featured-products") }).strict(),
  z.object({ kind: z.literal("marquee") }).strict(),
  z.object({ kind: z.literal("magazine") }).strict(),
]);

const navigationViewModelSchema = z
  .object({
    ...stateShape,
    brand: headingSchema,
    items: z.array(previewActionSchema).min(1).max(12),
    kind: z.literal("navigation"),
  })
  .strict();
const announcementViewModelSchema = z
  .object({
    ...stateShape,
    kind: z.literal("announcement"),
    message: copySchema,
  })
  .strict();
const heroViewModelSchema = z
  .object({
    ...stateShape,
    body: copySchema,
    eyebrow: z.string().trim().min(1).max(120),
    heading: headingSchema,
    kind: z.literal("hero"),
    media: mediaSchema.optional(),
    primaryAction: previewActionSchema.optional(),
  })
  .strict();
export const homeViewModelSchema = z
  .object({
    ...stateShape,
    announcement: copySchema.optional(),
    announcementLink: presentationLinkSchema.optional(),
    featuredCollection: z
      .object({
        href: z.string().regex(/^\/collections\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
        id: publicIdSchema,
        name: headingSchema,
      })
      .strict(),
    hero: z
      .object({
        body: copySchema,
        eyebrow: z.string().trim().min(1).max(120),
        heading: headingSchema,
        media: editorMediaSchema.optional(),
        primaryLink: presentationLinkSchema.optional(),
        secondaryLink: presentationLinkSchema.optional(),
      })
      .strict(),
    featuredProduct: presentationProductCardSchema.optional(),
    kind: z.literal("home"),
    merchandisingOrder: z.int().min(1).max(12).default(1),
    merchandisingTitle: headingSchema.default("Best sellers"),
    merchandisingVisible: z.boolean().default(true),
    products: z.array(presentationProductCardSchema).max(24),
    resourceDestinations: z
      .array(
        z
          .object({
            href: z.string().startsWith("/"),
            id: z.string().min(1).max(160),
            kind: z.enum(["article", "collection"]),
          })
          .strict(),
      )
      .max(6_000)
      .default([]),
    sections: homeSectionSequenceSchema,
    shell: presentationShellViewModelSchema.omit({
      announcement: true,
      announcementLink: true,
    }),
  })
  .strict();
const collectionGridViewModelSchema = z
  .object({
    ...stateShape,
    collections: z
      .array(
        z
          .object({
            action: previewActionSchema,
            id: z.union([storefrontIdentifierSchema, publicIdSchema]),
            name: headingSchema,
          })
          .strict(),
      )
      .max(12),
    heading: headingSchema,
    description: copySchema.optional(),
    kind: z.literal("collection-grid"),
    products: z.array(presentationProductCardSchema).max(24).default([]),
    resource: presentationCollectionSchema.optional(),
  })
  .strict();
const productGridViewModelSchema = z
  .object({
    ...stateShape,
    heading: headingSchema,
    kind: z.literal("product-grid"),
    products: z.array(productSummarySchema).max(24),
  })
  .strict();
const promotionViewModelSchema = z
  .object({
    ...stateShape,
    action: previewActionSchema,
    body: copySchema,
    heading: headingSchema,
    kind: z.literal("promotion"),
  })
  .strict();
const editorialViewModelSchema = z
  .object({
    ...stateShape,
    body: copySchema,
    heading: headingSchema,
    kind: z.literal("editorial"),
    media: mediaSchema.optional(),
  })
  .strict();
const trustStripViewModelSchema = z
  .object({
    ...stateShape,
    items: z.array(z.string().trim().min(1).max(160)).min(1).max(8),
    kind: z.literal("trust-strip"),
  })
  .strict();
const footerViewModelSchema = z
  .object({
    ...stateShape,
    brand: headingSchema,
    kind: z.literal("footer"),
    legalLinks: z.array(previewActionSchema).min(1).max(12),
    summary: copySchema,
  })
  .strict();
export const productViewModelSchema = z
  .object({
    ...stateShape,
    actions: z.array(previewActionSchema).min(1).max(8),
    brand: z.string().trim().min(1).max(160).optional(),
    purchaseStatus: z.enum(["unverified"]).optional(),
    compareAtPriceLabel: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().min(1).max(50_000),
    descriptionDetail: z
      .object({
        bullets: z.array(z.string().trim().min(1).max(500)).max(20),
        eyebrow: z.string().trim().min(1).max(160).optional(),
        heading: z.string().trim().min(1).max(300),
        media: mediaSchema.optional(),
        text: z.string().trim().min(1).max(20_000),
      })
      .strict(),
    heading: headingSchema,
    kind: z.literal("product"),
    media: z.array(mediaSchema).max(50),
    colorMedia: z.record(z.string(), z.array(mediaSchema).min(1).max(50)).optional(),
    optionDefinitions: productOptionDefinitionsSchema.optional(),
    optionGroups: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(80),
            values: z.array(z.string().trim().min(1).max(160)).min(1).max(100),
          })
          .strict(),
      )
      .max(20),
    paymentBrands: z.array(z.enum(publicPaymentBrands)).max(publicPaymentBrands.length).optional(),
    deliverySummary: z.string().trim().min(1).max(300).optional(),
    shippingReturnsSummary: z.string().trim().min(1).max(300).optional(),
    priceLabel: z.string().trim().min(1).max(80),
    publishedRoutes: z.array(z.string().startsWith("/")).max(10_000),
    relatedProducts: z.array(presentationProductCardSchema).max(8).default([]),
    relatedCollection: z
      .object({
        href: z.string().regex(/^\/collections\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
        id: publicIdSchema,
        name: headingSchema,
      })
      .strict()
      .optional(),
    resource: presentationProductSchema.optional(),
    siteName: headingSchema,
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
    reviews: z
      .array(
        z
          .object({
            author: z.string().trim().min(1).max(160),
            date: z.string().trim().min(1).max(160),
            id: publicIdSchema.optional(),
            rating: z.number().int().min(1).max(5).optional(),
            text: z.string().trim().min(1).max(2_000),
          })
          .strict(),
      )
      .max(10_000)
      .default([]),
    shipping: z
      .object({ returnBody: z.string().trim().min(1).max(2_000), standard: copySchema })
      .strict()
      .optional(),
    specifications: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(160),
            value: z.string().trim().min(1).max(1_000),
          })
          .strict(),
      )
      .max(30),
    taxonomy: z
      .object({
        categories: z.array(z.string().trim().min(1).max(160)).max(20),
        tags: z.array(z.string().trim().min(1).max(160)).max(20),
      })
      .strict(),
    variants: z
      .array(
        z
          .object({
            id: z.union([storefrontIdentifierSchema, publicIdSchema]),
            label: z.string().trim().min(1).max(100),
            optionValues: z.record(
              z.string().trim().min(1).max(80),
              z.string().trim().min(1).max(160),
            ),
            compareAtPriceLabel: z.string().trim().min(1).max(80).optional(),
            priceLabel: z.string().trim().min(1).max(80),
            selected: z.boolean(),
            sku: z.string().trim().min(1).max(160).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();
const cartViewModelSchema = z
  .object({
    ...stateShape,
    checkoutAction: previewActionSchema,
    heading: headingSchema,
    helpCopy: copySchema.optional(),
    kind: z.literal("cart"),
    lines: z
      .array(
        z
          .object({
            id: storefrontIdentifierSchema,
            name: headingSchema,
            priceLabel: z.string().trim().min(1).max(80),
            quantity: z.int().positive().max(20),
            quantityActions: z.array(previewActionSchema).min(1).max(2),
          })
          .strict(),
      )
      .max(20),
    subtotalLabel: z.string().trim().min(1).max(80),
    policyLink: presentationLinkSchema.optional(),
  })
  .strict();
const checkoutViewModelSchema = z
  .object({
    ...stateShape,
    action: previewActionSchema,
    errorMessage: copySchema.optional(),
    heading: headingSchema,
    helpCopy: copySchema.optional(),
    kind: z.literal("checkout"),
    steps: z.array(z.string().trim().min(1).max(100)).min(1).max(6),
    summaryLines: z.array(z.string().trim().min(1).max(160)).min(1).max(20),
    policyLink: presentationLinkSchema.optional(),
  })
  .strict();
const orderViewModelSchema = z
  .object({
    ...stateShape,
    errorMessage: copySchema.optional(),
    heading: headingSchema,
    kind: z.literal("order"),
    lines: z.array(z.string().trim().min(1).max(160)).max(20),
    reference: z.string().trim().min(1).max(80),
    statusLabel: z.string().trim().min(1).max(120),
    totalLabel: z.string().trim().min(1).max(80),
  })
  .strict();
const policyViewModelSchema = z
  .object({
    ...stateShape,
    heading: headingSchema,
    kind: z.literal("policy"),
    paragraphs: z.array(copySchema).min(1).max(30),
  })
  .strict();
const stateViewModelSchema = z
  .object({
    ...stateShape,
    action: previewActionSchema.optional(),
    contactVersion: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    heading: headingSchema,
    kind: z.literal("state"),
    media: editorMediaSchema.optional(),
    message: copySchema,
    presentationStyle: z.enum(["standard", "editorial"]).optional(),
    publicContact: publicContactSchema.optional(),
    relatedAction: previewActionSchema.optional(),
  })
  .strict();
const themeSectionViewModelSchema = z
  .object({
    ...stateShape,
    data: z.record(z.string(), z.unknown()),
    kind: z.literal("theme-section"),
  })
  .strict();
const releasedContentSectionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: z.string(),
      kind: z.literal("heading"),
      level: z.literal(2).or(z.literal(3)),
      text: z.string(),
    })
    .strict(),
  z.object({ id: z.string(), kind: z.literal("paragraph"), text: z.string() }).strict(),
  z
    .object({
      alt: z.string(),
      caption: z.string().optional(),
      id: z.string(),
      kind: z.literal("image"),
      media: mediaSchema,
    })
    .strict(),
  z
    .object({
      href: z.string().min(1).max(2_000),
      id: z.string(),
      kind: z.literal("link"),
      label: z.string().trim().min(1).max(120),
      targetBehavior: storefrontLinkTargetBehaviorSchema,
    })
    .strict(),
]);
const releasedContentViewModelSchema = z
  .object({
    ...stateShape,
    contentKind: z.enum(["article", "page"]),
    contactVersion: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    id: z.string(),
    kind: z.literal("released-content"),
    publicContact: publicContactSchema.optional(),
    route: z.string().regex(/^\/(?!\/)[^\s]*$/),
    sections: z.array(releasedContentSectionSchema).min(1).max(40),
    summary: z.string().max(500),
    title: headingSchema,
    version: z.number().int().positive(),
  })
  .strict();

export const presentationViewModelSchema = z.discriminatedUnion("kind", [
  navigationViewModelSchema,
  announcementViewModelSchema,
  heroViewModelSchema,
  homeViewModelSchema,
  collectionGridViewModelSchema,
  productGridViewModelSchema,
  promotionViewModelSchema,
  editorialViewModelSchema,
  trustStripViewModelSchema,
  footerViewModelSchema,
  productViewModelSchema,
  cartViewModelSchema,
  checkoutViewModelSchema,
  orderViewModelSchema,
  policyViewModelSchema,
  stateViewModelSchema,
  themeSectionViewModelSchema,
  releasedContentViewModelSchema,
]);

export const experienceFixtureSchema = z
  .object({
    id: storefrontIdentifierSchema,
    label: z.string().trim().min(1).max(160),
    pageTypes: z.array(pageTypeSchema).min(1).max(10),
    shellViewModels: z
      .record(storefrontIdentifierSchema, presentationShellRenderViewModelSchema)
      .optional(),
    viewModels: z.record(storefrontIdentifierSchema, presentationViewModelSchema),
  })
  .strict();

export type PresentationViewModel = z.infer<typeof presentationViewModelSchema>;
export type ProductPageModel = z.infer<typeof productViewModelSchema>;
export type PresentationProductCard = z.infer<typeof presentationProductCardSchema>;
export type PresentationShellViewModel = z.infer<typeof presentationShellViewModelSchema>;
export type PresentationShellRenderViewModel = z.infer<
  typeof presentationShellRenderViewModelSchema
>;
export type PlatformRoutePresentationViewModel = z.infer<
  typeof platformRoutePresentationViewModelSchema
>;
export type ExperienceFixture = z.infer<typeof experienceFixtureSchema>;
export type ExperienceFixtureRegistry = Readonly<Record<string, ExperienceFixture>>;
export {
  presentationCollectionSchema as livePresentationCollectionSchema,
  presentationProductSchema as livePresentationProductSchema,
};
export type LivePresentationCollection = PresentationCollection;
export type LivePresentationProduct = PresentationProduct;

export function resolveFixtureBinding(
  instanceId: string,
  bindings: readonly FixtureBinding[],
): FixtureBinding {
  const matches = bindings.filter((binding) => binding.instanceId === instanceId);
  if (matches.length === 0) {
    throw new Error(`Visible instance ${instanceId} is missing a fixture binding.`);
  }
  if (matches.length > 1) {
    throw new Error(`Visible instance ${instanceId} has ambiguous fixture bindings.`);
  }
  return matches[0]!;
}

export function resolveFixtureViewModel(
  binding: FixtureBinding,
  registry: ExperienceFixtureRegistry,
): PresentationViewModel {
  const fixture = registry[binding.fixtureId];
  if (!fixture) throw new Error(`Fixture ${binding.fixtureId} is missing.`);
  const parsed = experienceFixtureSchema.parse(fixture);
  if (parsed.id !== binding.fixtureId) {
    throw new Error(`Fixture registry key ${binding.fixtureId} does not match its stable ID.`);
  }
  const viewModel = parsed.viewModels[binding.resource];
  if (!viewModel) {
    throw new Error(`Fixture resource ${binding.resource} is missing from ${binding.fixtureId}.`);
  }
  if (viewModel.state !== binding.state) {
    throw new Error(
      `Fixture resource ${binding.resource} state does not match binding ${binding.id}.`,
    );
  }
  return viewModel;
}

export function resolveFixtureShellViewModel(
  binding: FixtureBinding,
  registry: ExperienceFixtureRegistry,
  resource: string,
): PresentationShellRenderViewModel {
  const fixture = registry[binding.fixtureId];
  if (!fixture) throw new Error(`Fixture ${binding.fixtureId} is missing.`);
  const parsed = experienceFixtureSchema.parse(fixture);
  if (binding.resource !== resource) {
    throw new Error(
      `Fixture shell resource ${resource} does not match binding ${binding.id} resource ${binding.resource}.`,
    );
  }
  const viewModel = parsed.shellViewModels?.[resource];
  if (!viewModel) {
    throw new Error(`Fixture shell resource ${resource} is missing from ${binding.fixtureId}.`);
  }
  return viewModel;
}
