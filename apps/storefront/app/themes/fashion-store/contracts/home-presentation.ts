import * as z from "zod";

import type { PresentationViewModel } from "../../../theme-engine/view-models";

export const fashionStoreHomePresentationSchema = z.object({
  "brand-strip-presentation": z.enum(["source", "decor-continuous"]).default("source"),
  "categories-presentation": z.enum(["source", "decor-icons"]).default("source"),
  "collection-presentation": z.enum(["source", "decor-layered"]).default("source"),
  "editorial-presentation": z.enum(["source", "decor-journal"]).default("source"),
  "marquee-presentation": z.enum(["source", "decor-reverse"]).default("source"),
  "services-presentation": z.enum(["source", "decor-compact"]).default("source"),
});

export type FashionStoreHomePresentation = z.infer<typeof fashionStoreHomePresentationSchema>;

export function resolveFashionStoreHomePresentation(viewModel: PresentationViewModel): {
  brands: FashionStoreHomePresentation["brand-strip-presentation"];
  categories: FashionStoreHomePresentation["categories-presentation"];
  collection: FashionStoreHomePresentation["collection-presentation"];
  editorial: FashionStoreHomePresentation["editorial-presentation"];
  marquee: FashionStoreHomePresentation["marquee-presentation"];
  services: FashionStoreHomePresentation["services-presentation"];
} {
  if (viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store Home presentation requires a theme-section ViewModel.");
  }
  const parsed = fashionStoreHomePresentationSchema.parse(viewModel.data.presentation ?? {});
  return {
    brands: parsed["brand-strip-presentation"],
    categories: parsed["categories-presentation"],
    collection: parsed["collection-presentation"],
    editorial: parsed["editorial-presentation"],
    marquee: parsed["marquee-presentation"],
    services: parsed["services-presentation"],
  };
}
