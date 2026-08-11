import type { CanonicalCatalogRelease } from "@shoppp/contracts";

import type { PresentationViewModel } from "../view-models";

export type ActiveExperienceProviderInput =
  | { mode: "production" }
  | { mode: "fixture-preview" }
  | {
      identity: {
        catalogReleaseId: string;
        experienceSnapshotId: string;
        experienceVersion: number;
        platformContractVersion: string;
        themeId: string;
        themeVersion: string;
      };
      mode: "live";
      release: CanonicalCatalogRelease;
    };

export interface PresentationProviderResolveInput {
  instanceId: string;
}

export interface PresentationProvider {
  resolve(input: PresentationProviderResolveInput): PresentationViewModel;
}
