import type {
  CanonicalCatalogRelease,
  CatalogReleaseV3,
  StorefrontResourceReference,
} from "@shoppp/contracts";

type StorefrontCatalogRelease = CanonicalCatalogRelease | CatalogReleaseV3;

import type { PresentationViewModel } from "./view-models";

export interface ThemeHomeSectionDataInput {
  home: Extract<PresentationViewModel, { kind: "home" }>;
  sectionType: string;
}

export interface ThemeReferenceDestination {
  id: string;
  kind: StorefrontResourceReference["kind"];
  name: string;
}

export interface ThemeCompositionAdapter {
  destinations(release: StorefrontCatalogRelease): readonly ThemeReferenceDestination[];
  home?: {
    featuredCollectionSettingId: string;
    featuredProductSettingId: string;
    sectionData?(input: ThemeHomeSectionDataInput): Readonly<Record<string, unknown>>;
    sectionType: string;
  };
  referenceHref(
    release: StorefrontCatalogRelease,
    reference: StorefrontResourceReference,
  ): string | undefined;
}
