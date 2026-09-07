import type { ComposedExperienceRoute, ComposeExperienceRouteInput } from "../composer";
import { composeExperienceRoute } from "../composer";
import { requireExpectedViewModelKind, type PresentationProvider } from "./types";

export class PresentationCompositionError extends Error {
  readonly composition: ComposedExperienceRoute;

  constructor(composition: ComposedExperienceRoute) {
    const codes = composition.diagnostics.map(({ code }) => code).join(", ");
    super(`Live storefront composition failed: ${codes}.`);
    this.name = "PresentationCompositionError";
    this.composition = composition;
  }
}

export function createLivePresentationProvider(
  input: ComposeExperienceRouteInput,
): PresentationProvider {
  const composition = composeExperienceRoute(input);
  const provider: PresentationProvider = {
    resolve({ expectedKind, instanceId }) {
      const viewModel = composition.viewModels[instanceId];
      if (!composition.ok || !viewModel) throw new PresentationCompositionError(composition);
      return requireExpectedViewModelKind(viewModel, expectedKind);
    },
    resolveShell() {
      if (!composition.ok || !composition.shell)
        throw new PresentationCompositionError(composition);
      return composition.shell;
    },
  };
  return Object.freeze(provider);
}
