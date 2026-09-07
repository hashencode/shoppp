import type { FixtureBinding } from "@shoppp/contracts";

import {
  resolveFixtureBinding,
  resolveFixtureViewModel,
  resolveFixtureShellViewModel,
  type ExperienceFixtureRegistry,
} from "../view-models";
import { requireExpectedViewModelKind, type PresentationProvider } from "./types";

export interface FixturePresentationProviderInput {
  bindings: readonly FixtureBinding[];
  fixtures: ExperienceFixtureRegistry;
}

export function createFixturePresentationProvider(
  input: FixturePresentationProviderInput,
): PresentationProvider {
  const provider: PresentationProvider = {
    resolve({ expectedKind, instanceId }) {
      return requireExpectedViewModelKind(
        resolveFixtureViewModel(resolveFixtureBinding(instanceId, input.bindings), input.fixtures),
        expectedKind,
      );
    },
    resolveShell({ instanceId, resource }) {
      return resolveFixtureShellViewModel(
        resolveFixtureBinding(instanceId, input.bindings),
        input.fixtures,
        resource,
      );
    },
  };
  return Object.freeze(provider);
}
