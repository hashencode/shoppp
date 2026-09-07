import * as z from "zod";

import { presentationProductCardSchema } from "../../../theme-engine/view-models";
import type { PresentationViewModel } from "../../../theme-engine/view-models";

const groupIdSchema = z.enum(["new-arrivals", "best-sellers", "featured"]);
export function buildFashionStoreMerchandisingGroups<T>(
  products: readonly T[],
  featuredProduct?: T,
) {
  return [
    { id: "new-arrivals" as const, products: products.slice(0, 4) },
    { id: "best-sellers" as const, products: products.slice(0, 8) },
    {
      id: "featured" as const,
      products: featuredProduct ? [featuredProduct] : products.slice(0, 1),
    },
  ];
}

export function resolveFashionStoreMerchandising(viewModel: PresentationViewModel) {
  if (viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store merchandising requires a theme-section ViewModel.");
  }
  if (viewModel.state !== "populated") return { state: viewModel.state } as const;
  const parsed = fashionStoreMerchandisingDataSchema.safeParse(viewModel.data.merchandising);
  return parsed.success
    ? ({ data: parsed.data, state: "populated" } as const)
    : ({ state: "validation-error" } as const);
}
const fixtureProductSchema = z
  .object({
    badge: z.enum(["Hot", "New"]).optional(),
    categories: z.array(z.string()),
    colors: z.array(z.string()),
    id: z.string().min(1),
    name: z.string().min(1),
    originalPrice: z.string().min(1),
    price: z.string().min(1),
    sizes: z.array(z.string()),
    sourceImage: z.string().min(1),
    tags: z.array(z.string()),
  })
  .strict();

const merchandisingGroup = <T extends z.ZodType>(product: T) =>
  z
    .object({
      id: groupIdSchema,
      products: z.array(product).max(12),
    })
    .strict();

export const fashionStoreMerchandisingDataSchema = z.discriminatedUnion("mode", [
  z
    .object({
      groups: z.array(merchandisingGroup(fixtureProductSchema)).length(3),
      mode: z.literal("fixture"),
    })
    .strict(),
  z
    .object({
      groups: z.array(merchandisingGroup(presentationProductCardSchema)).length(3),
      mode: z.literal("live"),
    })
    .strict(),
]);
