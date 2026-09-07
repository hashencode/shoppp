import type { CanonicalCatalogRelease } from "@shoppp/contracts";

import type { PresentationViewModelKind } from "@shoppp/contracts";

import type { PresentationShellRenderViewModel, PresentationViewModel } from "../view-models";

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
  expectedKind?: PresentationViewModelKind;
  instanceId: string;
}

export interface PresentationProvider {
  resolve(input: PresentationProviderResolveInput): PresentationViewModel;
  resolveShell?(input: { instanceId: string; resource: string }): PresentationShellRenderViewModel;
}

export function requireExpectedViewModelKind(
  viewModel: PresentationViewModel,
  expectedKind?: PresentationViewModelKind,
): PresentationViewModel {
  if (expectedKind && viewModel.kind !== expectedKind) {
    throw new Error(
      `Presentation ViewModel kind ${viewModel.kind} does not match declared kind ${expectedKind}.`,
    );
  }
  return viewModel;
}
