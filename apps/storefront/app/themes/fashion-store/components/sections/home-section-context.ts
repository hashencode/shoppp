import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { SectionInstance } from "@shoppp/contracts";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import { fashionStoreAssetId } from "../../resources";
import { resolveFashionStoreHomePresentation } from "../../contracts/home-presentation";
import { resolveFashionStoreMerchandising } from "../../contracts/home-merchandising";

export interface FashionStoreHomeSectionProperties {
  instance: SectionInstance;
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}

export interface FashionStoreHomeSectionContext {
  merchandising?: ReturnType<typeof resolveFashionStoreMerchandising>;
  presentation: ReturnType<typeof resolveFashionStoreHomePresentation>;
  state: PresentationViewModel["state"];
}

export function resolveFashionStoreHomeSectionContext(
  viewModel: PresentationViewModel,
): FashionStoreHomeSectionContext {
  if (viewModel.kind !== "theme-section") {
    throw new Error("Fashion Store Home Section requires a theme-section ViewModel.");
  }
  const merchandising = Object.hasOwn(viewModel.data, "merchandising")
    ? resolveFashionStoreMerchandising(viewModel)
    : undefined;
  return {
    ...(merchandising ? { merchandising } : {}),
    presentation: resolveFashionStoreHomePresentation(viewModel),
    state: viewModel.state,
  };
}

export function resolveHomeAsset(resolveAsset: ThemeAssetResolver, sourcePath: string): string {
  return resolveAsset(fashionStoreAssetId(sourcePath));
}
