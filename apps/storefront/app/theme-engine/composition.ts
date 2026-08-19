import type { CanonicalCatalogRelease, StorefrontResourceReference } from "@shoppp/contracts";

export interface ThemeReferenceDestination {
  id: string;
  kind: StorefrontResourceReference["kind"];
  name: string;
}

export interface ThemeCompositionAdapter {
  destinations(release: CanonicalCatalogRelease): readonly ThemeReferenceDestination[];
  home?: {
    featuredCollectionSettingId: string;
    featuredProductSettingId: string;
    sectionType: string;
  };
  referenceHref(
    release: CanonicalCatalogRelease,
    reference: StorefrontResourceReference,
  ): string | undefined;
}
