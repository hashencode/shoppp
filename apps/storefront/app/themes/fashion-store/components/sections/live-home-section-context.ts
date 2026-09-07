import {
  homeViewModelSchema,
  type PresentationViewModel,
} from "../../../../theme-engine/view-models";

export { resolveHomeAsset } from "./home-section-context";
export type { FashionStoreHomeSectionProperties } from "./home-section-context";

type HomeViewModel = Extract<PresentationViewModel, { kind: "home" }>;

const parsedHomeData = new WeakMap<object, HomeViewModel>();

export function resolveLiveHomeData(viewModel: PresentationViewModel): HomeViewModel {
  if (viewModel.kind === "home") return viewModel;
  if (viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store live Home Section requires a theme-section ViewModel.");
  }
  const source = viewModel.data.home;
  if (typeof source !== "object" || source === null) return homeViewModelSchema.parse(source);
  const cached = parsedHomeData.get(source);
  if (cached) return cached;
  const parsed = homeViewModelSchema.parse(source);
  parsedHomeData.set(source, parsed);
  return parsed;
}
