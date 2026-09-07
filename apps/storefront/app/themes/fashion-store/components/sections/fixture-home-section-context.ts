import { fashionStoreHomeDataSchema, type FashionStoreHomeData } from "../../fixtures/home";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";

export { resolveHomeAsset } from "./home-section-context";
export type { FashionStoreHomeSectionProperties } from "./home-section-context";

const parsedHomeData = new WeakMap<object, FashionStoreHomeData>();

export function resolveFixtureHomeData(viewModel: PresentationViewModel): FashionStoreHomeData {
  if (viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store fixture Home Section requires a theme-section ViewModel.");
  }
  const source = viewModel.data.home ?? viewModel.data;
  if (typeof source !== "object" || source === null)
    return fashionStoreHomeDataSchema.parse(source);
  const cached = parsedHomeData.get(source);
  if (cached) return cached;
  const parsed = fashionStoreHomeDataSchema.parse(source);
  parsedHomeData.set(source, parsed);
  return parsed;
}
