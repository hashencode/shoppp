import {
  fixtureStateSchema,
  pageTypeSchema,
  presentationCollectionSchema,
  presentationProductSchema,
  publicIdSchema,
  storefrontIdentifierSchema,
  type FixtureBinding,
  type PresentationCollection,
  type PresentationProduct,
} from "@shoppp/contracts";
import * as z from "zod";

import { previewActionSchema } from "./actions";

const stateShape = {
  state: fixtureStateSchema,
};
const headingSchema = z.string().trim().min(1).max(160);
const copySchema = z.string().trim().min(1).max(2_000);
const mediaSchema = z
  .object({
    alt: z.string().trim().min(1).max(300),
    height: z.int().positive().max(16_384),
    src: z
      .string()
      .regex(/^\/media\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/)
      .refine((value) => !value.includes("..") && !value.includes("//")),
    width: z.int().positive().max(16_384),
  })
  .strict();
const productSummarySchema = z
  .object({
    href: z.string().regex(/^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
    id: storefrontIdentifierSchema,
    media: mediaSchema,
    name: headingSchema,
    priceLabel: z.string().trim().min(1).max(80),
  })
  .strict();

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
const collectionGridViewModelSchema = z
  .object({
    ...stateShape,
    collections: z
      .array(
        z
          .object({
            action: previewActionSchema,
            id: storefrontIdentifierSchema,
            name: headingSchema,
          })
          .strict(),
      )
      .max(12),
    heading: headingSchema,
    kind: z.literal("collection-grid"),
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
const productViewModelSchema = z
  .object({
    ...stateShape,
    actions: z.array(previewActionSchema).min(1).max(8),
    description: copySchema,
    heading: headingSchema,
    kind: z.literal("product"),
    media: z.array(mediaSchema).min(1).max(12),
    priceLabel: z.string().trim().min(1).max(80),
    resource: presentationProductSchema.optional(),
    variants: z
      .array(
        z
          .object({
            id: z.union([storefrontIdentifierSchema, publicIdSchema]),
            label: z.string().trim().min(1).max(100),
            selected: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();
const cartViewModelSchema = z
  .object({
    ...stateShape,
    checkoutAction: previewActionSchema,
    heading: headingSchema,
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
  })
  .strict();
const checkoutViewModelSchema = z
  .object({
    ...stateShape,
    action: previewActionSchema,
    errorMessage: copySchema.optional(),
    heading: headingSchema,
    kind: z.literal("checkout"),
    steps: z.array(z.string().trim().min(1).max(100)).min(1).max(6),
    summaryLines: z.array(z.string().trim().min(1).max(160)).min(1).max(20),
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
    heading: headingSchema,
    kind: z.literal("state"),
    message: copySchema,
  })
  .strict();
const themeSectionViewModelSchema = z
  .object({
    ...stateShape,
    data: z.record(z.string(), z.unknown()),
    kind: z.literal("theme-section"),
  })
  .strict();

export const presentationViewModelSchema = z.discriminatedUnion("kind", [
  navigationViewModelSchema,
  announcementViewModelSchema,
  heroViewModelSchema,
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
]);

export const experienceFixtureSchema = z
  .object({
    id: storefrontIdentifierSchema,
    label: z.string().trim().min(1).max(160),
    pageTypes: z.array(pageTypeSchema).min(1).max(10),
    viewModels: z.record(storefrontIdentifierSchema, presentationViewModelSchema),
  })
  .strict();

export type PresentationViewModel = z.infer<typeof presentationViewModelSchema>;
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
