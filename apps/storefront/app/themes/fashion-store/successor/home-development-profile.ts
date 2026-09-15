import * as z from "zod";

export const fashionStoreHomeCompositionSchema = z.enum(["isolated", "combined"]);

export type FashionStoreHomeComposition = z.infer<typeof fashionStoreHomeCompositionSchema>;

export interface FashionStoreHomeDevelopmentProfile {
  composition: FashionStoreHomeComposition;
  serialized: FashionStoreHomeComposition;
}

export const defaultFashionStoreHomeDevelopmentProfile = "combined" as const;

export function parseFashionStoreHomeDevelopmentProfile(
  value: string = defaultFashionStoreHomeDevelopmentProfile,
): FashionStoreHomeDevelopmentProfile {
  const composition = fashionStoreHomeCompositionSchema.parse(value);
  return {
    composition,
    serialized: composition,
  };
}

export function applyFashionStoreHomeComposition<
  T extends { sections: Array<{ type: string; visible?: boolean }> },
>(template: T, composition: FashionStoreHomeComposition): T {
  for (const section of template.sections) {
    section.visible =
      composition === "combined" ||
      section.type === "fashion-store.hero" ||
      section.type === "fashion-store.product-merchandising";
  }
  return template;
}
