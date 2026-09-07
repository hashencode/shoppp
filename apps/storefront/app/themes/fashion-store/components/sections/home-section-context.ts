import type { ThemeAssetResolver } from "../../../../theme-engine/assets";
import type { SectionInstance } from "@shoppp/contracts";
import type { PresentationViewModel } from "../../../../theme-engine/view-models";
import { fashionStoreAssetId } from "../../resources";

export interface FashionStoreHomeSectionProperties {
  instance: SectionInstance;
  resolveAsset: ThemeAssetResolver;
  viewModel: PresentationViewModel;
}

export function resolveHomeAsset(resolveAsset: ThemeAssetResolver, sourcePath: string): string {
  return resolveAsset(fashionStoreAssetId(sourcePath));
}
